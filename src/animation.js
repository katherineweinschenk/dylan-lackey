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
  camera.position.set(0, 0, 14);

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

  // ─── Material Factory ───────────────────────────────────
  function makeMaterial(color = 0xffffff) {
    return new THREE.MeshPhysicalMaterial({
      color,
      metalness: 1.0,
      roughness: 0.05,
      envMap: envTex,
      envMapIntensity: 2.2,
      clearcoat: 1.0,
      clearcoatRoughness: 0.0,
    });
  }

  // ─── Borromean Rings ────────────────────────────────────
  //
  // Three tori in three mutually perpendicular planes, all
  // centred at the origin.  Viewed from most angles the rings
  // appear to pass through each other, giving the Borromean-
  // interlocked visual.  Each ring rotates on its own axis at
  // a slightly different speed; the whole group turns slowly.
  //
  const R = 2.0;   // major (ring) radius
  const r = 0.19;  // tube radius
  const TUBE_SEGS = 280;
  const RING_SEGS = 36;

  const geom = new THREE.TorusGeometry(R, r, RING_SEGS, TUBE_SEGS);

  // Slightly different tints keep the rings visually distinct.
  const matA = makeMaterial(0xffffff);  // pure chrome
  const matB = makeMaterial(0xf5f0eb);  // warm tint
  const matC = makeMaterial(0xebf0f5);  // cool tint

  // Ring 0 – in the XY plane (default torus orientation, axis along Z)
  const ring0 = new THREE.Mesh(geom, matA);

  // Ring 1 – in the XZ plane (rotate 90° around X so axis is along Y)
  const ring1 = new THREE.Mesh(geom, matB);
  ring1.rotation.x = Math.PI / 2;

  // Ring 2 – in the YZ plane (rotate 90° around Y so axis is along X)
  const ring2 = new THREE.Mesh(geom, matC);
  ring2.rotation.y = Math.PI / 2;

  const ringsGroup = new THREE.Group();
  ringsGroup.add(ring0, ring1, ring2);
  scene.add(ringsGroup);

  // ─── Animation Loop ─────────────────────────────────────
  const clock = new THREE.Clock();

  // Stored so callers can pause/resume opacity etc.
  let animationId;
  let targetOpacity = 1;
  let currentOpacity = 1;

  function animate() {
    animationId = requestAnimationFrame(animate);
    const t = clock.getElapsedTime();

    // Per-ring spin (each ring rotates in its own plane)
    ring0.rotation.z = t * 0.18;
    ring1.rotation.y += 0;   // ring1 already rotated via rotation.x;
                              // add a secondary spin around Y (its own normal)
    ring1.rotation.z = t * 0.14;
    ring2.rotation.x = t * 0.22;

    // Collective slow drift
    ringsGroup.rotation.y  = t * 0.07;
    ringsGroup.rotation.x  = Math.sin(t * 0.04) * 0.25;
    ringsGroup.rotation.z  = Math.cos(t * 0.03) * 0.08;

    // Subtle breathing scale
    const breathe = 1 + Math.sin(t * 1.4) * 0.025;
    ringsGroup.scale.setScalar(breathe);

    // Smooth opacity transition when pages switch
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
