import * as THREE from 'three';

// ---------- constants & helpers ----------
const TAU = Math.PI * 2;
const CAM_Z = 11;
const FOV = 50;
const TAN_HALF = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
const MAX_VISUAL = 20;
const BUILDING_ORDER = ['cursor', 'baker', 'fryer', 'shop', 'factory', 'mine', 'portal', 'planet'];
const PALETTE = [0xff6fb5, 0xffd93d, 0x5fc8ff, 0x7dff8a, 0xff8a3d, 0xb36bff, 0xff4d6d, 0x40e0d0, 0xffffff];
const BUILDING_LOOK = {
  cursor: { geo: 'sphere', color: 0xffcfa8 },
  baker: { geo: 'cone', color: 0xf4f4f4 },
  fryer: { geo: 'cylinder', color: 0x3a3a4f },
  shop: { geo: 'box', color: 0x42c8ff },
  factory: { geo: 'box', color: 0xb8b8c8 },
  mine: { geo: 'octa', color: 0x9b5cff },
  portal: { geo: 'portal', color: 0x00f0c8 },
  planet: { geo: 'sphere', color: 0xffa640, ring: true },
};

const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const pick = (arr) => arr[(Math.random() * arr.length) | 0];
const easeOutCubic = (p) => 1 - Math.pow(1 - p, 3);
const easeOutBack = (p) => {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2);
};
const spring = (s, k, c, dt) => {
  s.v += (-k * s.x - c * s.v) * dt;
  s.x += s.v * dt;
};
const WHITE = new THREE.Color(0xffffff);
const tmpColor = new THREE.Color();
const _v = new THREE.Vector3(); // scratch
const UP = new THREE.Vector3(0, 1, 0);

// ---------- donut model (shared by center, golden, background floaters and pooled minis) ----------
const DONUT_TUBE = 0.43; // tube radius relative to ring radius 1: smallish hole
const DONUT_FLAT = 0.85; // vertical squash of a real fried ring
const GLAZE_LIFT = 0.03; // glaze sits this far above the dough
const SPRINKLE_COLORS = [0xff3b3b, 0xffe03b, 0x3b8bff, 0x3bdc5a, 0xffffff, 0xff8a2b];
const C_GOLD = new THREE.Color(0xc8823a);
const C_DARK = new THREE.Color(0x6b3b17);
const C_CREAM = new THREE.Color(0xf2d3a0);
const C_PINK = new THREE.Color(0xff7eb6);
const smooth = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
// cheap noise from integer-frequency sines: periodic around the ring and the tube, so no seams
const donutNoise = (u, v) =>
  0.5 * Math.sin(3 * u + 2 * v + 1.1) + 0.3 * Math.sin(5 * u - 3 * v + 0.4) + 0.2 * Math.sin(9 * u + 7 * v + 2.7);
// glaze edge: max angle from the top face before glaze stops. Wavy, with drips down the outer rim
const glazeLimit = (u, v) => {
  const drip = Math.pow(Math.max(0, Math.sin(7 * u + 0.5)), 6);
  return 1.6 + 0.2 * donutNoise(u, v) + 0.95 * drip * Math.sqrt(Math.max(0, Math.cos(v)));
};
const glazeMat = (color, emissive, emissiveIntensity) => new THREE.MeshPhysicalMaterial({
  color, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.1, sheen: 0.3, sheenRoughness: 0.5, emissive, emissiveIntensity,
});
const _dp = new THREE.Vector3(), _dn = new THREE.Vector3();
const _t1 = new THREE.Vector3(), _t2 = new THREE.Vector3(), _ax = new THREE.Vector3(), _ay = new THREE.Vector3(), _ref = new THREE.Vector3();
const _dc = new THREE.Color();

// point (and optionally normal) on the noisy, flattened ring at ring angle u and tube angle v.
// lift pushes the surface outward along the normal
function donutPoint(u, v, lift, p, n = null) {
  const cu = Math.cos(u), su = Math.sin(u), cv = Math.cos(v), sv = Math.sin(v);
  const tr = DONUT_TUBE + 0.03 * donutNoise(u, v) + lift;
  const rad = 1 + tr * cv;
  p.set(rad * cu, rad * su * DONUT_FLAT, tr * sv);
  if (n) n.set(cv * cu, (cv * su) / DONUT_FLAT, sv).normalize();
  return p;
}

