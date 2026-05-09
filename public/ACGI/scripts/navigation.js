import * as THREE from 'three';
import { scene, camera, config, GREEN_LAYOUT, DIVIDER_WALL, getSceneBounds } from './core.js';
import { platformHeight, cathedral, graveyard, wall, greenAndRoad, platform, riverMesh, tents, foliageField, greenBuildingFootprints, mainBuildingFootprints, getWallGateLayout } from './environment.js';

let spatialGrid = null;

const gridDebug = {
    root: new THREE.Group(),
    lines: null,
    activeCell: null,
    neighbourCells: new THREE.Group(),
    occupiedCells: new THREE.Group(),
};

const UP = new THREE.Vector3(0, 1, 0);
const FORWARD = new THREE.Vector3(0, 0, 1);
const AGENT_CELL_SIZE = 25;
const DRONE_ALT_MIN = 9;
const DRONE_ALT_MAX = 34;

const agentSpatialGrid = new Map();
const agentSpatialUsedKeys = [];

let navSystem = {
    nodesPed: [],
    nodesDrone: [],
    routePed: [],
    routePedVariants: [],
    routeDrone: [],
    arrivePed: 5.0,
    arriveDrone: 10.0,
    steerGainPed: 1.8,
    laneGainPed: 0.9,
    steerGainDrone: 1.6,
    laneGainDrone: 0.85
};

let navDebugGroup = null;

const staticObstacleGrid = new Map();
let staticObstacles = [];
let tentObstacles = [];
const _tmpObsV = new THREE.Vector3();
let staticObstacleVersion = 0;
let cathedralNoGo = null;

// Spatial grid for agent navigation and obstacle avoidance by dividing world into cells

class SpatialGrid {
    constructor({ cellSize, minX, minZ, maxX, maxZ }) {
        this.cellSize = cellSize;
        this.minX = minX;
        this.minZ = minZ;
        this.maxX = maxX;
        this.maxZ = maxZ;
        this.cols = Math.max(1, Math.ceil((maxX - minX) / cellSize));
        this.rows = Math.max(1, Math.ceil((maxZ - minZ) / cellSize));
        this.bucketCount = this.cols * this.rows;
        this.buckets = new Array(this.bucketCount);
        for (let k = 0; k < this.bucketCount; k++) this.buckets[k] = [];
        this.occupied = new Set();
            }
            clear() {
        for (let k = 0; k < this.bucketCount; k++) this.buckets[k].length = 0;
        this.occupied.clear();
            }
            clampCell(i, j) {
        const ci = Math.min(this.cols - 1, Math.max(0, i));
        const cj = Math.min(this.rows - 1, Math.max(0, j));
        return { i: ci, j: cj };
            }
            cellCoordsFromWorld(x, z) {
        const i = Math.floor((x - this.minX) / this.cellSize);
        const j = Math.floor((z - this.minZ) / this.cellSize);
        return this.clampCell(i, j);
            }
            index(i, j) {
        return i + j * this.cols;
            }
            cellCenter(i, j) {
        const x = this.minX + (i + 0.5) * this.cellSize;
        const z = this.minZ + (j + 0.5) * this.cellSize;
        return { x, z };
            }
            insertMesh(mesh) {
        const box = new THREE.Box3().setFromObject(mesh);
        if (!isFinite(box.min.x) || !isFinite(box.min.z) || !isFinite(box.max.x) || !isFinite(box.max.z)) return;
        const a = this.cellCoordsFromWorld(box.min.x, box.min.z);
        const b = this.cellCoordsFromWorld(box.max.x, box.max.z);
        for (let j = a.j; j <= b.j; j++) {
            for (let i = a.i; i <= b.i; i++) {
                const idx = this.index(i, j);
                this.buckets[idx].push(mesh);
                this.occupied.add(idx);
            }
        }
            }
            queryNeighbourhood(x, z, rCells = 1) {
        const { i, j } = this.cellCoordsFromWorld(x, z);
        const out = [];
        for (let dj = -rCells; dj <= rCells; dj++) {
            for (let di = -rCells; di <= rCells; di++) {
                const ii = i + di;
                const jj = j + dj;
                if (ii < 0 || ii >= this.cols || jj < 0 || jj >= this.rows) continue;
                const idx = this.index(ii, jj);
                const bucket = this.buckets[idx];
                if (bucket.length) out.push(...bucket);
            }
        }
        return out;
    }
}

