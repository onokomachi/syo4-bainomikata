/**
 * 神域の試練 ── この単元の中で、自分がどこまで確実にできるかを測る。
 *
 *   極限 … やさしい層から登る。各層2問、同じ層で2回まちがえたら止まる。
 *   無限 … 神座に1度たどりついた子だけ。3回まちがえるまで挑み続ける。
 *
 * 1問は「ノーミスで解けたら正解」。1回まちがえた時点でその問題は×にして次へ進む
 * （測る場面なので、ヒントを見ながらの正解は数えない）。
 *
 * 刻印・今の層・予想点のしくみは learning-app-kit/trial。記録は端末に保存し、
 * 学級コードがあればサーバにも送る。アプリの学習ログには入れない。
 * 始めるときは必ずソロに切り替える（ペアの力で層を上げないように）。
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import confetti from 'canvas-confetti';
import { ChevronLeft, Lock, Infinity as InfinityIcon, Mountain, Sparkles, Flag, Target } from 'lucide-react';
import {
  startClimb, answerClimb, pickClimbSkill, startEndless, answerEndless, pickEndless,
  summarize, predictScore, nextGain, saveTrial, syncTrialsFromServer, flushTrials, loadTrials,
  SEAL_COUNT, MISSES_TO_STOP, ENDLESS_MISSES, QUESTIONS_PER_FLOOR,
  type ClimbState, type EndlessState, type TrialRecord,
} from 'learning-app-kit/trial';
import { forceSolo } from 'learning-app-kit/sync';
import { FLOORS, FLOOR_COUNT, TEST_REQS, TEST_MAX, floorName } from '../../lib/trialConfig';
import {
  generateTimes, generateCompare, generateBase, generateRatioCompare, generateWord,
  type TimesLevel, type CompareLevel, type BaseLevel, type RatioCompareLevel, type WordLevel,
} from '../../lib/problems';
import type { TestProblem } from '../../lib/testConfig';
import { skillToModuleId, type ModuleId } from '../../store/progressStore';
import { playClear, playCorrect, playSoftTry } from '../../lib/sound';
import { TimesRound } from './TimesModule';
import { CompareRound } from './CompareModule';
import { BaseRound } from './BaseModule';
import { RatioCompareRound } from './RatioCompareModule';
import { WordRound } from './WordProblemModule';

const SYNC = {
  appId: 'bai',
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL as string | undefined,
  supabaseKey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined,
};

/** 層の記号 → 問題。練習モードと同じ生成器を使う（練習で解ける問題は試練でも解ける） */
function genProblem(skillId: string): TestProblem {
  if (skillId.startsWith('times-')) return { kind: 'times', level: skillId as TimesLevel, p: generateTimes(skillId as TimesLevel) };
  if (skillId.startsWith('compare-')) return { kind: 'compare', level: skillId as CompareLevel, p: generateCompare(skillId as CompareLevel) };
  if (skillId.startsWith('base-')) return { kind: 'base', level: skillId as BaseLevel, p: generateBase(skillId as BaseLevel) };
  if (skillId.startsWith('ratio-compare-')) return { kind: 'ratio', level: skillId as RatioCompareLevel, p: generateRatioCompare(skillId as RatioCompareLevel) };
  return { kind: 'word', level: skillId as WordLevel, p: generateWord(skillId as WordLevel) };
}

type Phase = 'HOME' | 'CLIMB' | 'ENDLESS' | 'RESULT';
interface Q { floor: number; skillId: string; tp: TestProblem; key: number }
type Flash = { kind: 'ok' | 'ng' | 'clear' | 'skip'; text: string } | null;

interface Props {
  onExit: () => void;
  /** 結果から「やるべき層」の練習へ飛ぶ */
  onPractice: (id: ModuleId) => void;
}

