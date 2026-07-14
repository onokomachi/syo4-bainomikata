/**
 * 時空神テーマ専用の背景：画面中心から放射状に広がる、レインボーの万華鏡もよう。
 * 花びらのような図形を左右対称に何枚も重ね、色相をゆっくり回して虹色に変化させる。
 * ときどき きらめく光の粒を重ねて、リッチで華やかな演出にする。
 * theme === 'kaleido' のときだけ描画する。
 */
import React, { useEffect, useRef } from 'react';
import { useSettingsStore } from '../../store/settingsStore';

interface Sparkle {
  angle: number;
  dist: number;
  r: number;
  tw: number;
  twSpeed: number;
}

export const Kaleidoscope: React.FC = () => {
  const theme = useSettingsStore((s) => s.theme);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (theme !== 'kaleido') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let sparkles: Sparkle[] = [];
    const SEGMENTS = 10; // 対称の枚数（多いほど華やか）

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      const count = Math.min(90, Math.floor((canvas.width * canvas.height) / 16000));
      sparkles = Array.from({ length: count }, () => ({
        angle: Math.random() * Math.PI * 2,
        dist: Math.random(),
        r: 1 + Math.random() * 2.2,
        tw: Math.random() * Math.PI * 2,
        twSpeed: 0.03 + Math.random() * 0.06,
      }));
    };
    resize();
    window.addEventListener('resize', resize);

    let last = 0;
    const interval = 33; // ~30fps

    const draw = (t: number) => {
      rafRef.current = requestAnimationFrame(draw);
      if (t - last < interval) return;
      last = t;

      const cx = canvas.width / 2;
      const cy = canvas.height / 2;
      const maxR = Math.hypot(canvas.width, canvas.height) / 2;

      // 深い闇の底へ、ふわっとフェード（前フレームをうっすら残すと軌跡が生まれる）
      ctx.fillStyle = 'rgba(5, 1, 12, 0.16)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.globalCompositeOperation = 'lighter';

      // ゆっくり回転する色相（虹色をぐるぐる巡らせる）
      const baseHue = (t * 0.02) % 360;
      const spin = t * 0.00012;

      // 花びらレイヤーを何重にも重ねて、放射状の万華鏡もようを作る
      const petalLayers = 4;
      for (let layer = 0; layer < petalLayers; layer++) {
        const layerR = maxR * (0.22 + layer * 0.2);
        const petalLen = maxR * (0.16 + layer * 0.07);
        const wobble = Math.sin(t * 0.0006 + layer) * 0.12;
        for (let i = 0; i < SEGMENTS; i++) {
          const ang = (Math.PI * 2 * i) / SEGMENTS + spin * (layer % 2 === 0 ? 1 : -1);
          const hue = (baseHue + (360 / SEGMENTS) * i + layer * 40) % 360;
          const px = cx + Math.cos(ang) * layerR;
          const py = cy + Math.sin(ang) * layerR;

          ctx.save();
          ctx.translate(px, py);
          ctx.rotate(ang + Math.PI / 2 + wobble);
          const g = ctx.createRadialGradient(0, 0, 0, 0, petalLen * 0.5, petalLen);
          g.addColorStop(0, `hsla(${hue}, 100%, 75%, 0.30)`);
          g.addColorStop(0.6, `hsla(${(hue + 30) % 360}, 100%, 60%, 0.14)`);
          g.addColorStop(1, `hsla(${hue}, 100%, 50%, 0)`);
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.ellipse(0, petalLen * 0.4, petalLen * 0.34, petalLen * 0.62, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }

      // 中心の虹色コア（脈打つように明滅）
      const pulse = 0.6 + Math.sin(t * 0.0022) * 0.4;
      const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, maxR * 0.16 * (0.8 + pulse * 0.3));
      core.addColorStop(0, `hsla(${baseHue}, 100%, 92%, 0.9)`);
      core.addColorStop(0.5, `hsla(${(baseHue + 60) % 360}, 100%, 70%, 0.35)`);
      core.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = core;
      ctx.beginPath();
      ctx.arc(cx, cy, maxR * 0.2, 0, Math.PI * 2);
      ctx.fill();

      // きらめく光の粒（放射状に配置し、明滅させる）
      for (const s of sparkles) {
        s.tw += s.twSpeed;
        const r = s.dist * maxR;
        const x = cx + Math.cos(s.angle + spin * 0.5) * r;
        const y = cy + Math.sin(s.angle + spin * 0.5) * r;
        const a = 0.3 + Math.max(0, Math.sin(s.tw)) * 0.6;
        const hue = (baseHue + s.dist * 180) % 360;
        ctx.beginPath();
        ctx.arc(x, y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${hue}, 100%, 85%, ${a})`;
        ctx.fill();
      }

      ctx.globalCompositeOperation = 'source-over';
    };
    rafRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', resize);
    };
  }, [theme]);

  if (theme !== 'kaleido') return null;

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="fixed inset-0 pointer-events-none z-0 opacity-90"
      style={{ willChange: 'transform', transform: 'translateZ(0)' }}
    />
  );
};