function initSpatialGridSystem() {
    if (spatialGrid) return;
    const bounds = getSceneBounds();
    const worldCenterX = bounds.centerX;
    const worldCenterZ = bounds.centerZ;
    const halfW = bounds.width / 2;
    const halfL = bounds.length / 2;
    const cellSize = config.gridCellSize;

    spatialGrid = new SpatialGrid({
        cellSize,
        minX: worldCenterX - halfW,
        minZ: worldCenterZ - halfL,
        maxX: worldCenterX + halfW,
        maxZ: worldCenterZ + halfL
    });

    const linePoints = [];
    for (let c = 0; c <= spatialGrid.cols; c++) {
        const x = spatialGrid.minX + c * spatialGrid.cellSize;
        linePoints.push(new THREE.Vector3(x, 0, spatialGrid.minZ));
        linePoints.push(new THREE.Vector3(x, 0, spatialGrid.maxZ));
    }

    for (let r = 0; r <= spatialGrid.rows; r++) {
        const z = spatialGrid.minZ + r * spatialGrid.cellSize;
        linePoints.push(new THREE.Vector3(spatialGrid.minX, 0, z));
        linePoints.push(new THREE.Vector3(spatialGrid.maxX, 0, z));
    }

    const lineGeom = new THREE.BufferGeometry().setFromPoints(linePoints);
    const lineMat = new THREE.LineBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.25 });
    gridDebug.lines = new THREE.LineSegments(lineGeom, lineMat);
    gridDebug.root.add(gridDebug.lines);

    const cellPlaneGeom = new THREE.PlaneGeometry(spatialGrid.cellSize, spatialGrid.cellSize);
    const activeMat = new THREE.MeshBasicMaterial({ color: 0xffcc00, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false });
    gridDebug.activeCell = new THREE.Mesh(cellPlaneGeom, activeMat);
    gridDebug.activeCell.rotation.x = -Math.PI / 2;
    gridDebug.root.add(gridDebug.activeCell);

    const neighbourMat = new THREE.MeshBasicMaterial({ color: 0x66ff66, transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false });
    for (let k = 0; k < 8; k++) {
        const m = new THREE.Mesh(cellPlaneGeom, neighbourMat);
        m.rotation.x = -Math.PI / 2;
        gridDebug.neighbourCells.add(m);
    }

    gridDebug.root.add(gridDebug.neighbourCells);
    gridDebug.root.add(gridDebug.occupiedCells);
    gridDebug.root.visible = config.gridDebug;
    gridDebug.neighbourCells.visible = !!config.gridNeighbours;
    gridDebug.occupiedCells.visible = !!config.gridOccupied;
    scene.add(gridDebug.root);
}

function resetSpatialGrid() {
    spatialGrid = null;
}

function rebuildSpatialGrid() {
    if (!spatialGrid) return;
    spatialGrid.clear();
    const insertGroup = (group) => {
        if (!group) return;
        group.updateWorldMatrix(true, true);
        group.traverse((obj) => {
            if (obj.isMesh) spatialGrid.insertMesh(obj);
        });
    };
    insertGroup(platform);
    insertGroup(cathedral);
    insertGroup(graveyard);
    insertGroup(wall);
    insertGroup(greenAndRoad);
    gridDebug.occupiedCells.clear();
    if (config.gridOccupied) {
        const occGeom = new THREE.PlaneGeometry(spatialGrid.cellSize, spatialGrid.cellSize);
        const occMat = new THREE.MeshBasicMaterial({ color: 0x00aaff, transparent: true, opacity: 0.08, side: THREE.DoubleSide, depthWrite: false });
        spatialGrid.occupied.forEach((idx) => {
            const i = idx % spatialGrid.cols;
            const j = Math.floor(idx / spatialGrid.cols);
            const { x, z } = spatialGrid.cellCenter(i, j);
            const m = new THREE.Mesh(occGeom, occMat);
            m.rotation.x = -Math.PI / 2;
            m.position.set(x, platformHeight + 0.03, z);
            gridDebug.occupiedCells.add(m);
        });
    }
    gridDebug.lines.position.y = platformHeight + 0.03;
}

