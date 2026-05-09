import * as THREE from 'three';

// Procedural / parametric modelling utilities

// Bezier curve evaluation (Bernstein form)
// Used to generate parametric profiles (arches, domes, roof silhouettes)

function evaluateBezierCurve(controlPoints, t) {
    // Clamp parameter to curve domain [0,1] to avoid NaNs and keep geometry stable
    t = Math.max(0, Math.min(1, t));
    const n = controlPoints.length - 1;
    let point = new THREE.Vector3(0, 0, 0);
    for (let i = 0; i <= n; i++) {
        const basis = bernsteinBasis(i, n, t);
        point.addScaledVector(controlPoints[i], basis);
    }
    return point;
}

// Bernstein basis polynomial for Bezier curves

function bernsteinBasis(i, n, t) {
    const c = binomial(n, i);
    const term1 = Math.pow(1 - t, n - i);
    const term2 = Math.pow(t, i);
    return c * term1 * term2;
}

function binomial(n, k) {
    if (k > n) return 0;
    if (k === 0 || k === n) return 1;
    let result = 1;
    for (let i = 0; i < k; i++) {
        result = result * (n - i) / (i + 1);
    }
    return result;
}

// Catmull-Rom spline segment evaluation (uniform form).

function evaluateCatmullRom(p0, p1, p2, p3, t, target = null) {
    const t2 = t * t;
    const t3 = t2 * t;
    const a0 = -0.5 * t3 + t2 - 0.5 * t;
    const a1 = 1.5 * t3 - 2.5 * t2 + 1.0;
    const a2 = -1.5 * t3 + 2.0 * t2 + 0.5 * t;
    const a3 = 0.5 * t3 - 0.5 * t2;
    const out = target || new THREE.Vector3();
    return out.set(
        a0 * p0.x + a1 * p1.x + a2 * p2.x + a3 * p3.x,
        a0 * p0.y + a1 * p1.y + a2 * p2.y + a3 * p3.y,
        a0 * p0.z + a1 * p1.z + a2 * p2.z + a3 * p3.z
    );
}

// Derivative of Catmull-Rom segment

function catmullRomTangent(p0, p1, p2, p3, t, target = null) {
    const t2 = t * t;
    const a0 = -1.5 * t2 + 2.0 * t - 0.5;
    const a1 = 4.5 * t2 - 5.0 * t;
    const a2 = -4.5 * t2 + 4.0 * t + 0.5;
    const a3 = 1.5 * t2 - t;
    const out = target || new THREE.Vector3();
    return out.set(
        a0 * p0.x + a1 * p1.x + a2 * p2.x + a3 * p3.x,
        a0 * p0.y + a1 * p1.y + a2 * p2.y + a3 * p3.y,
        a0 * p0.z + a1 * p1.z + a2 * p2.z + a3 * p3.z
    );
}

// Piecewise Catmull-Rom spline over waypoints.

function evaluateCatmullRomSpline(waypoints, t) {
    const count = waypoints.length;
    if (count === 0) return new THREE.Vector3(0, 0, 0);
    if (count === 1) return waypoints[0].clone();
    if (count === 2) return new THREE.Vector3().lerpVectors(
        waypoints[0],
        waypoints[1],
        Math.max(0, Math.min(1, t))
    );

    const clampedT = Math.max(0, Math.min(1, t));
    const segmentCount = count - 1;
    const scaled = clampedT * segmentCount;
    const segment = Math.min(segmentCount - 1, Math.floor(scaled));
    const localT = scaled - segment;
    const p0 = waypoints[Math.max(0, segment - 1)];
    const p1 = waypoints[segment];
    const p2 = waypoints[segment + 1];
    const p3 = waypoints[Math.min(count - 1, segment + 2)];
    return evaluateCatmullRom(p0, p1, p2, p3, localT);
}

// B-Spline surface support

const BSPLINE_EPSILON = 1e-9;
const BSPLINE_DEBUG_LINE_MATERIAL = new THREE.LineBasicMaterial({
    color: 0x2ec4ff,
    transparent: true,
    opacity: 0.9,
    depthTest: false
});
const BSPLINE_DEBUG_POINT_MATERIAL = new THREE.MeshBasicMaterial({
    color: 0xffb703,
    depthTest: false
});
const BSPLINE_DEBUG_POINT_GEOMETRY = new THREE.SphereGeometry(1, 8, 6);

