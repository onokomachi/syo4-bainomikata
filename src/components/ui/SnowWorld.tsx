/**
 * スノーワールドテーマ専用の背景：群青の雪夜に、6本の枝を持つ雪の結晶が
 * くるくる回転しながら舞い落ちる。奥の結晶ほど小さく・うすく（遠近感）。
 * theme === 'snow' のときだけ描画する。
 */
import React, { useEffect, useRef } from 'react';
import { useSettingsStore } from '../../store/settingsStore';

interface Flake {
  x: number;
  y: number;
  size: number;
  vy: number;
  sway: number;
  swaySpeed: number;
  swayAmp: number;
  rot: number;
  rotSpeed: number;
  alpha: number;
  depth: number; // 0=奥(小さい/うすい) 1=手前(大きい/くっきり)
}

/** 6角の雪の結晶をシンプルな枝分かれ線で描く */
function drawSnowflake(ctx: CanvasRenderingContext2D, size: number, alpha: number) {
  ctx.save();
  ctx.strokeStyle = `rgba(235, 248, 255, ${alpha})`;
  ctx.lineWidth = Math.max(0.8, size * 0.06);
  ctx.lineCap = 'round';
  for (let i = 0; i < 6; i++) {
    ctx.save();
    ctx.rotate((Math.PI / 3) * i);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -size);
    ctx.stroke();
    // 枝から生える小枝（雪の結晶らしいディテール）
    for (const frac of [0.45, 0.7]) {
      const by = -size * frac;
      const bl = size * 0.28;
      ctx.beginPath();
      ctx.moveTo(0, by);
      ctx.lineTo(bl * 0.7, by - bl * 0.7);
      ctx.moveTo(0, by);
      ctx.lineTo(-bl * 0.7, by - bl * 0.7);
      ctx.stroke();
    }
    ctx.restore();
  }
  ctx.restore();
}

export const SnowWorld: React.FC = () => {
  const theme = useSettingsStore((s) => s.theme);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (theme !== 'snow') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let flakes: Flake[] = [];

    const spawn = (fromTop: boolean): Flake => {
      const depth = Math.random();
      return {
        x: Math.random() * canvas.width,
        y: fromTop ? -20 : Math.random() * canvas.height,
        size: 4 + depth * 14,
        vy: 0.3 + depth * 1.3,
        sway: Math.random() * Math.PI * 2,
        swaySpeed: 0.006 + Math.random() * 0.014,
        swayAmp: 0.4 + depth * 1.2,
        rot: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.02 * (0.5 + depth),
        alpha: 0.25 + depth * 0.55,
        depth,
      };
    };

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      const count = Math.min(150, Math.floor((canvas.width * canvas.height) / 9500));
      flakes = Array.from({ length: count }, () => spawn(false));
    };
    resize();
    window.addEventListener('resize', resize);

    let last = 0;
    const interval = 33; // ~30fps

    const draw = (t: number) => {
      rafRef.current = requestAnimationFrame(draw);
      if (t - last < interval) return;
      last = t;

      // 群青の雪夜
      const sky = ctx.createLinearGradient(0, 0, 0, canvas.height);
      sky.addColorStop(0, '#040d1c');
      sky.addColorStop(0.6, '#071322');
      sky.addColorStop(1, '#0c2038');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // 遠くの月あかり
      const mx = canvas.width * 0.18;
      const my = canvas.height * 0.14;
      const moon = ctx.createRadialGradient(mx, my, 0, mx, my, canvas.width * 0.16);
      moon.addColorStop(0, 'rgba(220, 240, 255, 0.20)');
      moon.addColorStop(1, 'rgba(220, 240, 255, 0)');
      ctx.fillStyle = moon;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // 地面に積もる雪あかり
      const ground = ctx.createLinearGradient(0, canvas.height * 0.85, 0, canvas.height);
      ground.addColorStop(0, 'rgba(0,0,0,0)');
      ground.addColorStop(1, 'rgba(200, 225, 255, 0.10)');
      ctx.fillStyle = ground;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // 雪の結晶（奥から手前へ、遠近感つき）
      const sorted = [...flakes].sort((a, b) => a.depth - b.depth);
      for (const f of sorted) {
        f.sway += f.swaySpeed;
        f.rot += f.rotSpeed;
        f.x += Math.sin(f.sway) * f.swayAmp;
        f.y += f.vy;
        ctx.save();
        ctx.translate(f.x, f.y);
        ctx.rotate(f.rot);
        drawSnowflake(ctx, f.size, f.alpha);
        ctx.restore();
        if (f.y > canvas.height + 20 || f.x > canvas.width + 30 || f.x < -30) {
          Object.assign(f, spawn(true), { x: Math.random() * canvas.width });
        }
      }
    };
    rafRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', resize);
    };
  }, [theme]);

  if (theme !== 'snow') return null;

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="fixed inset-0 pointer-events-none z-0 opacity-85"
      style={{ willChange: 'transform', transform: 'translateZ(0)' }}
    />
  );
};