function updateSpatialGridDebug() {
    if (!spatialGrid || !config.gridDebug) return;
    const { i, j } = spatialGrid.cellCoordsFromWorld(camera.position.x, camera.position.z);
    const { x, z } = spatialGrid.cellCenter(i, j);
    gridDebug.activeCell.position.set(x, platformHeight + 0.031, z);
    gridDebug.neighbourCells.visible = !!config.gridNeighbours;
    if (config.gridNeighbours) {
        const offsets = [
            [-1,-1],[0,-1],[1,-1],
            [-1, 0],       [1, 0],
            [-1, 1],[0, 1],[1, 1]
        ];
        for (let k = 0; k < 8; k++) {
            const di = offsets[k][0], dj = offsets[k][1];
            const ii = i + di, jj = j + dj;
            const mesh = gridDebug.neighbourCells.children[k];
            if (ii < 0 || ii >= spatialGrid.cols || jj < 0 || jj >= spatialGrid.rows) {
                mesh.visible = false;
                continue;
            }
            mesh.visible = true;
            const c = spatialGrid.cellCenter(ii, jj);
            mesh.position.set(c.x, platformHeight + 0.0305, c.z);
        }
    } else {
        for (const m of gridDebug.neighbourCells.children) m.visible = false;
    }
    gridDebug.occupiedCells.visible = !!config.gridOccupied;
}

function packCellKey(cx, cz) {
    return ((cx & 0xffff) << 16) | (cz & 0xffff);
}

function clearAgentSpatialGrid() {
    for (let i = 0; i < agentSpatialUsedKeys.length; i++) {
        const k = agentSpatialUsedKeys[i];
        const b = agentSpatialGrid.get(k);
        if (b) b.length = 0;
    }
    agentSpatialUsedKeys.length = 0;
}

function getBucketForKey(k) {
    let b = agentSpatialGrid.get(k);
    if (!b) {
        b = [];
        agentSpatialGrid.set(k, b);
    }
    if (b.length === 0) agentSpatialUsedKeys.push(k);
    return b;
}

function disposeObject3D(obj) {
    if (!obj) return;
    if (obj.geometry) obj.geometry.dispose?.();
    if (obj.material) {
        if (Array.isArray(obj.material)) obj.material.forEach(m => m && m.dispose?.());
        else obj.material.dispose?.();
    }
}

function ensureNavDebugGroup() {
    if (!scene) return;
    if (!navDebugGroup) {
        navDebugGroup = new THREE.Group();
        navDebugGroup.name = 'NavDebug';
        navDebugGroup.visible = !!config.debugNav;
        scene.add(navDebugGroup);
    }
}

function rebuildNavDebug() {
    ensureNavDebugGroup();
    if (!navDebugGroup) return;
    while (navDebugGroup.children.length) {
        const c = navDebugGroup.children.pop();
        navDebugGroup.remove(c);
        disposeObject3D(c);
    }
    navDebugGroup.visible = !!config.debugNav;
    if (!config.debugNav) return;
    const mkNode = (p, size, color) => {
        const g = new THREE.SphereGeometry(size, 10, 10);
        const m = new THREE.MeshBasicMaterial({ color });
        const s = new THREE.Mesh(g, m);
        s.position.copy(p);
        s.position.y += 0.15;
        navDebugGroup.add(s);
    };
    const addRoute = (nodes, route, color, arrowLen) => {
        if (!nodes || !route || !route.length) return;
        const seg = [];
        for (let i = 0; i < route.length; i++) {
            const a = nodes[route[i]];
            const b = nodes[route[(i + 1) % route.length]];
            if (!a || !b) continue;
            seg.push(a.x, a.y + 0.1, a.z, b.x, b.y + 0.1, b.z);
            const dir = new THREE.Vector3(b.x - a.x, b.y - a.y, b.z - a.z);
            const len = dir.length();
            if (len > 1e-4) {
                dir.multiplyScalar(1.0 / len);
                for (const t of [0.3, 0.7]) {
                    const pos = new THREE.Vector3(
                        a.x + (b.x - a.x) * t,
                        a.y + 0.35,
                        a.z + (b.z - a.z) * t
                    );
                    const al = Math.min(arrowLen, len * 0.45);
                    const arrow = new THREE.ArrowHelper(dir, pos, al, color, 1.4, 0.9);
                    navDebugGroup.add(arrow);
                }
            }
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(seg, 3));
        const line = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color }));
        navDebugGroup.add(line);
    };
    const addFootprintAabbs = (footprints, color, y) => {
        if (!footprints || !footprints.length) return;
        const seg = [];
        for (let i = 0; i < footprints.length; i++) {
            const fp = footprints[i];
            if (!fp) continue;
            const minX = fp.cx - fp.hw;
            const maxX = fp.cx + fp.hw;
            const minZ = fp.cz - fp.hd;
            const maxZ = fp.cz + fp.hd;
            seg.push(minX, y, minZ, maxX, y, minZ);
            seg.push(maxX, y, minZ, maxX, y, maxZ);
            seg.push(maxX, y, maxZ, minX, y, maxZ);
            seg.push(minX, y, maxZ, minX, y, minZ);
        }
        if (!seg.length) return;
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(seg, 3));
        const m = new THREE.LineBasicMaterial({
            color,
            transparent: true,
            opacity: 0.9
        });
        navDebugGroup.add(new THREE.LineSegments(g, m));
    };
    if (navSystem.nodesPed && navSystem.nodesPed.length) {
        for (let i = 0; i < navSystem.nodesPed.length; i++) {
            const p = navSystem.nodesPed[i];
            if (!p) continue;
            mkNode(p, 0.55, 0x00d4ff);
        }
    }
    if (navSystem.nodesDrone && navSystem.nodesDrone.length) {
        for (let i = 0; i < navSystem.nodesDrone.length; i++) {
            const p = navSystem.nodesDrone[i];
            if (!p) continue;
            mkNode(p, 0.65, 0xffd400);
        }
    }
    if (navSystem.routePedVariants && navSystem.routePedVariants.length) {
        const colors = [0x00ff66, 0x66aaff, 0xff66cc];
        for (let i = 0; i < navSystem.routePedVariants.length; i++) {
            addRoute(navSystem.nodesPed, navSystem.routePedVariants[i], colors[i % colors.length], 7);
        }
    } else {
        addRoute(navSystem.nodesPed, navSystem.routePed, 0x66aaff, 7);
    }
    addRoute(navSystem.nodesDrone, navSystem.routeDrone, 0xffaa00, 12);
    addFootprintAabbs(greenBuildingFootprints, 0x66ff99, platformHeight + 0.12);
}

