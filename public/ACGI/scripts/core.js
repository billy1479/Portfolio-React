import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';

const BOKEH_DEFAULTS = Object.freeze({
    enabled: false,
    // Initial camera-to-subject distance is ~112 units, so start focus near that for a visible demo baseline.
    focus: 110,
    aperture: 0.01,
    maxblur: 0.01
});

const BLOOM_DEFAULTS = Object.freeze({
    enabled: false,
    strength: 0.8,
    radius: 0.4,
    threshold: 0.6
});

function applyBokehConfigToPass(pass, bokehConfig) {
    if (!pass || !bokehConfig) return;
    pass.enabled = !!bokehConfig.bokehEnabled;
    const uniforms = pass.materialBokeh && pass.materialBokeh.uniforms;
    if (!uniforms) return;
    const focus = Number(bokehConfig.bokehFocus);
    const aperture = Number(bokehConfig.bokehAperture);
    const maxBlur = Number(bokehConfig.bokehMaxBlur);
    if (uniforms.focus && Number.isFinite(focus)) uniforms.focus.value = focus;
    if (uniforms.aperture && Number.isFinite(aperture)) uniforms.aperture.value = aperture;
    if (uniforms.maxblur && Number.isFinite(maxBlur)) uniforms.maxblur.value = maxBlur;
}