// torus grid with wrapped indices (no seam). keepQuad(a, b, c, d) trims quads (used for the glaze)
function gridGeometry(tubSeg, radSeg, lift, keepQuad = null) {
  const pos = new Array(tubSeg * radSeg * 3);
  for (let i = 0; i < tubSeg; i++) {
    for (let j = 0; j < radSeg; j++) {
      donutPoint((i / tubSeg) * TAU, (j / radSeg) * TAU, lift, _dp);
      const k = (i * radSeg + j) * 3;
      pos[k] = _dp.x; pos[k + 1] = _dp.y; pos[k + 2] = _dp.z;
    }
  }
  const idx = [];
  for (let i = 0; i < tubSeg; i++) {
    const i1 = (i + 1) % tubSeg;
    for (let j = 0; j < radSeg; j++) {
      const j1 = (j + 1) % radSeg;
      const a = i * radSeg + j, b = i1 * radSeg + j, c = i1 * radSeg + j1, d = i * radSeg + j1;
      if (keepQuad && !keepQuad(a, b, c, d)) continue;
      idx.push(a, b, c, a, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// golden-brown dough, darker toward the outer rim, pale cream fry line around the outer equator
function paintDough(geo, tubSeg, radSeg) {
  const col = new Float32Array(tubSeg * radSeg * 3);
  for (let i = 0; i < tubSeg; i++) {
    for (let j = 0; j < radSeg; j++) {
      const u = (i / tubSeg) * TAU, v = (j / radSeg) * TAU;
      const sv = Math.abs(Math.sin(v)), cv = Math.cos(v);
      _dc.copy(C_GOLD).lerp(C_DARK, Math.max(0, cv) ** 2 * 0.6);
      _dc.lerp(C_CREAM, smooth(0.55, 0.9, cv) * (1 - smooth(0.2, 0.5, sv)) * 0.85);
      _dc.multiplyScalar(0.94 + 0.06 * donutNoise(u, v));
      const k = (i * radSeg + j) * 3;
      col[k] = _dc.r; col[k + 1] = _dc.g; col[k + 2] = _dc.b;
    }
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
}

// detail 'high': dough + glaze meshes and 120 sprinkle transforms/colors (center, golden, floaters)
// detail 'low': one baked mini geometry with vertex colors (dough, pink glaze cap, sprinkle dots)
function makeDonutParts(detail = 'high') {
  if (detail === 'low') {
    const tubSeg = 24, radSeg = 12;
    const g = gridGeometry(tubSeg, radSeg, 0);
    paintDough(g, tubSeg, radSeg);
    const col = g.attributes.color.array;
    for (let i = 0; i < tubSeg; i++) {
      for (let j = 0; j < radSeg; j++) {
        const u = (i / tubSeg) * TAU, v = (j / radSeg) * TAU;
        const e = glazeLimit(u, v) - Math.acos(Math.sin(v));
        const w = smooth(-0.15, 0.25, e);
        if (w <= 0) continue;
        const k = (i * radSeg + j) * 3;
        _dc.setRGB(col[k], col[k + 1], col[k + 2]).lerp(C_PINK, w);
        col[k] = _dc.r; col[k + 1] = _dc.g; col[k + 2] = _dc.b;
      }
    }
    for (let placed = 0, tries = 0; placed < 6 && tries < 200; tries++) {
      const i = (Math.random() * tubSeg) | 0, j = (Math.random() * radSeg) | 0;
      const u = (i / tubSeg) * TAU, v = (j / radSeg) * TAU;
      if (Math.acos(Math.sin(v)) > glazeLimit(u, v) - 0.4) continue; // only on the glaze
      _dc.set(pick(SPRINKLE_COLORS));
      const k = (i * radSeg + j) * 3;
      col[k] = _dc.r; col[k + 1] = _dc.g; col[k + 2] = _dc.b;
      placed++;
    }
    return { mini: g.scale(0.2, 0.2, 0.2) };
  }

  const tubSeg = 128, radSeg = 64;
  const dough = gridGeometry(tubSeg, radSeg, 0);
  paintDough(dough, tubSeg, radSeg);

  // glaze: same torus lifted a bit, keeping only quads that are above the wavy limit
  const edge = new Float32Array(tubSeg * radSeg);
  for (let i = 0; i < tubSeg; i++) {
    for (let j = 0; j < radSeg; j++) {
      const u = (i / tubSeg) * TAU, v = (j / radSeg) * TAU;
      edge[i * radSeg + j] = Math.acos(Math.sin(v)) - glazeLimit(u, v);
    }
  }
  const glaze = gridGeometry(tubSeg, radSeg, GLAZE_LIFT, (a, b, c, d) => edge[a] + edge[b] + edge[c] + edge[d] < 0);

  // sprinkles lying flat on the glaze (random top spots, random spin around the normal)
  const mats = [], cols = [];
  for (let s = 0; s < 120; s++) {
    const sv = rand(0.25, 1); // sin(v) > 0.25 keeps every spot well inside the glaze
    const v = Math.random() < 0.5 ? Math.asin(sv) : Math.PI - Math.asin(sv);
    donutPoint(rand(0, TAU), v, GLAZE_LIFT + 0.015, _dp, _dn);
    _ref.set(Math.abs(_dn.z) < 0.9 ? 0 : 1, 0, Math.abs(_dn.z) < 0.9 ? 1 : 0);
    _t1.crossVectors(_dn, _ref).normalize();
    _t2.crossVectors(_dn, _t1);
    const a = rand(0, TAU);
    _ay.copy(_t1).multiplyScalar(Math.cos(a)).addScaledVector(_t2, Math.sin(a)); // capsule axis, tangent
    _ax.crossVectors(_ay, _dn);
    const m = new THREE.Matrix4().makeBasis(_ax, _ay, _dn);
    m.setPosition(_dp);
    mats.push(m);
    cols.push(new THREE.Color(pick(SPRINKLE_COLORS)));
  }
  return { dough, glaze, sprinkles: { mats, cols } };
}

// ---------- pooled instanced particles (one draw call per pool) ----------
class Pool {
  constructor(scene, geometry, count, material = null, soft = false) {
    this.n = count;
    this.soft = soft; // soft: instance tint is mostly washed toward white (donut pools)
    this.mesh = new THREE.InstancedMesh(
      geometry,
      material ?? new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.45, emissive: 0x222222 }),
      count
    );
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.parts = [];
    this.dummy = new THREE.Object3D();
    this.dummy.scale.setScalar(0);
    this.dummy.updateMatrix();
    for (let i = 0; i < count; i++) {
      this.parts.push({
        a: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0,
        rx: 0, ry: 0, rz: 0, sx: 0, sy: 0, sz: 0,
        life: 0, max: 1, size: 1, grav: 0, drag: 0, grow: 0,
      });
      this.mesh.setMatrixAt(i, this.dummy.matrix);
      this.mesh.setColorAt(i, WHITE);
    }
    this.next = 0;
    this.dirty = false;
    scene.add(this.mesh);
  }

  spawn(x, y, z, vx, vy, vz, o = {}) {
    let idx = -1;
    for (let k = 0; k < this.n; k++) {
      const j = (this.next + k) % this.n;
      if (!this.parts[j].a) { idx = j; break; }
    }
    if (idx < 0) idx = this.next; // pool full: recycle oldest
    this.next = (idx + 1) % this.n;
    const p = this.parts[idx];
    p.a = true;
    p.x = x; p.y = y; p.z = z;
    p.vx = vx; p.vy = vy; p.vz = vz;
    p.rx = rand(0, TAU); p.ry = rand(0, TAU); p.rz = rand(0, TAU);
    const sp = o.spin ?? 6;
    p.sx = rand(-sp, sp); p.sy = rand(-sp, sp); p.sz = rand(-sp, sp);
    p.max = p.life = o.life ?? 1.2;
    p.size = o.size ?? 1;
    p.grav = o.grav ?? 6;
    p.drag = o.drag ?? 0.8;
    p.grow = o.grow ?? 0; // size growth over life (smoke puffs)
    const tint = tmpColor.set(o.color ?? pick(PALETTE));
    this.mesh.setColorAt(idx, this.soft ? tint.lerp(WHITE, 0.55) : tint);
    this.dirty = true;
  }

  update(dt) {
    const d = this.dummy;
    let active = false;
    for (let i = 0; i < this.n; i++) {
      const p = this.parts[i];
      if (!p.a) continue;
      active = true;
      p.life -= dt;
      if (p.life <= 0) {
        p.a = false;
        d.scale.setScalar(0);
      } else {
        p.vy -= p.grav * dt;
        const f = Math.max(0, 1 - p.drag * dt);
        p.vx *= f; p.vy *= f; p.vz *= f;
        p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
        p.rx += p.sx * dt; p.ry += p.sy * dt; p.rz += p.sz * dt;
        const k = Math.min(1, p.life / (p.max * 0.35));
        d.position.set(p.x, p.y, p.z);
        d.rotation.set(p.rx, p.ry, p.rz);
        d.scale.setScalar(p.size * k * (1 + p.grow * (1 - p.life / p.max)));
      }
      d.updateMatrix();
      this.mesh.setMatrixAt(i, d.matrix);
    }
    if (active || this.dirty) {
      this.mesh.instanceMatrix.needsUpdate = true;
      if (this.dirty) this.mesh.instanceColor.needsUpdate = true;
      this.dirty = false;
    }
  }
}

// ---------- scene ----------
export class DonutScene {
  constructor(containerEl) {
    this.container = containerEl;
    if (getComputedStyle(containerEl).position === 'static') containerEl.style.position = 'relative';

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    const canvas = this.renderer.domElement;
    Object.assign(canvas.style, {
      position: 'absolute', top: '0', left: '0', width: '100%', height: '100%',
      display: 'block', touchAction: 'none',
    });
    containerEl.prepend(canvas);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 100);
    this.camera.position.set(0, 0, CAM_Z);
    this.ray = new THREE.Raycaster();

    // shared geometries
    const donut = makeDonutParts('high');
    this.geo = {
      dough: donut.dough,
      glaze: donut.glaze,
      donutSprinkles: donut.sprinkles,
      donutSprinkle: new THREE.CapsuleGeometry(0.025, 0.12, 3, 6),
      sprinkle: new THREE.CapsuleGeometry(0.035, 0.11, 3, 6),
      mini: makeDonutParts('low').mini,
      confetti: new THREE.BoxGeometry(0.11, 0.11, 0.02),
      sphere: new THREE.SphereGeometry(0.16, 12, 10),
      cone: new THREE.ConeGeometry(0.16, 0.3, 10),
      cylinder: new THREE.CylinderGeometry(0.16, 0.16, 0.07, 14),
      box: new THREE.BoxGeometry(0.22, 0.22, 0.22),
      octa: new THREE.OctahedronGeometry(0.17),
      portal: new THREE.TorusGeometry(0.12, 0.05, 8, 14),
      ring: new THREE.TorusGeometry(0.3, 0.02, 6, 32),
      upgradeRing: new THREE.TorusGeometry(1, 0.05, 8, 64),
      glow: new THREE.SphereGeometry(2.1, 16, 12),
      hit: new THREE.SphereGeometry(1.5, 16, 12),
      sky: new THREE.SphereGeometry(40, 24, 16),
      fingerBody: new THREE.CylinderGeometry(0.05, 0.05, 0.34, 8),
      fingerTip: new THREE.ConeGeometry(0.06, 0.14, 8),
    };

    // shared materials
    this.mat = {
      dough: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.72 }),
      glaze: glazeMat(0xff7eb6, 0x5a0f2e, 0.25),
      glazes: PALETTE.map((c) => glazeMat(c, 0x000000, 0)), // background donuts
      mini: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5 }),
      gold: new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 0.7, roughness: 0.25, emissive: 0xff9a00, emissiveIntensity: 0.5 }),
      glow: new THREE.MeshBasicMaterial({ color: 0xffe066, transparent: true, opacity: 0.16, depthWrite: false }),
      hit: new THREE.MeshBasicMaterial({ visible: false }),
      ring: new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x444444, roughness: 0.3 }),
      finger: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 }),
      palette: PALETTE.map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.4 })),
    };
    this.buildingMats = new Map();

    // lights
    // warm sky / brown ground bounce, weak ambient, warm key and cool soft fill
    this.hemi = new THREE.HemisphereLight(0xfff1dc, 0x5a3a22, 0.9);
    this.ambient = new THREE.AmbientLight(0xffffff, 0.2);
    this.scene.add(this.hemi, this.ambient);
    const key = new THREE.DirectionalLight(0xffe2b8, 2.0);
    key.position.set(3, 5, 6);
    const fill = new THREE.DirectionalLight(0xcfe0ff, 0.45);
    fill.position.set(-5, -2, 4);
    this.scene.add(key, fill);

    // small studio environment (a few emissive panels) so the glaze has reflections
    const envScene = new THREE.Scene();
    envScene.background = new THREE.Color(0x14101c);
    const panel = (w, h, color, pos) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }));
      m.position.copy(pos);
      m.lookAt(0, 0, 0);
      envScene.add(m);
    };
    panel(6, 6, new THREE.Color(4, 3.6, 3.2), new THREE.Vector3(0, 6, 2));
    panel(5, 8, new THREE.Color(2.4, 0.8, 1.8), new THREE.Vector3(-7, 0, 3));
    panel(5, 8, new THREE.Color(0.9, 1.8, 2.6), new THREE.Vector3(7, 0, 3));
    panel(8, 3, new THREE.Color(1.2, 1.1, 1.0), new THREE.Vector3(0, -5, 4));
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(envScene, 0.04).texture;
    pmrem.dispose();
    envScene.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
    this.lightA = new THREE.PointLight(0xff77cc, 60, 0, 2);
    this.lightB = new THREE.PointLight(0x77ccff, 60, 0, 2);
    this.scene.add(this.lightA, this.lightB);

    // sky gradient sphere
    this.skyU = {
      uTop: { value: new THREE.Color(0x6a4cff) },
      uBottom: { value: new THREE.Color(0xff8fd0) },
      uFlash: { value: 0 },
      uFlashColor: { value: new THREE.Color(1, 1, 1) },
    };
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: this.skyU,
      vertexShader: `varying vec3 vDir;
        void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `uniform vec3 uTop; uniform vec3 uBottom; uniform float uFlash; uniform vec3 uFlashColor; varying vec3 vDir;
        void main(){ float h = smoothstep(-0.6, 0.9, vDir.y); vec3 c = mix(uBottom, uTop, h); c = mix(c, uFlashColor, uFlash * 0.6); gl_FragColor = vec4(c, 1.0); }`,
    });
    this.sky = new THREE.Mesh(this.geo.sky, skyMat);
    this.sky.renderOrder = -1;
    this.scene.add(this.sky);

    // center donut: holder (hop/tilt/wobble) > donut (squash/breathe/spin)
    this.holder = new THREE.Group();
    this.donut = new THREE.Group();
    this.holder.add(this.donut);
    this.scene.add(this.holder);
    this.donut.add(new THREE.Mesh(this.geo.dough, this.mat.dough));
    this.glazeMesh = new THREE.Mesh(this.geo.glaze, this.mat.glaze);
    this.donut.add(this.glazeMesh);
    // sprinkles: one instanced draw, each lying flat on the glaze with its own color
    const sp = this.geo.donutSprinkles;
    this.sprinkleInst = new THREE.InstancedMesh(this.geo.donutSprinkle, new THREE.MeshStandardMaterial({ roughness: 0.35 }), sp.mats.length);
    sp.mats.forEach((m, i) => {
      this.sprinkleInst.setMatrixAt(i, m);
      this.sprinkleInst.setColorAt(i, sp.cols[i]);
    });
    this.sprinkleInst.frustumCulled = false;
    this.donut.add(this.sprinkleInst);

    // invisible click proxy (raycast target), slightly bigger than donut
    this.hit = new THREE.Mesh(this.geo.hit, this.mat.hit);
    this.scene.add(this.hit);

    // building rings orbiting the donut
    this.rings = new Map();
    BUILDING_ORDER.forEach((id, i) => {
      const holder = new THREE.Group();
      holder.rotation.set(0.3 + i * 0.08, 0, i * 0.37);
      const spin = new THREE.Group();
      holder.add(spin);
      this.scene.add(holder);
      this.rings.set(id, {
        id, i, holder, spin,
        radius: 1.9 + i * 0.3,
        speed: (i % 2 ? 1 : -1) * (0.9 + i * 0.12),
        count: 0,
        items: [],
      });
    });

    // background floaters
    this.floaters = Array.from({ length: 12 }, (_, i) => {
      const m = new THREE.Group(); // background donut: shared dough, palette-colored glaze
      m.add(new THREE.Mesh(this.geo.dough, this.mat.dough), new THREE.Mesh(this.geo.glaze, this.mat.glazes[i % this.mat.glazes.length]));
      m.scale.setScalar(0.42);
      this.scene.add(m);
      return { m, nx: rand(-0.95, 0.95), ny: rand(-0.9, 0.9), z: rand(-8, -3), ph: rand(0, TAU), sp: rand(1, 3) };
    });

    // particle pools
    this.rain = new Pool(this.scene, this.geo.mini, 150, this.mat.mini, true);
    this.minis = new Pool(this.scene, this.geo.mini, 400, this.mat.mini, true);
    this.sprinkles = new Pool(this.scene, this.geo.sprinkle, 400);
    this.confetti = new Pool(this.scene, this.geo.confetti, 900);
    this.bubbles = new Pool(this.scene, this.geo.sphere, 140); // fryer oil
    this.smoke = new Pool(this.scene, this.geo.sphere, 120); // fryer / factory steam

    // building fx: pooled meshes (busy flag = in use)
    this.fxAcc = Object.fromEntries(BUILDING_ORDER.map((id) => [id, 0]));
    this.fingers = Array.from({ length: 10 }, () => {
      const g = new THREE.Group();
      const body = new THREE.Mesh(this.geo.fingerBody, this.mat.finger);
      body.position.y = 0.17;
      const tip = new THREE.Mesh(this.geo.fingerTip, this.mat.finger);
      tip.position.y = 0.41;
      g.add(body, tip);
      g.visible = false;
      this.scene.add(g);
      return { g, d: new THREE.Vector3(), busy: false };
    });
    this.neons = Array.from({ length: 14 }, (_, i) => {
      const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
      const m = new THREE.Mesh(i % 2 ? this.geo.box : this.geo.upgradeRing, mat);
      m.visible = false;
      this.scene.add(m);
      return { m, mat, busy: false };
    });
    this.meteors = Array.from({ length: 4 }, () => {
      const m = new THREE.Mesh(this.geo.sphere, new THREE.MeshBasicMaterial({ color: 0xffa040 }));
      m.scale.setScalar(0.45);
      m.visible = false;
      this.scene.add(m);
      return { m, busy: false };
    });
    // portal vortex behind the donut
    this.vortex = new THREE.Group();
    this.vortex.position.set(0, 0, -5);
    this.vortex.visible = false;
    const vortexA = new THREE.Mesh(this.geo.upgradeRing, new THREE.MeshBasicMaterial({ color: 0x00f0c8, transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending }));
    vortexA.scale.setScalar(2.4);
    this.vortexB = new THREE.Mesh(this.geo.upgradeRing, new THREE.MeshBasicMaterial({ color: 0xb36bff, transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.vortexB.scale.setScalar(1.5);
    this.vortexB.rotation.x = 1.1;
    this.vortex.add(vortexA, this.vortexB);
    this.scene.add(this.vortex);

    // state
    this.time = 0;
    this.last = null;
    this.pop = { x: 0, v: 0 };
    this.bounce = { x: 0, v: 0 };
    this.tiltX = { x: 0, v: 0 };
    this.tiltY = { x: 0, v: 0 };
    this.spinAng = 0;
    this.spinVel = 0;
    this.shake = 0;
    this.flash = 0;
    this.zoomPulse = 0;
    this.boomLight = 0;
    this.boomTimer = 0.3;
    this.emitAcc = 0;
    this.intensity = 0;
    this.rainRate = 0;
    this.rainAcc = 0;
    this.tweens = [];
    this.clickCbs = [];
    this.golden = null;
    this.chaos = 0; // smoothed escalation level (see setChaos)
    this.chaosTarget = 0;
    this.hopT = 0;
    this.hueT = 0;
    this.strobeT = 0;
    this.portalAmt = 0;

    // input (pointerdown covers mouse + touch)
    this.onPointerDown = (e) => {
      if (this.golden && this.hitTest(this.golden.group, e)) return; // golden donut takes priority
      if (!this.hitTest(this.hit, e)) return;
      for (const cb of this.clickCbs) cb(e.clientX, e.clientY);
    };
    containerEl.addEventListener('pointerdown', this.onPointerDown);

    // sizing
    this.resize = this.resize.bind(this);
    if (typeof ResizeObserver !== 'undefined') new ResizeObserver(this.resize).observe(containerEl);
    window.addEventListener('resize', this.resize);
    this.resize();

    // render loop
    const frame = (now) => {
      requestAnimationFrame(frame);
      const t = now / 1000;
      const dt = this.last === null ? 0 : Math.min(0.05, t - this.last);
      this.last = t;
      this.update(dt);
      this.renderer.render(this.scene, this.camera);
    };
    requestAnimationFrame(frame);
  }

  // ----- public API -----

  onDonutClick(cb) {
    this.clickCbs.push(cb);
  }

  // escalation level from buildings (~0 at start, ~1 mid game, 3+ late). Smoothed in update().
  setChaos(level) {
    const v = Number(level);
    this.chaosTarget = Number.isFinite(v) ? clamp(v, 0, 6) : 0;
  }

  clickFx(clientX, clientY) {
    const n = this.ndc(clientX, clientY);
    // hop, squash, tilt toward the click
    this.pop.v += 18;
    this.bounce.v += 6;
    this.tiltX.v += -n.y * 4;
    this.tiltY.v += n.x * 4;
    this.spinVel += 6;
    this.addShake(0.6);
    this.zoomPulse += 1.2;
    this.flash = Math.max(this.flash, 0.9);
    this.skyU.uFlashColor.value.setHSL(Math.random(), 1, 0.7);
    this.boomLight = Math.max(this.boomLight, 1);
    this.shockwave(0, 0, 0.2, pick(PALETTE), 0.7, 6);
    // huge radial explosion from the donut
    this.burst(this.confetti, 0, 0, 0.3, 160, 10, { life: 2.4, grav: 6, drag: 1.1, size: 1.3, spin: 12 });
    this.burst(this.minis, 0, 0, 0.3, 70, 9, { life: 1.8, grav: 7, drag: 0.7, size: 1.3, spin: 10 });
    this.burst(this.sprinkles, 0, 0, 0.3, 70, 8, { life: 1.4, grav: 9, drag: 0.6, size: 1.2, spin: 12 });
  }

  setBuildingCount(id, count) {
    const ring = this.rings.get(id);
    if (!ring) return;
    const n = clamp(Math.floor(count || 0), 0, MAX_VISUAL);
    if (n === ring.count) return;
    for (const o of ring.items) ring.spin.remove(o);
    ring.items = [];
    for (let k = 0; k < n; k++) {
      const o = this.makeBuildingObj(id);
      const a = (k / n) * TAU;
      o.position.set(Math.cos(a) * ring.radius, 0, Math.sin(a) * ring.radius);
      o.userData.a = a;
      ring.spin.add(o);
      ring.items.push(o);
    }
    ring.count = n;
  }

  buyFx(id) {
    this.addShake(0.35);
    this.burst(this.confetti, 0, 0, 0, 120, 9, { life: 2.2, grav: 7, drag: 1.3, size: 1.2, spin: 10 });
    const ring = this.rings.get(id);
    if (!ring) return;
    const hh = this.halfH(0), hw = hh * this.camera.aspect;
    const o = this.makeBuildingObj(id);
    this.scene.add(o);
    const side = Math.random() < 0.5 ? -1 : 1;
    const start = new THREE.Vector3(side * (hw + 1.5), rand(-hh, hh) * 0.6, rand(-1, 1));
    const a = rand(0, TAU);
    const end = new THREE.Vector3(Math.cos(a) * ring.radius, 0, Math.sin(a) * ring.radius);
    this.tween(1.2, (p) => {
      const e = easeOutBack(p);
      o.position.lerpVectors(start, end, e);
      o.position.y += Math.sin(p * Math.PI) * 2.2;
      o.rotation.set(p * TAU * 2, p * TAU * 3, 0);
      o.scale.setScalar(1.8 - 0.8 * p);
    }, () => {
      this.scene.remove(o);
      this.burst(this.confetti, end.x, end.y, end.z, 30, 4, { life: 1.2, grav: 4, size: 1 });
    });
  }

  upgradeFx() {
    this.flash = Math.max(this.flash, 0.7);
    this.skyU.uFlashColor.value.setHSL(Math.random(), 1, 0.7);
    this.shockwave(0, 0, -0.5, 0xffffff, 1.0, 10);
    this.burst(this.minis, 0, 0, 0, 30, 6, { life: 1.6, grav: 4, size: 1.2 });
  }

  milestoneFx() {
    this.spinVel = 4 * Math.PI * 2.5; // integrates to exactly 720 degrees with decay 2.5
    this.pop.v += 14;
    this.flash = 1;
    this.skyU.uFlashColor.value.set(pick(PALETTE));
    this.addShake(0.6);
    for (let i = 0; i < 8; i++) {
      this.later(i * 0.22, () => {
        const hh = this.halfH(1), hw = hh * this.camera.aspect;
        this.burst(this.confetti, rand(-hw * 0.7, hw * 0.7), rand(-hh * 0.6, hh * 0.6), rand(0, 2),
          120, 7, { life: 2, grav: 3, drag: 0.9, size: 1.1, spin: 9 });
        this.addShake(0.1);
      });
    }
  }

  setDps(dps) {
    const k = clamp(Math.log10((dps || 0) + 1) / 5, 0, 1);
    this.intensity = k;
    this.rainRate = k * 14;
  }

  spawnGolden(onClick) {
    if (this.golden) this.endGolden(this.golden);
    const group = new THREE.Group();
    group.add(new THREE.Mesh(this.geo.dough, this.mat.gold));
    group.add(new THREE.Mesh(this.geo.glaze, this.mat.gold));
    group.add(new THREE.Mesh(this.geo.glow, this.mat.glow));
    group.scale.setScalar(0.75);
    this.scene.add(group);
    const hh = this.halfH(1.5), hw = hh * this.camera.aspect;
    const dir = Math.random() < 0.5 ? 1 : -1;
    const g = {
      group, t: 0, spark: 0, onClick, container: this.container,
      x0: -dir * (hw + 1.5), x1: dir * (hw + 1.5), y0: rand(-hh * 0.5, hh * 0.5),
      listener: null,
    };
    g.listener = (e) => {
      if (this.golden !== g || !this.hitTest(g.group, e)) return;
      this.endGolden(g);
      this.burst(this.confetti, group.position.x, group.position.y, 1.5, 150, 9, { life: 1.8, grav: 5, size: 1.2, color: 0xffd45a });
      this.burst(this.minis, group.position.x, group.position.y, 1.5, 60, 7, { life: 1.4, grav: 6, size: 1.3, color: 0xffd700 });
      this.addShake(0.5);
      this.flash = Math.max(this.flash, 0.8);
      onClick(e.clientX, e.clientY);
    };
    this.container.addEventListener('pointerdown', g.listener);
    this.golden = g;
  }

  // ----- internals -----

  endGolden(g) {
    if (this.golden === g) this.golden = null;
    g.container.removeEventListener('pointerdown', g.listener);
    this.tween(0.4, (p) => g.group.scale.setScalar(0.75 * (1 - p)), () => this.scene.remove(g.group));
  }

  // random big explosion somewhere in the scene (idle chaos)
  // s scales particle counts, ring size and shake (chaos makes explosions bigger)
  explode(s = 1) {
    const z = rand(-6, 2);
    const hh = this.halfH(z) * 0.9, hw = hh * this.camera.aspect;
    const x = rand(-hw, hw), y = rand(-hh, hh);
    const col = pick(PALETTE);
    this.burst(this.confetti, x, y, z, Math.round(50 * s), 6, { life: 1.6, grav: 4, size: 1.1, color: col, spin: 10 });
    this.burst(this.minis, x, y, z, Math.round(20 * s), 5, { life: 1.3, grav: 5, size: 1.1, spin: 8 });
    this.shockwave(x, y, z, col, 0.6, rand(2, 4) * s);
    this.flash = Math.max(this.flash, 0.3);
    this.boomLight = Math.max(this.boomLight, 0.6);
    this.addShake(0.08 * s);
  }

  // ----- building effects (each continuous; rate scales with log2(1 + count)) -----

  fxSlot(list) {
    for (const s of list) if (!s.busy) { s.busy = true; return s; }
    return null;
  }

  // returns how many events of this building fire this frame (capped at 6)
  fxEvents(id, dt, rate) {
    const cnt = this.rings.get(id).count;
    if (!cnt) { this.fxAcc[id] = 0; return 0; }
    let a = this.fxAcc[id] + dt * rate * Math.log2(1 + cnt);
    let n = 0;
    while (a >= 1 && n < 6) { a -= 1; n++; }
    this.fxAcc[id] = Math.min(a, 1);
    return n;
  }

  updateBuildingFx(dt, c) {
    const m = 1 + 0.3 * c;
    const portalN = this.rings.get('portal').count;
    this.portalAmt += (Math.min(1, portalN / 4) - this.portalAmt) * Math.min(1, dt * 2);
    this.vortex.visible = portalN > 0;
    this.vortex.rotation.z += dt * (1 + 2 * this.portalAmt);
    this.vortexB.rotation.y += dt * (1.5 + 2 * this.portalAmt);
    this.vortex.scale.setScalar(1 + 0.15 * Math.sin(this.time * 2));

    for (let k = this.fxEvents('cursor', dt, 2 * m); k > 0; k--) this.fxPoke();
    for (let k = this.fxEvents('baker', dt, 1.5 * m); k > 0; k--) this.fxThrow();
    for (let k = this.fxEvents('fryer', dt, 2 * m); k > 0; k--) this.fxBubble();
    for (let k = this.fxEvents('shop', dt, 1.5 * m); k > 0; k--) this.fxNeon();
    for (let k = this.fxEvents('factory', dt, 4 * m); k > 0; k--) this.fxConveyor();
    for (let k = this.fxEvents('mine', dt, 0.8 * m); k > 0; k--) this.fxGeyser();
    for (let k = this.fxEvents('portal', dt, 1.5 * m); k > 0; k--) this.fxSpit();
    for (let k = this.fxEvents('planet', dt, 0.35 * m); k > 0; k--) this.fxMeteor();
  }

  // cursor: white fingers poke the donut from a random direction, squish + sprinkle puff
  fxPoke() {
    const s = this.fxSlot(this.fingers);
    if (!s) return;
    const d = s.d.set(rand(-1, 1), rand(-1, 1), rand(-0.5, 0.5)).normalize();
    s.g.quaternion.setFromUnitVectors(UP, _v.copy(d).negate()); // tip points at the donut
    s.g.visible = true;
    let hit = false;
    this.tween(0.45, (p) => {
      const k = p < 0.35 ? easeOutCubic(p / 0.35) : p < 0.6 ? 1 : 1 - easeOutCubic((p - 0.6) / 0.4);
      s.g.position.copy(d).multiplyScalar(1.7 + 1.8 * (1 - k));
      if (!hit && p >= 0.35) {
        hit = true;
        this.pop.v += 4;
        this.burst(this.sprinkles, d.x * 1.2, d.y * 1.2, d.z * 1.2, 6, 4, { life: 0.9, grav: 4, drag: 0.5, size: 0.9, spin: 8 });
      }
    }, () => { s.g.visible = false; s.busy = false; });
  }

  // baker: mini donuts thrown in arcs from the orbit toward the camera
  fxThrow() {
    const items = this.rings.get('baker').items;
    if (!items.length) return;
    pick(items).getWorldPosition(_v);
    this.minis.spawn(_v.x, _v.y, _v.z, rand(-1.5, 1.5), rand(3, 6), rand(2.5, 4.5),
      { life: 1.8, grav: 7, drag: 0.1, spin: 10, size: rand(1, 1.4) });
  }

  // fryer: oil bubbles rise from the bottom, grey smoke puffs grow and fade
  fxBubble() {
    const z = rand(-3, 0.5), hh = this.halfH(z), hw = hh * this.camera.aspect;
    for (let i = 0; i < 2; i++) {
      this.bubbles.spawn(rand(-hw, hw), -hh, z, rand(-0.3, 0.3), rand(1.5, 3), 0,
        { life: rand(1.6, 2.6), grav: -0.6, drag: 0.1, size: rand(0.5, 1.1), color: pick([0xffb347, 0xffd27a, 0xff9f1c]), spin: 0 });
    }
    this.smoke.spawn(rand(-hw, hw) * 0.8, -hh * 0.9, z, rand(-0.2, 0.2), rand(0.5, 1), 0,
      { life: 3, grav: -0.2, drag: 0.4, size: rand(1.2, 2), grow: 2, color: 0x8a8a96, spin: 0.5 });
  }

  // shop: neon rings and boxes blink around the scene
  fxNeon() {
    const s = this.fxSlot(this.neons);
    if (!s) return;
    const hh = this.halfH(-4), hw = hh * this.camera.aspect;
    s.m.position.set(rand(-hw, hw) * 0.9, rand(-hh, hh) * 0.9, rand(-6, -2));
    s.m.scale.setScalar(rand(0.8, 1.6));
    s.m.rotation.set(rand(0, TAU), rand(0, TAU), rand(0, TAU));
    s.mat.color.set(pick(PALETTE));
    s.m.visible = true;
    this.tween(0.7, (p) => {
      s.mat.opacity = (Math.sin(p * Math.PI * 6) > 0 ? 1 : 0.1) * (1 - p);
    }, () => { s.m.visible = false; s.busy = false; });
  }

  // factory: a conveyor of mini donuts crosses the screen, steam puffs rise
  fxConveyor() {
    const hh = this.halfH(-2), hw = hh * this.camera.aspect;
    const y = -hh * 0.55 + rand(-0.1, 0.1);
    const z = rand(-2, -0.5);
    this.minis.spawn(-hw - 1, y, z, rand(4, 6), 0, 0,
      { life: (2 * hw + 2) / 4, grav: 0, drag: 0, spin: 4, size: rand(0.7, 1) });
    if (Math.random() < 0.3) {
      this.smoke.spawn(rand(-hw, hw), -hh * 0.2, z, rand(-0.2, 0.2), rand(0.8, 1.4), 0,
        { life: 2.2, grav: -0.3, drag: 0.6, size: rand(0.8, 1.2), grow: 2.5, color: 0xf2f6ff, spin: 1 });
    }
  }

  // mine: pink / chocolate glaze geysers erupt from below
  fxGeyser() {
    const z = rand(-3, 0.5), hh = this.halfH(z), hw = hh * this.camera.aspect;
    const x = rand(-hw * 0.9, hw * 0.9);
    for (let i = 0; i < 10; i++) {
      this.confetti.spawn(x + rand(-0.2, 0.2), -hh, z, rand(-1.5, 1.5), rand(6, 10), rand(-0.5, 0.5),
        { life: rand(1.2, 1.8), grav: 9, drag: 0.1, size: rand(0.8, 1.3), color: Math.random() < 0.6 ? 0xff5fa2 : 0x5a2d14, spin: 8 });
    }
  }

  // portal: the vortex spits random objects toward the camera
  fxSpit() {
    const a = rand(0, TAU), dx = Math.cos(a), dy = Math.sin(a);
    const pool = Math.random() < 0.5 ? this.minis : this.confetti;
    for (let i = 0; i < 3; i++) {
      const v = rand(3, 6);
      pool.spawn(dx * 2.2, dy * 2.2, -5, dx * v, dy * v, rand(4, 7),
        { life: 1.8, grav: 3, drag: 0.3, size: rand(0.8, 1.3), spin: 10, color: pick(PALETTE) });
    }
  }

  // planet: a glowing meteor streaks in with a spark trail and crashes into a big explosion
  fxMeteor() {
    const s = this.fxSlot(this.meteors);
    if (!s) return;
    const hh = this.halfH(-2), hw = hh * this.camera.aspect;
    const tx = rand(-hw, hw) * 0.6, ty = rand(-hh, hh) * 0.6, tz = rand(-3, 0);
    const sx = tx + rand(-3, 3), sy = hh + 3, sz = tz - rand(2, 5);
    s.m.visible = true;
    this.tween(rand(0.9, 1.3), (p) => {
      const e = p * p;
      const x = sx + (tx - sx) * e, y = sy + (ty - sy) * e, z = sz + (tz - sz) * e;
      s.m.position.set(x, y, z);
      if (p < 0.97) {
        this.sprinkles.spawn(x, y, z, rand(-0.3, 0.3), rand(-0.3, 0.3), 0,
          { life: 0.6, grav: 0, drag: 2, size: 0.7, spin: 2, color: 0xffc070 });
      }
    }, () => {
      s.m.visible = false;
      s.busy = false;
      this.burst(this.confetti, tx, ty, tz, 150, 9, { life: 2, grav: 4, size: 1.3, spin: 10 });
      this.burst(this.minis, tx, ty, tz, 60, 7, { life: 1.6, grav: 5, size: 1.3 });
      this.shockwave(tx, ty, tz, 0xffa040, 0.9, 7);
      this.addShake(0.7);
      this.flash = Math.max(this.flash, 0.6);
      this.boomLight = Math.max(this.boomLight, 1);
    });
  }

  // expanding colored ring
  shockwave(x, y, z, color, dur, maxScale) {
    const mat = new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: 1, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    const ring = new THREE.Mesh(this.geo.upgradeRing, mat);
    ring.position.set(x, y, z);
    this.scene.add(ring);
    this.tween(dur, (p) => {
      ring.scale.setScalar(0.5 + easeOutCubic(p) * maxScale);
      mat.opacity = 1 - p;
    }, () => {
      this.scene.remove(ring);
      mat.dispose();
    });
  }

  makeBuildingObj(id) {
    const look = BUILDING_LOOK[id];
    let mat = this.buildingMats.get(id);
    if (!mat) {
      mat = new THREE.MeshStandardMaterial({ color: look.color, roughness: 0.4, emissive: look.color, emissiveIntensity: 0.25 });
      this.buildingMats.set(id, mat);
    }
    const mesh = new THREE.Mesh(this.geo[look.geo], mat);
    if (!look.ring) return mesh;
    const g = new THREE.Group();
    g.add(mesh);
    const ring = new THREE.Mesh(this.geo.ring, this.mat.ring);
    ring.rotation.x = Math.PI / 2.5;
    g.add(ring);
    return g;
  }

  burst(pool, x, y, z, n, speed, opts = {}) {
    for (let i = 0; i < n; i++) {
      const u = rand(-1, 1), th = rand(0, TAU), s = Math.sqrt(1 - u * u), v = speed * rand(0.35, 1);
      pool.spawn(x, y, z, s * Math.cos(th) * v, u * v, s * Math.sin(th) * v, opts);
    }
  }

  tween(dur, step, done) {
    this.tweens.push({ t: 0, dur, step, done });
  }

  later(sec, fn) {
    this.tween(sec, () => {}, fn);
  }

  addShake(a) {
    this.shake = Math.min(1.2, this.shake + a);
  }

  halfH(z) {
    return (CAM_Z - z) * TAN_HALF;
  }

  ndc(clientX, clientY) {
    const r = this.renderer.domElement.getBoundingClientRect();
    const v = new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    v.x = Number.isFinite(v.x) ? v.x : 0;
    v.y = Number.isFinite(v.y) ? v.y : 0;
    return v;
  }

  hitTest(obj, e) {
    this.ray.setFromCamera(this.ndc(e.clientX, e.clientY), this.camera);
    return this.ray.intersectObject(obj, true).length > 0;
  }

  resize() {
    const el = this.container;
    const w = el.clientWidth || window.innerWidth;
    const h = el.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  update(dt) {
    const t = (this.time += dt);

    // chaos: smoothed toward the setChaos target so escalation ramps
    this.chaos += (this.chaosTarget - this.chaos) * Math.min(1, dt * 0.8);
    const c = this.chaos;

    // springs
    spring(this.pop, 160, 8, dt);
    spring(this.bounce, 110, 7, dt);
    spring(this.tiltX, 40, 5, dt);
    spring(this.tiltY, 40, 5, dt);

    // center donut: constant hopping, spinning, glaze color cycling
    this.spinVel *= Math.exp(-2.5 * dt);
    this.spinAng += (1.2 + this.spinVel) * dt * (1 + 0.6 * c);
    this.hopT += dt * (5.5 + 2 * c);
    const hop = Math.abs(Math.sin(this.hopT));
    this.holder.position.y = this.bounce.x * 0.6 + hop * 0.9 * (1 + 0.35 * c);
    this.holder.rotation.set(
      this.tiltX.x + Math.sin(t * 1.3) * 0.2,
      this.spinAng + this.tiltY.x + Math.sin(t * 0.9) * 0.5,
      Math.sin(t * 2.1) * 0.15
    );
    const sp = this.pop.x;
    const breathe = 1 + Math.sin(t * 3) * 0.03 + hop * 0.04;
    this.donut.scale.set(breathe * (1 + 0.15 * sp), breathe * (1 - 0.22 * sp - 0.08 * (1 - hop)), breathe);
    this.donut.rotation.z += dt * 1.5;
    this.glazeMesh.material.color.setHSL((t * 0.25) % 1, 1, 0.6);
    this.glazeMesh.material.emissive.setHSL((t * 0.25) % 1, 1, 0.25);

    // orbiting buildings: hop and spin
    for (const r of this.rings.values()) {
      r.spin.rotation.y += r.speed * dt * (1 + this.intensity * 2 + 0.5 * c);
      for (const o of r.items) {
        o.rotation.y += dt * 2.2;
        o.rotation.x += dt * 4;
        o.rotation.z += dt * 3;
        o.position.y = Math.abs(Math.sin(t * 5 + o.userData.a)) * 0.5;
      }
    }

    // floaters
    for (const f of this.floaters) {
      const hh = this.halfH(f.z), hw = hh * this.camera.aspect;
      f.m.position.set(f.nx * hw, f.ny * hh + Math.abs(Math.sin(t * 2 + f.ph)) * 0.8, f.z);
      f.m.rotation.x += dt * f.sp;
      f.m.rotation.y += dt * f.sp * 0.7;
    }

    // idle explosions: ~1/s at chaos 0 up to ~10/s, and bigger as chaos grows
    const boomRate = clamp(1 + 3 * c, 1, 10);
    const boomSize = clamp(1 + 0.5 * c, 1, 2.5);
    this.boomTimer -= dt;
    for (let n = 0; this.boomTimer <= 0 && n < 4; n++) {
      this.explode(boomSize);
      this.boomTimer += rand(0.7, 1.3) / boomRate;
    }
    if (this.boomTimer < -1) this.boomTimer = 0;

    // continuous emission: sprinkles off the donut (rate rises with chaos), mini donuts across the screen
    this.emitAcc += dt;
    const emitStep = 1 / clamp(40 * (1 + 1.5 * c), 40, 120);
    for (let guard = 0; this.emitAcc >= emitStep && guard < 8; guard++) {
      this.emitAcc -= emitStep;
      const a = rand(0, TAU);
      const cx = Math.cos(a), sy = Math.sin(a), v = rand(2, 4);
      this.sprinkles.spawn(cx * 1.1, sy * 1.1, rand(-0.2, 0.4), cx * v, sy * v, rand(0.5, 2),
        { life: rand(0.8, 1.4), grav: 8, drag: 0.5, spin: 10, size: rand(0.8, 1.2) });
      if (Math.random() < 0.3) {
        const z = rand(-4, 1), hh = this.halfH(z), hw = hh * this.camera.aspect;
        this.minis.spawn(rand(-hw, hw), -hh, z, rand(-1, 1), rand(2, 5), 0,
          { life: 2.5, grav: 1, drag: 0.2, spin: 8, size: rand(0.8, 1.3) });
      }
    }

    this.updateBuildingFx(dt, c);

    // rain of donuts (rate follows dps, log scale)
    this.rainAcc += this.rainRate * dt;
    while (this.rainAcc >= 1) {
      this.rainAcc -= 1;
      const z = rand(-6, -1);
      const hh = this.halfH(z) + 0.5, hw = this.halfH(z) * this.camera.aspect;
      const speed = rand(1.2, 2.4);
      this.rain.spawn(rand(-hw * 1.1, hw * 1.1), hh, z, rand(-0.3, 0.3), -speed, 0,
        { life: (2 * hh) / speed, grav: 0, drag: 0, spin: 3, size: rand(0.7, 1.3) });
    }

    // golden donut
    const g = this.golden;
    if (g) {
      g.t += dt;
      const p = Math.min(1, g.t / 10);
      const x = g.x0 + (g.x1 - g.x0) * p;
      const y = g.y0 + Math.sin(p * TAU * 1.2) * 1.2;
      g.group.position.set(x, y, 1.5);
      g.group.rotation.x += dt * 2;
      g.group.rotation.y += dt * 3;
      g.group.rotation.z += dt;
      g.spark += dt;
      while (g.spark > 0.02) {
        g.spark -= 0.02;
        this.confetti.spawn(x + rand(-0.5, 0.5), y + rand(-0.5, 0.5), 1.5, rand(-0.6, 0.6), rand(0.4, 1.2), 0,
          { color: 0xffd45a, life: 0.6, size: 0.8, grav: 1.5, drag: 1.5 });
      }
      if (g.t >= 10) this.endGolden(g);
    }

    // background: fast color cycling, strobe flashes, lights
    this.flash *= Math.exp(-dt * 3);
    this.strobeT = (this.strobeT + dt * (14 + 10 * c)) % TAU;
    const strobe = Math.pow(Math.max(0, Math.sin(this.strobeT)), 8);
    this.boomLight *= Math.exp(-dt * 4);
    this.skyU.uFlash.value = Math.max(this.flash, strobe * 0.35);
    this.hueT = (this.hueT + dt * (0.12 + 0.2 * c)) % 1;
    const hue = (this.hueT + this.intensity * 0.1) % 1;
    this.skyU.uTop.value.setHSL(hue, 0.85, 0.5);
    this.skyU.uBottom.value.setHSL((hue + 0.45) % 1, 1, 0.68);
    this.lightA.color.setHSL((t * 0.4) % 1, 1, 0.6);
    this.lightB.color.setHSL((t * 0.4 + 0.5) % 1, 1, 0.6);
    this.lightA.intensity = 60 + 300 * strobe + 200 * this.boomLight;
    this.lightB.intensity = 60 + 300 * Math.pow(Math.max(0, Math.sin(this.strobeT + Math.PI)), 8) + 200 * this.boomLight;
    this.ambient.intensity = 0.2 + 0.5 * strobe;
    this.lightA.position.set(-4 + Math.sin(t) * 2, 2.5 + Math.cos(t * 0.7) * 1.5, 5);
    this.lightB.position.set(4 + Math.cos(t * 0.8) * 2, -2.5 + Math.sin(t * 0.6) * 1.5, 4);

    // particles
    this.rain.update(dt);
    this.minis.update(dt);
    this.sprinkles.update(dt);
    this.confetti.update(dt);
    this.bubbles.update(dt);
    this.smoke.update(dt);

    // tweens (snapshot so callbacks may add new ones)
    const list = this.tweens;
    this.tweens = [];
    const keep = [];
    for (const tw of list) {
      tw.t += dt;
      const p = Math.min(1, tw.t / tw.dur);
      tw.step(p);
      if (p >= 1) { if (tw.done) tw.done(); } else keep.push(tw);
    }
    this.tweens = keep.concat(this.tweens);

    // camera: shake, zoom pulses, roll wobble
    this.shake *= Math.exp(-dt * 4);
    this.zoomPulse *= Math.exp(-dt * 3);
    const amp = 1 + 0.25 * c; // chaos scales shake / wobble / zoom pulse amplitude
    const sh = this.shake * amp;
    const zoom = CAM_Z + Math.sin(t * 1.3) * 0.8 * amp - this.zoomPulse * amp + Math.abs(Math.sin(t * 2.5)) * 0.3;
    this.camera.position.set(
      Math.sin(t * 41) * sh + Math.sin(t * 2.3) * 0.3 * amp,
      Math.cos(t * 37) * sh + Math.cos(t * 1.9) * 0.25 * amp,
      zoom
    );
    const portalRoll = this.portalAmt * Math.sin(t * 0.4) * 0.35; // portal: scene gently rolls
    this.camera.up.set(Math.sin(t * 1.9) * 0.15 * amp + portalRoll + Math.sin(t * 23) * sh * 0.02, 1, 0).normalize();
    this.camera.lookAt(0, 0, 0);
  }
}
