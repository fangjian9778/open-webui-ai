<template>
  <canvas ref="canvas" class="particle-bg"></canvas>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue';

const canvas = ref<HTMLCanvasElement | null>(null);
let ctx: CanvasRenderingContext2D | null = null;
let animationId = 0;
let particles: Particle[] = [];
const PARTICLE_COUNT = 60;

interface Particle {
  x: number;
  y: number;
  z: number; // 深度，用于透视
  speed: number;
  size: number;
}

function resize() {
  if (!canvas.value) return;
  canvas.value.width = window.innerWidth;
  canvas.value.height = window.innerHeight;
}

function initParticles() {
  particles = [];
  const w = canvas.value!.width;
  const h = canvas.value!.height;
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    particles.push({
      x: Math.random() * w,
      y: Math.random() * h,
      z: Math.random() * 1 + 0.2,
      speed: Math.random() * 0.3 + 0.1,
      size: Math.random() * 2 + 0.5
    });
  }
}

function draw() {
  if (!ctx || !canvas.value) return;
  const w = canvas.value.width;
  const h = canvas.value.height;

  // 半透明遮罩制造拖尾
  ctx.fillStyle = 'rgba(5, 8, 22, 0.15)';
  ctx.fillRect(0, 0, w, h);

  // 更新和绘制粒子
  for (const p of particles) {
    p.y += p.speed * p.z;
    p.x += Math.sin(p.y * 0.01) * 0.3;

    if (p.y > h) {
      p.y = -10;
      p.x = Math.random() * w;
    }
    if (p.x < -10) p.x = w + 10;
    if (p.x > w + 10) p.x = -10;

    const size = p.size * p.z * 1.5;
    const alpha = p.z * 0.8;

    // 发光效果
    const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, size * 4);
    gradient.addColorStop(0, `rgba(0, 212, 255, ${alpha})`);
    gradient.addColorStop(1, 'rgba(0, 212, 255, 0)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(p.x, p.y, size * 4, 0, Math.PI * 2);
    ctx.fill();

    // 核心亮点
    ctx.fillStyle = `rgba(200, 240, 255, ${alpha})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
    ctx.fill();
  }

  animationId = requestAnimationFrame(draw);
}

onMounted(() => {
  if (!canvas.value) return;
  ctx = canvas.value.getContext('2d');
  if (!ctx) return;
  resize();
  initParticles();
  draw();
  window.addEventListener('resize', () => {
    resize();
    initParticles();
  });
});

onBeforeUnmount(() => {
  cancelAnimationFrame(animationId);
  window.removeEventListener('resize', resize);
});
</script>

<style scoped>
.particle-bg {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  z-index: -1;
  pointer-events: none;
  opacity: 0.6;
}
</style>
