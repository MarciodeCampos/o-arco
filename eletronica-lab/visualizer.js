/**
 * visualizer.js — ORBITAL Particle Overlay
 * Vanilla Three.js via CDN, reactivo ao <audio> do player
 * Ativa/desativa com botão ⬡ VISUALIZER
 */

(function () {
  'use strict';

  let scene, camera, renderer, animId;
  let particles, particlePositions, particleVelocities;
  let analyser, dataArray, audioCtx, sourceNode;
  let isActive = false;
  let overlay, canvas;
  const PARTICLE_COUNT = 18000;

  // ── Boot ──────────────────────────────────────────────────────
  function init() {
    // Carrega Three.js via CDN se necessário
    if (typeof THREE === 'undefined') {
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
      s.onload = () => buildVisualizer();
      document.head.appendChild(s);
    } else {
      buildVisualizer();
    }
  }

  // ── Constrói overlay + cena ──────────────────────────────────
  function buildVisualizer() {
    // Overlay container
    overlay = document.createElement('div');
    overlay.id = 'orbital-overlay';
    overlay.style.cssText = `
      position: fixed; inset: 0; z-index: 9999;
      background: #00000088;
      backdrop-filter: blur(2px);
      display: flex; align-items: center; justify-content: center;
      opacity: 0; transition: opacity 0.5s;
      pointer-events: all;
    `;

    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕ fechar';
    closeBtn.style.cssText = `
      position: absolute; top: 16px; right: 20px;
      background: rgba(0,255,204,0.1); border: 1px solid rgba(0,255,204,0.3);
      color: #00ffcc; font-family: 'JetBrains Mono', monospace; font-size: 11px;
      padding: 6px 14px; border-radius: 20px; cursor: pointer; z-index: 10001;
      letter-spacing: 0.1em;
    `;
    closeBtn.addEventListener('click', deactivate);

    // Track info badge (shows current song)
    const badge = document.createElement('div');
    badge.id = 'viz-badge';
    badge.style.cssText = `
      position: absolute; bottom: 24px; left: 50%; transform: translateX(-50%);
      color: rgba(255,255,255,0.6); font-family: 'JetBrains Mono', monospace;
      font-size: 11px; letter-spacing: 0.15em; text-align: center;
      pointer-events: none;
    `;

    // Canvas Three.js
    canvas = document.createElement('canvas');
    canvas.style.cssText = `position: absolute; inset: 0; width: 100%; height: 100%;`;

    overlay.appendChild(canvas);
    overlay.appendChild(closeBtn);
    overlay.appendChild(badge);
    document.body.appendChild(overlay);

    // Three.js setup
    renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x000000, 0);

    scene = new THREE.Scene();

    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 80;

    buildParticles();

    window.addEventListener('resize', onResize);
    window.addEventListener('mousemove', onMouseMove);
  }

  // ── Partículas ────────────────────────────────────────────────
  function buildParticles() {
    const geometry = new THREE.BufferGeometry();
    particlePositions = new Float32Array(PARTICLE_COUNT * 3);
    particleVelocities = new Float32Array(PARTICLE_COUNT * 3);
    const colors = new Float32Array(PARTICLE_COUNT * 3);

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const r = 20 + Math.random() * 50;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);

      particlePositions[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
      particlePositions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      particlePositions[i * 3 + 2] = r * Math.cos(phi);

      particleVelocities[i * 3]     = (Math.random() - 0.5) * 0.02;
      particleVelocities[i * 3 + 1] = (Math.random() - 0.5) * 0.02;
      particleVelocities[i * 3 + 2] = (Math.random() - 0.5) * 0.02;

      // Cores base — ciano/violeta
      const t = Math.random();
      colors[i * 3]     = t < 0.5 ? 0.0 : 0.47;
      colors[i * 3 + 1] = t < 0.5 ? 1.0 : 0.0;
      colors[i * 3 + 2] = t < 0.5 ? 0.8 : 1.0;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: 0.35,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    particles = new THREE.Points(geometry, material);
    scene.add(particles);
  }

  // ── Conecta Web Audio ao <audio> do player ────────────────────
  function connectAudio() {
    const audioEl = document.getElementById('audio');
    if (!audioEl || !audioEl.src) return false;

    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      analyser  = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      dataArray = new Uint8Array(analyser.frequencyBinCount);
      sourceNode = audioCtx.createMediaElementSource(audioEl);
      sourceNode.connect(analyser);
      analyser.connect(audioCtx.destination);
    }

    if (audioCtx.state === 'suspended') audioCtx.resume();
    return true;
  }

  // ── Mouse → rotação suave ─────────────────────────────────────
  let mouseX = 0, mouseY = 0;
  function onMouseMove(e) {
    mouseX = (e.clientX / window.innerWidth - 0.5) * 2;
    mouseY = (e.clientY / window.innerHeight - 0.5) * 2;
  }

  // ── Animate loop ──────────────────────────────────────────────
  function animate() {
    animId = requestAnimationFrame(animate);

    // Dados de frequência
    let bass = 0, mid = 0, high = 0;
    if (analyser && dataArray) {
      analyser.getByteFrequencyData(dataArray);
      const len = dataArray.length;
      for (let i = 0; i < 8; i++)        bass += dataArray[i];
      for (let i = 8; i < 64; i++)       mid  += dataArray[i];
      for (let i = 64; i < len; i++)     high += dataArray[i];
      bass = (bass / 8)   / 255;
      mid  = (mid  / 56)  / 255;
      high = (high / (len - 64)) / 255;
    }

    // Anima partículas
    const pos = particles.geometry.attributes.position;
    const t = Date.now() * 0.0004;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const i3 = i * 3;
      const x = pos.array[i3], y = pos.array[i3+1], z = pos.array[i3+2];
      const dist = Math.sqrt(x*x + y*y + z*z);

      // Força de expansão pelo bass
      const expand = 1 + bass * 0.8;
      const nx = x + (Math.sin(t + i * 0.01) * mid * 0.4);
      const ny = y + (Math.cos(t + i * 0.013) * mid * 0.4);
      const nz = z + (Math.sin(t * 1.3 + i * 0.007) * high * 0.3);

      // Normaliza para manter esfera + expansão
      const ndist = Math.sqrt(nx*nx + ny*ny + nz*nz) || 1;
      const targetR = dist * expand;

      pos.array[i3]   = (nx / ndist) * targetR;
      pos.array[i3+1] = (ny / ndist) * targetR;
      pos.array[i3+2] = (nz / ndist) * targetR;

      // Decay volta ao raio original
      pos.array[i3]   = pos.array[i3]   * 0.992 + particlePositions[i3]   * 0.008;
      pos.array[i3+1] = pos.array[i3+1] * 0.992 + particlePositions[i3+1] * 0.008;
      pos.array[i3+2] = pos.array[i3+2] * 0.992 + particlePositions[i3+2] * 0.008;
    }
    pos.needsUpdate = true;

    // Rotação suave + mouse
    particles.rotation.y += 0.001 + bass * 0.01;
    particles.rotation.x += 0.0005;
    camera.position.x += (mouseX * 20 - camera.position.x) * 0.03;
    camera.position.y += (-mouseY * 10 - camera.position.y) * 0.03;
    camera.lookAt(scene.position);

    // Tamanho das partículas sobe com bass
    particles.material.size = 0.25 + bass * 0.6;

    // Badge com track atual
    const title = document.getElementById('np-title');
    const badge = document.getElementById('viz-badge');
    if (title && badge) badge.textContent = title.textContent;

    renderer.render(scene, camera);
  }

  // ── Activate / Deactivate ─────────────────────────────────────
  function activate() {
    if (isActive) return;
    isActive = true;

    if (!overlay) init();

    const connected = connectAudio();
    if (!connected) {
      // Sem áudio ainda — mostra mesmo assim
    }

    overlay.style.display = 'flex';
    requestAnimationFrame(() => { overlay.style.opacity = '1'; });
    animate();
  }

  function deactivate() {
    isActive = false;
    overlay.style.opacity = '0';
    setTimeout(() => { overlay.style.display = 'none'; }, 500);
    cancelAnimationFrame(animId);
  }

  function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }

  // ── Inject botão no player existente ─────────────────────────
  function injectButton() {
    const controls = document.querySelector('.controls');
    if (!controls) return;

    const btn = document.createElement('button');
    btn.id = 'btn-visualizer';
    btn.className = 'ctrl-btn ctrl-sm';
    btn.title = 'Visualizer';
    btn.innerHTML = '⬡';
    btn.style.cssText = `color: var(--muted); font-size: 18px; transition: all 0.2s;`;

    btn.addEventListener('click', () => {
      if (isActive) deactivate();
      else activate();
      btn.style.color = isActive ? 'var(--accent)' : 'var(--muted)';
      btn.style.textShadow = isActive ? '0 0 12px var(--accent)' : 'none';
    });

    controls.appendChild(btn);
  }

  // ── Aguarda DOM pronto ────────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectButton);
  } else {
    setTimeout(injectButton, 500);
  }

  // Expõe para debug
  window._orbital = { activate, deactivate };
})();