// Generate a clamped (open uniform) knot vector in [0,1].
function generateClampedKnotVector(controlPointCount, degree) {
    const clampedDegree = Math.max(1, Math.min(degree, controlPointCount - 1));
    const knotCount = controlPointCount + clampedDegree + 1;
    const knots = new Array(knotCount).fill(0);
    const interiorCount = controlPointCount - clampedDegree - 1;

    for (let i = 0; i <= clampedDegree; i++) {
        knots[i] = 0;
    }

    for (let i = 1; i <= interiorCount; i++) {
        knots[clampedDegree + i] = i / (interiorCount + 1);
    }

    for (let i = knotCount - clampedDegree - 1; i < knotCount; i++) {
        knots[i] = 1;
    }

    return knots;
}

// Cox-De Boor recursion for B-spline basis N_{i,degree}(t).
// Memoised per (i,degree) for a given t to reduce repeated recursion cost.
function coxDeBoorBasis(i, degree, t, knots, lastControlIndex, memo) {
    const key = `${i}|${degree}`;
    if (memo.has(key)) return memo.get(key);

    let value;
    if (degree === 0) {
        // Special-case t≈1: with repeated end knots, the final basis should evaluate to 1
        // only for the last control point (avoids "falling off" at the end due to t<knot[i+1]).
        if (t >= knots[knots.length - 1] - BSPLINE_EPSILON) {
            value = (i === lastControlIndex) ? 1 : 0;
        } else {
            value = (knots[i] <= t && t < knots[i + 1]) ? 1 : 0;
        }
        memo.set(key, value);
        return value;
    }

    // Denominators can be zero when knots are repeated (clamping).
    // Skip those terms to avoid division by ~0 and keep evaluation stable.
    const denomA = knots[i + degree] - knots[i];
    const denomB = knots[i + degree + 1] - knots[i + 1];
    let termA = 0;
    let termB = 0;

    if (denomA > BSPLINE_EPSILON) {
        termA = ((t - knots[i]) / denomA) * coxDeBoorBasis(i, degree - 1, t, knots, lastControlIndex, memo);
    }
    if (denomB > BSPLINE_EPSILON) {
        termB = ((knots[i + degree + 1] - t) / denomB) * coxDeBoorBasis(i + 1, degree - 1, t, knots, lastControlIndex, memo);
    }

    value = termA + termB;
    memo.set(key, value);
    return value;
}

// Compute all basis weights at parameter t.
// Returns an array of length controlPointCount; weights are mostly local (sparse influence).
function computeBasisArray(t, degree, knots, controlPointCount) {
    const basis = new Array(controlPointCount).fill(0);
    const clampedT = Math.max(0, Math.min(1, t));
    const memo = new Map();
    const lastControlIndex = controlPointCount - 1;
    for (let i = 0; i < controlPointCount; i++) {
        basis[i] = coxDeBoorBasis(i, degree, clampedT, knots, lastControlIndex, memo);
    }
    return basis;
}

// Evaluate tensor-product B-spline surface at (u,v).
// S(u,v)=Σ_j Σ_i  (Bv[j] * Bu[i]) * controlGrid[j][i]
// Small weights are skipped (epsilon) for speed and numerical stability.
function evaluateBSplineSurface(controlGrid, u, v, knotsU, knotsV, degreeU, degreeV) {
    const rows = controlGrid.length;
    if (rows === 0) return new THREE.Vector3(0, 0, 0);
    const cols = controlGrid[0].length;
    if (cols === 0) return new THREE.Vector3(0, 0, 0);

    const uDegree = Math.max(1, Math.min(degreeU, cols - 1));
    const vDegree = Math.max(1, Math.min(degreeV, rows - 1));
    const basisU = computeBasisArray(u, uDegree, knotsU, cols);
    const basisV = computeBasisArray(v, vDegree, knotsV, rows);
    let point = new THREE.Vector3(0, 0, 0);
    for (let j = 0; j < rows; j++) {
        // Skip near-zero basis weights: improves performance (many basis entries are ~0 due to local support).
        const bv = basisV[j];
        if (Math.abs(bv) < BSPLINE_EPSILON) continue;
        for (let i = 0; i < cols; i++) {
            const bu = basisU[i];
            if (Math.abs(bu) < BSPLINE_EPSILON) continue;
            const weight = bu * bv;
            if (Math.abs(weight) > BSPLINE_EPSILON) {
                point.addScaledVector(controlGrid[j][i], weight);
            }
        }
    }
    return point;
}

