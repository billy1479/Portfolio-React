import { camera, postProcessing, config } from './core.js';

import {
    setupLighting,
    updateLighting,
    buildScene,
    initializeGround
} from './environment.js';

import { rebuildNavSystem, updateTentObstacles } from './navigation.js';

import { setupControls } from './ui.js';

import {
    initAgentLightPools,
    initializeRaycastTargets,
    initAgentSystem,
    createInstancedAgents,
    initializeAgentPaths,
    initAgentLOD,
    rebuildAgentLOD,
    animate
} from './agents.js';

function init() {
    setupLighting();
    updateLighting(config.isDay);
    initAgentLightPools();
    initializeGround();
    buildScene();
    rebuildNavSystem();
    updateTentObstacles();
    initializeRaycastTargets();
    setupControls();
    initAgentSystem();
    createInstancedAgents();
    initializeAgentPaths();
    initAgentLOD();
    rebuildAgentLOD();
    window.addEventListener('resize', () => {
        const width = window.innerWidth;
        const height = window.innerHeight;
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        postProcessing.resize(width, height);
    });
    animate();
}

init();
