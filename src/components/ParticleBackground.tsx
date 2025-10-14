// src/components/ParticleBackground.tsx - VERSIUNE FIXATĂ

import { useEffect, useRef } from 'react';

interface ParticleProps {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  opacity: number;
}

class GameParticle implements ParticleProps {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  opacity: number;

  constructor(canvas: HTMLCanvasElement) {
    this.x = Math.random() * canvas.width;
    this.y = Math.random() * canvas.height;
    this.vx = (Math.random() - 0.5) * 1.5;
    this.vy = (Math.random() - 0.5) * 1.5;
    this.size = Math.random() * 5 + 1;
    this.opacity = Math.random() * 0.5 + 0.5;
  }

  update(canvas: HTMLCanvasElement) {
    this.x += this.vx;
    this.y += this.vy;
    if (this.x < 0 || this.x > canvas.width) this.vx *= -1;
    if (this.y < 0 || this.y > canvas.height) this.vy *= -1;
  }

  draw(ctx: CanvasRenderingContext2D, particles: GameParticle[]) {
    // glowing particle
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.shadowBlur = 15;
    ctx.shadowColor = "rgba(255, 94, 0, 0.8)";
    ctx.fillStyle = `rgba(106, 13, 173, ${this.opacity})`;
    ctx.fill();
    ctx.shadowBlur = 0;

    // connect to nearest neighbors
    const neighbors = particles
      .filter(p => p !== this)
      .sort((a, b) => {
        const da = (this.x - a.x) ** 2 + (this.y - a.y) ** 2;
        const db = (this.x - b.x) ** 2 + (this.y - b.y) ** 2;
        return da - db;
      })
      .slice(0, 3);

    neighbors.forEach(particle => {
      const dx = this.x - particle.x;
      const dy = this.y - particle.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance < 150) {
        ctx.beginPath();
        ctx.moveTo(this.x, this.y);
        ctx.lineTo(particle.x, particle.y);

        const gradient = ctx.createLinearGradient(this.x, this.y, particle.x, particle.y);
        gradient.addColorStop(0, "rgba(255, 94, 0, 0.3)");
        gradient.addColorStop(1, "rgba(106, 13, 173, 0.3)");

        ctx.strokeStyle = gradient;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    });
  }
}

export default function ParticleBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    function resizeCanvas() {
      if (canvas) {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
      }
    }

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    const particles: GameParticle[] = [];
    const particleCount = 100;
    for (let i = 0; i < particleCount; i++) {
      particles.push(new GameParticle(canvas));
    }

    let animationId: number;
    function animate() {
      if (!ctx || !canvas) return;

      // background gradient
      const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
      gradient.addColorStop(0, "#0a0a0a");
      gradient.addColorStop(1, "#1a1a2e");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      particles.forEach(p => p.update(canvas));
      particles.forEach(p => p.draw(ctx, particles));

      animationId = requestAnimationFrame(animate);
    }
    animate();

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', resizeCanvas);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 0 }} // ✅ Explicit z-index
    />
  );
}