// Visual debug: render the control "cage" (grid edges + point markers).
// This is used in the demo/report to prove the object is parametric (lecture-style control hull).
function createBSplineControlCage(controlGrid, opts = {}) {
    const group = new THREE.Group();
    if (!Array.isArray(controlGrid) || controlGrid.length === 0 || !Array.isArray(controlGrid[0]) || controlGrid[0].length === 0) {
        return group;
    }

    const rows = controlGrid.length;
    const cols = controlGrid[0].length;
    const pointRadius = Math.max(0.02, Number.isFinite(opts.pointRadius) ? opts.pointRadius : 0.12);
    const linePositions = [];

    for (let j = 0; j < rows; j++) {
        for (let i = 0; i < cols - 1; i++) {
            const a = controlGrid[j][i];
            const b = controlGrid[j][i + 1];
            linePositions.push(a.x, a.y, a.z, b.x, b.y, b.z);
        }
    }

    for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows - 1; j++) {
            const a = controlGrid[j][i];
            const b = controlGrid[j + 1][i];
            linePositions.push(a.x, a.y, a.z, b.x, b.y, b.z);
        }
    }

    if (linePositions.length > 0) {
        const lineGeom = new THREE.BufferGeometry();
        lineGeom.setAttribute('position', new THREE.Float32BufferAttribute(linePositions, 3));
        const lines = new THREE.LineSegments(lineGeom, BSPLINE_DEBUG_LINE_MATERIAL);
        lines.renderOrder = 980;
        group.add(lines);
    }

    for (let j = 0; j < rows; j++) {
        for (let i = 0; i < cols; i++) {
            const marker = new THREE.Mesh(BSPLINE_DEBUG_POINT_GEOMETRY, BSPLINE_DEBUG_POINT_MATERIAL);
            marker.position.copy(controlGrid[j][i]);
            marker.scale.setScalar(pointRadius);
            marker.renderOrder = 981;
            group.add(marker);
        }
    }

    group.name = opts.name || 'BSpline_ControlCage';
    return group;
}

// Convert a parametric surface function P(u,v) into a triangle mesh.

function createParametricGeometry(surfaceFunc, uDivisions = 20, vDivisions = 20) {
    const vertices = [];
    const indices = [];
    for (let j = 0; j <= vDivisions; j++) {
        for (let i = 0; i <= uDivisions; i++) {
            const u = i / uDivisions;
            const v = j / vDivisions;
            const point = surfaceFunc(u, v);
            vertices.push(point.x, point.y, point.z);
        }
    }
    for (let j = 0; j < vDivisions; j++) {
        for (let i = 0; i < uDivisions; i++) {
            const a = j * (uDivisions + 1) + i;
            const b = a + 1;
            const c = a + (uDivisions + 1);
            const d = c + 1;
            indices.push(a, c, b);
            indices.push(b, c, d);
        }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(vertices), 3));
    geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(indices), 1));
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    return geometry;
}

// Defines the Bezier control points for the arch profile, adjusting the shape based on width and height

function getCathedralArchControlPoints(width = 20, height = 30) {
    const halfWidth = width * 0.5;
    return [
        new THREE.Vector3(-halfWidth, 0, 0),
        new THREE.Vector3(-halfWidth * 0.5, height * 0.4, 0),
        new THREE.Vector3(0, height * 1.3, 0),
        new THREE.Vector3(halfWidth * 0.5, height * 0.4, 0),
        new THREE.Vector3(halfWidth, 0, 0)
    ];
}

// Generate a solid cathedral arch with Bezier profile

function createCathedralArch(width = 20, height = 30, depth = 4) {
    const archProfile = getCathedralArchControlPoints(width, height);
    const segments = 40;
    const points2D = [];

    for (let i = 0; i <= segments; i++) {
        const t = i / segments;
        const p = evaluateBezierCurve(archProfile, t);
        points2D.push(new THREE.Vector2(p.x, p.y));
    }

    const shape = new THREE.Shape();
    shape.moveTo(points2D[0].x, points2D[0].y);
    for (let i = 1; i < points2D.length; i++) {
        shape.lineTo(points2D[i].x, points2D[i].y);
    }
    // Close the arch outline by adding the base line back to y=0 (creates a filled shape for extrusion).
    shape.lineTo(points2D[points2D.length - 1].x, 0);
    shape.lineTo(points2D[0].x, 0);
    shape.closePath();

    const geom = new THREE.ExtrudeGeometry(shape, {
        depth,
        steps: 1,
        bevelEnabled: false
    });
    geom.translate(0, 0, -depth * 0.5);
    geom.computeVertexNormals();
    return geom;
}

