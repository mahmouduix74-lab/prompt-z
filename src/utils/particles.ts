/**
 * Particle field for the XTRACT hero, ported from hero-section/js/hero.js.
 *
 * Settings from the reference's Framer "Particles" component (tsParticles):
 * number 130, size 0.9, colour #fff, opacity 1, move.speed 0.6,
 * move.direction "inside", outModes "out", fpsLimit 60, detectRetina.
 * Behaviour follows the tsParticles code bundled on that page: each particle
 * flies straight at the canvas centre and respawns at a random point once it
 * has passed the centre on both axes.
 */
const PARTICLES = {
  count: 130,
  radius: 0.9, // CSS px
  color: '#fff',
  opacity: 1,
  speed: 0.6,
  fpsLimit: 60,
};

// tsParticles advances speed × (60 × elapsedMs / 1000) / 2 px per update → 18 px/s.
const PX_PER_MS = (PARTICLES.speed * 60) / 1000 / 2;

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export interface ParticleField {
  resize: () => void;
  play: () => void;
  pause: () => void;
}

export function createParticleField(canvas: HTMLCanvasElement, isDark: boolean = true): ParticleField | null {
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const particleColor = isDark ? '#ffffff' : '#7c3aed';
  const particleOpacity = isDark ? 0.7 : 0.45;

  let width = 0;
  let height = 0;
  let dpr = 1;
  let particles: Particle[] = [];
  let frameId = 0;
  let lastTime: number | undefined;
  let running = false;

  const getCenterY = () => Math.min(Math.max(height * 0.32, 230), 320);

  const aim = (p: Particle) => {
    const cy = getCenterY();
    const angle = Math.atan2(cy - p.y, width / 2 - p.x);
    p.vx = Math.cos(angle);
    p.vy = Math.sin(angle);
  };

  const spawn = (p: Particle = { x: 0, y: 0, vx: 0, vy: 0 }) => {
    p.x = Math.floor(Math.random() * width);
    p.y = Math.floor(Math.random() * height);
    aim(p);
    return p;
  };

  function draw() {
    ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx!.clearRect(0, 0, width, height);
    ctx!.globalAlpha = particleOpacity;
    ctx!.fillStyle = particleColor;
    ctx!.beginPath();
    for (const p of particles) {
      ctx!.moveTo(p.x + PARTICLES.radius, p.y);
      ctx!.arc(p.x, p.y, PARTICLES.radius, 0, Math.PI * 2);
    }
    ctx!.fill();
  }

  function update(elapsedMs: number) {
    const step = elapsedMs * PX_PER_MS;
    const cx = width / 2;
    const cy = getCenterY();
    for (const p of particles) {
      p.x += p.vx * step;
      p.y += p.vy * step;
      const dx = p.x - cx;
      const dy = p.y - cy;
      const approaching =
        (p.vx <= 0 && dx >= 0) || (p.vy <= 0 && dy >= 0) || (p.vx >= 0 && dx <= 0) || (p.vy >= 0 && dy <= 0);
      if (!approaching) spawn(p);
    }
  }

  function frame(now: number) {
    frameId = requestAnimationFrame(frame);
    if (lastTime === undefined) {
      lastTime = now;
      return;
    }
    const elapsed = now - lastTime;
    if (elapsed < 1000 / PARTICLES.fpsLimit - 1) return; // 1 ms tolerance for display jitter
    lastTime = now;
    if (elapsed > 1000) return; // like tsParticles: skip the jump after a long pause
    update(elapsed);
    draw();
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    dpr = Math.min(window.devicePixelRatio || 1, 3);
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);

    if (particles.length) {
      // Keep the distribution when the canvas changes size.
      const sx = rect.width / width;
      const sy = rect.height / height;
      width = rect.width;
      height = rect.height;
      for (const p of particles) {
        p.x *= sx;
        p.y *= sy;
        aim(p);
      }
    } else {
      width = rect.width;
      height = rect.height;
      particles = Array.from({ length: PARTICLES.count }, () => spawn());
    }
    draw(); // resizing clears the canvas
  }

  return {
    resize,
    play() {
      if (running) return;
      running = true;
      lastTime = undefined;
      frameId = requestAnimationFrame(frame);
    },
    pause() {
      running = false;
      cancelAnimationFrame(frameId);
    },
  };
}
