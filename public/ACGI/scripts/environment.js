import * as THREE from 'three';

import {
    scene,
    renderer,
    camera,
    config,
    TOWER_HEIGHT_MIN,
    GREEN_LAYOUT,
    DIVIDER_WALL,
    BUILDINGS_ZONE,
    OPPOSITE_ROAD,
    clock
} from './core.js';

import {
    initSpatialGridSystem,
    resetSpatialGrid,
    rebuildSpatialGrid,
    updateSpatialGridDebug,
    updateTentObstacles,
    rebuildNavSystem,
    rebuildNavDebug,
    rebuildStaticObstacleGrid,
    updateCathedralNoGo,
    gridDebug,
    spatialGrid
} from './navigation.js';

import {
    createCathedralArch,
    createCathedralArchControlCage,
    createTerrainSurface,
    createGardenPath,
    createProceduralTower,
    createProceduralTowerControlCage,
    createProceduralDome,
    createProceduralTentCanopy,
    createProceduralTentCanopyControlCage,
    createProceduralGravestone,
    createProceduralObelisk,
    createProceduralCross,
    createProceduralGraveMound,
    createProceduralGraveMoundControlCage,
    createProceduralStoneBase,
    getOrCreateParametricGeometry,
    clearGeometryCache
} from './procedural.js';

import { materials } from './materials.js';

const GOTHIC_WINDOW_FRAME_GEOM = new THREE.BoxGeometry(1.2, 2.2, 0.3);
const GOTHIC_WINDOW_PANE_GEOM = new THREE.BoxGeometry(0.4, 1.4, 0.12);
const GOTHIC_WINDOW_ARCH_GEOM = new THREE.ConeGeometry(0.55, 0.7, 8);
const GREEN_VILLAGE_PANE_GEOM = new THREE.BoxGeometry(0.8, 1.4, 0.12);
const TENT_POLE_GEOM = new THREE.CylinderGeometry(0.08, 0.1, 4.8, 6);
const TENT_STAKE_GEOM = new THREE.CylinderGeometry(0.04, 0.05, 1.8, 4);
const TENT_STAKE_OFFSETS = [[-2.1, -2.1], [-2.1, 2.1], [2.1, -2.1], [2.1, 2.1]];
const TERRAIN_NOISE_SCALE = 0.025;
const TERRAIN_NOISE_AMPLITUDE = 1.2;
const TERRAIN_NOISE_OCTAVES = 4;
const CATHEDRAL_PORTAL_MAT = new THREE.MeshStandardMaterial({
    color: 0x35383f,
    roughness: 0.72,
    metalness: 0.08,
    emissive: 0x0b0d10,
    emissiveIntensity: 0.05
});
const GARDEN_PATH_DEBUG_POINT_GEOM = new THREE.SphereGeometry(0.22, 10, 8);
const GARDEN_PATH_DEBUG_POINT_MAT = new THREE.MeshBasicMaterial({
    color: 0xffd166,
    depthTest: false,
    depthWrite: false
});
const GARDEN_PATH_DEBUG_MAIN_CURVE_MAT = new THREE.LineBasicMaterial({
    color: 0x00e5ff,
    transparent: true,
    opacity: 0.95,
    depthTest: false,
    depthWrite: false
});
const GARDEN_PATH_DEBUG_MAIN_CONTROL_MAT = new THREE.LineBasicMaterial({
    color: 0x4cc9f0,
    transparent: true,
    opacity: 0.65,
    depthTest: false,
    depthWrite: false
});
const GARDEN_PATH_DEBUG_CROSS_CURVE_MAT = new THREE.LineBasicMaterial({
    color: 0xff7b00,
    transparent: true,
    opacity: 0.95,
    depthTest: false,
    depthWrite: false
});
const GARDEN_PATH_DEBUG_CROSS_CONTROL_MAT = new THREE.LineBasicMaterial({
    color: 0xffbe0b,
    transparent: true,
    opacity: 0.7,
    depthTest: false,
    depthWrite: false
});

let buildingsGroup = null;
let mainBuildingFootprints = []; 
let greenBuildingsGroup = null;
let greenBuildingFootprints = []; 
let oppositeRoadMesh = null;
let spatialGridDebugMesh = null;
let riverMesh, riverMaterial;
let riverTreeLodField = null;
let sunLight, ambientLight, moonLight;
let platformSurfaceMat = null;
let platformRetainingWallMat = null;
let platformDims = {
    width: 110,
    depth: 310,
    centerX: 0,
    centerZ: 40,
    height: 8
};
let cathedral, tents, graveyard, greenAndRoad, wall, platform, river, foliageField, ground, groundGroup, gardenPaths, cathedralYardGround;
let stageRaycastTargets = [];

const platformHeight = 8;
const groundLevel = -8;
const CATHEDRAL_LAYOUT = {
    x: 5,
    z: 20
};
const stageRaycaster = new THREE.Raycaster();
stageRaycaster.far = 600;
const _stageRayOrigin = new THREE.Vector3();
const _stageRayDir = new THREE.Vector3(0, -1, 0);
const SUN_LIGHT_OFFSET = new THREE.Vector3(50, 100, 60);
const MOON_LIGHT_OFFSET = new THREE.Vector3(-30, 50, -20);
const _lightFocus = new THREE.Vector3();
const _tmpWallWorldPos = new THREE.Vector3();
const _tmpWallLocalPos = new THREE.Vector3();
const TREE_LOD_NEAR_DEFAULT = 40;
const TREE_LOD_HYSTERESIS_DEFAULT = 8;

function getTreeLodSettings() {
    const nearDistRaw = Number(config.treeDetailHighDist);
    const hysteresisRaw = Number(config.treeLodHysteresis);
    const nearDist = Number.isFinite(nearDistRaw) ? Math.max(0, nearDistRaw) : TREE_LOD_NEAR_DEFAULT;
    const hysteresis = Number.isFinite(hysteresisRaw) ? Math.max(0, hysteresisRaw) : TREE_LOD_HYSTERESIS_DEFAULT;
    return { nearDist, hysteresis };
}

function calculateTreeLodLevel(distance, currentLevel, nearDist, hysteresis) {
    // Symmetric hysteresis dead-band around the LOD threshold.
    if (!Number.isFinite(distance) || distance < 0) distance = 0;
    if (!Number.isFinite(nearDist)) nearDist = TREE_LOD_NEAR_DEFAULT;
    nearDist = Math.max(0, nearDist);

    if (hysteresis <= 0) return distance < nearDist ? 1 : 0;

    const half = hysteresis * 0.5;
    const nearDowngrade = nearDist + half; // close -> far
    const nearUpgrade = nearDist - half;   // far -> close

    if (currentLevel === 1) {
        return (distance > nearDowngrade) ? 0 : 1;
    }
    return (distance < nearUpgrade) ? 1 : 0;
}


// Per-instance opacity for LOD cross-fading.
function setupTreeInstanceAlphaMaterial(material) {
    material.transparent = true;
    material.depthWrite = true;
    material.onBeforeCompile = (shader) => {
        shader.vertexShader = [
            'attribute float instanceAlpha;',
            'varying float vInstanceAlpha;',
            shader.vertexShader
        ].join('\n');

        shader.vertexShader = shader.vertexShader.replace(
            '#include <begin_vertex>',
            [
                '#include <begin_vertex>',
                'vInstanceAlpha = instanceAlpha;'
            ].join('\n')
        );

        shader.fragmentShader = [
            'varying float vInstanceAlpha;',
            shader.fragmentShader
        ].join('\n');

        shader.fragmentShader = shader.fragmentShader.replace(
            '#include <premultiplied_alpha_fragment>',
            [
                'gl_FragColor.a *= vInstanceAlpha;',
                'if (gl_FragColor.a < 0.004) discard;',
                '#include <premultiplied_alpha_fragment>'
            ].join('\n')
        );
    };
    material.needsUpdate = true;
}
function attachInstanceAlphaAttribute(mesh) {
    const buf = new Float32Array(mesh.count).fill(1.0);
    mesh.geometry.setAttribute(
        'instanceAlpha',
        new THREE.InstancedBufferAttribute(buf, 1)
    );
}

class FoliageField {
    constructor({ treeCount, bushCount }) {
        this.treeCount = treeCount;
        this.bushCount = bushCount;
        this.group = new THREE.Group();
        this.group.name = "FoliageField";
        this.trees = [];
        this.bushes = [];
        this.treeLodLevels = [];
        this.trunksLod = [];
        this.canopiesLod = [];
        this.bushInst = null;
        this._lastUpdate = -1;
        this._updateInterval = 0.18;
        this._dummy = new THREE.Object3D();
        this._tmpMat = new THREE.Matrix4();
        this._minScale = 0.001;
    }

    dispose() {
        const toDispose = (obj) => {
            if (!obj) return;
            if (obj.geometry && !disposedGeometries.has(obj.geometry)) {
                disposedGeometries.add(obj.geometry);
                obj.geometry.dispose();
            }
            if (obj.material) {
                if (Array.isArray(obj.material)) {
                    obj.material.forEach((m) => {
                        if (m && !disposedMaterials.has(m)) {
                            disposedMaterials.add(m);
                            m.dispose();
                        }
                    });
                } else if (!disposedMaterials.has(obj.material)) {
                    disposedMaterials.add(obj.material);
                    obj.material.dispose();
                }
            }
        };
        const disposedGeometries = new Set();
        const disposedMaterials = new Set();
        if (this.trunksLod) this.trunksLod.forEach(toDispose);
        if (this.canopiesLod) this.canopiesLod.forEach(toDispose);
        toDispose(this.bushInst);
    }

    // Generate positions of foliage like trees and bushes based off current layout of the scene

    _generatePositions() {
        const cathedralEx = { cx: CATHEDRAL_LAYOUT.x, cz: CATHEDRAL_LAYOUT.z, w: 80, l: 70 };
        const graveyardEx = { cx: 0, cz: 32, w: 58, l: 30 };
        const buildingExtension = BUILDINGS_ZONE.rowCount * (BUILDINGS_ZONE.buildingDepth + BUILDINGS_ZONE.spacing) + 40;
        const buildingEndZ = BUILDINGS_ZONE.startZ - buildingExtension;
        const roadRightEdge = OPPOSITE_ROAD.centerX + OPPOSITE_ROAD.width / 2;
        const treeZoneMinX = roadRightEdge;
        const treeZoneMaxX = GREEN_LAYOUT.centerX + GREEN_LAYOUT.width / 2;
        const treeZoneMinZ = buildingEndZ;
        const treeZoneMaxZ = BUILDINGS_ZONE.startZ;
        const treeZoneWidth = treeZoneMaxX - treeZoneMinX;
        const treeZoneLength = treeZoneMaxZ - treeZoneMinZ;
        const treeZoneArea = treeZoneWidth * Math.abs(treeZoneLength);
        const treesPerUnitAt100 = 0.015;
        const coverageMultiplier = (config.treeCoverage || 50) / 100;
        const areaBasedTreeCount = Math.floor(treeZoneArea * treesPerUnitAt100 * coverageMultiplier);
        const effectiveTreeCount = areaBasedTreeCount;
        const maxTries = 40000;
        const coverage01 = THREE.MathUtils.clamp(coverageMultiplier, 0, 1);
        const treeMinDistance = THREE.MathUtils.lerp(3.4, 2.2, coverage01);
        const bushMinDistance = 1.35;
        const bushTreeMinDistance = 1.9;
        const treePlacement = createPlacementHash(treeMinDistance);
        const bushPlacement = createPlacementHash(bushMinDistance);
        const acceptTree = (x, z) => {
            const treeRoadKeepout = 4.5;
            if (x < treeZoneMinX || x > treeZoneMaxX) return false;
            if (z < treeZoneMinZ || z > treeZoneMaxZ) return false;
            if (rectContains(x, z, cathedralEx.cx, cathedralEx.cz, cathedralEx.w, cathedralEx.l)) return false;
            if (rectContains(x, z, graveyardEx.cx, graveyardEx.cz, graveyardEx.w, graveyardEx.l)) return false;
            if (isInAnyRoadZone(x, z, treeRoadKeepout)) return false;
            // Prevents placement over where the buildings are in the green area
            for (let i = 0; i < greenBuildingFootprints.length; i++) {
                const fp = greenBuildingFootprints[i];
                if (Math.abs(x - fp.cx) < fp.hw && Math.abs(z - fp.cz) < fp.hd) return false;
            }
            return true;
        };
        this.trees.length = 0;
        let tries = 0;
        while (this.trees.length < effectiveTreeCount && tries < maxTries) {
            tries++;
            const rx = pseudoRandom(tries * 3.17);
            const rz = pseudoRandom(tries * 7.91);
            const x = THREE.MathUtils.lerp(treeZoneMinX, treeZoneMaxX, rx);
            const z = THREE.MathUtils.lerp(treeZoneMinZ, treeZoneMaxZ, rz);
            if (!acceptTree(x, z)) continue;
            if (!treePlacement.canPlace(x, z, treeMinDistance)) continue;
            const s = 0.85 + pseudoRandom(tries * 1.37) * 0.9;
            const r = pseudoRandom(tries * 5.31) * Math.PI * 2;
            this.trees.push({ x, z, y: platformHeight, s, r });
            treePlacement.add(x, z);
        }

        // Tree placement between buildings in rear building area
        const greenMargin = 8;
        const greenMinX = GREEN_LAYOUT.centerX - GREEN_LAYOUT.width / 2 + greenMargin;
        const greenMaxX = GREEN_LAYOUT.centerX + GREEN_LAYOUT.width / 2 - greenMargin;
        const greenMinZ = GREEN_LAYOUT.centerZ - GREEN_LAYOUT.length / 2 + greenMargin;
        const greenMaxZ = GREEN_LAYOUT.centerZ + GREEN_LAYOUT.length / 2 - greenMargin;
        const greenArea = (greenMaxX - greenMinX) * (greenMaxZ - greenMinZ);
        const greenTreeTarget = Math.floor(greenArea * 0.012 * coverageMultiplier);
        const acceptGreenTree = (x, z) => {
            if (isInAnyRoadZone(x, z, 4.5)) return false;
            for (let i = 0; i < greenBuildingFootprints.length; i++) {
                const fp = greenBuildingFootprints[i];
                if (Math.abs(x - fp.cx) < fp.hw && Math.abs(z - fp.cz) < fp.hd) return false;
            }
            return true;
        };
        let greenTries = 0;
        let greenTreeCount = 0;
        while (greenTreeCount < greenTreeTarget && greenTries < maxTries) {
            greenTries++;
            const rx = pseudoRandom(greenTries * 13.17 + 500);
            const rz = pseudoRandom(greenTries * 17.91 + 500);
            const x = THREE.MathUtils.lerp(greenMinX, greenMaxX, rx);
            const z = THREE.MathUtils.lerp(greenMinZ, greenMaxZ, rz);
            if (!acceptGreenTree(x, z)) continue;
            if (!treePlacement.canPlace(x, z, treeMinDistance)) continue;
            const s = 0.85 + pseudoRandom(greenTries * 1.37 + 500) * 0.9;
            const r = pseudoRandom(greenTries * 5.31 + 500) * Math.PI * 2;
            this.trees.push({ x, z, y: platformHeight, s, r });
            treePlacement.add(x, z);
            greenTreeCount++;
        }
        const acceptBush = (x, z) => {
            const roadClearance = 3.0;
            const bushRoadKeepout = 1.5;
            const greenInnerW = Math.max(2, GREEN_LAYOUT.width - roadClearance * 2);
            const greenInnerL = Math.max(2, GREEN_LAYOUT.length - roadClearance * 2);
            const inGreenInterior = rectContains(x, z, GREEN_LAYOUT.centerX, GREEN_LAYOUT.centerZ, greenInnerW, greenInnerL);
            if (!inGreenInterior) return false;
            if (isInAnyRoadZone(x, z, bushRoadKeepout)) return false;
            // Avoid green-area village buildings
            for (let i = 0; i < greenBuildingFootprints.length; i++) {
                const fp = greenBuildingFootprints[i];
                if (Math.abs(x - fp.cx) < fp.hw && Math.abs(z - fp.cz) < fp.hd) return false;
            }
            return true;
        };
        this.bushes.length = 0;
        tries = 0;
        while (this.bushes.length < this.bushCount && tries < maxTries) {
            tries++;
            const rx = pseudoRandom(tries * 11.17);
            const rz = pseudoRandom(tries * 19.91);
            const x = THREE.MathUtils.lerp(
                GREEN_LAYOUT.centerX - GREEN_LAYOUT.width / 2,
                GREEN_LAYOUT.centerX + GREEN_LAYOUT.width / 2,
                rx
            );
            const z = THREE.MathUtils.lerp(
                GREEN_LAYOUT.centerZ - GREEN_LAYOUT.length / 2,
                GREEN_LAYOUT.centerZ + GREEN_LAYOUT.length / 2,
                rz
            );
            if (!acceptBush(x, z)) continue;
            if (!bushPlacement.canPlace(x, z, bushMinDistance)) continue;
            if (!treePlacement.canPlace(x, z, bushTreeMinDistance)) continue;
            const s = 0.7 + pseudoRandom(tries * 4.37) * 1.1;
            const r = pseudoRandom(tries * 8.31) * Math.PI * 2;
            this.bushes.push({ x, z, y: platformHeight, s, r });
            bushPlacement.add(x, z);
        }
    }

