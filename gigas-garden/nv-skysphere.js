// ===========================================================================
// NEON VIGIL — NV SKYSPHERE (reusable module)
// Level 2 Gigas Garden sky: gradient dome + moving striped pink sun +
// drifting cloud layer. Plain JS, no new dependencies (takes THREE).
//
// Canon locks (Nov 10, 2026, Jasmine's word):
// - Sky gradient is PINK TO PURPLE across the sky. Cyan is for the WATER
//   ONLY — cyan sits at the base of the gradient for the water, nowhere
//   else in the sky. This module contains NO cyan anywhere: gradient,
//   sun, and clouds are pink / purple / white only.
//   Nov 10 update (Jasmine's word): zenith deepened to a darker purple
//   (#160a3a) and blue brought up in the upper gradient (mid #a04a8a) —
//   indigo/violet blue, NOT cyan. Horizon pink #ff6b9d unchanged.
// - The sun MOVES: it rises and sets across the sky, driving the light
//   from dawn through dusk. Behaviour follows the NVSun.js contract
//   (Oct 27, 2026, ChatGPT HEX OS): the striped sun is MOVED only —
//   appearance not redesigned — and one directional light + hemisphere
//   levels are driven by the sun's elevation. The full real-date/GPS
//   solar-position + moon/eclipse wiring (NVSun/NVMoon/NVSkyEvents) is
//   a follow-up: that code text lives in the ChatGPT chat, not in this
//   repo, and the moon's appearance is still open for her ruling — so
//   this module moves the sun on a game-time arc and drives the light,
//   and adds NO moon.
// - The sun itself is the striped pink vaporwave sun (kept Nov 1,
//   2026): large pale-pink with horizontal stripes. Nov 12, 2026
//   (User's order): it is a 3D SPHERE now, not a flat disc — same
//   colours and stripes, equirect texture, slow axial spin. Its
//   IDENTITY is still open (presumed "big weird pink thing") — this
//   module does not rename or re-identify it, and adds no lore text
//   about it.
// - Size: the dome radius is TEN TIMES the world extent, from ONE named
//   constant. World extent here = the Level 2 Garden, far ruins ~2 mi
//   out (WORLD_RADIUS = 2 mi in metres). Change WORLD_RADIUS and the
//   whole sky (dome, sun distance/size, clouds, camera far) rescales.
// ===========================================================================

export const WORLD_RADIUS = 3218.688; // metres — ~2 mi, the far-ruins extent (Level 2 default)
export const SKY_RADIUS = WORLD_RADIUS * 10; // 32,186.88 m — dome radius, 10x world
export const CAMERA_FAR = SKY_RADIUS * 2; // camera far plane must exceed the dome

// Defaults below are the Level 2 values. createSkysphere() takes
// worldRadius / sunDistance / azimuthOffset options so the same module
// ports to a smaller world (main game, Nov 11, 2026): the dome is
// ALWAYS 10x the world, the sun keeps its ~0.1 rad angular size, and
// the azimuth offset turns midday toward the world's sun side.
// Level 2: SUN_DISTANCE 700 m — just beyond the far-ruin plates (380 m).
// The DOME is 10x the world; the SUN is placed for the composition, not
// on the dome: at ~700 m its parallax matches the plates, so the disc
// sits low in the gap between them from the orbit AND ground cameras,
// the way the old shell's sun did. (At dome distance the sun would sit
// at true north and fall out of the orbit camera's frame.)
// Sun angular size is preserved from the old shell: disc radius 70 m at
// ~706 m distance -> atan(70/706) ~= 0.1 rad (~5.7 deg radius).
const SUN_ANGULAR_RADIUS = 0.1;
const DEFAULT_SUN_DISTANCE = 700;
const DAY_LENGTH_S = 600; // one full dawn -> dusk sweep = 10 minutes
const MIN_ELEV_DEG = 2; // sun skims the horizon at rise/set
const MAX_ELEV_DEG = 8; // sun at midday: low in the north, in the plates' gap
// (kept low so the disc stays in frame from the orbit and ground cameras,
// the way the old shell's low sun did — the plates span ~0-28 deg up)

// Gradient stops — pink to purple only, no cyan anywhere in the sky.
// Nov 10, 2026 (Jasmine's word): zenith deepened to a darker purple and
// blue brought up in the upper gradient (indigo/violet blue — NOT cyan;
// cyan stays water-only). Horizon pink unchanged.
const C_HORIZON = 0xff6b9d;
const C_MID = 0xa04a8a;
const C_ZENITH = 0x160a3a;