function rebuildNavSystem() {
    const entrance = new THREE.Vector3(0, platformHeight + 0.5, -20);
    if (cathedral) {
        const bb = new THREE.Box3().setFromObject(cathedral);
        const cx = (bb.min.x + bb.max.x) * 0.5;
        entrance.set(cx, platformHeight + 0.5, bb.min.z - 8);
    }
    const wallLayout = getWallGateLayout();
    const green = new THREE.Vector3(GREEN_LAYOUT.centerX, platformHeight + 0.5, GREEN_LAYOUT.centerZ);
    const graveFront = new THREE.Vector3(0, platformHeight + 0.5, 20);
    const graveMid = new THREE.Vector3(0, platformHeight + 0.5, 32);
    const graveBack = new THREE.Vector3(0, platformHeight + 0.5, 42);
    const wallZ = DIVIDER_WALL.z;
    const gateL = new THREE.Vector3(DIVIDER_WALL.gateXs[0], platformHeight + 0.5, wallZ);
    const gateM = new THREE.Vector3(DIVIDER_WALL.gateXs[1], platformHeight + 0.5, wallZ);
    const gateR = new THREE.Vector3(DIVIDER_WALL.gateXs[2], platformHeight + 0.5, wallZ);
    const midG = new THREE.Vector3(0, platformHeight + 0.5, (green.z + wallZ) * 0.5);
    const frontGate = new THREE.Vector3(wallLayout.frontGateX, platformHeight + 0.5, wallLayout.enclosure.minZ);
    const cornerGateIn = new THREE.Vector3(wallLayout.cornerGateX, platformHeight + 0.5, wallLayout.enclosure.minZ + 1.8);
    const cornerGateOut = new THREE.Vector3(wallLayout.cornerGateX, platformHeight + 0.5, wallLayout.enclosure.minZ - 8.0);
    navSystem.nodesPed = [green, midG, gateL, gateM, gateR, graveBack, graveMid, graveFront, frontGate, entrance, cornerGateIn, cornerGateOut];
    const routeL = [0, 1, 2, 5, 6, 7, 8, 9, 8, 7, 6, 5, 2, 1];
    const routeM = [0, 1, 3, 5, 6, 7, 8, 9, 8, 7, 6, 5, 3, 1];
    const routeR = [0, 1, 4, 5, 6, 7, 8, 9, 8, 7, 6, 5, 4, 1];
    const routeSide = [0, 1, 2, 5, 6, 7, 10, 11, 9, 11, 10, 7, 6, 5, 2, 1];
    navSystem.routePedVariants = [routeL, routeM, routeR, routeSide];
    navSystem.routePed = routeM;
    const alt1 = 18, alt2 = 26;
    const droneBounds = getSceneBounds();
    const dFarNW = new THREE.Vector3(droneBounds.centerX - droneBounds.width * 0.45, alt2, droneBounds.centerZ - droneBounds.length * 0.35);
    const dFarSE = new THREE.Vector3(droneBounds.centerX + droneBounds.width * 0.40, alt2, droneBounds.centerZ + droneBounds.length * 0.35);
    const dGreen = green.clone(); dGreen.y = alt1;
    const dGrave = graveMid.clone(); dGrave.y = alt1;
    const dEntrance = entrance.clone(); dEntrance.y = alt2;
    const dRiver = new THREE.Vector3(droneBounds.centerX + droneBounds.width * 0.42, alt2, droneBounds.centerZ);
    navSystem.nodesDrone = [dFarNW, dGreen, dRiver, dEntrance, dGrave, dFarSE];
    navSystem.routeDrone = [0, 1, 2, 3, 4, 5];
    if (typeof rebuildNavDebug === 'function') rebuildNavDebug();
}