    build() {
        this._generatePositions();
        this.treeLodLevels = new Array(this.trees.length).fill(0);
        // Two geometric LOD levels for trees
        const trunkGeos = [
            new THREE.CylinderGeometry(0.16, 0.22, 1.9, 3, 1),   // Low detail for far
            new THREE.CylinderGeometry(0.16, 0.22, 1.9, 8, 2)    // High detail for near
        ];
        const canopyGeos = [
            new THREE.IcosahedronGeometry(0.85, 0),  // Low detail for far
            new THREE.IcosahedronGeometry(0.85, 2)   // High detail for near
        ];

        const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5b3b28, roughness: 1.0 });
        const canopyMat = new THREE.MeshStandardMaterial({ color: 0x2f7b34, roughness: 1.0 });
        // Inject per-instance alpha attribute into both shared materials.
        setupTreeInstanceAlphaMaterial(trunkMat);
        setupTreeInstanceAlphaMaterial(canopyMat);

        this.trunksLod = trunkGeos.map((g) => new THREE.InstancedMesh(g, trunkMat, this.trees.length));
        this.canopiesLod = canopyGeos.map((g) => new THREE.InstancedMesh(g, canopyMat, this.trees.length));
        for (let i = 0; i < 2; i++) {
            this.trunksLod[i].castShadow = true;
            this.trunksLod[i].receiveShadow = true;
            this.canopiesLod[i].castShadow = true;
            this.canopiesLod[i].receiveShadow = true;
            // Each InstancedMesh has its own geometry buffer, so alpha attributes
            attachInstanceAlphaAttribute(this.trunksLod[i]);
            attachInstanceAlphaAttribute(this.canopiesLod[i]);
            this.group.add(this.trunksLod[i]);
            this.group.add(this.canopiesLod[i]);
        }

        const bushGeom = new THREE.IcosahedronGeometry(0.42, 0);
        const bushMat = new THREE.MeshStandardMaterial({ color: 0x2f6b2d, roughness: 1.0 });
        this.bushInst = new THREE.InstancedMesh(bushGeom, bushMat, this.bushes.length);
        this.bushInst.castShadow = false;
        this.bushInst.receiveShadow = true;
        this.group.add(this.bushInst);
        this.forceUpdate(camera, clock.getElapsedTime());
        return this.group;
    }

    forceUpdate(cam, t) {
        this._lastUpdate = -1e9;
        this.update(cam, t);
    }

    update(cam, t) {
        const dt = (this._lastUpdate < 0) ? 0 : Math.min(t - this._lastUpdate, 0.1);
        this._lastUpdate = t;
        const { nearDist, hysteresis } = getTreeLodSettings();

        const FADE_RATE = 8.0;
        const FADE_STEP = FADE_RATE * dt; // Utilised for smoothing LOD transition of Trees to prevent popping

        if (!this.treeLodAlpha || this.treeLodAlpha.length !== this.trees.length) {
            this.treeLodAlpha = new Float32Array(this.trees.length).fill(0);
        }
        if (this.treeLodLevels.length !== this.trees.length) {
            this.treeLodLevels = new Array(this.trees.length).fill(0);
        }

        const treeCount = this.trees.length;
        for (let i = 0; i < 2; i++) {
            this.trunksLod[i].count = treeCount;
            this.canopiesLod[i].count = treeCount;
        }

        // Grab the raw alpha buffer arrays for direct write — avoids repeated
        const trunk0Alpha  = this.trunksLod[0].geometry.getAttribute('instanceAlpha')?.array;
        const trunk1Alpha  = this.trunksLod[1].geometry.getAttribute('instanceAlpha')?.array;
        const canopy0Alpha = this.canopiesLod[0].geometry.getAttribute('instanceAlpha')?.array;
        const canopy1Alpha = this.canopiesLod[1].geometry.getAttribute('instanceAlpha')?.array;

        for (let k = 0; k < treeCount; k++) {
            const tr = this.trees[k];
            const dx = cam.position.x - tr.x;
            const dz = cam.position.z - tr.z;
            const dist = Math.sqrt(dx * dx + dz * dz);
            const baseY = tr.y + 0.005;

            const prevLevel = this.treeLodLevels[k] ?? 0;
            const lodLevel = calculateTreeLodLevel(dist, prevLevel, nearDist, hysteresis);
            this.treeLodLevels[k] = lodLevel;

            const target = lodLevel === 1 ? 1.0 : 0.0;
            const prev   = this.treeLodAlpha[k];
            const alpha  = prev + Math.sign(target - prev) *
                           Math.min(FADE_STEP, Math.abs(target - prev));
            this.treeLodAlpha[k] = alpha;

            const w0 = 1.0 - alpha; 
            const w1 = alpha;       

            const trunkS  = tr.s;
            const canopyS = 1.35 * tr.s;
            this._dummy.rotation.set(0, tr.r, 0);

            this._dummy.position.set(tr.x, baseY + 0.95 * tr.s, tr.z);
            this._dummy.scale.set(trunkS, trunkS, trunkS);
            this._dummy.updateMatrix();
            this.trunksLod[0].setMatrixAt(k, this._dummy.matrix);
            this.trunksLod[1].setMatrixAt(k, this._dummy.matrix);

            this._dummy.position.set(tr.x, baseY + 1.85 * tr.s, tr.z);
            this._dummy.scale.set(canopyS, canopyS, canopyS);
            this._dummy.updateMatrix();
            this.canopiesLod[0].setMatrixAt(k, this._dummy.matrix);
            this.canopiesLod[1].setMatrixAt(k, this._dummy.matrix);

            if (trunk0Alpha)  trunk0Alpha[k]  = w0;
            if (trunk1Alpha)  trunk1Alpha[k]  = w1;
            if (canopy0Alpha) canopy0Alpha[k] = w0;
            if (canopy1Alpha) canopy1Alpha[k] = w1;
        }

        for (let i = 0; i < 2; i++) {
            this.trunksLod[i].instanceMatrix.needsUpdate = true;
            this.canopiesLod[i].instanceMatrix.needsUpdate = true;
        }

        // Update GPU this frame as instance marked as dirty
        const markAlpha = (mesh) => {
            const attr = mesh?.geometry?.getAttribute('instanceAlpha');
            if (attr) attr.needsUpdate = true;
        };
        markAlpha(this.trunksLod[0]);  markAlpha(this.trunksLod[1]);
        markAlpha(this.canopiesLod[0]); markAlpha(this.canopiesLod[1]);

        for (let k = 0; k < this.bushes.length; k++) {
            const b = this.bushes[k];
            const baseY = b.y + 0.004;
            const s = 0.55 * b.s;
            this._dummy.position.set(b.x, baseY + 0.20 * s, b.z);
            this._dummy.rotation.set(0, b.r, 0);
            this._dummy.scale.set(s, s * 0.85, s);
            this._dummy.updateMatrix();
            this.bushInst.setMatrixAt(k, this._dummy.matrix);
        }
        this.bushInst.instanceMatrix.needsUpdate = true;
    }
}

// Separate class for trees by the river as they are different sizes and placement to the other trees

class RiverTreeLodField {
    constructor(trees = []) {
        this.trees = trees;
        this.group = new THREE.Group();
        this.group.name = "RiverTreeLodField";
        this.treeLodLevels = [];
        this.trunksLod = [];
        this.canopiesLod = [];
        this._lastUpdate = -1;
        this._updateInterval = 0.18;
        this._dummy = new THREE.Object3D();
    }

    dispose() {
        const disposedGeometries = new Set();
        const disposedMaterials = new Set();
        const toDispose = (obj) => {
            if (!obj) return;
            if (obj.geometry && !disposedGeometries.has(obj.geometry)) {
                disposedGeometries.add(obj.geometry);
                obj.geometry.dispose();
            }
            const materialsToDispose = Array.isArray(obj.material) ? obj.material : [obj.material];
            for (let i = 0; i < materialsToDispose.length; i++) {
                const mat = materialsToDispose[i];
                if (mat && !disposedMaterials.has(mat)) {
                    disposedMaterials.add(mat);
                    mat.dispose();
                }
            }
        };
        if (this.trunksLod) this.trunksLod.forEach(toDispose);
        if (this.canopiesLod) this.canopiesLod.forEach(toDispose);
    }

    build(parentGroup) {
        const maxCount = this.trees.length;
        this.treeLodLevels = new Array(maxCount).fill(0);
        if (maxCount <= 0) {
            if (parentGroup) parentGroup.add(this.group);
            return this.group;
        }
        const trunkGeos = [
            new THREE.CylinderGeometry(0.35, 0.55, 5.8, 3, 1),   // Low detail for far
            new THREE.CylinderGeometry(0.35, 0.55, 5.8, 8, 2)    // High detail for near
        ];
        const canopyGeos = [
            new THREE.IcosahedronGeometry(2.35, 0),  // Low detail for far
            new THREE.IcosahedronGeometry(2.35, 2)   // High detail for near
        ];
        const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5a3b28, roughness: 1.0 });
        const canopyMat = new THREE.MeshStandardMaterial({ color: 0x2f6e31, roughness: 1.0 });
        setupTreeInstanceAlphaMaterial(trunkMat);
        setupTreeInstanceAlphaMaterial(canopyMat);

        this.trunksLod = trunkGeos.map((g) => new THREE.InstancedMesh(g, trunkMat, maxCount));
        this.canopiesLod = canopyGeos.map((g) => new THREE.InstancedMesh(g, canopyMat, maxCount));
        for (let i = 0; i < 2; i++) {
            this.trunksLod[i].castShadow = true;
            this.trunksLod[i].receiveShadow = true;
            this.canopiesLod[i].castShadow = true;
            this.canopiesLod[i].receiveShadow = true;
            attachInstanceAlphaAttribute(this.trunksLod[i]);
            attachInstanceAlphaAttribute(this.canopiesLod[i]);
            this.group.add(this.trunksLod[i]);
            this.group.add(this.canopiesLod[i]);
        }
        if (parentGroup) parentGroup.add(this.group);
        this.forceUpdate(camera, clock.getElapsedTime());
        return this.group;
    }

    forceUpdate(cam, t) {
        this._lastUpdate = -1e9;
        this.update(cam, t);
    }

    update(cam, t) {
        if (!cam || !this.trunksLod || this.trunksLod.length === 0) return;
        const dt = (this._lastUpdate < 0) ? 0 : Math.min(t - this._lastUpdate, 0.1);
        this._lastUpdate = t;
        const { nearDist, hysteresis } = getTreeLodSettings();

        const FADE_RATE = 8.0;
        const FADE_STEP = FADE_RATE * dt;
        if (!this.treeLodAlpha || this.treeLodAlpha.length !== this.trees.length) {
            this.treeLodAlpha = new Float32Array(this.trees.length).fill(0);
        }
        if (this.treeLodLevels.length !== this.trees.length) {
            this.treeLodLevels = new Array(this.trees.length).fill(0);
        }

        const treeCount = this.trees.length;
        for (let i = 0; i < 2; i++) {
            this.trunksLod[i].count = treeCount;
            this.canopiesLod[i].count = treeCount;
        }

        const trunk0Alpha  = this.trunksLod[0].geometry.getAttribute('instanceAlpha')?.array;
        const trunk1Alpha  = this.trunksLod[1].geometry.getAttribute('instanceAlpha')?.array;
        const canopy0Alpha = this.canopiesLod[0].geometry.getAttribute('instanceAlpha')?.array;
        const canopy1Alpha = this.canopiesLod[1].geometry.getAttribute('instanceAlpha')?.array;

        for (let i = 0; i < treeCount; i++) {
            const tr = this.trees[i];
            const dx = cam.position.x - tr.x;
            const dz = cam.position.z - tr.z;
            const dist = Math.sqrt(dx * dx + dz * dz);
            const prevLevel = this.treeLodLevels[i] ?? 0;
            const lodLevel = calculateTreeLodLevel(dist, prevLevel, nearDist, hysteresis);
            this.treeLodLevels[i] = lodLevel;

            const target = lodLevel === 1 ? 1.0 : 0.0;
            const prev   = this.treeLodAlpha[i];
            const alpha  = prev + Math.sign(target - prev) *
                           Math.min(FADE_STEP, Math.abs(target - prev));
            this.treeLodAlpha[i] = alpha;
            const w0 = 1.0 - alpha;
            const w1 = alpha;

            // Trunk — same matrix for both LOD tiers, alpha differs.
            this._dummy.position.set(tr.x, tr.y + (5.8 * 0.5 * tr.s), tr.z);
            this._dummy.rotation.set(0, tr.r, 0);
            this._dummy.scale.set(tr.s, tr.s, tr.s);
            this._dummy.updateMatrix();
            this.trunksLod[0].setMatrixAt(i, this._dummy.matrix);
            this.trunksLod[1].setMatrixAt(i, this._dummy.matrix);

            // Canopy — same matrix for both LOD tiers.
            this._dummy.position.set(tr.x, tr.y + (5.8 * tr.s) + (2.0 * tr.s), tr.z);
            this._dummy.scale.set(
                (tr.canopySx ?? 1.2) * tr.s,
                (tr.canopySy ?? 1.12) * tr.s,
                (tr.canopySz ?? 1.2) * tr.s
            );
            this._dummy.updateMatrix();
            this.canopiesLod[0].setMatrixAt(i, this._dummy.matrix);
            this.canopiesLod[1].setMatrixAt(i, this._dummy.matrix);

            if (trunk0Alpha)  trunk0Alpha[i]  = w0;
            if (trunk1Alpha)  trunk1Alpha[i]  = w1;
            if (canopy0Alpha) canopy0Alpha[i] = w0;
            if (canopy1Alpha) canopy1Alpha[i] = w1;
        }

        for (let i = 0; i < 2; i++) {
            this.trunksLod[i].instanceMatrix.needsUpdate = true;
            this.canopiesLod[i].instanceMatrix.needsUpdate = true;
        }
        const markAlpha = (mesh) => {
            const attr = mesh?.geometry?.getAttribute('instanceAlpha');
            if (attr) attr.needsUpdate = true;
        };
        markAlpha(this.trunksLod[0]);  markAlpha(this.trunksLod[1]);
        markAlpha(this.canopiesLod[0]); markAlpha(this.canopiesLod[1]);
    }
}

function disposeRiverTreeLodField() {
    if (!riverTreeLodField) return;
    riverTreeLodField.dispose();
    riverTreeLodField = null;
}

function pseudoRandom(seed) {
    const x = Math.sin(seed * 12.9898 + seed * 78.233) * 43758.5453;
    return x - Math.floor(x);
}

