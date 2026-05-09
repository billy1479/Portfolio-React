import * as THREE from 'three';

import {
    scene,
    camera,
    renderer,
    controls,
    raycaster,
    postProcessing,
    config,
    GREEN_LAYOUT,
    DIVIDER_WALL,
    BUILDINGS_ZONE,
    OPPOSITE_ROAD,
    clock
} from './core.js';

import {
    cathedral,
    platformHeight,
    riverMaterial,
    foliageField,
    riverTreeLodField,
    mainBuildingFootprints,
    greenBuildingFootprints,
    getWallGateLayout
} from './environment.js';

import {
    UP,
    FORWARD,
    AGENT_CELL_SIZE,
    DRONE_ALT_MIN,
    DRONE_ALT_MAX,
    packCellKey,
    agentSpatialGrid,
    clearAgentSpatialGrid,
    getBucketForKey,
    staticObstacleGrid,
    staticObstacleVersion,
    cathedralNoGo,
    updateSpatialGridDebug
} from './navigation.js';

import {
    createAgentDebugSystem
} from './debug.js';

const PEDESTRIAN_BASE_HEIGHT = 1.4;
const PEDESTRIAN_SCALE_TO_WALL = Math.max(1.0, DIVIDER_WALL.height / PEDESTRIAN_BASE_HEIGHT);
const _rayOrigin = new THREE.Vector3();
const _rayDir = new THREE.Vector3();
const _rayHit = new THREE.Vector3();
const _rayToObstacle = new THREE.Vector3();
const _raySphere = new THREE.Sphere();
const _droneAltitudeBounds = new THREE.Box3();
const BUILDING_COLLISION_PADDING = 0.65;
const BUILDING_DRONE_ROOF_CLEARANCE = 2.2;
let _cachedWallLayout = null;
let raycastTargets = [];
let raycastTargetsVersion = -1;
let raycastFrameIndex = 0;
let droneAltitudeCeiling = DRONE_ALT_MAX;
let droneAltitudeCeilingVersion = -1;
const agentDebug = createAgentDebugSystem(scene);
const _fkAxisX = new THREE.Vector3(1, 0, 0);
const _fkAxisZ = new THREE.Vector3(0, 0, 1);
const FK_DESIGN_SCALE = 0.2;
const FK_PELVIS_HEIGHT = (2.0 + 1.0) * FK_DESIGN_SCALE;
// Approximate local-space height of the skinned pedestrian rig.
const PEDESTRIAN_SKINNED_HEIGHT_ESTIMATE = 8.35 * FK_DESIGN_SCALE;
const DRONE_WING_BASE_SCALE = 0.95;

let agentSystem = {
    pedestrians: [],
    drones: [],
    pedestrianInstanced: null,
    droneInstanced: null,
    droneWingLeftUpperInstanced: null,
    droneWingLeftLowerInstanced: null,
    droneWingRightUpperInstanced: null,
    droneWingRightLowerInstanced: null,
    pedestrianSoA: {
        count: 0,
        positions: null,
        velocities: null,
        speeds: null,
        walkCycles: null,
        skeletons: []
    },
    droneSoA: {
        count: 0,
        positions: null,
        velocities: null,
        speeds: null,
        skeletons: []
    }
};

let agentLightPools = {
    pedestrians: [],
    drones: []
};

const AGENT_LIGHT_POOL_SIZES = {
    pedestrians: 12,
    drones: 12
};

const _lightSortBuf = { pedestrians: [], drones: [] };
const _lodAnimatedMaterials = [];

const agentLOD = {
    NEAR: 0,
    MID: 1,
    FAR: 2,
    pedestrianLevels: [],
    droneLevels: [],
    pedestrianMid: null,
    pedestrianFar: null,
    droneMid: null,
    droneFar: null,
    pedestrianMidScale: 1.0,
    pedestrianFarScale: 1.0,
    droneMidScale: 1.0,
    droneFarScale: 1.0,
    pedestrianBillboardTex: null,
    droneBillboardTex: null,
    pedestrianCounts: { near: 0, mid: 0, far: 0 },
    droneCounts: { near: 0, mid: 0, far: 0 },
    _dummy: new THREE.Object3D(),
    _color: new THREE.Color(),
    stats: {
        nearAgents: 0,
        midAgents: 0,
        farAgents: 0
    }
};

const LBS_POOL_SIZE = 24;
const LBS_POOL_DIST_FRACTION = 0.55;
const LBS_FADE_RATE = 0.067;
const skinnedPool = {
    meshes: [],
    activeCount: 0,
    assignments: [],
    assignmentSet: new Set(),
    _sortBuffer: []
};
const PEDESTRIAN_SKIN_TONES = [0xFFDBAC, 0xF1C27D, 0xE0AC69, 0xC68642, 0x8D5524];
const PEDESTRIAN_CLOTHING_COLS = [0x1565C0, 0xC62828, 0x2E7D32, 0x6A1B9A, 0xE65100, 0x00695C, 0x37474F];
const PEDESTRIAN_PANTS_COL = 0x212121; 

const _lbsPos = new THREE.Vector3();
const _lbsQuat = new THREE.Quaternion();
const _lbsBoneDir = new THREE.Vector3();
const _lbsBlendPos = new THREE.Vector3();
const _lbsBlendQuat = new THREE.Quaternion();
const _lbsTmpPos = new THREE.Vector3();
const _lbsTmpPos2 = new THREE.Vector3();
const _lbsInvGroupQuat = new THREE.Quaternion();
const _lbsYAxis = new THREE.Vector3(0, 1, 0);
const _lodInterleaveMat = new THREE.Matrix4();
const _lodInterleaveScale = new THREE.Vector3();
const _droneVelDir = new THREE.Vector3();
const _droneForwardDir = new THREE.Vector3();
const _droneWingMat = new THREE.Matrix4();
const _droneWingScale = new THREE.Vector3(DRONE_WING_BASE_SCALE, DRONE_WING_BASE_SCALE, DRONE_WING_BASE_SCALE);
const _ikTip = new THREE.Vector3();
const _ikToTip = new THREE.Vector3();
const _ikToTarget = new THREE.Vector3();
const _ikInvParent = new THREE.Quaternion();
const _ikQ = new THREE.Quaternion();
const _ikEuler = new THREE.Euler();
const _wingTargetL = new THREE.Vector3();
const _wingTargetR = new THREE.Vector3();
const _wingUpW = new THREE.Vector3();
const _wingDirW = new THREE.Vector3();

const mouseControl = {
    enabled: false,
    worldPos: new THREE.Vector3(),
    screenPos: new THREE.Vector2(),
    raycaster: new THREE.Raycaster(),
    targetPlane: new THREE.Plane(new THREE.Vector3(0, 1, 0), 0),
    targetPoint: new THREE.Vector3(),
    init: function() {
        document.addEventListener('mousemove', (e) => this.onMouseMove(e));
    },
    onMouseMove: function(event) {
        if (!this.enabled) return;
        this.screenPos.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.screenPos.y = -(event.clientY / window.innerHeight) * 2 + 1;
        this.raycaster.setFromCamera(this.screenPos, camera);
        this.raycaster.ray.intersectPlane(this.targetPlane, this.targetPoint);
        this.worldPos.copy(this.targetPoint);
    },
    getTargetPosition: function() { return this.worldPos; },
    setEnabled: function(enabled) { this.enabled = enabled; }
};

let mouseCrosshair = null;
let frameCount = 0;
let lastFpsUpdate = 0;
let tick = 0;
const FIXED_DT = 1 / 60;
let accumulator = 0;
const RENDER_INTERVAL = 1 / 60;
let renderAccumulator = 0;
let lastTimestamp = 0;
const MAX_SIM_STEPS_PER_FRAME = 1;
const LOD_RECALC_INTERVAL = 3;

class Bone {
    constructor(length, name = '') {
        this.name = name;
        this.length = length;
        this.dir = new THREE.Vector3(0, 1, 0);
        this.localOffset = new THREE.Vector3();
        this.bindRotation = new THREE.Quaternion();
        this.localRotation = new THREE.Quaternion();
        this.position = new THREE.Vector3();
        this.rotation = new THREE.Quaternion();
        this.parent = null;
        this.children = [];
    }
    addChild(bone) {
        bone.parent = this;
        this.children.push(bone);
    }
    setBindFromAxisAngle(axis, angle) {
        this.bindRotation.setFromAxisAngle(axis, angle);
        this.localRotation.copy(this.bindRotation);
    }
    setAnimFromAxisAngle(axis, angle) {
        const q = Bone._tmpQuat.setFromAxisAngle(axis, angle);
        this.localRotation.copy(this.bindRotation).multiply(q);
    }
    static _tmpQuat = new THREE.Quaternion();
    static _offset = new THREE.Vector3();
    updateWorldTransform() {
        if (this.parent) {
            this.rotation.copy(this.parent.rotation).multiply(this.localRotation);
            Bone._offset
                .copy(this.parent.dir).multiplyScalar(this.parent.length)
                .add(this.localOffset)
                .applyQuaternion(this.parent.rotation);
            this.position.copy(this.parent.position).add(Bone._offset);
        } else {
            this.rotation.copy(this.localRotation);
        }
        for (let child of this.children) {
            child.updateWorldTransform();
        }
    }
}

class Skeleton {
    constructor(rootPosition) {
        this.rootPosition = rootPosition.clone();
        this.bones = [];
        this.boneMap = new Map();
    }
    addBone(bone, parentName = null) {
        if (parentName && this.boneMap.has(parentName)) {
            this.boneMap.get(parentName).addChild(bone);
        } else if (!parentName) {
            this._rootBone = bone;
        }
        this.bones.push(bone);
        if (bone.name) this.boneMap.set(bone.name, bone);
    }
    getRootBone() {
        return this._rootBone || this.bones[0];
    }
    getBone(name) {
        return this.boneMap.get(name);
    }
    update() {
        const root = this.getRootBone();
        if (root) {
            root.position.copy(this.rootPosition);
            root.updateWorldTransform();
        }
    }
}

class Agent {
    constructor(type, position, speed, options = {}) {
        this.type = type;
        this.position = position.clone();
        this.velocity = new THREE.Vector3();
        this.speed = speed;
        this.acceleration = new THREE.Vector3();
        this.navRoute = null;
        this.navStep = 0;
        this.rotation = new THREE.Quaternion();
        this.baseScale = options.baseScale ?? 1.0;
        this.scale = new THREE.Vector3(this.baseScale, this.baseScale, this.baseScale);
        this.bankAngle = 0;
        this.compressionFactor = 1.0;
        this.reachTarget = new THREE.Vector3();
        this.targetDistance = 0;
        this.separationForce = new THREE.Vector3();
        this.alignmentForce = new THREE.Vector3();
        this.cohesionForce = new THREE.Vector3();
        this.walkCycle = 0;
        this.time = Math.random() * Math.PI * 2;
        this.hoverPhase = Math.random() * Math.PI * 2;
        this.hoverAmp = 0.6 + Math.random() * 0.9;
        this._tmpV1 = new THREE.Vector3();
        this._tmpV2 = new THREE.Vector3();
        this._tmpV3 = new THREE.Vector3();
        this._tmpQ1 = new THREE.Quaternion();
        this._matrix = new THREE.Matrix4();
        this._raycastPhase = (Math.random() * 8) | 0;
    }

    update() {
        throw new Error('Agent.update() must be implemented by subclasses');
    }

    // Clears accumulated forces and stores dt for force->acc conversion.
    beginSteeringStep(dt) {
        this._steeringDt = Math.max(1e-4, dt);
        this.acceleration.set(0, 0, 0);
    }

    applyForce(force) {
        // acc += force (assuming mass = 1, force = acceleration).
        this.acceleration.add(force);
    }

    // Canonical Reynolds steering force for agents

    computeSteeringForce(vDesiredX, vDesiredY, vDesiredZ, maxForce) {
        const dvx = vDesiredX - this.velocity.x;
        const dvy = vDesiredY - this.velocity.y;
        const dvz = vDesiredZ - this.velocity.z;
        const lenSq = dvx * dvx + dvy * dvy + dvz * dvz;
        if (lenSq < 1e-8) return;
        const len = Math.sqrt(lenSq);
        const scale = Math.min(maxForce, len) / len;
        this.acceleration.x += dvx * scale;
        this.acceleration.y += dvy * scale;
        this.acceleration.z += dvz * scale;
    }

    applyVelocityDeltaComponents(dx, dy, dz) {
        // Converts a desired delta-velocity into an equivalent acceleration for this timestep.
        const invDt = 1.0 / (this._steeringDt || 1.0);
        this.acceleration.x += dx * invDt;
        this.acceleration.y += dy * invDt;
        this.acceleration.z += dz * invDt;
    }

    getPlannedVelocity(out = this._tmpV1) {
        const dt = this._steeringDt || 0;
        out.copy(this.velocity);
        if (dt > 0) out.addScaledVector(this.acceleration, dt);
        return out;
    }

    integrateSteering(dt) {
        // Acceleration is reset to zero after integration so forces don't compound across ticks.
        this.velocity.addScaledVector(this.acceleration, dt);
        this.position.addScaledVector(this.velocity, dt);
        this.acceleration.set(0, 0, 0);
    }

    // Queueing via forward-dot "ahead" test + braking strength vs distance.

    applyQueueBraking(dynamicGrid, brakeRadius) {
        if (!dynamicGrid || brakeRadius <= 0) return;
        const isDrone = (this.type === 'drone');
        const aheadDotThreshold = THREE.MathUtils.clamp(config.queueAheadDotThreshold ?? 0.35, 0, 0.99);
        const vNow = this.getPlannedVelocity(this._tmpV1);
        if (!isDrone) vNow.y = 0;
        const speedSq = vNow.lengthSq();
        if (speedSq < 1e-4) return;
        const speed = Math.sqrt(speedSq);
        const forward = this._tmpV2.copy(vNow).multiplyScalar(1.0 / speed);
        const brakeRadiusSq = brakeRadius * brakeRadius;
        const cellX = Math.floor(this.position.x / AGENT_CELL_SIZE);
        const cellZ = Math.floor(this.position.z / AGENT_CELL_SIZE);
        const rCells = Math.max(1, Math.ceil(brakeRadius / AGENT_CELL_SIZE));
        let maxBrakeStrength = 0;
        for (let dx = -rCells; dx <= rCells; dx++) {
            for (let dz = -rCells; dz <= rCells; dz++) {
                const key = packCellKey(cellX + dx, cellZ + dz);
                const bucket = dynamicGrid.get(key);
                if (!bucket || bucket.length === 0) continue;
                for (let i = 0; i < bucket.length; i++) {
                    const other = bucket[i];
                    if (!other || other === this || other.type !== this.type || !other.position) continue;
                    const relX = other.position.x - this.position.x;
                    const relZ = other.position.z - this.position.z;
                    const relY = isDrone ? (other.position.y - this.position.y) : 0;
                    const distSq = relX * relX + relY * relY + relZ * relZ;
                    if (distSq <= 1e-6 || distSq > brakeRadiusSq) continue;
                    const dist = Math.sqrt(distSq);
                    const invDist = 1.0 / dist;
                    this._tmpV3.set(relX * invDist, relY * invDist, relZ * invDist);
                    const ahead = forward.dot(this._tmpV3);
                    if (ahead <= aheadDotThreshold) continue;
                    // Filter near-side neighbours so queueing acts mainly on forward traffic.
                    const lateral = Math.sqrt(Math.max(0, 1 - ahead * ahead));
                    if (lateral > 0.9) continue;
                    const otherSpeed = isDrone
                        ? other.velocity.length()
                        : Math.hypot(other.velocity.x, other.velocity.z);
                    if (otherSpeed > speed * 1.15 && dist > brakeRadius * 0.55) continue;
                    const closeness = (brakeRadius - dist) / brakeRadius;
                    const brakeStrength = closeness * ahead;
                    if (brakeStrength > maxBrakeStrength) maxBrakeStrength = brakeStrength;
                }
            }
        }
        if (maxBrakeStrength <= 1e-4) return;
        this._tmpV3.copy(vNow).multiplyScalar(-0.8 * maxBrakeStrength);
        if (!isDrone) this._tmpV3.y = 0;
        this.applyForce(this._tmpV3);
    }

    // Predictive feeler ray + spatial grid candidate filtering (local obstacles only).

    applyPredictiveRaycastAvoidance(dt, lookahead) {
        if (lookahead <= 0 || staticObstacleGrid.size === 0) return;
        const interval = Math.max(1, config.raycastInterval | 0);
        if (this._raycastPhase >= interval) this._raycastPhase = this._raycastPhase % interval;
        if (((raycastFrameIndex + this._raycastPhase) % interval) !== 0) return;
        _rayDir.copy(this.getPlannedVelocity(this._tmpV1));
        if (this.type === 'pedestrian') _rayDir.y = 0;
        const speedSq = _rayDir.lengthSq();
        if (speedSq < 0.04) return;
        _rayDir.multiplyScalar(1.0 / Math.sqrt(speedSq));
        _rayOrigin.copy(this.position);
        if (this.type === 'pedestrian') _rayOrigin.y += 1.0;
        raycaster.near = 0.1;
        raycaster.far = lookahead;
        raycaster.set(_rayOrigin, _rayDir);
        const isDrone = (this.type === 'drone');
        const spacingScale = getAgentSpacingScale(this.type);
        const cellX = Math.floor(this.position.x / AGENT_CELL_SIZE);
        const cellZ = Math.floor(this.position.z / AGENT_CELL_SIZE);
        const rCells = Math.max(1, Math.ceil((lookahead + 8) / AGENT_CELL_SIZE));
        let bestDistance = Infinity;
        let bestFound = false;
        let isBuildingHit = false;
        for (let dx = -rCells; dx <= rCells; dx++) {
            for (let dz = -rCells; dz <= rCells; dz++) {
                const key = packCellKey(cellX + dx, cellZ + dz);
                const bucket = staticObstacleGrid.get(key);
                if (!bucket || bucket.length === 0) continue;
                for (let i = 0; i < bucket.length; i++) {
                    const obstacle = bucket[i];
                    if (!obstacle || !obstacle.position) continue;
                    if (obstacle.mask && obstacle.mask !== 'both' && obstacle.mask !== this.type) continue;
                    // Detect buildings by height
                    const isBuilding = obstacle.height && obstacle.height > 8;
                    if (isDrone) {
                        const h = (obstacle.height !== undefined) ? obstacle.height : 6;
                        const topY = obstacle.position.y + h;
                        if (this.position.y > topY + 2.0) continue;
                    }
                    // Building radius to ensure agents are spaced out from them
                    const extraRadius = (isBuilding ? 1.8 : (isDrone ? 0.9 : 0.65)) * spacingScale;
                    const radius = (obstacle.radius !== undefined ? obstacle.radius : 1.0) + extraRadius;
                    const obstacleHeight = (obstacle.height !== undefined) ? obstacle.height : 6;
                    const obstacleTopY = obstacle.position.y + obstacleHeight;
                    const sampleY = Math.min(obstacleTopY, Math.max(obstacle.position.y, _rayOrigin.y));
                    _rayToObstacle.subVectors(obstacle.position, _rayOrigin);
                    const proj = _rayToObstacle.dot(_rayDir);
                    if (proj < -radius || proj > (lookahead + radius)) continue;
                    const perpSq = _rayToObstacle.lengthSq() - proj * proj;
                    if (perpSq > radius * radius) continue;
                    _raySphere.center.set(obstacle.position.x, sampleY, obstacle.position.z);
                    _raySphere.radius = radius;
                    if (!raycaster.ray.intersectSphere(_raySphere, _rayHit)) continue;
                    const d = _rayOrigin.distanceTo(_rayHit);
                    if (d < raycaster.near || d > lookahead || d >= bestDistance) continue;
                    bestDistance = d;
                    bestFound = true;
                    isBuildingHit = isBuilding;
                    this._tmpV3.subVectors(_rayHit, _raySphere.center).normalize();
                    if (this._tmpV3.dot(_rayDir) > 0) this._tmpV3.negate();
                }
            }
        }
        if (!bestFound) return;
        const strength = (lookahead - bestDistance) / lookahead;
        // Adds more avoidance to buildings
        const buildingMultiplier = isBuildingHit ? 1.8 : 1.0;
        const baseScale = isDrone ? 3.0 : 2.4;
        const impulse = baseScale * buildingMultiplier * config.raycastAvoidanceForceScale * strength * dt * this.speed;
        this.applyVelocityDeltaComponents(
            this._tmpV3.x * impulse,
            this._tmpV3.y * impulse,
            this._tmpV3.z * impulse
        );
    }

    enforceBuildingFootprintExclusion() {
        // Prevents agents from going through buildings
        this.resolveFootprintList(mainBuildingFootprints);
        this.resolveFootprintList(greenBuildingFootprints);
    }

    enforceWallExclusion(spacingScale = 1.0) {
        // Prevents agents from going through the graveyard walls
        const wallLayout = getWallLayoutCached();
        const enclosure = wallLayout && wallLayout.enclosure;
        if (!enclosure) return;
        const isDrone = (this.type === 'drone');
        if (isDrone) {
            const wallTop = platformHeight + DIVIDER_WALL.height + 2.2;
            if (this.position.y > wallTop + 2.0) return;
        }
        const scale = Math.max(0.1, spacingScale);
        const wallHalfThickness = DIVIDER_WALL.thickness * 0.5;
        const band = Math.max(0.95, wallHalfThickness + 0.8 * scale);
        const x = this.position.x;
        const z = this.position.z;
        if (x < enclosure.minX - band || x > enclosure.maxX + band ||
            z < enclosure.minZ - band || z > enclosure.maxZ + band) {
            return;
        }
        const gateHalf = wallLayout.gateWidth * 0.5;
        const cornerGateHalf = wallLayout.cornerGateWidth * 0.5;
        let bestPen = Infinity;
        let pushAxis = null;
        let pushSign = 0;

        const considerAxis = (axis, delta) => {
            const absDelta = Math.abs(delta);
            if (absDelta >= band) return;
            const pen = band - absDelta;
            if (pen >= bestPen) return;
            bestPen = pen;
            pushAxis = axis;
            pushSign = (delta >= 0) ? 1 : -1;
        };

        const inBackGate = (() => {
            const backGates = wallLayout.backGateXs || [];
            for (let i = 0; i < backGates.length; i++) {
                if (Math.abs(x - backGates[i]) <= gateHalf) return true;
            }
            return false;
        })();
        const inFrontGate = (Math.abs(x - wallLayout.frontGateX) <= gateHalf) ||
            (Math.abs(x - wallLayout.cornerGateX) <= cornerGateHalf);

        if (!inBackGate && x >= enclosure.minX - band && x <= enclosure.maxX + band) {
            considerAxis('z', z - enclosure.maxZ);
        }
        if (!inFrontGate && x >= enclosure.minX - band && x <= enclosure.maxX + band) {
            considerAxis('z', z - enclosure.minZ);
        }
        if (z >= enclosure.minZ - band && z <= enclosure.maxZ + band) {
            considerAxis('x', x - enclosure.minX);
            considerAxis('x', x - enclosure.maxX);
        }

        if (!pushAxis || bestPen <= 0) return;
        const eps = 0.05;
        if (pushAxis === 'x') {
            this.position.x += pushSign * (bestPen + eps);
            if (this.velocity.x * pushSign < 0) this.velocity.x = 0;
        } else {
            this.position.z += pushSign * (bestPen + eps);
            if (this.velocity.z * pushSign < 0) this.velocity.z = 0;
        }
    }

