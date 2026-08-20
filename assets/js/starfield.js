/* =========================================================================
   starfield.js — 배경 별하늘 캔버스 레이어
   - SVG 하늘(body::before) 위, 언덕(body::after) 아래에 그려집니다
   - 3개 깊이 레이어의 시차(parallax), 느린 흐름, 반짝임, 가끔 지나가는 별똥별
   - prefers-reduced-motion 이면 한 번만 그리고 애니메이션을 돌리지 않습니다
   ========================================================================= */
(() => {
  'use strict';

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

  let canvas = document.getElementById('sky-canvas');
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.id = 'sky-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    document.body.appendChild(canvas);
  }
  const ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) return;

  /* ---------- 별 스프라이트 (한 번만 그려두고 재사용) ---------- */
  const TINTS = [
    '255,255,255', '255,255,255', '222,232,255', '205,224,255', '255,240,214'
  ];
  const SPRITE = 32;
  const sprites = TINTS.map((rgb) => {
    const c = document.createElement('canvas');
    c.width = c.height = SPRITE;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(
      SPRITE / 2, SPRITE / 2, 0, SPRITE / 2, SPRITE / 2, SPRITE / 2
    );
    grad.addColorStop(0.0, `rgba(${rgb},1)`);
    grad.addColorStop(0.28, `rgba(${rgb},0.85)`);
    grad.addColorStop(0.55, `rgba(${rgb},0.16)`);
    grad.addColorStop(1.0, `rgba(${rgb},0)`);
    g.fillStyle = grad;
    g.fillRect(0, 0, SPRITE, SPRITE);
    return c;
  });

  /* ---------- 상태 ---------- */
  const LAYERS = [
    { depth: 0.22, share: 0.46, size: [1.4, 2.6], alpha: [0.22, 0.5], drift: 1.6 },
    { depth: 0.55, share: 0.34, size: [2.0, 3.6], alpha: [0.32, 0.7], drift: 4.0 },
    { depth: 1.00, share: 0.20, size: [3.0, 5.6], alpha: [0.45, 0.95], drift: 7.5 }
  ];

  let W = 0, H = 0, dpr = 1;
  let stars = [];
  let shot = null;
  let nextShotAt = 0;
  let rafId = 0;
  let scrollY = 0;
  const ptr = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5 };

  const rand = (a, b) => a + Math.random() * (b - a);

  function build() {
    const area = W * H;
    let total = Math.round(area / 6800);
    total = Math.max(70, Math.min(total, W < 850 ? 190 : 420));

    stars = [];
    for (const L of LAYERS) {
      const n = Math.round(total * L.share);
      for (let i = 0; i < n; i++) {
        stars.push({
          x: Math.random() * W,
          y: Math.random() * H,
          s: rand(L.size[0], L.size[1]),
          a: rand(L.alpha[0], L.alpha[1]),
          sprite: sprites[(Math.random() * sprites.length) | 0],
          phase: Math.random() * Math.PI * 2,
          speed: rand(0.35, 1.3),
          depth: L.depth,
          drift: L.drift * rand(0.7, 1.3)
        });
      }
    }
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    build();
    if (reduced.matches) draw(0);
  }

  /* ---------- 별똥별 ---------- */
  function spawnShot() {
    const fromLeft = Math.random() < 0.62;
    const angle = rand(0.28, 0.48) * (fromLeft ? 1 : -1); // 라디안, 아래로 비스듬히
    const speed = rand(0.75, 1.25) * (W / 1400 + 0.6);
    shot = {
      x: fromLeft ? rand(-0.1, 0.55) * W : rand(0.45, 1.1) * W,
      y: rand(-0.05, 0.3) * H,
      vx: Math.cos(angle) * (fromLeft ? 1 : -1) * speed * 14,
      vy: Math.sin(Math.abs(angle)) * speed * 14,
      len: rand(90, 230),
      life: 0,
      max: rand(48, 78)
    };
  }

  function drawShot() {
    if (!shot) return;
    const t = shot.life / shot.max;
    const fade = t < 0.15 ? t / 0.15 : 1 - (t - 0.15) / 0.85;
    if (fade <= 0) return;

    const nx = shot.vx, ny = shot.vy;
    const m = Math.hypot(nx, ny) || 1;
    const tailX = shot.x - (nx / m) * shot.len;
    const tailY = shot.y - (ny / m) * shot.len;

    const g = ctx.createLinearGradient(shot.x, shot.y, tailX, tailY);
    g.addColorStop(0, `rgba(255,255,255,${0.9 * fade})`);
    g.addColorStop(0.35, `rgba(200,225,255,${0.35 * fade})`);
    g.addColorStop(1, 'rgba(180,210,255,0)');

    ctx.save();
    ctx.lineCap = 'round';
    ctx.strokeStyle = g;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(shot.x, shot.y);
    ctx.lineTo(tailX, tailY);
    ctx.stroke();

    ctx.globalAlpha = fade;
    ctx.drawImage(sprites[0], shot.x - 9, shot.y - 9, 18, 18);
    ctx.restore();
  }

  /* ---------- 그리기 ---------- */
  function draw(t) {
    ctx.clearRect(0, 0, W, H);

    ptr.x += (ptr.tx - ptr.x) * 0.05;
    ptr.y += (ptr.ty - ptr.y) * 0.05;

    const px = (ptr.x - 0.5) * 34;
    const py = (ptr.y - 0.5) * 18;
    const sy = scrollY * 0.035;
    const sec = t / 1000;

    for (const st of stars) {
      let x = st.x + px * st.depth + sec * st.drift;
      let y = st.y + py * st.depth + sy * st.depth;

      // 화면 밖으로 나가면 반대편에서 다시 들어오게
      x = ((x % W) + W) % W;
      y = ((y % H) + H) % H;

      const tw = 0.62 + 0.38 * Math.sin(sec * st.speed + st.phase);
      ctx.globalAlpha = st.a * tw;
      ctx.drawImage(st.sprite, x - st.s, y - st.s, st.s * 2, st.s * 2);
    }
    ctx.globalAlpha = 1;

    if (shot) {
      drawShot();
      shot.x += shot.vx;
      shot.y += shot.vy;
      shot.life += 1;
      if (shot.life > shot.max) shot = null;
    }
  }

  function frame(t) {
    if (!document.hidden) {
      if (!shot && t > nextShotAt) {
        spawnShot();
        nextShotAt = t + rand(5200, 15000);
      }
      draw(t);
    }
    rafId = requestAnimationFrame(frame);
  }

  function start() {
    cancelAnimationFrame(rafId);
    if (reduced.matches) {
      draw(0);
      return;
    }
    nextShotAt = performance.now() + rand(1800, 5000);
    rafId = requestAnimationFrame(frame);
  }

  /* ---------- 이벤트 ---------- */
  let resizeTimer = 0;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, 160);
  });

  window.addEventListener('scroll', () => { scrollY = window.scrollY; }, { passive: true });

  window.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch') return;
    ptr.tx = e.clientX / window.innerWidth;
    ptr.ty = e.clientY / window.innerHeight;
  }, { passive: true });

  reduced.addEventListener('change', start);

  resize();
  start();
})();
