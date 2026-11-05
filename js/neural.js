// Hero: a 3D neural network with signals flowing between layers.
(function () {
  const canvas = document.getElementById("neural");
  if (!canvas) return;

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let renderer;
  try {
    if (!window.THREE) throw new Error("three missing");
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  } catch (e) {
    document.documentElement.classList.add("no-webgl");
    return;
  }

  const isMobile = window.innerWidth < 760;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x05060a, 0.045);
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
  camera.position.set(0, 0, isMobile ? 22 : 17);

  const net = new THREE.Group();
  scene.add(net);

  // Round glowing dot texture
  function dotTexture() {
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const g = c.getContext("2d");
    const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, "rgba(255,255,255,1)");
    grd.addColorStop(0.25, "rgba(255,255,255,0.8)");
    grd.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grd;
    g.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  }
  const tex = dotTexture();

  // Layers: input -> hidden -> output
  const layerSizes = isMobile ? [5, 8, 10, 8, 4] : [6, 10, 14, 10, 6, 3];
  const spacingX = 3.2;
  const cyan = new THREE.Color(0x22d3ee);
  const violet = new THREE.Color(0xa78bfa);
  const pink = new THREE.Color(0xf472b6);

  const layers = [];
  const nodePositions = [];
  const nodeColors = [];
  layerSizes.forEach((n, li) => {
    const x = (li - (layerSizes.length - 1) / 2) * spacingX;
    const t = li / (layerSizes.length - 1);
    const col = t < 0.5 ? cyan.clone().lerp(violet, t * 2) : violet.clone().lerp(pink, (t - 0.5) * 2);
    const layer = [];
    for (let i = 0; i < n; i++) {
      // nodes arranged on a ring, slightly jittered, so layers look 3D
      const a = (i / n) * Math.PI * 2;
      const r = 1.2 + n * 0.28;
      const p = new THREE.Vector3(x + (Math.random() - 0.5) * 0.5, Math.sin(a) * r * 0.8, Math.cos(a) * r * 0.6);
      layer.push(p);
      nodePositions.push(p.x, p.y, p.z);
      nodeColors.push(col.r, col.g, col.b);
    }
    layers.push(layer);
  });

  const nodeGeo = new THREE.BufferGeometry();
  nodeGeo.setAttribute("position", new THREE.Float32BufferAttribute(nodePositions, 3));
  nodeGeo.setAttribute("color", new THREE.Float32BufferAttribute(nodeColors, 3));
  const nodeMat = new THREE.PointsMaterial({ size: 0.75, map: tex, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  net.add(new THREE.Points(nodeGeo, nodeMat));

  // Edges between adjacent layers
  const edges = [];
  const linePos = [];
  for (let li = 0; li < layers.length - 1; li++) {
    layers[li].forEach((a) => {
      layers[li + 1].forEach((b) => {
        if (Math.random() < 0.55) {
          edges.push([a, b]);
          linePos.push(a.x, a.y, a.z, b.x, b.y, b.z);
        }
      });
    });
  }
  const lineGeo = new THREE.BufferGeometry();
  lineGeo.setAttribute("position", new THREE.Float32BufferAttribute(linePos, 3));
  const lineMat = new THREE.LineBasicMaterial({ color: 0x6d7cff, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false });
  net.add(new THREE.LineSegments(lineGeo, lineMat));

  // Signals travelling along edges
  const pulseCount = isMobile ? 60 : 140;
  const pulses = [];
  const pulsePos = new Float32Array(pulseCount * 3);
  const pulseCol = new Float32Array(pulseCount * 3);
  function resetPulse(p, startLayerZero) {
    let e;
    if (startLayerZero) {
      e = edges[Math.floor(Math.random() * edges.length)];
    } else {
      // continue forward from where the pulse ended
      const next = edges.filter((ed) => ed[0] === p.edge[1]);
      e = next.length ? next[Math.floor(Math.random() * next.length)] : edges[Math.floor(Math.random() * edges.length)];
    }
    p.edge = e;
    p.t = 0;
    p.speed = 0.008 + Math.random() * 0.014;
  }
  for (let i = 0; i < pulseCount; i++) {
    const p = {};
    resetPulse(p, true);
    p.t = Math.random();
    pulses.push(p);
    const c = Math.random() < 0.5 ? cyan : pink;
    pulseCol.set([c.r, c.g, c.b], i * 3);
  }
  const pulseGeo = new THREE.BufferGeometry();
  pulseGeo.setAttribute("position", new THREE.BufferAttribute(pulsePos, 3));
  pulseGeo.setAttribute("color", new THREE.BufferAttribute(pulseCol, 3));
  const pulseMat = new THREE.PointsMaterial({ size: 0.38, map: tex, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  net.add(new THREE.Points(pulseGeo, pulseMat));

  // Background dust
  const dustN = isMobile ? 250 : 600;
  const dust = new Float32Array(dustN * 3);
  for (let i = 0; i < dustN; i++) dust.set([(Math.random() - 0.5) * 60, (Math.random() - 0.5) * 40, (Math.random() - 0.5) * 40 - 10], i * 3);
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute("position", new THREE.BufferAttribute(dust, 3));
  scene.add(new THREE.Points(dustGeo, new THREE.PointsMaterial({ size: 0.12, map: tex, color: 0x94a3b8, transparent: true, opacity: 0.5, depthWrite: false })));

  // Mouse + scroll interaction
  const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
  window.addEventListener("pointermove", (e) => {
    mouse.tx = (e.clientX / window.innerWidth - 0.5) * 2;
    mouse.ty = (e.clientY / window.innerHeight - 0.5) * 2;
  });

  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    // push the network right on wide screens so text stays readable
    net.position.x = w > 900 ? 4.5 : 0;
    net.position.y = w > 900 ? 0 : -1.5;
  }
  window.addEventListener("resize", resize);
  resize();

  let visible = true;
  new IntersectionObserver((entries) => { visible = entries[0].isIntersecting; }).observe(canvas);

  const clock = new THREE.Clock();
  function frame() {
    requestAnimationFrame(frame);
    if (!visible) return;
    const t = clock.getElapsedTime();
    mouse.x += (mouse.tx - mouse.x) * 0.05;
    mouse.y += (mouse.ty - mouse.y) * 0.05;

    net.rotation.y = t * 0.08 + mouse.x * 0.5;
    net.rotation.x = Math.sin(t * 0.2) * 0.1 + mouse.y * 0.3;

    for (let i = 0; i < pulses.length; i++) {
      const p = pulses[i];
      p.t += p.speed;
      if (p.t >= 1) resetPulse(p, Math.random() < 0.15);
      const [a, b] = p.edge;
      pulsePos[i * 3] = a.x + (b.x - a.x) * p.t;
      pulsePos[i * 3 + 1] = a.y + (b.y - a.y) * p.t;
      pulsePos[i * 3 + 2] = a.z + (b.z - a.z) * p.t;
    }
    pulseGeo.attributes.position.needsUpdate = true;
    nodeMat.size = 0.75 + Math.sin(t * 2) * 0.08;
    lineMat.opacity = 0.1 + Math.sin(t * 0.8) * 0.03;

    renderer.render(scene, camera);
  }

  if (reduceMotion) {
    // draw once, no animation
    for (let i = 0; i < pulses.length; i++) {
      const [a, b] = pulses[i].edge;
      const t = pulses[i].t;
      pulsePos.set([a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, a.z + (b.z - a.z) * t], i * 3);
    }
    net.rotation.y = 0.4;
    renderer.render(scene, camera);
  } else {
    frame();
  }
})();