    resolveFootprintList(list) {
        if (!list || list.length === 0) return;
        const isDrone = (this.type === 'drone');
        for (let i = 0; i < list.length; i++) {
            const fp = list[i];
            if (!fp) continue;
            const topY = platformHeight + ((fp.hTotal !== undefined)
                ? fp.hTotal
                : (((fp.h !== undefined) ? fp.h : 0) + ((fp.roofPitch !== undefined) ? fp.roofPitch : 0)));
            if (isDrone && this.position.y > topY + BUILDING_DRONE_ROOF_CLEARANCE) continue;
            const hx = (fp.hw !== undefined ? fp.hw : 0) + BUILDING_COLLISION_PADDING;
            const hz = (fp.hd !== undefined ? fp.hd : 0) + BUILDING_COLLISION_PADDING;
            if (hx <= 0 || hz <= 0) continue;
            const dx = this.position.x - fp.cx;
            const dz = this.position.z - fp.cz;
            const ax = Math.abs(dx);
            const az = Math.abs(dz);
            if (ax >= hx || az >= hz) continue;
            const pushX = hx - ax;
            const pushZ = hz - az;
            if (pushX < pushZ) {
                const dir = dx >= 0 ? 1 : -1;
                this.position.x += dir * pushX;
                if (this.velocity.x * dir < 0) this.velocity.x = 0;
            } else {
                const dir = dz >= 0 ? 1 : -1;
                this.position.z += dir * pushZ;
                if (this.velocity.z * dir < 0) this.velocity.z = 0;
            }
            if (isDrone) {
                const minY = topY + BUILDING_DRONE_ROOF_CLEARANCE;
                if (this.position.y < minY) {
                    const dy = minY - this.position.y;
                    this.velocity.y = Math.max(this.velocity.y, Math.min(2.4, dy * 0.6));
                }
            }
        }
    }

    // Flocking implementation for 3a

    computeFlockingForces(dynamicGrid, neighborhoodRadius) {
        this.separationForce.set(0, 0, 0);
        this.alignmentForce.set(0, 0, 0);
        this.cohesionForce.set(0, 0, 0);
        if (!dynamicGrid) return;
        const px = this.position.x, py = this.position.y, pz = this.position.z;
        const cx = Math.floor(px / AGENT_CELL_SIZE);
        const cz = Math.floor(pz / AGENT_CELL_SIZE);
        const r = neighborhoodRadius;
        const r2 = r * r;
        const rCells = Math.max(1, Math.ceil(r / AGENT_CELL_SIZE));
        const myType = this.type;
        const isDrone = (myType === 'drone');
        let sameCount = 0;
        let totalCount = 0;
        const maxNeighbours = isDrone ? 56 : 36;
        for (let dx = -rCells; dx <= rCells; dx++) {
            for (let dz = -rCells; dz <= rCells; dz++) {
                const key = packCellKey(cx + dx, cz + dz);
                const bucket = dynamicGrid.get(key);
                if (!bucket || bucket.length === 0) continue;
                for (let i = 0; i < bucket.length; i++) {
                    const other = bucket[i];
                    if (!other || other === this || !other.position) continue;
                    const ox = other.position.x;
                    const oy = other.position.y;
                    const oz = other.position.z;
                    const dxw = px - ox;
                    const dzw = pz - oz;
                    const d2 = dxw * dxw + dzw * dzw;
                    if (d2 < 1e-6 || d2 > r2) continue;
                    const inv = 1.0 / (d2 + 1e-3);
                    this.separationForce.x += dxw * inv;
                    this.separationForce.z += dzw * inv;
                    if (isDrone) {
                        const dyw = py - oy;
                        this.separationForce.y += dyw * inv * 0.35;
                    }
                    if (other.type === myType) {
                        this.alignmentForce.x += other.velocity.x;
                        this.alignmentForce.z += other.velocity.z;
                        this.cohesionForce.x += ox;
                        this.cohesionForce.z += oz;
                        if (isDrone) {
                            this.alignmentForce.y += other.velocity.y;
                            this.cohesionForce.y += oy;
                        }
                        sameCount++;
                    }
                    totalCount++;
                    if (totalCount >= maxNeighbours) break;
                }
                if (totalCount >= maxNeighbours) break;
            }
            if (totalCount >= maxNeighbours) break;
        }
        if (totalCount > 0) {
            const inv = 1.0 / totalCount;
            this.separationForce.x *= inv;
            this.separationForce.z *= inv;
            if (isDrone) this.separationForce.y *= inv;
        }
        if (sameCount > 0) {
            const inv = 1.0 / sameCount;
            const selfVel = this.getPlannedVelocity(this._tmpV2);
            this.alignmentForce.x = this.alignmentForce.x * inv - selfVel.x;
            this.alignmentForce.z = this.alignmentForce.z * inv - selfVel.z;
            this.cohesionForce.x = this.cohesionForce.x * inv - px;
            this.cohesionForce.z = this.cohesionForce.z * inv - pz;
            if (isDrone) {
                this.alignmentForce.y = this.alignmentForce.y * inv - selfVel.y;
                this.cohesionForce.y = this.cohesionForce.y * inv - py;
            } else {
                this.alignmentForce.y = 0;
                this.cohesionForce.y = 0;
            }
        } else {
            this.alignmentForce.set(0, 0, 0);
            this.cohesionForce.set(0, 0, 0);
        }
    }

    applyFlockingForces(separationWeight, alignmentWeight, cohesionWeight) {
        // Applies accumulated flocking forces as steering impulses.
        const v = this.getPlannedVelocity(this._tmpV1);
        const oldX = v.x;
        const oldY = v.y;
        const oldZ = v.z;
        v.x += this.separationForce.x * separationWeight;
        v.z += this.separationForce.z * separationWeight;
        v.x += this.alignmentForce.x * alignmentWeight;
        v.z += this.alignmentForce.z * alignmentWeight;
        v.x += this.cohesionForce.x * cohesionWeight;
        v.z += this.cohesionForce.z * cohesionWeight;
        if (this.type === 'drone') {
            v.y += this.separationForce.y * (separationWeight * 0.9);
            v.y += this.alignmentForce.y * (alignmentWeight * 0.8);
            v.y += this.cohesionForce.y * (cohesionWeight * 0.6);
        }
        const maxSp = this.speed * 1.5;
        if (this.type !== 'drone') {
            const vx = v.x, vz = v.z;
            const v2 = vx * vx + vz * vz;
            const max2 = maxSp * maxSp;
            if (v2 > max2) {
                const inv = maxSp / (Math.sqrt(v2) + 1e-8);
                v.x *= inv;
                v.z *= inv;
            }
        } else {
            const vx = v.x, vy = v.y, vz = v.z;
            const v2 = vx * vx + vy * vy + vz * vz;
            const max2 = maxSp * maxSp;
            if (v2 > max2) {
                const inv = maxSp / (Math.sqrt(v2) + 1e-8);
                v.x *= inv;
                v.y *= inv;
                v.z *= inv;
            }
            const vyMax = 2.8;
            if (v.y > vyMax) v.y = vyMax;
            if (v.y < -vyMax) v.y = -vyMax;
        }
        this.applyVelocityDeltaComponents(v.x - oldX, v.y - oldY, v.z - oldZ);
    }

    // Collision avoidance system for agents and the environment (and other agents)

    avoidCollisions(dynamicGrid, staticGrid, avoidanceRadius, spacingScale = 1.0) {
        if (!dynamicGrid && !staticGrid) return;
        const cellX = Math.floor(this.position.x / AGENT_CELL_SIZE);
        const cellZ = Math.floor(this.position.z / AGENT_CELL_SIZE);
        const af = this._tmpV1;
        af.set(0, 0, 0);
        let obstacleCount = 0;
        const isDrone = (this.type === 'drone');
        const obstacleSpacingScale = Math.max(0.1, spacingScale);
        for (let dx = -1; dx <= 1; dx++) {
        for (let dz = -1; dz <= 1; dz++) {
            const key = packCellKey(cellX + dx, cellZ + dz);
            const cellDynamic = dynamicGrid ? dynamicGrid.get(key) : null;
            if (cellDynamic && cellDynamic.length) {
                for (let i = 0; i < cellDynamic.length; i++) {
                    const obstacle = cellDynamic[i];
                    if (!obstacle || obstacle === this || !obstacle.position) continue;
                    if (obstacle.radius !== undefined) continue;
                    const ox = obstacle.position.x;
                    const oy = obstacle.position.y;
                    const oz = obstacle.position.z;
                    const dxw = this.position.x - ox;
                    const dzw = this.position.z - oz;
                    if (!isDrone) {
                        const distSq = dxw * dxw + dzw * dzw;
                        if (distSq < 1e-6) continue;
                        const minDist = avoidanceRadius;
                        const minDistSq = minDist * minDist;
                        if (distSq < minDistSq) {
                            const dist = Math.sqrt(distSq);
                            const invDist = 1.0 / dist;
                            const strength = (minDist - dist) / minDist;
                            const s = 0.9 * strength;
                            af.x += dxw * invDist * s;
                            af.z += dzw * invDist * s;
                            obstacleCount++;
                        }
                    } else {
                        const dyw = this.position.y - oy;
                        const distSq3 = dxw * dxw + dyw * dyw + dzw * dzw;
                        if (distSq3 < 1e-6) continue;
                        const minDist = avoidanceRadius;
                        const minDistSq3 = minDist * minDist;
                        if (distSq3 < minDistSq3) {
                            const dist = Math.sqrt(distSq3);
                            const invDist = 1.0 / dist;
                            const strength = (minDist - dist) / minDist;
                            const s = 0.85 * strength;
                            af.x += dxw * invDist * s;
                            af.y += dyw * invDist * s;
                            af.z += dzw * invDist * s;
                            obstacleCount++;
                        }
                    }
                }
            }
            const cellStatic = staticGrid ? staticGrid.get(key) : null;
            if (cellStatic && cellStatic.length) {
                for (let i = 0; i < cellStatic.length; i++) {
                    const obstacle = cellStatic[i];
                    if (!obstacle || !obstacle.position) continue;
                    if (obstacle.mask && obstacle.mask !== 'both' && obstacle.mask !== this.type) continue;
                    // Detect buildings for priority handling 
                    const isBuilding = obstacle.height && obstacle.height > 8;
                    const ox = obstacle.position.x;
                    const oy = obstacle.position.y;
                    const oz = obstacle.position.z;
                    const dxw = this.position.x - ox;
                    const dzw = this.position.z - oz;
                    const distSq = dxw * dxw + dzw * dzw;
                    if (distSq < 1e-6) continue;
                    if (isDrone) {
                        const h = (obstacle.height !== undefined) ? obstacle.height : 6;
                        const topY = oy + h;
                        const clearance = 1.8;
                        if (this.position.y > topY + clearance) {
                            continue;
                        }
                    }
                    // Larger safety zone for buildings
                    const extraMargin = isBuilding ? 1.5 : 0;
                    const minDist = (obstacle.radius !== undefined ? obstacle.radius : 1.0) +
                        ((isDrone ? 0.9 : 0.65) + extraMargin) * obstacleSpacingScale;
                    const minDistSq = minDist * minDist;
                    if (distSq < minDistSq) {
                        const dist = Math.sqrt(distSq);
                        const invDist = 1.0 / dist;
                        const strength = (minDist - dist) / minDist;
                        // Buildings get 2x stronger force
                        const priorityMultiplier = isBuilding ? 2.0 : 1.0;
                        const s = 1.2 * strength * priorityMultiplier;
                        af.x += dxw * invDist * s;
                        af.z += dzw * invDist * s;
                        if (isDrone) {
                            const h = (obstacle.height !== undefined) ? obstacle.height : 6;
                            const topY = oy + h;
                            const roofClearance = isBuilding ? 3.2 : 2.2;
                            const dy = (topY + roofClearance) - this.position.y;
                            if (dy > 0) {
                                const liftGain = isBuilding ? 0.45 : 0.25;
                                af.y += dy * liftGain * strength * priorityMultiplier;
                            }
                        }
                        obstacleCount++;
                    }
                }
            }
        }
            }
            if (obstacleCount > 0) {
        const len2 = af.x * af.x + af.y * af.y + af.z * af.z;
        if (len2 > 1e-8) {
            const inv = 1.0 / Math.sqrt(len2);
            const dvx = af.x * inv * 0.75;
            const dvy = isDrone ? (af.y * inv * 0.65) : 0;
            const dvz = af.z * inv * 0.75;
            this.applyVelocityDeltaComponents(dvx, dvy, dvz);
        }
            }
    }

    // Utilised for FK skeleton of agents, as well as visual banking and compression effects

    updateProceduralKinematics() {
        if (this.velocity.lengthSq() > 0.01) {
            this._tmpV1.copy(this.velocity).cross(UP);
            this.bankAngle += this._tmpV1.length() * 0.05;
            this.bankAngle *= 0.95;
            if (this.type !== 'pedestrian') {
                this._tmpV2.copy(this.velocity);
                this._tmpV2.y = 0;
                if (this._tmpV2.lengthSq() > 1e-6) {
                    this._tmpV2.normalize();
                    this._tmpQ1.setFromAxisAngle(this._tmpV2, this.bankAngle * 0.1);
                    this.rotation.multiply(this._tmpQ1);
                }
            }
        }
        const speed = this.velocity.length();
        if (this.type === 'pedestrian') {
            // Keep enlarged pedestrians near wall height while preserving subtle gait motion.
            this.compressionFactor = 0.94 + (speed / (this.speed * 2)) * 0.1;
            this.scale.x = this.baseScale;
            this.scale.z = this.baseScale;
            this.scale.y = this.baseScale * this.compressionFactor;
        } else {
            this.compressionFactor = 0.7 + (speed / (this.speed * 2)) * 0.3;
            this.scale.x = this.baseScale;
            this.scale.z = this.baseScale;
            this.scale.y = this.baseScale * this.compressionFactor;
        }
        if (this.type === 'pedestrian') {
            this.position.y += Math.sin(this.walkCycle) * 0.05;
        }
    }

    wrapInBounds() {
        // Boundary handling using steering forces (and a hard clamp if steering does not work)
        const softMargin = 12;    // Steering force zone starts here from boundary
        const hardMargin = 3;     // Emergency hard clamp only within this distance from edge
        const steerStrength = this.speed * 1.8; // Strong enough to redirect at full speed

        if (this.type === 'drone') {
            const b = getDroneBounds();
            const minX = b.minX;
            const maxX = b.maxX;
            const minZ = b.minZ;
            const maxZ = b.maxZ;

            // Soft boundary: apply inward steering force scaled by penetration depth in zone
            if (this.position.x < minX + softMargin) {
                const t = 1.0 - (this.position.x - minX) / softMargin;
                this.computeSteeringForce(steerStrength, this.velocity.y, this.velocity.z, steerStrength * t);
            } else if (this.position.x > maxX - softMargin) {
                const t = 1.0 - (maxX - this.position.x) / softMargin;
                this.computeSteeringForce(-steerStrength, this.velocity.y, this.velocity.z, steerStrength * t);
            }
            if (this.position.z < minZ + softMargin) {
                const t = 1.0 - (this.position.z - minZ) / softMargin;
                this.computeSteeringForce(this.velocity.x, this.velocity.y, steerStrength, steerStrength * t);
            } else if (this.position.z > maxZ - softMargin) {
                const t = 1.0 - (maxZ - this.position.z) / softMargin;
                this.computeSteeringForce(this.velocity.x, this.velocity.y, -steerStrength, steerStrength * t);
            }

            // Hard fallback: emergency clamp only at extreme boundary (prevents escape)
            if (this.position.x < minX + hardMargin) { this.position.x = minX + hardMargin; this.velocity.x = Math.max(0, this.velocity.x); }
            if (this.position.x > maxX - hardMargin) { this.position.x = maxX - hardMargin; this.velocity.x = Math.min(0, this.velocity.x); }
            if (this.position.z < minZ + hardMargin) { this.position.z = minZ + hardMargin; this.velocity.z = Math.max(0, this.velocity.z); }
            if (this.position.z > maxZ - hardMargin) { this.position.z = maxZ - hardMargin; this.velocity.z = Math.min(0, this.velocity.z); }
            return;
        }

        // Pedestrians
        const pedBounds = getPedestrianBounds();
        const minX = pedBounds.minX;
        const maxX = pedBounds.maxX;
        const minZ = pedBounds.minZ;
        const maxZ = pedBounds.maxZ;

        // Soft boundary steering forces (consistent with F_steer = truncate(Vdesired - Vcurrent, maxF))
        if (this.position.x < minX + softMargin) {
            const t = 1.0 - (this.position.x - minX) / softMargin;
            this.computeSteeringForce(steerStrength, 0, this.velocity.z, steerStrength * t);
            this.wanderAngle = Math.atan2(1, this.velocity.z); // Bias wander away from wall
        } else if (this.position.x > maxX - softMargin) {
            const t = 1.0 - (maxX - this.position.x) / softMargin;
            this.computeSteeringForce(-steerStrength, 0, this.velocity.z, steerStrength * t);
            this.wanderAngle = Math.atan2(-1, this.velocity.z);
        }
        if (this.position.z < minZ + softMargin) {
            const t = 1.0 - (this.position.z - minZ) / softMargin;
            this.computeSteeringForce(this.velocity.x, 0, steerStrength, steerStrength * t);
            this.wanderAngle = Math.atan2(this.velocity.x, 1);
        } else if (this.position.z > maxZ - softMargin) {
            const t = 1.0 - (maxZ - this.position.z) / softMargin;
            this.computeSteeringForce(this.velocity.x, 0, -steerStrength, steerStrength * t);
            this.wanderAngle = Math.atan2(this.velocity.x, -1);
        }

        // Hard fallback only at extreme boundary
        if (this.position.x < minX + hardMargin) { this.position.x = minX + hardMargin; this.velocity.x = Math.max(0, this.velocity.x); this.wanderAngle = Math.atan2(1, this.velocity.z); }
        if (this.position.x > maxX - hardMargin) { this.position.x = maxX - hardMargin; this.velocity.x = Math.min(0, this.velocity.x); this.wanderAngle = Math.atan2(-1, this.velocity.z); }
        if (this.position.z < minZ + hardMargin) { this.position.z = minZ + hardMargin; this.velocity.z = Math.max(0, this.velocity.z); this.wanderAngle = Math.atan2(this.velocity.x, 1); }
        if (this.position.z > maxZ - hardMargin) { this.position.z = maxZ - hardMargin; this.velocity.z = Math.min(0, this.velocity.z); this.wanderAngle = Math.atan2(this.velocity.x, -1); }
        this.position.y = platformHeight + 0.5;
    }

    // Cathedral no-go zone enforcement (for both pedestrians and drones)

    enforceCathedralNoGo(prevX, prevZ) {
        if (!cathedralNoGo) return;
        const bb = cathedralNoGo;
        const x = this.position.x;
        const z = this.position.z;
        if (x <= bb.minX || x >= bb.maxX || z <= bb.minZ || z >= bb.maxZ) return;
        if (this.type === 'drone' && this.position.y > (bb.maxY + 3.0)) return;
        if (prevX !== undefined && prevZ !== undefined) {
            this.position.x = prevX;
            this.position.z = prevZ;
        }
        const px = this.position.x;
        const pz = this.position.z;
        const left = px - bb.minX;
        const right = bb.maxX - px;
        const front = pz - bb.minZ;
        const back = bb.maxZ - pz;
        let m = left;
        let axis = 'x';
        let sign = -1;
        if (right < m) { m = right; axis = 'x'; sign = +1; }
        if (front < m) { m = front; axis = 'z'; sign = -1; }
        if (back < m) { m = back; axis = 'z'; sign = +1; }
        const eps = 0.08;
        if (axis === 'x') {
            this.position.x = (sign < 0) ? (bb.minX - eps) : (bb.maxX + eps);
            this.velocity.x *= -0.25;
        } else {
            this.position.z = (sign < 0) ? (bb.minZ - eps) : (bb.maxZ + eps);
            this.velocity.z *= -0.25;
        }
        if (this.type === 'drone') this.velocity.y *= 0.8;
    }
    getTransformMatrix() {
        this._matrix.compose(this.position, this.rotation, this.scale);
        return this._matrix;
    }
}

// Pedestrian class with specific behavior and overrides for the base Agent class

class Pedestrian extends Agent {
    constructor(position, speed) {
        super('pedestrian', position, speed, { baseScale: PEDESTRIAN_SCALE_TO_WALL });
    }

