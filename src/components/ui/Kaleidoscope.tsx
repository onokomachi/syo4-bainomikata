/**
 * 時空神テーマ専用の背景：本物の万華鏡のぞき穴のような、鏡面対称の宝石もよう。
 *
 * 実物の万華鏡は「中心角 π/N の扇形（ミラー室）」の中を色ガラスの破片が漂い、
 * それが鏡2枚で反射をくり返して 2N枚の合わせ鏡もようになる。ここでは
 *   1) 1つの扇形だけに 色ガラス片（円・三角・ひし形・シャード）を配置して动かす
 *   2) その扇形を N回 回転コピー + 反転コピーする（ctx.scale(1,-1) で鏡写し）
 * という手順で、ソフトな花びらのにじみではなく くっきりした鏡対称の実物感を出す。
 * ときどき きらめく光の粒を重ねて、リッチで華やかな演出にする。
 * theme === 'kaleido' のときだけ描画する。
 */
import React, { useEffect, useRef } from 'react';
import { useSettingsStore } from '../../store/settingsStore';

type ChipShape = 'circle' | 'triangle' | 'diamond' | 'shard';

interface Chip {
  shape: ChipShape;
  angle: number;   // 扇形内での角度（0..wedgeAngle）
  radius: number;  // 中心からの距離（0..maxR）
  radiusPhase: number; // 距離をゆっくり脈動させる位相
  size: number;
  rot: number;
  rotSpeed: number;
  hue: number;
  alpha: number;
}

interface Sparkle {
  angle: number;
  dist: number;
  r: number;
  tw: number;
  twSpeed: number;
}

const MIRRORS = 6; // ミラーの枚数。2*MIRRORS = 12枚の合わせ鏡もようになる
const CHIP_SHAPES: ChipShape[] = ['circle', 'triangle', 'diamond', 'shard'];