// Visual debug: show control cage for arch

function createCathedralArchControlCage(width = 20, height = 30, depth = 4, opts = {}) {
    const scaledPointSize = Math.max(0.35, Math.min(width, height) * 0.04);
    const scaledLineRadius = Math.max(0.14, Math.min(width, height) * 0.03);
    const {
        pointSize = scaledPointSize,
        lineRadius = scaledLineRadius,
        showPoints = true,
        opacity = 1.0
    } = opts;

    const useTransparency = opacity < 0.999;

    const cps = getCathedralArchControlPoints(width, height);
    const z0 = -depth * 0.5;
    const z1 = depth * 0.5;

    const segments = [];
    const pushSeg = (ax, ay, az, bx, by, bz) => {
        segments.push(
            new THREE.Vector3(ax, ay, az),
            new THREE.Vector3(bx, by, bz)
        );
    };

    for (let i = 0; i < cps.length - 1; i++) {
        const a = cps[i];
        const b = cps[i + 1];
        pushSeg(a.x, a.y, z0, b.x, b.y, z0);
        pushSeg(a.x, a.y, z1, b.x, b.y, z1);
    }

    for (let i = 0; i < cps.length; i++) {
        const p = cps[i];
        pushSeg(p.x, p.y, z0, p.x, p.y, z1);
    }

    const cageMat = new THREE.MeshBasicMaterial({
        color: 0x66ff66,
        transparent: useTransparency,
        opacity: opacity,
        depthTest: false,
        side: THREE.DoubleSide
    });
    cageMat.depthWrite = false;
    cageMat.toneMapped = false;

    const segmentCount = segments.length / 2;
    const segGeo = new THREE.CylinderGeometry(1, 1, 1, 8, 1);
    const segMesh = new THREE.InstancedMesh(segGeo, cageMat, segmentCount);
    segMesh.renderOrder = 10000;
    segMesh.frustumCulled = false;
    segMesh.raycast = () => {};

    const yAxis = new THREE.Vector3(0, 1, 0);
    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    const mid = new THREE.Vector3();
    const dir = new THREE.Vector3();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    const m = new THREE.Matrix4();

    for (let i = 0; i < segmentCount; i++) {
        a.copy(segments[i * 2]);
        b.copy(segments[i * 2 + 1]);
        dir.subVectors(b, a);
        const len = dir.length();
        if (len < 1e-5) {
            q.identity();
            s.set(lineRadius, 1e-5, lineRadius);
            mid.copy(a);
        } else {
            dir.multiplyScalar(1 / len);
            q.setFromUnitVectors(yAxis, dir);
            s.set(lineRadius, len, lineRadius);
            mid.addVectors(a, b).multiplyScalar(0.5);
        }
        m.compose(mid, q, s);
        segMesh.setMatrixAt(i, m);
    }
    segMesh.instanceMatrix.needsUpdate = true;

    const group = new THREE.Group();
    group.name = 'CathedralArch_ControlCage';
    group.add(segMesh);

    if (showPoints) {
        const count = cps.length * 2;
        const sphereGeo = new THREE.SphereGeometry(pointSize, 10, 10);
        const sphereMat = new THREE.MeshBasicMaterial({
            color: 0xffaa00,
            depthTest: false,
            transparent: useTransparency,
            opacity: opacity
        });
        sphereMat.depthWrite = false;
        sphereMat.toneMapped = false;
        const inst = new THREE.InstancedMesh(sphereGeo, sphereMat, count);
        inst.renderOrder = 10001;
        inst.frustumCulled = false;
        inst.raycast = () => {};

        const m = new THREE.Matrix4();
        let k = 0;
        for (let i = 0; i < cps.length; i++) {
            const p = cps[i];
            m.makeTranslation(p.x, p.y, z0);
            inst.setMatrixAt(k++, m);
            m.makeTranslation(p.x, p.y, z1);
            inst.setMatrixAt(k++, m);
        }
        inst.instanceMatrix.needsUpdate = true;
        group.add(inst);
    }

    return group;
}

