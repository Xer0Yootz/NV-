// NV Player Rig — walk controls for the Gigas Garden build.
// Carried into the shipping WebGL build Nov 23, 2026.
//
// Control scheme (User's standing direction): Second Life mobile-style —
// virtual joystick to move + touch-drag to look. Desktop: WASD/arrows +
// mouse drag to look.
// JUMP is a HARD REQUIREMENT (User's, Nov 23, 2026, live call): "We need a
// jump. We need to be able to jump at the very least — if we can't fly we
// need to be able to jump." Space key + on-screen JUMP button.
// Flying is NOT included. Wall collision is NOT modelled yet — the rig
// resolves ground height only (groundY callback per level).
import * as THREE from 'three';

const EYE = 1.7;
const SPEED = 5.2;       // m/s walk
const GRAVITY = -12.5;   // m/s^2
const JUMP_V = 5.4;      // m/s — clears ~1.15 m

export function createPlayerRig({ camera, dom, groundY, start, yaw = 0 }) {
  const pos = new THREE.Vector3(start[0], start[1], start[2]);
  let pitch = 0;
  let vy = 0;
  let grounded = true;
  let enabled = false;
  const keys = new Set();
  const joy = { x: 0, y: 0, id: null };
  let lookId = null, lookLX = 0, lookLY = 0;

  // --- On-screen controls (built once, shown only in walk mode) ---
  const ui = document.createElement('div');
  ui.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:40;display:none;';
  ui.innerHTML =
    '<div id="nv-stick" style="position:absolute;left:26px;bottom:26px;width:118px;height:118px;border-radius:50%;border:1.5px solid rgba(190,240,255,.45);background:rgba(10,16,26,.28);pointer-events:auto;touch-action:none;">' +
    '<div id="nv-knob" style="position:absolute;left:50%;top:50%;width:52px;height:52px;margin:-26px 0 0 -26px;border-radius:50%;background:rgba(190,240,255,.30);border:1.5px solid rgba(190,240,255,.6);"></div></div>' +
    '<button id="nv-jump" type="button" style="position:absolute;right:30px;bottom:44px;width:76px;height:76px;border-radius:50%;border:1.5px solid rgba(190,240,255,.55);background:rgba(10,16,26,.32);color:#dff6ff;font:600 13px system-ui;letter-spacing:1px;pointer-events:auto;touch-action:none;">JUMP</button>';
  document.body.appendChild(ui);
  const stick = ui.querySelector('#nv-stick');
  const knob = ui.querySelector('#nv-knob');
  const jumpBtn = ui.querySelector('#nv-jump');

  function setKnob(dx, dy) { knob.style.transform = 'translate(' + dx + 'px,' + dy + 'px)'; }

  stick.addEventListener('pointerdown', (e) => { joy.id = e.pointerId; stick.setPointerCapture(e.pointerId); moveStick(e); e.preventDefault(); });
  stick.addEventListener('pointermove', (e) => { if (e.pointerId === joy.id) moveStick(e); });
  const endStick = (e) => { if (e.pointerId === joy.id) { joy.id = null; joy.x = 0; joy.y = 0; setKnob(0, 0); } };
  stick.addEventListener('pointerup', endStick);
  stick.addEventListener('pointercancel', endStick);
  function moveStick(e) {
    const r = stick.getBoundingClientRect();
    let dx = e.clientX - (r.left + r.width / 2);
    let dy = e.clientY - (r.top + r.height / 2);
    const max = r.width / 2 - 8;
    const len = Math.hypot(dx, dy);
    if (len > max) { dx = dx / len * max; dy = dy / len * max; }
    joy.x = dx / max; joy.y = dy / max;
    setKnob(dx, dy);
  }
  jumpBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); jump(); });

  // --- Look: drag anywhere on the canvas (mouse or touch) ---
  dom.addEventListener('pointerdown', (e) => {
    if (!enabled) return;
    lookId = e.pointerId; lookLX = e.clientX; lookLY = e.clientY;
  });
  dom.addEventListener('pointermove', (e) => {
    if (!enabled || e.pointerId !== lookId) return;
    yaw -= (e.clientX - lookLX) * 0.0052;
    pitch -= (e.clientY - lookLY) * 0.0052;
    pitch = Math.max(-1.25, Math.min(1.25, pitch));
    lookLX = e.clientX; lookLY = e.clientY;
  });
  const endLook = (e) => { if (e.pointerId === lookId) lookId = null; };
  dom.addEventListener('pointerup', endLook);
  dom.addEventListener('pointercancel', endLook);

  // --- Keys ---
  window.addEventListener('keydown', (e) => {
    if (!enabled) return;
    keys.add(e.code);
    if (e.code === 'Space') { jump(); e.preventDefault(); }
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));

  function jump() {
    if (enabled && grounded) { vy = JUMP_V; grounded = false; }
  }

  function setEnabled(on) {
    enabled = on;
    ui.style.display = on ? 'block' : 'none';
    if (!on) { keys.clear(); joy.x = 0; joy.y = 0; }
  }

  const fwd = new THREE.Vector3();
  const right = new THREE.Vector3();
  function update(dt) {
    if (!enabled) return;
    dt = Math.min(dt, 0.05);
    let ix = joy.x, iz = joy.y; // joystick: up on stick = forward = -y
    if (keys.has('KeyW') || keys.has('ArrowUp')) iz -= 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) iz += 1;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) ix -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) ix += 1;
    const len = Math.hypot(ix, iz);
    if (len > 1) { ix /= len; iz /= len; }
    fwd.set(-Math.sin(yaw), 0, -Math.cos(yaw));
    right.set(Math.cos(yaw), 0, -Math.sin(yaw));
    pos.addScaledVector(fwd, -iz * SPEED * dt);
    pos.addScaledVector(right, ix * SPEED * dt);
    vy += GRAVITY * dt;
    pos.y += vy * dt;
    const g = groundY(pos);
    if (pos.y <= g) { pos.y = g; vy = 0; grounded = true; }
    else grounded = false;
    camera.position.set(pos.x, pos.y + EYE, pos.z);
    camera.rotation.order = 'YXZ';
    camera.rotation.set(pitch, yaw, 0);
  }

  return {
    update, jump, setEnabled,
    get enabled() { return enabled; },
    get state() { return { pos: pos.toArray(), vy, grounded, enabled, yaw }; },
    pos,
  };
}