function mulberry32(seed) {
    let a = seed >>> 0;
    return function() {
        a |= 0;
        a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function getMaterialVariant(variants, seed, fallbackMaterial) {
    if (!variants || variants.length === 0) return fallbackMaterial;
    const idx = Math.floor(pseudoRandom(seed) * variants.length) % variants.length;
    return variants[idx];
}

function createPlacementHash(cellSize) {
    const cells = new Map();
    const invCell = 1 / cellSize;
    const makeKey = (gx, gz) => `${gx},${gz}`;
    const toGrid = (x, z) => ({
        gx: Math.floor(x * invCell),
        gz: Math.floor(z * invCell)
    });
    const add = (x, z) => {
        const { gx, gz } = toGrid(x, z);
        const key = makeKey(gx, gz);
        let bucket = cells.get(key);
        if (!bucket) {
            bucket = [];
            cells.set(key, bucket);
        }
        bucket.push({ x, z });
    };
    const canPlace = (x, z, minDistance) => {
        const minDistSq = minDistance * minDistance;
        const { gx, gz } = toGrid(x, z);
        const radius = Math.ceil(minDistance * invCell);
        for (let ix = gx - radius; ix <= gx + radius; ix++) {
            for (let iz = gz - radius; iz <= gz + radius; iz++) {
                const bucket = cells.get(makeKey(ix, iz));
                if (!bucket) continue;
                for (let i = 0; i < bucket.length; i++) {
                    const p = bucket[i];
                    const dx = x - p.x;
                    const dz = z - p.z;
                    if ((dx * dx + dz * dz) < minDistSq) return false;
                }
            }
        }
        return true;
    };
    return { add, canPlace };
}

// Noise functions used for terrain

function noise2D(x, y) {
    const i = Math.floor(x);
    const j = Math.floor(y);
    const fx = x - i;
    const fy = y - j;
    const a = pseudoRandom(i + j * 57);
    const b = pseudoRandom(i + 1 + j * 57);
    const c = pseudoRandom(i + (j + 1) * 57);
    const d = pseudoRandom(i + 1 + (j + 1) * 57);
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);
    return a + sx * (b - a) + sy * (c - a) + sx * sy * (a - b - c + d);
}

function signedNoise2D(x, y) {
    return noise2D(x, y) * 2.0 - 1.0;
}

function fractal_brownian_motion(x, y, octaves = 4, lacunarity = 2.0, gain = 0.5) {
    let amp = 0.5;
    let freq = 1.0;
    let sum = 0.0;
    let norm = 0.0;
    for (let o = 0; o < octaves; o++) {
        sum += amp * signedNoise2D(x * freq, y * freq);
        norm += amp;
        freq *= lacunarity;
        amp *= gain;
    }
    return norm > 0.0 ? (sum / norm) : 0.0;
}

function sampleTerrainNoise(worldX, worldZ) {
    return fractal_brownian_motion(
        worldX * TERRAIN_NOISE_SCALE,
        worldZ * TERRAIN_NOISE_SCALE,
        TERRAIN_NOISE_OCTAVES,
        2.0,
        0.5
    ) * TERRAIN_NOISE_AMPLITUDE;
}

function createEnhancedTerrainSurface(width = 100, length = 100, scale = 5) {
    const baseGeometry = createTerrainSurface(width, length, scale);
    const positions = baseGeometry.attributes.position;
    const posArray = positions.array;
    for (let i = 0; i < posArray.length; i += 3) {
        const x = posArray[i];
        const y = posArray[i + 1];
        const z = posArray[i + 2];
        const noiseValue = sampleTerrainNoise(x, z) * 0.3;
        posArray[i + 1] = y + noiseValue;
    }
    positions.needsUpdate = true;
    baseGeometry.computeVertexNormals();
    return baseGeometry;
}

function getWallEnclosureBounds() {
    const graveyardCenterZ = 32;
    const graveyardDepth = 30;
    const graveyardWidth = 110;
    const graveyardMinZ = graveyardCenterZ - graveyardDepth / 2;
    const graveyardMaxZ = graveyardCenterZ + graveyardDepth / 2;
    // Cathedral depth (local Z) with extra margin to keep wall fully around it.
    const cathedralHalfDepth = 16;
    const cathedralFrontMargin = 2.5;
    const cathedralFrontZ = CATHEDRAL_LAYOUT.z - cathedralHalfDepth - cathedralFrontMargin;
    return {
        minX: -graveyardWidth / 2,
        maxX: graveyardWidth / 2,
        minZ: Math.min(graveyardMinZ, cathedralFrontZ),
        maxZ: graveyardMaxZ
    };
}

function getWallGateLayout() {
    const enclosure = getWallEnclosureBounds();
    const gateWidth = DIVIDER_WALL.gateWidth;
    const cornerGateWidth = THREE.MathUtils.clamp(
        OPPOSITE_ROAD.width,
        4,
        Math.max(4, enclosure.maxX - enclosure.minX - 4)
    );
    const cornerGateHalf = cornerGateWidth * 0.5;
    const frontGateX = THREE.MathUtils.clamp(
        CATHEDRAL_LAYOUT.x,
        enclosure.minX + gateWidth * 0.65,
        enclosure.maxX - gateWidth * 0.65
    );
    const cornerGateX = THREE.MathUtils.clamp(
        OPPOSITE_ROAD.centerX,
        enclosure.minX + cornerGateHalf + 0.8,
        enclosure.maxX - cornerGateHalf - 0.8
    );
    return {
        enclosure,
        gateWidth,
        cornerGateWidth,
        backGateXs: DIVIDER_WALL.gateXs.slice(),
        frontGateX,
        cornerGateX
    };
}

function isInWallEnclosure(worldX, worldZ, margin = 0) {
    const enclosure = getWallEnclosureBounds();
    return (
        worldX >= enclosure.minX - margin &&
        worldX <= enclosure.maxX + margin &&
        worldZ >= enclosure.minZ - margin &&
        worldZ <= enclosure.maxZ + margin
    );
}

function getBuildingsBackEdgeZ(buildingCount = BUILDINGS_ZONE.rowCount) {
    const buildingSpan = buildingCount * (BUILDINGS_ZONE.buildingDepth + BUILDINGS_ZONE.spacing) + 40;
    const buildingEndZ = BUILDINGS_ZONE.startZ - buildingSpan;
    // Match platform back edge (platform extends 5 units beyond buildingEndZ).
    return buildingEndZ - 5;
}

function getExtendedHouseCount(requestedCount) {
    if (requestedCount <= 0) return 0;
    const rowStartZ = getBuildingsBackEdgeZ(requestedCount) + BUILDINGS_ZONE.buildingDepth * 0.5;
    const targetEndCenterZ = GREEN_LAYOUT.centerZ + GREEN_LAYOUT.length * 0.5 - BUILDINGS_ZONE.buildingDepth * 0.5 - 1.0;
    const span = Math.max(0, targetEndCenterZ - rowStartZ);
    const preferredStep = Math.max(1.0, BUILDINGS_ZONE.buildingDepth + BUILDINGS_ZONE.spacing);
    const minimumForCoverage = Math.max(1, Math.ceil(span / preferredStep) + 1);
    return Math.max(requestedCount, minimumForCoverage);
}

function getRearGreenBuildingZoneBounds() {
    // Place village buildings in the rear green/tree zone behind the main building row.
    const sideMargin = 6;
    const depthMargin = 8;
    const buildingExtension = BUILDINGS_ZONE.rowCount * (BUILDINGS_ZONE.buildingDepth + BUILDINGS_ZONE.spacing) + 40;
    const roadRightEdge = OPPOSITE_ROAD.centerX + OPPOSITE_ROAD.width / 2;
    return {
        minX: roadRightEdge + sideMargin,
        maxX: GREEN_LAYOUT.centerX + GREEN_LAYOUT.width / 2 - sideMargin,
        minZ: BUILDINGS_ZONE.startZ - buildingExtension + depthMargin,
        maxZ: BUILDINGS_ZONE.startZ - depthMargin
    };
}

function getOppositeRoadSpan() {
    const roadBackZ = getBuildingsBackEdgeZ();
    const enclosure = getWallEnclosureBounds();
    // Stop the houses-side road at the front face of the enclosure wall.
    const wallStopZ = enclosure.minZ - DIVIDER_WALL.thickness * 0.5;
    return {
        minZ: Math.min(roadBackZ, wallStopZ),
        maxZ: Math.max(roadBackZ, wallStopZ)
    };
}

function rectContains(x, z, cx, cz, w, l) {
    return (Math.abs(x - cx) <= w * 0.5) && (Math.abs(z - cz) <= l * 0.5);
}

// Checks if a point is within Palace Green (rectangular green area with road around it)

function isInGreenRingRoad(x, z, margin = 0) {
    const outerW = GREEN_LAYOUT.width + 2 * GREEN_LAYOUT.roadWidth + 2 * margin;
    const outerL = GREEN_LAYOUT.length + 2 * GREEN_LAYOUT.roadWidth + 2 * margin;
    const innerW = Math.max(0.5, GREEN_LAYOUT.width - 2 * margin);
    const innerL = Math.max(0.5, GREEN_LAYOUT.length - 2 * margin);
    const inOuter = rectContains(x, z, GREEN_LAYOUT.centerX, GREEN_LAYOUT.centerZ, outerW, outerL);
    const inInner = rectContains(x, z, GREEN_LAYOUT.centerX, GREEN_LAYOUT.centerZ, innerW, innerL);
    return inOuter && !inInner;
}

// Checks if point is in the road area on the other side of Palace Green (the one with the houses and river)

function isInOppositeRoadZone(x, z, margin = 0) {
    const roadSpan = getOppositeRoadSpan();
    const minZ = roadSpan.minZ - margin;
    const maxZ = roadSpan.maxZ + margin;
    const halfW = OPPOSITE_ROAD.width * 0.5 + margin;
    const inX = Math.abs(x - OPPOSITE_ROAD.centerX) <= halfW;
    const inZ = z >= minZ && z <= maxZ;
    return inX && inZ;
}

function isInAnyRoadZone(x, z, margin = 0) {
    return isInGreenRingRoad(x, z, margin) || isInOppositeRoadZone(x, z, margin);
}

function samplePlatformHeight(worldX, worldZ) {
    const platformWidth = platformDims.width;
    const platformDepth = platformDims.depth;
    const platformTop = platformDims.height;
    const platformCenterX = platformDims.centerX;
    const platformCenterZ = platformDims.centerZ;
    const inside =
        Math.abs(worldX - platformCenterX) <= platformWidth * 0.5 + 0.0001 &&
        Math.abs(worldZ - platformCenterZ) <= platformDepth * 0.5 + 0.0001;
    if (inside) {
        const inCathedralZone = Math.abs(worldX) < 35 && worldZ > -25 && worldZ < 20;
        const inGraveyardZone = Math.abs(worldX) < 30 && worldZ >= 17 && worldZ < 48;
        const inWallEnclosureZone = isInWallEnclosure(worldX, worldZ, 0.25);
        const inGreenRoadZone = isInGreenRingRoad(worldX, worldZ, 2);
        const inOppositeRoadZone = isInOppositeRoadZone(worldX, worldZ, 2);
        const inDividerWallZone = worldZ > DIVIDER_WALL.z - 3 && worldZ < DIVIDER_WALL.z + 3;
        if (!inCathedralZone && !inGraveyardZone && !inWallEnclosureZone && !inGreenRoadZone && !inOppositeRoadZone && !inDividerWallZone) {
            return platformTop;
        }
        return platformTop;
    }
    return groundLevel;
}

function getStageHeightSafe(x, z) { // Gets current height of the stage (the green area)
    if (!stageRaycastTargets || stageRaycastTargets.length === 0) return groundLevel;
    _stageRayOrigin.set(x, 250, z);
    stageRaycaster.set(_stageRayOrigin, _stageRayDir);
    const hits = stageRaycaster.intersectObjects(stageRaycastTargets, false);
    
    let h = (hits.length > 0) ? hits[0].point.y : groundLevel;
    if (h <= groundLevel + 0.001) {
        const platformWidth = 120;
        const platformDepth = 260;
        const platformCenterX = 0;
        const platformCenterZ = 40;
        if (Math.abs(x - platformCenterX) <= platformWidth * 0.5 + 0.25 &&
            Math.abs(z - platformCenterZ) <= platformDepth * 0.5 + 0.25) {
            h = samplePlatformHeight(x, z);
        }
    }
    return h;
}

function snapWallToStage(wallGroup) { // Adjust wall Y position to be placed on ground
    if (!wallGroup) return;
    wallGroup.updateMatrixWorld(true);
    wallGroup.traverse((obj) => {
        if (!obj || !obj.isMesh) return;
        obj.getWorldPosition(_tmpWallWorldPos);
        if (obj.userData.__wallWorldYOffset === undefined) {
            const h0 = getStageHeightSafe(_tmpWallWorldPos.x, _tmpWallWorldPos.z);
            obj.userData.__wallWorldYOffset = _tmpWallWorldPos.y - h0;
        }
        const baseY = getStageHeightSafe(_tmpWallWorldPos.x, _tmpWallWorldPos.z) + 0.006;
        _tmpWallWorldPos.y = baseY + obj.userData.__wallWorldYOffset;
        if (obj.parent) {
            _tmpWallLocalPos.copy(_tmpWallWorldPos);
            obj.parent.worldToLocal(_tmpWallLocalPos);
            obj.position.copy(_tmpWallLocalPos);
        } else {
            obj.position.y = _tmpWallWorldPos.y;
        }
    });
}

//Evaluates a bicubic Bézier tensor product surface

function createTensorProductVault(span, length, riseHeight, uSegs = 20, vSegs = 40) {
    function bernstein3(i, t) {
        const mt = 1 - t;
        if (i === 0) return mt * mt * mt;
        if (i === 1) return 3 * t * mt * mt;
        if (i === 2) return 3 * t * t * mt;
        return t * t * t;
    }
    const hw = span / 2;
    const x0 = -length * 0.5;
    const x1 = -length * 0.17;
    const x2 = length * 0.17;
    const x3 = length * 0.5;
    const controlGrid = [
        [
            new THREE.Vector3(x0, 0, -hw),
            new THREE.Vector3(x1, 0, -hw),
            new THREE.Vector3(x2, 0, -hw),
            new THREE.Vector3(x3, 0, -hw)
        ],
        [
            new THREE.Vector3(x0, riseHeight * 0.55, -hw * 0.9),
            new THREE.Vector3(x1, riseHeight * 0.55, -hw * 0.9),
            new THREE.Vector3(x2, riseHeight * 0.55, -hw * 0.9),
            new THREE.Vector3(x3, riseHeight * 0.55, -hw * 0.9)
        ],
        [
            new THREE.Vector3(x0, riseHeight * 0.55, hw * 0.9),
            new THREE.Vector3(x1, riseHeight * 0.55, hw * 0.9),
            new THREE.Vector3(x2, riseHeight * 0.55, hw * 0.9),
            new THREE.Vector3(x3, riseHeight * 0.55, hw * 0.9)
        ],
        [
            new THREE.Vector3(x0, 0, hw),
            new THREE.Vector3(x1, 0, hw),
            new THREE.Vector3(x2, 0, hw),
            new THREE.Vector3(x3, 0, hw)
        ]
    ];
    function evalSurface(u, v, target) {
        target.set(0, 0, 0);
        for (let i = 0; i < 4; i++) {
            const bu = bernstein3(i, u);
            for (let j = 0; j < 4; j++) {
                const bv = bernstein3(j, v);
                target.addScaledVector(controlGrid[i][j], bu * bv);
            }
        }
    }
    const positions = [];
    const normals = [];
    const uvs = [];
    const indices = [];
    const _p = new THREE.Vector3();
    const _du = new THREE.Vector3();
    const _dv = new THREE.Vector3();
    const _n = new THREE.Vector3();
    const eps = 0.001;
    for (let iv = 0; iv <= vSegs; iv++) {
        const v = iv / vSegs;
        for (let iu = 0; iu <= uSegs; iu++) {
            const u = iu / uSegs;
            evalSurface(u, v, _p);
            evalSurface(Math.min(u + eps, 1), v, _du);
            _du.sub(_p);
            evalSurface(u, Math.min(v + eps, 1), _dv);
            _dv.sub(_p);
            _n.crossVectors(_du, _dv).normalize();
            positions.push(_p.x, _p.y, _p.z);
            normals.push(_n.x, _n.y, _n.z);
            uvs.push(u, v);
        }
    }
    for (let iv = 0; iv < vSegs; iv++) {
        for (let iu = 0; iu < uSegs; iu++) {
            const a = iv * (uSegs + 1) + iu;
            const b = a + 1;
            const c = a + (uSegs + 1);
            const d = c + 1;
            indices.push(a, c, b, b, c, d);
        }
    }
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geom.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geom.setIndex(indices);
    return geom;
}

//Parametric nave wall panel.

function createParametricNaveWall(length, height, uSegs = 30, vSegs = 12) {
    function bernstein3(i, t) {
        const mt = 1 - t;
        if (i === 0) return mt * mt * mt;
        if (i === 1) return 3 * t * mt * mt;
        if (i === 2) return 3 * t * t * mt;
        return t * t * t;
    }
    const L = length;
    const H = height;
    const x0 = -L * 0.5;
    const x1 = -L * 0.17;
    const x2 = L * 0.17;
    const x3 = L * 0.5;
    const controlGrid = [
        [
            new THREE.Vector3(x0, 0, 0),
            new THREE.Vector3(x1, 0, 0),
            new THREE.Vector3(x2, 0, 0),
            new THREE.Vector3(x3, 0, 0)
        ],
        [
            new THREE.Vector3(x0, H * 0.33, 0),
            new THREE.Vector3(x1, H * 0.33, 0.18),
            new THREE.Vector3(x2, H * 0.33, 0.18),
            new THREE.Vector3(x3, H * 0.33, 0)
        ],
        [
            new THREE.Vector3(x0, H * 0.67, 0),
            new THREE.Vector3(x1, H * 0.67, 0.12),
            new THREE.Vector3(x2, H * 0.67, 0.12),
            new THREE.Vector3(x3, H * 0.67, 0)
        ],
        [
            new THREE.Vector3(x0, H, 0),
            new THREE.Vector3(x1, H, 0),
            new THREE.Vector3(x2, H, 0),
            new THREE.Vector3(x3, H, 0)
        ]
    ];
    function evalSurface(u, v, target) {
        target.set(0, 0, 0);
        for (let i = 0; i < 4; i++) {
            const bv = bernstein3(i, v);
            for (let j = 0; j < 4; j++) {
                const bu = bernstein3(j, u);
                target.addScaledVector(controlGrid[i][j], bu * bv);
            }
        }
    }
    const positions = [];
    const normals = [];
    const uvArr = [];
    const indices = [];
    const _p = new THREE.Vector3();
    const _du = new THREE.Vector3();
    const _dv = new THREE.Vector3();
    const _n = new THREE.Vector3();
    const eps = 0.001;
    for (let iv = 0; iv <= vSegs; iv++) {
        const v = iv / vSegs;
        for (let iu = 0; iu <= uSegs; iu++) {
            const u = iu / uSegs;
            evalSurface(u, v, _p);
            evalSurface(Math.min(u + eps, 1), v, _du);
            _du.sub(_p);
            evalSurface(u, Math.min(v + eps, 1), _dv);
            _dv.sub(_p);
            _n.crossVectors(_du, _dv).normalize();
            positions.push(_p.x, _p.y, _p.z);
            normals.push(_n.x, _n.y, _n.z);
            uvArr.push(u, v);
        }
    }
    for (let iv = 0; iv < vSegs; iv++) {
        for (let iu = 0; iu < uSegs; iu++) {
            const a = iv * (uSegs + 1) + iu;
            const b = a + 1;
            const c = a + (uSegs + 1);
            const d = c + 1;
            indices.push(a, c, b, b, c, d);
        }
    }
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geom.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvArr, 2));
    geom.setIndex(indices);
    return geom;
}

// Procedurally generates a cathedral model with a nave, aisles, transept, and chancel, using box geometries and parametric surfaces.

function createCathedralProcedural(towerHeight) {
    const safeTowerHeight = Math.max(
        TOWER_HEIGHT_MIN,
        Number.isFinite(towerHeight) ? towerHeight : TOWER_HEIGHT_MIN
    );
    const cathedral = new THREE.Group();
    const naveLength = 50;
    const naveWidth = 16;
    const naveHeight = 18;
    const naveGeom = new THREE.BoxGeometry(naveLength, naveHeight, naveWidth);
    const nave = new THREE.Mesh(naveGeom, materials.cathedralStone);
    nave.position.set(0, naveHeight / 2, 0);
    nave.castShadow = true;
    nave.receiveShadow = true;
    cathedral.add(nave);
    // Skin long faces of naive with a parametric wall surface.
    // Control points introduce Bézier-derived relief 
    [-1, 1].forEach(side => {
        const wallGeom = createParametricNaveWall(naveLength, naveHeight);
        const wallMesh = new THREE.Mesh(wallGeom, materials.cathedralStone);
        wallMesh.position.set(0, 0, side * (naveWidth / 2 + 0.02));
        if (side < 0) wallMesh.rotation.y = Math.PI; // outward-facing normals on both sides
        wallMesh.castShadow = true;
        wallMesh.receiveShadow = true;
        cathedral.add(wallMesh);
    });
    const roofHeight = 6;
    const roofGeom = createPitchedRoofGeometry(naveLength + 2, roofHeight, naveWidth + 2);
    const naveRoof = new THREE.Mesh(roofGeom, materials.cathedralDark);
    naveRoof.position.set(0, naveHeight - 0.1, 0);
    naveRoof.castShadow = true;
    cathedral.add(naveRoof);
    const aisleWidth = 6;
    const aisleHeight = 10;
    [-1, 1].forEach(side => {
        const aisleGeom = new THREE.BoxGeometry(naveLength - 10, aisleHeight, aisleWidth);
        const aisle = new THREE.Mesh(aisleGeom, materials.cathedralStone);
        aisle.position.set(0, aisleHeight / 2, side * (naveWidth / 2 + aisleWidth / 2));
        aisle.castShadow = true;
        aisle.receiveShadow = true;
        cathedral.add(aisle);
        const aisleRoofGeom = createPitchedRoofGeometry(naveLength - 8, 3, aisleWidth + 1);
        const aisleRoof = new THREE.Mesh(aisleRoofGeom, materials.cathedralDark);
        aisleRoof.position.set(0, aisleHeight - 0.1, side * (naveWidth / 2 + aisleWidth / 2));
        aisleRoof.castShadow = true;
        cathedral.add(aisleRoof);
    });
    const transeptLength = 35;
    const transeptWidth = 12;
    const transeptHeight = 16;
    const transeptGeom = new THREE.BoxGeometry(transeptWidth, transeptHeight, transeptLength);
    const transept = new THREE.Mesh(transeptGeom, materials.cathedralStone);
    transept.position.set(8, transeptHeight / 2, 0);
    transept.castShadow = true;
    transept.receiveShadow = true;
    cathedral.add(transept);
    const transeptRoofGeom = createPitchedRoofGeometry(transeptWidth + 2, 5, transeptLength + 2);
    const transeptRoof = new THREE.Mesh(transeptRoofGeom, materials.cathedralDark);
    transeptRoof.position.set(8, transeptHeight - 0.1, 0);
    transeptRoof.castShadow = true;
    cathedral.add(transeptRoof);
    const chancelLength = 15;
    const chancelHeight = 15;
    const chancelGeom = new THREE.BoxGeometry(chancelLength, chancelHeight, naveWidth - 2);
    const chancel = new THREE.Mesh(chancelGeom, materials.cathedralStone);
    chancel.position.set(naveLength / 2 + chancelLength / 2 - 2, chancelHeight / 2, 0);
    chancel.castShadow = true;
    chancel.receiveShadow = true;
    cathedral.add(chancel);
    const chancelRoofHeight = 4;
    const chancelRoofGeom = createPitchedRoofGeometry(chancelLength + 2, chancelRoofHeight, naveWidth);
    const chancelRoof = new THREE.Mesh(chancelRoofGeom, materials.cathedralDark);
    chancelRoof.position.set(naveLength / 2 + chancelLength / 2 - 2, chancelHeight - 0.1, 0);
    chancelRoof.castShadow = true;
    cathedral.add(chancelRoof);
    // Nave vault ceiling: bicubic Bézier tensor product surface.
    // S(u,v) = Σᵢ Σⱼ B_{i,3}(u)·B_{j,3}(v)·P_{i,j}  — Lecture 3b, Slide 17
    // u sweeps the arch profile, v sweeps the nave length.
    const naveVaultGeom = createTensorProductVault(naveWidth, naveLength, naveHeight * 0.7, 20, 40);
    const naveVault = new THREE.Mesh(naveVaultGeom, materials.cathedralDark);
    naveVault.position.set(0, 0.1, 0);
    naveVault.castShadow = false;
    naveVault.receiveShadow = false;
    cathedral.add(naveVault);
    const aisleVaultGeom = createTensorProductVault(aisleWidth, naveLength - 10, aisleHeight * 0.7, 16, 32);
    [-1, 1].forEach(side => {
        const aisleVault = new THREE.Mesh(aisleVaultGeom, materials.cathedralDark);
        aisleVault.position.set(0, 0.05, side * (naveWidth / 2 + aisleWidth / 2));
        cathedral.add(aisleVault);
    });
    const towerGeom = createProceduralTower(safeTowerHeight, 8, 6);
    const tower = new THREE.Mesh(towerGeom, materials.cathedralStone);
    tower.position.set(8, 0, 0);
    const towerBounds = towerGeom.boundingBox;
    const towerTopY = tower.position.y + (
        towerBounds && Number.isFinite(towerBounds.max.y) ? towerBounds.max.y : safeTowerHeight
    );
    tower.castShadow = true;
    cathedral.add(tower);
    if (config.debugBSplineCages) {
        const towerCage = createProceduralTowerControlCage(safeTowerHeight, 8, 6, { pointRadius: 0.16 });
        towerCage.position.copy(tower.position);
        cathedral.add(towerCage);
    }
    const domeGeom = createProceduralDome(12, 10);
    const dome = new THREE.Mesh(domeGeom, materials.cathedralDark);
    dome.position.set(8, naveHeight * 0.8, 0);
    dome.scale.z = 0.6;
    dome.castShadow = true;
    cathedral.add(dome);
    createBasicSpire(cathedral, 8, towerTopY, 10);
    for (let h = 5; h < safeTowerHeight; h += 6) {
        const bandGeom = new THREE.BoxGeometry(10 + 0.5, 0.5, 10 + 0.5);
        const band = new THREE.Mesh(bandGeom, materials.cathedralDark);
        band.position.set(8, h, 0);
        cathedral.add(band);
    }
    const westTowerHeight = safeTowerHeight * 0.7;
    const westTowerWidth = 6;
    const westTowerCapHeight = 5;
    const westTowerCapOverlap = 0.03;
    const westTowerCenterOffset = naveWidth / 2 + 1;
    const westTowerRadius = westTowerWidth * 0.5;
    [-1, 1].forEach(side => {
        const wtGeom = createProceduralTower(westTowerHeight, westTowerWidth * 0.5, westTowerWidth * 0.5);
        const wt = new THREE.Mesh(wtGeom, materials.cathedralStone);
        wt.position.set(-naveLength / 2 - 1, 0, side * westTowerCenterOffset);
        wt.castShadow = true;
        cathedral.add(wt);
        if (config.debugBSplineCages) {
            const wtCage = createProceduralTowerControlCage(
                westTowerHeight,
                westTowerWidth * 0.5,
                westTowerWidth * 0.5,
                { pointRadius: 0.12 }
            );
            wtCage.position.copy(wt.position);
            cathedral.add(wtCage);
        }
        const wtBounds = wtGeom.boundingBox;
        const wtTopY = wt.position.y + (
            wtBounds && Number.isFinite(wtBounds.max.y) ? wtBounds.max.y : westTowerHeight
        );
        const capGeom = new THREE.ConeGeometry(westTowerWidth * 0.7, westTowerCapHeight, 4);
        const cap = new THREE.Mesh(capGeom, materials.cathedralDark);
        cap.position.set(
            -naveLength / 2 - 1,
            wtTopY + westTowerCapHeight * 0.5 - westTowerCapOverlap,
            side * westTowerCenterOffset
        );
        cap.rotation.y = Math.PI / 4;
        cap.castShadow = true;
        cathedral.add(cap);
    });
    // Span exactly between the inner faces of the two west towers.
    const portalWidth = Math.max(1, (westTowerCenterOffset - westTowerRadius) * 2);
    const portalDepth = 2.5;
    const archPeakFactor = 0.6875; // Peak y of this quartic arch profile when height = 1
    const portalRoofClearance = 0.25;
    const createRoofHeightPortal = ({
        x,
        z = 0,
        targetPeakY,
        rotationY = 0,
        width = portalWidth,
        depth = portalDepth
    }) => {
        const portalHeight = Math.max(1, targetPeakY / archPeakFactor);
        const portalGeom = createCathedralArch(width, portalHeight, depth);
        const portal = new THREE.Mesh(portalGeom, CATHEDRAL_PORTAL_MAT);
        portal.rotation.y = rotationY;
        portal.position.set(x, 0, z);
        portal.castShadow = true;
        portal.receiveShadow = true;
        if (config.debugParametricCages) {
            const cage = createCathedralArchControlCage(width, portalHeight, depth);
            portal.add(cage);
        }
        cathedral.add(portal);
    };

    // Front portal stops just below the base of the roof section.
    const naveRoofBaseY = (naveHeight - 0.1) - portalRoofClearance;
    createRoofHeightPortal({
        x: -naveLength / 2 - 0.6,
        targetPeakY: naveRoofBaseY,
        rotationY: Math.PI / 2
    });

    // Rear portal stops just below the base of the roof section.
    const chancelRoofBaseY = (chancelHeight - 0.1) - portalRoofClearance;
    createRoofHeightPortal({
        x: naveLength / 2 + chancelLength - 2 + 0.6,
        targetPeakY: chancelRoofBaseY,
        rotationY: -Math.PI / 2
    });

    // Side wall arches on both aisle exteriors, capped below aisle roof base.
    const sideRoofBaseY = (aisleHeight - 0.1) - portalRoofClearance;
    const sideArchWidth = Math.max(1.5, aisleWidth - 0.8);
    const sideArchDepth = 1.6;
    const sideArchEmbed = 0.15;
    const aisleOuterZ = naveWidth * 0.5 + aisleWidth;
    const sideArchZ = aisleOuterZ + sideArchDepth * 0.5 - sideArchEmbed;
    const sideArchXs = [-16, -7, 16];
    [-1, 1].forEach(side => {
        const rotationY = side > 0 ? 0 : Math.PI;
        sideArchXs.forEach(x => {
            createRoofHeightPortal({
                x,
                z: side * sideArchZ,
                targetPeakY: sideRoofBaseY,
                rotationY,
                width: sideArchWidth,
                depth: sideArchDepth
            });
        });
    });
    return cathedral;
}

