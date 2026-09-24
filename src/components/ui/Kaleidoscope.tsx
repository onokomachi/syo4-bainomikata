/**
 * 時空神テーマ専用の背景：時空神（クロノス）の絵そのものを「色ガラス」にした、すき間のない荘厳な万華鏡。
 *
 * レイヤー構成（奥 → 手前）
 *   1) 画像万華鏡 … 本物の万華鏡と同じ「3枚鏡（正三角形）」方式。時空神の絵を正三角形に切り取り、
 *      回転＋鏡写しで六角形のロゼットを作り、それを平面いっぱいに敷き詰める。画面のどこを見ても
 *      合わせ鏡の対称もようになり、すき間は原理的にできない。鏡の継ぎ目には金のリード線（ステンドグラスの枠）。
 *      絵の上をのぞき位置がゆっくり旅するので、顔・時計・歯車・砂時計の破片が次々と模様になる。
 *   2) 時の渦 … 絵の中の「渦巻く光」をなぞる、楕円軌道の光の尾と、まわる懐中時計たち。
 *   3) 歯車 … 文字盤をとりまく大歯車と、四隅でかみ合うようにまわる金の歯車。
 *   4) ひび割れた時計の文字盤 … ローマ数字・目盛り・ひび（静的部分はオフスクリーンにキャッシュ）と、
 *      ゆっくり進む金の針。
 *   5) 時空神の顕現 … 一定周期で文字盤の中に時空神が浮かび上がり、また万華鏡へ溶けていく。
 *   6) 星屑 … 金と青白のきらめき。
 *
 * ベストプラクティス
 *   - 重い画像万華鏡は半分の解像度で描いて拡大（絵画的なやわらかさ＋描画コスト 1/4）。
 *   - 変化しない部分（文字盤・歯車の形・懐中時計・顕現用の丸抜き画像）は resize 時に1回だけ作って使い回す。
 *   - devicePixelRatio は 1.5 までに制限し、30fps に間引く（学校の Chromebook でも重くならないように）。
 *   - prefers-reduced-motion のときはアニメーションせず、時空神が見えている1枚絵だけを描く。
 *   - 画像の読み込み前も宇宙のグラデーションで画面を埋め、白や黒のすき間を見せない。
 * theme === 'kaleido' のときだけ描画する。
 */
import React, { useEffect, useRef } from 'react';
import { useSettingsStore } from '../../store/settingsStore';

const SRC = '/images/chronos.webp';

const TRI_H = Math.sqrt(3) / 2;    // 正三角形の高さ / 一辺
const OVERLAP = 1.012;             // 三角形・六角形をわずかに大きく描き、継ぎ目のすき間（AAの細線）を消す
const KALEIDO_SCALE = 0.5;         // 画像万華鏡は半解像度で描いて拡大
const FRAME_MS = 33;               // ~30fps
const APPEAR_PERIOD = 26000;       // 時空神が顕現する周期（ms）
const ROMAN = ['XII', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];

const smooth = (x: number) => x * x * (3 - 2 * x);

/** 顕現の強さ（0..1）。見えない → ふわっと現れる → しばらくとどまる → 万華鏡へ溶ける */
function appearAlpha(p: number) {
  if (p < 0.18) return 0;
  if (p < 0.34) return smooth((p - 0.18) / 0.16);
  if (p < 0.74) return 1;
  if (p < 0.92) return 1 - smooth((p - 0.74) / 0.18);
  return 0;
}

/** 再現性のある乱数（ひび割れの形を resize しても変えないため） */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 歯車の輪郭（歯＋中心の穴＋スポーク）を Path2D で作る */
function gearPath(r: number, teeth: number, depth: number, spokes: number) {
  const p = new Path2D();
  const step = (Math.PI * 2) / teeth;
  for (let i = 0; i < teeth; i++) {
    const a = i * step;
    const pts: [number, number][] = [
      [r - depth, a],
      [r, a + step * 0.18],
      [r, a + step * 0.48],
      [r - depth, a + step * 0.66],
    ];
    pts.forEach(([rr, aa], j) => {
      const x = Math.cos(aa) * rr;
      const y = Math.sin(aa) * rr;
      if (i === 0 && j === 0) p.moveTo(x, y);
      else p.lineTo(x, y);
    });
  }
  p.closePath();
  const rim = r - depth * 2.2;
  p.moveTo(rim, 0);
  p.arc(0, 0, rim, 0, Math.PI * 2);
  const hub = r * 0.18;
  p.moveTo(hub, 0);
  p.arc(0, 0, hub, 0, Math.PI * 2);
  for (let i = 0; i < spokes; i++) {
    const a = (i * Math.PI * 2) / spokes;
    p.moveTo(Math.cos(a) * hub, Math.sin(a) * hub);
    p.lineTo(Math.cos(a) * rim, Math.sin(a) * rim);
  }
  return p;
}

