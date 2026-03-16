import * as THREE from 'three';

export function initAnimation(container) {
  // ─── Scene Setup ────────────────────────────────────────
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xF0F0F0);
  scene.fog = new THREE.Fog(0xF0F0F0, 12, 32);

  const camera = new THREE.PerspectiveCamera(
    45,
    window.innerWidth / window.innerHeight,
    0.1,
    100
  );
  camera.position.set(0, 0, 9);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  container.appendChild(renderer.domElement);

  // ─── Environment Map ────────────────────────────────────
  const envCanvas = document.createElement('canvas');
  envCanvas.width = 1024;
  envCanvas.height = 512;
  const ctx = envCanvas.getContext('2d');

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, 1024, 512);
  ctx.fillStyle = '#020202';
  ctx.fillRect(80,  0, 160, 512);
  ctx.fillRect(380, 0,  90, 512);
  ctx.fillRect(680, 0, 210, 512);
  ctx.fillRect(940, 0,  60, 512);
  ctx.fillRect(0,   90, 1024,  45);
  ctx.fillRect(0,  390, 1024,  65);

  const envTex = new THREE.CanvasTexture(envCanvas);
  envTex.mapping = THREE.EquirectangularReflectionMapping;
  envTex.colorSpace = THREE.SRGBColorSpace;
  scene.environment = envTex;

  // ─── Lighting ───────────────────────────────────────────
  scene.add(new THREE.AmbientLight(0xffffff, 0.5));

  const d1 = new THREE.DirectionalLight(0xffffff, 3.0);
  d1.position.set(5, 5, 5);
  scene.add(d1);

  const d2 = new THREE.DirectionalLight(0xffffff, 2.0);
  d2.position.set(-5, 0, 5);
  scene.add(d2);

  // ─── Material ───────────────────────────────────────────
  const mat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    metalness: 1.0,
    roughness: 0.05,
    envMap: envTex,
    envMapIntensity: 2.2,
    clearcoat: 1.0,
    clearcoatRoughness: 0.0,
  });

  // ─── Trefoil Knot Tube ───────────────────────────────────
  // Parametric trefoil curve:
  //   x(t) = sin(t) + 2·sin(2t)
  //   y(t) = cos(t) - 2·cos(2t)
  //   z(t) = -sin(3t)
  // t ∈ [0, 2π] closes seamlessly.

  const CURVE_SEGS = 512;
  const TUBE_SEGS  = 24;
  const KNOT_R     = 1.1;   // overall scale
  const TUBE_R     = 0.22;  // tube radius

  class TrefoilCurve extends THREE.Curve {
    getPoint(t, out = new THREE.Vector3()) {
      const a = t * Math.PI * 2;
      return out.set(
        KNOT_R * (Math.sin(a) + 2 * Math.sin(2 * a)),
        KNOT_R * (Math.cos(a) - 2 * Math.cos(2 * a)),
        KNOT_R * (-Math.sin(3 * a))
      );
    }
  }

  const knotCurve = new TrefoilCurve();

  // ─── Dynamic tube geometry ───────────────────────────────
  // Rebuilt each frame so a travelling ripple can modulate the radius.

  const vertCount = (CURVE_SEGS + 1) * (TUBE_SEGS + 1);
  const posArr = new Float32Array(vertCount * 3);
  const uvArr  = new Float32Array(vertCount * 2);

  const idxArr = [];
  for (let j = 0; j < TUBE_SEGS; j++) {
    for (let i = 0; i < CURVE_SEGS; i++) {
      const a =  j      * (CURVE_SEGS + 1) + i;
      const b =  j      * (CURVE_SEGS + 1) + i + 1;
      const c = (j + 1) * (CURVE_SEGS + 1) + i + 1;
      const d = (j + 1) * (CURVE_SEGS + 1) + i;
      idxArr.push(a, b, d,  b, c, d);
    }
  }

  for (let j = 0; j <= TUBE_SEGS; j++) {
    for (let i = 0; i <= CURVE_SEGS; i++) {
      const idx = j * (CURVE_SEGS + 1) + i;
      uvArr[idx * 2]     = i / CURVE_SEGS;
      uvArr[idx * 2 + 1] = j / TUBE_SEGS;
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setIndex(idxArr);
  geometry.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
  geometry.setAttribute('uv',       new THREE.BufferAttribute(uvArr,  2));

  const mesh = new THREE.Mesh(geometry, mat);
  scene.add(mesh);

  // Precompute Frenet frames (closed = true so normals wrap)
  const frames = knotCurve.computeFrenetFrames(CURVE_SEGS, true);

  // ─── Surface Update ──────────────────────────────────────
  function updateSurface(t) {
    const pos = geometry.attributes.position.array;

    for (let i = 0; i <= CURVE_SEGS; i++) {
      const u  = i / CURVE_SEGS;
      const pt = knotCurve.getPointAt(u);
      const fi = Math.min(i, CURVE_SEGS - 1);
      const normal   = frames.normals[fi];
      const binormal = frames.binormals[fi];

      // Slow travelling ripple
      const r = TUBE_R * (1 + 0.10 * Math.sin(t * 1.6 + u * Math.PI * 6));

      for (let j = 0; j <= TUBE_SEGS; j++) {
        const theta = (j / TUBE_SEGS) * Math.PI * 2;
        const idx   = j * (CURVE_SEGS + 1) + i;
        const cos   = Math.cos(theta);
        const sin   = Math.sin(theta);

        pos[idx * 3]     = pt.x + r * (cos * normal.x + sin * binormal.x);
        pos[idx * 3 + 1] = pt.y + r * (cos * normal.y + sin * binormal.y);
        pos[idx * 3 + 2] = pt.z + r * (cos * normal.z + sin * binormal.z);
      }
    }

    geometry.attributes.position.needsUpdate = true;
    geometry.computeVertexNormals();
  }

  // ─── Animation Loop ─────────────────────────────────────
  const clock = new THREE.Clock();
  let targetOpacity  = 1;
  let currentOpacity = 1;

  function animate() {
    requestAnimationFrame(animate);
    const t = clock.getElapsedTime();

    updateSurface(t);

    // Slow orbit — tilt so the 3-fold symmetry reads clearly
    mesh.rotation.x = 0.45 + Math.sin(t * 0.06) * 0.18;
    mesh.rotation.z = t * 0.09;
    mesh.rotation.y = Math.cos(t * 0.05) * 0.14;

    if (currentOpacity !== targetOpacity) {
      currentOpacity += (targetOpacity - currentOpacity) * 0.06;
      if (Math.abs(currentOpacity - targetOpacity) < 0.002) {
        currentOpacity = targetOpacity;
      }
      renderer.domElement.style.opacity = currentOpacity;
    }

    renderer.render(scene, camera);
  }

  animate();

  // ─── Resize ─────────────────────────────────────────────
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  return {
    setOpacity(val) {
      targetOpacity = val;
    },
  };
}