function updateCathedralNoGo() {
    cathedralNoGo = null;
    if (!cathedral) return;
    const bb = new THREE.Box3().setFromObject(cathedral);
    const pad = 1.2;
    cathedralNoGo = {
        minX: bb.min.x - pad,
        maxX: bb.max.x + pad,
        minZ: bb.min.z - pad,
        maxZ: bb.max.z + pad,
        maxY: bb.max.y + 1.5
    };
}

function addStaticObstacleAt(x, y, z, radius, mask = 'both', height = 6) {
    staticObstacles.push({
        position: new THREE.Vector3(x, y, z),
        radius,
        mask,
        height
    });
}

function addStaticObstacle(x, z, radius, mask = 'both', height = 6) {
    addStaticObstacleAt(x, platformHeight + 0.5, z, radius, mask, height);
}

function addRectObstaclePerimeter(minX, maxX, minZ, maxZ, step, radius, mask = 'both', height = 6) {
    if (!isFinite(minX) || !isFinite(maxX) || !isFinite(minZ) || !isFinite(maxZ)) return;
    if (minX >= maxX || minZ >= maxZ) return;
    const s = Math.max(0.8, step || 2.6);
    for (let z = minZ; z <= maxZ; z += s) {
        addStaticObstacle(minX, z, radius, mask, height);
        addStaticObstacle(maxX, z, radius, mask, height);
    }
    for (let x = minX; x <= maxX; x += s) {
        addStaticObstacle(x, minZ, radius, mask, height);
        addStaticObstacle(x, maxZ, radius, mask, height);
    }
}

function addRectObstacleFill(minX, maxX, minZ, maxZ, step, radius, mask = 'both', height = 6, inset = 0) {
    let ix0 = minX + inset;
    let ix1 = maxX - inset;
    let iz0 = minZ + inset;
    let iz1 = maxZ - inset;
    if (ix0 >= ix1 || iz0 >= iz1) {
        ix0 = minX;
        ix1 = maxX;
        iz0 = minZ;
        iz1 = maxZ;
    }
    if (!isFinite(ix0) || !isFinite(ix1) || !isFinite(iz0) || !isFinite(iz1)) return;
    if (ix0 >= ix1 || iz0 >= iz1) return;
    const s = Math.max(1.0, step || 3.0);
    for (let z = iz0; z <= iz1; z += s) {
        for (let x = ix0; x <= ix1; x += s) {
            addStaticObstacle(x, z, radius, mask, height);
        }
    }
    addStaticObstacle((ix0 + ix1) * 0.5, (iz0 + iz1) * 0.5, radius, mask, height);
}

function updateTentObstacles() {
    tentObstacles = [];
    if (!tents) return;
    tents.children.forEach(tent => {
        tentObstacles.push({
            position: tent.position,
            radius: 3.5
        });
    });
    rebuildStaticObstacleGrid();
}