/** 金属の金色グラデーション（向きで光沢が変わる） */
function goldStroke(ctx: CanvasRenderingContext2D, r: number, angle = 0) {
  const g = ctx.createLinearGradient(Math.cos(angle) * -r, Math.sin(angle) * -r, Math.cos(angle) * r, Math.sin(angle) * r);
  g.addColorStop(0, '#7a5518');
  g.addColorStop(0.35, '#f6dc8e');
  g.addColorStop(0.55, '#c8912e');
  g.addColorStop(0.8, '#fff1bf');
  g.addColorStop(1, '#8a611d');
  return g;
}

/** 小さな懐中時計のスプライト（1回だけ描いて使い回す） */
function makeWatchSprite(size: number) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const x = c.getContext('2d')!;
  const r = size * 0.4;
  x.translate(size / 2, size / 2 + size * 0.04);
  // 竜頭
  x.fillStyle = '#d9ad52';
  x.fillRect(-size * 0.05, -r - size * 0.1, size * 0.1, size * 0.08);
  // 文字盤
  const face = x.createRadialGradient(-r * 0.3, -r * 0.3, 0, 0, 0, r);
  face.addColorStop(0, '#fffdf4');
  face.addColorStop(1, '#e6d6b0');
  x.fillStyle = face;
  x.beginPath();
  x.arc(0, 0, r, 0, Math.PI * 2);
  x.fill();
  x.lineWidth = size * 0.07;
  x.strokeStyle = goldStroke(x, r, 0.8);
  x.stroke();
  // 目盛り
  x.strokeStyle = '#5a4020';
  x.lineWidth = size * 0.018;
  for (let i = 0; i < 12; i++) {
    const a = (i * Math.PI) / 6;
    x.beginPath();
    x.moveTo(Math.cos(a) * r * 0.72, Math.sin(a) * r * 0.72);
    x.lineTo(Math.cos(a) * r * 0.86, Math.sin(a) * r * 0.86);
    x.stroke();
  }
  // 針
  x.lineCap = 'round';
  x.lineWidth = size * 0.035;
  x.beginPath();
  x.moveTo(0, 0);
  x.lineTo(r * 0.35, -r * 0.3);
  x.moveTo(0, 0);
  x.lineTo(-r * 0.1, -r * 0.66);
  x.stroke();
  return c;
}

interface Watch { orbit: number; angle: number; speed: number; size: number; spin: number; rot: number }
interface Star { x: number; y: number; r: number; tw: number; twSpeed: number; gold: boolean }
interface Gear { x: number; y: number; r: number; path: Path2D; speed: number; phase: number }