    update(dt, spatialGrid, staticGrid) {
        this.time += dt;
        const prevX = this.position.x;
        const prevZ = this.position.z;
        const spacingScale = getAgentSpacingScale('pedestrian');
        this.beginSteeringStep(dt);
        if (config.agentBehaviors) {
            this.applyAutonomousWander(dt);
            this.computeFlockingForces(spatialGrid, 18);
            // Reynolds' prescribed ratio: separation 1.5x, alignment 1.0x, cohesion 1.0x
            this.applyFlockingForces(0.06 * spacingScale, 0.04, 0.04);
        }
        this.applyQueueBraking(
            spatialGrid,
            Math.max(0, config.pedestrianQueueBrakeRadius ?? 3.4)
        );
        this.applyPredictiveRaycastAvoidance(dt, config.raycastPedestrianLookahead);
        this.avoidCollisions(spatialGrid, staticGrid, 2.0 * spacingScale, spacingScale);
        this.integrateSteering(dt);
        this.enforceBuildingFootprintExclusion();
        this.enforceWallExclusion(spacingScale);
        this.wrapInBounds();
        this.enforceCathedralNoGo(prevX, prevZ);
        this.velocity.y = 0;
        this.position.y = platformHeight + 0.5;
        const dir = (this.velocity.lengthSq() > 1e-4) ? this.velocity : FORWARD;
        const targetRotation = Math.atan2(dir.x, dir.z);
        this.rotation.setFromAxisAngle(UP, targetRotation);
        this.walkCycle = (this.time * this.speed * 2) % (Math.PI * 2);
        this.updateProceduralKinematics();
    }

    applyAutonomousWander(dt) {
        if (this.wanderAngle === undefined) {
            this.wanderAngle = Math.random() * Math.PI * 2;
        }
        this.wanderAngle += (Math.random() - 0.5) * 2.0 * dt;
        if (Math.random() < 0.02) {
            this.wanderAngle += (Math.random() - 0.5) * Math.PI * 0.5;
        }
        const v = this.getPlannedVelocity(this._tmpV1);
        const oldX = v.x;
        const oldY = v.y;
        const oldZ = v.z;

        const desiredVX = Math.sin(this.wanderAngle) * this.speed;
        const desiredVZ = Math.cos(this.wanderAngle) * this.speed;
        const steerRate = 2.0 * dt;
        v.x += (desiredVX - v.x) * steerRate;
        v.z += (desiredVZ - v.z) * steerRate;
        const margin = 8;
        const turnStrength = 1.0;
        const px = this.position.x;
        const pz = this.position.z;
        const pedBounds = getPedestrianBounds();
        const platformMinX = pedBounds.minX;
        const platformMaxX = pedBounds.maxX;
        const platformMinZ = pedBounds.minZ;
        const platformMaxZ = pedBounds.maxZ;
        if (px < platformMinX + margin) {
            v.x += turnStrength * dt * 3;
            this.wanderAngle = Math.atan2(v.x, v.z);
        }
        if (px > platformMaxX - margin) {
            v.x -= turnStrength * dt * 3;
            this.wanderAngle = Math.atan2(v.x, v.z);
        }
        if (pz < platformMinZ + margin) {
            v.z += turnStrength * dt * 3;
            this.wanderAngle = Math.atan2(v.x, v.z);
        }
        if (pz > platformMaxZ - margin) {
            v.z -= turnStrength * dt * 3;
            this.wanderAngle = Math.atan2(v.x, v.z);
        }
        const currentSpeed = Math.sqrt(v.x * v.x + v.z * v.z);
        if (currentSpeed < this.speed * 0.3) {
            const scale = (this.speed * 0.5) / (currentSpeed + 0.001);
            v.x *= scale;
            v.z *= scale;
        }
        // Canonical steering formula: F_steer = truncate(V_desired - V_current, maxForce).
        // Clamp velocity magnitude to prevent compounding forces from exceeding physical limits.
        if (currentSpeed > this.speed * 1.2) {
            const scale = this.speed / currentSpeed;
            v.x *= scale;
            v.z *= scale;
        }
        this.applyVelocityDeltaComponents(v.x - oldX, v.y - oldY, v.z - oldZ);
    }
}

// Drone class with specific behavior and overrides for the base Agent class

class Drone extends Agent {
    constructor(position, speed) {
        super('drone', position, speed);
    }

    update(dt, spatialGrid, staticGrid) {
        this.time += dt;
        const prevX = this.position.x;
        const prevZ = this.position.z;
        const spacingScale = getAgentSpacingScale('drone');
        this.beginSteeringStep(dt);
        if (config.agentBehaviors) {
            this.computeFlockingForces(spatialGrid, 34);
            // Reynolds' prescribed ratio: separation 1.5x, alignment 1.0x, cohesion 1.0x.
            this.applyFlockingForces(0.075 * spacingScale, 0.05, 0.05);
        }
        this.applyAutonomousWander(dt);
        this.applyQueueBraking(
            spatialGrid,
            Math.max(0, config.droneQueueBrakeRadius ?? 4.6)
        );
        const hover = Math.sin(this.time * 0.9 + this.hoverPhase) * this.hoverAmp;
        this.applyVelocityDeltaComponents(0, hover * 0.08, 0);
        this.applyPredictiveRaycastAvoidance(dt, config.raycastDroneLookahead);
        this.avoidCollisions(spatialGrid, staticGrid, 2.6 * spacingScale, spacingScale);
        this.integrateSteering(dt);
        this.enforceBuildingFootprintExclusion();
        this.enforceWallExclusion(spacingScale);
        const minY = DRONE_ALT_MIN;
        const maxY = getDroneAltitudeCeiling();
        if (this.position.y < minY) { this.position.y = minY; this.velocity.y = Math.max(0, this.velocity.y) * 0.2; }
        if (this.position.y > maxY) { this.position.y = maxY; this.velocity.y = Math.min(0, this.velocity.y) * 0.2; }
        this.wrapInBounds();
        this.enforceCathedralNoGo(prevX, prevZ);
        if (this.velocity.lengthSq() > 1e-2) {
            const targetRotation = Math.atan2(this.velocity.x, this.velocity.z);
            this.rotation.setFromAxisAngle(UP, targetRotation);
        }
        this.updateProceduralKinematics();
    }

    applyAutonomousWander(dt) {
        if (this.wanderAngleXZ === undefined) {
            this.wanderAngleXZ = Math.random() * Math.PI * 2;
        }
        if (this.wanderAngleY === undefined) {
            this.wanderAngleY = 0;
        }
        this.wanderAngleXZ += (Math.random() - 0.5) * 1.5 * dt;
        this.wanderAngleY += (Math.random() - 0.5) * 0.5 * dt;
        if (Math.random() < 0.015) {
            this.wanderAngleXZ += (Math.random() - 0.5) * Math.PI * 0.4;
        }
        const v = this.getPlannedVelocity(this._tmpV1);
        const oldX = v.x;
        const oldY = v.y;
        const oldZ = v.z;
        const desiredVX = Math.sin(this.wanderAngleXZ) * this.speed;
        const desiredVZ = Math.cos(this.wanderAngleXZ) * this.speed;
        const desiredVY = Math.sin(this.wanderAngleY) * this.speed * 0.3;
        const steerRate = 1.5 * dt;
        v.x += (desiredVX - v.x) * steerRate;
        v.z += (desiredVZ - v.z) * steerRate;
        v.y += (desiredVY - v.y) * steerRate * 0.5;
        const margin = 20;
        const turnStrength = 1.2;
        const bounds = getDroneBounds();
        const px = this.position.x;
        const pz = this.position.z;
        const py = this.position.y;
        const minX = bounds.minX;
        const maxX = bounds.maxX;
        const minZ = bounds.minZ;
        const maxZ = bounds.maxZ;
        if (px < minX + margin) {
            v.x += turnStrength * dt * 2;
            this.wanderAngleXZ = Math.atan2(v.x, v.z);
        }
        if (px > maxX - margin) {
            v.x -= turnStrength * dt * 2;
            this.wanderAngleXZ = Math.atan2(v.x, v.z);
        }
        if (pz < minZ + margin) {
            v.z += turnStrength * dt * 2;
            this.wanderAngleXZ = Math.atan2(v.x, v.z);
        }
        if (pz > maxZ - margin) {
            v.z -= turnStrength * dt * 2;
            this.wanderAngleXZ = Math.atan2(v.x, v.z);
        }
        if (py < DRONE_ALT_MIN + 3) {
            v.y += turnStrength * dt;
        }
        if (py > getDroneAltitudeCeiling() - 3) {
            v.y -= turnStrength * dt;
        }
        const currentSpeedXZ = Math.sqrt(v.x * v.x + v.z * v.z);
        if (currentSpeedXZ < this.speed * 0.3) {
            const scale = (this.speed * 0.5) / (currentSpeedXZ + 0.001);
            v.x *= scale;
            v.z *= scale;
        }
        if (currentSpeedXZ > this.speed * 1.3) {
            const scale = this.speed / currentSpeedXZ;
            v.x *= scale;
            v.z *= scale;
        }
        this.applyVelocityDeltaComponents(v.x - oldX, v.y - oldY, v.z - oldZ);
    }
}

// Defines the pedestrian navigable rectangle from scene layout constants.

function getPedestrianBounds() {
    const buildingLeftEdge = BUILDINGS_ZONE.centerX - BUILDINGS_ZONE.buildingWidth / 2 - 5;
    const greenRoadRightEdge = GREEN_LAYOUT.centerX + (GREEN_LAYOUT.width / 2 + GREEN_LAYOUT.roadWidth);
    const greenFarZ = GREEN_LAYOUT.centerZ + GREEN_LAYOUT.length / 2;
    const buildingExtension = BUILDINGS_ZONE.rowCount * (BUILDINGS_ZONE.buildingDepth + BUILDINGS_ZONE.spacing) + 40;
    const buildingEndZ = BUILDINGS_ZONE.startZ - buildingExtension;
    return {
        minX: buildingLeftEdge,
        maxX: greenRoadRightEdge,
        minZ: buildingEndZ - 5,
        maxZ: greenFarZ + 5
    };
}

// Defines the drone flight rectangle (slightly larger Z) for aerial agents.

function getDroneBounds() {
    const buildingLeftEdge = BUILDINGS_ZONE.centerX - BUILDINGS_ZONE.buildingWidth / 2 - 5;
    const greenRoadRightEdge = GREEN_LAYOUT.centerX + (GREEN_LAYOUT.width / 2 + GREEN_LAYOUT.roadWidth);
    const greenRoadFarZ = GREEN_LAYOUT.centerZ + (GREEN_LAYOUT.length / 2 + GREEN_LAYOUT.roadWidth);
    const buildingExtension = BUILDINGS_ZONE.rowCount * (BUILDINGS_ZONE.buildingDepth + BUILDINGS_ZONE.spacing) + 40;
    const buildingEndZ = BUILDINGS_ZONE.startZ - buildingExtension;
    return {
        minX: buildingLeftEdge,
        maxX: greenRoadRightEdge,
        minZ: buildingEndZ - 5,
        maxZ: greenRoadFarZ + 5
    };
}

// Computes a dynamic altitude ceiling from tallest obstacles (buildings/cathedral).

function getDroneAltitudeCeiling() {
    if (droneAltitudeCeilingVersion === staticObstacleVersion) return droneAltitudeCeiling;
    let maxTopY = -Infinity;
    const scanFootprints = (footprints, roofFactor) => {
        if (!footprints || footprints.length === 0) return;
        for (let i = 0; i < footprints.length; i++) {
            const fp = footprints[i];
            if (!fp) continue;
            const wallHeight = (fp.h !== undefined) ? fp.h : config.buildingHeight;
            const roofPitch = (fp.roofPitch !== undefined) ? fp.roofPitch : (wallHeight * roofFactor);
            const totalHeight = (fp.hTotal !== undefined) ? fp.hTotal : (wallHeight + roofPitch);
            const topY = platformHeight + totalHeight;
            if (isFinite(topY) && topY > maxTopY) maxTopY = topY;
        }
    };
    scanFootprints(mainBuildingFootprints, 0.4);
    scanFootprints(greenBuildingFootprints, 0.45);
    if (cathedral) {
        _droneAltitudeBounds.setFromObject(cathedral);
        const cathedralTopY = _droneAltitudeBounds.max.y;
        if (isFinite(cathedralTopY) && cathedralTopY > maxTopY) maxTopY = cathedralTopY;
    }
    if (!isFinite(maxTopY)) maxTopY = DRONE_ALT_MAX;
    droneAltitudeCeiling = Math.max(DRONE_ALT_MIN + 1.0, maxTopY);
    droneAltitudeCeilingVersion = staticObstacleVersion;
    return droneAltitudeCeiling;
}

// Space scaling for agents (drone and pedestrian) to allow adjustment of personal space

function getAgentSpacingScale(type) {
    return Math.max(0.1, (type === 'drone')
        ? (config.droneSpacingScale ?? 1.0)
        : (config.pedestrianSpacingScale ?? 1.0));
}

// Memoizes wall/gate geometry so collision + spawn checks are O(1) per query.

function getWallLayoutCached() {
    if (!_cachedWallLayout) _cachedWallLayout = getWallGateLayout();
    return _cachedWallLayout;
}

// Fast predicate for "near boundary" checks around the wall enclosure.

function isNearWallBoundary(x, z, clearance) {
    const wallLayout = getWallLayoutCached();
    const enclosure = wallLayout?.enclosure;
    if (!enclosure) return false;
    if (x < enclosure.minX - clearance || x > enclosure.maxX + clearance ||
        z < enclosure.minZ - clearance || z > enclosure.maxZ + clearance) {
        return false;
    }
    const distToEdge = Math.min(
        Math.abs(x - enclosure.minX),
        Math.abs(enclosure.maxX - x),
        Math.abs(z - enclosure.minZ),
        Math.abs(enclosure.maxZ - z)
    );
    return distToEdge < clearance;
}

// AABB-style footprint containment test for buildings (2D top-down).

function isInsideBuildingFootprints(x, z, footprints, clearance) {
    if (!footprints || footprints.length === 0) return false;
    for (let i = 0; i < footprints.length; i++) {
        const fp = footprints[i];
        if (!fp) continue;
        const hx = (fp.hw !== undefined ? fp.hw : 0) + clearance;
        const hz = (fp.hd !== undefined ? fp.hd : 0) + clearance;
        if (Math.abs(x - fp.cx) < hx && Math.abs(z - fp.cz) < hz) return true;
    }
    return false;
}

// Neighbourhood query over the static obstacle grid (cell buckets), reducing checks from O(N) to O(k)

function isNearStaticObstacle(x, y, z, clearance, type = 'pedestrian') {
    if (!staticObstacleGrid || staticObstacleGrid.size === 0) return false;
    const cellX = Math.floor(x / AGENT_CELL_SIZE);
    const cellZ = Math.floor(z / AGENT_CELL_SIZE);
    const rCells = Math.max(1, Math.ceil((clearance + 3) / AGENT_CELL_SIZE));
    const isDrone = (type === 'drone');
    for (let dx = -rCells; dx <= rCells; dx++) {
        for (let dz = -rCells; dz <= rCells; dz++) {
            const key = packCellKey(cellX + dx, cellZ + dz);
            const bucket = staticObstacleGrid.get(key);
            if (!bucket || bucket.length === 0) continue;
            for (let i = 0; i < bucket.length; i++) {
                const obstacle = bucket[i];
                if (!obstacle || !obstacle.position) continue;
                if (obstacle.mask && obstacle.mask !== 'both' && obstacle.mask !== type) continue;
                if (isDrone) {
                    const h = (obstacle.height !== undefined) ? obstacle.height : 6;
                    const topY = obstacle.position.y + h;
                    if (y > topY + clearance) continue;
                }
                const minDist = (obstacle.radius !== undefined ? obstacle.radius : 1.0) + clearance;
                const ox = x - obstacle.position.x;
                const oz = z - obstacle.position.z;
                if ((ox * ox + oz * oz) < (minDist * minDist)) return true;
            }
        }
    }
    return false;
}

// Flattens unique obstacles from grid buckets into a raycast target list.

function initializeRaycastTargets() {
    const seen = new Set();
    raycastTargets.length = 0;
    for (const bucket of staticObstacleGrid.values()) {
        if (!bucket) continue;
        for (let i = 0; i < bucket.length; i++) {
            const obstacle = bucket[i];
            if (!obstacle || !obstacle.position) continue;
            if (seen.has(obstacle)) continue;
            seen.add(obstacle);
            raycastTargets.push(obstacle);
        }
    }
    raycastTargetsVersion = staticObstacleVersion;
    return raycastTargets.length > 0;
}

// Rebuilds raycast target cache only when staticObstacleVersion changes.

function refreshRaycastTargetsIfNeeded() {
    if (raycastTargetsVersion === staticObstacleVersion) return;
    initializeRaycastTargets();
}

// Pedestrian skeleton creation and animation using Forward Kinematics (3b)

function createPedestrianSkeleton(rootPos) {
    const skeleton = new Skeleton(rootPos);
    const spineLen = 3.0 * FK_DESIGN_SCALE;
    const upperArmLen = 1.4 * FK_DESIGN_SCALE;
    const lowerArmLen = 1.4 * FK_DESIGN_SCALE;
    const thighLen = 1.5 * FK_DESIGN_SCALE;
    const calfLen = 1.5 * FK_DESIGN_SCALE;
    const footLen = 0.35 * FK_DESIGN_SCALE;
    const shoulderX = 1.4 * FK_DESIGN_SCALE;
    const hipX = 0.6 * FK_DESIGN_SCALE;

    const pelvis = new Bone(0.0, 'pelvis');
    pelvis.dir.set(0, 1, 0);

    const spine = new Bone(spineLen, 'spine');
    spine.dir.set(0, 1, 0);

    const leftUpperArm = new Bone(upperArmLen, 'leftUpperArm');
    leftUpperArm.dir.set(0, -1, 0);
    leftUpperArm.localOffset.set(-shoulderX, 0, 0);

    const leftLowerArm = new Bone(lowerArmLen, 'leftLowerArm');
    leftLowerArm.dir.set(0, -1, 0);

    const rightUpperArm = new Bone(upperArmLen, 'rightUpperArm');
    rightUpperArm.dir.set(0, -1, 0);
    rightUpperArm.localOffset.set(shoulderX, 0, 0);

    const rightLowerArm = new Bone(lowerArmLen, 'rightLowerArm');
    rightLowerArm.dir.set(0, -1, 0);

    const leftThigh = new Bone(thighLen, 'leftThigh');
    leftThigh.dir.set(0, -1, 0);
    leftThigh.localOffset.set(-hipX, 0, 0);

    const leftCalf = new Bone(calfLen, 'leftCalf');
    leftCalf.dir.set(0, -1, 0);

    const leftFoot = new Bone(footLen, 'leftFoot');
    leftFoot.dir.set(0, -1, 0);

    const rightThigh = new Bone(thighLen, 'rightThigh');
    rightThigh.dir.set(0, -1, 0);
    rightThigh.localOffset.set(hipX, 0, 0);

    const rightCalf = new Bone(calfLen, 'rightCalf');
    rightCalf.dir.set(0, -1, 0);

    const rightFoot = new Bone(footLen, 'rightFoot');
    rightFoot.dir.set(0, -1, 0);

    skeleton.addBone(pelvis);
    skeleton.addBone(spine, 'pelvis');
    skeleton.addBone(leftUpperArm, 'spine');
    skeleton.addBone(leftLowerArm, 'leftUpperArm');
    skeleton.addBone(rightUpperArm, 'spine');
    skeleton.addBone(rightLowerArm, 'rightUpperArm');
    skeleton.addBone(leftThigh, 'pelvis');
    skeleton.addBone(leftCalf, 'leftThigh');
    skeleton.addBone(leftFoot, 'leftCalf');
    skeleton.addBone(rightThigh, 'pelvis');
    skeleton.addBone(rightCalf, 'rightThigh');
    skeleton.addBone(rightFoot, 'rightCalf');

    return skeleton;
}
// Applies procedural gait via FK (joint angles), then propagates transforms.

function animatePedestrianSkeleton(skeleton, walkCycle) {
    // Arms
    const leftUpperArm  = skeleton.getBone('leftUpperArm');
    const rightUpperArm = skeleton.getBone('rightUpperArm');
    const leftLowerArm  = skeleton.getBone('leftLowerArm');
    const rightLowerArm = skeleton.getBone('rightLowerArm');
    if (leftUpperArm && rightUpperArm) {
        const armSwing = Math.sin(walkCycle) * 0.5;
        leftUpperArm.setAnimFromAxisAngle(_fkAxisX,  armSwing);
        rightUpperArm.setAnimFromAxisAngle(_fkAxisX, -armSwing);
        if (leftLowerArm && rightLowerArm) {
            const elbowBend = Math.abs(Math.sin(walkCycle)) * 0.3;
            leftLowerArm.setAnimFromAxisAngle(_fkAxisX,  -elbowBend);
            rightLowerArm.setAnimFromAxisAngle(_fkAxisX, -elbowBend);
        }
    }

    // Legs
    const leftThigh  = skeleton.getBone('leftThigh');
    const leftCalf   = skeleton.getBone('leftCalf');
    const leftFoot   = skeleton.getBone('leftFoot');
    const rightThigh = skeleton.getBone('rightThigh');
    const rightCalf  = skeleton.getBone('rightCalf');
    const rightFoot  = skeleton.getBone('rightFoot');

    if (leftThigh && rightThigh) {
        // Legs stride in anti-phase (left leads when right trails)
        const leftSwing  = Math.sin(walkCycle) * 0.35;          // thigh sagittal swing ±20°
        const rightSwing = Math.sin(walkCycle + Math.PI) * 0.35; // opposite phase

        leftThigh.setAnimFromAxisAngle(_fkAxisX, leftSwing);
        rightThigh.setAnimFromAxisAngle(_fkAxisX, rightSwing);

        if (leftCalf && rightCalf) {
            // Knee bend: only during back-swing phase (when thigh is negative)
            const leftKnee  = Math.max(0, -leftSwing)  * 0.45;
            const rightKnee = Math.max(0, -rightSwing) * 0.45;
            leftCalf.setAnimFromAxisAngle(_fkAxisX,  -leftKnee);
            rightCalf.setAnimFromAxisAngle(_fkAxisX, -rightKnee);

            if (leftFoot && rightFoot) {
                // Foot counter-rotates to stay roughly parallel to ground
                leftFoot.setAnimFromAxisAngle(_fkAxisX,  leftSwing * 0.2);
                rightFoot.setAnimFromAxisAngle(_fkAxisX, rightSwing * 0.2);
            }
        }
    }

    skeleton.update();
}