export const TrialModule: React.FC<Props> = ({ onExit, onPractice }) => {
  const [records, setRecords] = useState<TrialRecord[]>(() => loadTrials(SYNC.appId));
  const [phase, setPhase] = useState<Phase>('HOME');
  const [climb, setClimb] = useState<ClimbState | null>(null);
  const [endless, setEndless] = useState<EndlessState | null>(null);
  const [q, setQ] = useState<Q | null>(null);
  const [flash, setFlash] = useState<Flash>(null);
  const [soloNotice, setSoloNotice] = useState(false);
  const [last, setLast] = useState<TrialRecord | null>(null);
  const [prevSummary, setPrevSummary] = useState<ReturnType<typeof summarize> | null>(null);
  const locked = useRef(false);
  const keyRef = useRef(0);

  // 端末のデータが消えていても、学級コードがあればサーバから取り戻す
  useEffect(() => {
    void syncTrialsFromServer(SYNC).then(setRecords);
    void flushTrials(SYNC);
  }, []);

  const sum = useMemo(() => summarize(records, FLOOR_COUNT), [records]);

  const nextQuestion = (floor: number, skillId: string) => {
    keyRef.current += 1;
    locked.current = false;
    setQ({ floor, skillId, tp: genProblem(skillId), key: keyRef.current });
  };

  const begin = (mode: '極限' | '無限') => {
    // 測る場面はソロで。ペアのままなら切り替え、そのことを知らせる
    if (forceSolo()) { setSoloNotice(true); setTimeout(() => setSoloNotice(false), 2600); }
    setPrevSummary(sum);
    setFlash(null);
    if (mode === '極限') {
      const s = startClimb(FLOOR_COUNT);
      setClimb(s); setEndless(null); setPhase('CLIMB');
      nextQuestion(0, pickClimbSkill(s, FLOORS));
    } else {
      const s = startEndless();
      setEndless(s); setClimb(null); setPhase('ENDLESS');
      const n = pickEndless(s, FLOORS);
      nextQuestion(n.floor, n.skillId);
    }
  };

  const finish = async (mode: '極限' | '無限', cleared: number, score: number) => {
    const rec = await saveTrial(SYNC, { mode, floor: cleared, floors: FLOOR_COUNT, score, soloComplete: true });
    setLast(rec);
    setRecords(loadTrials(SYNC.appId));
    setPhase('RESULT');
    if (mode === '極限' && cleared >= FLOOR_COUNT) {
      playClear();
      confetti({ particleCount: 160, spread: 90, origin: { y: 0.4 }, colors: ['#67e8f9', '#f0abfc', '#fde68a'] });
    }
  };

  /** 1問の決着。ノーミスで解けたら○、1回でもまちがえたら×（その場で次へ） */
  const settle = (correct: boolean) => {
    if (locked.current || !q) return;
    locked.current = true;
    if (correct) playCorrect(); else playSoftTry();

    if (phase === 'CLIMB' && climb) {
      const next = answerClimb(climb, q.skillId, correct);
      setClimb(next);
      const clearedNow = next.cleared > climb.cleared;
      const skipped = next.skipped.length > climb.skipped.length;
      setFlash(
        skipped ? { kind: 'skip', text: `第${FLOORS[climb.at]!.numeral}層 突破 ── 第${FLOORS[next.skipped[next.skipped.length - 1]!]!.numeral}層を 越えた` }
          : clearedNow ? { kind: 'clear', text: `第${FLOORS[climb.at]!.numeral}層 突破` }
            : { kind: correct ? 'ok' : 'ng', text: correct ? '正解' : 'ミス' },
      );
      setTimeout(() => {
        setFlash(null);
        if (next.done) { void finish('極限', next.cleared, 0); return; }
        nextQuestion(next.at, pickClimbSkill(next, FLOORS));
      }, clearedNow ? 1100 : 650);
      return;
    }

    if (phase === 'ENDLESS' && endless) {
      const next = answerEndless(endless, q.floor, q.skillId, correct);
      setEndless(next);
      setFlash({ kind: correct ? 'ok' : 'ng', text: correct ? `+1　${next.score}` : 'ミス' });
      setTimeout(() => {
        setFlash(null);
        if (next.done) { void finish('無限', FLOOR_COUNT, next.score); return; }
        const n = pickEndless(next, FLOORS);
        nextQuestion(n.floor, n.skillId);
      }, 650);
    }
  };

  const quit = () => {
    // 途中でやめた回は記録しない（刻印にも今の層にも数えない）
    setPhase('HOME'); setClimb(null); setEndless(null); setQ(null); setFlash(null);
  };

  /* ---------------- 出題 ---------------- */
  const renderRound = (qq: Q) => {
    const focus = FLOORS[qq.floor]?.focus ?? 'full';
    const common = {
      onNext: () => {},
      onResult: (perfect: boolean) => settle(perfect),
      onMiss: () => settle(false),
      nextLabel: 'つぎへ',
    };
    const tp = qq.tp;
    switch (tp.kind) {
      case 'times': return <TimesRound key={qq.key} {...common} focus={focus} level={tp.level} problem={tp.p} />;
      case 'compare': return <CompareRound key={qq.key} {...common} focus={focus} level={tp.level} problem={tp.p} />;
      case 'base': return <BaseRound key={qq.key} {...common} focus={focus} level={tp.level} problem={tp.p} />;
      case 'ratio': return <RatioCompareRound key={qq.key} {...common} focus={focus} level={tp.level} problem={tp.p} />;
      case 'word': return <WordRound key={qq.key} {...common} level={tp.level} problem={tp.p} />;
      default: return null;
    }
  };

  /* ---------------- HOME ---------------- */
  if (phase === 'HOME') {
    return (
      <Shell onBack={onExit} backLabel="倍の見方ラボへ">
        <Title />
        <StatusPanel sum={sum} />
        <Tower sum={sum} />
        <div className="grid gap-3 mt-6">
          <ModeButton icon={<Mountain size={26} />} title="極限" sub="やさしい層から登り、どこまで確実にできるかを測る（10分ほど）"
            tone="cyan" onClick={() => begin('極限')} />
          <ModeButton icon={sum.endlessUnlocked ? <InfinityIcon size={26} /> : <Lock size={22} />} title="無限"
            sub={sum.endlessUnlocked
              ? `まちがえるまで 挑み続ける（${ENDLESS_MISSES}回ミスで終了）　最高 ${sum.endlessBest}`
              : '極限で 神座に たどりつくと 解放される'}
            tone="fuchsia" disabled={!sum.endlessUnlocked} onClick={() => begin('無限')} />
        </div>
        <Rules />
      </Shell>
    );
  }

  /* ---------------- RESULT ---------------- */
  if (phase === 'RESULT' && last) {
    return (
      <Shell onBack={() => setPhase('HOME')} backLabel="神域の試練へ">
        <ResultPanel last={last} sum={sum} prev={prevSummary} onPractice={onPractice} onRetry={() => begin(last.mode)} />
      </Shell>
    );
  }

  /* ---------------- CLIMB / ENDLESS ---------------- */
  const inClimb = phase === 'CLIMB' && climb;
  const floorIdx = q?.floor ?? 0;
  return (
    <div className="w-full h-full flex flex-col bg-[#04070f] text-white">
      <div className="shrink-0 border-b border-white/10 bg-[#070b16]/90 backdrop-blur px-4 py-3">
        <div className="max-w-5xl mx-auto flex items-center gap-3">
          <button onClick={quit} className="flex items-center gap-1 text-white/60 hover:text-white font-bold px-2 py-1.5 rounded-lg hover:bg-white/10 transition-colors shrink-0">
            <ChevronLeft size={20} /> やめる
          </button>
          <span className="px-3 py-1 rounded-full text-xs font-black shrink-0 bg-cyan-400/15 text-cyan-200 border border-cyan-300/30 tracking-[0.2em]">
            {inClimb ? '極限' : '無限'}
          </span>
          <div className="font-black truncate">
            <span className="text-cyan-200">第{FLOORS[floorIdx]?.numeral}層</span>
            <span className="text-white/50 font-bold ml-2 text-sm">{FLOORS[floorIdx]?.label}</span>
          </div>
          <div className="ml-auto flex items-center gap-3 shrink-0">
            {inClimb ? (
              <>
                <Pips label="正解" n={climb.correct} max={QUESTIONS_PER_FLOOR} on="bg-cyan-300" />
                <Pips label="ミス" n={climb.misses} max={MISSES_TO_STOP} on="bg-rose-400" />
              </>
            ) : endless ? (
              <>
                <span className="text-sm font-black text-fuchsia-200 tabular-nums">{endless.score}</span>
                <Pips label="ミス" n={endless.misses} max={ENDLESS_MISSES} on="bg-rose-400" />
              </>
            ) : null}
            <button onClick={() => settle(false)}
              className="px-3 py-1.5 rounded-lg text-xs font-black text-white/60 border border-white/15 hover:text-white hover:border-white/40 transition">
              わからない
            </button>
          </div>
        </div>
        {inClimb && <ClimbBar climb={climb} />}
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-4 py-6">
          {/* 練習と同じ出題画面を、明るい面の上に置く（読みやすさを優先） */}
          <div className="rounded-[28px] bg-bg text-content p-2 sm:p-4 shadow-[0_0_60px_-20px_rgba(103,232,249,0.45)]">
            {q && renderRound(q)}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {flash && (
          <motion.div key={flash.text} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 grid place-items-center pointer-events-none">
            <div className={`px-8 py-4 rounded-3xl font-black text-2xl sm:text-3xl tracking-wide backdrop-blur border ${
              flash.kind === 'ng' ? 'bg-rose-950/70 text-rose-200 border-rose-400/40'
                : flash.kind === 'ok' ? 'bg-cyan-950/70 text-cyan-100 border-cyan-300/40'
                  : 'bg-[#0b1024]/85 text-amber-100 border-amber-200/50 shadow-[0_0_60px_-10px_rgba(253,230,138,0.6)]'}`}>
              {flash.text}
            </div>
          </motion.div>
        )}
        {soloNotice && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="fixed top-20 left-1/2 -translate-x-1/2 z-40 px-4 py-2 rounded-xl bg-[#0b1024] border border-cyan-300/40 text-cyan-100 text-sm font-black">
            試練は ひとりで。SOLO に きりかえたよ
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

/* ================================================================== */
/* 部品                                                                */
/* ================================================================== */

const Shell: React.FC<{ onBack: () => void; backLabel: string; children: React.ReactNode }> = ({ onBack, backLabel, children }) => (
  <div className="w-full h-full overflow-y-auto bg-[radial-gradient(ellipse_at_top,#101a36_0%,#04070f_60%)] text-white">
    <div className="max-w-2xl mx-auto px-4 py-6">
      <button onClick={onBack} className="flex items-center gap-2 text-white/60 hover:text-white font-bold px-3 py-2 rounded-xl hover:bg-white/10 transition-colors mb-2">
        <ChevronLeft size={22} /> {backLabel}
      </button>
      {children}
    </div>
  </div>
);

const Title: React.FC = () => (
  <div className="text-center mt-2 mb-6">
    <p className="text-[11px] tracking-[0.5em] text-cyan-300/80 font-black">SANCTUM TRIAL</p>
    <h1 className="text-4xl font-black mt-2 bg-gradient-to-b from-white to-cyan-200 bg-clip-text text-transparent">神域の試練</h1>
    <p className="text-white/60 font-bold text-sm mt-2">いまの 自分が、どの層まで 確実に 登れるか</p>
  </div>
);

const StatusPanel: React.FC<{ sum: ReturnType<typeof summarize> }> = ({ sum }) => {
  const base = sum.sealed;                       // 予想点は刻印（確かな力）で出す
  const predicted = predictScore(TEST_REQS, base);
  const today = sum.current ?? 0;
  const todayPred = predictScore(TEST_REQS, today);
  const gain = nextGain(TEST_REQS, base, FLOOR_COUNT);
  return (
    <div className="grid grid-cols-3 gap-2.5">
      <Stat label="今の層" value={sum.current === null ? '—' : floorName(sum.current)} sub="いちばん新しい 極限" />
      <Stat label="刻印" value={sum.sealed ? floorName(sum.sealed) : 'なし'}
        sub={sum.nextSeal ? `${floorName(sum.nextSeal.floor)}まで ${Math.min(sum.nextSeal.count, SEAL_COUNT)}/${SEAL_COUNT}` : '全層に刻印'} glow />
      <Stat label="テスト予想" value={`${predicted}`} unit={`/${TEST_MAX}`}
        sub={gain ? `${floorName(gain.floor)}に刻印で +${gain.gain}点` : 'これ以上は 上がらない'} />
      {sum.current !== null && todayPred !== predicted && (
        <p className="col-span-3 text-[11px] text-white/50 font-bold text-center">
          今日の結果（{floorName(today)}）なら {todayPred}点。刻印がそろうと 予想に入るよ
        </p>
      )}
    </div>
  );
};

const Stat: React.FC<{ label: string; value: string; unit?: string; sub?: string; glow?: boolean }> = ({ label, value, unit, sub, glow }) => (
  <div className={`rounded-2xl px-3 py-3 bg-white/[0.04] border ${glow ? 'border-amber-200/40 shadow-[0_0_30px_-14px_rgba(253,230,138,0.8)]' : 'border-white/10'}`}>
    <p className="text-[10px] tracking-[0.2em] text-white/50 font-black">{label}</p>
    <p className="text-lg sm:text-xl font-black mt-1 leading-tight">
      {value}{unit && <span className="text-xs text-white/50 ml-0.5">{unit}</span>}
    </p>
    {sub && <p className="text-[10px] text-white/50 font-bold mt-1 leading-snug">{sub}</p>}
  </div>
);

/** 塔。上が神座。刻印・ベスト・今の層に印を付ける */
const Tower: React.FC<{ sum: ReturnType<typeof summarize> }> = ({ sum }) => {
  const rows = [{ idx: FLOOR_COUNT, numeral: '神座', label: '全層を 突破した者の 座' },
    ...FLOORS.map((f, i) => ({ idx: i, numeral: `第${f.numeral}層`, label: f.label })).reverse()];
  return (
    <div className="mt-6 rounded-[24px] border border-white/10 bg-white/[0.02] p-3 space-y-1.5">
      {rows.map((r) => {
        // 神座: 全層突破。それ以外: その層を突破しているか（idx < 層数）
        const isThrone = r.idx === FLOOR_COUNT;
        const need = isThrone ? FLOOR_COUNT : r.idx + 1;
        const sealed = sum.sealed >= need;
        const best = sum.best >= need;
        // 「いま」は、いちばん新しい極限で突破した最も高い層（上の「今の層」と同じ層）に付ける
        const here = sum.current !== null && sum.current >= 1
          && (isThrone ? sum.current >= FLOOR_COUNT : sum.current < FLOOR_COUNT && sum.current - 1 === r.idx);
        return (
          <div key={r.numeral}
            className={`flex items-center gap-3 rounded-xl px-3 py-2 border transition ${
              sealed ? 'border-amber-200/50 bg-amber-100/[0.06]'
                : best ? 'border-cyan-300/30 bg-cyan-300/[0.05]' : 'border-white/5 bg-transparent'}`}>
            <span className={`w-16 shrink-0 font-black text-sm ${sealed ? 'text-amber-100' : best ? 'text-cyan-200' : 'text-white/35'}`}>{r.numeral}</span>
            <span className={`flex-1 min-w-0 truncate text-xs font-bold ${best ? 'text-white/80' : 'text-white/35'}`}>{r.label}</span>
            {sealed && <span className="text-[10px] font-black text-amber-200 tracking-widest flex items-center gap-1"><Sparkles size={12} />刻印</span>}
            {here && <span className="text-[10px] font-black text-cyan-200 tracking-widest flex items-center gap-1"><Flag size={12} />いま</span>}
          </div>
        );
      })}
    </div>
  );
};

const ModeButton: React.FC<{ icon: React.ReactNode; title: string; sub: string; tone: 'cyan' | 'fuchsia'; disabled?: boolean; onClick: () => void }> =
  ({ icon, title, sub, tone, disabled, onClick }) => (
    <motion.button whileHover={disabled ? undefined : { y: -2 }} whileTap={disabled ? undefined : { scale: 0.99 }}
      onClick={() => !disabled && onClick()} disabled={disabled}
      className={`w-full text-left p-4 rounded-[22px] border flex items-center gap-4 transition ${
        disabled ? 'border-white/10 bg-white/[0.02] text-white/40 cursor-not-allowed'
          : tone === 'cyan' ? 'border-cyan-300/40 bg-cyan-400/[0.08] hover:bg-cyan-400/[0.14] shadow-[0_0_40px_-18px_rgba(103,232,249,0.9)]'
            : 'border-fuchsia-300/40 bg-fuchsia-400/[0.08] hover:bg-fuchsia-400/[0.14] shadow-[0_0_40px_-18px_rgba(240,171,252,0.9)]'}`}>
      <div className={`w-12 h-12 rounded-2xl grid place-items-center shrink-0 ${disabled ? 'bg-white/5' : tone === 'cyan' ? 'bg-cyan-300/15 text-cyan-200' : 'bg-fuchsia-300/15 text-fuchsia-200'}`}>{icon}</div>
      <div className="min-w-0">
        <div className="text-2xl font-black tracking-[0.3em]">{title}</div>
        <div className="text-xs font-bold opacity-70 mt-0.5">{sub}</div>
      </div>
    </motion.button>
  );

const Rules: React.FC = () => (
  <div className="mt-6 text-[11px] leading-relaxed text-white/45 font-bold space-y-1">
    <p>・各層 {QUESTIONS_PER_FLOOR}問。ノーミスで解けた問題だけが 正解。同じ層で {MISSES_TO_STOP}回 まちがえたら そこで止まる。</p>
    <p>・2層つづけて ノーミスなら、次の層を 飛びこえる（最後の層は 必ず解く）。</p>
    <p>・その層まで 届いた回が 通算{SEAL_COUNT}回に なると「刻印」。ひとりで 最後まで やった回だけ 数える。</p>
    <p>・「今の層」は いちばん新しい結果。下がることも ある。刻印は 消えない。</p>
  </div>
);

const Pips: React.FC<{ label: string; n: number; max: number; on: string }> = ({ label, n, max, on }) => (
  <span className="flex items-center gap-1" title={label} aria-label={`${label} ${n}/${max}`}>
    {Array.from({ length: max }, (_, i) => (
      <span key={i} className={`w-2.5 h-2.5 rounded-full ${i < n ? on : 'bg-white/15'}`} />
    ))}
  </span>
);

const ClimbBar: React.FC<{ climb: ClimbState }> = ({ climb }) => (
  <div className="max-w-5xl mx-auto mt-2 flex gap-1">
    {FLOORS.map((f, i) => (
      <div key={f.numeral} className={`h-1.5 flex-1 rounded-full ${
        i < climb.cleared ? (climb.skipped.includes(i) ? 'bg-amber-200/70' : 'bg-cyan-300') : i === climb.at ? 'bg-cyan-300/40' : 'bg-white/10'}`} />
    ))}
  </div>
);

const ResultPanel: React.FC<{
  last: TrialRecord; sum: ReturnType<typeof summarize>; prev: ReturnType<typeof summarize> | null;
  onPractice: (id: ModuleId) => void; onRetry: () => void;
}> = ({ last, sum, prev, onPractice, onRetry }) => {
  const newSeal = prev && sum.sealed > prev.sealed;
  if (last.mode === '無限') {
    const best = prev ? last.score > prev.endlessBest : true;
    return (
      <div className="text-center mt-6">
        <p className="text-[11px] tracking-[0.5em] text-fuchsia-300/80 font-black">INFINITE</p>
        <p className="text-6xl font-black mt-3 tabular-nums">{last.score}</p>
        <p className="text-white/60 font-bold mt-2">{best ? '自己ベスト 更新！' : `自己ベスト ${sum.endlessBest}`}</p>
        <button onClick={onRetry} className="mt-8 px-6 py-3 rounded-2xl font-black bg-fuchsia-400/15 border border-fuchsia-300/40 hover:bg-fuchsia-400/25 transition">もう一度 挑む</button>
      </div>
    );
  }
  // 次にやるべき層＝止まった層。そこで出る問題の練習へ飛ばす
  const stuck = last.floor < FLOOR_COUNT ? FLOORS[last.floor]! : null;
  const practiceId = stuck ? skillToModuleId(stuck.skills[0]!) : null;
  const gain = nextGain(TEST_REQS, sum.sealed, FLOOR_COUNT);
  return (
    <div className="mt-4">
      <div className="text-center">
        <p className="text-[11px] tracking-[0.5em] text-cyan-300/80 font-black">RESULT</p>
        <p className="text-5xl font-black mt-3">
          {last.floor >= FLOOR_COUNT ? '神座' : last.floor === 0 ? '第Ⅰ層で 止まった' : `第${FLOORS[last.floor - 1]!.numeral}層 突破`}
        </p>
        {last.floor !== 0 && (
          <p className="text-white/60 font-bold mt-2">
            {last.floor >= FLOOR_COUNT ? '全層を 突破した。無限が ひらく。' : `第${FLOORS[last.floor]!.numeral}層で 止まった`}
          </p>
        )}
        {newSeal && (
          <motion.p initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            className="inline-flex items-center gap-2 mt-4 px-4 py-2 rounded-full border border-amber-200/60 bg-amber-100/10 text-amber-100 font-black shadow-[0_0_40px_-10px_rgba(253,230,138,0.8)]">
            <Sparkles size={16} /> {floorName(sum.sealed)} に 刻印
          </motion.p>
        )}
      </div>

      <div className="mt-6"><StatusPanel sum={sum} /></div>

      {stuck && (
        <div className="mt-6 rounded-[22px] border border-cyan-300/30 bg-cyan-400/[0.06] p-4">
          <p className="text-xs font-black text-cyan-200 flex items-center gap-1.5"><Target size={14} /> いま やるべきこと</p>
          <p className="text-lg font-black mt-1">第{stuck.numeral}層：{stuck.label}</p>
          {gain && <p className="text-xs text-white/60 font-bold mt-1">{floorName(gain.floor)}に 刻印が そろうと、テスト予想が +{gain.gain}点</p>}
          {practiceId && (
            <button onClick={() => onPractice(practiceId)}
              className="mt-3 w-full py-3 rounded-2xl font-black bg-cyan-300 text-[#04070f] hover:opacity-90 transition">
              この層の れんしゅうへ
            </button>
          )}
        </div>
      )}

      <div className="mt-4 flex gap-3">
        <button onClick={onRetry} className="flex-1 py-3 rounded-2xl font-black border border-white/15 hover:border-white/40 transition">もう一度 登る</button>
      </div>
    </div>
  );
};
