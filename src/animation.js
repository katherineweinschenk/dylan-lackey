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

  // ─── Wavy Ribbon Ring Geometry ──────────────────────────
  //
  // Each ring follows a wavy, non-circular path (like a hand-
  // drawn circle) and has a flat ribbon cross-section created
  // by scaling the tube geometry along its local normal axis.
  //

  class WavyRingCurve extends THREE.Curve {
    constructor(radius, wobbles, phase) {
      super();
      this.radius = radius;
      this.wobbles = wobbles; // array of {amp, freq, phaseOffset}
      this.phase = phase;
    }

    getPoint(t, optionalTarget = new THREE.Vector3()) {
      const angle = t * Math.PI * 2;
      let r = this.radius;
      let z = 0;
      for (const w of this.wobbles) {
        r += w.amp * Math.sin(w.freq * angle + this.phase + (w.phaseOffset || 0));
        z += (w.zAmp || 0) * Math.sin(w.freq * angle + this.phase * 0.7 + (w.phaseOffset || 0));
      }
      return optionalTarget.set(
        r * Math.cos(angle),
        r * Math.sin(angle),
        z
      );
    }
  }

  const R = 2.0;

  // Ring definitions: three main rings + one thinner fourth ring
  const ringDefs = [
    {
      // Ring I (top in image)
      wobbles: [
        { amp: 0.22, freq: 3, phaseOffset: 0, zAmp: 0.08 },
        { amp: 0.10, freq: 5, phaseOffset: 1.2, zAmp: 0.05 },
      ],
      phase: 0,
      tubeRadius: 0.19,
      flattenZ: 0.32,
      color: 0xffffff,
      rotation: [0, 0, 0], // XY plane
    },
    {
      // Ring R (bottom-left in image)
      wobbles: [
        { amp: 0.18, freq: 4, phaseOffset: 0.5, zAmp: 0.10 },
        { amp: 0.08, freq: 7, phaseOffset: 2.0, zAmp: 0.04 },
      ],
      phase: 2.1,
      tubeRadius: 0.19,
      flattenZ: 0.32,
      color: 0xf5f0eb,
      rotation: [Math.PI / 2, 0, 0], // XZ plane
    },
    {
      // Ring S (bottom-right in image)
      wobbles: [
        { amp: 0.20, freq: 3, phaseOffset: 1.0, zAmp: 0.12 },
        { amp: 0.12, freq: 6, phaseOffset: 3.5, zAmp: 0.06 },
      ],
      phase: 4.2,
      tubeRadius: 0.19,
      flattenZ: 0.32,
      color: 0xebf0f5,
      rotation: [0, Math.PI / 2, 0], // YZ plane
    },
    {
      // The fourth ring – thinner than the others
      wobbles: [
        { amp: 0.15, freq: 5, phaseOffset: 0.8, zAmp: 0.06 },
        { amp: 0.07, freq: 8, phaseOffset: 2.5, zAmp: 0.03 },
      ],
      phase: 1.0,
      tubeRadius: 0.10,
      flattenZ: 0.32,
      color: 0xf0ebe5,
      rotation: [Math.PI / 4, Math.PI / 4, 0], // diagonal plane
    },
  ];

  const rings = [];
  const ringsGroup = new THREE.Group();

  ringDefs.forEach((def) => {
    const curve = new WavyRingCurve(R, def.wobbles, def.phase);
    const geom = new THREE.TubeGeometry(curve, 256, def.tubeRadius, 20, true);
    const mesh = new THREE.Mesh(geom, makeMaterial(def.color));

    // Flatten the tube into a ribbon by squashing the local Z axis
    mesh.scale.z = def.flattenZ;

    // Wrap in a group so orientation applies after flattening
    const wrapper = new THREE.Group();
    wrapper.add(mesh);
    wrapper.rotation.set(def.rotation[0], def.rotation[1], def.rotation[2]);

    rings.push({ wrapper, mesh });
    ringsGroup.add(wrapper);
  });

  scene.add(ringsGroup);

  // ─── Animation Loop ─────────────────────────────────────
  const clock = new THREE.Clock();

  let animationId;
  let targetOpacity = 1;
  let currentOpacity = 1;

  function animate() {
    animationId = requestAnimationFrame(animate);
    const t = clock.getElapsedTime();

    // Per-ring spin (each ring rotates in its own plane)
    rings[0].mesh.rotation.z = t * 0.18;
    rings[1].mesh.rotation.z = t * 0.14;
    rings[2].mesh.rotation.z = t * 0.22;
    rings[3].mesh.rotation.z = t * 0.10;

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