function drawChip(ctx: CanvasRenderingContext2D, chip: Chip, alpha: number) {
  ctx.save();
  ctx.rotate(chip.rot);
  const s = chip.size;
  const a = chip.alpha * alpha;
  // 宝石のカット面のように、面ごとに濃淡がつくグラデーションで塗る
  // （単色べた塗り＋lighterの白飛びをさけ、くっきりした色ガラス片に見せる）
  const facet = ctx.createLinearGradient(-s, -s, s, s);
  facet.addColorStop(0, `hsla(${chip.hue}, 100%, 78%, ${a})`);
  facet.addColorStop(0.5, `hsla(${chip.hue}, 96%, 56%, ${a})`);
  facet.addColorStop(1, `hsla(${(chip.hue + 25) % 360}, 100%, 36%, ${a})`);
  const edge = `hsla(${chip.hue}, 100%, 90%, ${a})`;
  ctx.fillStyle = facet;
  ctx.strokeStyle = edge;
  ctx.lineWidth = Math.max(0.8, s * 0.08);

  ctx.beginPath();
  switch (chip.shape) {
    case 'circle':
      ctx.arc(0, 0, s, 0, Math.PI * 2);
      break;
    case 'triangle':
      ctx.moveTo(0, -s);
      ctx.lineTo(s * 0.87, s * 0.5);
      ctx.lineTo(-s * 0.87, s * 0.5);
      ctx.closePath();
      break;
    case 'diamond':
      ctx.moveTo(0, -s);
      ctx.lineTo(s * 0.6, 0);
      ctx.lineTo(0, s);
      ctx.lineTo(-s * 0.6, 0);
      ctx.closePath();
      break;
    case 'shard':
      ctx.moveTo(0, -s * 1.4);
      ctx.lineTo(s * 0.35, s * 0.3);
      ctx.lineTo(0, s * 0.9);
      ctx.lineTo(-s * 0.35, s * 0.3);
      ctx.closePath();
      break;
  }
  ctx.fill();
  ctx.stroke();
  ctx.restore();
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

    const wedgeAngle = Math.PI / MIRRORS;
    let chips: Chip[] = [];
    let sparkles: Sparkle[] = [];

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      const maxR = Math.hypot(canvas.width, canvas.height) / 2;

      const chipCount = 26;
      chips = Array.from({ length: chipCount }, (_, i) => ({
        shape: CHIP_SHAPES[i % CHIP_SHAPES.length],
        angle: Math.random() * wedgeAngle,
        radius: maxR * (0.08 + Math.random() * 0.88),
        radiusPhase: Math.random() * Math.PI * 2,
        size: maxR * (0.018 + Math.random() * 0.032),
        rot: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.02,
        hue: Math.random() * 360,
        alpha: 0.7 + Math.random() * 0.3,
      }));

      const count = Math.min(70, Math.floor((canvas.width * canvas.height) / 20000));
      sparkles = Array.from({ length: count }, () => ({
        angle: Math.random() * Math.PI * 2,
        dist: Math.random(),
        r: 1 + Math.random() * 2,
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

      // 万華鏡のぞき穴の底＝ほぼ黒。前フレームをうっすら残して光の軌跡を出す
      ctx.fillStyle = 'rgba(4, 1, 10, 0.22)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const spin = t * 0.00009; // チューブをゆっくり回しているような全体の回転

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(spin);
      // 'lighter' で重ねると色ガラス片どうしが白く飛んでしまい輪郭がぼやけるので、
      // ここは通常合成のままにして 色そのものをくっきり保つ（宝石感の決め手）。
      ctx.globalCompositeOperation = 'source-over';

      // 1枚の扇形（ミラー室）だけ ガラス片を計算して描き、
      // それを回転コピー＋鏡写しコピーで 2*MIRRORS 枚に増やす。
      // ソフトな花びらのにじみではなく、実物の万華鏡のようにミラーの境界がくっきり出る。
      for (let m = 0; m < MIRRORS; m++) {
        ctx.save();
        ctx.rotate(m * wedgeAngle * 2);

        // 直接コピー
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, maxR, 0, wedgeAngle);
        ctx.closePath();
        ctx.clip();
        for (const chip of chips) {
          chip.rot += chip.rotSpeed;
          const rr = chip.radius * (0.92 + 0.08 * Math.sin(t * 0.0005 + chip.radiusPhase));
          ctx.save();
          ctx.translate(Math.cos(chip.angle) * rr, Math.sin(chip.angle) * rr);
          drawChip(ctx, chip, 1);
          ctx.restore();
        }
        ctx.restore();

        // 鏡写しコピー（Y軸反転で もう半分のミラーを再現）
        ctx.save();
        ctx.scale(1, -1);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, maxR, 0, wedgeAngle);
        ctx.closePath();
        ctx.clip();
        for (const chip of chips) {
          const rr = chip.radius * (0.92 + 0.08 * Math.sin(t * 0.0005 + chip.radiusPhase));
          ctx.save();
          ctx.translate(Math.cos(chip.angle) * rr, Math.sin(chip.angle) * rr);
          drawChip(ctx, chip, 1);
          ctx.restore();
        }
        ctx.restore();

        ctx.restore();
      }

      // ミラーの継ぎ目（12本の放射状ライン）を うっすら光らせて、
      // 「合わせ鏡でできている」対称性を目にはっきり見せる。
      ctx.globalCompositeOperation = 'lighter';
      for (let m = 0; m < MIRRORS * 2; m++) {
        const a = m * wedgeAngle;
        const lg = ctx.createLinearGradient(0, 0, Math.cos(a) * maxR, Math.sin(a) * maxR);
        lg.addColorStop(0, 'rgba(255,255,255,0.55)');
        lg.addColorStop(0.15, 'rgba(255,255,255,0.12)');
        lg.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(a) * maxR, Math.sin(a) * maxR);
        ctx.strokeStyle = lg;
        ctx.lineWidth = 1.4;
        ctx.stroke();
      }
      ctx.restore();

      // 中心の輝くコア（すべてのミラーが収束する光源。脈打つように明滅）
      ctx.globalCompositeOperation = 'lighter';
      const pulse = 0.6 + Math.sin(t * 0.0022) * 0.4;
      const baseHue = (t * 0.015) % 360;
      const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, maxR * 0.1 * (0.8 + pulse * 0.3));
      core.addColorStop(0, `hsla(${baseHue}, 100%, 94%, 0.95)`);
      core.addColorStop(0.5, `hsla(${(baseHue + 60) % 360}, 100%, 72%, 0.4)`);
      core.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = core;
      ctx.beginPath();
      ctx.arc(cx, cy, maxR * 0.12, 0, Math.PI * 2);
      ctx.fill();

      // きらめく光の粒（放射状に配置し、明滅させる）
      for (const s of sparkles) {
        s.tw += s.twSpeed;
        const r = s.dist * maxR;
        const x = cx + Math.cos(s.angle + spin * 0.6) * r;
        const y = cy + Math.sin(s.angle + spin * 0.6) * r;
        const a = 0.25 + Math.max(0, Math.sin(s.tw)) * 0.55;
        const hue = (baseHue + s.dist * 180) % 360;
        ctx.beginPath();
        ctx.arc(x, y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${hue}, 100%, 85%, ${a})`;
        ctx.fill();
      }

      ctx.globalCompositeOperation = 'source-over';

      // のぞき穴のふちを暗くまるく落として、筒をのぞいているような奥行きを出す
      const vign = ctx.createRadialGradient(cx, cy, maxR * 0.55, cx, cy, maxR * 0.92);
      vign.addColorStop(0, 'rgba(4,1,10,0)');
      vign.addColorStop(1, 'rgba(4,1,10,0.85)');
      ctx.fillStyle = vign;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
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