// Terrain as a B-spline surface over a control grid.
// Gives a smooth heightfield suitable for navigation; resolution controls tessellation density.
function createTerrainSurface(width = 100, length = 100, scale = 5) {
    const gridSize = 6;
    const degree = 3;
    const controlGrid = [];
    const spanDivisor = gridSize - 1;
    for (let j = 0; j < gridSize; j++) {
        const row = [];
        const v = j / spanDivisor;
        for (let i = 0; i < gridSize; i++) {
            const u = i / spanDivisor;
            const x = u * width - width / 2;
            const z = v * length - length / 2;
            const height =
                Math.sin(u * Math.PI) *
                Math.cos(v * Math.PI) *
                scale;
            row.push(new THREE.Vector3(x, height, z));
        }
        controlGrid.push(row);
    }
    const knotsU = generateClampedKnotVector(gridSize, degree);
    const knotsV = generateClampedKnotVector(gridSize, degree);
    const surfaceFunc = (u, v) => {
        return evaluateBSplineSurface(controlGrid, u, v, knotsU, knotsV, degree, degree);
    };
    return createParametricGeometry(surfaceFunc, 30, 30);
}

// Build a path ribbon by sampling a Catmull-Rom spline and offsetting left/right using a local normal.

function createGardenPath(waypoints, width = 2.5, segments = 50) {
    const vertices = [];
    const indices = [];
    if (waypoints.length < 4) {
        return new THREE.BufferGeometry();
    }
    const samplesPerSegment = Math.max(1, Math.floor(segments));
    const halfWidth = width * 0.5;
    const up = new THREE.Vector3(0, 1, 0);
    const point = new THREE.Vector3();
    const tangent = new THREE.Vector3();
    const normal = new THREE.Vector3();
    const leftPoint = new THREE.Vector3();
    const rightPoint = new THREE.Vector3();

    for (let segmentIdx = 1; segmentIdx < waypoints.length - 2; segmentIdx++) {
        const p0 = waypoints[segmentIdx - 1];
        const p1 = waypoints[segmentIdx];
        const p2 = waypoints[segmentIdx + 1];
        const p3 = waypoints[segmentIdx + 2];
        const startSample = (segmentIdx === 1) ? 0 : 1;
        for (let s = startSample; s <= samplesPerSegment; s++) {
            const t = s / samplesPerSegment;
            evaluateCatmullRom(p0, p1, p2, p3, t, point);
            catmullRomTangent(p0, p1, p2, p3, t, tangent).normalize();
            normal.crossVectors(tangent, up).normalize();
            leftPoint.copy(point).addScaledVector(normal, -halfWidth);
            rightPoint.copy(point).addScaledVector(normal, halfWidth);
            vertices.push(
                leftPoint.x, leftPoint.y, leftPoint.z,
                rightPoint.x, rightPoint.y, rightPoint.z
            );
        }
    }
    const sampleCount = vertices.length / 6;
    for (let i = 0; i < sampleCount - 1; i++) {
        const a = i * 2;
        const b = a + 1;
        const c = a + 2;
        const d = a + 3;
        indices.push(a, b, c);
        indices.push(b, d, c);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(vertices), 3));
    if (indices.length > 0) {
        geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(indices), 1));
    }
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    return geometry;
}

function buildProceduralTowerControlGrid(height = 25, baseRadius = 8, topRadius = 3) {
    const controlGrid = [];
    const gridSize = 5;
    for (let j = 0; j < gridSize; j++) {
        const row = [];
        const v = j / (gridSize - 1);
        const radius = baseRadius + (topRadius - baseRadius) * v;
        const y = v * height;
        for (let i = 0; i < gridSize; i++) {
            const u = (i / (gridSize - 1)) * Math.PI * 2;
            const x = Math.cos(u) * radius;
            const z = Math.sin(u) * radius;
            row.push(new THREE.Vector3(x, y, z));
        }
        controlGrid.push(row);
    }
    return controlGrid;
}

function createProceduralTower(height = 25, baseRadius = 8, topRadius = 3) {
    const controlGrid = buildProceduralTowerControlGrid(height, baseRadius, topRadius);
    const gridSize = controlGrid.length;
    const degree = 3;
    const knotsU = generateClampedKnotVector(gridSize, degree);
    const knotsV = generateClampedKnotVector(gridSize, degree);
    const surfaceFunc = (u, v) => {
        return evaluateBSplineSurface(controlGrid, u, v, knotsU, knotsV, degree, degree);
    };
    return createParametricGeometry(surfaceFunc, 20, 25);
}