// Builds a lightweight drone "skeleton" (hub + wings) for procedural motion.

function createDroneSkeleton(rootPos) {
    const skeleton = new Skeleton(rootPos);
    const hub = new Bone(0.0, 'droneHub');
    hub.dir.set(0, 1, 0);

    const leftWingUpper = new Bone(0.34, 'droneLeftWingUpper');
    leftWingUpper.dir.set(-1, 0, 0);
    leftWingUpper.localOffset.set(-0.22, 0.03, 0.0);
    leftWingUpper.setBindFromAxisAngle(_fkAxisZ, -0.05);

    const leftWingLower = new Bone(0.28, 'droneLeftWingLower');
    leftWingLower.dir.set(-1, 0, 0);
    leftWingLower.setBindFromAxisAngle(_fkAxisZ, -0.03);

    const rightWingUpper = new Bone(0.34, 'droneRightWingUpper');
    rightWingUpper.dir.set(1, 0, 0);
    rightWingUpper.localOffset.set(0.22, 0.03, 0.0);
    rightWingUpper.setBindFromAxisAngle(_fkAxisZ, 0.05);

    const rightWingLower = new Bone(0.28, 'droneRightWingLower');
    rightWingLower.dir.set(1, 0, 0);
    rightWingLower.setBindFromAxisAngle(_fkAxisZ, 0.03);

    skeleton.addBone(hub);
    skeleton.addBone(leftWingUpper, 'droneHub');
    skeleton.addBone(leftWingLower, 'droneLeftWingUpper');
    skeleton.addBone(rightWingUpper, 'droneHub');
    skeleton.addBone(rightWingLower, 'droneRightWingUpper');
    return skeleton;
}

// One-step IK for a hinge joint: rotate wing so its tip direction aims at target.
// Constrains solution to Z-hinge by zeroing other Euler components after alignment.

function solveWingIK_HingeZ(wingBone, targetWorld) {
    if (!wingBone?.parent) return;

    _ikTip.copy(wingBone.dir)
        .multiplyScalar(wingBone.length)
        .applyQuaternion(wingBone.rotation)
        .add(wingBone.position);

    _ikToTip.copy(_ikTip).sub(wingBone.position);
    _ikToTarget.copy(targetWorld).sub(wingBone.position);

    if (_ikToTip.lengthSq() < 1e-8 || _ikToTarget.lengthSq() < 1e-8) return;

    _ikToTip.normalize();
    _ikToTarget.normalize();

    _ikQ.setFromUnitVectors(_ikToTip, _ikToTarget);
    const desiredWorldRot = _ikQ.multiply(wingBone.rotation);

    _ikInvParent.copy(wingBone.parent.rotation).invert();
    wingBone.localRotation.copy(_ikInvParent).multiply(desiredWorldRot);

    _ikEuler.setFromQuaternion(wingBone.localRotation, 'XYZ');
    _ikEuler.x = 0;
    _ikEuler.y = 0;
    wingBone.localRotation.setFromEuler(_ikEuler);
}

// Derives flap frequency/amplitude from speed and adds turn/climb bias.

function animateDroneSkeleton(skeleton, drone) {
    const leftWingUpper = skeleton.getBone('droneLeftWingUpper');
    const leftWingLower = skeleton.getBone('droneLeftWingLower');
    const rightWingUpper = skeleton.getBone('droneRightWingUpper');
    const rightWingLower = skeleton.getBone('droneRightWingLower');
    const hub = skeleton.getBone('droneHub');

    if (!leftWingUpper || !rightWingUpper) {
        skeleton.update();
        return;
    }

    const speed = drone.velocity.length();
    const speedNorm = THREE.MathUtils.clamp(speed / Math.max(0.001, drone.speed * 1.5), 0, 1);
    const flapFreq = THREE.MathUtils.lerp(3.4, 7.8, speedNorm);
    const flapAmp = THREE.MathUtils.lerp(0.08, 0.42, speedNorm);
    const flap = Math.sin(drone.time * flapFreq + drone.hoverPhase) * flapAmp;

    let turnBias = 0;
    let climbBias = 0;
    let misalignBias = 0;

    if (speed > 0.05) {
        _droneVelDir.copy(drone.velocity);
        climbBias = THREE.MathUtils.clamp(_droneVelDir.y / speed, -0.7, 0.7) * 0.2;
        _droneVelDir.y = 0;

        if (_droneVelDir.lengthSq() > 1e-6) {
            _droneVelDir.normalize();
            _droneForwardDir.set(0, 0, 1).applyQuaternion(drone.rotation);
            _droneForwardDir.y = 0;

            if (_droneForwardDir.lengthSq() > 1e-6) {
                _droneForwardDir.normalize();
                const lateral = _droneForwardDir.x * _droneVelDir.z - _droneForwardDir.z * _droneVelDir.x;
                const forwardDot = THREE.MathUtils.clamp(_droneForwardDir.dot(_droneVelDir), -1, 1);
                turnBias = THREE.MathUtils.clamp(lateral, -1, 1) * (0.2 + speedNorm * 0.18);
                misalignBias = (1.0 - forwardDot) * 0.14;
            }
        }
    }

    const desiredLeft = flap + turnBias + climbBias + misalignBias;
    const desiredRight = -flap - turnBias + climbBias + misalignBias;

    // Reset to bind each frame before solving so the one-step IK does not drift.
    leftWingUpper.localRotation.copy(leftWingUpper.bindRotation);
    rightWingUpper.localRotation.copy(rightWingUpper.bindRotation);
    if (leftWingLower) leftWingLower.localRotation.copy(leftWingLower.bindRotation);
    if (rightWingLower) rightWingLower.localRotation.copy(rightWingLower.bindRotation);
    skeleton.update();

    const hubRotWorld = hub ? hub.rotation : drone.rotation;
    _wingUpW.set(0, 1, 0).applyQuaternion(hubRotWorld);

    _wingDirW.copy(leftWingUpper.dir).applyQuaternion(leftWingUpper.rotation);
    _wingTargetL.copy(leftWingUpper.position)
        .addScaledVector(_wingDirW, leftWingUpper.length)
        .addScaledVector(_wingUpW, Math.tan(desiredLeft) * leftWingUpper.length);

    _wingDirW.copy(rightWingUpper.dir).applyQuaternion(rightWingUpper.rotation);
    _wingTargetR.copy(rightWingUpper.position)
        .addScaledVector(_wingDirW, rightWingUpper.length)
        .addScaledVector(_wingUpW, Math.tan(desiredRight) * rightWingUpper.length);

    solveWingIK_HingeZ(leftWingUpper, _wingTargetL);
    solveWingIK_HingeZ(rightWingUpper, _wingTargetR);
    skeleton.update();
}

// Writes per-instance wing matrices from the drone skeleton into InstancedMesh buffers.
// Hides wings by scaling near-zero for LOD fades while keeping transform continuity.

function setDroneWingMatrices(index, agent, visible, scaleFactor = 1.0) {
    const leftUpperMesh = agentSystem.droneWingLeftUpperInstanced;
    const leftLowerMesh = agentSystem.droneWingLeftLowerInstanced;
    const rightUpperMesh = agentSystem.droneWingRightUpperInstanced;
    const rightLowerMesh = agentSystem.droneWingRightLowerInstanced;
    if (!leftUpperMesh || !leftLowerMesh || !rightUpperMesh || !rightLowerMesh) return;
    const clampedScale = THREE.MathUtils.clamp(scaleFactor, 0, 1);

    if (!visible || clampedScale < 0.01) {
        _droneWingScale.set(0.001, 0.001, 0.001);
        _droneWingMat.compose(agent.position, agent.rotation, _droneWingScale);
        _droneWingMat.toArray(leftUpperMesh.instanceMatrix.array, index * 16);
        _droneWingMat.toArray(leftLowerMesh.instanceMatrix.array, index * 16);
        _droneWingMat.toArray(rightUpperMesh.instanceMatrix.array, index * 16);
        _droneWingMat.toArray(rightLowerMesh.instanceMatrix.array, index * 16);
        _droneWingScale.set(DRONE_WING_BASE_SCALE, DRONE_WING_BASE_SCALE, DRONE_WING_BASE_SCALE);
        return;
    }

    const skeleton = agentSystem.droneSoA.skeletons[index];
    if (!skeleton) {
        _droneWingScale.set(0.001, 0.001, 0.001);
        _droneWingMat.compose(agent.position, agent.rotation, _droneWingScale);
        _droneWingMat.toArray(leftUpperMesh.instanceMatrix.array, index * 16);
        _droneWingMat.toArray(leftLowerMesh.instanceMatrix.array, index * 16);
        _droneWingMat.toArray(rightUpperMesh.instanceMatrix.array, index * 16);
        _droneWingMat.toArray(rightLowerMesh.instanceMatrix.array, index * 16);
        _droneWingScale.set(DRONE_WING_BASE_SCALE, DRONE_WING_BASE_SCALE, DRONE_WING_BASE_SCALE);
        return;
    }

    const leftWingUpper = skeleton.getBone('droneLeftWingUpper');
    const leftWingLower = skeleton.getBone('droneLeftWingLower');
    const rightWingUpper = skeleton.getBone('droneRightWingUpper');
    const rightWingLower = skeleton.getBone('droneRightWingLower');
    if (!leftWingUpper || !leftWingLower || !rightWingUpper || !rightWingLower) {
        _droneWingScale.set(0.001, 0.001, 0.001);
        _droneWingMat.compose(agent.position, agent.rotation, _droneWingScale);
        _droneWingMat.toArray(leftUpperMesh.instanceMatrix.array, index * 16);
        _droneWingMat.toArray(leftLowerMesh.instanceMatrix.array, index * 16);
        _droneWingMat.toArray(rightUpperMesh.instanceMatrix.array, index * 16);
        _droneWingMat.toArray(rightLowerMesh.instanceMatrix.array, index * 16);
        _droneWingScale.set(DRONE_WING_BASE_SCALE, DRONE_WING_BASE_SCALE, DRONE_WING_BASE_SCALE);
        return;
    }

    const wingScale = DRONE_WING_BASE_SCALE * clampedScale;
    _droneWingScale.set(wingScale, wingScale, wingScale);
    _droneWingMat.compose(leftWingUpper.position, leftWingUpper.rotation, _droneWingScale);
    _droneWingMat.toArray(leftUpperMesh.instanceMatrix.array, index * 16);
    _droneWingMat.compose(leftWingLower.position, leftWingLower.rotation, _droneWingScale);
    _droneWingMat.toArray(leftLowerMesh.instanceMatrix.array, index * 16);
    _droneWingMat.compose(rightWingUpper.position, rightWingUpper.rotation, _droneWingScale);
    _droneWingMat.toArray(rightUpperMesh.instanceMatrix.array, index * 16);
    _droneWingMat.compose(rightWingLower.position, rightWingLower.rotation, _droneWingScale);
    _droneWingMat.toArray(rightLowerMesh.instanceMatrix.array, index * 16);
}

// Creates a capped pool of dynamic point lights (object pooling).
// Avoids per-frame allocations and keeps the lighting cost bounded with many agents.

function initAgentLightPools() {
    for (const key of Object.keys(agentLightPools)) {
        agentLightPools[key].forEach(l => scene.remove(l));
        agentLightPools[key] = [];
    }
    const cols = {
        pedestrians: 0x4169e1,
        drones: 0x2ecc71
    };
    const makePool = (type, count, distance) => {
        for (let i = 0; i < count; i++) {
            const pl = new THREE.PointLight(cols[type], 0.0, distance, 2.0);
            pl.castShadow = false;
            pl.visible = false;
            scene.add(pl);
            agentLightPools[type].push(pl);
        }
    };
    makePool('pedestrians', AGENT_LIGHT_POOL_SIZES.pedestrians, 9);
    makePool('drones', AGENT_LIGHT_POOL_SIZES.drones, 12);
}

// Applies consistent emissive/roughness/metalness across LOD tiers + pooled skinned meshes.

function applyAgentLightMaterialSettings() {
    // NEAR tier: Instanced meshes
    if (agentSystem.pedestrianInstanced?.material) {
        const m = agentSystem.pedestrianInstanced.material;
        m.metalness = 0.12;
        m.roughness = 0.6;
        m.clearcoat = 0.15;
        m.clearcoatRoughness = 0.7;
        m.emissive?.setHex(0x4169e1);
        m.emissiveIntensity = config.pedestrianLightIntensity;
        m.needsUpdate = true;
    }
    if (agentSystem.droneInstanced?.material) {
        const m = agentSystem.droneInstanced.material;
        m.metalness = 0.65;
        m.roughness = 0.3;
        m.clearcoat = 0.35;
        m.clearcoatRoughness = 0.35;
        m.emissive?.setHex(0x2ecc71);
        m.emissiveIntensity = config.droneLightIntensity * 0.7;
        m.needsUpdate = true;
    }
    if (agentSystem.droneWingLeftUpperInstanced?.material) {
        const m = agentSystem.droneWingLeftUpperInstanced.material;
        m.metalness = 0.58;
        m.roughness = 0.26;
        m.clearcoat = 0.2;
        m.clearcoatRoughness = 0.4;
        m.emissive?.setHex(0x2ecc71);
        m.emissiveIntensity = config.droneLightIntensity * 0.55;
        m.needsUpdate = true;
    }
    // MID and FAR LOD tiers
    if (agentLOD.pedestrianMid?.material) {
        const m = agentLOD.pedestrianMid.material;
        m.emissive?.setHex(0x4169e1);
        m.emissiveIntensity = config.pedestrianLightIntensity;
        m.needsUpdate = true;
    }
    if (agentLOD.pedestrianFar?.material) {
        const m = agentLOD.pedestrianFar.material;
        m.emissive?.setHex(0x4169e1);
        m.emissiveIntensity = config.pedestrianLightIntensity;
        m.needsUpdate = true;
    }
    if (agentLOD.droneMid?.material) {
        const m = agentLOD.droneMid.material;
        m.emissive?.setHex(0x2ecc71);
        m.emissiveIntensity = config.droneLightIntensity * 0.7;
        m.needsUpdate = true;
    }
    if (agentLOD.droneFar?.material) {
        const m = agentLOD.droneFar.material;
        m.emissive?.setHex(0x2ecc71);
        m.emissiveIntensity = config.droneLightIntensity * 0.7;
        m.needsUpdate = true;
    }
    // Skinned pool meshes
    skinnedPool.meshes.forEach(group => {
        group.children.forEach(mesh => {
            if (mesh.material) {
                mesh.material.metalness = 0.12;
                mesh.material.roughness = 0.6;
                mesh.material.emissive = new THREE.Color(0x4169e1);
                mesh.material.emissiveIntensity = config.pedestrianLightIntensity;
                mesh.material.needsUpdate = true;
            }
        });
    });
}

// Assigns limited light pool to nearest agents (distance sort) each frame.
// Demonstrates view-dependent resource allocation (lights as a constrained budget).

function updateAgentLightPools() {
    const camPos = camera.position;
    const assign = (type, agents, intensity) => {
        const pool = agentLightPools[type];
        if (!pool || pool.length === 0) return;
        if (intensity <= 0.001 || agents.length === 0) {
            for (let i = 0; i < pool.length; i++) {
                pool[i].visible   = false;
                pool[i].intensity = 0.0;
            }
            return;
        }

        const buf = _lightSortBuf[type];
        const n   = agents.length;
        for (let i = 0; i < n; i++) {
            const p  = agents[i].position;
            const dx = p.x - camPos.x;
            const dy = p.y - camPos.y;
            const dz = p.z - camPos.z;
            if (!buf[i]) buf[i] = [0, 0];
            buf[i][0] = i;
            buf[i][1] = dx*dx + dy*dy + dz*dz;
        }
        buf.length = n; 
        buf.sort((a, b) => a[1] - b[1]);
        const k = Math.min(pool.length, n);
        for (let i = 0; i < pool.length; i++) pool[i].visible = false;
        for (let i = 0; i < k; i++) {
            const agent = agents[buf[i][0]];
            const l     = pool[i];
            l.position.set(agent.position.x, agent.position.y + 0.9, agent.position.z);
            l.intensity = intensity;
            l.visible   = true;
        }
    };
    assign('pedestrians', agentSystem.pedestrians, config.pedestrianLightIntensity);
    assign('drones',      agentSystem.drones,      config.droneLightIntensity);
}

// Deterministic hash from position -> color for per-instance identification.

function hashVector3ToColor(pos) {
    const x = Math.sin(pos.x * 12.9898) * 43758.5453;
    const y = Math.sin(pos.y * 78.233) * 43758.5453;
    const z = Math.sin(pos.z * 45.164) * 43758.5453;
    const h1 = x - Math.floor(x);
    const h2 = y - Math.floor(y);
    const h3 = z - Math.floor(z);
    return new THREE.Color(h1, h2, h3);
}

function setVec3Array(array, index, x, y, z) {
    const o = index * 3;
    array[o] = x;
    array[o + 1] = y;
    array[o + 2] = z;
}

// Merges multiple procedural meshes into a single BufferGeometry for instanced rendering.

function combineGeometries(shapes) {
    const combined = new THREE.Group();
    shapes.forEach(shape => combined.add(shape));
    const geometries = [];
    combined.traverse((child) => {
        if (child.isMesh) {
            const g = child.geometry.clone();
            g.applyMatrix4(child.matrixWorld);
            geometries.push(g);
        }
    });
    const mergedGeo = new THREE.BufferGeometry();
    let indexOffset = 0;
    const positions = [];
    const normals = [];
    const indices = [];
    geometries.forEach((geo) => {
        const posAttr = geo.getAttribute('position');
        const normAttr = geo.getAttribute('normal');
        for (let i = 0; i < posAttr.count; i++) {
            positions.push(posAttr.getX(i), posAttr.getY(i), posAttr.getZ(i));
            if (normAttr) {
                normals.push(normAttr.getX(i), normAttr.getY(i), normAttr.getZ(i));
            }
        }
        if (geo.getIndex()) {
            const geoIndices = geo.getIndex().array;
            for (let i = 0; i < geoIndices.length; i++) {
                indices.push(geoIndices[i] + indexOffset);
            }
        } else {
            for (let i = 0; i < posAttr.count; i++) {
                indices.push(i + indexOffset);
            }
        }
        indexOffset += posAttr.count;
    });
    mergedGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
    if (normals.length > 0) {
        mergedGeo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(normals), 3));
    } else {
        mergedGeo.computeVertexNormals();
    }
    mergedGeo.setIndex(new THREE.BufferAttribute(new Uint32Array(indices), 1));
    mergedGeo.computeBoundingSphere();
    return mergedGeo;
}

// Uses bounding box height to match proxy scale across NEAR/MID/FAR tiers -> prevents popping

function getGeometryHeight(geometry) {
    if (!geometry) return 1.0;
    if (!geometry.boundingBox) geometry.computeBoundingBox();
    const bb = geometry.boundingBox;
    if (!bb) return 1.0;
    const h = bb.max.y - bb.min.y;
    return (isFinite(h) && h > 1e-5) ? h : 1.0;
}

// Discrete LOD selection with hysteresis dead-band to prevent flicker.

function calculateLODLevel(distance, currentLevel, nearDist, midDist, hysteresis) {
    // Symmetric hysteresis: upgrade/downgrade thresholds

    if (hysteresis <= 0) {
        if (distance < nearDist) return agentLOD.NEAR;
        if (distance < midDist) return agentLOD.MID;
        return agentLOD.FAR;
    }
    const half = hysteresis * 0.5;
    const nearDowngrade = nearDist + half;
    const midDowngrade  = midDist  + half;
    const nearUpgrade   = nearDist - half;
    const midUpgrade    = midDist  - half;
    if (currentLevel === agentLOD.NEAR) {
        if (distance > nearDowngrade) {
            if (distance > midDowngrade) return agentLOD.FAR;
            return agentLOD.MID;
        }
        return agentLOD.NEAR;
    } else if (currentLevel === agentLOD.MID) {
        if (distance < nearUpgrade)  return agentLOD.NEAR;
        if (distance > midDowngrade) return agentLOD.FAR;
        return agentLOD.MID;
    } else {
        if (distance < midUpgrade) {
            if (distance < nearUpgrade) return agentLOD.NEAR;
            return agentLOD.MID;
        }
        return agentLOD.FAR;
    }
}

// Hard step weights for LOD tiers when blending is disabled or invalid.

function setLodBlendHard(distance, nearDist, midDist, outWeights) {
    if (distance < nearDist) {
        outWeights.near = 1;
        outWeights.mid = 0;
        outWeights.far = 0;
    } else if (distance < midDist) {
        outWeights.near = 0;
        outWeights.mid = 1;
        outWeights.far = 0;
    } else {
        outWeights.near = 0;
        outWeights.mid = 0;
        outWeights.far = 1;
    }
}

// Computes continuous weights over a blend band to cross-fade between tiers.

function computeLodBlendWeights(distance, nearDist, midDist, blendDist, outWeights) {
    if (!outWeights) return null;

    const out = outWeights;

    if (!isFinite(blendDist) || blendDist <= 1e-5 || !isFinite(nearDist) || !isFinite(midDist) || midDist <= nearDist) {
        setLodBlendHard(distance, nearDist, midDist, out);
        return out;
    }

    const maxBlendNoOverlap = Math.max(0, (midDist - nearDist) * 0.5 - 1e-4);
    const blend = Math.min(blendDist, maxBlendNoOverlap > 1e-5 ? maxBlendNoOverlap : blendDist);
    if (blend <= 1e-5) {
        setLodBlendHard(distance, nearDist, midDist, out);
        return out;
    }

    const invBand = 1 / (2 * blend);
    const nearT = THREE.MathUtils.clamp((distance - (nearDist - blend)) * invBand, 0, 1);
    const farT = THREE.MathUtils.clamp((distance - (midDist - blend)) * invBand, 0, 1);

    let nearW = 1 - nearT;
    let midW = nearT - farT;
    let farW = farT;
    nearW = Math.max(0, nearW);
    midW = Math.max(0, midW);
    farW = Math.max(0, farW);

    const sum = nearW + midW + farW;
    if (sum > 1e-5) {
        const invSum = 1 / sum;
        out.near = nearW * invSum;
        out.mid = midW * invSum;
        out.far = farW * invSum;
    } else {
        out.near = 0;
        out.mid = 0;
        out.far = 1;
    }
    return out;
}

