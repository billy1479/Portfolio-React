import { config, postProcessing, TOWER_HEIGHT_MIN, TOWER_HEIGHT_MAX } from './core.js';

import {
    rebuildCathedral,
    rebuildGraveyard,
    rebuildTents,
    rebuildBuildings,
    rebuildGreenBuildings,
    rebuildGardenPaths,
    rebuildFoliage,
    updateLighting,
    buildSpatialGridDebugView,
    toggleSpatialGridDebug
} from './environment.js';

import {
    rebuildAgents,
    applyAgentLightMaterialSettings,
    updateAgentLightPools,
    agentSystem,
    agentLOD,
    hashVector3ToColor,
    mouseControl,
    createMouseCrosshair,
    mouseCrosshair,
    rebuildAgentLOD
} from './agents.js';

import {
    rebuildSpatialGrid,
    updateSpatialGridDebug,
    rebuildNavDebug,
    navDebugGroup
} from './navigation.js';

function setupControls() {
    const towerSlider = document.getElementById('towerHeight');
    const towerValue = document.getElementById('towerValue');
    const graveSlider = document.getElementById('graveCount');
    const tentSlider = document.getElementById('tentCount');
    const treeSlider = document.getElementById('treeCount');
    const treeCoverageSlider = document.getElementById('treeCoverage');
    const bushSlider = document.getElementById('bushCount');
    const dayNightToggle = document.getElementById('dayNightToggle');
    const lightIntensitySlider = document.getElementById('lightIntensity');
    const lightIntensityGroup = document.getElementById('lightIntensityGroup');

    if (treeSlider) { treeSlider.value = String(config.treeCount); document.getElementById('treeValue').textContent = config.treeCount; }
    if (treeCoverageSlider) { treeCoverageSlider.value = String(config.treeCoverage); document.getElementById('treeCoverageValue').textContent = config.treeCoverage + '%'; }
    if (bushSlider) { bushSlider.value = String(config.bushCount); document.getElementById('bushValue').textContent = config.bushCount; }
    towerSlider.min = String(TOWER_HEIGHT_MIN);
    towerSlider.max = String(TOWER_HEIGHT_MAX);
    config.towerHeight = Math.min(
        TOWER_HEIGHT_MAX,
        Math.max(TOWER_HEIGHT_MIN, Number.parseInt(config.towerHeight, 10) || TOWER_HEIGHT_MIN)
    );
    towerSlider.value = String(config.towerHeight);
    if (towerValue) towerValue.textContent = config.towerHeight;
    towerSlider.addEventListener('input', (e) => {
        const requestedHeight = Number.parseInt(e.target.value, 10);
        const clampedHeight = Math.min(
            TOWER_HEIGHT_MAX,
            Math.max(TOWER_HEIGHT_MIN, Number.isFinite(requestedHeight) ? requestedHeight : TOWER_HEIGHT_MIN)
        );
        config.towerHeight = clampedHeight;
        towerSlider.value = String(clampedHeight);
        if (towerValue) towerValue.textContent = clampedHeight;
        rebuildCathedral();
    });

    graveSlider.addEventListener('input', (e) => {
        config.graveCount = parseInt(e.target.value);
        document.getElementById('graveValue').textContent = config.graveCount;
        rebuildGraveyard();
    });

    tentSlider.addEventListener('input', (e) => {
        config.tentCount = parseInt(e.target.value);
        document.getElementById('tentValue').textContent = config.tentCount;
        rebuildTents();
    });

    const buildingHeightSlider = document.getElementById('buildingHeight');
    buildingHeightSlider?.addEventListener('input', (e) => {
        config.buildingHeight = parseInt(e.target.value);
        document.getElementById('buildingHeightValue').textContent = config.buildingHeight;
        rebuildBuildings();
    });

    const greenBuildingSlider = document.getElementById('greenBuildingCount');
    if (greenBuildingSlider) { greenBuildingSlider.value = String(config.greenBuildingCount); document.getElementById('greenBuildingCountValue').textContent = config.greenBuildingCount; }
    greenBuildingSlider?.addEventListener('input', (e) => {
        config.greenBuildingCount = parseInt(e.target.value);
        document.getElementById('greenBuildingCountValue').textContent = config.greenBuildingCount;
        rebuildGreenBuildings();
    });

    const greenBuildingSeedSlider = document.getElementById('greenBuildingSeed');
    const greenBuildingSeedValue = document.getElementById('greenBuildingSeedValue');
    const greenBldMinWSlider = document.getElementById('greenBldMinW');
    const greenBldMaxWSlider = document.getElementById('greenBldMaxW');
    const greenBldMinDSlider = document.getElementById('greenBldMinD');
    const greenBldMaxDSlider = document.getElementById('greenBldMaxD');
    const greenBldMinHSlider = document.getElementById('greenBldMinH');
    const greenBldMaxHSlider = document.getElementById('greenBldMaxH');
    const greenBldMinSpacingSlider = document.getElementById('greenBldMinSpacing');
    const greenBldMaxSpacingSlider = document.getElementById('greenBldMaxSpacing');
    const greenBldRoofPitchMinSlider = document.getElementById('greenBldRoofPitchMin');
    const greenBldRoofPitchMaxSlider = document.getElementById('greenBldRoofPitchMax');
    const greenBldRoofCurveSlider = document.getElementById('greenBldRoofCurve');
    const greenBldChimneyProbSlider = document.getElementById('greenBldChimneyProb');
    const greenBldWindowSpacingXSlider = document.getElementById('greenBldWindowSpacingX');
    const greenBldWindowSpacingYSlider = document.getElementById('greenBldWindowSpacingY');
    const greenBldCurvedRoofsToggle = document.getElementById('greenBldCurvedRoofs');
    const greenBuildingsRegenerateButton = document.getElementById('greenBuildingsRegenerate');

    const setGreenValueDisplay = (id, text) => {
        const el = document.getElementById(id);
        if (el) el.textContent = text;
    };

    const bindGreenMinMaxPair = (minSlider, maxSlider, minKey, maxKey, minValueId, maxValueId, decimals, suffix = '') => {
        if (!minSlider || !maxSlider) return;
        const format = (value) => `${Number(value).toFixed(decimals)}${suffix}`;
        const render = () => {
            setGreenValueDisplay(minValueId, format(config[minKey]));
            setGreenValueDisplay(maxValueId, format(config[maxKey]));
        };
        const apply = (changed) => {
            let min = parseFloat(minSlider.value);
            let max = parseFloat(maxSlider.value);
            if (min > max) {
                if (changed === 'min') {
                    max = min;
                    maxSlider.value = String(max);
                } else {
                    min = max;
                    minSlider.value = String(min);
                }
            }
            config[minKey] = min;
            config[maxKey] = max;
            render();
            rebuildGreenBuildings();
        };
        minSlider.value = String(config[minKey]);
        maxSlider.value = String(config[maxKey]);
        render();
        minSlider.addEventListener('input', () => apply('min'));
        maxSlider.addEventListener('input', () => apply('max'));
    };

    if (greenBuildingSeedSlider) {
        greenBuildingSeedSlider.value = String(config.greenBuildingSeed);
        if (greenBuildingSeedValue) greenBuildingSeedValue.textContent = String(config.greenBuildingSeed);
        greenBuildingSeedSlider.addEventListener('input', (e) => {
            config.greenBuildingSeed = parseInt(e.target.value, 10);
            if (greenBuildingSeedValue) greenBuildingSeedValue.textContent = String(config.greenBuildingSeed);
            rebuildGreenBuildings();
        });
    }
    
    bindGreenMinMaxPair(greenBldMinWSlider, greenBldMaxWSlider, 'greenBldMinW', 'greenBldMaxW', 'greenBldMinWValue', 'greenBldMaxWValue', 1);
    bindGreenMinMaxPair(greenBldMinDSlider, greenBldMaxDSlider, 'greenBldMinD', 'greenBldMaxD', 'greenBldMinDValue', 'greenBldMaxDValue', 1);
    bindGreenMinMaxPair(greenBldMinHSlider, greenBldMaxHSlider, 'greenBldMinH', 'greenBldMaxH', 'greenBldMinHValue', 'greenBldMaxHValue', 1);
    bindGreenMinMaxPair(greenBldMinSpacingSlider, greenBldMaxSpacingSlider, 'greenBldMinSpacing', 'greenBldMaxSpacing', 'greenBldMinSpacingValue', 'greenBldMaxSpacingValue', 1);
    bindGreenMinMaxPair(greenBldRoofPitchMinSlider, greenBldRoofPitchMaxSlider, 'greenBldRoofPitchMin', 'greenBldRoofPitchMax', 'greenBldRoofPitchMinValue', 'greenBldRoofPitchMaxValue', 2);
    if (greenBldRoofCurveSlider) {
        greenBldRoofCurveSlider.value = String(config.greenBldRoofCurve);
        setGreenValueDisplay('greenBldRoofCurveValue', Number(config.greenBldRoofCurve).toFixed(2));
        greenBldRoofCurveSlider.addEventListener('input', (e) => {
            config.greenBldRoofCurve = parseFloat(e.target.value);
            setGreenValueDisplay('greenBldRoofCurveValue', config.greenBldRoofCurve.toFixed(2));
            rebuildGreenBuildings();
        });
    }

    if (greenBldChimneyProbSlider) {
        greenBldChimneyProbSlider.value = String(config.greenBldChimneyProb);
        setGreenValueDisplay('greenBldChimneyProbValue', Number(config.greenBldChimneyProb).toFixed(2));
        greenBldChimneyProbSlider.addEventListener('input', (e) => {
            config.greenBldChimneyProb = parseFloat(e.target.value);
            setGreenValueDisplay('greenBldChimneyProbValue', config.greenBldChimneyProb.toFixed(2));
            rebuildGreenBuildings();
        });
    }

    if (greenBldWindowSpacingXSlider) {
        greenBldWindowSpacingXSlider.value = String(config.greenBldWindowSpacingX);
        setGreenValueDisplay('greenBldWindowSpacingXValue', Number(config.greenBldWindowSpacingX).toFixed(1));
        greenBldWindowSpacingXSlider.addEventListener('input', (e) => {
            config.greenBldWindowSpacingX = parseFloat(e.target.value);
            setGreenValueDisplay('greenBldWindowSpacingXValue', config.greenBldWindowSpacingX.toFixed(1));
            rebuildGreenBuildings();
        });
    }

    if (greenBldWindowSpacingYSlider) {
        greenBldWindowSpacingYSlider.value = String(config.greenBldWindowSpacingY);
        setGreenValueDisplay('greenBldWindowSpacingYValue', Number(config.greenBldWindowSpacingY).toFixed(1));
        greenBldWindowSpacingYSlider.addEventListener('input', (e) => {
            config.greenBldWindowSpacingY = parseFloat(e.target.value);
            setGreenValueDisplay('greenBldWindowSpacingYValue', config.greenBldWindowSpacingY.toFixed(1));
            rebuildGreenBuildings();
        });
    }

    if (greenBldCurvedRoofsToggle) {
        greenBldCurvedRoofsToggle.checked = !!config.greenBldCurvedRoofs;
        greenBldCurvedRoofsToggle.addEventListener('change', (e) => {
            config.greenBldCurvedRoofs = e.target.checked;
            rebuildGreenBuildings();
        });
    }

    greenBuildingsRegenerateButton?.addEventListener('click', () => {
        rebuildGreenBuildings();
    });

    treeSlider?.addEventListener('input', (e) => {
        config.treeCount = parseInt(e.target.value);
        document.getElementById('treeValue').textContent = config.treeCount;
        rebuildFoliage();
    });

    treeCoverageSlider?.addEventListener('input', (e) => {
        config.treeCoverage = parseInt(e.target.value);
        document.getElementById('treeCoverageValue').textContent = config.treeCoverage + '%';
        rebuildFoliage();
    });

    bushSlider?.addEventListener('input', (e) => {
        config.bushCount = parseInt(e.target.value);
        document.getElementById('bushValue').textContent = config.bushCount;
        rebuildFoliage();
    });

    const pedestrianSlider = document.getElementById('pedestrianCount');
    const droneSlider = document.getElementById('droneCount');
    const pedestrianSpacingSlider = document.getElementById('pedestrianSpacing');
    const droneSpacingSlider = document.getElementById('droneSpacing');
    const behaviorToggle = document.getElementById('behaviorToggle');
    if (pedestrianSlider) { pedestrianSlider.value = String(config.pedestrianCount); document.getElementById('pedestrianValue').textContent = config.pedestrianCount; }
    if (droneSlider) { droneSlider.value = String(config.droneCount); document.getElementById('droneValue').textContent = config.droneCount; }
    if (pedestrianSpacingSlider) {
        pedestrianSpacingSlider.value = String(config.pedestrianSpacingScale ?? 1.0);
        const el = document.getElementById('pedestrianSpacingValue');
        if (el) el.textContent = (config.pedestrianSpacingScale ?? 1.0).toFixed(1) + 'x';
    }

    if (droneSpacingSlider) {
        droneSpacingSlider.value = String(config.droneSpacingScale ?? 1.0);
        const el = document.getElementById('droneSpacingValue');
        if (el) el.textContent = (config.droneSpacingScale ?? 1.0).toFixed(1) + 'x';
    }

    pedestrianSlider?.addEventListener('input', (e) => {
        config.pedestrianCount = parseInt(e.target.value);
        document.getElementById('pedestrianValue').textContent = config.pedestrianCount;
        rebuildAgents();
    });

    droneSlider?.addEventListener('input', (e) => {
        config.droneCount = parseInt(e.target.value);
        document.getElementById('droneValue').textContent = config.droneCount;
        rebuildAgents();
    });

    pedestrianSpacingSlider?.addEventListener('input', (e) => {
        config.pedestrianSpacingScale = parseFloat(e.target.value);
        const el = document.getElementById('pedestrianSpacingValue');
        if (el) el.textContent = config.pedestrianSpacingScale.toFixed(1) + 'x';
    });

    droneSpacingSlider?.addEventListener('input', (e) => {
        config.droneSpacingScale = parseFloat(e.target.value);
        const el = document.getElementById('droneSpacingValue');
        if (el) el.textContent = config.droneSpacingScale.toFixed(1) + 'x';
    });

    behaviorToggle?.addEventListener('change', (e) => {
        config.agentBehaviors = e.target.checked;
    });

    const raycastPedLookaheadSlider = document.getElementById('raycastPedLookahead');
    const raycastDroneLookaheadSlider = document.getElementById('raycastDroneLookahead');
    const raycastForceSlider = document.getElementById('raycastAvoidanceForce');
    const raycastIntervalSlider = document.getElementById('raycastInterval');
    const queueAheadDotSlider = document.getElementById('queueAheadDotThreshold');
    const queuePedBrakeRadiusSlider = document.getElementById('pedQueueBrakeRadius');
    const queueDroneBrakeRadiusSlider = document.getElementById('droneQueueBrakeRadius');

    if (raycastPedLookaheadSlider) {
        raycastPedLookaheadSlider.value = String(config.raycastPedestrianLookahead);
        const el = document.getElementById('raycastPedLookaheadValue');
        if (el) el.textContent = config.raycastPedestrianLookahead.toFixed(1) + 'm';
    }

    if (raycastDroneLookaheadSlider) {
        raycastDroneLookaheadSlider.value = String(config.raycastDroneLookahead);
        const el = document.getElementById('raycastDroneLookaheadValue');
        if (el) el.textContent = config.raycastDroneLookahead.toFixed(1) + 'm';
    }

    if (raycastForceSlider) {
        raycastForceSlider.value = String(config.raycastAvoidanceForceScale);
        const el = document.getElementById('raycastAvoidanceForceValue');
        if (el) el.textContent = config.raycastAvoidanceForceScale.toFixed(1) + 'x';
    }

    if (raycastIntervalSlider) {
        raycastIntervalSlider.value = String(config.raycastInterval);
        const el = document.getElementById('raycastIntervalValue');
        if (el) el.textContent = String(config.raycastInterval);
    }

    if (queueAheadDotSlider) {
        queueAheadDotSlider.value = String(config.queueAheadDotThreshold);
        const el = document.getElementById('queueAheadDotThresholdValue');
        if (el) el.textContent = config.queueAheadDotThreshold.toFixed(2);
    }

    if (queuePedBrakeRadiusSlider) {
        queuePedBrakeRadiusSlider.value = String(config.pedestrianQueueBrakeRadius);
        const el = document.getElementById('pedQueueBrakeRadiusValue');
        if (el) el.textContent = config.pedestrianQueueBrakeRadius.toFixed(1) + 'm';
    }

    if (queueDroneBrakeRadiusSlider) {
        queueDroneBrakeRadiusSlider.value = String(config.droneQueueBrakeRadius);
        const el = document.getElementById('droneQueueBrakeRadiusValue');
        if (el) el.textContent = config.droneQueueBrakeRadius.toFixed(1) + 'm';
    }

    raycastPedLookaheadSlider?.addEventListener('input', (e) => {
        config.raycastPedestrianLookahead = parseFloat(e.target.value);
        const el = document.getElementById('raycastPedLookaheadValue');
        if (el) el.textContent = config.raycastPedestrianLookahead.toFixed(1) + 'm';
    });

    raycastDroneLookaheadSlider?.addEventListener('input', (e) => {
        config.raycastDroneLookahead = parseFloat(e.target.value);
        const el = document.getElementById('raycastDroneLookaheadValue');
        if (el) el.textContent = config.raycastDroneLookahead.toFixed(1) + 'm';
    });
    
    raycastForceSlider?.addEventListener('input', (e) => {
        config.raycastAvoidanceForceScale = parseFloat(e.target.value);
        const el = document.getElementById('raycastAvoidanceForceValue');
        if (el) el.textContent = config.raycastAvoidanceForceScale.toFixed(1) + 'x';
    });

    raycastIntervalSlider?.addEventListener('input', (e) => {
        config.raycastInterval = Math.max(1, parseInt(e.target.value, 10));
        const el = document.getElementById('raycastIntervalValue');
        if (el) el.textContent = String(config.raycastInterval);
    });

    queueAheadDotSlider?.addEventListener('input', (e) => {
        config.queueAheadDotThreshold = Math.min(0.99, Math.max(0, parseFloat(e.target.value)));
        const el = document.getElementById('queueAheadDotThresholdValue');
        if (el) el.textContent = config.queueAheadDotThreshold.toFixed(2);
    });
    
    queuePedBrakeRadiusSlider?.addEventListener('input', (e) => {
        config.pedestrianQueueBrakeRadius = Math.max(0, parseFloat(e.target.value));
        const el = document.getElementById('pedQueueBrakeRadiusValue');
        if (el) el.textContent = config.pedestrianQueueBrakeRadius.toFixed(1) + 'm';
    });

    queueDroneBrakeRadiusSlider?.addEventListener('input', (e) => {
        config.droneQueueBrakeRadius = Math.max(0, parseFloat(e.target.value));
        const el = document.getElementById('droneQueueBrakeRadiusValue');
        if (el) el.textContent = config.droneQueueBrakeRadius.toFixed(1) + 'm';
    });
    
    const pedLightSlider = document.getElementById('pedestrianLightIntensity');
    const droLightSlider = document.getElementById('droneLightIntensity');
    if (pedLightSlider) { pedLightSlider.value = String(config.pedestrianLightIntensity); document.getElementById('pedestrianLightValue').textContent = config.pedestrianLightIntensity.toFixed(1); }
    if (droLightSlider) { droLightSlider.value = String(config.droneLightIntensity); document.getElementById('droneLightValue').textContent = config.droneLightIntensity.toFixed(1); }
    pedLightSlider?.addEventListener('input', (e) => {
        config.pedestrianLightIntensity = parseFloat(e.target.value);
        document.getElementById('pedestrianLightValue').textContent = config.pedestrianLightIntensity.toFixed(1);
        applyAgentLightMaterialSettings();
        updateAgentLightPools();
    });
    droLightSlider?.addEventListener('input', (e) => {
        config.droneLightIntensity = parseFloat(e.target.value);
        document.getElementById('droneLightValue').textContent = config.droneLightIntensity.toFixed(1);
        applyAgentLightMaterialSettings();
        updateAgentLightPools();
    });

    const masterDebugToggle = document.getElementById('masterDebugToggle');
    const debugOptions = document.getElementById('debugOptions');
    const debugPathsToggle = document.getElementById('debugPaths');
    const debugVelocityToggle = document.getElementById('debugVelocity');
    const debugCollisionToggle = document.getElementById('debugCollision');
    const debugParametricCagesToggle = document.getElementById('debugParametricCages');
    const debugBSplineCagesToggle = document.getElementById('debugBSplineCages');
    const debugGardenCatmullToggle = document.getElementById('debugGardenCatmull');

    if (debugParametricCagesToggle) debugParametricCagesToggle.checked = !!config.debugParametricCages;
    if (debugBSplineCagesToggle) debugBSplineCagesToggle.checked = !!config.debugBSplineCages;
    if (debugGardenCatmullToggle) debugGardenCatmullToggle.checked = !!config.debugGardenPathCatmull;

    masterDebugToggle?.addEventListener('change', (e) => {
        const previousBSplineCages = !!config.debugBSplineCages;
        const previousGardenPathCatmull = !!config.debugGardenPathCatmull;
        const isEnabled = e.target.checked;
        debugOptions.style.display = isEnabled ? 'block' : 'none';
        if (isEnabled) {
            config.debugAgentPaths = true;
            config.debugVelocityVectors = true;
            config.debugCollisionRadius = true;
            config.debugSkeletons = true;
            config.debugParametricCages = true;
            config.debugBSplineCages = true;
            config.debugGardenPathCatmull = true;
            debugPathsToggle.checked = true;
            debugVelocityToggle.checked = true;
            debugCollisionToggle.checked = true;
            document.getElementById('debugSkeletons').checked = true;
            if (debugParametricCagesToggle) debugParametricCagesToggle.checked = true;
            if (debugBSplineCagesToggle) debugBSplineCagesToggle.checked = true;
            if (debugGardenCatmullToggle) debugGardenCatmullToggle.checked = true;
        } else {
            config.debugAgentPaths = false;
            config.debugVelocityVectors = false;
            config.debugCollisionRadius = false;
            config.debugSkeletons = false;
            config.debugParametricCages = false;
            config.debugBSplineCages = false;
            config.debugGardenPathCatmull = false;
            debugPathsToggle.checked = false;
            debugVelocityToggle.checked = false;
            debugCollisionToggle.checked = false;
            document.getElementById('debugSkeletons').checked = false;
            if (debugParametricCagesToggle) debugParametricCagesToggle.checked = false;
            if (debugBSplineCagesToggle) debugBSplineCagesToggle.checked = false;
            if (debugGardenCatmullToggle) debugGardenCatmullToggle.checked = false;
        }
        rebuildCathedral();
        if (previousBSplineCages !== config.debugBSplineCages) {
            rebuildTents();
            rebuildGraveyard();
        }
        if (previousGardenPathCatmull !== config.debugGardenPathCatmull) {
            rebuildGardenPaths();
        }
    });

    debugPathsToggle?.addEventListener('change', (e) => {
        config.debugAgentPaths = e.target.checked;
    });

    debugVelocityToggle?.addEventListener('change', (e) => {
        config.debugVelocityVectors = e.target.checked;
    });

    debugCollisionToggle?.addEventListener('change', (e) => {
        config.debugCollisionRadius = e.target.checked;
    });

    const debugSkeletonsToggle = document.getElementById('debugSkeletons');
    debugSkeletonsToggle?.addEventListener('change', (e) => {
        config.debugSkeletons = e.target.checked;
    });

    const debugNavToggle = document.getElementById('debugNav');
    debugNavToggle?.addEventListener('change', (e) => {
        config.debugNav = e.target.checked;
        if (typeof rebuildNavDebug === 'function') rebuildNavDebug();
        if (navDebugGroup) navDebugGroup.visible = !!config.debugNav;
    });

    debugParametricCagesToggle?.addEventListener('change', (e) => {
        config.debugParametricCages = e.target.checked;
        rebuildCathedral();
    });

    debugBSplineCagesToggle?.addEventListener('change', (e) => {
        config.debugBSplineCages = e.target.checked;
        rebuildCathedral();
        rebuildTents();
        rebuildGraveyard();
    });

    debugGardenCatmullToggle?.addEventListener('change', (e) => {
        config.debugGardenPathCatmull = e.target.checked;
        rebuildGardenPaths();
    });

    const mouseControlToggle = document.getElementById('mouseControlDrones');
    mouseControlToggle?.addEventListener('change', (e) => {
        config.mouseControlDrones = e.target.checked;
        mouseControl.setEnabled(e.target.checked);
        if (e.target.checked) {
            createMouseCrosshair();
        } else if (mouseCrosshair) {
            mouseCrosshair.visible = false;
        }
    });

    dayNightToggle.addEventListener('change', (e) => {
        config.isDay = e.target.checked;
        updateLighting(config.isDay);
        if (config.isDay) {
            lightIntensityGroup.style.display = 'none';
        } else {
            lightIntensityGroup.style.display = 'block';
        }
    });

    lightIntensitySlider.addEventListener('input', (e) => {
        config.lightIntensity = parseInt(e.target.value);
        document.getElementById('lightValue').textContent = config.lightIntensity + '%';
    });

    const flowRateSlider = document.getElementById('riverFlowRate');
    flowRateSlider?.addEventListener('input', (e) => {
        config.riverFlowRate = parseInt(e.target.value);
        document.getElementById('flowValue').textContent = config.riverFlowRate + '%';
    });
        
    const gridDebugToggle = document.getElementById('gridDebugToggle');
    const gridNeighboursToggle = document.getElementById('gridNeighboursToggle');
    const gridOccupiedToggle = document.getElementById('gridOccupiedToggle');
    const syncGridUI = () => {
        if (gridDebugToggle) gridDebugToggle.checked = !!config.gridDebug;
        if (gridNeighboursToggle) gridNeighboursToggle.checked = !!config.gridNeighbours;
        if (gridOccupiedToggle) gridOccupiedToggle.checked = !!config.gridOccupied;
    };

    syncGridUI();
    buildSpatialGridDebugView(config.gridCellSize);
    toggleSpatialGridDebug(config.gridDebug);
    gridDebugToggle?.addEventListener('change', (e) => {
        toggleSpatialGridDebug(e.target.checked);
        syncGridUI();
    });

    gridNeighboursToggle?.addEventListener('change', (e) => {
        config.gridNeighbours = e.target.checked;
        updateSpatialGridDebug();
    });

    gridOccupiedToggle?.addEventListener('change', (e) => {
        config.gridOccupied = e.target.checked;
        buildSpatialGridDebugView(config.gridCellSize);
        rebuildSpatialGrid();
        updateSpatialGridDebug();
    });

    window.addEventListener('keydown', (e) => {
        if (e.key.toLowerCase() === 'g') {
    toggleSpatialGridDebug(!config.gridDebug);
    syncGridUI();
        }
    });

    const agentLodToggle = document.getElementById('agentLodToggle');
    const lodNearSlider = document.getElementById('lodNearDist');
    const lodMidSlider = document.getElementById('lodMidDist');
    const debugLodToggle = document.getElementById('debugLodToggle');
    const syncLodDistanceConfig = (changed) => {
        if (!lodNearSlider || !lodMidSlider) return;
        let near = parseInt(lodNearSlider.value, 10);
        let mid = parseInt(lodMidSlider.value, 10);
        if (near >= mid) {
            if (changed === 'near') {
                const midMax = parseInt(lodMidSlider.max, 10);
                mid = Math.min(midMax, near + 1);
                lodMidSlider.value = String(mid);
            } else {
                const nearMin = parseInt(lodNearSlider.min, 10);
                near = Math.max(nearMin, mid - 1);
                lodNearSlider.value = String(near);
            }
        }
        config.agentLodNearDist = near;
        config.agentLodMidDist = mid;
        document.getElementById('lodNearValue').textContent = near + 'm';
        document.getElementById('lodMidValue').textContent = mid + 'm';
    };

    if (agentLodToggle) agentLodToggle.checked = config.agentLodEnabled;
    if (lodNearSlider) { lodNearSlider.value = String(config.agentLodNearDist); document.getElementById('lodNearValue').textContent = config.agentLodNearDist + 'm'; }
    if (lodMidSlider) { lodMidSlider.value = String(config.agentLodMidDist); document.getElementById('lodMidValue').textContent = config.agentLodMidDist + 'm'; }
    syncLodDistanceConfig('near');
    if (debugLodToggle) debugLodToggle.checked = config.debugLod;
    agentLodToggle?.addEventListener('change', (e) => {
        config.agentLodEnabled = e.target.checked;
        rebuildAgentLOD();
    });

    lodNearSlider?.addEventListener('input', () => {
        syncLodDistanceConfig('near');
    });

    lodMidSlider?.addEventListener('input', () => {
        syncLodDistanceConfig('mid');
    });

    debugLodToggle?.addEventListener('change', (e) => {
        config.debugLod = e.target.checked;
        if (!config.debugLod) {
            for (let i = 0; i < agentSystem.pedestrians.length; i++) {
                const color = hashVector3ToColor(agentSystem.pedestrians[i].position);
                agentSystem.pedestrianInstanced.setColorAt(i, color);
                if (agentLOD.pedestrianMid) agentLOD.pedestrianMid.setColorAt(i, color);
            }
            for (let i = 0; i < agentSystem.drones.length; i++) {
                const color = hashVector3ToColor(agentSystem.drones[i].position);
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
    });

    const bloomToggle = document.getElementById('bloomToggle');
    const bloomStrengthSlider = document.getElementById('bloomStrength');
    const bloomRadiusSlider = document.getElementById('bloomRadius');
    const bloomThresholdSlider = document.getElementById('bloomThreshold');
    const bokehToggle = document.getElementById('bokehToggle');
    const bokehFocusSlider = document.getElementById('bokehFocus');
    const bokehApertureSlider = document.getElementById('bokehAperture');
    const bokehMaxBlurSlider = document.getElementById('bokehMaxBlur');
    const aaModeSelect = document.getElementById('aaMode');
    const applyBloomSettings = () => {
        postProcessing.applyBloomFromConfig(config);
    };

    const applyBokehSettings = () => {
        postProcessing.applyBokehFromConfig(config);
    };

    const msaaAvailable = postProcessing.maxMsaaSamples > 0;
    if (aaModeSelect) {
        const msaaOption = aaModeSelect.querySelector('option[value="MSAA"]');
        if (msaaOption && !msaaAvailable) {
            msaaOption.disabled = true;
            msaaOption.textContent = 'MSAA (Unavailable)';
            if (config.aaMode === 'MSAA') config.aaMode = 'FXAA';
        }
    }

    if (bloomToggle) bloomToggle.checked = config.bloomEnabled;
    if (bokehToggle) bokehToggle.checked = config.bokehEnabled;
    if (bloomStrengthSlider) { bloomStrengthSlider.value = String(config.bloomStrength); document.getElementById('bloomStrengthValue').textContent = config.bloomStrength.toFixed(1); }
    if (bloomRadiusSlider) { bloomRadiusSlider.value = String(config.bloomRadius); document.getElementById('bloomRadiusValue').textContent = config.bloomRadius.toFixed(2); }
    if (bloomThresholdSlider) { bloomThresholdSlider.value = String(config.bloomThreshold); document.getElementById('bloomThresholdValue').textContent = config.bloomThreshold.toFixed(2); }
    if (bokehFocusSlider) { bokehFocusSlider.value = String(config.bokehFocus); document.getElementById('bokehFocusValue').textContent = config.bokehFocus.toFixed(0); }
    if (bokehApertureSlider) { bokehApertureSlider.value = String(config.bokehAperture); document.getElementById('bokehApertureValue').textContent = config.bokehAperture.toFixed(5); }
    if (bokehMaxBlurSlider) { bokehMaxBlurSlider.value = String(config.bokehMaxBlur); document.getElementById('bokehMaxBlurValue').textContent = config.bokehMaxBlur.toFixed(4); }
    if (aaModeSelect) aaModeSelect.value = config.aaMode;
    
    applyBloomSettings();
    applyBokehSettings();
    bloomToggle?.addEventListener('change', (e) => {
        config.bloomEnabled = e.target.checked;
        applyBloomSettings();
    });
    bokehToggle?.addEventListener('change', (e) => {
        config.bokehEnabled = e.target.checked;
        applyBokehSettings();
    });
    bloomStrengthSlider?.addEventListener('input', (e) => {
        config.bloomStrength = parseFloat(e.target.value);
        document.getElementById('bloomStrengthValue').textContent = config.bloomStrength.toFixed(1);
        applyBloomSettings();
    });
    bloomRadiusSlider?.addEventListener('input', (e) => {
        config.bloomRadius = parseFloat(e.target.value);
        document.getElementById('bloomRadiusValue').textContent = config.bloomRadius.toFixed(2);
        applyBloomSettings();
    });
    bloomThresholdSlider?.addEventListener('input', (e) => {
        config.bloomThreshold = parseFloat(e.target.value);
        document.getElementById('bloomThresholdValue').textContent = config.bloomThreshold.toFixed(2);
        applyBloomSettings();
    });
    bokehFocusSlider?.addEventListener('input', (e) => {
        config.bokehFocus = parseFloat(e.target.value);
        document.getElementById('bokehFocusValue').textContent = config.bokehFocus.toFixed(0);
        applyBokehSettings();
    });
    bokehApertureSlider?.addEventListener('input', (e) => {
        config.bokehAperture = parseFloat(e.target.value);
        document.getElementById('bokehApertureValue').textContent = config.bokehAperture.toFixed(5);
        applyBokehSettings();
    });
    bokehMaxBlurSlider?.addEventListener('input', (e) => {
        config.bokehMaxBlur = parseFloat(e.target.value);
        document.getElementById('bokehMaxBlurValue').textContent = config.bokehMaxBlur.toFixed(4);
        applyBokehSettings();
    });
    aaModeSelect?.addEventListener('change', (e) => {
        const mode = e.target.value;
        if (mode === 'None' || mode === 'MSAA' || mode === 'FXAA') {
            config.aaMode = (mode === 'MSAA' && !msaaAvailable) ? 'FXAA' : mode;
            e.target.value = config.aaMode;
        }
    });
}

export { setupControls };