function createProceduralTowerControlCage(height = 25, baseRadius = 8, topRadius = 3, opts = {}) {
    return createBSplineControlCage(
        buildProceduralTowerControlGrid(height, baseRadius, topRadius),
        { ...opts, name: opts.name || 'Tower_BSplineControlCage' }
    );
}

function createProceduralDome(radius = 15, height = 12) {
    const profile = [
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(radius * 0.33, height * 0.33, 0),
        new THREE.Vector3(radius * 0.67, height * 0.67, 0),
        new THREE.Vector3(radius, height, 0)
    ];
    const surfaceFunc = (u, v) => {
        const angle = u * Math.PI * 2;
        const profilePoint = evaluateBezierCurve(profile, v);
        const x = Math.cos(angle) * profilePoint.x;
        const y = profilePoint.y;
        const z = Math.sin(angle) * profilePoint.x;
        return new THREE.Vector3(x, y, z);
    };
    return createParametricGeometry(surfaceFunc, 30, 20);
}

// Procedural tent canopy using B-Spline surface

function buildProceduralTentCanopyControlGrid(radius = 3, peakHeight = 4, sag = 0.6) {
    const controlGrid = [];
    const gridSize = 5;
    for (let j = 0; j < gridSize; j++) {
        const row = [];
        const v = j / (gridSize - 1);           // 0..1
        const vCentre = (v - 0.5) * 2;          // -1..1
        for (let i = 0; i < gridSize; i++) {
            const u = i / (gridSize - 1);
            const uCentre = (u - 0.5) * 2;      // -1..1
            const x = uCentre * radius;
            const z = vCentre * radius;
            // Distance from centre normalised 0..1
            const d = Math.sqrt(uCentre * uCentre + vCentre * vCentre) / Math.SQRT2;
            // Catenary-inspired sag: high at centre, droops toward edges,
            // with corners slightly raised (pole supports)
            const isCorner = (i === 0 || i === gridSize - 1) && (j === 0 || j === gridSize - 1);
            const isEdgeMid = (!isCorner) && (i === 0 || i === gridSize - 1 || j === 0 || j === gridSize - 1);
            let y;
            if (i === Math.floor(gridSize / 2) && j === Math.floor(gridSize / 2)) {
                y = peakHeight;                   // Centre peak
            } else if (isCorner) {
                y = peakHeight * 0.45;            // Corner poles hold fabric up
            } else if (isEdgeMid) {
                y = peakHeight * (0.25 - sag * 0.15); // Edge midpoints sag
            } else {
                // Interior points: smooth blend from peak to edges
                y = peakHeight * (1.0 - d * 0.7) - sag * d * 0.3;
            }
            row.push(new THREE.Vector3(x, y, z));
        }
        controlGrid.push(row);
    }
    return controlGrid;
}

function createProceduralTentCanopy(radius = 3, peakHeight = 4, sag = 0.6) {
    const degree = 3;
    const controlGrid = buildProceduralTentCanopyControlGrid(radius, peakHeight, sag);
    const gridSize = controlGrid.length;
    const knotsU = generateClampedKnotVector(gridSize, degree);
    const knotsV = generateClampedKnotVector(gridSize, degree);
    const surfaceFunc = (u, v) => {
        return evaluateBSplineSurface(controlGrid, u, v, knotsU, knotsV, degree, degree);
    };
    return createParametricGeometry(surfaceFunc, 20, 20);
}

function createProceduralTentCanopyControlCage(radius = 3, peakHeight = 4, sag = 0.6, opts = {}) {
    return createBSplineControlCage(
        buildProceduralTentCanopyControlGrid(radius, peakHeight, sag),
        { ...opts, name: opts.name || 'TentCanopy_BSplineControlCage' }
    );
}

// Procedurally generated gravestone using profile lofting.
// Short profiles use Bézier; longer waypoint sets use Catmull-Rom.