function rebuildStaticObstacleGrid() {
    updateCathedralNoGo();
    staticObstacleGrid.clear();
    staticObstacles = [];
    if (cathedral) {
        const bb = new THREE.Box3().setFromObject(cathedral);
        addRectObstaclePerimeter(bb.min.x - 2.5, bb.max.x + 2.5, bb.min.z - 2.5, bb.max.z + 2.5, 2.6, 3.9, 'both', 999);
    }
    
    const wallLayout = getWallGateLayout();
    const enclosure = wallLayout.enclosure;
    const gateHalf = wallLayout.gateWidth * 0.5 + 0.5;
    const cornerGateHalf = wallLayout.cornerGateWidth * 0.5 + 0.5;
    const halfT = Math.max(0.85, DIVIDER_WALL.thickness * 0.5 + 0.7);
    const wallHeight = DIVIDER_WALL.height + 1.8;
    const wallStep = 1.7;
    const wallRadius = 1.75;
    const splitSegments = (start, end, gaps = []) => {
        const clipped = gaps
            .map(([a, b]) => [Math.max(start, a), Math.min(end, b)])
            .filter(([a, b]) => b > a + 0.45)
            .sort((a, b) => a[0] - b[0]);
        const segments = [];
        let cursor = start;
        for (let i = 0; i < clipped.length; i++) {
            const [g0, g1] = clipped[i];
            if (g0 > cursor + 0.45) segments.push([cursor, g0]);
            cursor = Math.max(cursor, g1);
        }
        if (cursor < end - 0.45) segments.push([cursor, end]);
        return segments;
    };
    const addHorizontalWall = (z, x0, x1) => {
        if (x1 <= x0 + 0.45) return;
        addRectObstaclePerimeter(x0, x1, z - halfT, z + halfT, wallStep, wallRadius, 'both', wallHeight);
    };
    const addVerticalWall = (x, z0, z1) => {
        if (z1 <= z0 + 0.45) return;
        addRectObstaclePerimeter(x - halfT, x + halfT, z0, z1, wallStep, wallRadius, 'both', wallHeight);
    };
    const backGaps = wallLayout.backGateXs.map((gx) => [gx - gateHalf, gx + gateHalf]);
    const frontGaps = [
        [wallLayout.frontGateX - gateHalf, wallLayout.frontGateX + gateHalf],
        [wallLayout.cornerGateX - cornerGateHalf, wallLayout.cornerGateX + cornerGateHalf]
    ];
    const leftGaps = [];
    const backSegments = splitSegments(enclosure.minX, enclosure.maxX, backGaps);
    const frontSegments = splitSegments(enclosure.minX, enclosure.maxX, frontGaps);
    const leftSegments = splitSegments(enclosure.minZ, enclosure.maxZ, leftGaps);
    for (let i = 0; i < backSegments.length; i++) {
        addHorizontalWall(enclosure.maxZ, backSegments[i][0], backSegments[i][1]);
    }
    for (let i = 0; i < frontSegments.length; i++) {
        addHorizontalWall(enclosure.minZ, frontSegments[i][0], frontSegments[i][1]);
    }
    for (let i = 0; i < leftSegments.length; i++) {
        addVerticalWall(enclosure.minX, leftSegments[i][0], leftSegments[i][1]);
    }
    addVerticalWall(enclosure.maxX, enclosure.minZ, enclosure.maxZ);

    
    if (graveyard) {
        for (let i = 0; i < graveyard.children.length; i++) {
            const c = graveyard.children[i];
            if (c && c.type === 'Group' && c.children && c.children.length) {
                c.getWorldPosition(_tmpObsV);
                addStaticObstacle(_tmpObsV.x, _tmpObsV.z, 1.4, 'both', 2);
            }
        }
    }

    if (foliageField && foliageField.trees && foliageField.trees.length) {
        for (let i = 0; i < foliageField.trees.length; i++) {
            const t = foliageField.trees[i];
            const s = t.s || 1.0;
            const r = 0.85 * (0.7 + 0.3 * s);
            addStaticObstacle(t.x, t.z, r, 'both', 7.5);
        }
    }

    if (mainBuildingFootprints && mainBuildingFootprints.length) {
        const step = 2.4;
        const r = 2.25;
        for (let i = 0; i < mainBuildingFootprints.length; i++) {
            const fp = mainBuildingFootprints[i];
            if (!fp) continue;
            const wallHeight = (fp.h !== undefined) ? fp.h : config.buildingHeight;
            const roofPitch = (fp.roofPitch !== undefined) ? fp.roofPitch : (wallHeight * 0.4);
            const totalHeight = (fp.hTotal !== undefined) ? fp.hTotal : (wallHeight + roofPitch);
            const bHeight = Math.max(10, totalHeight + 2);
            addRectObstaclePerimeter(fp.cx - fp.hw, fp.cx + fp.hw, fp.cz - fp.hd, fp.cz + fp.hd, step, r, 'both', bHeight);
            addRectObstacleFill(
                fp.cx - fp.hw,
                fp.cx + fp.hw,
                fp.cz - fp.hd,
                fp.cz + fp.hd,
                3.2,
                1.9,
                'both',
                bHeight + 3.0,
                1.0
            );
        }
    }

    if (greenBuildingFootprints && greenBuildingFootprints.length) {
        const step = 2.2;
        const r = 1.9;
        for (let i = 0; i < greenBuildingFootprints.length; i++) {
            const fp = greenBuildingFootprints[i];
            if (!fp) continue;
            const wallHeight = (fp.h || config.buildingHeight);
            const roofPitch = (fp.roofPitch !== undefined) ? fp.roofPitch : (wallHeight * 0.45);
            const totalHeight = (fp.hTotal !== undefined) ? fp.hTotal : (wallHeight + roofPitch);
            const greenHeight = Math.max(10, totalHeight + 1.5);
            addRectObstaclePerimeter(
                fp.cx - fp.hw,
                fp.cx + fp.hw,
                fp.cz - fp.hd,
                fp.cz + fp.hd,
                step,
                r,
                'both',
                greenHeight
            );
            addRectObstacleFill(
                fp.cx - fp.hw,
                fp.cx + fp.hw,
                fp.cz - fp.hd,
                fp.cz + fp.hd,
                2.8,
                1.6,
                'both',
                greenHeight + 2.5,
                0.8
            );
        }
    }

    if (riverMesh && riverMesh.geometry && riverMesh.geometry.attributes && riverMesh.geometry.parameters) {
        const geom = riverMesh.geometry;
        const posAttr = geom.attributes.position;
        const wSeg = geom.parameters.widthSegments || 64;
        const hSeg = geom.parameters.heightSegments || 16;
        const stride = wSeg + 1;
        const stepIx = 2;
        const r = 2.6;
        for (let ix = 0; ix <= wSeg; ix += stepIx) {
            const idxA = 0 * stride + ix;
            const idxB = hSeg * stride + ix;
            _tmpObsV.set(posAttr.getX(idxA), posAttr.getY(idxA), posAttr.getZ(idxA));
            riverMesh.localToWorld(_tmpObsV);
            addStaticObstacleAt(_tmpObsV.x, _tmpObsV.y, _tmpObsV.z, r, 'both', 2);
            _tmpObsV.set(posAttr.getX(idxB), posAttr.getY(idxB), posAttr.getZ(idxB));
            riverMesh.localToWorld(_tmpObsV);
            addStaticObstacleAt(_tmpObsV.x, _tmpObsV.y, _tmpObsV.z, r, 'both', 2);
        }
    }

    if (tentObstacles && tentObstacles.length) {
        for (let i = 0; i < tentObstacles.length; i++) {
            const t = tentObstacles[i];
            addStaticObstacle(t.position.x, t.position.z, t.radius, 'both', 5);
        }
    }

    for (let i = 0; i < staticObstacles.length; i++) {
        const o = staticObstacles[i];
        const cellX = Math.floor(o.position.x / AGENT_CELL_SIZE);
        const cellZ = Math.floor(o.position.z / AGENT_CELL_SIZE);
        const key = packCellKey(cellX, cellZ);
        let b = staticObstacleGrid.get(key);
        if (!b) { b = []; staticObstacleGrid.set(key, b); }
        b.push(o);
    }
    staticObstacleVersion++;
}

export {
    spatialGrid,
    gridDebug,
    initSpatialGridSystem,
    resetSpatialGrid,
    rebuildSpatialGrid,
    updateSpatialGridDebug,
    UP,
    FORWARD,
    AGENT_CELL_SIZE,
    DRONE_ALT_MIN,
    DRONE_ALT_MAX,
    packCellKey,
    agentSpatialGrid,
    clearAgentSpatialGrid,
    getBucketForKey,
    navDebugGroup,
    rebuildNavDebug,
    rebuildNavSystem,
    staticObstacleGrid,
    staticObstacleVersion,
    rebuildStaticObstacleGrid,
    updateCathedralNoGo,
    cathedralNoGo,
    updateTentObstacles
};