// Sun texture — Nov 12, 2026 (User's order): the sun is a 3D SPHERE now,
// so the texture is equirectangular (2:1) instead of the old flat disc.
// Same look as the old shell, same colours: pale pink #ffd7e8 with darker
// pink #ff5e8a horizontal stripes at the same heights. Soft pink mottling
// is added across the surface so the sphere's slow axial rotation reads —
// the stripes alone are symmetric around the pole axis and would not
// show the spin. The flat CircleGeometry disc this used to feed is gone.
function makeSunTexture(THREE) {
  const W = 1024;
  const H = 512;
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#ffd7e8';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#ff5e8a';
  const stripeYs = [90, 140, 190, 240, 290, 340, 390];
  for (const y of stripeYs) {
    ctx.fillRect(0, y - 9, W, 18);
  }
  // Deterministic soft mottling (stable run to run) — makes the axial
  // rotation visible and gives the sphere surface variation.
  const tints = ['#ffc2da', '#ffe9f3', '#ff9ec4', '#ffb9d2'];
  let seed = 5150;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  for (let i = 0; i < 70; i++) {
    const x = rnd() * W;
    const y = rnd() * H;
    const r = 30 + rnd() * 110;
    const tint = tints[Math.floor(rnd() * tints.length)];
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, tint + '59');
    g.addColorStop(1, tint + '00');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(x, y, r * (1.4 + rnd()), r * (0.5 + rnd() * 0.3), 0, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping; // seamless around the sphere's equator
  return tex;
}

// Cloud texture — soft neon-tinged puffs, PINK / PURPLE / WHITE only.
// No cyan: cyan is water-only in this sky.
function makeCloudTexture(THREE) {
  const W = 2048;
  const H = 1024;
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const ctx = cv.getContext('2d');
  ctx.clearRect(0, 0, W, H);
  const tints = ['#ffd7e8', '#ff9ec4', '#e8a0c8', '#ffffff', '#c98aa8'];
  // Deterministic pseudo-random blobs so the layer is stable run to run.
  let seed = 5150;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  for (let i = 0; i < 90; i++) {
    const x = rnd() * W;
    const y = 170 + rnd() * 460; // mid-sky band (v ~ 0.45-0.85 on the sphere)
    const r = 40 + rnd() * 150;
    const tint = tints[Math.floor(rnd() * tints.length)];
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, tint + 'cc');
    g.addColorStop(0.55, tint + '55');
    g.addColorStop(1, tint + '00');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(x, y, r * (1.6 + rnd()), r * (0.35 + rnd() * 0.25), 0, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  return tex;
}

function gradientShaderMaterial(THREE) {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      cHorizon: { value: new THREE.Color(C_HORIZON) },
      cMid: { value: new THREE.Color(C_MID) },
      cZenith: { value: new THREE.Color(C_ZENITH) },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vDir;
      uniform vec3 cHorizon;
      uniform vec3 cMid;
      uniform vec3 cZenith;
      void main() {
        float h = clamp(vDir.y, -0.05, 1.0);
        vec3 c;
        if (h < 0.25) c = mix(cHorizon, cMid, h / 0.25);
        else c = mix(cMid, cZenith, (h - 0.25) / 0.75);
        gl_FragColor = vec4(c, 1.0);
      }
    `,
  });
}

// Sun direction for a time of day t in [0, 1]: 0 = dawn (east), 0.5 =
// midday (north, low, between the far-ruin plates), 1 = dusk (west).
// Elevation rises from MIN to MAX and back, so the sun climbs out of the
// horizon, crosses the north low, and sinks again.
// azimuthOffset rotates the whole arc: the main game passes -PI so its
// midday sun sits toward +Z (the garden / striped-sun plate side),
// matching its existing sunBack light at (0, 9, 95).
const DEG = Math.PI / 180;
function sunDirection(t, out, azimuthOffset = 0) {
  const az = Math.PI * t + azimuthOffset; // 0 -> +X (east), PI/2 -> -Z (north), PI -> -X (west)
  const el =
    MIN_ELEV_DEG * DEG +
    (MAX_ELEV_DEG - MIN_ELEV_DEG) * DEG * Math.sin(Math.PI * t);
  out.set(
    Math.cos(az) * Math.cos(el),
    Math.sin(el),
    -Math.sin(az) * Math.cos(el),
  );
  return out;
}

export function createSkysphere(THREE, options = {}) {
  const {
    timeOfDay = 0.5, // default: midday — sun low in the north, in the gap
    timeScale = 1, // 1 = real time; 0 = frozen sun
    dayLengthS = DAY_LENGTH_S,
    sunLight = null, // THREE.DirectionalLight — driven by the sun (optional)
    hemiLight = null, // THREE.HemisphereLight — driven by the sun (optional)
    worldRadius = WORLD_RADIUS, // world extent; dome is always 10x this
    sunDistance = DEFAULT_SUN_DISTANCE, // sun placement for the composition
    azimuthOffset = 0, // rotates the sun arc (main game: -PI, midday toward +Z)
  } = options;

  // Per-instance scale, derived from the world — same ratios as Level 2.
  const skyRadius = worldRadius * 10;
  const cameraFar = skyRadius * 2;
  const sunRadius = sunDistance * Math.tan(SUN_ANGULAR_RADIUS);
  const sunGlowRadius = sunRadius * (120 / 70); // old glow/disc ratio kept
  const cloudRadius = skyRadius * 0.94; // clouds sit inside the dome, inside the sun

  const group = new THREE.Group();
  group.name = 'nvSkysphere';

  // --- Gradient dome: inverted sphere, pink horizon -> deep purple zenith.
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(skyRadius, 48, 24),
    gradientShaderMaterial(THREE),
  );
  dome.name = 'skyDome';
  dome.renderOrder = -10;
  group.add(dome);

  // --- Striped pink sun disc + glow. One named group, swaps out cleanly
  // if she means something else by the "big weird pink thing".
  const sunGroup = new THREE.Group();
  sunGroup.name = 'pinkSun';
  const sunGlow = new THREE.Mesh(
    new THREE.CircleGeometry(sunGlowRadius, 48),
    new THREE.MeshBasicMaterial({
      color: 0xff8fb8,
      transparent: true,
      opacity: 0.22,
      fog: false,
      depthWrite: false,
    }),
  );
  // Glow sits just behind the sphere's centre plane so the ring reads
  // around the ball instead of slicing through it.
  sunGlow.position.z = -sunRadius * 0.25;
  sunGroup.add(sunGlow);
  // 3D sun (Nov 12, 2026, User's order): a SphereGeometry ball with the
  // striped texture, NOT the old flat circle. MeshBasicMaterial — the sun
  // is the light source, it does not get shaded by it. It keeps the same
  // rise/set path (applySun) and spins slowly on its axis in update().
  const sunDisc = new THREE.Mesh(
    new THREE.SphereGeometry(sunRadius, 48, 32),
    new THREE.MeshBasicMaterial({
      map: makeSunTexture(THREE),
      fog: false,
    }),
  );
  sunDisc.name = 'pinkSunSphere';
  sunGroup.add(sunDisc);
  group.add(sunGroup);

  // --- Drifting cloud layer: soft pink/purple/white puffs on a sphere
  // just inside the dome. No cyan.
  const clouds = new THREE.Mesh(
    new THREE.SphereGeometry(cloudRadius, 48, 24),
    new THREE.MeshBasicMaterial({
      map: makeCloudTexture(THREE),
      transparent: true,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      opacity: 0.5,
    }),
  );
  clouds.name = 'cloudLayer';
  clouds.renderOrder = -9;
  group.add(clouds);

  // --- Light driving (NVSun.js contract): key light follows the sun's
  // direction; its colour and strength, and the hemisphere level, follow
  // the sun's elevation — pale and strong at midday, deep pink and low
  // at dawn/dusk.
  const cDawn = new THREE.Color(0xff7fa8);
  const cNoon = new THREE.Color(0xffc9da);
  const tmpColor = new THREE.Color();
  const dir = new THREE.Vector3();

  let t = THREE.MathUtils.clamp(timeOfDay, 0, 1);

  function applySun() {
    sunDirection(t, dir, azimuthOffset);
    sunGroup.position.copy(dir).multiplyScalar(sunDistance);
    sunGroup.lookAt(0, 0, 0); // sun group faces the world, from wherever it is
    // Sky sync (Nov 12, 2026, User's): the gradient dome tilts smoothly
    // with the sun's arc so the sky appears to set with the sun. The
    // spec formula rotation.z = sunAngle - PI/2 is applied SCALED
    // (x 0.12, max ~10.8 deg): at full strength the horizon would lay
    // on its side at dawn/dusk, since this sun's elevation spans only
    // 2-8 deg. The tilt here is relative to each world's own arc
    // (azimuthOffset removed), so Level 2 and the main game match.
    dome.rotation.z = (Math.PI * t - Math.PI / 2) * 0.12;
    const dayF = Math.sin(Math.PI * t); // 0 at rise/set, 1 at midday
    if (sunLight) {
      sunLight.position.copy(dir).multiplyScalar(1000);
      sunLight.color.copy(tmpColor.copy(cDawn).lerp(cNoon, dayF));
      sunLight.intensity = 1.0 + 0.8 * dayF;
    }
    if (hemiLight) {
      hemiLight.intensity = 0.65 + 0.35 * dayF;
    }
  }
  applySun();

  function setTimeOfDay(v) {
    t = THREE.MathUtils.clamp(v, 0, 1);
    applySun();
  }

  function sunPosition(out = new THREE.Vector3()) {
    return out.copy(sunGroup.position);
  }

  let meshCount = 0;
  group.traverse((o) => {
    if (o.isMesh) meshCount++;
  });

  return {
    group,
    dome,
    sunGroup,
    sunDisc,
    sunGlow,
    clouds,
    meshCount,
    WORLD_RADIUS: worldRadius,
    SKY_RADIUS: skyRadius,
    CAMERA_FAR: cameraFar,
    SUN_RADIUS: sunRadius,
    SUN_DISTANCE: sunDistance,
    dayLengthS,
    getTimeOfDay: () => t,
    setTimeOfDay,
    sunPosition,
    // Advance the day, spin the sun, and drift the clouds. dt in seconds.
    update(dt) {
      if (timeScale !== 0) {
        t = (t + (dt * timeScale) / dayLengthS) % 1;
        applySun();
      }
      sunDisc.rotation.y += 0.001; // slow axial spin (Nov 12, 2026, User's spec)
      clouds.rotation.y += dt * 0.004; // slow drift (~26 min per turn)
    },
  };
}