function createProceduralGravestone(width = 1.2, height = 2.5, depth = 0.3, variant = 0) {
    const hw = width / 2;
    let profile;
    if (variant === 0) {
        // Rounded-top headstone: cubic Bézier with smooth dome
        profile = [
            new THREE.Vector3(-hw, 0, 0),
            new THREE.Vector3(-hw, height * 0.75, 0),
            new THREE.Vector3(0, height * 1.15, 0),    // overshoot for smooth dome
            new THREE.Vector3(hw, height * 0.75, 0),
            new THREE.Vector3(hw, 0, 0)
        ];
    } else if (variant === 1) {
        // Gothic pointed headstone: sharper peak via higher control points
        profile = [
            new THREE.Vector3(-hw, 0, 0),
            new THREE.Vector3(-hw, height * 0.6, 0),
            new THREE.Vector3(-hw * 0.2, height * 1.3, 0),  // Gothic point
            new THREE.Vector3(hw * 0.2, height * 1.3, 0),
            new THREE.Vector3(hw, height * 0.6, 0),
            new THREE.Vector3(hw, 0, 0)
        ];
    } else {
        // Ogee (S-curve) headstone: double curvature
        profile = [
            new THREE.Vector3(-hw, 0, 0),
            new THREE.Vector3(-hw, height * 0.5, 0),
            new THREE.Vector3(-hw * 1.1, height * 0.75, 0), // flare out
            new THREE.Vector3(-hw * 0.3, height * 0.95, 0), // pinch in
            new THREE.Vector3(0, height * 1.05, 0),          // peak
            new THREE.Vector3(hw * 0.3, height * 0.95, 0),
            new THREE.Vector3(hw * 1.1, height * 0.75, 0),
            new THREE.Vector3(hw, height * 0.5, 0),
            new THREE.Vector3(hw, 0, 0)
        ];
    }
    const profileEvaluator = profile.length <= 4 ? evaluateBezierCurve : evaluateCatmullRomSpline;
    // Loft profile along depth (z-axis)
    const surfaceFunc = (u, v) => {
        const z = (u - 0.5) * depth;
        const point = profileEvaluator(profile, v);
        point.z = z;
        return point;
    };
    return createParametricGeometry(surfaceFunc, 6, 24);
}

// Procedural stone base block for gravestones using parametric plinth

function createProceduralStoneBase(width = 2.0, height = 0.8, depth = 1.2, tiers = 2) {
    const group = new THREE.Group();
    
    for (let tier = 0; tier < tiers; tier++) {
        const tierRatio = Math.pow(0.88, tier); // Geometric reduction
        const tierHeight = height / tiers;
        const tierWidth = width * tierRatio;
        const tierDepth = depth * tierRatio;
        
        // Main block with subtle bevel
        const blockGeom = new THREE.BoxGeometry(tierWidth, tierHeight, tierDepth);
        const block = new THREE.Mesh(blockGeom);
        block.position.y = (tier * tierHeight) + tierHeight / 2;
        group.add(block);
        
        // Cap/ledge at top of each tier (except top tier)
        if (tier < tiers - 1) {
            const capWidth = tierWidth + 0.08;
            const capDepth = tierDepth + 0.08;
            const capGeom = new THREE.BoxGeometry(capWidth, 0.05, capDepth);
            const cap = new THREE.Mesh(capGeom);
            cap.position.y = (tier + 1) * tierHeight;
            group.add(cap);
        }
    }
    
    return group;
}


// Procedural Obelisk using Bézier profile of revolution

function createProceduralObelisk(baseRadius = 0.4, height = 3.0) {
    const profile = [
        new THREE.Vector3(baseRadius, 0, 0),
        new THREE.Vector3(baseRadius * 0.95, height * 0.3, 0),
        new THREE.Vector3(baseRadius * 0.7, height * 0.7, 0),
        new THREE.Vector3(baseRadius * 0.15, height * 0.92, 0),
        new THREE.Vector3(0, height, 0)    // pointed tip
    ];
    const surfaceFunc = (u, v) => {
        const angle = u * Math.PI * 2;
        const profilePoint = evaluateBezierCurve(profile, v);
        const x = Math.cos(angle) * profilePoint.x;
        const y = profilePoint.y;
        const z = Math.sin(angle) * profilePoint.x;
        return new THREE.Vector3(x, y, z);
    };
    return createParametricGeometry(surfaceFunc, 12, 16);
}


// Procedural cross using Catmull-Rom profile lofting.