// Updates a world-space crosshair driven by mouse ray to plane intersection 

function updateMouseCrosshair() {
    if (!mouseCrosshair || !config.mouseControlDrones) {
        if (mouseCrosshair) mouseCrosshair.visible = false;
        return;
    }
    mouseCrosshair.visible = true;
    mouseCrosshair.position.copy(mouseControl.worldPos);
}

// Applies a simple seek velocity to all drones towards the mouse target.
// Demonstrates direct "desired velocity" control for testing navigation/IK responses.
function updateDroneMouseTargets() {
    if (!config.mouseControlDrones) return;
    const targetPos = mouseControl.getTargetPosition();
    for (let i = 0; i < agentSystem.drones.length; i++) {
        const drone = agentSystem.drones[i];
        const dx = targetPos.x - drone.position.x;
        const dy = targetPos.y - drone.position.y;
        const dz = targetPos.z - drone.position.z;
        const distToTarget = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (distToTarget > 0.1) {
            const speed = drone.speed * 1.2;
            drone.velocity.x = (dx / distToTarget) * speed;
            drone.velocity.y = (dy / distToTarget) * speed;
            drone.velocity.z = (dz / distToTarget) * speed;
        } else {
            drone.velocity.x *= 0.95;
            drone.velocity.z *= 0.95;
            drone.velocity.y *= 0.9;
        }
    }
}

function initializeAgentPaths() {
    agentDebug.initializeAgentPaths(agentSystem);
}

function updateAgentPathTrails() {
    agentDebug.updateAgentPathTrails(agentSystem, config.debugAgentPaths);
}

function drawDebugVisualization() {
    agentDebug.drawDebugVisualization(agentSystem, config, {
        agentLOD,
        skinnedAssignments: skinnedPool.assignmentSet,
        camera
    });
}

// Initialises AoS agents + SoA buffers (positions/velocities/walk cycles) for scale. 

function initAgentSystem() {
    agentSystem.pedestrianSoA.count = config.pedestrianCount;
    const pCount = config.pedestrianCount;
    agentSystem.pedestrianSoA.positions = new Float32Array(pCount * 3);
    agentSystem.pedestrianSoA.velocities = new Float32Array(pCount * 3);
    agentSystem.pedestrianSoA.speeds = new Float32Array(pCount);
    agentSystem.pedestrianSoA.walkCycles = new Float32Array(pCount);
    agentSystem.pedestrianSoA.skeletons = [];
    agentSystem.pedestrians = [];
    const pedBounds = getPedestrianBounds();
    const buildingExtension = BUILDINGS_ZONE.rowCount * (BUILDINGS_ZONE.buildingDepth + BUILDINGS_ZONE.spacing) + 40;
    const buildingEndZ = BUILDINGS_ZONE.startZ - buildingExtension;
    const treeZoneMinX = OPPOSITE_ROAD.centerX + OPPOSITE_ROAD.width / 2;
    const treeZoneMaxX = GREEN_LAYOUT.centerX + GREEN_LAYOUT.width / 2;
    const treeZoneMinZ = buildingEndZ;
    const treeZoneMaxZ = BUILDINGS_ZONE.startZ;
    const pedSpacingScale = getAgentSpacingScale('pedestrian');
    const wallSpawnClearance = 1.1 + pedSpacingScale * 1.6;
    const buildingSpawnClearance = 0.75 + pedSpacingScale * 0.9;
    const obstacleSpawnClearance = 0.55 + pedSpacingScale * 0.8;
    const pickPedestrianSpawn = () => {
        const spawnZone = Math.random();
        if (spawnZone < 0.28) {
            return {
                x: (Math.random() - 0.5) * 100,
                z: 17 + Math.random() * 30
            };
        }
        if (spawnZone < 0.56) {
            return {
                x: GREEN_LAYOUT.centerX + (Math.random() - 0.5) * GREEN_LAYOUT.width * 0.9,
                z: GREEN_LAYOUT.centerZ + (Math.random() - 0.5) * GREEN_LAYOUT.length * 0.9
            };
        }
        if (spawnZone < 0.78) {
            return {
                x: (Math.random() - 0.5) * 60,
                z: -15 + Math.random() * 30
            };
        }
        if (spawnZone < 0.93) {
            return {
                x: THREE.MathUtils.lerp(treeZoneMinX, treeZoneMaxX, Math.random()),
                z: THREE.MathUtils.lerp(treeZoneMinZ, treeZoneMaxZ, Math.random())
            };
        }
        return {
            x: THREE.MathUtils.lerp(pedBounds.minX + 4, pedBounds.maxX - 4, Math.random()),
            z: THREE.MathUtils.lerp(pedBounds.minZ + 4, pedBounds.maxZ - 4, Math.random())
        };
    };
    for (let i = 0; i < pCount; i++) {
        let x, z;
        let accepted = false;
        for (let attempt = 0; attempt < 28; attempt++) {
            const candidate = pickPedestrianSpawn();
            x = candidate.x;
            z = candidate.z;
            if (isNearWallBoundary(x, z, wallSpawnClearance)) continue;
            if (isInsideBuildingFootprints(x, z, mainBuildingFootprints, buildingSpawnClearance)) continue;
            if (isInsideBuildingFootprints(x, z, greenBuildingFootprints, buildingSpawnClearance)) continue;
            if (isNearStaticObstacle(x, platformHeight + 0.5, z, obstacleSpawnClearance, 'pedestrian')) continue;
            accepted = true;
            break;
        }
        if (!accepted) {
            for (let fallbackAttempt = 0; fallbackAttempt < 12; fallbackAttempt++) {
                x = THREE.MathUtils.lerp(pedBounds.minX + 6, pedBounds.maxX - 6, Math.random());
                z = THREE.MathUtils.lerp(pedBounds.minZ + 6, pedBounds.maxZ - 6, Math.random());
                if (isNearWallBoundary(x, z, wallSpawnClearance)) continue;
                if (isInsideBuildingFootprints(x, z, mainBuildingFootprints, buildingSpawnClearance)) continue;
                if (isInsideBuildingFootprints(x, z, greenBuildingFootprints, buildingSpawnClearance)) continue;
                accepted = true;
                break;
            }
        }
        if (!accepted) {
            x = THREE.MathUtils.lerp(pedBounds.minX + 8, pedBounds.maxX - 8, Math.random());
            z = THREE.MathUtils.lerp(pedBounds.minZ + 8, pedBounds.maxZ - 8, Math.random());
        }
        const y = platformHeight + 0.5;
        setVec3Array(agentSystem.pedestrianSoA.positions, i, x, y, z);
        const initAngle = Math.random() * Math.PI * 2;
        const initSpeed = 2.0 + Math.random() * 2.0;
        setVec3Array(
            agentSystem.pedestrianSoA.velocities,
            i,
            Math.sin(initAngle) * initSpeed,
            0,
            Math.cos(initAngle) * initSpeed
        );
        agentSystem.pedestrianSoA.speeds[i] = 4.5 + Math.random() * 1.5;
        agentSystem.pedestrianSoA.walkCycles[i] = Math.random() * Math.PI * 2;
        const rootPos = new THREE.Vector3(x, y + FK_PELVIS_HEIGHT, z);
        const skeleton = createPedestrianSkeleton(rootPos);
        agentSystem.pedestrianSoA.skeletons.push(skeleton);
        const agent = new Pedestrian(new THREE.Vector3(x, y, z), agentSystem.pedestrianSoA.speeds[i]);
        agent.velocity.set(
            agentSystem.pedestrianSoA.velocities[i*3 + 0],
            0,
            agentSystem.pedestrianSoA.velocities[i*3 + 2]
        );
        agent.wanderAngle = initAngle;
        agentSystem.pedestrians.push(agent);
    }
    agentSystem.droneSoA.count = config.droneCount;
    const dCount = config.droneCount;
    agentSystem.droneSoA.positions = new Float32Array(dCount * 3);
    agentSystem.droneSoA.velocities = new Float32Array(dCount * 3);
    agentSystem.droneSoA.speeds = new Float32Array(dCount);
    agentSystem.droneSoA.skeletons = [];
    agentSystem.drones = [];
    const droneBounds = getDroneBounds();
    for (let i = 0; i < dCount; i++) {
        const x = THREE.MathUtils.lerp(droneBounds.minX + 6, droneBounds.maxX - 6, Math.random());
        const z = THREE.MathUtils.lerp(droneBounds.minZ + 6, droneBounds.maxZ - 6, Math.random());
        const y = 10 + Math.random() * 15;
        setVec3Array(agentSystem.droneSoA.positions, i, x, y, z);
        const initAngleXZ = Math.random() * Math.PI * 2;
        const initSpeed = 4.0 + Math.random() * 3.0;
        setVec3Array(
            agentSystem.droneSoA.velocities,
            i,
            Math.sin(initAngleXZ) * initSpeed,
            (Math.random() - 0.5) * 2.0,
            Math.cos(initAngleXZ) * initSpeed
        );
        agentSystem.droneSoA.speeds[i] = 6.0 + Math.random() * 3.0;
        const agent = new Drone(new THREE.Vector3(x, y, z), agentSystem.droneSoA.speeds[i]);
        agent.velocity.set(
            agentSystem.droneSoA.velocities[i*3 + 0],
            agentSystem.droneSoA.velocities[i*3 + 1],
            agentSystem.droneSoA.velocities[i*3 + 2]
        );
        agent.wanderAngleXZ = initAngleXZ;
        agent.wanderAngleY = 0;
        const skeleton = createDroneSkeleton(new THREE.Vector3(x, y, z));
        agentSystem.droneSoA.skeletons.push(skeleton);
        agentSystem.drones.push(agent);
    }
    agentSystem.allAgents = agentSystem.pedestrians.concat(agentSystem.drones);
}

// Main update loop: rebuild spatial grid, update AoS agents (steering), then SoA passes.

function updateAgents(dt) {
    // Structure of Arrays for cache-efficient linear passes.
    // Phase A: AoS for steering & physics, which require cross-agent lookups that are more naturally expressed object-by-object.
    // Phase B: SoA for linear passes that consume scalar data (walkCycles, skeleton root positions) for the entire population.
    const allAgents = agentSystem.allAgents;
    raycastFrameIndex++;
    refreshRaycastTargetsIfNeeded();
    // Phase A: AoS spatial grid rebuild + physics update
    clearAgentSpatialGrid();
    for (let i = 0; i < allAgents.length; i++) {
        const agent = allAgents[i];
        const cellX = Math.floor(agent.position.x / AGENT_CELL_SIZE);
        const cellZ = Math.floor(agent.position.z / AGENT_CELL_SIZE);
        const key = packCellKey(cellX, cellZ);
        getBucketForKey(key).push(agent);
    }
    for (let i = 0; i < allAgents.length; i++) {
        allAgents[i].update(dt, agentSpatialGrid, staticObstacleGrid);
    }
    // Phase B: SoA linear passes 
    const pCount = agentSystem.pedestrianSoA.count;
    const pedPositions  = agentSystem.pedestrianSoA.positions; 
    const pedWalkCycles = agentSystem.pedestrianSoA.walkCycles;
    const pedLodLevels  = agentLOD.pedestrianLevels;
    for (let i = 0; i < pCount; i++) {
        if (i < agentSystem.pedestrians.length) {
            const agent = agentSystem.pedestrians[i];
            // Linear write into SoA position buffer — single cache line covers all 3 floats
            const o = i * 3;
            pedPositions[o]     = agent.position.x;
            pedPositions[o + 1] = agent.position.y;
            pedPositions[o + 2] = agent.position.z;
            pedWalkCycles[i] = agent.walkCycle;
        }
        const lodLevel = pedLodLevels ? pedLodLevels[i] : agentLOD.NEAR;
        if (lodLevel !== agentLOD.NEAR) continue;

        const skeleton = agentSystem.pedestrianSoA.skeletons[i];
        const agent = agentSystem.pedestrians[i];
        if (!skeleton || !agent) continue;
        const o = i * 3;
        skeleton.rootPosition.set(pedPositions[o], pedPositions[o + 1] + FK_PELVIS_HEIGHT, pedPositions[o + 2]);
        const pelvis = skeleton.getBone('pelvis');
        if (pelvis) pelvis.localRotation.copy(agent.rotation);
        animatePedestrianSkeleton(skeleton, pedWalkCycles[i]);
    }
    const dCount = agentSystem.droneSoA.count;
    const dronePositions = agentSystem.droneSoA.positions;
    const droneVelocities = agentSystem.droneSoA.velocities;
    const droneSkeletons = agentSystem.droneSoA.skeletons;
    const droneLodLevels = agentLOD.droneLevels;
    const updateAllDroneSkeletons = !!config.debugSkeletons;
    for (let i = 0; i < dCount; i++) {
        if (i < agentSystem.drones.length) {
            const agent = agentSystem.drones[i];
            const o = i * 3;
            dronePositions[o]     = agent.position.x;
            dronePositions[o + 1] = agent.position.y;
            dronePositions[o + 2] = agent.position.z;
            droneVelocities[o]     = agent.velocity.x;
            droneVelocities[o + 1] = agent.velocity.y;
            droneVelocities[o + 2] = agent.velocity.z;
        }

        const agent = agentSystem.drones[i];
        const skeleton = droneSkeletons[i];
        if (!agent || !skeleton) continue;
        const lodLevel = droneLodLevels ? droneLodLevels[i] : agentLOD.NEAR;
        if (!updateAllDroneSkeletons && lodLevel === agentLOD.FAR) continue;

        skeleton.rootPosition.set(agent.position.x, agent.position.y, agent.position.z);
        const hub = skeleton.getBone('droneHub');
        if (hub) hub.localRotation.copy(agent.rotation);
        animateDroneSkeleton(skeleton, agent);
    }

    if (!config.agentLodEnabled) {
        updateInstancedMatrices();
    }
    updateAgentLightPools();
}

// CPU-side write into instanceMatrix buffers then mark needsUpdate for GPU upload.

function updateInstancedMatrices() {
    if (agentSystem.pedestrianInstanced && agentSystem.pedestrians.length > 0) {
        const array = agentSystem.pedestrianInstanced.instanceMatrix.array;
        for (let i = 0; i < agentSystem.pedestrians.length; i++) {
            const mat = agentSystem.pedestrians[i].getTransformMatrix();
            mat.toArray(array, i * 16);
        }
        agentSystem.pedestrianInstanced.instanceMatrix.needsUpdate = true;
    }
    if (agentSystem.droneInstanced && agentSystem.drones.length > 0) {
        const array = agentSystem.droneInstanced.instanceMatrix.array;
        for (let i = 0; i < agentSystem.drones.length; i++) {
            const mat = agentSystem.drones[i].getTransformMatrix();
            mat.toArray(array, i * 16);
        }
        agentSystem.droneInstanced.instanceMatrix.needsUpdate = true;
    }
    if (
        agentSystem.droneWingLeftUpperInstanced &&
        agentSystem.droneWingLeftLowerInstanced &&
        agentSystem.droneWingRightUpperInstanced &&
        agentSystem.droneWingRightLowerInstanced &&
        agentSystem.drones.length > 0
    ) {
        for (let i = 0; i < agentSystem.drones.length; i++) {
            setDroneWingMatrices(i, agentSystem.drones[i], true);
        }
        agentSystem.droneWingLeftUpperInstanced.instanceMatrix.needsUpdate = true;
        agentSystem.droneWingLeftLowerInstanced.instanceMatrix.needsUpdate = true;
        agentSystem.droneWingRightUpperInstanced.instanceMatrix.needsUpdate = true;
        agentSystem.droneWingRightLowerInstanced.instanceMatrix.needsUpdate = true;
    }
}

// Builds a single merged "mid/far" pedestrian mesh to support instancing.
// Keeps silhouettes readable while minimising triangle count and draw calls.

function createRealisticPedestrianGeometry() {
    // Combined geometry for instanced rendering (Mid/Far LOD tiers).
    const group = new THREE.Group();
    const designScale  = 0.2;
    const designYOffset = 1.0;
    const y = (v) => (v + designYOffset) * designScale;

    // Torso (shirt)
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(1.0 * designScale, 1.0 * designScale, 3.0 * designScale, 12, 1));
    torso.position.y = y(3.5);
    group.add(torso);

    // Head
    const head = new THREE.Mesh(new THREE.SphereGeometry(1.2 * designScale, 12, 10));
    head.position.y = y(5.8);
    group.add(head);

    // Legs
    const legGeo = new THREE.BoxGeometry(0.8 * designScale, 3.0 * designScale, 0.8 * designScale);
    legGeo.translate(0, -1.5 * designScale, 0);
    const leftLeg = new THREE.Mesh(legGeo);
    leftLeg.position.set(-0.6 * designScale, y(2.0), 0);
    group.add(leftLeg);
    const rightLeg = new THREE.Mesh(legGeo);
    rightLeg.position.set(0.6 * designScale, y(2.0), 0);
    group.add(rightLeg);

    // Arms
    const armGeo = new THREE.BoxGeometry(0.7 * designScale, 2.8 * designScale, 0.7 * designScale);
    armGeo.translate(0, -1.4 * designScale, 0);
    const leftArm = new THREE.Mesh(armGeo);
    leftArm.position.set(-1.4 * designScale, y(4.8), 0);
    group.add(leftArm);
    const rightArm = new THREE.Mesh(armGeo);
    rightArm.position.set(1.4 * designScale, y(4.8), 0);
    group.add(rightArm);

    return combineGeometries([torso, head, leftLeg, rightLeg, leftArm, rightArm]);
}

// Builds a single merged drone proxy mesh (body + arms + props) for instancing.
// Used as NEAR tier geometry before LOD proxies take over.
function createRealisticDroneGeometry() {
    const group = new THREE.Group();
    const body = new THREE.Mesh(new THREE.IcosahedronGeometry(0.22, 4));
    group.add(body);
    const armFL = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.65, 3, 8));
    armFL.position.set(-0.38, 0, -0.38);
    armFL.rotation.z = Math.PI / 4;
    group.add(armFL);
    const armFR = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.65, 3, 8));
    armFR.position.set(0.38, 0, -0.38);
    armFR.rotation.z = -Math.PI / 4;
    group.add(armFR);
    const armRL = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.65, 3, 8));
    armRL.position.set(-0.38, 0, 0.38);
    armRL.rotation.z = Math.PI / 4;
    group.add(armRL);
    const armRR = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.65, 3, 8));
    armRR.position.set(0.38, 0, 0.38);
    armRR.rotation.z = -Math.PI / 4;
    group.add(armRR);
    const propFL = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.02, 32));
    propFL.position.set(-0.65, 0.1, -0.65);
    group.add(propFL);
    const propFR = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.02, 32));
    propFR.position.set(0.65, 0.1, -0.65);
    group.add(propFR);
    const propRL = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.02, 32));
    propRL.position.set(-0.65, 0.1, 0.65);
    group.add(propRL);
    const propRR = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.02, 32));
    propRR.position.set(0.65, 0.1, 0.65);
    group.add(propRR);
    const camera = new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 12));
    camera.position.y = -0.25;
    group.add(camera);
    return combineGeometries([body, armFL, armFR, armRL, armRR, propFL, propFR, propRL, propRR, camera]);
}

// Simple wing slab geometry (span/chord/thickness), anchored to hinge side.
// Used with skeleton-driven transforms (FK/IK) for procedural animation.
function createDroneWingGeometry(side = 'left', span = 0.34) {
    const thickness = 0.05;
    const chord = 0.22;
    const geo = new THREE.BoxGeometry(span, thickness, chord);
    const dir = side === 'left' ? -1 : 1;
    geo.translate(dir * span * 0.5, 0, 0);
    return geo;
}