// Procedurally generates a ground plane with some height variation, using a parametric surface.

function createGroundProcedural() {
    const group = new THREE.Group();
    const platformWidth = 100;
    const platformDepth = 100;
    const terrainGeometry = getOrCreateParametricGeometry('terrain-main', () =>
        createEnhancedTerrainSurface(platformWidth, platformDepth, 4)
    );
    const terrain = new THREE.Mesh(terrainGeometry, materials.grassParametric);
    terrain.position.set(0, 0, 0);
    terrain.castShadow = true;
    terrain.receiveShadow = true;
    group.add(terrain);
    group.userData.surfaceMesh = terrain;
    return group;
}

function evaluateCatmullRomPoint(p0, p1, p2, p3, t, target) {
    const t2 = t * t;
    const t3 = t2 * t;
    const a0 = -0.5 * t3 + t2 - 0.5 * t;
    const a1 = 1.5 * t3 - 2.5 * t2 + 1.0;
    const a2 = -1.5 * t3 + 2.0 * t2 + 0.5 * t;
    const a3 = 0.5 * t3 - 0.5 * t2;
    return target.set(
        a0 * p0.x + a1 * p1.x + a2 * p2.x + a3 * p3.x,
        a0 * p0.y + a1 * p1.y + a2 * p2.y + a3 * p3.y,
        a0 * p0.z + a1 * p1.z + a2 * p2.z + a3 * p3.z
    );
}

function sampleCatmullRomPathPoints(waypoints, samplesPerSegment = 32) {
    if (!Array.isArray(waypoints) || waypoints.length < 4) return [];
    const samples = Math.max(1, Math.floor(samplesPerSegment));
    const points = [];
    const p = new THREE.Vector3();
    for (let segmentIdx = 1; segmentIdx < waypoints.length - 2; segmentIdx++) {
        const p0 = waypoints[segmentIdx - 1];
        const p1 = waypoints[segmentIdx];
        const p2 = waypoints[segmentIdx + 1];
        const p3 = waypoints[segmentIdx + 2];
        const startSample = (segmentIdx === 1) ? 0 : 1;
        for (let s = startSample; s <= samples; s++) {
            const t = s / samples;
            evaluateCatmullRomPoint(p0, p1, p2, p3, t, p);
            points.push(p.clone());
        }
    }
    return points;
}

function createGardenPathCatmullDebugOverlay(
    waypoints,
    {
        curveMaterial = GARDEN_PATH_DEBUG_MAIN_CURVE_MAT,
        controlMaterial = GARDEN_PATH_DEBUG_MAIN_CONTROL_MAT,
        pointMaterial = GARDEN_PATH_DEBUG_POINT_MAT,
        yOffset = 0.05,
        samplesPerSegment = 28
    } = {}
) {
    const overlay = new THREE.Group();
    if (!Array.isArray(waypoints) || waypoints.length === 0) return overlay;

    if (waypoints.length >= 2) {
        const controlGeom = new THREE.BufferGeometry().setFromPoints(waypoints);
        const controlLine = new THREE.Line(controlGeom, controlMaterial);
        controlLine.renderOrder = 120;
        overlay.add(controlLine);
    }

    const splinePoints = sampleCatmullRomPathPoints(waypoints, samplesPerSegment);
    if (splinePoints.length >= 2) {
        const splineGeom = new THREE.BufferGeometry().setFromPoints(splinePoints);
        const splineLine = new THREE.Line(splineGeom, curveMaterial);
        splineLine.renderOrder = 121;
        overlay.add(splineLine);
    }

    for (let i = 0; i < waypoints.length; i++) {
        const marker = new THREE.Mesh(GARDEN_PATH_DEBUG_POINT_GEOM, pointMaterial);
        marker.position.copy(waypoints[i]);
        marker.renderOrder = 122;
        overlay.add(marker);
    }

    overlay.position.y = yOffset;
    overlay.name = 'GardenPathCatmullDebugOverlay';
    return overlay;
}

// Finds free space within a set of blocked intervals, used for the garden path generation between the buildings

function computeFreeIntervals(minValue, maxValue, blockedIntervals) {
    if (!Number.isFinite(minValue) || !Number.isFinite(maxValue) || maxValue <= minValue) return [];
    if (!Array.isArray(blockedIntervals) || blockedIntervals.length === 0) {
        return [[minValue, maxValue]];
    }

    const clamped = [];
    for (let i = 0; i < blockedIntervals.length; i++) {
        const interval = blockedIntervals[i];
        if (!interval || interval.length < 2) continue;
        let a = interval[0];
        let b = interval[1];
        if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
        if (a > b) {
            const tmp = a;
            a = b;
            b = tmp;
        }
        if (b <= minValue || a >= maxValue) continue;
        clamped.push([Math.max(minValue, a), Math.min(maxValue, b)]);
    }
    if (clamped.length === 0) return [[minValue, maxValue]];

    clamped.sort((left, right) => left[0] - right[0]);
    const merged = [clamped[0].slice()];
    for (let i = 1; i < clamped.length; i++) {
        const current = clamped[i];
        const last = merged[merged.length - 1];
        if (current[0] <= last[1] + 0.0001) {
            last[1] = Math.max(last[1], current[1]);
        } else {
            merged.push(current.slice());
        }
    }

    const freeIntervals = [];
    let cursor = minValue;
    for (let i = 0; i < merged.length; i++) {
        const blocked = merged[i];
        if (blocked[0] > cursor + 0.0001) freeIntervals.push([cursor, blocked[0]]);
        cursor = Math.max(cursor, blocked[1]);
    }
    if (cursor < maxValue - 0.0001) freeIntervals.push([cursor, maxValue]);
    return freeIntervals;
}

// Picks a value within free intervals

function pickFreeIntervalCenter(freeIntervals, preferredValue) {
    if (!Array.isArray(freeIntervals) || freeIntervals.length === 0) return null;

    if (!Number.isFinite(preferredValue)) {
        let widest = freeIntervals[0];
        let widestSize = widest[1] - widest[0];
        for (let i = 1; i < freeIntervals.length; i++) {
            const candidate = freeIntervals[i];
            const candidateSize = candidate[1] - candidate[0];
            if (candidateSize > widestSize) {
                widest = candidate;
                widestSize = candidateSize;
            }
        }
        return (widest[0] + widest[1]) * 0.5;
    }

    let bestValue = THREE.MathUtils.clamp(preferredValue, freeIntervals[0][0], freeIntervals[0][1]);
    let bestDistance = Math.abs(bestValue - preferredValue);
    for (let i = 1; i < freeIntervals.length; i++) {
        const interval = freeIntervals[i];
        const clamped = THREE.MathUtils.clamp(preferredValue, interval[0], interval[1]);
        const distance = Math.abs(clamped - preferredValue);
        if (distance < bestDistance) {
            bestDistance = distance;
            bestValue = clamped;
        }
    }
    return bestValue;
}

// Builds waypoints for garden path (z axis)

function buildGreenPathWaypointsAlongZ(zone, footprints, options = {}) {
    const samples = Math.max(4, Math.floor(options.samples || 18));
    const edgeMargin = Math.max(1, Number(options.edgeMargin) || 0);
    const clearance = Math.max(0, Number(options.clearance) || 0);
    const pathY = Number.isFinite(options.pathY) ? options.pathY : 0.14;

    const minX = zone.minX + edgeMargin;
    const maxX = zone.maxX - edgeMargin;
    const minZ = zone.minZ + edgeMargin;
    const maxZ = zone.maxZ - edgeMargin;
    if (maxX <= minX || maxZ <= minZ) return [];

    const waypoints = [];
    let prevX = Number.NaN;
    const preferredStartX = GREEN_LAYOUT.centerX;

    for (let i = 0; i < samples; i++) {
        const t = (samples === 1) ? 0 : i / (samples - 1);
        const z = THREE.MathUtils.lerp(maxZ, minZ, t);
        const blockedX = [];
        for (let j = 0; j < footprints.length; j++) {
            const fp = footprints[j];
            const halfDepth = (fp.hd || 0) + clearance;
            if (Math.abs(z - fp.cz) > halfDepth) continue;
            const halfWidth = (fp.hw || 0) + clearance;
            blockedX.push([fp.cx - halfWidth, fp.cx + halfWidth]);
        }
        const freeX = computeFreeIntervals(minX, maxX, blockedX);
        const preferredX = Number.isFinite(prevX) ? prevX : preferredStartX;
        const resolvedX = pickFreeIntervalCenter(freeX, preferredX);
        prevX = Number.isFinite(resolvedX)
            ? resolvedX
            : THREE.MathUtils.clamp(preferredX, minX, maxX);
        waypoints.push(new THREE.Vector3(prevX, pathY, z));
    }
    return waypoints;
}

// Builds waypoints for garden path (x axis)

function buildGreenPathWaypointsAlongX(zone, footprints, anchorZ, options = {}) {
    const samples = Math.max(4, Math.floor(options.samples || 14));
    const edgeMargin = Math.max(1, Number(options.edgeMargin) || 0);
    const clearance = Math.max(0, Number(options.clearance) || 0);
    const pathY = Number.isFinite(options.pathY) ? options.pathY : 0.14;

    const minX = zone.minX + edgeMargin;
    const maxX = zone.maxX - edgeMargin;
    const minZ = zone.minZ + edgeMargin;
    const maxZ = zone.maxZ - edgeMargin;
    if (maxX <= minX || maxZ <= minZ) return [];

    const waypoints = [];
    const defaultZ = (minZ + maxZ) * 0.5;
    let prevZ = Number.isFinite(anchorZ) ? anchorZ : defaultZ;
    prevZ = THREE.MathUtils.clamp(prevZ, minZ, maxZ);

    for (let i = 0; i < samples; i++) {
        const t = (samples === 1) ? 0 : i / (samples - 1);
        const x = THREE.MathUtils.lerp(minX, maxX, t);
        const blockedZ = [];
        for (let j = 0; j < footprints.length; j++) {
            const fp = footprints[j];
            const halfWidth = (fp.hw || 0) + clearance;
            if (Math.abs(x - fp.cx) > halfWidth) continue;
            const halfDepth = (fp.hd || 0) + clearance;
            blockedZ.push([fp.cz - halfDepth, fp.cz + halfDepth]);
        }
        const freeZ = computeFreeIntervals(minZ, maxZ, blockedZ);
        const resolvedZ = pickFreeIntervalCenter(freeZ, prevZ);
        prevZ = Number.isFinite(resolvedZ)
            ? resolvedZ
            : THREE.MathUtils.clamp(prevZ, minZ, maxZ);
        waypoints.push(new THREE.Vector3(x, pathY, prevZ));
    }
    return waypoints;
}

// Uses Catmull-Rom splines to create smooth garden path based off waypoints above

function createGardenPathsProcedural() {
    const group = new THREE.Group();
    const zone = getRearGreenBuildingZoneBounds();
    if (zone.minX >= zone.maxX || zone.minZ >= zone.maxZ) return group;

    const footprints = Array.isArray(greenBuildingFootprints) ? greenBuildingFootprints : [];
    const edgeMargin = Math.min(8, Math.max(3, GREEN_LAYOUT.roadWidth * 0.45));
    const clearance = 1.3;
    const pathLift = 0.03;

    const mainPathWaypoints = buildGreenPathWaypointsAlongZ(zone, footprints, {
        samples: 18,
        edgeMargin: edgeMargin,
        clearance: clearance,
        pathY: 0.14
    });
    if (mainPathWaypoints.length >= 4) {
        const mainPathGeom = createGardenPath(mainPathWaypoints, 2.5, 90);
        const mainPath = new THREE.Mesh(mainPathGeom, materials.path);
        mainPath.position.y = pathLift;
        mainPath.castShadow = true;
        mainPath.receiveShadow = true;
        group.add(mainPath);
        if (config.debugGardenPathCatmull) {
            const mainDebug = createGardenPathCatmullDebugOverlay(mainPathWaypoints, {
                curveMaterial: GARDEN_PATH_DEBUG_MAIN_CURVE_MAT,
                controlMaterial: GARDEN_PATH_DEBUG_MAIN_CONTROL_MAT,
                yOffset: pathLift + 0.045,
                samplesPerSegment: 36
            });
            group.add(mainDebug);
        }
    }

    const anchorIndex = Math.floor(mainPathWaypoints.length * 0.55);
    const anchorZ = (mainPathWaypoints[anchorIndex] && Number.isFinite(mainPathWaypoints[anchorIndex].z))
        ? mainPathWaypoints[anchorIndex].z
        : (zone.minZ + zone.maxZ) * 0.5;
    const crossPathWaypoints = buildGreenPathWaypointsAlongX(zone, footprints, anchorZ, {
        samples: 14,
        edgeMargin: edgeMargin + 0.5,
        clearance: clearance,
        pathY: 0.14
    });
    if (crossPathWaypoints.length >= 4) {
        const crossPathGeom = createGardenPath(crossPathWaypoints, 2.0, 72);
        const crossPath = new THREE.Mesh(crossPathGeom, materials.path);
        crossPath.position.y = pathLift;
        crossPath.castShadow = true;
        crossPath.receiveShadow = true;
        group.add(crossPath);
        if (config.debugGardenPathCatmull) {
            const crossDebug = createGardenPathCatmullDebugOverlay(crossPathWaypoints, {
                curveMaterial: GARDEN_PATH_DEBUG_CROSS_CURVE_MAT,
                controlMaterial: GARDEN_PATH_DEBUG_CROSS_CONTROL_MAT,
                yOffset: pathLift + 0.045,
                samplesPerSegment: 36
            });
            group.add(crossDebug);
        }
    }

    return group;
}

// Roof generation for rear houses, allowing for the curvature and height to be adjusted

