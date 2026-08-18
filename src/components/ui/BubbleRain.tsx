/**
 * バブルテーマ専用の背景：白を基調にした明るい空間を、虹色にきらめくシャボン玉が
 * ふわふわのぼっていく。シャボン玉の膜は「見る角度で色が変わる」構造色（シャボン玉らしい
 * 虹色のにじみ）を、円周を12分割した色相リングで表現する。大きい玉ほど ゆっくり、
 * 時どき はじけて 小さな光の輪になって消える。
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
  rimRotation: number; // 虹色リングの回転位相（玉ごとにずらして単調にならないように）
  rimSpin: number;
  alpha: number;
  life: number;     // 0..1（はじけるまでの寿命）
  popAt: number;    // このlifeを下回ったら はじける
}

interface Glow {
  x: number; y: number; r: number; hue: number; drift: number;
}

const RAINBOW_STOPS = 12;

/** シャボン玉の膜のような、円周にそって色相が一周する虹色リングを描く。 */
function drawRainbowRim(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, width: number, alpha: number, rotation: number) {
  const segs = Math.max(8, Math.min(RAINBOW_STOPS, Math.round(r / 2.2)));
  for (let i = 0; i < segs; i++) {
    const a0 = rotation + (Math.PI * 2 * i) / segs;
    const a1 = rotation + (Math.PI * 2 * (i + 1)) / segs + 0.02; // わずかに重ねて すきまを消す
    const hue = (360 * i) / segs;
    ctx.beginPath();
    ctx.arc(x, y, r, a0, a1);
    ctx.strokeStyle = `hsla(${hue}, 95%, 68%, ${alpha})`;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.stroke();
  }
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
    let glows: Glow[] = [];
    let pops: { x: number; y: number; r: number; age: number; rotation: number }[] = [];

    const spawn = (fromBottom: boolean): Bubble => ({
      x: Math.random() * canvas.width,
      y: fromBottom ? canvas.height + 20 + Math.random() * 60 : Math.random() * canvas.height,
      r: 7 + Math.random() * 26,
      vy: 0.3 + Math.random() * 0.9,
      sway: Math.random() * Math.PI * 2,
      swaySpeed: 0.008 + Math.random() * 0.02,
      swayAmp: 0.5 + Math.random() * 1.4,
      rimRotation: Math.random() * Math.PI * 2,
      rimSpin: (Math.random() - 0.5) * 0.01,
      alpha: 0.55 + Math.random() * 0.35,
      life: 1,
      popAt: Math.random() < 0.3 ? 0.15 + Math.random() * 0.35 : -1, // 一部だけ 途中ではじける
    });

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      const count = Math.min(55, Math.floor((canvas.width * canvas.height) / 28000));
      bubbles = Array.from({ length: count }, () => spawn(false));
      // 背景にうっすら漂う大きな光のにじみ（奥行きを出す。かなり淡いのでリッチさの土台）
      const glowCount = Math.min(6, Math.max(3, Math.floor(canvas.width / 380)));
      glows = Array.from({ length: glowCount }, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        r: 160 + Math.random() * 220,
        hue: Math.random() * 360,
        drift: Math.random() * Math.PI * 2,
      }));
    };
    resize();
    window.addEventListener('resize', resize);

    let last = 0;
    const interval = 33; // ~30fps

    const drawBubble = (b: Bubble) => {
      const a = b.alpha * b.life;

      // 玉の内側（ほぼ透明なガラス質。ほんのり虹色を帯びる）
      const g = ctx.createRadialGradient(b.x - b.r * 0.3, b.y - b.r * 0.3, b.r * 0.05, b.x, b.y, b.r);
      g.addColorStop(0, `rgba(255,255,255,${a * 0.55})`);
      g.addColorStop(0.55, `hsla(${(b.rimRotation * 180) / Math.PI}, 70%, 88%, ${a * 0.16})`);
      g.addColorStop(1, `rgba(255,255,255,0)`);
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r * 0.97, 0, Math.PI * 2);
      ctx.fillStyle = g;
      ctx.fill();

      // 構造色の虹色リング（シャボン玉の膜そのもの。はっきり虹色に見せる主役）
      drawRainbowRim(ctx, b.x, b.y, b.r, Math.max(1.8, b.r * 0.16), a * 0.85, b.rimRotation);

      // 大きめのハイライト（光源を思わせる白い照り返し）
      ctx.beginPath();
      ctx.arc(b.x - b.r * 0.35, b.y - b.r * 0.42, Math.max(1.6, b.r * 0.24), 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${a * 0.95})`;
      ctx.fill();
      // 小さな副ハイライト（ガラス感の演出）
      ctx.beginPath();
      ctx.arc(b.x + b.r * 0.32, b.y + b.r * 0.38, Math.max(1, b.r * 0.1), 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${a * 0.55})`;
      ctx.fill();
    };

    const draw = (t: number) => {
      rafRef.current = requestAnimationFrame(draw);
      if (t - last < interval) return;
      last = t;

      // 白を基調にした、ごくやわらかい空のグラデーション
      const sky = ctx.createLinearGradient(0, 0, 0, canvas.height);
      sky.addColorStop(0, '#ffffff');
      sky.addColorStop(0.55, '#f7fdff');
      sky.addColorStop(1, '#eef9ff');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // 奥にゆっくり漂う、淡いパステル色のにじみ（リッチな奥行き演出。前面には出しゃばらない）
      for (const gl of glows) {
        gl.drift += 0.0015;
        const gx = gl.x + Math.sin(gl.drift) * 40;
        const gy = gl.y + Math.cos(gl.drift * 0.8) * 30;
        const rg = ctx.createRadialGradient(gx, gy, 0, gx, gy, gl.r);
        rg.addColorStop(0, `hsla(${gl.hue}, 90%, 85%, 0.10)`);
        rg.addColorStop(1, `hsla(${gl.hue}, 90%, 85%, 0)`);
        ctx.fillStyle = rg;
        ctx.fillRect(gx - gl.r, gy - gl.r, gl.r * 2, gl.r * 2);
      }

      // シャボン玉
      for (const b of bubbles) {
        b.sway += b.swaySpeed;
        b.rimRotation += b.rimSpin;
        b.x += Math.sin(b.sway) * b.swayAmp;
        b.y -= b.vy;
        if (b.popAt >= 0 && b.life > b.popAt) b.life -= 0.004;

        if ((b.popAt >= 0 && b.life <= b.popAt) || b.y < -b.r - 10) {
          pops.push({ x: b.x, y: b.y, r: b.r, age: 0, rotation: b.rimRotation });
          Object.assign(b, spawn(true));
          continue;
        }
        drawBubble(b);
      }

      // はじける演出（虹色の光の輪が広がって消える）
      pops = pops.filter((p) => p.age < 16);
      for (const p of pops) {
        p.age += 1;
        const a = Math.max(0, 1 - p.age / 16);
        drawRainbowRim(ctx, p.x, p.y, p.r * (1 + p.age * 0.16), 2, a * 0.7, p.rotation);
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
      className="fixed inset-0 pointer-events-none z-0"
      style={{ willChange: 'transform', transform: 'translateZ(0)' }}
    />
  );
};
