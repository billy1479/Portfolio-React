import * as THREE from 'three';

function createAgentDebugSystem(scene) {
    const agentPathTrails = {
        pedestrians: [],
        drones: []
    };

    const pathTrailVectorPool = {
        vectors: [],
        maxSize: 150000,
        currentIndex: 0,

        initialize: function () {
            for (let i = 0; i < this.maxSize; i++) {
                this.vectors.push(new THREE.Vector3());
            }
        },

        getVector: function (x, y, z) {
            const vector = this.vectors[this.currentIndex];
            vector.set(x, y, z);
            this.currentIndex = (this.currentIndex + 1) % this.maxSize;
            return vector;
        },

        reset: function () {
            this.currentIndex = 0;
        }
    };

    pathTrailVectorPool.initialize();

    const debugLineGroup = new THREE.Group();
    scene.add(debugLineGroup);

    const debugPointPool = [];
    let debugPointCount = 0;

    function nextDebugPoint(x, y, z) {
        let v = debugPointPool[debugPointCount];
        if (!v) {
            v = new THREE.Vector3();
            debugPointPool[debugPointCount] = v;
        }
        debugPointCount++;
        return v.set(x, y, z);
    }

    function resetPathPool() {
        pathTrailVectorPool.reset();
    }

    function initializeAgentPaths(agentSystem) {
        pathTrailVectorPool.reset();
        agentPathTrails.pedestrians = agentSystem.pedestrians.map(() => []);
        agentPathTrails.drones = agentSystem.drones.map(() => []);
    }

    function updateAgentPathTrails(agentSystem, debugAgentPathsEnabled) {
        if (!debugAgentPathsEnabled) return;

        agentSystem.pedestrians.forEach((agent, i) => {
            const trail = agentPathTrails.pedestrians[i];
            if (trail.length >= 50) trail.shift();
            trail.push(pathTrailVectorPool.getVector(agent.position.x, agent.position.y, agent.position.z));
        });

        agentSystem.drones.forEach((agent, i) => {
            const trail = agentPathTrails.drones[i];
            if (trail.length >= 100) trail.shift();
            trail.push(pathTrailVectorPool.getVector(agent.position.x, agent.position.y, agent.position.z));
        });
    }

    function drawDebugVisualization(agentSystem, config, runtime = {}) {
        debugLineGroup.clear();
        debugPointCount = 0;

        const isDebugEnabled = config.debugAgentPaths || config.debugVelocityVectors || config.debugCollisionRadius || config.debugSkeletons;
        if (!isDebugEnabled) return;

        const allPoints = [];
        const allColors = [];
        const agentLOD = runtime.agentLOD;
        const skinnedAssignments = runtime.skinnedAssignments instanceof Set ? runtime.skinnedAssignments : null;

        const LOD_NEAR = agentLOD?.NEAR ?? 0;
        const pedLodLevels = Array.isArray(agentLOD?.pedestrianLevels) ? agentLOD.pedestrianLevels : null;
        const droneLodLevels = Array.isArray(agentLOD?.droneLevels) ? agentLOD.droneLevels : null;

        function getLodLevel(levels, index) {
            if (!levels || index < 0 || index >= levels.length) return LOD_NEAR;
            return levels[index];
        }

        if (config.debugSkeletons) {
            const pCount = agentSystem.pedestrianSoA.count;
            for (let i = 0; i < pCount; i++) {
                const skeleton = agentSystem.pedestrianSoA.skeletons[i];
                const agent = agentSystem.pedestrians[i];
                if (!skeleton || !agent) continue;
                const lodLevel = getLodLevel(pedLodLevels, i);
                const usesSkinnedSkeleton = skinnedAssignments ? skinnedAssignments.has(i) : (lodLevel === LOD_NEAR);
                if (!usesSkinnedSkeleton) {
                    continue;
                }
                for (const bone of skeleton.bones) {
                    if (!bone.parent) continue;
                    allPoints.push(bone.parent.position);
                    allPoints.push(bone.position);
                    allColors.push(0, 1, 0);
                    allColors.push(0, 1, 0);
                }
            }

            const dCount = agentSystem.droneSoA.count;
            for (let i = 0; i < dCount; i++) {
                const droneSkeleton = agentSystem.droneSoA.skeletons?.[i] || agentSystem.droneSoA.ikSkeletons?.[i];
                const agent = agentSystem.drones[i];
                if (!droneSkeleton || !agent) continue;
                const lodLevel = getLodLevel(droneLodLevels, i);
                const usesSkeleton = (lodLevel === LOD_NEAR);
                if (!usesSkeleton) {
                    continue;
                }
                for (const bone of droneSkeleton.bones) {
                    if (!bone.parent) continue;
                    allPoints.push(bone.parent.position);
                    allPoints.push(bone.position);
                    allColors.push(1, 0, 1);
                    allColors.push(1, 0, 1);
                }
            }
        }

        if (config.debugAgentPaths) {
            agentPathTrails.pedestrians.forEach(trail => {
                if (trail.length <= 1) return;
                for (let i = 0; i < trail.length - 1; i++) {
                    allPoints.push(trail[i]);
                    allPoints.push(trail[i + 1]);
                    allColors.push(0.25, 0.41, 0.88);
                    allColors.push(0.25, 0.41, 0.88);
                }
            });

            agentPathTrails.drones.forEach(trail => {
                if (trail.length <= 1) return;
                for (let i = 0; i < trail.length - 1; i++) {
                    allPoints.push(trail[i]);
                    allPoints.push(trail[i + 1]);
                    allColors.push(0.18, 0.8, 0.44);
                    allColors.push(0.18, 0.8, 0.44);
                }
            });
        }

        if (config.debugVelocityVectors) {
            const renderVelocity = (agent) => {
                if (agent.velocity.length() <= 0.1) return;

                allPoints.push(agent.position);
                allPoints.push(nextDebugPoint(
                    agent.position.x + agent.velocity.x * 0.3,
                    agent.position.y + agent.velocity.y * 0.3,
                    agent.position.z + agent.velocity.z * 0.3
                ));

                if (agent.type === 'pedestrian') {
                    allColors.push(0.25, 0.41, 0.88);
                    allColors.push(0.25, 0.41, 0.88);
                } else {
                    allColors.push(0.18, 0.8, 0.44);
                    allColors.push(0.18, 0.8, 0.44);
                }
            };

            for (let i = 0; i < agentSystem.pedestrians.length; i++) {
                renderVelocity(agentSystem.pedestrians[i]);
            }
            for (let i = 0; i < agentSystem.drones.length; i++) {
                renderVelocity(agentSystem.drones[i]);
            }
        }

        if (config.debugCollisionRadius) {
            const renderCollision = (agent) => {
                const radius = agent.type === 'pedestrian' ? 2.0 : 2.5;
                const circleSegments = 32;
                const px = agent.position.x;
                const py = agent.position.y;
                const pz = agent.position.z;

                for (let i = 0; i < circleSegments; i++) {
                    const angle1 = (i / circleSegments) * Math.PI * 2;
                    const angle2 = ((i + 1) / circleSegments) * Math.PI * 2;

                    allPoints.push(nextDebugPoint(
                        px + Math.cos(angle1) * radius,
                        py,
                        pz + Math.sin(angle1) * radius
                    ));
                    allPoints.push(nextDebugPoint(
                        px + Math.cos(angle2) * radius,
                        py,
                        pz + Math.sin(angle2) * radius
                    ));

                    if (agent.type === 'pedestrian') {
                        allColors.push(0.25, 0.41, 0.88);
                        allColors.push(0.25, 0.41, 0.88);
                    } else {
                        allColors.push(0.18, 0.8, 0.44);
                        allColors.push(0.18, 0.8, 0.44);
                    }
                }
            };

            for (let i = 0; i < agentSystem.pedestrians.length; i++) {
                renderCollision(agentSystem.pedestrians[i]);
            }
            for (let i = 0; i < agentSystem.drones.length; i++) {
                renderCollision(agentSystem.drones[i]);
            }
        }

        if (allPoints.length > 0) {
            const geom = new THREE.BufferGeometry();
            geom.setFromPoints(allPoints);

            const colorArray = new Float32Array(allColors);
            geom.setAttribute('color', new THREE.BufferAttribute(colorArray, 3));

            const material = new THREE.LineBasicMaterial({
                vertexColors: true,
                linewidth: 1,
                transparent: true,
                opacity: 0.8
            });

            const lineSegments = new THREE.LineSegments(geom, material);
            debugLineGroup.add(lineSegments);
        }
    }

    return {
        resetPathPool,
        initializeAgentPaths,
        updateAgentPathTrails,
        drawDebugVisualization
    };
}

export {
    createAgentDebugSystem
};