function createPitchedRoofGeometry(length, height, width) {
    const shape = new THREE.Shape();
    shape.moveTo(-width / 2, 0);
    shape.lineTo(0, height);
    shape.lineTo(width / 2, 0);
    shape.lineTo(-width / 2, 0);
    const extrudeSettings = {
        steps: 1,
        depth: length,
        bevelEnabled: false
    };
    const geom = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    geom.rotateY(Math.PI / 2);
    geom.translate(-length / 2, 0, 0);
    return geom;
}

function createBasicSpire(parent, x, baseHeight, width) {
    const steppedLayerHeight = 1.1;
    const steppedLayers = 3;
    const taperRatio = 0.72;
    let layerWidth = width + 0.6;
    let currentY = baseHeight;

    // Build a compact stepped base with slight overlap to avoid visual cracks.
    for (let i = 0; i < steppedLayers; i++) {
        const layer = new THREE.Mesh(
            new THREE.BoxGeometry(layerWidth, steppedLayerHeight, layerWidth),
            materials.cathedralDark
        );
        layer.position.set(x, currentY + steppedLayerHeight * 0.5 - 0.03, 0);
        layer.castShadow = true;
        layer.receiveShadow = true;
        parent.add(layer);
        currentY += steppedLayerHeight;
        layerWidth *= taperRatio;
    }

    const spireHeight = Math.max(6, baseHeight * 0.45);
    const spire = new THREE.Mesh(
        new THREE.ConeGeometry(Math.max(0.7, layerWidth * 0.55), spireHeight, 4),
        materials.cathedralDark
    );
    spire.position.set(x, currentY + spireHeight * 0.5 - 0.03, 0);
    spire.rotation.y = Math.PI / 4;
    spire.castShadow = true;
    spire.receiveShadow = true;
    parent.add(spire);
}

// Creates Palace Green and surrounding road

function createGreenAndRoad() {
    const group = new THREE.Group();
    const greenW = GREEN_LAYOUT.width;
    const greenL = GREEN_LAYOUT.length;
    const centerX = GREEN_LAYOUT.centerX;
    const centerZ = GREEN_LAYOUT.centerZ;
    const roadW = GREEN_LAYOUT.roadWidth;
    const greenGeom = new THREE.PlaneGeometry(greenW, greenL, 48, 48);
    const positions = greenGeom.attributes.position;
    for (let i = 0; i < positions.count; i++) {
        positions.setZ(i, 0);
    }
    greenGeom.computeVertexNormals();
    const green = new THREE.Mesh(greenGeom, materials.grass);
    green.rotation.x = -Math.PI / 2;
    green.position.set(centerX, 0.1, centerZ);
    green.receiveShadow = true;
    group.add(green);
    const outerW = greenW + 2 * roadW;
    const outerL = greenL + 2 * roadW;
    const roadShape = new THREE.Shape();
    roadShape.moveTo(-outerW / 2, -outerL / 2);
    roadShape.lineTo( outerW / 2, -outerL / 2);
    roadShape.lineTo( outerW / 2,  outerL / 2);
    roadShape.lineTo(-outerW / 2,  outerL / 2);
    roadShape.lineTo(-outerW / 2, -outerL / 2);
    const innerHole = new THREE.Path();
    innerHole.moveTo(-greenW / 2, -greenL / 2);
    innerHole.lineTo( greenW / 2, -greenL / 2);
    innerHole.lineTo( greenW / 2,  greenL / 2);
    innerHole.lineTo(-greenW / 2,  greenL / 2);
    innerHole.lineTo(-greenW / 2, -greenL / 2);
    roadShape.holes.push(innerHole);
    const roadGeom = new THREE.ShapeGeometry(roadShape, 24);
    const road = new THREE.Mesh(roadGeom, materials.road);
    road.rotation.x = -Math.PI / 2;
    // Keep road visible above green/dirt and flush against wall edge at near side.
    road.position.set(centerX, 0.35, centerZ);
    road.receiveShadow = false;
    road.renderOrder = 10;
    group.add(road);
    return group;
}

function createEnclosureGround() {
    const enclosure = getWallEnclosureBounds();
    const width = enclosure.maxX - enclosure.minX;
    const depth = enclosure.maxZ - enclosure.minZ;
    const centerX = (enclosure.minX + enclosure.maxX) * 0.5;
    const centerZ = (enclosure.minZ + enclosure.maxZ) * 0.5;
    const groundGeom = new THREE.PlaneGeometry(width, depth, 8, 8);
    const groundMat = materials.ground.clone();
    // Pull dirt slightly toward the camera in depth to avoid green z-fighting artifacts.
    groundMat.polygonOffset = true;
    groundMat.polygonOffsetFactor = -2.0;
    groundMat.polygonOffsetUnits = -2.0;
    const ground = new THREE.Mesh(groundGeom, groundMat);
    ground.rotation.x = -Math.PI / 2;
    // Match the green plane elevation to avoid clipping graves/agents.
    ground.position.set(centerX, 0.1, centerZ);
    ground.receiveShadow = true;
    ground.renderOrder = 12;
    return ground;
}

function createWall() { // Graveyard wall
    const wallGroup = new THREE.Group();
    const wallHeight = DIVIDER_WALL.height;
    const wallThickness = DIVIDER_WALL.thickness;
    const gateLayout = getWallGateLayout();
    const gateWidth = gateLayout.gateWidth;
    const gateHalf = gateWidth * 0.5;
    const cornerGateWidth = gateLayout.cornerGateWidth;
    const cornerGateHalf = cornerGateWidth * 0.5;
    const gateXs = gateLayout.backGateXs.slice().sort((a, b) => a - b);
    const frontGateX = gateLayout.frontGateX;
    const cornerGateX = gateLayout.cornerGateX;
    const wallMat = materials.wallStone;
    const enclosure = gateLayout.enclosure;
    const wallMinX = enclosure.minX;
    const wallMaxX = enclosure.maxX;
    const wallMinZ = enclosure.minZ;
    const wallMaxZ = enclosure.maxZ;
    const MAX_PIECE_LEN = 4;
    const segmentGeomCache = new Map();
    const capGeomCache = new Map();
    const getSegmentGeom = (segLen, isVertical) => {
        const roundedLen = Math.round(segLen * 1000) / 1000;
        const key = `${isVertical ? 'v' : 'h'}:${roundedLen}`;
        if (!segmentGeomCache.has(key)) {
            segmentGeomCache.set(
                key,
                isVertical
                    ? new THREE.BoxGeometry(wallThickness, wallHeight, roundedLen)
                    : new THREE.BoxGeometry(roundedLen, wallHeight, wallThickness)
            );
        }
        return segmentGeomCache.get(key);
    };
    const getCapGeom = (segLen, isVertical) => {
        const roundedLen = Math.round(segLen * 1000) / 1000;
        const key = `${isVertical ? 'v' : 'h'}:${roundedLen}`;
        if (!capGeomCache.has(key)) {
            capGeomCache.set(
                key,
                isVertical
                    ? new THREE.BoxGeometry(wallThickness + 0.4, 0.4, roundedLen + 0.4)
                    : new THREE.BoxGeometry(roundedLen + 0.4, 0.4, wallThickness + 0.4)
            );
        }
        return capGeomCache.get(key);
    };
    function createSolidGateArchGeometry(span, depth) {
        const outerRadius = span * 0.5 + 0.2;
        const bandThickness = Math.max(0.35, span * 0.08);
        const innerRadius = Math.max(0.2, outerRadius - bandThickness);
        const arcSegments = 20;
        const archShape = new THREE.Shape();
        archShape.moveTo(-outerRadius, 0);
        for (let i = 1; i <= arcSegments; i++) {
            const t = i / arcSegments;
            const angle = Math.PI * (1 - t);
            archShape.lineTo(Math.cos(angle) * outerRadius, Math.sin(angle) * outerRadius);
        }
        archShape.lineTo(innerRadius, 0);
        for (let i = 1; i <= arcSegments; i++) {
            const t = i / arcSegments;
            const angle = Math.PI * t;
            archShape.lineTo(Math.cos(angle) * innerRadius, Math.sin(angle) * innerRadius);
        }
        archShape.closePath();
        const archGeom = new THREE.ExtrudeGeometry(archShape, {
            steps: 1,
            depth: depth,
            bevelEnabled: false
        });
        archGeom.translate(0, 0, -depth * 0.5);
        return archGeom;
    }
    const pillarGeom = new THREE.BoxGeometry(1.2, wallHeight + 1.5, 1.2);
    const pillarCapGeom = new THREE.BoxGeometry(1.5, 0.3, 1.5);
    const postGeom = new THREE.BoxGeometry(1.1, wallHeight + 2.0, 1.1);
    const gateArchGeom = createSolidGateArchGeometry(gateWidth, wallThickness + 0.28);
    const cornerPillarGeom = new THREE.BoxGeometry(1.5, wallHeight + 2.0, 1.5);
    const addPillar = (x, z) => {
        const pillar = new THREE.Mesh(pillarGeom, wallMat);
        pillar.position.set(x, (wallHeight + 1.5) * 0.5, z);
        pillar.castShadow = true;
        wallGroup.add(pillar);
        const pillarCap = new THREE.Mesh(pillarCapGeom, wallMat);
        pillarCap.position.set(x, wallHeight + 1.65, z);
        pillarCap.castShadow = true;
        wallGroup.add(pillarCap);
    };
    function addWallSegment(x, z, length, isVertical) { 
        const segLen = Math.max(0, length);
        if (segLen <= 0) return;
        const seg = new THREE.Mesh(getSegmentGeom(segLen, isVertical), wallMat);
        seg.position.set(x, wallHeight * 0.5, z);
        seg.castShadow = true;
        seg.receiveShadow = true;
        wallGroup.add(seg);
        const cap = new THREE.Mesh(getCapGeom(segLen, isVertical), wallMat);
        cap.position.set(x, wallHeight + 0.2, z);
        cap.castShadow = true;
        wallGroup.add(cap);
    }
    function addWallStrip(x0, x1, z, isVertical) {
        let a = x0;
        while (a < x1 - 1e-3) {
            const b = Math.min(x1, a + MAX_PIECE_LEN);
            const segLen = b - a;
            if (segLen <= 0.5) break;
            const center = (a + b) * 0.5;
            if (isVertical) {
                addWallSegment(z, center, segLen, true);
            } else {
                addWallSegment(center, z, segLen, false);
            }
            a = b;
        }
    }
    function addWallStripWithGaps(x0, x1, fixedCoord, isVertical, gaps = []) { // For openings in graveyward for agents to move through
        const sorted = gaps
            .map(([a, b]) => [Math.max(x0, a), Math.min(x1, b)])
            .filter(([a, b]) => b > a + 0.35)
            .sort((a, b) => a[0] - b[0]);
        let segStart = x0;
        for (let i = 0; i < sorted.length; i++) {
            const [gapStart, gapEnd] = sorted[i];
            if (gapStart > segStart + 0.3) addWallStrip(segStart, gapStart, fixedCoord, isVertical);
            segStart = Math.max(segStart, gapEnd);
        }
        if (segStart < x1 - 0.3) addWallStrip(segStart, x1, fixedCoord, isVertical);
    }
    const backWallZ = wallMaxZ;
    const backGates = gateXs.map(x => [x - gateHalf, x + gateHalf]);
    const frontGates = [
        [frontGateX - gateHalf, frontGateX + gateHalf],
        [cornerGateX - cornerGateHalf, cornerGateX + cornerGateHalf]
    ];
    addWallStripWithGaps(wallMinX, wallMaxX, backWallZ, false, backGates);
    addWallStrip(wallMinZ, wallMaxZ, wallMinX, true);
    addWallStrip(wallMinZ, wallMaxZ, wallMaxX, true);
    addWallStripWithGaps(wallMinX, wallMaxX, wallMinZ, false, frontGates);
    const pillarSpacing = 10;
    for (let x = wallMinX; x <= wallMaxX; x += pillarSpacing) {
        let inGate = false;
        for (let g = 0; g < backGates.length; g++) {
            if (x >= backGates[g][0] - 1.2 && x <= backGates[g][1] + 1.2) {
                inGate = true;
                break;
            }
        }
        if (inGate) continue;
        addPillar(x, backWallZ);
    }
    for (let i = 0; i < gateXs.length; i++) {
        const gx = gateXs[i];
        const leftPost = new THREE.Mesh(postGeom, wallMat);
        leftPost.position.set(gx - gateHalf, (wallHeight + 2.0) * 0.5, backWallZ);
        leftPost.castShadow = true;
        wallGroup.add(leftPost);
        const rightPost = new THREE.Mesh(postGeom, wallMat);
        rightPost.position.set(gx + gateHalf, (wallHeight + 2.0) * 0.5, backWallZ);
        rightPost.castShadow = true;
        wallGroup.add(rightPost);
        const arch = new THREE.Mesh(gateArchGeom, wallMat);
        arch.position.set(gx, wallHeight + 2.0, backWallZ);
        arch.castShadow = true;
        arch.receiveShadow = true;
        wallGroup.add(arch);
    }
    const leftBackPillar = new THREE.Mesh(cornerPillarGeom, wallMat);
    leftBackPillar.position.set(wallMinX, (wallHeight + 2.0) * 0.5, wallMaxZ);
    leftBackPillar.castShadow = true;
    wallGroup.add(leftBackPillar);
    for (let z = wallMinZ + pillarSpacing; z < wallMaxZ - pillarSpacing / 2; z += pillarSpacing) {
        addPillar(wallMinX, z);
    }
    const rightBackPillar = new THREE.Mesh(cornerPillarGeom, wallMat);
    rightBackPillar.position.set(wallMaxX, (wallHeight + 2.0) * 0.5, wallMaxZ);
    rightBackPillar.castShadow = true;
    wallGroup.add(rightBackPillar);
    for (let z = wallMinZ + pillarSpacing; z < wallMaxZ - pillarSpacing / 2; z += pillarSpacing) {
        addPillar(wallMaxX, z);
    }
    const leftFrontPillar = new THREE.Mesh(cornerPillarGeom, wallMat);
    leftFrontPillar.position.set(wallMinX, (wallHeight + 2.0) * 0.5, wallMinZ);
    leftFrontPillar.castShadow = true;
    wallGroup.add(leftFrontPillar);
    const rightFrontPillar = new THREE.Mesh(cornerPillarGeom, wallMat);
    rightFrontPillar.position.set(wallMaxX, (wallHeight + 2.0) * 0.5, wallMinZ);
    rightFrontPillar.castShadow = true;
    wallGroup.add(rightFrontPillar);
    for (let x = wallMinX + pillarSpacing; x < wallMaxX - pillarSpacing / 2; x += pillarSpacing) {
        const inMainFrontGate = Math.abs(x - frontGateX) <= gateHalf + 1.2;
        const inCornerFrontGate = Math.abs(x - cornerGateX) <= cornerGateHalf + 1.2;
        if (inMainFrontGate || inCornerFrontGate) continue;
        addPillar(x, wallMinZ);
    }
    const frontGatePostLeft = new THREE.Mesh(postGeom, wallMat);
    frontGatePostLeft.position.set(frontGateX - gateHalf, (wallHeight + 2.0) * 0.5, wallMinZ);
    frontGatePostLeft.castShadow = true;
    wallGroup.add(frontGatePostLeft);
    const frontGatePostRight = new THREE.Mesh(postGeom, wallMat);
    frontGatePostRight.position.set(frontGateX + gateHalf, (wallHeight + 2.0) * 0.5, wallMinZ);
    frontGatePostRight.castShadow = true;
    wallGroup.add(frontGatePostRight);
    const cornerGatePostLeft = new THREE.Mesh(postGeom, wallMat);
    cornerGatePostLeft.position.set(cornerGateX - cornerGateHalf, (wallHeight + 2.0) * 0.5, wallMinZ);
    cornerGatePostLeft.castShadow = true;
    wallGroup.add(cornerGatePostLeft);
    const cornerGatePostRight = new THREE.Mesh(postGeom, wallMat);
    cornerGatePostRight.position.set(cornerGateX + cornerGateHalf, (wallHeight + 2.0) * 0.5, wallMinZ);
    cornerGatePostRight.castShadow = true;
    wallGroup.add(cornerGatePostRight);
    wallGroup.position.y = platformHeight;
    return wallGroup;
}

// Creates tents on Palace Green 

function createTents(count) {
    const tentsGroup = new THREE.Group();
    const greenW = GREEN_LAYOUT.width;
    const greenL = GREEN_LAYOUT.length;
    const centerX = GREEN_LAYOUT.centerX;
    const centerZ = GREEN_LAYOUT.centerZ;
    const margin = Math.min(8, Math.max(4, GREEN_LAYOUT.roadWidth + 1));
    const usableW = Math.max(4, greenW - 2 * margin);
    const usableL = Math.max(4, greenL - 2 * margin);
    const phi = 0.6180339887498949;
    const canopyVariants = (materials.tentCanopyVariants && materials.tentCanopyVariants.length > 0)
        ? materials.tentCanopyVariants
        : [materials.tent];
    for (let i = 0; i < count; i++) {
        const variant = getMaterialVariant(canopyVariants, (i + 1) * 29.17, materials.tent);
        const tent = createTent(variant);
        const u = (i + 0.5) / count;
        const v = (i * phi) % 1;
        tent.position.set(
            centerX + (u - 0.5) * usableW,
            0,
            centerZ + (v - 0.5) * usableL
        );
        tent.rotation.y = pseudoRandom((i + 1) * 17.83) * Math.PI * 2;
        tentsGroup.add(tent);
    }
    return tentsGroup;
}

function createTent(canopyMaterial = materials.tent) {
    // Procedural tent using B-Spline surface canopy
    const tent = new THREE.Group();
    const canopyGeom = getOrCreateParametricGeometry('tent-canopy', () =>
        createProceduralTentCanopy(3, 4, 0.6)
    );
    const canopy = new THREE.Mesh(canopyGeom, canopyMaterial);
    canopy.castShadow = true;
    canopy.receiveShadow = true;
    tent.add(canopy);
    if (config.debugBSplineCages) {
        const canopyCage = createProceduralTentCanopyControlCage(3, 4, 0.6, { pointRadius: 0.07 });
        canopyCage.position.y = 0.03;
        tent.add(canopyCage);
    }
    // Add FBM-displaced underside for fabric thickness using noise
    const undersideGeom = getOrCreateParametricGeometry('tent-underside', () =>
        createProceduralTentCanopy(2.9, 3.85, 0.65)
    );
    const underside = new THREE.Mesh(undersideGeom, materials.tentUnderside);
    underside.position.y = -0.05;
    tent.add(underside);
    // Central support pole
    const pole = new THREE.Mesh(TENT_POLE_GEOM, materials.cathedralDark);
    pole.position.y = 2.4;
    tent.add(pole);
    // Corner guy-rope poles (4 small stakes)
    TENT_STAKE_OFFSETS.forEach(([ox, oz]) => {
        const stake = new THREE.Mesh(TENT_STAKE_GEOM, materials.cathedralDark);
        stake.position.set(ox, 0.9, oz);
        tent.add(stake);
    });
    return tent;
}

// Creates graveestones in graveyard and also grave mounds