// Creates InstancedMesh objects and per-instance colors for large populations.
// This is the core batching technique enabling thousands of animated entities.
function createInstancedAgents() {
    const pedestrianGeo = createRealisticPedestrianGeometry();
    const pedestrianMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        metalness: 0.0,
        roughness: 0.85,
        emissive: 0x000000,
        emissiveIntensity: 0.0
    });
    agentSystem.pedestrianInstanced = new THREE.InstancedMesh(
        pedestrianGeo,
        pedestrianMat,
        config.pedestrianCount
    );
    agentSystem.pedestrianInstanced.frustumCulled = true;
    for (let i = 0; i < config.pedestrianCount; i++) {
        const agent = agentSystem.pedestrians[i];
        const color = hashVector3ToColor(agent.position);
        agentSystem.pedestrianInstanced.setColorAt(i, color);
    }
    agentSystem.pedestrianInstanced.castShadow = false;
    agentSystem.pedestrianInstanced.receiveShadow = true;
    scene.add(agentSystem.pedestrianInstanced);
    const droneGeo = createRealisticDroneGeometry();
    const droneMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        metalness: 0.6,
        roughness: 0.35,
        emissive: 0x000000,
        emissiveIntensity: 0.0
    });
    setupAgentInstanceAlphaMaterial(droneMat);
    agentSystem.droneInstanced = new THREE.InstancedMesh(
        droneGeo,
        droneMat,
        config.droneCount
    );
    agentSystem.droneInstanced.frustumCulled = true;
    for (let i = 0; i < config.droneCount; i++) {
        const agent = agentSystem.drones[i];
        const color = hashVector3ToColor(agent.position);
        agentSystem.droneInstanced.setColorAt(i, color);
    }
    agentSystem.droneInstanced.castShadow = false;
    attachAgentInstanceAlphaAttribute(agentSystem.droneInstanced, 1.0);
    scene.add(agentSystem.droneInstanced);

    const droneWingLeftUpperGeo = createDroneWingGeometry('left', 0.34);
    const droneWingLeftLowerGeo = createDroneWingGeometry('left', 0.28);
    const droneWingRightUpperGeo = createDroneWingGeometry('right', 0.34);
    const droneWingRightLowerGeo = createDroneWingGeometry('right', 0.28);
    const droneWingMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        metalness: 0.5,
        roughness: 0.28,
        emissive: 0x000000,
        emissiveIntensity: 0.0
    });
    setupAgentInstanceAlphaMaterial(droneWingMat);
    agentSystem.droneWingLeftUpperInstanced = new THREE.InstancedMesh(
        droneWingLeftUpperGeo,
        droneWingMat,
        config.droneCount
    );
    agentSystem.droneWingLeftLowerInstanced = new THREE.InstancedMesh(
        droneWingLeftLowerGeo,
        droneWingMat,
        config.droneCount
    );
    agentSystem.droneWingRightUpperInstanced = new THREE.InstancedMesh(
        droneWingRightUpperGeo,
        droneWingMat,
        config.droneCount
    );
    agentSystem.droneWingRightLowerInstanced = new THREE.InstancedMesh(
        droneWingRightLowerGeo,
        droneWingMat,
        config.droneCount
    );
    agentSystem.droneWingLeftUpperInstanced.frustumCulled = true;
    agentSystem.droneWingLeftLowerInstanced.frustumCulled = true;
    agentSystem.droneWingRightUpperInstanced.frustumCulled = true;
    agentSystem.droneWingRightLowerInstanced.frustumCulled = true;
    for (let i = 0; i < config.droneCount; i++) {
        const agent = agentSystem.drones[i];
        const color = hashVector3ToColor(agent.position);
        agentSystem.droneWingLeftUpperInstanced.setColorAt(i, color);
        agentSystem.droneWingLeftLowerInstanced.setColorAt(i, color);
        agentSystem.droneWingRightUpperInstanced.setColorAt(i, color);
        agentSystem.droneWingRightLowerInstanced.setColorAt(i, color);
    }
    attachAgentInstanceAlphaAttribute(agentSystem.droneWingLeftUpperInstanced, 1.0);
    attachAgentInstanceAlphaAttribute(agentSystem.droneWingLeftLowerInstanced, 1.0);
    attachAgentInstanceAlphaAttribute(agentSystem.droneWingRightUpperInstanced, 1.0);
    attachAgentInstanceAlphaAttribute(agentSystem.droneWingRightLowerInstanced, 1.0);
    scene.add(agentSystem.droneWingLeftUpperInstanced);
    scene.add(agentSystem.droneWingLeftLowerInstanced);
    scene.add(agentSystem.droneWingRightUpperInstanced);
    scene.add(agentSystem.droneWingRightLowerInstanced);
    applyAgentLightMaterialSettings();
    updateInstancedMatrices();
}

// Rebuilds agent system + instanced meshes cleanly (debug reset + LOD rebuild).

function rebuildAgents() {
    agentDebug.resetPathPool();
    if (agentSystem.pedestrianInstanced) scene.remove(agentSystem.pedestrianInstanced);
    if (agentSystem.droneInstanced) scene.remove(agentSystem.droneInstanced);
    if (agentSystem.droneWingLeftUpperInstanced) scene.remove(agentSystem.droneWingLeftUpperInstanced);
    if (agentSystem.droneWingLeftLowerInstanced) scene.remove(agentSystem.droneWingLeftLowerInstanced);
    if (agentSystem.droneWingRightUpperInstanced) scene.remove(agentSystem.droneWingRightUpperInstanced);
    if (agentSystem.droneWingRightLowerInstanced) scene.remove(agentSystem.droneWingRightLowerInstanced);
    agentSystem.droneWingLeftUpperInstanced = null;
    agentSystem.droneWingLeftLowerInstanced = null;
    agentSystem.droneWingRightUpperInstanced = null;
    agentSystem.droneWingRightLowerInstanced = null;
        initAgentSystem();
        createInstancedAgents();
        initializeAgentPaths();
        updateInstancedMatrices();
        rebuildAgentLOD();
}

// Generates a simple billboard texture for MID/FAR pedestrian rendering.
// Supports cheap distant agents while preserving recognisable form and emissive style.

function createPedestrianBillboardTexture() {
    const canvas = document.createElement('canvas');
    canvas.width  = 64;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 64, 128);

    // Head
    ctx.fillStyle = '#E0AC69';
    ctx.beginPath();
    ctx.arc(32, 14, 10, 0, Math.PI * 2);
    ctx.fill();

    // Torso / shirt
    ctx.fillStyle = '#1565C0';
    ctx.beginPath();
    ctx.moveTo(18, 28);
    ctx.lineTo(46, 28);
    ctx.lineTo(42, 72);
    ctx.lineTo(22, 72);
    ctx.closePath();
    ctx.fill();

    // Arms
    ctx.fillStyle = '#1565C0';
    ctx.fillRect(8,  28, 10, 36);  
    ctx.fillRect(46, 28, 10, 36);

    // Trousers (dark)
    ctx.fillStyle = '#212121';
    ctx.fillRect(22, 72, 9, 52);
    ctx.fillRect(33, 72, 9, 52);

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
}

// Low-detail proxy geometry for drones (octahedron) for far LOD tiers.
// Keeps silhouette + emissive response while reducing vertex cost.

function createLowDetailDroneGeometry() {
    return new THREE.OctahedronGeometry(0.55, 0);
}

function initAgentLOD() {
    agentLOD.pedestrianBillboardTex = null;
    agentLOD.droneBillboardTex = null;
}

// Patches material shaders to support per-instance alpha (InstancedBufferAttribute).
// Enables LOD cross-fades and "hide by alpha" without per-instance materials.

function setupAgentInstanceAlphaMaterial(material) {
    if (!material || material.userData._agentInstanceAlphaPatched) return;
    material.userData._agentInstanceAlphaPatched = true;
    material.transparent = true;
    const prevOnBeforeCompile = material.onBeforeCompile;
    material.onBeforeCompile = (shader, renderer) => {
        if (typeof prevOnBeforeCompile === 'function') {
            prevOnBeforeCompile(shader, renderer);
        }

        if (!shader.vertexShader.includes('attribute float instanceAlpha;')) {
            shader.vertexShader = [
                'attribute float instanceAlpha;',
                'varying float vInstanceAlpha;',
                shader.vertexShader
            ].join('\n');
        }

        shader.vertexShader = shader.vertexShader.replace(
            '#include <begin_vertex>',
            [
                '#include <begin_vertex>',
                'vInstanceAlpha = instanceAlpha;'
            ].join('\n')
        );

        if (!shader.fragmentShader.includes('varying float vInstanceAlpha;')) {
            shader.fragmentShader = [
                'varying float vInstanceAlpha;',
                shader.fragmentShader
            ].join('\n');
        }

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

// Attaches/initialises instanceAlpha attribute sized to instance count.
// Provides a lightweight control channel for LOD fades and debug visibility.

function attachAgentInstanceAlphaAttribute(mesh, initialValue = 1.0, cloneGeometry = false) {
    if (!mesh) return;
    if (cloneGeometry && mesh.geometry) mesh.geometry = mesh.geometry.clone();
    const maxCount = mesh.instanceMatrix?.count ?? mesh.count ?? 0;
    if (maxCount <= 0) return;
    const attr = mesh.geometry?.getAttribute('instanceAlpha');
    if (!attr || attr.count !== maxCount) {
        const buf = new Float32Array(maxCount).fill(initialValue);
        mesh.geometry.setAttribute('instanceAlpha', new THREE.InstancedBufferAttribute(buf, 1));
    } else {
        attr.array.fill(initialValue);
        attr.needsUpdate = true;
    }
}

// Accessor for instanceAlpha buffer used by LOD transitions.

function getAgentInstanceAlphaArray(mesh) {
    return mesh?.geometry?.getAttribute('instanceAlpha')?.array || null;
}

// Marks instanceAlpha dirty so GPU receives updated attribute values.

function markAgentInstanceAlphaDirty(mesh) {
    const attr = mesh?.geometry?.getAttribute('instanceAlpha');
    if (attr) attr.needsUpdate = true;
}

// Bulk fill helper for instanceAlpha (e.g., force all visible/invisible).

function fillAgentInstanceAlpha(mesh, value, count = null) {
    const arr = getAgentInstanceAlphaArray(mesh);
    if (!arr) return;
    const limit = Math.min(arr.length, count ?? arr.length);
    for (let i = 0; i < limit; i++) arr[i] = value;
    markAgentInstanceAlphaDirty(mesh);
}

// Adds a perceived animation without skeleton evaluation at distance to make it computationally cheaper

function registerMidTierVertexAnimation(material, mode) {
    if (!material) return;
    const prevOnBeforeCompile = material.onBeforeCompile;
    material.onBeforeCompile = (shader, renderer) => {
        if (typeof prevOnBeforeCompile === 'function') {
            prevOnBeforeCompile(shader, renderer);
        }
        shader.uniforms.uLodAnimTime = { value: 0 };
        material.userData.lodAnimShader = shader;
        const animationSnippet = mode === 'pedestrian'
            ? `
                vec3 instanceOrigin = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
                float phase = uLodAnimTime * 4.0 + instanceOrigin.x * 0.35 + instanceOrigin.z * 0.22;
                float legMask = 1.0 - smoothstep(0.15, 0.95, transformed.y);
                float torsoMask = smoothstep(0.2, 1.05, transformed.y);
                transformed.y += abs(sin(phase + transformed.x * 5.0)) * 0.03 * legMask;
                transformed.x += sin(phase + transformed.y * 6.0) * 0.02 * torsoMask;
            `
            : `
                vec3 instanceOrigin = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
                float phase = uLodAnimTime * 8.0 + instanceOrigin.x * 0.31 + instanceOrigin.z * 0.27;
                transformed.y += sin(phase + position.x * 14.0 + position.z * 14.0) * 0.03;
                transformed.x += cos(phase * 0.5 + position.y * 10.0) * 0.01;
            `;
        shader.vertexShader = `uniform float uLodAnimTime;\n${shader.vertexShader}`;
        shader.vertexShader = shader.vertexShader.replace(
            '#include <begin_vertex>',
            `#include <begin_vertex>\n${animationSnippet}`
        );
    };
    material.needsUpdate = true;
    _lodAnimatedMaterials.push(material);
}

// Updates shared animation time uniform for all patched MID-tier materials.

function updateMidTierVertexAnimationTime(timeSeconds) {
    for (let i = 0; i < _lodAnimatedMaterials.length; i++) {
        const shader = _lodAnimatedMaterials[i]?.userData?.lodAnimShader;
        if (shader && shader.uniforms && shader.uniforms.uLodAnimTime) {
            shader.uniforms.uLodAnimTime.value = timeSeconds;
        }
    }
}

// Creates a mesh-segment "skinned" pedestrian (rigid parts + blend spheres).

function createSkinnedPedestrian(slotIndex = 0) {
    const group = new THREE.Group();
    group.visible = false;

    const designScale  = 0.2;
    const designYOffset = 1.0;
    const y = (v) => (v + designYOffset) * designScale;

    const skinHex    = PEDESTRIAN_SKIN_TONES   [slotIndex % PEDESTRIAN_SKIN_TONES.length];
    const clothHex   = PEDESTRIAN_CLOTHING_COLS[slotIndex % PEDESTRIAN_CLOTHING_COLS.length];

    const skinMat   = new THREE.MeshStandardMaterial({ color: skinHex,              roughness: 0.9,  metalness: 0.0, transparent: true, opacity: 1.0 });
    const clothMat  = new THREE.MeshStandardMaterial({ color: clothHex,             roughness: 0.85, metalness: 0.0, transparent: true, opacity: 1.0 });
    const pantsMat  = new THREE.MeshStandardMaterial({ color: PEDESTRIAN_PANTS_COL, roughness: 0.9,  metalness: 0.0, transparent: true, opacity: 1.0 });

    group.userData.skinMat  = skinMat;
    group.userData.clothMat = clothMat;
    group.userData.pantsMat = pantsMat;

    // Torso
    const torsoMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(1.0 * designScale, 1.0 * designScale, 3.0 * designScale, 12, 1),
        clothMat
    );
    torsoMesh.name = 'torso';
    torsoMesh.userData.isStatic = true;
    torsoMesh.userData.staticY  = y(3.5);
    group.add(torsoMesh);

    // Head
    const headMesh = new THREE.Mesh(
        new THREE.SphereGeometry(1.2 * designScale, 12, 10),
        skinMat
    );
    headMesh.name = 'head';
    headMesh.userData.isStatic = true;
    headMesh.userData.staticY  = y(5.8);
    group.add(headMesh);

    // Arms
    const upperArmGeo = new THREE.BoxGeometry(0.7 * designScale, 1.4 * designScale, 0.7 * designScale);
    const lowerArmGeo = new THREE.BoxGeometry(0.65 * designScale, 1.4 * designScale, 0.65 * designScale);

    const lUpperArm = new THREE.Mesh(upperArmGeo, clothMat);
    lUpperArm.name = 'leftUpperArm';
    lUpperArm.userData.bone = 'leftUpperArm';
    group.add(lUpperArm);

    const lForearm = new THREE.Mesh(lowerArmGeo, clothMat);
    lForearm.name = 'leftForearm';
    lForearm.userData.bone = 'leftLowerArm';
    group.add(lForearm);

    const lHand = new THREE.Mesh(
        new THREE.BoxGeometry(0.22 * designScale, 0.36 * designScale, 0.22 * designScale),
        skinMat
    );
    lHand.name = 'leftHand';
    lHand.userData.bone   = 'leftLowerArm';
    lHand.userData.atTip  = true;
    group.add(lHand);

    const rUpperArm = new THREE.Mesh(upperArmGeo, clothMat);
    rUpperArm.name = 'rightUpperArm';
    rUpperArm.userData.bone = 'rightUpperArm';
    group.add(rUpperArm);

    const rForearm = new THREE.Mesh(lowerArmGeo, clothMat);
    rForearm.name = 'rightForearm';
    rForearm.userData.bone = 'rightLowerArm';
    group.add(rForearm);

    const rHand = new THREE.Mesh(
        new THREE.BoxGeometry(0.22 * designScale, 0.36 * designScale, 0.22 * designScale),
        skinMat
    );
    rHand.name = 'rightHand';
    rHand.userData.bone  = 'rightLowerArm';
    rHand.userData.atTip = true;
    group.add(rHand);

    // Shoulder / Elbow Blend Spheres
    const lShoulderBlend = new THREE.Mesh(new THREE.SphereGeometry(0.22 * designScale, 8, 6), clothMat);
    lShoulderBlend.name = 'leftShoulderBlend';
    lShoulderBlend.userData.blendBones   = ['spine', 'leftUpperArm'];
    lShoulderBlend.userData.blendWeights = [0.5, 0.5];
    lShoulderBlend.userData.blendUseTips = [true, false];
    group.add(lShoulderBlend);

    const lElbowBlend = new THREE.Mesh(new THREE.SphereGeometry(0.18 * designScale, 8, 6), clothMat);
    lElbowBlend.name = 'leftElbowBlend';
    lElbowBlend.userData.blendBones   = ['leftUpperArm', 'leftLowerArm'];
    lElbowBlend.userData.blendWeights = [0.5, 0.5];
    group.add(lElbowBlend);

    const rShoulderBlend = new THREE.Mesh(new THREE.SphereGeometry(0.22 * designScale, 8, 6), clothMat);
    rShoulderBlend.name = 'rightShoulderBlend';
    rShoulderBlend.userData.blendBones   = ['spine', 'rightUpperArm'];
    rShoulderBlend.userData.blendWeights = [0.5, 0.5];
    rShoulderBlend.userData.blendUseTips = [true, false];
    group.add(rShoulderBlend);

    const rElbowBlend = new THREE.Mesh(new THREE.SphereGeometry(0.18 * designScale, 8, 6), clothMat);
    rElbowBlend.name = 'rightElbowBlend';
    rElbowBlend.userData.blendBones   = ['rightUpperArm', 'rightLowerArm'];
    rElbowBlend.userData.blendWeights = [0.5, 0.5];
    group.add(rElbowBlend);

    // Legs
    const lThigh = new THREE.Mesh(
        new THREE.BoxGeometry(0.8 * designScale, 1.5 * designScale, 0.8 * designScale), pantsMat
    );
    lThigh.name = 'leftThigh';
    lThigh.userData.isLeg   = true;
    lThigh.userData.legSide = 'left';
    lThigh.userData.legPart = 'thigh';
    group.add(lThigh);

    const lCalf = new THREE.Mesh(
        new THREE.BoxGeometry(0.75 * designScale, 1.5 * designScale, 0.75 * designScale), pantsMat
    );
    lCalf.name = 'leftCalf';
    lCalf.userData.isLeg   = true;
    lCalf.userData.legSide = 'left';
    lCalf.userData.legPart = 'calf';
    group.add(lCalf);

    const lFoot = new THREE.Mesh(
        new THREE.BoxGeometry(0.9 * designScale, 0.35 * designScale, 1.4 * designScale),
        new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.95 }) // shoes
    );
    lFoot.name = 'leftFoot';
    lFoot.userData.isLeg   = true;
    lFoot.userData.legSide = 'left';
    lFoot.userData.legPart = 'foot';
    group.add(lFoot);

    const rThigh = new THREE.Mesh(
        new THREE.BoxGeometry(0.8 * designScale, 1.5 * designScale, 0.8 * designScale), pantsMat
    );
    rThigh.name = 'rightThigh';
    rThigh.userData.isLeg   = true;
    rThigh.userData.legSide = 'right';
    rThigh.userData.legPart = 'thigh';
    group.add(rThigh);

    const rCalf = new THREE.Mesh(
        new THREE.BoxGeometry(0.75 * designScale, 1.5 * designScale, 0.75 * designScale), pantsMat
    );
    rCalf.name = 'rightCalf';
    rCalf.userData.isLeg   = true;
    rCalf.userData.legSide = 'right';
    rCalf.userData.legPart = 'calf';
    group.add(rCalf);

    const rFoot = new THREE.Mesh(
        new THREE.BoxGeometry(0.9 * designScale, 0.35 * designScale, 1.4 * designScale),
        new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.95 })
    );
    rFoot.name = 'rightFoot';
    rFoot.userData.isLeg   = true;
    rFoot.userData.legSide = 'right';
    rFoot.userData.legPart = 'foot';
    group.add(rFoot);

    return group;
}

// Preallocates a fixed pool of skinned pedestrians and reassigns by camera distance.
// Caps expensive near-detail rendering cost while keeping far agents cheap (LOD system).

function initSkinnedPool() {
    skinnedPool.meshes.forEach(g => scene.remove(g));
    skinnedPool.meshes = [];
    skinnedPool.activeCount = 0;
    skinnedPool.assignments = [];
    skinnedPool.assignmentSet.clear();
    for (let i = 0; i < LBS_POOL_SIZE; i++) {
        const skinned = createSkinnedPedestrian(i);
        skinned.visible = false;
        scene.add(skinned);
        skinnedPool.meshes.push(skinned);
    }
    applyAgentLightMaterialSettings();
}

// Updates a skinned pedestrian's mesh segments based on its assigned agent's skeleton pose.
// Cheaper animation for more distance agents

function applyLBSToPoolSlot(slotIndex, agent, skeleton) {
    const group = skinnedPool.meshes[slotIndex];
    if (!group) return;
    group.position.copy(agent.position);
    let groupAngle = 0;
    if (agent.velocity.lengthSq() > 0.01) {
        groupAngle = Math.atan2(agent.velocity.x, agent.velocity.z);
    }
    group.rotation.set(0, groupAngle, 0);
    group.scale.copy(agent.scale);
    const agentIdx = agentSystem.pedestrians.indexOf(agent);
    const fadeAlpha = (agentLOD.skinnedAlpha && agentIdx >= 0) ? agentLOD.skinnedAlpha[agentIdx] : 1.0;
    group.visible = fadeAlpha > 0.01;
    if (!group.visible) return;
    if (agentIdx >= 0 && group.userData.clothMat && group.userData.skinMat) {
        const alpha = Math.min(fadeAlpha, 1.0);
        group.userData.skinMat.opacity  = alpha;
        group.userData.clothMat.opacity = alpha;
        if (group.userData.pantsMat) group.userData.pantsMat.opacity = alpha;
        const newSkinHex  = PEDESTRIAN_SKIN_TONES   [agentIdx % PEDESTRIAN_SKIN_TONES.length];
        const newClothHex = PEDESTRIAN_CLOTHING_COLS[agentIdx % PEDESTRIAN_CLOTHING_COLS.length];
        group.userData.skinMat.color.setHex(newSkinHex);
        group.userData.clothMat.color.setHex(newClothHex);
    }
    _lbsInvGroupQuat.setFromAxisAngle(_lbsYAxis, -groupAngle);
    function boneToLocal(bonePos, out = _lbsTmpPos) {
        out.copy(bonePos).sub(agent.position);
        out.applyQuaternion(_lbsInvGroupQuat);
        return out;
    }
    function boneAnchorToLocal(bone, atTip, out = _lbsTmpPos) {
        _lbsTmpPos2.copy(bone.position);
        if (atTip) {
            _lbsBoneDir.copy(bone.dir).multiplyScalar(bone.length).applyQuaternion(bone.rotation);
            _lbsTmpPos2.add(_lbsBoneDir);
        }
        return boneToLocal(_lbsTmpPos2, out);
    }
    group.children.forEach(mesh => {
        const ud = mesh.userData;
        if (ud.isStatic) {
            mesh.position.set(0, ud.staticY, 0);
            mesh.quaternion.identity();
        } else if (ud.isLeg) {
            // Mesh segment positioned at its corresponding FK bone world position.

            const legBoneMap = {
                leftThigh:  'leftThigh',  leftCalf:  'leftCalf',  leftFoot:  'leftFoot',
                rightThigh: 'rightThigh', rightCalf: 'rightCalf', rightFoot: 'rightFoot'
            };
            const boneName = legBoneMap[mesh.name];
            if (boneName) {
                const bone = skeleton.getBone(boneName);
                if (bone) {
                    const localBonePos = boneToLocal(bone.position);
                    _lbsQuat.copy(_lbsInvGroupQuat).multiply(bone.rotation);
                    _lbsBoneDir.copy(bone.dir).multiplyScalar(bone.length * 0.5).applyQuaternion(_lbsQuat);
                    mesh.position.copy(localBonePos).add(_lbsBoneDir);
                    mesh.quaternion.copy(_lbsQuat);
                }
            }
        } else if (ud.blendBones) {
            const bone1 = skeleton.getBone(ud.blendBones[0]);
            const bone2 = skeleton.getBone(ud.blendBones[1]);
            const w1 = ud.blendWeights[0];
            const w2 = ud.blendWeights[1];
            if (bone1 && bone2) {
                const useTips = ud.blendUseTips;
                const local1 = boneAnchorToLocal(bone1, !!(useTips && useTips[0]), _lbsTmpPos);
                _lbsBlendPos.copy(local1).multiplyScalar(w1);
                const local2 = boneAnchorToLocal(bone2, !!(useTips && useTips[1]), _lbsTmpPos2);
                _lbsPos.copy(local2).multiplyScalar(w2);
                mesh.position.copy(_lbsBlendPos).add(_lbsPos);
                _lbsQuat.copy(bone1.rotation);
                _lbsBlendQuat.copy(bone2.rotation);
                mesh.quaternion.copy(_lbsQuat).slerp(_lbsBlendQuat, w2);
                mesh.quaternion.premultiply(_lbsInvGroupQuat);
            }
        } else if (ud.bone) {
            const bone = skeleton.getBone(ud.bone);
            if (bone) {
                const localBonePos = boneToLocal(bone.position);
                _lbsPos.copy(localBonePos);
                _lbsQuat.copy(_lbsInvGroupQuat).multiply(bone.rotation);
                if (ud.atTip) {
                    _lbsBoneDir.copy(bone.dir).multiplyScalar(bone.length);
                    _lbsBoneDir.applyQuaternion(_lbsQuat);
                    mesh.position.copy(_lbsPos).add(_lbsBoneDir);
                } else if (ud.offsetY !== undefined) {
                    _lbsBoneDir.copy(bone.dir).multiplyScalar(bone.length);
                    _lbsBoneDir.applyQuaternion(_lbsQuat);
                    _lbsPos.add(_lbsBoneDir);
                    _lbsBoneDir.set(0, ud.offsetY, 0);
                    _lbsBoneDir.applyQuaternion(_lbsQuat);
                    mesh.position.copy(_lbsPos).add(_lbsBoneDir);
                } else {
                    _lbsBoneDir.copy(bone.dir).multiplyScalar(bone.length * 0.5);
                    _lbsBoneDir.applyQuaternion(_lbsQuat);
                    mesh.position.copy(_lbsPos).add(_lbsBoneDir);
                }
                mesh.quaternion.copy(_lbsQuat);
            }
        }
    });
}