function applyBloomConfigToPass(pass, bloomConfig) {
    if (!pass || !bloomConfig) return;
    pass.enabled = !!bloomConfig.bloomEnabled;
    const strength = Number(bloomConfig.bloomStrength);
    const radius = Number(bloomConfig.bloomRadius);
    const threshold = Number(bloomConfig.bloomThreshold);
    if (Number.isFinite(strength)) pass.strength = strength;
    if (Number.isFinite(radius)) pass.radius = radius;
    if (Number.isFinite(threshold)) pass.threshold = threshold;
}

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
// Keep native 1:1 shading for clearer AA A/B comparisons in coursework capture.
const MAX_RENDER_PIXEL_RATIO = 1.0;
const AA_MODES = ['None', 'MSAA', 'FXAA'];
const TOWER_HEIGHT_MIN = 18;
const TOWER_HEIGHT_MAX = 35;
function getClampedPixelRatio() {
    return Math.min(window.devicePixelRatio || 1, MAX_RENDER_PIXEL_RATIO);
}
const renderer = new THREE.WebGLRenderer({ antialias: false });
renderer.setPixelRatio(getClampedPixelRatio());
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.shadowMap.autoUpdate = false;
document.body.appendChild(renderer.domElement);
const initialPixelRatio = getClampedPixelRatio();
const initialDrawWidth = Math.max(1, Math.round(window.innerWidth * initialPixelRatio));
const initialDrawHeight = Math.max(1, Math.round(window.innerHeight * initialPixelRatio));
const pmremGenerator = new THREE.PMREMGenerator(renderer);
pmremGenerator.compileEquirectangularShader();
scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
camera.position.set(-90, 55, 50);
camera.lookAt(10, 8, 30);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.maxPolarAngle = Math.PI / 2.1;
const clock = new THREE.Clock();
const raycaster = new THREE.Raycaster();
// Keep constructor dimensions in logical pixels; EffectComposer.setPixelRatio handles DPR scaling.
const composerRenderTarget = new THREE.WebGLRenderTarget(
    window.innerWidth,
    window.innerHeight,
    { samples: 0 }
);
const composer = new EffectComposer(renderer, composerRenderTarget);
if (typeof composer.setPixelRatio === 'function') {
    composer.setPixelRatio(getClampedPixelRatio());
}
const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);
const bokehPass = new BokehPass(scene, camera, {
    focus: BOKEH_DEFAULTS.focus,
    aperture: BOKEH_DEFAULTS.aperture,
    maxblur: BOKEH_DEFAULTS.maxblur,
    width: initialDrawWidth,
    height: initialDrawHeight
});
bokehPass.enabled = BOKEH_DEFAULTS.enabled;
composer.addPass(bokehPass);
const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(
        initialDrawWidth,
        initialDrawHeight
    ),
    BLOOM_DEFAULTS.strength,
    BLOOM_DEFAULTS.radius,
    BLOOM_DEFAULTS.threshold
);
// Keep DoF before Bloom: out-of-focus highlights become bokeh discs first, then Bloom enhances glow.
composer.addPass(bloomPass);
const fxaaPass = new ShaderPass(FXAAShader);
const fxaaDrawingBufferSize = new THREE.Vector2();
function updateFXAAResolution() {
    renderer.getDrawingBufferSize(fxaaDrawingBufferSize);
    const width = Math.max(1, fxaaDrawingBufferSize.x);
    const height = Math.max(1, fxaaDrawingBufferSize.y);
    fxaaPass.uniforms['resolution'].value.set(
        1 / width,
        1 / height
    );
}
updateFXAAResolution();
composer.addPass(fxaaPass);
const outputPass = new OutputPass();
composer.addPass(outputPass);
const postProcessing = {
    composer: composer,
    bokehPass: bokehPass,
    bloomPass: bloomPass,
    fxaaPass: fxaaPass,
    aaMode: 'FXAA',
    maxMsaaSamples: renderer.capabilities.isWebGL2
        ? Math.min(4, renderer.capabilities.maxSamples || 4)
        : 0,
    enabled: true,
    updateBloom: function(strength, radius, threshold) {
        this.bloomPass.strength = strength;
        this.bloomPass.radius = radius;
        this.bloomPass.threshold = threshold;
    },
    setAAMode: function(mode) {
        const requestedMode = AA_MODES.includes(mode) ? mode : 'FXAA';
        const resolvedMode = (requestedMode === 'MSAA' && this.maxMsaaSamples === 0) ? 'FXAA' : requestedMode;
        this.aaMode = resolvedMode;
        this.fxaaPass.enabled = (resolvedMode === 'FXAA');
        const targetSamples = (resolvedMode === 'MSAA') ? this.maxMsaaSamples : 0;
        const rt1 = this.composer.renderTarget1;
        const rt2 = this.composer.renderTarget2;
        if (rt1.samples !== targetSamples || rt2.samples !== targetSamples) {
            rt1.samples = targetSamples;
            rt2.samples = targetSamples;
            rt1.dispose();
            rt2.dispose();
        }
        // Maintain the originally supplied render target if composer buffers are ever rebound/reset.
        if (composerRenderTarget !== rt1 && composerRenderTarget.samples !== targetSamples) {
            composerRenderTarget.samples = targetSamples;
            composerRenderTarget.dispose();
        }
        return resolvedMode;
    },
    setFXAA: function(enabled) {
        this.setAAMode(enabled ? 'FXAA' : 'None');
    },
    setBokeh: function(enabled) {
        this.bokehPass.enabled = enabled;
    },
    applyBokehFromConfig: function(bokehConfig = config) {
        applyBokehConfigToPass(this.bokehPass, bokehConfig);
    },
    applyBloomFromConfig: function(bloomConfig = config) {
        applyBloomConfigToPass(this.bloomPass, bloomConfig);
    },
    hasActiveEffects: function() {
        return this.bokehPass.enabled || this.bloomPass.enabled || this.fxaaPass.enabled;
    },
    resize: function(width, height) {
        const pixelRatio = getClampedPixelRatio();
        const drawWidth = Math.max(1, Math.round(width * pixelRatio));
        const drawHeight = Math.max(1, Math.round(height * pixelRatio));
        renderer.setPixelRatio(pixelRatio);
        if (typeof this.composer.setPixelRatio === 'function') this.composer.setPixelRatio(pixelRatio);
        renderer.setSize(width, height);
        if (composerRenderTarget !== this.composer.renderTarget1) {
            composerRenderTarget.setSize(drawWidth, drawHeight);
        }
        this.composer.setSize(width, height);
        if (typeof this.bokehPass.setSize === 'function') this.bokehPass.setSize(drawWidth, drawHeight);
        if (typeof this.bloomPass.setSize === 'function') this.bloomPass.setSize(drawWidth, drawHeight);
        updateFXAAResolution();
    }
};
const config = {
    towerHeight: 25,
    graveCount: 20,
    tentCount: 5,
    treeCount: 280,
    bushCount: 900,
    treeCoverage: 50,
    treeDetailHighDist: 40,
    treeLodHysteresis: 8,
    isDay: true,
    lightIntensity: 50,
    riverFlowRate: 50,
    riverOffset: 11,
    gridDebug: false,
    gridNeighbours: true,
    gridOccupied: false,
    gridCellSize: 5, // Was 25
    pedestrianCount: 700,
    droneCount: 700,
    pedestrianSpacingScale: 1.0,
    droneSpacingScale: 1.0,
    agentBehaviors: true,
    raycastPedestrianLookahead: 8,
    raycastDroneLookahead: 12,
    raycastInterval: 4,
    raycastAvoidanceForceScale: 1.2,
    queueAheadDotThreshold: 0.35,
    pedestrianQueueBrakeRadius: 3.4,
    droneQueueBrakeRadius: 4.6,
    debugAgentPaths: false,
    debugVelocityVectors: false,
    debugCollisionRadius: false,
    debugSkeletons: false,
    debugAgentIDs: false,
    debugNav: false,
    debugParametricCages: false,
    debugBSplineCages: false,
    debugGardenPathCatmull: false,
    pedestrianLightIntensity: 0.3,
    droneLightIntensity: 0.3,
    buildingHeight: 12,
    greenBuildingCount: 10,
    greenBuildingSeed: 1,
    greenBldMinW: 6,
    greenBldMaxW: 16,
    greenBldMinD: 5,
    greenBldMaxD: 13,
    greenBldMinH: 6,
    greenBldMaxH: 20,
    greenBldMaxSpacing: 18,
    greenBldMinSpacing: 8,
    greenBldRoofPitchMin: 0.25,
    greenBldRoofPitchMax: 0.45,
    greenBldRoofCurve: 0.35,
    greenBldChimneyProb: 0.5,
    greenBldWindowSpacingX: 3.0,
    greenBldWindowSpacingY: 3.2,
    greenBldCurvedRoofs: true,
    agentLodEnabled: true,
    agentLodNearDist: 150,
    agentLodMidDist: 300,
    agentLodBlend: 20,
    agentLodHysteresis: 20,
    bokehEnabled: BOKEH_DEFAULTS.enabled,
    bokehFocus: BOKEH_DEFAULTS.focus,
    bokehAperture: BOKEH_DEFAULTS.aperture,
    bokehMaxBlur: BOKEH_DEFAULTS.maxblur,
    bloomEnabled: BLOOM_DEFAULTS.enabled,
    bloomStrength: BLOOM_DEFAULTS.strength,
    bloomRadius: BLOOM_DEFAULTS.radius,
    bloomThreshold: BLOOM_DEFAULTS.threshold,
    aaMode: 'FXAA',
    debugLod: false
};
postProcessing.setAAMode(config.aaMode);
postProcessing.applyBokehFromConfig(config);
postProcessing.applyBloomFromConfig(config);
const GREEN_LAYOUT = {
    centerX: 0,
    centerZ: 102,
    width: 90,
    length: 90,
    roadWidth: 10
};