function createGraveyard(count) {
    const graveyardGroup = new THREE.Group();
    const graveyardWidth = 110;
    const graveyardDepth = 30;
    const graveyardCenterX = 0;
    const graveyardCenterZ = 32;
    const fallbackNoGo = {
        minX: CATHEDRAL_LAYOUT.x - 30,
        maxX: CATHEDRAL_LAYOUT.x + 30,
        minZ: CATHEDRAL_LAYOUT.z - 18,
        maxZ: CATHEDRAL_LAYOUT.z + 18
    };
    let cathedralNoGo = fallbackNoGo;
    if (cathedral) {
        const cathedralBounds = new THREE.Box3().setFromObject(cathedral);
        if (
            Number.isFinite(cathedralBounds.min.x) &&
            Number.isFinite(cathedralBounds.max.x) &&
            Number.isFinite(cathedralBounds.min.z) &&
            Number.isFinite(cathedralBounds.max.z)
        ) {
            const paddingX = 1.8;
            const paddingZ = 1.8;
            cathedralNoGo = {
                minX: cathedralBounds.min.x - paddingX,
                maxX: cathedralBounds.max.x + paddingX,
                minZ: cathedralBounds.min.z - paddingZ,
                maxZ: cathedralBounds.max.z + paddingZ
            };
        }
    }
    const isInsideCathedralNoGo = (worldX, worldZ) => (
        worldX >= cathedralNoGo.minX &&
        worldX <= cathedralNoGo.maxX &&
        worldZ >= cathedralNoGo.minZ &&
        worldZ <= cathedralNoGo.maxZ
    );

    // Calculate grid layout with more spacing for larger gravestones
    const rows = Math.ceil(Math.sqrt(count * 0.65)); // Slightly fewer rows
    const cols = Math.ceil(count / rows);
    const spacingX = (graveyardWidth - 10) / cols; // More margin
    const spacingZ = (graveyardDepth - 6) / rows;   // More margin
    const minLocalX = -graveyardWidth / 2 + 5;
    const maxLocalX = graveyardWidth / 2 - 5;
    const minLocalZ = -graveyardDepth / 2 + 3;
    const maxLocalZ = graveyardDepth / 2 - 3;
    const gravePlacement = createPlacementHash(2.6);

    let graveIndex = 0;
    let candidateIndex = 0;
    for (let row = 0; row < rows && graveIndex < count; row++) {
        for (let col = 0; col < cols && graveIndex < count; col++) {
            candidateIndex++;
            // Reduced random offset to prevent overlap of larger gravestones
            const offsetX = (pseudoRandom(candidateIndex * 3.7) - 0.5) * 1.2;
            const offsetZ = (pseudoRandom(candidateIndex * 5.1) - 0.5) * 1.2;
            const localX = minLocalX + col * spacingX + offsetX;
            const localZ = minLocalZ + row * spacingZ + offsetZ;
            const worldX = graveyardCenterX + localX;
            const worldZ = graveyardCenterZ + localZ;
            if (isInsideCathedralNoGo(worldX, worldZ)) continue;
            if (!gravePlacement.canPlace(localX, localZ, 2.6)) continue;

            const grave = createGrave(pseudoRandom(candidateIndex * 7.3));
            grave.position.set(localX, 0, localZ);
            // Slight random rotation for organic placement
            grave.rotation.y = (pseudoRandom(candidateIndex * 2.3) - 0.5) * 0.15;
            graveyardGroup.add(grave);
            gravePlacement.add(localX, localZ);
            graveIndex++;
        }
    }

    // Backfill any skipped slots (e.g. cathedral overlap) with deterministic random sampling.
    let fillAttempts = 0;
    const maxFillAttempts = Math.max(600, count * 80);
    while (graveIndex < count && fillAttempts < maxFillAttempts) {
        fillAttempts++;
        candidateIndex++;
        const localX = THREE.MathUtils.lerp(minLocalX, maxLocalX, pseudoRandom(candidateIndex * 6.7));
        const localZ = THREE.MathUtils.lerp(minLocalZ, maxLocalZ, pseudoRandom(candidateIndex * 8.9));
        const worldX = graveyardCenterX + localX;
        const worldZ = graveyardCenterZ + localZ;
        if (isInsideCathedralNoGo(worldX, worldZ)) continue;
        if (!gravePlacement.canPlace(localX, localZ, 2.4)) continue;
        const grave = createGrave(pseudoRandom(candidateIndex * 7.3));
        grave.position.set(localX, 0, localZ);
        grave.rotation.y = (pseudoRandom(candidateIndex * 2.3) - 0.5) * 0.15;
        graveyardGroup.add(grave);
        gravePlacement.add(localX, localZ);
        graveIndex++;
    }

    graveyardGroup.position.set(graveyardCenterX, 0, graveyardCenterZ);
    return graveyardGroup;
}

// Creates a grave using Bezier profiles 

function createGrave(seed) {
    // Procedural gravestones using Bézier profiles
    const grave = new THREE.Group();
    
    // Reuse central palette materials to avoid per-grave material churn.
    const gravestoneMat = materials.gravestone;
    const baseMat = materials.gravestoneBase || materials.cathedralDark;
    
    const type = Math.floor(seed * 4);
    const sizeVariation = 0.85 + (seed * 0.3);
    
    // Stone based blocks
    const baseTiers = seed < 0.33 ? 2 : (seed < 0.66 ? 3 : 2);
    const baseWidth = 2.4 * sizeVariation;
    const baseDepth = 1.6 * sizeVariation;
    const baseHeight = 0.65 * baseTiers;
    
    const stoneBase = createProceduralStoneBase(baseWidth, baseHeight, baseDepth, baseTiers);
    stoneBase.traverse(child => {
        if (child.isMesh) {
            child.material = baseMat;
            child.castShadow = true;
            child.receiveShadow = true;
        }
    });
    grave.add(stoneBase);
    
    // HEADSTONE - Positioned on top of base blocks
    const headstoneY = baseHeight;
    
    if (type === 0) {
        // Rounded headstone — Bézier profile with smooth dome top (LARGER)
        const geom = getOrCreateParametricGeometry('gravestone-rounded-v2', () =>
            createProceduralGravestone(1.8, 3.5, 0.4, 0)
        );
        const stone = new THREE.Mesh(geom, gravestoneMat);
        stone.position.y = headstoneY;
        stone.castShadow = true;
        stone.receiveShadow = true;
        stone.scale.setScalar(sizeVariation);
        grave.add(stone);
        
    } else if (type === 1) {
        // Celtic/Latin cross — Bézier-profiled cross (LARGER & THICKER)
        const geom = getOrCreateParametricGeometry('gravestone-cross-v2', () =>
            createProceduralCross(0.32, 4.2, 1.8, 0.28)
        );
        const cross = new THREE.Mesh(geom, gravestoneMat);
        cross.position.y = headstoneY;
        cross.castShadow = true;
        cross.receiveShadow = true;
        cross.scale.setScalar(sizeVariation);
        grave.add(cross);
        
    } else if (type === 2) {
        // Gothic pointed headstone — Bézier profile with sharp peak (LARGER)
        const geom = getOrCreateParametricGeometry('gravestone-gothic-v2', () =>
            createProceduralGravestone(1.6, 4.0, 0.35, 1)
        );
        const stone = new THREE.Mesh(geom, gravestoneMat);
        stone.position.y = headstoneY;
        stone.castShadow = true;
        stone.receiveShadow = true;
        stone.scale.setScalar(sizeVariation);
        grave.add(stone);
        
    } else {
        // Obelisk — Bézier profile of revolution (LARGER & THICKER)
        const geom = getOrCreateParametricGeometry('gravestone-obelisk-v2', () =>
            createProceduralObelisk(0.55, 4.0)
        );
        const obelisk = new THREE.Mesh(geom, gravestoneMat);
        obelisk.position.y = headstoneY;
        obelisk.castShadow = true;
        obelisk.receiveShadow = true;
        obelisk.scale.setScalar(sizeVariation);
        grave.add(obelisk);
    }
    
    // Grave mound — B-Spline surface (Lecture 3b, Slide 20)
    // Positioned in front of the base blocks
    const moundGeom = getOrCreateParametricGeometry('grave-mound', () =>
        createProceduralGraveMound(2.8, 1.4, 0.4)
    );
    const mound = new THREE.Mesh(moundGeom, materials.graveMound || materials.ground);
    mound.position.set(0, 0, 1.8);
    mound.receiveShadow = true;
    mound.scale.setScalar(sizeVariation);
    grave.add(mound);
    if (config.debugBSplineCages) {
        const moundCage = createProceduralGraveMoundControlCage(2.8, 1.4, 0.4, { pointRadius: 0.045 });
        moundCage.position.copy(mound.position);
        moundCage.scale.copy(mound.scale);
        grave.add(moundCage);
    }
    
    return grave;
}

// Creates gothic buildings 

function createGothicBuilding(index, height) {
    const group = new THREE.Group();
    const colorHash = (index * 12.9898) % 1.0;
    const stoneSat = 0.15 + colorHash * 0.1;
    const stoneLum = 0.3 + colorHash * 0.12;
    const stoneMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color().setHSL(0.08, stoneSat, stoneLum),
        roughness: 0.95,
        metalness: 0.05
    });
    const buildingGeom = new THREE.BoxGeometry(
        BUILDINGS_ZONE.buildingWidth,
        height,
        BUILDINGS_ZONE.buildingDepth
    );
    const building = new THREE.Mesh(buildingGeom, stoneMat);
    building.castShadow = true;
    building.receiveShadow = true;
    group.add(building);
    const windowHeight = 2.0;
    const windowWidth = 1.0;
    const windowSpacingX = 3.2;
    const windowSpacingY = 2.8;
    const windowsPerRow = Math.max(1, Math.floor(BUILDINGS_ZONE.buildingWidth / windowSpacingX));
    const windowRows = Math.max(1, Math.floor((height * 0.8) / windowSpacingY));
    const windowCount = windowRows * windowsPerRow;
    const frameInst = new THREE.InstancedMesh(GOTHIC_WINDOW_FRAME_GEOM, materials.windowFrame, windowCount);
    const paneInst = new THREE.InstancedMesh(GOTHIC_WINDOW_PANE_GEOM, materials.windowPane, windowCount * 2);
    const archInst = new THREE.InstancedMesh(GOTHIC_WINDOW_ARCH_GEOM, materials.windowFrame, windowCount);
    frameInst.castShadow = true;
    frameInst.receiveShadow = true;
    archInst.castShadow = true;
    const windowDummy = new THREE.Object3D();
    let frameIndex = 0;
    let paneIndex = 0;
    let archIndex = 0;
    for (let row = 0; row < windowRows; row++) {
        for (let col = 0; col < windowsPerRow; col++) {
            const xOffset = -BUILDINGS_ZONE.buildingWidth * 0.5 + (col + 0.5) * windowSpacingX;
            const yOffset = height * 0.35 - row * windowSpacingY;
            windowDummy.position.set(xOffset, yOffset, BUILDINGS_ZONE.buildingDepth * 0.5 + 0.2);
            windowDummy.rotation.set(0, 0, 0);
            windowDummy.scale.set(1, 1, 1);
            windowDummy.updateMatrix();
            frameInst.setMatrixAt(frameIndex++, windowDummy.matrix);

            windowDummy.position.set(xOffset - windowWidth * 0.25, yOffset, BUILDINGS_ZONE.buildingDepth * 0.5 + 0.25);
            windowDummy.rotation.set(0, 0, 0);
            windowDummy.scale.set(1, 1, 1);
            windowDummy.updateMatrix();
            paneInst.setMatrixAt(paneIndex++, windowDummy.matrix);

            windowDummy.position.set(xOffset + windowWidth * 0.25, yOffset, BUILDINGS_ZONE.buildingDepth * 0.5 + 0.25);
            windowDummy.rotation.set(0, 0, 0);
            windowDummy.scale.set(1, 1, 1);
            windowDummy.updateMatrix();
            paneInst.setMatrixAt(paneIndex++, windowDummy.matrix);

            windowDummy.position.set(xOffset, yOffset + windowHeight * 0.45, BUILDINGS_ZONE.buildingDepth * 0.5 + 0.2);
            windowDummy.rotation.set(0, 0, 0);
            windowDummy.scale.set(1, 0.5, 1);
            windowDummy.updateMatrix();
            archInst.setMatrixAt(archIndex++, windowDummy.matrix);
        }
    }
    frameInst.instanceMatrix.needsUpdate = true;
    paneInst.instanceMatrix.needsUpdate = true;
    archInst.instanceMatrix.needsUpdate = true;
    group.add(frameInst);
    group.add(paneInst);
    group.add(archInst);
    const roofPitch = height * 0.4;
    const bW = BUILDINGS_ZONE.buildingWidth;
    const bD = BUILDINGS_ZONE.buildingDepth;
    const buildingTop = height / 2;
    const roofShape = new THREE.Shape();
    roofShape.moveTo(-bW / 2, 0);
    roofShape.lineTo(0, roofPitch);
    roofShape.lineTo(bW / 2, 0);
    roofShape.lineTo(-bW / 2, 0);
    const roofGeom = new THREE.ExtrudeGeometry(roofShape, {
        steps: 1,
        depth: bD,
        bevelEnabled: false
    });
    roofGeom.translate(0, 0, -bD / 2);
    const roofMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color().setHSL(0.08, stoneSat + 0.1, stoneLum - 0.25),
        roughness: 0.92
    });
    const roof = new THREE.Mesh(roofGeom, roofMat);
    roof.position.y = buildingTop;
    roof.castShadow = true;
    roof.receiveShadow = true;
    group.add(roof);
    const pinnacleHeight = height * 0.12;
    const pinnacleGeom = new THREE.ConeGeometry(0.35, pinnacleHeight, 6);
    const pinnaclePositions = [
        {x: -bW/2 + 0.5, z: -bD/2 + 0.5, y: buildingTop},
        {x: bW/2 - 0.5, z: -bD/2 + 0.5, y: buildingTop},
        {x: -bW/2 + 0.5, z: bD/2 - 0.5, y: buildingTop},
        {x: bW/2 - 0.5, z: bD/2 - 0.5, y: buildingTop}
    ];
    pinnaclePositions.forEach(pos => {
        const pinnacle = new THREE.Mesh(pinnacleGeom, roofMat);
        pinnacle.position.set(pos.x, pos.y + pinnacleHeight * 0.5, pos.z);
        pinnacle.castShadow = true;
        group.add(pinnacle);
    });
    const buttressGeom = new THREE.BoxGeometry(0.25, height * 0.65, 0.6);
    const buttressMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color().setHSL(0.08, stoneSat, stoneLum - 0.08),
        roughness: 0.93
    });
    for (let i = 0; i < 3; i++) {
        const buttress = new THREE.Mesh(buttressGeom, buttressMat);
        const zPos = -BUILDINGS_ZONE.buildingDepth * 0.25 + i * (BUILDINGS_ZONE.buildingDepth * 0.25);
        buttress.position.set(BUILDINGS_ZONE.buildingWidth * 0.5 + 0.4, height * 0.32, zPos);
        buttress.castShadow = true;
        buttress.receiveShadow = true;
        group.add(buttress);
    }
    return group;
}

// Creates gothic buildings along the side of the scene, perpendicular to cathedral and opposite side to the river

function createBuildings(count, height) {
    const group = new THREE.Group();
    mainBuildingFootprints = [];
    if (count === 0) return group;
    const effectiveCount = getExtendedHouseCount(count);
    const rowStartZ = getBuildingsBackEdgeZ(count) + BUILDINGS_ZONE.buildingDepth * 0.5;
    const targetEndCenterZ = GREEN_LAYOUT.centerZ + GREEN_LAYOUT.length * 0.5 - BUILDINGS_ZONE.buildingDepth * 0.5 - 1.0;
    const rowEndZ = targetEndCenterZ;
    const zStep = (effectiveCount > 1) ? ((rowEndZ - rowStartZ) / (effectiveCount - 1)) : 0;
    const roofPitch = height * 0.4;
    const halfW = BUILDINGS_ZONE.buildingWidth * 0.5 + 1.2;
    const halfD = BUILDINGS_ZONE.buildingDepth * 0.5 + 1.2;
    for (let i = 0; i < effectiveCount; i++) {
        const building = createGothicBuilding(i, height);
        const zPos = (effectiveCount === 1) ? ((rowStartZ + rowEndZ) * 0.5) : (rowStartZ + i * zStep);
        building.position.set(BUILDINGS_ZONE.centerX, height * 0.5, zPos);
        group.add(building);
        mainBuildingFootprints.push({
            cx: BUILDINGS_ZONE.centerX,
            cz: zPos,
            hw: halfW,
            hd: halfD,
            h: height,
            roofPitch,
            hTotal: height + roofPitch
        });
    }
    group.position.y = platformHeight;
    return group;
}

// Rebuilds the garden paths when rear building layout changes

function rebuildGardenPaths() {
    if (gardenPaths) scene.remove(gardenPaths);
    gardenPaths = createGardenPathsProcedural();
    gardenPaths.position.y = platformHeight;
    scene.add(gardenPaths);
}

// Triggered when building properties are changed

function rebuildBuildings() {
    if (buildingsGroup) scene.remove(buildingsGroup);
    buildingsGroup = createBuildings(BUILDINGS_ZONE.rowCount, config.buildingHeight);
    scene.add(buildingsGroup);
    if (greenBuildingsGroup) scene.remove(greenBuildingsGroup);
    greenBuildingsGroup = createGreenBuildings(config.greenBuildingCount);
    scene.add(greenBuildingsGroup);
    if (groundGroup) scene.remove(groundGroup);
    if (ground) scene.remove(ground);
    clearGeometryCache();
    groundGroup = createGroundProcedural();
    groundGroup.position.y = groundLevel;
    ground = groundGroup.userData.surfaceMesh || groundGroup.children[0] || null;
    scene.add(groundGroup);
    if (oppositeRoadMesh) scene.remove(oppositeRoadMesh);
    oppositeRoadMesh = createOppositeRoad();
    scene.add(oppositeRoadMesh);
    if (platform) scene.remove(platform);
    platform = createPlatform();
    scene.add(platform);
    stageRaycastTargets = [];
    if (platform && platform.userData && platform.userData.surfaceMesh) stageRaycastTargets.push(platform.userData.surfaceMesh);
    if (ground) stageRaycastTargets.push(ground);
    rebuildGardenPaths();
    rebuildRiver();
    rebuildFoliage();
    rebuildStaticObstacleGrid();
    rebuildNavSystem();
            resetSpatialGrid();
            initSpatialGridSystem();
    refreshBuildingLightAngle();
    renderer.shadowMap.needsUpdate = true;
}

// Create the buildings in the green area