// Selects nearest pedestrians for the skinned pool and fades assignments smoothly, preventing popping

function updateSkinnedPool(camPos) {
    const buf = skinnedPool._sortBuffer;
    let bufCount = 0;
    const pedCount = agentSystem.pedestrians.length;
    const nearDist = config.agentLodNearDist;
    const poolDist = nearDist * LBS_POOL_DIST_FRACTION;
    const poolDistSq = poolDist * poolDist;
    for (let i = 0; i < pedCount; i++) {
        const agent = agentSystem.pedestrians[i];
        const dx = camPos.x - agent.position.x;
        const dy = camPos.y - agent.position.y;
        const dz = camPos.z - agent.position.z;
        const distSq = dx*dx + dy*dy + dz*dz;
        if (distSq < poolDistSq) {
            let entry = buf[bufCount];
            if (!entry) { entry = { index: 0, distSq: 0 }; buf[bufCount] = entry; }
            entry.index = i;
            entry.distSq = distSq;
            bufCount++;
        }
    }
    buf.length = bufCount;
    buf.sort((a, b) => a.distSq - b.distSq);
    const assignCount = Math.min(buf.length, LBS_POOL_SIZE);
    skinnedPool.activeCount = assignCount;
    skinnedPool.assignments.length = 0;
    skinnedPool.assignmentSet.clear();
    for (let slot = 0; slot < assignCount; slot++) {
        skinnedPool.assignments.push(buf[slot].index);
        skinnedPool.assignmentSet.add(buf[slot].index);
    }
    for (let slot = 0; slot < assignCount; slot++) {
        const agentIdx = buf[slot].index;
        applyLBSToPoolSlot(slot, agentSystem.pedestrians[agentIdx],
            agentSystem.pedestrianSoA.skeletons[agentIdx]);
    }
    if (agentLOD.skinnedAlpha) {
        for (let i = 0; i < pedCount; i++) {
            const target  = skinnedPool.assignmentSet.has(i) ? 1.0 : 0.0;
            const current = agentLOD.skinnedAlpha[i];
            agentLOD.skinnedAlpha[i] = current + Math.sign(target - current) * Math.min(LBS_FADE_RATE, Math.abs(target - current));
        }
    }
    for (let slot = assignCount; slot < LBS_POOL_SIZE; slot++) {
        if (skinnedPool.meshes[slot]) skinnedPool.meshes[slot].visible = false;
    }
    return skinnedPool.assignmentSet;
}

// Constructs NEAR/MID/FAR render assets and normalises proxy scaling

function rebuildAgentLOD() {
    if (agentLOD.pedestrianMid) scene.remove(agentLOD.pedestrianMid);
    if (agentLOD.pedestrianFar) scene.remove(agentLOD.pedestrianFar);
    if (agentLOD.droneMid) scene.remove(agentLOD.droneMid);
    if (agentLOD.droneFar) scene.remove(agentLOD.droneFar);
    agentLOD.pedestrianMid = null;
    agentLOD.pedestrianFar = null;
    agentLOD.droneMid = null;
    agentLOD.droneFar = null;
    agentLOD.pedestrianMidScale = 1.0;
    agentLOD.pedestrianFarScale = 1.0;
    agentLOD.droneMidScale = 1.0;
    agentLOD.droneFarScale = 1.0;
    _lodAnimatedMaterials.length = 0;
    initSkinnedPool();
    if (!config.agentLodEnabled) return;
    const pedCount   = config.pedestrianCount;
    const droneCount = config.droneCount;
    agentLOD.pedestrianLevels = new Array(pedCount).fill(agentLOD.NEAR);
    agentLOD.droneLevels      = new Array(droneCount).fill(agentLOD.NEAR);
    agentLOD.skinnedAlpha = new Float32Array(pedCount);
    attachAgentInstanceAlphaAttribute(agentSystem.droneInstanced, 1.0);
    attachAgentInstanceAlphaAttribute(agentSystem.droneWingLeftUpperInstanced, 1.0);
    attachAgentInstanceAlphaAttribute(agentSystem.droneWingLeftLowerInstanced, 1.0);
    attachAgentInstanceAlphaAttribute(agentSystem.droneWingRightUpperInstanced, 1.0);
    attachAgentInstanceAlphaAttribute(agentSystem.droneWingRightLowerInstanced, 1.0);

    // Keep MID/FAR proxy dimensions identical and foot-anchored so transitions do not pop.
    const pedBillboardWidth = 0.5;
    const pedBillboardHeight = 1.0;
    const pedestrianProxyGeoBase = new THREE.PlaneGeometry(pedBillboardWidth, pedBillboardHeight);
    pedestrianProxyGeoBase.translate(0, pedBillboardHeight * 0.5, 0);
    const droneProxyGeoBase = createLowDetailDroneGeometry();

    // MID LOD tier - approximate body billboard with emissive glow.
    const pedMidTex = createPedestrianBillboardTexture();
    const pedMidMat = new THREE.MeshStandardMaterial({
        map: pedMidTex,
        transparent: true,
        alphaTest: 0.25,
        side: THREE.DoubleSide,
        depthWrite: true,
        depthTest: true,
        emissive: 0x4169e1,
        emissiveIntensity: config.pedestrianLightIntensity
    });
    setupAgentInstanceAlphaMaterial(pedMidMat);
    agentLOD.pedestrianMid = new THREE.InstancedMesh(pedestrianProxyGeoBase.clone(), pedMidMat, pedCount);
    agentLOD.pedestrianMid.frustumCulled = true;
    agentLOD.pedestrianMid.visible = true;
    attachAgentInstanceAlphaAttribute(agentLOD.pedestrianMid, 1.0);
    scene.add(agentLOD.pedestrianMid);

    // FAR LOD tier - same proxy dimensions as MID to avoid perceived size popping.
    const pedFarTex = createPedestrianBillboardTexture();  // Same texture as MID
    const pedFarMat = new THREE.MeshStandardMaterial({
        map: pedFarTex,
        transparent: true,
        alphaTest: 0.25,
        side: THREE.DoubleSide,
        depthWrite: true,
        depthTest: true,
        emissive: 0x4169e1,
        emissiveIntensity: config.pedestrianLightIntensity
    });
    setupAgentInstanceAlphaMaterial(pedFarMat);
    agentLOD.pedestrianFar = new THREE.InstancedMesh(pedestrianProxyGeoBase.clone(), pedFarMat, pedCount);
    agentLOD.pedestrianFar.frustumCulled = true;
    agentLOD.pedestrianFar.visible = true;
    attachAgentInstanceAlphaAttribute(agentLOD.pedestrianFar, 0.0);
    scene.add(agentLOD.pedestrianFar);

    const droneMidMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        metalness: 0.6,
        roughness: 0.35,
        transparent: true,
        opacity: 1.0,
        emissive: 0x2ecc71,
        emissiveIntensity: config.droneLightIntensity * 0.7
    });
    setupAgentInstanceAlphaMaterial(droneMidMat);
    registerMidTierVertexAnimation(droneMidMat, 'drone');
    agentLOD.droneMid = new THREE.InstancedMesh(droneProxyGeoBase.clone(), droneMidMat, droneCount);
    agentLOD.droneMid.frustumCulled = true;
    agentLOD.droneMid.visible = true;
    attachAgentInstanceAlphaAttribute(agentLOD.droneMid, 0.0);
    scene.add(agentLOD.droneMid);

    // FAR LOD tier for drones - same proxy dimensions as MID to avoid size popping.
    const droneFarMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        metalness: 0.6,
        roughness: 0.35,
        transparent: true,
        opacity: 1.0,
        emissive: 0x2ecc71,
        emissiveIntensity: config.droneLightIntensity * 0.7
    });
    setupAgentInstanceAlphaMaterial(droneFarMat);
    agentLOD.droneFar = new THREE.InstancedMesh(droneProxyGeoBase.clone(), droneFarMat, droneCount);
    agentLOD.droneFar.frustumCulled = true;
    agentLOD.droneFar.visible = true;
    attachAgentInstanceAlphaAttribute(agentLOD.droneFar, 0.0);
    scene.add(agentLOD.droneFar);

    // Scale proxies based on height to keep them grounded and prevent popping

    const pedNearHeight = getGeometryHeight(agentSystem.pedestrianInstanced?.geometry);
    const pedProxyHeight = getGeometryHeight(pedestrianProxyGeoBase);
    const pedRefHeight = Math.max(pedNearHeight, PEDESTRIAN_SKINNED_HEIGHT_ESTIMATE);
    if (pedProxyHeight > 1e-5 && isFinite(pedRefHeight)) {
        const pedScale = pedRefHeight / pedProxyHeight;
        agentLOD.pedestrianMidScale = pedScale;
        agentLOD.pedestrianFarScale = pedScale;
    }

    // Use actual geometry height for drones because they have a consistent model and do not require a separate skinned version.

    const droneNearHeight = getGeometryHeight(agentSystem.droneInstanced?.geometry);
    const droneProxyHeight = getGeometryHeight(droneProxyGeoBase);
    if (droneProxyHeight > 1e-5 && isFinite(droneNearHeight)) {
        const droneScale = droneNearHeight / droneProxyHeight;
        agentLOD.droneMidScale = droneScale;
        agentLOD.droneFarScale = droneScale;
    }

    for (let i = 0; i < pedCount; i++) {
        if (agentSystem.pedestrians[i]) {
            const color = hashVector3ToColor(agentSystem.pedestrians[i].position);
            agentLOD.pedestrianMid.setColorAt(i, color);
            if (agentLOD.pedestrianFar) agentLOD.pedestrianFar.setColorAt(i, color);
        }
    }
    for (let i = 0; i < droneCount; i++) {
        if (agentSystem.drones[i]) {
            const color = hashVector3ToColor(agentSystem.drones[i].position);
            agentLOD.droneMid.setColorAt(i, color);
            if (agentLOD.droneFar) agentLOD.droneFar.setColorAt(i, color);
        }
    }
}

// Computes LOD per agent (with hysteresis + blending) and writes instance matrices/alphas.

function updateAgentLOD() {
    if (!config.agentLodEnabled) {
        if (agentSystem.pedestrianInstanced) agentSystem.pedestrianInstanced.visible = true;
        if (agentSystem.droneInstanced) agentSystem.droneInstanced.visible = true;
        if (agentSystem.droneWingLeftUpperInstanced) agentSystem.droneWingLeftUpperInstanced.visible = true;
        if (agentSystem.droneWingLeftLowerInstanced) agentSystem.droneWingLeftLowerInstanced.visible = true;
        if (agentSystem.droneWingRightUpperInstanced) agentSystem.droneWingRightUpperInstanced.visible = true;
        if (agentSystem.droneWingRightLowerInstanced) agentSystem.droneWingRightLowerInstanced.visible = true;
        if (agentLOD.pedestrianMid) agentLOD.pedestrianMid.visible = false;
        if (agentLOD.pedestrianFar) agentLOD.pedestrianFar.visible = false;
        if (agentLOD.droneMid) agentLOD.droneMid.visible = false;
        if (agentLOD.droneFar) agentLOD.droneFar.visible = false;
        fillAgentInstanceAlpha(agentSystem.droneInstanced, 1.0, agentSystem.drones.length);
        fillAgentInstanceAlpha(agentSystem.droneWingLeftUpperInstanced, 1.0, agentSystem.drones.length);
        fillAgentInstanceAlpha(agentSystem.droneWingLeftLowerInstanced, 1.0, agentSystem.drones.length);
        fillAgentInstanceAlpha(agentSystem.droneWingRightUpperInstanced, 1.0, agentSystem.drones.length);
        fillAgentInstanceAlpha(agentSystem.droneWingRightLowerInstanced, 1.0, agentSystem.drones.length);
        skinnedPool.meshes.forEach(g => g.visible = false);
        skinnedPool.activeCount = 0;
        skinnedPool.assignmentSet.clear();
        return;
    }

    // In LOD mode, pedestrians render as either skinned-pool meshes or billboards (no instanced near proxy).
    if (agentSystem.pedestrianInstanced) agentSystem.pedestrianInstanced.visible = false;
    if (agentSystem.droneInstanced) agentSystem.droneInstanced.visible = true;
    if (agentLOD.pedestrianMid) agentLOD.pedestrianMid.visible = true;
    if (agentLOD.pedestrianFar) agentLOD.pedestrianFar.visible = true;
    if (agentLOD.droneMid) agentLOD.droneMid.visible = true;
    if (agentLOD.droneFar) agentLOD.droneFar.visible = true;
    if (agentSystem.droneWingLeftUpperInstanced) agentSystem.droneWingLeftUpperInstanced.visible = true;
    if (agentSystem.droneWingLeftLowerInstanced) agentSystem.droneWingLeftLowerInstanced.visible = true;
    if (agentSystem.droneWingRightUpperInstanced) agentSystem.droneWingRightUpperInstanced.visible = true;
    if (agentSystem.droneWingRightLowerInstanced) agentSystem.droneWingRightLowerInstanced.visible = true;
    const camPos = camera.position;
    const nearDist = config.agentLodNearDist;
    const midDist = config.agentLodMidDist;
    const blendDist = Math.max(0, config.agentLodBlend ?? 0);
    const hysteresis = config.agentLodHysteresis;
    let nearPed = 0, midPed = 0, farPed = 0;
    let nearDrone = 0, midDrone = 0, farDrone = 0;

    const _directMat    = new THREE.Matrix4();
    const _scaleVec     = new THREE.Vector3();
    const _billboardQuat = new THREE.Quaternion();
    const _lodBlendWeights = { near: 1, mid: 0, far: 0 };
    const pedMidAlpha = getAgentInstanceAlphaArray(agentLOD.pedestrianMid);
    const pedFarAlpha = getAgentInstanceAlphaArray(agentLOD.pedestrianFar);
    const droneNearAlpha = getAgentInstanceAlphaArray(agentSystem.droneInstanced);
    const droneMidAlpha = getAgentInstanceAlphaArray(agentLOD.droneMid);
    const droneFarAlpha = getAgentInstanceAlphaArray(agentLOD.droneFar);
    const droneWingLeftUpperAlpha = getAgentInstanceAlphaArray(agentSystem.droneWingLeftUpperInstanced);
    const droneWingLeftLowerAlpha = getAgentInstanceAlphaArray(agentSystem.droneWingLeftLowerInstanced);
    const droneWingRightUpperAlpha = getAgentInstanceAlphaArray(agentSystem.droneWingRightUpperInstanced);
    const droneWingRightLowerAlpha = getAgentInstanceAlphaArray(agentSystem.droneWingRightLowerInstanced);

    function setAgentMatrixDirect(mesh, index, agent, baseScale = 1.0) {
        if (!mesh) return;
        if (baseScale <= 0.001) {
            // Scale to near-zero to hide this LOD tier for this agent while preserving position.
            _scaleVec.set(0.001, 0.001, 0.001);
            _directMat.compose(agent.position, agent.rotation, _scaleVec);
        } else {
            _scaleVec.copy(agent.scale).multiplyScalar(baseScale);
            _directMat.compose(agent.position, agent.rotation, _scaleVec);
        }

        _directMat.toArray(mesh.instanceMatrix.array, index * 16);
    }

    function setBillboardMatrixDirect(mesh, index, agent, baseScale = 1.0) {
        if (!mesh) return;
        if (baseScale <= 0.001) {
            _scaleVec.set(0.001, 0.001, 0.001);
            _directMat.compose(agent.position, agent.rotation, _scaleVec);
        } else {
            _billboardQuat.copy(camera.quaternion);
            _scaleVec.copy(agent.scale).multiplyScalar(baseScale);
            _directMat.compose(agent.position, _billboardQuat, _scaleVec);
        }
        _directMat.toArray(mesh.instanceMatrix.array, index * 16);
    }

    const skinnedAgents  = updateSkinnedPool(camPos);
    const pedCount = agentSystem.pedestrians.length;
    for (let i = 0; i < pedCount; i++) {
        const agent = agentSystem.pedestrians[i];
        const dx = camPos.x - agent.position.x;
        const dy = camPos.y - agent.position.y;
        const dz = camPos.z - agent.position.z;
        const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
        const prevLevel = agentLOD.pedestrianLevels[i] || agentLOD.NEAR;
        const newLevel = calculateLODLevel(dist, prevLevel, nearDist, midDist, hysteresis);
        agentLOD.pedestrianLevels[i] = newLevel;
        if (newLevel === agentLOD.NEAR) nearPed++;
        else if (newLevel === agentLOD.MID) midPed++;
        else farPed++;

        let pedMidWeight = 0;
        let pedFarWeight = 0;
        if (agentLOD.pedestrianMid && agentLOD.pedestrianFar) {
            computeLodBlendWeights(dist, nearDist, midDist, blendDist, _lodBlendWeights);
            pedMidWeight = _lodBlendWeights.near + _lodBlendWeights.mid;
            pedFarWeight = _lodBlendWeights.far;
        } else if (agentLOD.pedestrianMid) {
            pedMidWeight = 1.0;
        } else if (agentLOD.pedestrianFar) {
            pedFarWeight = 1.0;
        }

        const skinnedAlpha = agentLOD.skinnedAlpha ? THREE.MathUtils.clamp(agentLOD.skinnedAlpha[i], 0, 1) : 0.0;
        const billboardBaseAlpha = skinnedAgents.has(i) ? (1.0 - skinnedAlpha) : 1.0;
        const pedMidWeightAlpha = THREE.MathUtils.clamp(billboardBaseAlpha * pedMidWeight, 0, 1);
        const pedFarWeightAlpha = THREE.MathUtils.clamp(billboardBaseAlpha * pedFarWeight, 0, 1);

        if (pedMidAlpha) pedMidAlpha[i] = pedMidWeightAlpha;
        if (pedFarAlpha) pedFarAlpha[i] = pedFarWeightAlpha;

        if (agentLOD.pedestrianMid || agentLOD.pedestrianFar) {
            setAgentMatrixDirect(agentSystem.pedestrianInstanced, i, agent, 0);
            setBillboardMatrixDirect(agentLOD.pedestrianMid, i, agent, pedMidWeightAlpha > 0.001 ? agentLOD.pedestrianMidScale : 0.0);
            setBillboardMatrixDirect(agentLOD.pedestrianFar, i, agent, pedFarWeightAlpha > 0.001 ? agentLOD.pedestrianFarScale : 0.0);
        } else {
            setAgentMatrixDirect(agentSystem.pedestrianInstanced, i, agent, 1);
            setAgentMatrixDirect(agentLOD.pedestrianMid, i, agent, 0);
            setAgentMatrixDirect(agentLOD.pedestrianFar, i, agent, 0);
        }
    }

    const droneCount = agentSystem.drones.length;
    for (let i = 0; i < droneCount; i++) {
        const agent = agentSystem.drones[i];
        const dx = camPos.x - agent.position.x;
        const dy = camPos.y - agent.position.y;
        const dz = camPos.z - agent.position.z;
        const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
        const prevLevel = agentLOD.droneLevels[i] || agentLOD.NEAR;
        const newLevel = calculateLODLevel(dist, prevLevel, nearDist, midDist, hysteresis);
        agentLOD.droneLevels[i] = newLevel;
        if (newLevel === agentLOD.NEAR) nearDrone++;
        else if (newLevel === agentLOD.MID) midDrone++;
        else farDrone++;

        computeLodBlendWeights(dist, nearDist, midDist, blendDist, _lodBlendWeights);
        let nearWeight = _lodBlendWeights.near;
        let midWeight = _lodBlendWeights.mid;
        let farWeight = _lodBlendWeights.far;

        if (!agentLOD.droneMid) {
            nearWeight += midWeight;
            midWeight = 0;
        }
        if (!agentLOD.droneFar) {
            midWeight += farWeight;
            farWeight = 0;
        }

        const nearAlpha = THREE.MathUtils.clamp(nearWeight, 0, 1);
        const midAlpha = THREE.MathUtils.clamp(midWeight, 0, 1);
        const farAlpha = THREE.MathUtils.clamp(farWeight, 0, 1);
        if (droneNearAlpha) droneNearAlpha[i] = nearAlpha;
        if (droneMidAlpha) droneMidAlpha[i] = midAlpha;
        if (droneFarAlpha) droneFarAlpha[i] = farAlpha;
        if (droneWingLeftUpperAlpha) droneWingLeftUpperAlpha[i] = nearAlpha;
        if (droneWingLeftLowerAlpha) droneWingLeftLowerAlpha[i] = nearAlpha;
        if (droneWingRightUpperAlpha) droneWingRightUpperAlpha[i] = nearAlpha;
        if (droneWingRightLowerAlpha) droneWingRightLowerAlpha[i] = nearAlpha;

        if (agentLOD.droneMid || agentLOD.droneFar) {
            setAgentMatrixDirect(agentSystem.droneInstanced, i, agent, nearAlpha > 0.001 ? 1.0 : 0.0);
            setAgentMatrixDirect(agentLOD.droneMid, i, agent, midAlpha > 0.001 ? agentLOD.droneMidScale : 0.0);
            setBillboardMatrixDirect(agentLOD.droneFar, i, agent, farAlpha > 0.001 ? agentLOD.droneFarScale : 0.0);
            setDroneWingMatrices(i, agent, nearAlpha > 0.01, 1.0);
        } else {
            setAgentMatrixDirect(agentSystem.droneInstanced, i, agent, 1);
            setAgentMatrixDirect(agentLOD.droneMid, i, agent, 0);
            setAgentMatrixDirect(agentLOD.droneFar, i, agent, 0);
            setDroneWingMatrices(i, agent, true, 1.0);
        }
    }

    if (agentSystem.pedestrianInstanced) agentSystem.pedestrianInstanced.instanceMatrix.needsUpdate = true;
    if (agentSystem.droneInstanced)      agentSystem.droneInstanced.instanceMatrix.needsUpdate = true;
    if (agentLOD.pedestrianMid)  agentLOD.pedestrianMid.instanceMatrix.needsUpdate = true;
    if (agentLOD.pedestrianFar)  agentLOD.pedestrianFar.instanceMatrix.needsUpdate = true;
    if (agentLOD.droneMid)       agentLOD.droneMid.instanceMatrix.needsUpdate = true;
    if (agentLOD.droneFar)       agentLOD.droneFar.instanceMatrix.needsUpdate = true;
    if (agentSystem.droneWingLeftUpperInstanced)  agentSystem.droneWingLeftUpperInstanced.instanceMatrix.needsUpdate = true;
    if (agentSystem.droneWingLeftLowerInstanced)  agentSystem.droneWingLeftLowerInstanced.instanceMatrix.needsUpdate = true;
    if (agentSystem.droneWingRightUpperInstanced) agentSystem.droneWingRightUpperInstanced.instanceMatrix.needsUpdate = true;
    if (agentSystem.droneWingRightLowerInstanced) agentSystem.droneWingRightLowerInstanced.instanceMatrix.needsUpdate = true;
    markAgentInstanceAlphaDirty(agentLOD.pedestrianMid);
    markAgentInstanceAlphaDirty(agentLOD.pedestrianFar);
    markAgentInstanceAlphaDirty(agentSystem.droneInstanced);
    markAgentInstanceAlphaDirty(agentLOD.droneMid);
    markAgentInstanceAlphaDirty(agentLOD.droneFar);
    markAgentInstanceAlphaDirty(agentSystem.droneWingLeftUpperInstanced);
    markAgentInstanceAlphaDirty(agentSystem.droneWingLeftLowerInstanced);
    markAgentInstanceAlphaDirty(agentSystem.droneWingRightUpperInstanced);
    markAgentInstanceAlphaDirty(agentSystem.droneWingRightLowerInstanced);
    agentLOD.stats.nearAgents = nearPed + nearDrone;
    agentLOD.stats.midAgents = midPed + midDrone;
    agentLOD.stats.farAgents = farPed + farDrone;
    if (config.debugLod) {
        updateLODDebugColors();
    }
}