function createProceduralCross(armWidth = 0.2, totalHeight = 3.0, crossbarWidth = 1.2, depth = 0.2) {
    const hw = armWidth / 2;
    const cbHalf = crossbarWidth / 2;
    const crossbarY = totalHeight * 0.68;
    const crossbarH = armWidth;
    // Trace outline of a cross as a waypoint path; Catmull-Rom is used
    // because this profile has many points and should pass through them.
    const profile = [
        // Bottom-left corner
        new THREE.Vector3(-hw, 0, 0),
        // Left side up to crossbar
        new THREE.Vector3(-hw, crossbarY - crossbarH / 2 - 0.05, 0),
        // Left crossbar arm (slight rounded transition at junction)
        new THREE.Vector3(-hw - 0.05, crossbarY - crossbarH / 2, 0),
        new THREE.Vector3(-cbHalf, crossbarY - crossbarH / 2, 0),
        new THREE.Vector3(-cbHalf, crossbarY + crossbarH / 2, 0),
        new THREE.Vector3(-hw - 0.05, crossbarY + crossbarH / 2, 0),
        // Continue up to top
        new THREE.Vector3(-hw, crossbarY + crossbarH / 2 + 0.05, 0),
        new THREE.Vector3(-hw, totalHeight * 0.95, 0),
        // Rounded top
        new THREE.Vector3(0, totalHeight, 0),
        // Right side mirror (descending)
        new THREE.Vector3(hw, totalHeight * 0.95, 0),
        new THREE.Vector3(hw, crossbarY + crossbarH / 2 + 0.05, 0),
        // Right crossbar arm
        new THREE.Vector3(hw + 0.05, crossbarY + crossbarH / 2, 0),
        new THREE.Vector3(cbHalf, crossbarY + crossbarH / 2, 0),
        new THREE.Vector3(cbHalf, crossbarY - crossbarH / 2, 0),
        new THREE.Vector3(hw + 0.05, crossbarY - crossbarH / 2, 0),
        // Right side down
        new THREE.Vector3(hw, crossbarY - crossbarH / 2 - 0.05, 0),
        new THREE.Vector3(hw, 0, 0)
    ];
    const crossProfileCurve = new THREE.CatmullRomCurve3(profile, false, 'centripetal');
    const profilePoint = new THREE.Vector3();
    const surfacePoint = new THREE.Vector3();
    const surfaceFunc = (u, v) => {
        const z = (u - 0.5) * depth;
        crossProfileCurve.getPoint(v, profilePoint);
        return surfacePoint.set(profilePoint.x, profilePoint.y, z);
    };
    return createParametricGeometry(surfaceFunc, 6, 48);
}

// Procedural grave mound using B-Spline surface

function buildProceduralGraveMoundControlGrid(length = 2.5, width = 1.0, moundHeight = 0.35) {
    const controlGrid = [];
    const gridSize = 4;
    for (let j = 0; j < gridSize; j++) {
        const row = [];
        const v = j / (gridSize - 1);
        const vd = (v - 0.5) * 2;               
        for (let i = 0; i < gridSize; i++) {
            const u = i / (gridSize - 1);
            const ud = (u - 0.5) * 2;
            const x = ud * length / 2;
            const z = vd * width / 2;
            // Smooth ellipsoidal hump: highest at centre, zero at edges
            const d = Math.sqrt(ud * ud + vd * vd);
            const y = moundHeight * Math.max(0, 1 - d * d);
            row.push(new THREE.Vector3(x, y, z));
        }
        controlGrid.push(row);
    }
    return controlGrid;
}

// Create grave mound geometry by evaluating B-Spline surface defined by control grid

function createProceduralGraveMound(length = 2.5, width = 1.0, moundHeight = 0.35) {
    const degree = 3;
    const controlGrid = buildProceduralGraveMoundControlGrid(length, width, moundHeight);
    const gridSize = controlGrid.length;
    const knotsU = generateClampedKnotVector(gridSize, degree);
    const knotsV = generateClampedKnotVector(gridSize, degree);
    const surfaceFunc = (u, v) => {
        return evaluateBSplineSurface(controlGrid, u, v, knotsU, knotsV, degree, degree);
    };
    return createParametricGeometry(surfaceFunc, 12, 8);
}

// Visual debug: show control cage for grave mound

function createProceduralGraveMoundControlCage(length = 2.5, width = 1.0, moundHeight = 0.35, opts = {}) {
    return createBSplineControlCage(
        buildProceduralGraveMoundControlGrid(length, width, moundHeight),
        { ...opts, name: opts.name || 'GraveMound_BSplineControlCage' }
    );
}

const parametricGeometryCache = new Map();
function getOrCreateParametricGeometry(key, generator) {
    if (!parametricGeometryCache.has(key)) {
        parametricGeometryCache.set(key, generator());
    }
    return parametricGeometryCache.get(key);
}
function clearGeometryCache() {
    parametricGeometryCache.forEach(geom => geom.dispose());
    parametricGeometryCache.clear();
}
export {
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
};