const DIVIDER_WALL = {
    z: 47,
    length: 110,
    height: 3,
    thickness: 0.8,
    gateWidth: 6,
    gateXs: [-22, 0, 22]
};

const BUILDINGS_ZONE = {
    startZ: -5,
    centerX: -70,
    rowCount: 8,
    buildingWidth: 16,
    buildingDepth: 20,
    spacing: 3
};

const OPPOSITE_ROAD = {
    centerX: -50,
    startZ: -5,
    width: 10,
    spacing: 3
};

function getSceneBounds() {
    const buildingExtension = BUILDINGS_ZONE.rowCount * (BUILDINGS_ZONE.buildingDepth + BUILDINGS_ZONE.spacing) + 40;
    const buildingEndZ = BUILDINGS_ZONE.startZ - buildingExtension;
    const greenFarZ = GREEN_LAYOUT.centerZ + GREEN_LAYOUT.length / 2;
    const totalLength = greenFarZ - buildingEndZ + 40;
    const centerZ = (greenFarZ + buildingEndZ) / 2;
    return {
centerX: 15,
centerZ: centerZ,
	width: 180,
	length: totalLength
    };
}
export {
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
    getSceneBounds,
    clock,
    TOWER_HEIGHT_MIN,
    TOWER_HEIGHT_MAX
};