// Visual debugging of LOD assignments by coloring agents based on their current LOD tier.

function updateLODDebugColors() {
    const nearColor = new THREE.Color(0x00ff00);
    const midColor = new THREE.Color(0xffff00);
    const farColor = new THREE.Color(0xff0000);
    for (let i = 0; i < agentSystem.pedestrians.length; i++) {
        const level = agentLOD.pedestrianLevels[i];
        const color = level === agentLOD.NEAR ? nearColor :
                      level === agentLOD.MID ? midColor : farColor;
        agentSystem.pedestrianInstanced.setColorAt(i, color);
        if (agentLOD.pedestrianMid) agentLOD.pedestrianMid.setColorAt(i, color);
    }
    for (let i = 0; i < agentSystem.drones.length; i++) {
        const level = agentLOD.droneLevels[i];
        const color = level === agentLOD.NEAR ? nearColor :
                      level === agentLOD.MID ? midColor : farColor;
        agentSystem.droneInstanced.setColorAt(i, color);
        if (agentLOD.droneMid) agentLOD.droneMid.setColorAt(i, color);
        if (agentSystem.droneWingLeftUpperInstanced) agentSystem.droneWingLeftUpperInstanced.setColorAt(i, color);
        if (agentSystem.droneWingLeftLowerInstanced) agentSystem.droneWingLeftLowerInstanced.setColorAt(i, color);
        if (agentSystem.droneWingRightUpperInstanced) agentSystem.droneWingRightUpperInstanced.setColorAt(i, color);
        if (agentSystem.droneWingRightLowerInstanced) agentSystem.droneWingRightLowerInstanced.setColorAt(i, color);
    }
    if (agentSystem.pedestrianInstanced.instanceColor)
        agentSystem.pedestrianInstanced.instanceColor.needsUpdate = true;
    if (agentSystem.droneInstanced.instanceColor)
        agentSystem.droneInstanced.instanceColor.needsUpdate = true;
    if (agentLOD.pedestrianMid && agentLOD.pedestrianMid.instanceColor)
        agentLOD.pedestrianMid.instanceColor.needsUpdate = true;
    if (agentLOD.droneMid && agentLOD.droneMid.instanceColor)
        agentLOD.droneMid.instanceColor.needsUpdate = true;
    if (agentSystem.droneWingLeftUpperInstanced && agentSystem.droneWingLeftUpperInstanced.instanceColor)
        agentSystem.droneWingLeftUpperInstanced.instanceColor.needsUpdate = true;
    if (agentSystem.droneWingLeftLowerInstanced && agentSystem.droneWingLeftLowerInstanced.instanceColor)
        agentSystem.droneWingLeftLowerInstanced.instanceColor.needsUpdate = true;
    if (agentSystem.droneWingRightUpperInstanced && agentSystem.droneWingRightUpperInstanced.instanceColor)
        agentSystem.droneWingRightUpperInstanced.instanceColor.needsUpdate = true;
    if (agentSystem.droneWingRightLowerInstanced && agentSystem.droneWingRightLowerInstanced.instanceColor)
        agentSystem.droneWingRightLowerInstanced.instanceColor.needsUpdate = true;
}
mouseControl.init();

function createMouseCrosshair() {
    if (mouseCrosshair) scene.remove(mouseCrosshair);
    const group = new THREE.Group();
    const hLine = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(-1.5, 0, 0), new THREE.Vector3(1.5, 0, 0)
        ]),
        new THREE.LineBasicMaterial({ color: 0xff3333, linewidth: 3 })
    );
    const vLine = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(0, 0, -1.5), new THREE.Vector3(0, 0, 1.5)
        ]),
        new THREE.LineBasicMaterial({ color: 0xff3333, linewidth: 3 })
    );
    const center = new THREE.Mesh(
        new THREE.SphereGeometry(0.2, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0xff3333 })
    );
    group.add(hLine);
    group.add(vLine);
    group.add(center);
    mouseCrosshair = group;
    scene.add(mouseCrosshair);
}

// Main animation loop with fixed timestep to help framerate

function animate(timestamp) {
    requestAnimationFrame(animate);
    if (timestamp === undefined) timestamp = performance.now();
    if (lastTimestamp === 0) lastTimestamp = timestamp;
    const frameDelta = (timestamp - lastTimestamp) / 1000;
    lastTimestamp = timestamp;
    renderAccumulator += frameDelta;
    if (renderAccumulator < RENDER_INTERVAL) return;
    renderAccumulator -= RENDER_INTERVAL;
    if (renderAccumulator > RENDER_INTERVAL) renderAccumulator = 0;
    tick++;
    const realDt = Math.min(clock.getDelta(), 0.05);
    accumulator += realDt;
    let simSteps = 0;
    while (accumulator >= FIXED_DT && simSteps < MAX_SIM_STEPS_PER_FRAME) {
        updateAgents(FIXED_DT);
        accumulator -= FIXED_DT;
        simSteps++;
    }
    if (simSteps === MAX_SIM_STEPS_PER_FRAME && accumulator >= FIXED_DT) {
        // Prevents spiraling CPU catch-up under load by dropping stale simulation backlog.
        accumulator = 0;
    }
    controls.update();
    updateSpatialGridDebug();
    const elapsedTime = clock.getElapsedTime();
    if (tick % 4 === 0) {
        if (foliageField) foliageField.update(camera, elapsedTime);
        if (riverTreeLodField) riverTreeLodField.update(camera, elapsedTime);
    }
    updateMidTierVertexAnimationTime(elapsedTime);
    if (tick % LOD_RECALC_INTERVAL === 0) {
        // Full LOD level recalculation (distance tests + tier assignment) runs on a reduced cadence.
        updateAgentLOD();
    } else if (config.agentLodEnabled) {
        const nearDist = config.agentLodNearDist;
        const midDist = config.agentLodMidDist;
        const blendDist = Math.max(0, config.agentLodBlend ?? 0);
        const pedMidArr = agentLOD.pedestrianMid;
        const pedFarArr = agentLOD.pedestrianFar;
        const pedMidAlpha = getAgentInstanceAlphaArray(pedMidArr);
        const pedFarAlpha = getAgentInstanceAlphaArray(pedFarArr);
        const pedPooledSet = skinnedPool.assignmentSet;
        const droneArr = agentSystem.droneInstanced;
        const droneMidArr = agentLOD.droneMid;
        const droneFarArr = agentLOD.droneFar;
        const droneNearAlpha = getAgentInstanceAlphaArray(droneArr);
        const droneMidAlpha = getAgentInstanceAlphaArray(droneMidArr);
        const droneFarAlpha = getAgentInstanceAlphaArray(droneFarArr);
        const droneWingLeftUpperAlpha = getAgentInstanceAlphaArray(agentSystem.droneWingLeftUpperInstanced);
        const droneWingLeftLowerAlpha = getAgentInstanceAlphaArray(agentSystem.droneWingLeftLowerInstanced);
        const droneWingRightUpperAlpha = getAgentInstanceAlphaArray(agentSystem.droneWingRightUpperInstanced);
        const droneWingRightLowerAlpha = getAgentInstanceAlphaArray(agentSystem.droneWingRightLowerInstanced);
        const _interleaveBlendWeights = { near: 1, mid: 0, far: 0 };
        const camQuat = camera.quaternion;
        const camPos = camera.position;

        if (pedMidArr || pedFarArr) {
            const midBuf = pedMidArr ? pedMidArr.instanceMatrix.array : null;
            const farBuf = pedFarArr ? pedFarArr.instanceMatrix.array : null;
            for (let i = 0; i < agentSystem.pedestrians.length; i++) {
                const agent = agentSystem.pedestrians[i];
                const dx = camPos.x - agent.position.x;
                const dy = camPos.y - agent.position.y;
                const dz = camPos.z - agent.position.z;
                const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
                const pooled = pedPooledSet.has(i);
                const sAlpha = agentLOD.skinnedAlpha ? agentLOD.skinnedAlpha[i] : 0.0;
                let midWeight = 0;
                let farWeight = 0;
                if (pedMidArr && pedFarArr) {
                    computeLodBlendWeights(dist, nearDist, midDist, blendDist, _interleaveBlendWeights);
                    midWeight = _interleaveBlendWeights.near + _interleaveBlendWeights.mid;
                    farWeight = _interleaveBlendWeights.far;
                } else if (pedMidArr) {
                    midWeight = 1.0;
                } else if (pedFarArr) {
                    farWeight = 1.0;
                }

                const billboardBaseAlpha = pooled ? (1.0 - THREE.MathUtils.clamp(sAlpha, 0, 1)) : 1.0;
                const midAlpha = THREE.MathUtils.clamp(billboardBaseAlpha * midWeight, 0, 1);
                const farAlpha = THREE.MathUtils.clamp(billboardBaseAlpha * farWeight, 0, 1);

                if (pedMidAlpha) pedMidAlpha[i] = midAlpha;
                if (pedFarAlpha) pedFarAlpha[i] = farAlpha;

                if (midBuf) {
                    if (midAlpha <= 0.001) _lodInterleaveScale.set(0.001, 0.001, 0.001);
                    else _lodInterleaveScale.copy(agent.scale).multiplyScalar(agentLOD.pedestrianMidScale);
                    _lodInterleaveMat.compose(agent.position, camQuat, _lodInterleaveScale);
                    _lodInterleaveMat.toArray(midBuf, i * 16);
                }
                if (farBuf) {
                    if (farAlpha <= 0.001) _lodInterleaveScale.set(0.001, 0.001, 0.001);
                    else _lodInterleaveScale.copy(agent.scale).multiplyScalar(agentLOD.pedestrianFarScale);
                    _lodInterleaveMat.compose(agent.position, camQuat, _lodInterleaveScale);
                    _lodInterleaveMat.toArray(farBuf, i * 16);
                }
            }
            if (pedMidArr) pedMidArr.instanceMatrix.needsUpdate = true;
            if (pedFarArr) pedFarArr.instanceMatrix.needsUpdate = true;
            markAgentInstanceAlphaDirty(pedMidArr);
            markAgentInstanceAlphaDirty(pedFarArr);
        }

        // Drone NEAR/MID/FAR refresh every frame to keep alpha transitions and billboarding smooth.
        if (droneArr || droneMidArr || droneFarArr) {
            const nearBuf = droneArr ? droneArr.instanceMatrix.array : null;
            const dMidBuf = droneMidArr ? droneMidArr.instanceMatrix.array : null;
            const dFarBuf = droneFarArr ? droneFarArr.instanceMatrix.array : null;
            for (let i = 0; i < agentSystem.drones.length; i++) {
                const agent = agentSystem.drones[i];
                const dx = camPos.x - agent.position.x;
                const dy = camPos.y - agent.position.y;
                const dz = camPos.z - agent.position.z;
                const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
                computeLodBlendWeights(dist, nearDist, midDist, blendDist, _interleaveBlendWeights);
                let nearW = _interleaveBlendWeights.near;
                let midW = _interleaveBlendWeights.mid;
                let farW = _interleaveBlendWeights.far;
                if (!droneMidArr) { nearW += midW; midW = 0; }
                if (!droneFarArr) { midW += farW; farW = 0; }

                const nearAlpha = THREE.MathUtils.clamp(nearW, 0, 1);
                const midAlpha = THREE.MathUtils.clamp(midW, 0, 1);
                const farAlpha = THREE.MathUtils.clamp(farW, 0, 1);
                if (droneNearAlpha) droneNearAlpha[i] = nearAlpha;
                if (droneMidAlpha) droneMidAlpha[i] = midAlpha;
                if (droneFarAlpha) droneFarAlpha[i] = farAlpha;
                if (droneWingLeftUpperAlpha) droneWingLeftUpperAlpha[i] = nearAlpha;
                if (droneWingLeftLowerAlpha) droneWingLeftLowerAlpha[i] = nearAlpha;
                if (droneWingRightUpperAlpha) droneWingRightUpperAlpha[i] = nearAlpha;
                if (droneWingRightLowerAlpha) droneWingRightLowerAlpha[i] = nearAlpha;

                if (nearBuf) {
                    if (nearAlpha <= 0.001) _lodInterleaveScale.set(0.001, 0.001, 0.001);
                    else _lodInterleaveScale.copy(agent.scale);
                    _lodInterleaveMat.compose(agent.position, agent.rotation, _lodInterleaveScale);
                    _lodInterleaveMat.toArray(nearBuf, i * 16);
                }
                if (dMidBuf) {
                    if (midAlpha <= 0.001) _lodInterleaveScale.set(0.001, 0.001, 0.001);
                    else _lodInterleaveScale.copy(agent.scale).multiplyScalar(agentLOD.droneMidScale);
                    _lodInterleaveMat.compose(agent.position, camQuat, _lodInterleaveScale);
                    _lodInterleaveMat.toArray(dMidBuf, i * 16);
                }
                if (dFarBuf) {
                    if (farAlpha <= 0.001) _lodInterleaveScale.set(0.001, 0.001, 0.001);
                    else _lodInterleaveScale.copy(agent.scale).multiplyScalar(agentLOD.droneFarScale);
                    _lodInterleaveMat.compose(agent.position, camQuat, _lodInterleaveScale);
                    _lodInterleaveMat.toArray(dFarBuf, i * 16);
                }
                setDroneWingMatrices(i, agent, nearAlpha > 0.01, 1.0);
            }
            if (droneArr) droneArr.instanceMatrix.needsUpdate = true;
            if (droneMidArr) droneMidArr.instanceMatrix.needsUpdate = true;
            if (droneFarArr) droneFarArr.instanceMatrix.needsUpdate = true;
            if (agentSystem.droneWingLeftUpperInstanced)  agentSystem.droneWingLeftUpperInstanced.instanceMatrix.needsUpdate = true;
            if (agentSystem.droneWingLeftLowerInstanced)  agentSystem.droneWingLeftLowerInstanced.instanceMatrix.needsUpdate = true;
            if (agentSystem.droneWingRightUpperInstanced) agentSystem.droneWingRightUpperInstanced.instanceMatrix.needsUpdate = true;
            if (agentSystem.droneWingRightLowerInstanced) agentSystem.droneWingRightLowerInstanced.instanceMatrix.needsUpdate = true;
            markAgentInstanceAlphaDirty(droneArr);
            markAgentInstanceAlphaDirty(droneMidArr);
            markAgentInstanceAlphaDirty(droneFarArr);
            markAgentInstanceAlphaDirty(agentSystem.droneWingLeftUpperInstanced);
            markAgentInstanceAlphaDirty(agentSystem.droneWingLeftLowerInstanced);
            markAgentInstanceAlphaDirty(agentSystem.droneWingRightUpperInstanced);
            markAgentInstanceAlphaDirty(agentSystem.droneWingRightLowerInstanced);
        }
    }
    if (riverMaterial) {
        riverMaterial.uniforms.uTime.value = elapsedTime;
        riverMaterial.uniforms.uFlowSpeed.value = (config.riverFlowRate / 100) * 2;
        riverMaterial.uniforms.uIsDay.value = config.isDay ? 1.0 : 0.0;
    }
    updateDroneMouseTargets();
    updateMouseCrosshair();
    if (config.debugAgentPaths || config.debugVelocityVectors || config.debugCollisionRadius || config.debugSkeletons || config.debugAgentIDs || config.debugNav) {
        updateAgentPathTrails();
        drawDebugVisualization();
    }
    if (tick % 5 === 0) {
    }
    frameCount++;
    const elapsed = clock.getElapsedTime();
    if (elapsed - lastFpsUpdate > 0.5) {
        const fps = Math.round(frameCount / (elapsed - lastFpsUpdate));
        document.getElementById('pedestrianCounter').textContent = agentSystem.pedestrians.length;
        document.getElementById('droneCounter').textContent = agentSystem.drones.length;
        const totalAgents = agentSystem.pedestrians.length + agentSystem.drones.length;
        document.getElementById('totalAgentCounter').textContent = totalAgents;
        const fpsCounter = document.getElementById('fpsCounter');
        fpsCounter.textContent = fps + ' FPS';
        fpsCounter.classList.remove('good', 'warning', 'poor');
        
        if (fps >= 60) {
            fpsCounter.classList.add('good');      
        } else if (fps >= 30) {
            fpsCounter.classList.add('warning');   
        } else {
            fpsCounter.classList.add('poor');      
        }

        const lodSkinnedEl = document.getElementById('lodSkinnedCount');
        const lodNearEl = document.getElementById('lodNearCount');
        const lodMidEl = document.getElementById('lodMidCount');
        const lodFarEl = document.getElementById('lodFarCount');
        if (lodSkinnedEl) lodSkinnedEl.textContent = skinnedPool.activeCount;
        if (lodNearEl) lodNearEl.textContent = agentLOD.stats.nearAgents;
        if (lodMidEl) lodMidEl.textContent = agentLOD.stats.midAgents;
        if (lodFarEl) lodFarEl.textContent = agentLOD.stats.farAgents;
        const aaStatusEl = document.getElementById('aaStatus');
        if (aaStatusEl) {
            const samples = postProcessing.composer.renderTarget1.samples | 0;
            aaStatusEl.textContent = `AA: ${config.aaMode} | Samples: ${samples} | FXAA: ${postProcessing.fxaaPass.enabled ? 'On' : 'Off'}`;
        }
        lastFpsUpdate = elapsed;
        frameCount = 0;
    }
    if (postProcessing.enabled) {
        postProcessing.applyBokehFromConfig(config);
        postProcessing.applyBloomFromConfig(config);
        config.aaMode = postProcessing.setAAMode(config.aaMode);
        postProcessing.composer.render();
    } else {
        renderer.render(scene, camera);
    }
}
export {
    agentSystem,
    agentLOD,
    mouseControl,
    mouseCrosshair,
    createMouseCrosshair,
    initializeRaycastTargets,
    initAgentSystem,
    createInstancedAgents,
    initAgentLOD,
    rebuildAgentLOD,
    rebuildAgents,
    applyAgentLightMaterialSettings,
    initAgentLightPools,
    updateAgentLightPools,
    initializeAgentPaths,
    hashVector3ToColor,
    animate
};