export const Kaleidoscope: React.FC = () => {
  const theme = useSettingsStore((s) => s.theme);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (theme !== 'kaleido') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

    // オフスクリーン
    const kc = document.createElement('canvas');   // 画像万華鏡（半解像度）
    const kctx = kc.getContext('2d')!;
    const wc = document.createElement('canvas');   // 1ミラー室ぶんの扇形
    const wctx = wc.getContext('2d')!;
    const dialC = document.createElement('canvas'); // 文字盤（静的）
    const appC = document.createElement('canvas');  // 顕現用の丸抜き時空神
    const watchSprite = makeWatchSprite(96);

    const img = new Image();
    img.decoding = 'async';
    let imgReady = false;

    let W = 0, H = 0, dpr = 1, cx = 0, cy = 0, Rd = 0, Rmax = 0;
    let gears: Gear[] = [];
    let ringGear: Gear | null = null;
    let watches: Watch[] = [];
    let stars: Star[] = [];
    let dimGrad: CanvasGradient | null = null;
    let t0 = -1;

    /** 文字盤の静的部分（盤面・リング・目盛り・ローマ数字・ひび）をキャッシュ */
    const buildDial = () => {
      const size = Math.ceil(Rd * 2.2);
      dialC.width = dialC.height = size;
      const x = dialC.getContext('2d')!;
      x.translate(size / 2, size / 2);

      // 盤面：中心がほの白く光る（絵の中の時計の後光）
      const face = x.createRadialGradient(0, 0, 0, 0, 0, Rd);
      face.addColorStop(0, 'rgba(225,238,255,0.30)');
      face.addColorStop(0.45, 'rgba(120,140,220,0.16)');
      face.addColorStop(0.85, 'rgba(18,12,52,0.42)');
      face.addColorStop(1, 'rgba(8,5,26,0.62)');
      x.fillStyle = face;
      x.beginPath();
      x.arc(0, 0, Rd, 0, Math.PI * 2);
      x.fill();

      // 金の二重リング
      x.shadowColor = 'rgba(255,205,110,0.55)';
      x.shadowBlur = Rd * 0.05;
      x.strokeStyle = goldStroke(x, Rd, -0.7);
      x.lineWidth = Rd * 0.035;
      x.beginPath();
      x.arc(0, 0, Rd, 0, Math.PI * 2);
      x.stroke();
      x.lineWidth = Rd * 0.01;
      x.beginPath();
      x.arc(0, 0, Rd * 0.92, 0, Math.PI * 2);
      x.stroke();
      x.beginPath();
      x.arc(0, 0, Rd * 0.66, 0, Math.PI * 2);
      x.globalAlpha = 0.5;
      x.stroke();
      x.globalAlpha = 1;
      x.shadowBlur = 0;

      // 目盛り（60本。5分ごとに太く）
      for (let i = 0; i < 60; i++) {
        const a = (i * Math.PI) / 30;
        const major = i % 5 === 0;
        x.strokeStyle = major ? '#f3d78c' : 'rgba(240,215,150,0.7)';
        x.lineWidth = major ? Rd * 0.012 : Rd * 0.005;
        x.beginPath();
        x.moveTo(Math.cos(a) * Rd * (major ? 0.935 : 0.95), Math.sin(a) * Rd * (major ? 0.935 : 0.95));
        x.lineTo(Math.cos(a) * Rd * 0.985, Math.sin(a) * Rd * 0.985);
        x.stroke();
      }

      // ローマ数字（放射状に並べる。絵の文字盤と同じ向き）
      const fs = Rd * 0.13;
      x.font = `700 ${fs}px "Cinzel", "Trajan Pro", "Times New Roman", "Noto Serif JP", serif`;
      x.textAlign = 'center';
      x.textBaseline = 'middle';
      ROMAN.forEach((n, i) => {
        const a = (i * Math.PI) / 6 - Math.PI / 2;
        x.save();
        x.translate(Math.cos(a) * Rd * 0.79, Math.sin(a) * Rd * 0.79);
        x.rotate(a + Math.PI / 2);
        x.fillStyle = 'rgba(10,6,24,0.75)';
        x.fillText(n, fs * 0.04, fs * 0.05);
        const g = x.createLinearGradient(0, -fs / 2, 0, fs / 2);
        g.addColorStop(0, '#fff3c8');
        g.addColorStop(0.5, '#e2b456');
        g.addColorStop(1, '#9c6b1f');
        x.fillStyle = g;
        x.fillText(n, 0, 0);
        x.restore();
      });

      // ひび割れ（時が裂けた文字盤）
      const rnd = mulberry32(4441);
      x.lineCap = 'round';
      for (let k = 0; k < 6; k++) {
        let a = rnd() * Math.PI * 2;
        let r = Rd * 0.99;
        const end = Rd * (0.3 + rnd() * 0.35);
        const pts: [number, number][] = [[Math.cos(a) * r, Math.sin(a) * r]];
        while (r > end) {
          r -= Rd * (0.05 + rnd() * 0.07);
          a += (rnd() - 0.5) * 0.22;
          pts.push([Math.cos(a) * r, Math.sin(a) * r]);
        }
        for (const [col, w, off] of [['rgba(4,2,14,0.7)', Rd * 0.012, 1.2], ['rgba(230,240,255,0.55)', Rd * 0.005, 0]] as const) {
          x.strokeStyle = col;
          x.lineWidth = w;
          x.beginPath();
          pts.forEach(([px, py], j) => (j ? x.lineTo(px + off, py + off) : x.moveTo(px + off, py + off)));
          x.stroke();
        }
      }
    };

    /** 顕現用：時空神の上半身を切り出して、ふちを円形にぼかしたスプライト */
    const buildApparition = () => {
      if (!imgReady) return;
      const Ra = Rd * 0.84;
      const size = Math.ceil(Ra * 2);
      appC.width = appC.height = size;
      const x = appC.getContext('2d')!;
      const iw = img.naturalWidth, ih = img.naturalHeight;
      const side = ih * 0.7;
      const sx = iw * 0.5 - side / 2;
      const sy = ih * 0.36 - side / 2;
      x.drawImage(img, sx, Math.max(0, sy), side, side, 0, 0, size, size);
      x.globalCompositeOperation = 'destination-in';
      const m = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
      m.addColorStop(0, 'rgba(0,0,0,1)');
      m.addColorStop(0.62, 'rgba(0,0,0,0.95)');
      m.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = m;
      x.fillRect(0, 0, size, size);
      x.globalCompositeOperation = 'source-over';
    };

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      W = Math.round(window.innerWidth * dpr);
      H = Math.round(window.innerHeight * dpr);
      canvas.width = W;
      canvas.height = H;
      kc.width = Math.max(1, Math.round(W * KALEIDO_SCALE));
      kc.height = Math.max(1, Math.round(H * KALEIDO_SCALE));
      cx = W / 2;
      cy = H / 2;
      const m = Math.min(W, H);
      Rmax = Math.hypot(W, H) / 2;
      Rd = m * (W > H ? 0.36 : 0.4);

      dimGrad = ctx.createRadialGradient(cx, cy, Rd * 0.6, cx, cy, Rmax);
      dimGrad.addColorStop(0, 'rgba(6,4,26,0.30)');
      dimGrad.addColorStop(0.6, 'rgba(6,4,26,0.48)');
      dimGrad.addColorStop(1, 'rgba(2,1,10,0.78)');

      ringGear = { x: cx, y: cy, r: Rd * 1.14, path: gearPath(Rd * 1.14, 96, Rd * 0.045, 0), speed: 0.00004, phase: 0 };
      const gr = m * 0.13;
      gears = [
        [0.1, 0.16, 1, 1], [0.9, 0.2, 0.8, -1], [0.07, 0.86, 0.9, -1], [0.93, 0.84, 1.15, 1],
        [0.24, 0.07, 0.5, -1], [0.78, 0.95, 0.55, -1],
      ].map(([fx, fy, s, dir], i) => ({
        x: W * fx, y: H * fy, r: gr * s,
        path: gearPath(gr * s, Math.round(14 + s * 10), gr * s * 0.16, 5 + (i % 2)),
        speed: (0.00018 / s) * dir, phase: i,
      }));

      watches = Array.from({ length: 11 }, (_, i) => ({
        orbit: 1.28 + (i % 4) * 0.16 + Math.random() * 0.08,
        angle: Math.random() * Math.PI * 2,
        speed: 0.00012 + Math.random() * 0.00012,
        size: m * (0.035 + Math.random() * 0.03),
        spin: (Math.random() - 0.5) * 0.001,
        rot: Math.random() * Math.PI * 2,
      }));

      const starCount = Math.min(140, Math.floor((W * H) / (16000 * dpr * dpr)));
      stars = Array.from({ length: starCount }, () => ({
        x: Math.random() * W,
        y: Math.random() * H,
        r: (0.6 + Math.random() * 1.6) * dpr,
        tw: Math.random() * Math.PI * 2,
        twSpeed: 0.02 + Math.random() * 0.05,
        gold: Math.random() < 0.45,
      }));

      buildDial();
      buildApparition();
      if (reduceMotion) drawFrame(APPEAR_PERIOD * 0.5, true);
    };

    /** 1) 画像万華鏡（3枚鏡）：正三角形 → 六角形ロゼット → 平面充填 */
    const tc = document.createElement('canvas'); // 正三角形1枚
    const tctx = tc.getContext('2d')!;
    const hc = document.createElement('canvas'); // 六角形ロゼット
    const hctx = hc.getContext('2d')!;
    const renderKaleido = (t: number) => {
      const KW = kc.width, KH = kc.height;
      const side = Math.max(KW, KH) * 0.3; // 三角形の一辺（大きいほど絵の破片が読み取れる）
      const pad = 3;

      // --- 正三角形（頂点 V=(0,0), A=(s,0), B=(s/2, s√3/2)）に絵を切り取る
      const tw = Math.ceil(side) + pad * 2;
      const th = Math.ceil(side * TRI_H) + pad * 2;
      if (tc.width !== tw || tc.height !== th) { tc.width = tw; tc.height = th; }
      tctx.setTransform(1, 0, 0, 1, 0, 0);
      tctx.clearRect(0, 0, tw, th);
      tctx.save();
      tctx.translate(pad, pad);
      const gx = side / 2, gy = (side * TRI_H) / 3; // 重心
      tctx.beginPath();
      [[0, 0], [side, 0], [side / 2, side * TRI_H]].forEach(([x, y], i) => {
        const ex = gx + (x - gx) * OVERLAP, ey = gy + (y - gy) * OVERLAP;
        if (i) tctx.lineTo(ex, ey); else tctx.moveTo(ex, ey);
      });
      tctx.closePath();
      tctx.clip();
      if (imgReady) {
        const iw = img.naturalWidth, ih = img.naturalHeight;
        // 三角形の全点は重心から 0.577s 以内。絵の中で半径 rImg の円が必ず絵の内側に収まるように
        // のぞき位置を動かせば、どう回しても すき間はできない。
        const rImg = ih * 0.28;
        const k = (0.6 * side) / rImg;
        const ix = iw / 2 + (iw / 2 - rImg) * 0.94 * Math.sin(t * 0.000041);
        const iy = ih / 2 + (ih / 2 - rImg) * 0.94 * Math.sin(t * 0.000029 + 1.3);
        tctx.translate(gx, gy);
        tctx.rotate(t * 0.00006);
        tctx.scale(k, k);
        tctx.drawImage(img, -ix, -iy);
      } else {
        const g = tctx.createLinearGradient(0, 0, side, side * TRI_H);
        g.addColorStop(0, '#2a1d6b');
        g.addColorStop(0.5, '#0d0930');
        g.addColorStop(1, '#3b2470');
        tctx.fillStyle = g;
        tctx.fillRect(-pad, -pad, tw, th);
      }
      tctx.restore();

      // --- 六角形ロゼット：頂点Vのまわりに 直接・鏡写し を交互に6枚（120°ずつ回転 × 2）
      const hs = Math.ceil(side) + pad;
      if (hc.width !== hs * 2 || hc.height !== hs * 2) { hc.width = hc.height = hs * 2; }
      hctx.setTransform(1, 0, 0, 1, hs, hs);
      hctx.clearRect(-hs, -hs, hs * 2, hs * 2);
      for (let m = 0; m < 3; m++) {
        hctx.save();
        hctx.rotate((m * 2 * Math.PI) / 3);
        hctx.drawImage(tc, -pad, -pad);
        hctx.scale(1, -1); // 鏡写し
        hctx.drawImage(tc, -pad, -pad);
        hctx.restore();
      }
      // 鏡の継ぎ目＝金のリード線（ステンドグラスの枠。荘厳さと継ぎ目の目隠しを兼ねる）
      hctx.strokeStyle = 'rgba(236,196,110,0.42)';
      hctx.lineWidth = Math.max(1, side * 0.006);
      hctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i * Math.PI) / 3;
        hctx.moveTo(0, 0);
        hctx.lineTo(Math.cos(a) * side, Math.sin(a) * side);
      }
      for (let i = 0; i <= 6; i++) {
        const a = (i * Math.PI) / 3;
        if (i) hctx.lineTo(Math.cos(a) * side, Math.sin(a) * side);
        else hctx.moveTo(side, 0);
      }
      hctx.stroke();

      // --- 平面充填：六角形の中心は一辺√3の三角格子。画面中心にロゼットの中心を合わせ、全体をゆっくり回す
      kctx.setTransform(1, 0, 0, 1, 0, 0);
      kctx.fillStyle = '#0a0724';
      kctx.fillRect(0, 0, KW, KH);
      kctx.translate(KW / 2, KH / 2);
      kctx.rotate(t * 0.000022);
      const reach = Math.hypot(KW, KH) / 2 + side;
      const ux = 1.5 * side, uy = side * TRI_H; // 格子ベクトル u
      const vy = side * 2 * TRI_H;              // 格子ベクトル v = (0, √3 s)
      const iMax = Math.ceil(reach / ux);
      const d = hs * 2 * OVERLAP;
      for (let i = -iMax; i <= iMax; i++) {
        const x = i * ux;
        const y0 = i * uy;
        const jMin = Math.floor((-reach - y0) / vy);
        const jMax = Math.ceil((reach - y0) / vy);
        for (let j = jMin; j <= jMax; j++) {
          kctx.drawImage(hc, x - d / 2, y0 + j * vy - d / 2, d, d);
        }
      }
    };

    const drawGear = (g: Gear, t: number, alpha: number) => {
      const rot = g.phase + t * g.speed;
      ctx.save();
      ctx.translate(g.x, g.y);
      ctx.rotate(rot);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = 'rgba(46,30,8,0.55)';
      ctx.fill(g.path, 'evenodd');
      ctx.strokeStyle = goldStroke(ctx, g.r, -rot - 0.8);
      ctx.lineWidth = Math.max(1.2, g.r * 0.022);
      ctx.stroke(g.path);
      ctx.restore();
    };

    const drawHand = (angle: number, len: number, width: number) => {
      ctx.save();
      ctx.rotate(angle);
      ctx.beginPath();
      ctx.moveTo(-width * 0.6, len * 0.14);
      ctx.lineTo(-width * 0.35, -len * 0.62);
      ctx.lineTo(-width * 1.4, -len * 0.74); // スペード型の飾り
      ctx.lineTo(0, -len);
      ctx.lineTo(width * 1.4, -len * 0.74);
      ctx.lineTo(width * 0.35, -len * 0.62);
      ctx.lineTo(width * 0.6, len * 0.14);
      ctx.closePath();
      ctx.fillStyle = goldStroke(ctx, len, 1.2);
      ctx.shadowColor = 'rgba(0,0,0,0.6)';
      ctx.shadowBlur = width * 2;
      ctx.fill();
      ctx.restore();
    };

    const drawFrame = (t: number, still = false) => {
      // 1) 画像万華鏡（すき間なし）→ 拡大して全面に敷く → 荘厳さと可読性のための陰影
      renderKaleido(t);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(kc, 0, 0, W, H);
      if (dimGrad) {
        ctx.fillStyle = dimGrad;
        ctx.fillRect(0, 0, W, H);
      }

      const p = (((t - (t0 < 0 ? 0 : t0)) + APPEAR_PERIOD * 0.12) % APPEAR_PERIOD) / APPEAR_PERIOD;
      const appear = still ? 1 : appearAlpha(p);

      // 2) 時の渦：楕円軌道の光の尾（'lighter' で発光）
      ctx.save();
      ctx.translate(cx, cy);
      ctx.globalCompositeOperation = 'lighter';
      for (let s = 0; s < 3; s++) {
        const head = t * (0.00032 + s * 0.00007) + s * 2.1;
        const rx = Rd * (1.42 + s * 0.16);
        const ry = Rd * (0.5 + s * 0.08);
        const tilt = -0.42 + s * 0.3;
        const segs = 26;
        for (let i = 0; i < segs; i++) {
          const a0 = head - (i + 1) * 0.07;
          const a1 = head - i * 0.07;
          const fade = 1 - i / segs;
          ctx.beginPath();
          ctx.ellipse(0, 0, rx, ry, tilt, a0, a1);
          ctx.strokeStyle = `rgba(${s === 1 ? '255,214,140' : '170,210,255'},${0.55 * fade * fade})`;
          ctx.lineWidth = (1 + 3.2 * fade) * dpr;
          ctx.stroke();
        }
      }
      ctx.restore();

      // 3) 歯車（四隅＋文字盤をとりまく大歯車）
      for (const g of gears) drawGear(g, t, 0.85);
      if (ringGear) drawGear(ringGear, t, 0.9);

      // まわる懐中時計（奥のものは小さく暗く → 立体的な渦）
      for (const w of watches) {
        w.angle += reduceMotion ? 0 : w.speed * FRAME_MS;
        w.rot += reduceMotion ? 0 : w.spin * FRAME_MS;
        const tilt = -0.42;
        const ex = Math.cos(w.angle) * Rd * w.orbit * 1.12;
        const ey = Math.sin(w.angle) * Rd * w.orbit * 0.42;
        const x = cx + ex * Math.cos(tilt) - ey * Math.sin(tilt);
        const y = cy + ex * Math.sin(tilt) + ey * Math.cos(tilt);
        const depth = 0.65 + 0.35 * Math.sin(w.angle);
        const s = w.size * depth;
        ctx.save();
        ctx.globalAlpha = 0.45 + 0.5 * depth;
        ctx.translate(x, y);
        ctx.rotate(w.rot);
        ctx.drawImage(watchSprite, -s, -s, s * 2, s * 2);
        ctx.restore();
      }

      // 4) ひび割れた文字盤（キャッシュ）＋針
      ctx.save();
      ctx.translate(cx, cy);
      ctx.drawImage(dialC, -dialC.width / 2, -dialC.height / 2);
      drawHand(t * 0.000011, Rd * 0.5, Rd * 0.028);
      drawHand(t * 0.00013 + 1.7, Rd * 0.74, Rd * 0.02);
      ctx.restore();

      // 5) 時空神の顕現：後光がひろがり、文字盤の中に浮かび上がる
      if (appear > 0.001) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, Rd * 1.3);
        halo.addColorStop(0, `rgba(200,225,255,${0.32 * appear})`);
        halo.addColorStop(0.5, `rgba(150,120,255,${0.14 * appear})`);
        halo.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = halo;
        ctx.fillRect(cx - Rd * 1.3, cy - Rd * 1.3, Rd * 2.6, Rd * 2.6);
        ctx.restore();
        if (imgReady && appC.width > 0) {
          const breathe = 1 + 0.015 * Math.sin(t * 0.0012);
          const s = (appC.width / 2) * (0.94 + 0.06 * appear) * breathe;
          ctx.save();
          ctx.globalAlpha = 0.95 * appear;
          ctx.drawImage(appC, cx - s, cy - s, s * 2, s * 2);
          ctx.restore();
        }
      }

      // 中心の宝珠（針の軸）
      const boss = ctx.createRadialGradient(cx - Rd * 0.01, cy - Rd * 0.01, 0, cx, cy, Rd * 0.05);
      boss.addColorStop(0, '#fff6d8');
      boss.addColorStop(0.5, '#d9a441');
      boss.addColorStop(1, '#5e3f10');
      ctx.fillStyle = boss;
      ctx.beginPath();
      ctx.arc(cx, cy, Rd * 0.045, 0, Math.PI * 2);
      ctx.fill();

      // 6) 星屑
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (const s of stars) {
        if (!still) s.tw += s.twSpeed;
        const a = 0.2 + Math.max(0, Math.sin(s.tw)) * 0.75;
        ctx.fillStyle = s.gold ? `rgba(255,214,130,${a})` : `rgba(190,220,255,${a})`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
        if (a > 0.85 && s.r > 1.6 * dpr) {
          // 強くまたたく星は十字の光条
          ctx.fillRect(s.x - s.r * 4, s.y - 0.5 * dpr, s.r * 8, dpr);
          ctx.fillRect(s.x - 0.5 * dpr, s.y - s.r * 4, dpr, s.r * 8);
        }
      }
      ctx.restore();
    };

    img.onload = () => {
      imgReady = true;
      buildApparition();
      if (reduceMotion) drawFrame(APPEAR_PERIOD * 0.5, true);
    };
    img.src = SRC;

    resize();
    window.addEventListener('resize', resize);

    let raf = 0;
    let last = 0;
    const loop = (t: number) => {
      raf = requestAnimationFrame(loop);
      if (t - last < FRAME_MS) return;
      last = t;
      if (t0 < 0) t0 = t;
      drawFrame(t);
    };
    if (!reduceMotion) raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      img.onload = null;
    };
  }, [theme]);

  if (theme !== 'kaleido') return null;

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="fixed inset-0 w-full h-full pointer-events-none z-0"
      style={{ willChange: 'transform', transform: 'translateZ(0)' }}
    />
  );
};