function createGreenVillageBuilding(seed, w, d, h) {
    const group = new THREE.Group();
    const variantSeed = seed * 3.77;
    const wallMat = getMaterialVariant(materials.greenVillageWallVariants, variantSeed, materials.cathedralStone);
    const roofMat = getMaterialVariant(materials.greenVillageRoofVariants, variantSeed, materials.cathedralDark);

    const bodyGeom = new THREE.BoxGeometry(w, h, d);
    const body = new THREE.Mesh(bodyGeom, wallMat);
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);

    // Pitched / curved roof (parametric profile)
    const rRoof = pseudoRandom(seed * 11.3);
    const roofPitchMin = Math.max(0, Number(config.greenBldRoofPitchMin) || 0);
    const roofPitchMax = Math.max(roofPitchMin, Number(config.greenBldRoofPitchMax) || roofPitchMin);
    const roofPitchFrac = THREE.MathUtils.lerp(roofPitchMin, roofPitchMax, rRoof);
    const roofPitch = h * roofPitchFrac;

    const roofShape = new THREE.Shape();
    roofShape.moveTo(-w / 2, 0);
    if (config.greenBldCurvedRoofs) {
        const c = THREE.MathUtils.clamp(Number(config.greenBldRoofCurve) || 0, 0.0, 0.9);
        roofShape.bezierCurveTo(
            -w * 0.35, roofPitch * (0.15 + 0.25 * c),
            -w * 0.15, roofPitch * (0.85 + 0.10 * c),
            0, roofPitch
        );
        roofShape.bezierCurveTo(
            w * 0.15, roofPitch * (0.85 + 0.10 * c),
            w * 0.35, roofPitch * (0.15 + 0.25 * c),
            w / 2, 0
        );
    } else {
        roofShape.lineTo(0, roofPitch);
        roofShape.lineTo(w / 2, 0);
    }
    roofShape.lineTo(-w / 2, 0);
    roofShape.closePath();

    const roofGeom = new THREE.ExtrudeGeometry(roofShape, {
        steps: 1,
        depth: d,
        bevelEnabled: false
    });
    roofGeom.translate(0, 0, -d / 2);
    roofGeom.computeVertexNormals();

    const roof = new THREE.Mesh(roofGeom, roofMat);
    roof.position.y = h / 2;
    roof.castShadow = true;
    roof.receiveShadow = true;
    group.add(roof);

    const windowSpacingX = Math.max(1.0, Number(config.greenBldWindowSpacingX) || 3.0);
    const windowSpacingY = Math.max(1.0, Number(config.greenBldWindowSpacingY) || 3.2);
    const cols = Math.max(1, Math.floor((w - 1) / windowSpacingX));
    const rows = Math.max(1, Math.floor((h * 0.7) / windowSpacingY));
    const paneCount = rows * cols;
    const paneInst = new THREE.InstancedMesh(GREEN_VILLAGE_PANE_GEOM, materials.greenVillagePane, paneCount);
    const paneDummy = new THREE.Object3D();
    let paneIndex = 0;
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const xOff = -w * 0.5 + (c + 0.5) * (w / cols);
            const yOff = h * 0.3 - r * windowSpacingY;
            paneDummy.position.set(xOff, yOff, d * 0.5 + 0.08);
            paneDummy.rotation.set(0, 0, 0);
            paneDummy.scale.set(1, 1, 1);
            paneDummy.updateMatrix();
            paneInst.setMatrixAt(paneIndex++, paneDummy.matrix);
        }
    }
    paneInst.instanceMatrix.needsUpdate = true;
    group.add(paneInst);

    const chimneyProb = THREE.MathUtils.clamp(Number(config.greenBldChimneyProb) || 0, 0, 1);
    if (pseudoRandom(seed * 17.3) < chimneyProb) {
        const chimW = 0.8 + pseudoRandom(seed * 19.1) * 0.5;
        const chimH = 2 + pseudoRandom(seed * 21.7) * 2;
        const chimGeom = new THREE.BoxGeometry(chimW, chimH, chimW);
        const chimney = new THREE.Mesh(chimGeom, wallMat);
        const chimX = w * (0.15 + pseudoRandom(seed * 23.3) * 0.3) * (pseudoRandom(seed * 25.1) > 0.5 ? 1 : -1);
        chimney.position.set(chimX, h / 2 + roofPitch * 0.4 + chimH / 2, 0);
        chimney.castShadow = true;
        group.add(chimney);
    }

    return { group, roofPitch };
}

// Building creation using procedural generation with spacing constraints to avoid overcrowding and randomisation

function createGreenBuildings(count) {
    const group = new THREE.Group();
    greenBuildingFootprints = [];
    if (count === 0) return group;

    const baseSeed = (Number(config.greenBuildingSeed) | 0) || 1;
    const rng = mulberry32(baseSeed);

    const zone = getRearGreenBuildingZoneBounds();
    const minX = zone.minX;
    const maxX = zone.maxX;
    const minZ = zone.minZ;
    const maxZ = zone.maxZ;
    if (minX >= maxX || minZ >= maxZ) return group;

    // Density scaling: as count increases, minimum spacing decreases (down to a limit)
    const maxCount = 30;
    const effectiveCount = Math.min(count, maxCount);
    const densityRatio = effectiveCount / maxCount;

    const spacingMin = Math.max(0, Number(config.greenBldMinSpacing) || 0);
    const spacingMax = Math.max(spacingMin, Number(config.greenBldMaxSpacing) || spacingMin);
    const minSpacing = THREE.MathUtils.lerp(spacingMax, spacingMin, densityRatio);

    const minW = Math.max(2, Number(config.greenBldMinW) || 6);
    const maxW = Math.max(minW, Number(config.greenBldMaxW) || minW);
    const minD = Math.max(2, Number(config.greenBldMinD) || 5);
    const maxD = Math.max(minD, Number(config.greenBldMaxD) || minD);
    const minH = Math.max(2, Number(config.greenBldMinH) || 6);
    const maxH = Math.max(minH, Number(config.greenBldMaxH) || minH);

    const placed = [];
    let attempts = 0;
    const maxAttempts = effectiveCount * 80;

    while (placed.length < effectiveCount && attempts < maxAttempts) {
        attempts++;
        const cx = THREE.MathUtils.lerp(minX, maxX, rng());
        const cz = THREE.MathUtils.lerp(minZ, maxZ, rng());

        const bw = THREE.MathUtils.lerp(minW, maxW, rng());
        const bd = THREE.MathUtils.lerp(minD, maxD, rng());
        const bh = THREE.MathUtils.lerp(minH, maxH, rng());

        let tooClose = false;
        for (let i = 0; i < placed.length; i++) {
            const p = placed[i];
            const dx = Math.abs(cx - p.cx);
            const dz = Math.abs(cz - p.cz);
            const reqX = (bw + p.w) / 2 + minSpacing;
            const reqZ = (bd + p.d) / 2 + minSpacing;
            if (dx < reqX && dz < reqZ) {
                tooClose = true;
                break;
            }
        }
        if (tooClose) continue;

        const bSeed = (baseSeed * 10000 + placed.length * 97 + attempts) | 0;
        const buildingData = createGreenVillageBuilding(bSeed, bw, bd, bh);
        const building = buildingData.group;
        const roofPitch = buildingData.roofPitch;
        const totalHeight = bh + roofPitch;

        const rotation = rng() * 0.4 - 0.2;
        building.rotation.y = rotation;
        building.position.set(cx, bh * 0.5, cz);
        group.add(building);

        placed.push({ cx, cz, w: bw, d: bd, h: bh, roofPitch: roofPitch, hTotal: totalHeight });
        greenBuildingFootprints.push({
            cx, cz,
            hw: bw / 2 + 2,  // half-width + tree clearance
            hd: bd / 2 + 2,  // half-depth + tree clearance
            h: bh,
            roofPitch: roofPitch,
            hTotal: totalHeight
        });
    }

    group.position.y = platformHeight;
    return group;
}

function rebuildGreenBuildings() {
    if (greenBuildingsGroup) scene.remove(greenBuildingsGroup);
    greenBuildingsGroup = createGreenBuildings(config.greenBuildingCount);
    scene.add(greenBuildingsGroup);
    rebuildGardenPaths();
    refreshBuildingLightAngle();
    renderer.shadowMap.needsUpdate = true;
    rebuildFoliage(); // trees need to re-scatter around new buildings
    if (spatialGrid) rebuildSpatialGrid();
    // Green buildings change collision/avoidance, but nav routes are layout-driven.
    rebuildStaticObstacleGrid();
    if (config.debugNav) rebuildNavDebug();
}

function initializeGround() {
    if (groundGroup) scene.remove(groundGroup);
    if (ground) scene.remove(ground);
    groundGroup = createGroundProcedural();
    groundGroup.position.y = groundLevel;
    ground = groundGroup.userData.surfaceMesh || groundGroup.children[0] || null;
    scene.add(groundGroup);
    return ground;
}

function createOppositeRoad() {
    const roadSpan = getOppositeRoadSpan();
    const roadZoneLength = Math.abs(roadSpan.maxZ - roadSpan.minZ);
    const centerZ = (roadSpan.maxZ + roadSpan.minZ) * 0.5;
    const roadGeom = new THREE.PlaneGeometry(OPPOSITE_ROAD.width, roadZoneLength);
    const road = new THREE.Mesh(roadGeom, materials.road);
    road.rotation.x = -Math.PI / 2;
    road.position.set(OPPOSITE_ROAD.centerX, platformHeight + 0.35, centerZ);
    road.receiveShadow = false;
    road.renderOrder = 10;
    return road;
}

// Creates the main plane for the scene to sit on

function createPlatform() {
    const platformGroup = new THREE.Group();
    const buildingCenterX = BUILDINGS_ZONE.centerX;
    const buildingWidth = BUILDINGS_ZONE.buildingWidth;
    const buildingLeftEdge = buildingCenterX - buildingWidth / 2 - 5;
    const greenRoadRightEdge = GREEN_LAYOUT.centerX + (GREEN_LAYOUT.width / 2 + GREEN_LAYOUT.roadWidth);
    const platformWidth = greenRoadRightEdge - buildingLeftEdge;
    const platformCenterX = (buildingLeftEdge + greenRoadRightEdge) / 2;
    const greenRoadFarZ = GREEN_LAYOUT.centerZ + (GREEN_LAYOUT.length / 2 + GREEN_LAYOUT.roadWidth);
    const buildingExtension = BUILDINGS_ZONE.rowCount * (BUILDINGS_ZONE.buildingDepth + BUILDINGS_ZONE.spacing) + 40;
    const buildingEndZ = BUILDINGS_ZONE.startZ - buildingExtension;
    const platformDepth = greenRoadFarZ - buildingEndZ + 10;
    const platformTop = platformHeight;
    const adjustedCenterZ = (greenRoadFarZ + buildingEndZ) / 2;
    const terrainSegmentsX = 64;
    const terrainSegmentsZ = 64;
    const topGeom = new THREE.PlaneGeometry(platformWidth, platformDepth, terrainSegmentsX, terrainSegmentsZ);
    const positions = topGeom.attributes.position;
    for (let i = 0; i < positions.count; i++) {
        const localX = positions.getX(i);
        const localZ = positions.getY(i);
        const worldX = localX + platformCenterX;
        const worldZ = localZ + adjustedCenterZ;
        const inCathedralZone = Math.abs(worldX) < 35 && worldZ > -25 && worldZ < 20;
        const inGraveyardZone = Math.abs(worldX) < 30 && worldZ >= 17 && worldZ < 48;
        const inWallEnclosureZone = isInWallEnclosure(worldX, worldZ, 0.25);
        const inGreenRoadZone = isInGreenRingRoad(worldX, worldZ, 2);
        const inOppositeRoadZone = isInOppositeRoadZone(worldX, worldZ, 2);
        const inDividerWallZone = worldZ > DIVIDER_WALL.z - 3 && worldZ < DIVIDER_WALL.z + 3;
        let noiseHeight = 0;
        if (!inCathedralZone && !inGraveyardZone && !inWallEnclosureZone && !inGreenRoadZone && !inOppositeRoadZone && !inDividerWallZone) {
            noiseHeight = 0;
        }
        positions.setZ(i, noiseHeight);
    }
    topGeom.computeVertexNormals();
    const platformMat = new THREE.MeshStandardMaterial({
        color: 0x3d6b35,
        roughness: 0.95
    });
    platformSurfaceMat = platformMat;
    const platformSurface = new THREE.Mesh(topGeom, platformMat);
    platformSurface.name = 'StagePlatformSurface';
    platformSurface.rotation.x = -Math.PI / 2;
    platformSurface.position.set(platformCenterX, platformTop, adjustedCenterZ);
    platformSurface.receiveShadow = true;
    platformGroup.userData.surfaceMesh = platformSurface;
    platformGroup.add(platformSurface);
    const sideThickness = 2.0;
    const sideHeight = platformTop - groundLevel;
    const sideMat = new THREE.MeshStandardMaterial({
        color: 0x2a4a26,
        roughness: 0.98
    });
    const sideY = groundLevel + sideHeight * 0.5;
    const centerZ = adjustedCenterZ;
    {
        const geom = new THREE.BoxGeometry(sideThickness, sideHeight, platformDepth);
        const m = new THREE.Mesh(geom, sideMat);
        m.position.set(platformCenterX - platformWidth / 2 + sideThickness / 2, sideY, centerZ);
        m.castShadow = true;
        m.receiveShadow = true;
        platformGroup.add(m);
    }
    {
        const geom = new THREE.BoxGeometry(platformWidth, sideHeight, sideThickness);
        const m = new THREE.Mesh(geom, sideMat);
        m.position.set(platformCenterX, sideY, centerZ - platformDepth / 2 + sideThickness / 2);
        m.castShadow = true;
        m.receiveShadow = true;
        platformGroup.add(m);
    }
    {
        const geom = new THREE.BoxGeometry(platformWidth, sideHeight, sideThickness);
        const m = new THREE.Mesh(geom, sideMat);
        m.position.set(platformCenterX, sideY, centerZ + platformDepth / 2 - sideThickness / 2);
        m.castShadow = true;
        m.receiveShadow = true;
        platformGroup.add(m);
    }
    const wallLength = platformDepth * 0.98;
    const wallHeight = sideHeight;
    const retainingWallGeom = new THREE.BoxGeometry(2, wallHeight, wallLength);
    const retainingWallMat = new THREE.MeshStandardMaterial({
        color: 0x5a5a5a,
        roughness: 0.9
    });
    platformRetainingWallMat = retainingWallMat;
    const retainingWall = new THREE.Mesh(retainingWallGeom, retainingWallMat);
    retainingWall.position.set(platformCenterX + platformWidth / 2 - 1, groundLevel + wallHeight / 2, centerZ);
    retainingWall.castShadow = true;
    retainingWall.receiveShadow = true;
    platformGroup.add(retainingWall);
    platformDims = {
        width: platformWidth,
        depth: platformDepth,
        centerX: platformCenterX,
        centerZ: adjustedCenterZ,
        height: platformTop
    };
    return platformGroup;
}

// Debug view for spatial grid

function buildSpatialGridDebugView(cellSize = config.gridCellSize) {
    if (Number.isFinite(cellSize) && cellSize > 0 && cellSize !== config.gridCellSize) {
        config.gridCellSize = cellSize;
        resetSpatialGrid();
    }
    initSpatialGridSystem();
    rebuildSpatialGrid();
    spatialGridDebugMesh = gridDebug.root || null;
    if (spatialGridDebugMesh) spatialGridDebugMesh.visible = !!config.gridDebug;
    return spatialGridDebugMesh;
}

function toggleSpatialGridDebug(visible) {
    if (!spatialGridDebugMesh) buildSpatialGridDebugView(config.gridCellSize);
    config.gridDebug = !!visible;
    if (spatialGridDebugMesh) spatialGridDebugMesh.visible = !!visible;
    if (config.gridDebug) updateSpatialGridDebug();
}

// Creates the river geometry and material, with animated shader for water movement

