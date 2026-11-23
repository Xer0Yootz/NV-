// NV Weather — GPU particle weather for the Gigas Garden exterior.
//
// PORTED Nov 23, 2026 from the AI Studio prototype's src/scene/weather.ts
// (WebGPU/TSL bench pass, User's direction: "the sky needs to be more
// particles") into the shipping WebGL build — same design, same numbers,
// re-implemented as a ShaderMaterial so it runs in three 0.160 WebGL.
// Do not restart this work from scratch; the prototype is the source.
//
// Two point systems live in a volume that follows the camera, so the
// weather feels endless: rain (fast, wind-slanted streaks) and snow
// (slow, swaying flakes). Particles wrap inside the volume in the
// vertex shader — the CPU never touches them.
//
// Modes: 'rain' (DEFAULT, locked) | 'snow' | 'off'. Keys 1 / 2 / 0
// switch, or window.__weather('rain'|'snow'|'off'). EXTERIOR ONLY —
// the rig hides itself when the camera is inside the ship (Level 1
// passes an exterior test; Level 2 is always exterior).

import * as THREE from 'three';

const VOLUME = { width: 70, height: 34, depth: 70 };

function hash21(x, z) {
  const s = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453;
  return s - Math.floor(s);
}

function buildParticles(count, seedSalt) {
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const rx = hash21(i * 1.7 + seedSalt, seedSalt);
    const ry = hash21(seedSalt, i * 2.3 + seedSalt);
    const rz = hash21(i * 0.9 + seedSalt, i * 1.1);
    pos[i * 3] = (rx - 0.5) * VOLUME.width;
    pos[i * 3 + 1] = ry * VOLUME.height;
    pos[i * 3 + 2] = (rz - 0.5) * VOLUME.depth;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 90);
  return geo;
}

const VERT = /* glsl */ `
  uniform float uTime;
  uniform float uSpeed;
  uniform float uSlant;
  uniform float uSway;
  uniform float uSize;
  uniform float uHeight;
  varying float vHash;
  void main() {
    vec3 p = position;
    float h = fract(sin(dot(p.xz, vec2(12.9898, 78.233))) * 43758.5453);
    vHash = h;
    float fallSpeed = uSpeed * mix(0.72, 1.28, h);
    float fallen = mod(p.y - uTime * fallSpeed, uHeight);
    float progress = fallen / uHeight;
    float swayX = sin(uTime * 0.9 + h * 6.2831) * uSway;
    float driftX = progress * uSlant * uHeight;
    vec3 moved = vec3(p.x + driftX + swayX, fallen, p.z + swayX * 0.6);
    vec4 mv = modelViewMatrix * vec4(moved, 1.0);
    float sizeVar = mix(0.75, 1.3, fract(sin(dot(p.xz, vec2(26.651, 41.317))) * 24634.6345));
    gl_PointSize = uSize * sizeVar * (140.0 / -mv.z);
    gl_Position = projectionMatrix * mv;
  }
`;

const FRAG = /* glsl */ `
  uniform vec3 uTint;
  uniform float uOpacity;
  uniform float uStreak;
  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    vec2 scaled = uStreak > 0.5 ? uv * vec2(6.0, 1.1) : uv * vec2(1.6, 1.6);
    float mask = smoothstep(0.5, 0.08, length(scaled));
    gl_FragColor = vec4(uTint, mask * uOpacity);
  }
`;

function buildSystem(params, count, seedSalt) {
  const geo = buildParticles(count, seedSalt);
  const mat = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
      uSpeed: { value: params.speed },
      uSlant: { value: params.slant },
      uSway: { value: params.sway },
      uSize: { value: params.size * 10 }, // prototype point size -> WebGL pixels scale
      uHeight: { value: VOLUME.height },
      uTint: { value: new THREE.Color(params.tint) },
      uOpacity: { value: params.opacity },
      uStreak: { value: params.streak },
    },
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  points.renderOrder = 20;
  return { points, mat, geo };
}

export function createWeatherRig() {
  const group = new THREE.Group();
  group.name = 'NV_WEATHER_PARTICLES';

  const rain = buildSystem(
    { speed: 21.0, size: 0.55, opacity: 0.5, slant: 0.16, sway: 0.05, streak: 1, tint: 0xaebfd8 },
    11000,
    3.7
  );
  const snow = buildSystem(
    { speed: 1.9, size: 0.34, opacity: 0.85, slant: 0.02, sway: 0.85, streak: 0, tint: 0xf2ecff },
    6000,
    9.2
  );
  group.add(rain.points, snow.points);

  let mode = 'rain';
  let clock = 0;
  const applyMode = () => {
    rain.points.visible = mode === 'rain';
    snow.points.visible = mode === 'snow';
  };
  applyMode();

  const rig = {
    group,
    counts: { rain: 11000, snow: 6000 },
    setMode: (m) => {
      if (m !== 'rain' && m !== 'snow' && m !== 'off') return;
      mode = m;
      applyMode();
    },
    getMode: () => mode,
    update: (dt, center, exterior) => {
      clock += dt;
      rain.mat.uniforms.uTime.value = clock;
      snow.mat.uniforms.uTime.value = clock;
      group.position.set(center.x, 0, center.z);
      group.visible = exterior && mode !== 'off';
    },
    dispose: () => {
      rain.geo.dispose(); snow.geo.dispose();
      rain.mat.dispose(); snow.mat.dispose();
    },
  };

  if (typeof window !== 'undefined') {
    window.__weather = (m) => rig.setMode(m);
    window.addEventListener('keydown', (e) => {
      if (e.key === '1') rig.setMode('rain');
      else if (e.key === '2') rig.setMode('snow');
      else if (e.key === '0') rig.setMode('off');
    });
  }

  return rig;
}
