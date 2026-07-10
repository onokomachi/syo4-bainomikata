/**
 * バブルテーマ専用の背景：夜の水そうの中を、シャボン玉が ゆらゆら のぼっていく。
 * 大きい玉ほど ゆっくり、時どき はじけて 小さい玉に わかれる。
 * theme === 'bubble' のときだけ描画する。
 */
import React, { useEffect, useRef } from 'react';
import { useSettingsStore } from '../../store/settingsStore';

interface Bubble {
  x: number;
  y: number;
  r: number;
  vy: number;
  sway: number;
  swaySpeed: number;
  swayAmp: number;
  hue: number;      // 淡い水色〜ピンク〜黄色の範囲
  alpha: number;
  life: number;     // 0..1（はじけるまでの寿命）
  popAt: number;    // このlifeを下回ったら はじける
}

export const BubbleRain: React.FC = () => {
  const theme = useSettingsStore((s) => s.theme);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (theme !== 'bubble') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let bubbles: Bubble[] = [];
    let pops: { x: number; y: number; r: number; age: number }[] = [];

    const spawn = (fromBottom: boolean): Bubble => ({
      x: Math.random() * canvas.width,
      y: fromBottom ? canvas.height + 20 + Math.random() * 60 : Math.random() * canvas.height,
      r: 6 + Math.random() * 22,
      vy: 0.3 + Math.random() * 0.9,
      sway: Math.random() * Math.PI * 2,
      swaySpeed: 0.008 + Math.random() * 0.02,
      swayAmp: 0.5 + Math.random() * 1.4,
      hue: pick([190, 200, 330, 45, 160]),
      alpha: 0.35 + Math.random() * 0.35,
      life: 1,
      popAt: Math.random() < 0.3 ? 0.15 + Math.random() * 0.35 : -1, // 一部だけ 途中ではじける
    });

    function pick(a: number[]) { return a[Math.floor(Math.random() * a.length)]; }

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      const count = Math.min(60, Math.floor((canvas.width * canvas.height) / 26000));
      bubbles = Array.from({ length: count }, () => spawn(false));
    };
    resize();
    window.addEventListener('resize', resize);

    let last = 0;
    const interval = 33; // ~30fps

    const drawBubble = (b: Bubble) => {
      const a = b.alpha * b.life;
      // 玉の輪郭（うすい光の膜）
      const g = ctx.createRadialGradient(b.x - b.r * 0.3, b.y - b.r * 0.3, b.r * 0.1, b.x, b.y, b.r);
      g.addColorStop(0, `hsla(${b.hue}, 90%, 92%, ${a * 0.9})`);
      g.addColorStop(0.7, `hsla(${b.hue}, 85%, 78%, ${a * 0.25})`);
      g.addColorStop(1, `hsla(${b.hue}, 80%, 70%, ${a * 0.05})`);
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fillStyle = g;
      ctx.fill();
      ctx.lineWidth = Math.max(1, b.r * 0.06);
      ctx.strokeStyle = `hsla(${b.hue}, 95%, 92%, ${a * 0.6})`;
      ctx.stroke();
      // ハイライト
      ctx.beginPath();
      ctx.arc(b.x - b.r * 0.35, b.y - b.r * 0.4, Math.max(1.5, b.r * 0.22), 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${a * 0.85})`;
      ctx.fill();
    };

    const draw = (t: number) => {
      rafRef.current = requestAnimationFrame(draw);
      if (t - last < interval) return;
      last = t;

      // 深い水そうの底（夜の海）
      const sea = ctx.createLinearGradient(0, 0, 0, canvas.height);
      sea.addColorStop(0, '#031722');
      sea.addColorStop(0.55, '#021b24');
      sea.addColorStop(1, '#01252f');
      ctx.fillStyle = sea;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // ゆらめく水面の光
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 3; i++) {
        const y = canvas.height * (0.12 + i * 0.28) + Math.sin(t * 0.0004 + i) * 20;
        const g = ctx.createLinearGradient(0, y - 40, 0, y + 40);
        g.addColorStop(0, 'rgba(120, 220, 255, 0)');
        g.addColorStop(0.5, `rgba(120, 220, 255, ${0.04 + i * 0.01})`);
        g.addColorStop(1, 'rgba(120, 220, 255, 0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, y - 40, canvas.width, 80);
      }
      ctx.globalCompositeOperation = 'source-over';

      // シャボン玉
      for (const b of bubbles) {
        b.sway += b.swaySpeed;
        b.x += Math.sin(b.sway) * b.swayAmp;
        b.y -= b.vy;
        if (b.popAt >= 0 && b.life > b.popAt) b.life -= 0.004;

        if ((b.popAt >= 0 && b.life <= b.popAt) || b.y < -b.r - 10) {
          pops.push({ x: b.x, y: b.y, r: b.r, age: 0 });
          Object.assign(b, spawn(true));
          continue;
        }
        drawBubble(b);
      }

      // はじける演出（小さな光の輪が広がって消える）
      pops = pops.filter((p) => p.age < 14);
      for (const p of pops) {
        p.age += 1;
        const a = Math.max(0, 1 - p.age / 14);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * (1 + p.age * 0.12), 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(220, 250, 255, ${a * 0.6})`;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    };
    rafRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', resize);
    };
  }, [theme]);

  if (theme !== 'bubble') return null;

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="fixed inset-0 pointer-events-none z-0 opacity-85"
      style={{ willChange: 'transform', transform: 'translateZ(0)' }}
    />
  );
};
