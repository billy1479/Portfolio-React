import * as THREE from 'three';

const GREEN_VILLAGE_VARIANT_COUNT = 6;
const greenVillageWallVariants = [];
const greenVillageRoofVariants = [];
for (let i = 0; i < GREEN_VILLAGE_VARIANT_COUNT; i++) {
    const t = i / Math.max(1, GREEN_VILLAGE_VARIANT_COUNT - 1);
    greenVillageWallVariants.push(new THREE.MeshStandardMaterial({
        color: new THREE.Color().setHSL(0.06 + t * 0.05, 0.10 + t * 0.12, 0.24 + t * 0.12),
        roughness: 0.97,
        metalness: 0.01
    }));
    greenVillageRoofVariants.push(new THREE.MeshStandardMaterial({
        color: new THREE.Color().setHSL(0.06 + t * 0.05, 0.16 + t * 0.10, 0.14 + t * 0.08),
        roughness: 0.94,
        metalness: 0.01
    }));
}
const greenVillagePane = new THREE.MeshStandardMaterial({
    color: 0x1d4d67,
    roughness: 0.8,
    metalness: 0.04,
    emissive: 0x081823,
    emissiveIntensity: 0.03
});

const tentCanopyVariantHues = [0.05, 0.08, 0.11, 0.14, 0.17, 0.2];
const tentCanopyVariants = tentCanopyVariantHues.map(hue => (
    new THREE.MeshStandardMaterial({
        color: new THREE.Color().setHSL(hue, 0.7, 0.5),
        roughness: 0.7,
        side: THREE.DoubleSide
    })
));

const materials = {
    cathedralStone: new THREE.MeshStandardMaterial({
        color: 0x6b6b6b,
        roughness: 0.9,
        metalness: 0.1
    }),
    cathedralDark: new THREE.MeshStandardMaterial({
        color: 0x4a4a4a,
        roughness: 0.95,
        metalness: 0.05
    }),
    grass: new THREE.MeshStandardMaterial({
        color: 0x2d5a27,
        roughness: 0.9
    }),
    road: new THREE.MeshBasicMaterial({
        color: 0x3a3a3a,
        fog: false
    }),
    gravestone: new THREE.MeshStandardMaterial({
        color: 0x8f8f8f,
        roughness: 0.6,
        metalness: 0.05,
        emissive: 0x101010,
        emissiveIntensity: 0.06
    }),
    gravestoneBase: new THREE.MeshStandardMaterial({
        color: 0x787878,
        roughness: 0.85,
        metalness: 0.05,
        emissive: 0x0a0a0a,
        emissiveIntensity: 0.08
    }),
    graveMound: new THREE.MeshStandardMaterial({
        color: 0x7a6240,
        roughness: 0.92,
        metalness: 0.02,
        emissive: 0x0f0a06,
        emissiveIntensity: 0.04
    }),
    windowFrame: new THREE.MeshStandardMaterial({
        color: 0x3a3a3a,
        roughness: 0.85,
        metalness: 0.02
    }),
    windowPane: new THREE.MeshStandardMaterial({
        color: 0x1a4a6a,
        roughness: 0.2,
        metalness: 0.2,
        emissive: 0x0a2a3a,
        emissiveIntensity: 0.1
    }),
    tent: new THREE.MeshStandardMaterial({
        color: 0xcc9966,
        roughness: 0.7,
        side: THREE.DoubleSide
    }),
    tentUnderside: new THREE.MeshStandardMaterial({
        color: 0x8b6914,
        roughness: 0.92,
        side: THREE.BackSide
    }),
    tentCanopyVariants: tentCanopyVariants,
    greenVillageWallVariants: greenVillageWallVariants,
    greenVillageRoofVariants: greenVillageRoofVariants,
    greenVillagePane: greenVillagePane,
    wallStone: new THREE.MeshStandardMaterial({
        color: 0x5a5a5a,
        roughness: 0.95,
        metalness: 0.05
    }),
    ground: new THREE.MeshStandardMaterial({
        color: 0x3d2817,
        roughness: 1.0
    }),
    grassParametric: new THREE.MeshStandardMaterial({
        color: 0x3a7d3d,
        roughness: 0.95
    }),
    path: new THREE.MeshStandardMaterial({
        color: 0x808080,
        roughness: 0.85
    }),
    bush: new THREE.MeshStandardMaterial({
        color: 0x2f6b2d,
        roughness: 1.0
    })
};

export { materials };