function createRiver(riverOffsetX) {
    disposeRiverTreeLodField();
    const riverGroup = new THREE.Group();
    const greenEndZ = GREEN_LAYOUT.centerZ + GREEN_LAYOUT.length / 2;
    const buildingExtension = BUILDINGS_ZONE.rowCount * (BUILDINGS_ZONE.buildingDepth + BUILDINGS_ZONE.spacing) + 40;
    const buildingEndZ = BUILDINGS_ZONE.startZ - buildingExtension;
    const riverLength = greenEndZ - buildingEndZ;
    const riverWidth = 18;
    const riverSegments = 64;
    const greenRoadRightEdge = GREEN_LAYOUT.centerX + (GREEN_LAYOUT.width / 2 + GREEN_LAYOUT.roadWidth);
    const retainingWallOuterFaceX = greenRoadRightEdge;
    const riverCenterX = greenRoadRightEdge + riverWidth / 2 + riverOffsetX;
    const riverCenterZ = (greenEndZ + buildingEndZ) / 2;
    const riverCenterY = -6;
    const riverGeom = new THREE.PlaneGeometry(riverLength, riverWidth, riverSegments, 16);
    const positions = riverGeom.attributes.position;
    const uvs = riverGeom.attributes.uv;
    for (let i = 0; i < positions.count; i++) {
        const x = positions.getX(i); // longitudinal
        const y = positions.getY(i); // lateral
        const lateralFraction = y / (riverWidth / 2);
        positions.setY(i, y);
        const depth = -2.0 * (1 - lateralFraction * lateralFraction);
        const bedNoise = fractal_brownian_motion(x * 0.06, y * 0.06, 4) * 0.14;
        positions.setZ(i, depth + bedNoise);
    }
    {
        const wSeg = riverGeom.parameters.widthSegments;
        const hSeg = riverGeom.parameters.heightSegments;
        const stride = wSeg + 1;
        const cx = new Float32Array(stride);
        const cy = new Float32Array(stride);
        for (let ix = 0; ix <= wSeg; ix++) {
            let sumY = 0;
            let sumX = 0;
            for (let iy = 0; iy <= hSeg; iy++) {
                const idx = iy * stride + ix;
                sumX += positions.getX(idx);
                sumY += positions.getY(idx);
            }
            cx[ix] = sumX / (hSeg + 1);
            cy[ix] = sumY / (hSeg + 1);
        }
        const s = new Float32Array(stride);
        s[0] = 0;
        for (let ix = 1; ix <= wSeg; ix++) {
            const dx = cx[ix] - cx[ix - 1];
            const dy = cy[ix] - cy[ix - 1];
            s[ix] = s[ix - 1] + Math.sqrt(dx * dx + dy * dy);
        }
        const total = s[wSeg] > 1e-6 ? s[wSeg] : 1.0;
        for (let iy = 0; iy <= hSeg; iy++) {
            for (let ix = 0; ix <= wSeg; ix++) {
                const idx = iy * stride + ix;
                const u = s[ix] / total;
                uvs.setX(idx, u);
            }
        }
        uvs.needsUpdate = true;
    }
    riverGeom.computeVertexNormals();
    riverMaterial = new THREE.ShaderMaterial({
        uniforms: {
            uTime: { value: 0 },
            uFlowSpeed: { value: 0.5 },
            uColor1: { value: new THREE.Color(0x1a5276) },
            uColor2: { value: new THREE.Color(0x3498db) },
            uIsDay: { value: 1.0 }
        },
        vertexShader: `

            uniform float uTime;
            uniform float uFlowSpeed;
            varying vec2 vUv;
            varying vec3 vPosition;

            void main() {
                vUv = uv;

                vec3 displaced = position;

                float t = uTime * uFlowSpeed;

                float w1 = sin(position.x * 0.08 + t * 1.2 + position.y * 0.05) * 0.35;

                float w2 = sin(position.x * 0.20 + t * 2.0 - position.y * 0.12) * 0.15;

                float w3 = sin(position.x * 0.50 + t * 3.5 + position.y * 0.30) * 0.06;

                displaced.z += w1 + w2 + w3;

                vPosition = displaced;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
            }
        `,
        fragmentShader: `
            uniform float uTime;
            uniform float uFlowSpeed;
            uniform vec3 uColor1;
            uniform vec3 uColor2;
            uniform float uIsDay;
            varying vec2 vUv;
            varying vec3 vPosition;

            void main() {

                float flow = uTime * uFlowSpeed;

                float wave1 = sin((vUv.x * 20.0 + flow * 2.0) + vUv.y * 5.0) * 0.5 + 0.5;
                float wave2 = sin((vUv.x * 35.0 + flow * 3.0) - vUv.y * 8.0) * 0.5 + 0.5;
                float wave3 = sin((vUv.x * 10.0 + flow * 1.5) + vUv.y * 3.0) * 0.5 + 0.5;

                float waves = (wave1 * 0.4 + wave2 * 0.35 + wave3 * 0.25);

                vec3 dayColor = mix(uColor1, uColor2, waves);
                vec3 nightColor = mix(uColor1 * 0.08, uColor2 * 0.12, waves);

                float dayFactor = clamp(uIsDay, 0.0, 1.0);
                vec3 finalColor = mix(nightColor, dayColor, dayFactor);

                finalColor *= mix(0.18, 1.0, dayFactor);

                float foam = smoothstep(0.7, 0.9, waves);
                finalColor += vec3(foam * 0.3 * dayFactor);

                float alpha = mix(0.35 + waves * 0.08, 0.75 + waves * 0.15, dayFactor);

                gl_FragColor = vec4(finalColor, alpha);
            }
        `,
        transparent: true,
        side: THREE.DoubleSide
    });
    riverMesh = new THREE.Mesh(riverGeom, riverMaterial);
    riverMesh.rotation.x = -Math.PI / 2;
    riverMesh.rotation.z = Math.PI / 2;
    riverMesh.position.set(riverCenterX, riverCenterY, riverCenterZ);
    riverMesh.receiveShadow = true;
    riverGroup.add(riverMesh);
    const bankMat = new THREE.MeshStandardMaterial({
        color: 0x4a3d2a,
        roughness: 1.0
    });
    [-1, 1].forEach(side => {
        const bankWidth = (side < 0) ? (6 + riverOffsetX) : 6;
        const bankHalf = bankWidth / 2;
        const bankGeom = new THREE.PlaneGeometry(riverLength, bankWidth, riverSegments, 4);
        const bankPositions = bankGeom.attributes.position;
        for (let i = 0; i < bankPositions.count; i++) {
            const x = bankPositions.getX(i);
            const y = bankPositions.getY(i);
            if (side < 0) {
                bankPositions.setY(i, y);
            } else {
                bankPositions.setY(i, y);
            }
            if (side < 0) {
                const t = (bankHalf - y) / bankWidth;
                const bankBaseY = -5;
                const worldZ = riverCenterZ + x;
                const stitchY = samplePlatformHeight(retainingWallOuterFaceX - 0.05, worldZ);
                const riverEdgeY = riverCenterY;
                const targetWorldY = THREE.MathUtils.lerp(stitchY, riverEdgeY, t);
                const localZ = (targetWorldY - bankBaseY) + fractal_brownian_motion(x * 0.10, y * 0.10, 4) * 0.15 * (1.0 - t);
                bankPositions.setZ(i, localZ);
            } else {
                const normalizedY = y / bankHalf;
                const slope = -normalizedY;
                const bankHeight = slope * 3 + fractal_brownian_motion(x * 0.10, y * 0.10, 4) * 0.30;
                bankPositions.setZ(i, bankHeight);
            }
        }
        bankGeom.computeVertexNormals();
        const bank = new THREE.Mesh(bankGeom, bankMat);
        bank.rotation.x = -Math.PI / 2;
        bank.rotation.z = Math.PI / 2;
        const riverNearEdgeX = riverCenterX - riverWidth / 2;
        const riverFarEdgeX  = riverCenterX + riverWidth / 2;
        const bankCenterX = (side < 0)
            ? (riverNearEdgeX - bankHalf)
            : (riverFarEdgeX  + bankHalf);
        bank.position.set(bankCenterX, -5, riverCenterZ);
        bank.receiveShadow = true;
        riverGroup.add(bank);
    });
    const rockMat = new THREE.MeshStandardMaterial({
        color: 0x555555,
        roughness: 0.9
    });
    for (let i = 0; i < 20; i++) {
        const rockSize = 0.5 + pseudoRandom(i * 3.7) * 1.5;
        const rockGeom = new THREE.DodecahedronGeometry(rockSize, 0);
        const rock = new THREE.Mesh(rockGeom, rockMat);
        const zPos = (pseudoRandom(i * 2.3) - 0.5) * riverLength * 0.9;
        const side = pseudoRandom(i * 5.1) > 0.5 ? 1 : -1;
        const xOffset = side * (riverWidth / 2 + pseudoRandom(i * 7.3) * 3);
        rock.position.set(riverCenterX + xOffset, riverCenterY + rockSize * 0.4, riverCenterZ + zPos);
        rock.rotation.set(
            pseudoRandom(i * 1.1) * Math.PI,
            pseudoRandom(i * 2.2) * Math.PI,
            pseudoRandom(i * 3.3) * Math.PI
        );
        rock.castShadow = true;
        riverGroup.add(rock);
    }
    // Boundary tree lines on both river edges.
    // Count scales with river length so longer scenes get more trees.
    const riverTrees = [];
    const boundaryTreeCount = Math.max(10, Math.floor(riverLength / 8));
    const zMin = -riverLength * 0.48;
    const zMax = riverLength * 0.48;
    for (let i = 0; i < boundaryTreeCount; i++) {
        const t = (boundaryTreeCount === 1) ? 0.5 : i / (boundaryTreeCount - 1);
        const jitterZ = (pseudoRandom((i + 1) * 13.7) - 0.5) * 4.0;
        const zPos = THREE.MathUtils.clamp(THREE.MathUtils.lerp(zMin, zMax, t) + jitterZ, zMin, zMax);
        const farEdgeX = riverCenterX + riverWidth * 0.5;
        const bankOffset = 4.2 + pseudoRandom((i + 1) * 17.9) * 2.4;
        const xPos = farEdgeX + bankOffset;
        const baseY = riverCenterY + 2.0 + pseudoRandom((i + 1) * 23.3) * 0.9;
        const rotY = pseudoRandom((i + 1) * 29.1) * Math.PI * 2;
        const scale = 1.35 + pseudoRandom((i + 1) * 31.7) * 1.05;
        riverTrees.push({
            x: xPos,
            y: baseY,
            z: riverCenterZ + zPos,
            s: scale,
            r: rotY,
            canopySx: 1.22,
            canopySy: 1.15,
            canopySz: 1.22
        });
    }
    // Opposite river edge tree line, spanning full river length.
    const nearLineMinZ = riverCenterZ - riverLength * 0.48;
    const nearLineMaxZ = riverCenterZ + riverLength * 0.48;
    const nearLineSpan = nearLineMaxZ - nearLineMinZ;
    if (nearLineSpan > 4) {
        const nearTreeCount = Math.max(10, Math.floor(riverLength / 8));
        for (let i = 0; i < nearTreeCount; i++) {
            const t = (nearTreeCount === 1) ? 0.5 : i / (nearTreeCount - 1);
            const jitterZ = (pseudoRandom((i + 1) * 37.9) - 0.5) * 2.2;
            const worldZ = THREE.MathUtils.clamp(
                THREE.MathUtils.lerp(nearLineMinZ, nearLineMaxZ, t) + jitterZ,
                nearLineMinZ,
                nearLineMaxZ
            );
            const nearEdgeX = riverCenterX - riverWidth * 0.5;
            const bankOffset = 3.8 + pseudoRandom((i + 1) * 41.3) * 2.0;
            const xPos = nearEdgeX - bankOffset;
            const baseY = riverCenterY + 2.1 + pseudoRandom((i + 1) * 43.7) * 0.8;
            const rotY = pseudoRandom((i + 1) * 47.1) * Math.PI * 2;
            const scale = 1.25 + pseudoRandom((i + 1) * 53.3) * 0.9;
            riverTrees.push({
                x: xPos,
                y: baseY,
                z: worldZ,
                s: scale,
                r: rotY,
                canopySx: 1.2,
                canopySy: 1.12,
                canopySz: 1.2
            });
        }
    }
    riverTreeLodField = new RiverTreeLodField(riverTrees);
    riverTreeLodField.build(riverGroup);
    return riverGroup;
}

function rebuildRiver() {
    if (river) scene.remove(river);
    if (foliageField) { scene.remove(foliageField.group); foliageField.dispose(); foliageField = null; }
    river = createRiver(config.riverOffset);
    scene.add(river);
    rebuildFoliage();
    initSpatialGridSystem();
    rebuildSpatialGrid();
    rebuildStaticObstacleGrid();
}

function refreshBuildingLightAngle() {
    if (!sunLight || !moonLight) return;
    const frontCenterZ = BUILDINGS_ZONE.startZ - BUILDINGS_ZONE.buildingDepth * 0.5;
    let focusZ = frontCenterZ;
    let buildingSpan = BUILDINGS_ZONE.buildingDepth;
    if (mainBuildingFootprints && mainBuildingFootprints.length > 0) {
        let minZ = Infinity;
        let maxZ = -Infinity;
        for (let i = 0; i < mainBuildingFootprints.length; i++) {
            const fp = mainBuildingFootprints[i];
            if (!fp) continue;
            minZ = Math.min(minZ, fp.cz - fp.hd);
            maxZ = Math.max(maxZ, fp.cz + fp.hd);
        }
        if (isFinite(minZ) && isFinite(maxZ)) {
            focusZ = (minZ + maxZ) * 0.5;
            buildingSpan = Math.max(BUILDINGS_ZONE.buildingDepth, maxZ - minZ);
        }
    }
    const focusY = platformHeight + Math.max(8, config.buildingHeight * 0.5);
    _lightFocus.set(BUILDINGS_ZONE.centerX, focusY, focusZ);

    if (sunLight.target.parent !== scene) scene.add(sunLight.target);
    if (moonLight.target.parent !== scene) scene.add(moonLight.target);

    sunLight.target.position.copy(_lightFocus);
    sunLight.position.copy(_lightFocus).add(SUN_LIGHT_OFFSET);
    moonLight.target.position.copy(_lightFocus);
    moonLight.position.copy(_lightFocus).add(MOON_LIGHT_OFFSET);

    sunLight.target.updateMatrixWorld(true);
    moonLight.target.updateMatrixWorld(true);
    sunLight.updateMatrixWorld(true);
    moonLight.updateMatrixWorld(true);

    // Keep the shadow projection large enough for regenerated building depth,
    // otherwise edge buildings can fall outside the shadow frustum and over-brighten.
    const shadowExtent = Math.max(150, buildingSpan * 0.75);
    sunLight.shadow.camera.left = -shadowExtent;
    sunLight.shadow.camera.right = shadowExtent;
    sunLight.shadow.camera.top = shadowExtent;
    sunLight.shadow.camera.bottom = -shadowExtent;
    sunLight.shadow.camera.far = Math.max(300, shadowExtent * 3);
    sunLight.shadow.camera.updateProjectionMatrix();

    sunLight.shadow.needsUpdate = true;
}

// Set up light for the scene with the sun and moon directional lights and ambient light
// Allows shadow creation for buildings

function setupLighting() {
    ambientLight = new THREE.AmbientLight(0x404040, 0.5);
    scene.add(ambientLight);
    sunLight = new THREE.DirectionalLight(0xffffff, 1.5);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 512;
    sunLight.shadow.mapSize.height = 512;
    sunLight.shadow.camera.near = 10;
    sunLight.shadow.camera.far = 300;
    sunLight.shadow.camera.left = -150;
    sunLight.shadow.camera.right = 150;
    sunLight.shadow.camera.top = 150;
    sunLight.shadow.camera.bottom = -150;
    scene.add(sunLight);
    moonLight = new THREE.DirectionalLight(0x6688cc, 0.3);
    moonLight.visible = false;
    scene.add(moonLight);
    refreshBuildingLightAngle();
}

function updateLighting(isDay) { // Used in debug to swap light mode
    if (isDay) {
        scene.background = new THREE.Color(0x87ceeb);
        scene.fog = new THREE.Fog(0x87ceeb, 150, 400);
        sunLight.castShadow = true;
        sunLight.intensity = 1.5;
        sunLight.color.setHex(0xffffff);
        ambientLight.intensity = 0.5;
        ambientLight.color.setHex(0x8899aa);
        moonLight.visible = false;
        materials.grass.color.setHex(0x2d5a27);
        materials.gravestone.color.setHex(0x8f8f8f);
        materials.gravestone.emissive.setHex(0x101010);
        materials.gravestone.emissiveIntensity = 0.06;
        if (materials.graveMound) {
            materials.graveMound.color.setHex(0x7a6240);
            materials.graveMound.emissive.setHex(0x0f0a06);
            materials.graveMound.emissiveIntensity = 0.04;
        }
        if (platformSurfaceMat) platformSurfaceMat.color.setHex(0x3d6b35);
        if (platformRetainingWallMat) platformRetainingWallMat.color.setHex(0x5a5a5a);
        renderer.shadowMap.needsUpdate = true;
    } else {
        scene.background = new THREE.Color(0x0a0a1a);
        scene.fog = new THREE.Fog(0x0a0a1a, 80, 300);
        sunLight.castShadow = false;
        sunLight.intensity = 0.1;
        sunLight.color.setHex(0x334466);
        ambientLight.intensity = 0.15;
        ambientLight.color.setHex(0x222244);
        moonLight.visible = true;
        materials.grass.color.setHex(0x1b361a);
        materials.gravestone.color.setHex(0x8b8f98);
        materials.gravestone.emissive.setHex(0x1a1f2a);
        materials.gravestone.emissiveIntensity = 0.2;
        if (materials.graveMound) {
            materials.graveMound.color.setHex(0x66584a);
            materials.graveMound.emissive.setHex(0x1a140f);
            materials.graveMound.emissiveIntensity = 0.09;
        }
        if (platformSurfaceMat) platformSurfaceMat.color.setHex(0x243f23);
        if (platformRetainingWallMat) platformRetainingWallMat.color.setHex(0x3f3f44);
        renderer.shadowMap.needsUpdate = true;
    }
}

function rebuildFoliage() {
    if (foliageField) {
        scene.remove(foliageField.group);
        foliageField.dispose();
        foliageField = null;
    }
    if ((config.treeCount | 0) !== 0 || (config.bushCount | 0) !== 0) {
        foliageField = new FoliageField({
            treeCount: config.treeCount,
            bushCount: config.bushCount
        });
        const g = foliageField.build();
        scene.add(g);
    }
    rebuildStaticObstacleGrid();
}

function buildScene() {
    // Check if objects already exists
    if (cathedral) scene.remove(cathedral);
    if (tents) scene.remove(tents);
    if (graveyard) scene.remove(graveyard);
    if (cathedralYardGround) scene.remove(cathedralYardGround);
    if (greenAndRoad) scene.remove(greenAndRoad);
    if (gardenPaths) scene.remove(gardenPaths);
    if (wall) scene.remove(wall);
    if (platform) scene.remove(platform);
    if (river) scene.remove(river);
    if (groundGroup) scene.remove(groundGroup);

    clearGeometryCache();
    groundGroup = createGroundProcedural();
    groundGroup.position.y = groundLevel;
    ground = groundGroup.userData.surfaceMesh || groundGroup.children[0] || null;
    scene.add(groundGroup);
    platform = createPlatform();
    scene.add(platform);
    stageRaycastTargets = [];
    if (platform && platform.userData && platform.userData.surfaceMesh) stageRaycastTargets.push(platform.userData.surfaceMesh);
    if (ground) stageRaycastTargets.push(ground);
    cathedral = createCathedralProcedural(config.towerHeight);
    cathedral.position.set(CATHEDRAL_LAYOUT.x, platformHeight, CATHEDRAL_LAYOUT.z);
    scene.add(cathedral);
    updateCathedralNoGo();
    river = createRiver(config.riverOffset);
    scene.add(river);
    graveyard = createGraveyard(config.graveCount);
    graveyard.position.y = platformHeight;
    scene.add(graveyard);
    wall = createWall();
    wall.position.y = platformHeight;
    scene.add(wall);
    wall.updateMatrixWorld(true);
    snapWallToStage(wall);
    greenAndRoad = createGreenAndRoad();
    greenAndRoad.position.y = platformHeight;
    scene.add(greenAndRoad);
    cathedralYardGround = createEnclosureGround();
    cathedralYardGround.position.y = platformHeight;
    scene.add(cathedralYardGround);
    tents = createTents(config.tentCount);
    tents.position.y = platformHeight;
    scene.add(tents);
    rebuildBuildings();
    if (oppositeRoadMesh) scene.remove(oppositeRoadMesh);
    oppositeRoadMesh = createOppositeRoad();
    scene.add(oppositeRoadMesh);
    rebuildFoliage();
    initSpatialGridSystem();
    rebuildSpatialGrid();
    updateTentObstacles();
    rebuildNavSystem();
    renderer.shadowMap.needsUpdate = true;
}

function rebuildTents() {
    if (tents) scene.remove(tents);

    tents = createTents(config.tentCount);
    tents.position.y = platformHeight;
    scene.add(tents);
    renderer.shadowMap.needsUpdate = true;
    if (spatialGrid) rebuildSpatialGrid();

    updateTentObstacles();
}

function rebuildGraveyard() {
    if (graveyard) scene.remove(graveyard);

    graveyard = createGraveyard(config.graveCount);
    graveyard.position.y = platformHeight;
    scene.add(graveyard);
    renderer.shadowMap.needsUpdate = true;
    if (spatialGrid) rebuildSpatialGrid();

    rebuildStaticObstacleGrid();
}

function rebuildCathedral() {
    if (cathedral) scene.remove(cathedral);

    cathedral = createCathedralProcedural(config.towerHeight);
    cathedral.position.set(CATHEDRAL_LAYOUT.x, platformHeight, CATHEDRAL_LAYOUT.z);
    scene.add(cathedral);
    renderer.shadowMap.needsUpdate = true;
    updateCathedralNoGo();
    if (spatialGrid) rebuildSpatialGrid();
    rebuildNavSystem();

    rebuildStaticObstacleGrid();
}

export {
    cathedral,
    tents,
    graveyard,
    greenAndRoad,
    wall,
    platform,
    riverMesh,
    riverMaterial,
    foliageField,
    riverTreeLodField,
    greenBuildingFootprints,
    mainBuildingFootprints,
    platformHeight,
    initializeGround,
    buildScene,
    rebuildBuildings,
    rebuildGreenBuildings,
    rebuildGardenPaths,
    rebuildFoliage,
    rebuildTents,
    rebuildGraveyard,
    rebuildCathedral,
    buildSpatialGridDebugView,
    toggleSpatialGridDebug,
    setupLighting,
    updateLighting,
    getWallGateLayout
};
