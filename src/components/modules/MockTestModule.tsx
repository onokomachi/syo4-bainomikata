/**
 * 本番テストモード。「倍の見方」単元テストを 同じ大問順・同じ技能配分で 通しで解く。
 *
 * 1つの大問の小問（図・式・答え・1とみると…）は同じ場面を共有するので、
 * 問題は大問ごとに1回だけ生成し、小問はその問題を focus ちがいで解く。
 * 図と式は答えと独立に採点される（実物のテストの採点基準に合わせている）。
 */
import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { ChevronLeft, ClipboardCheck, Home, RotateCcw, Trophy } from 'lucide-react';
import { TEST_DAIMONS, TestProblem, TestDaimon, TestPart, describeProblem, OMOTE_MAX, TOTAL_MAX } from '../../lib/testConfig';
import { useProgressStore, TestDetail } from '../../store/progressStore';
import { KihonRound } from './KihonModule';
import { TimesRound } from './TimesModule';
import { CompareRound } from './CompareModule';
import { BaseRound } from './BaseModule';
import { RatioCompareRound } from './RatioCompareModule';
import { WordRound } from './WordProblemModule';
import { BaiErrorRound } from './ErrorHunterModule';

interface Props { onExit: () => void; }

type Phase = 'INTRO' | 'RUN' | 'RESULT';
type Mode = '表' | 'ぜんぶ';

/** 大問を小問単位にほどいた、採点1単位ぶんのステップ */
interface FlatStep {
  daimonIndex: number; // problems[] の添字
  daimon: TestDaimon;
  part: TestPart;
}

const daimonsForMode = (mode: Mode): TestDaimon[] =>
  mode === '表' ? TEST_DAIMONS.filter((d) => d.section === '表') : TEST_DAIMONS;

export const MockTestModule: React.FC<Props> = ({ onExit }) => {
  const [phase, setPhase] = useState<Phase>('INTRO');
  const [mode, setMode] = useState<Mode>('ぜんぶ');
  const [seed, setSeed] = useState(0); // 「もう一度」で問題を作り直す
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<Record<number, boolean>>({});
  const recordResult = useProgressStore((s) => s.recordResult);
  const [recorded, setRecorded] = useState(false);

  const activeDaimons = useMemo<TestDaimon[]>(() => daimonsForMode(mode), [mode]);
  // 大問ごとに1回だけ生成（小問は同じ場面を共有する）
  const problems = useMemo<TestProblem[]>(() => activeDaimons.map((d) => d.gen()), [activeDaimons, seed]);
  const steps = useMemo<FlatStep[]>(
    () => activeDaimons.flatMap((d, di) => d.parts.map((part) => ({ daimonIndex: di, daimon: d, part }))),
    [activeDaimons]
  );

  const choose = (m: Mode) => {
    setMode(m); setIndex(0); setResults({}); setRecorded(false); setPhase('RUN');
  };
  const restart = () => {
    setSeed((s) => s + 1); setIndex(0); setResults({}); setRecorded(false); setPhase('RUN');
  };

  const onResult = (perfect: boolean) => {
    setResults((r) => (index in r ? r : { ...r, [index]: perfect }));
  };

  const advance = () => {
    if (index < steps.length - 1) setIndex((i) => i + 1);
    else setPhase('RESULT');
  };

  const earnedAt = (i: number) => (results[i] ? steps[i].part.points : 0);
  const omoteMax = steps.filter((s) => s.daimon.section === '表').reduce((a, s) => a + s.part.points, 0);
  const totalMax = omoteMax;
  const omoteScore = steps.reduce((a, s, i) => a + (s.daimon.section === '表' ? earnedAt(i) : 0), 0);
  const totalScore = omoteScore;
  const refIndex = steps.findIndex((s) => s.daimon.section === '参考');
  const refPerfect = refIndex >= 0 && results[refIndex];

  if (phase === 'RESULT' && !recorded) {
    const detail: TestDetail = {
      mode,
      omoteScore, omoteMax, uraScore: 0, uraMax: 0,
      total: totalScore, totalMax,
      steps: steps.map((s, i) => {
        const d = describeProblem(problems[s.daimonIndex], s.part.focus);
        return {
          daimon: s.daimon.daimon, sub: s.part.sub, title: s.part.title, section: s.daimon.section,
          q: d.q, a: d.a, points: s.part.points, earned: earnedAt(i), correct: !!results[i],
        };
      }),
    };
    recordResult({ moduleId: 'mock-test', skillId: 'mock-test', label: `本番テスト（${mode}）${totalScore}/${totalMax}点`, correct: totalScore === totalMax, detail });
    setRecorded(true);
  }

  /* ---------------- INTRO ---------------- */
  if (phase === 'INTRO') {
    const RangeButton: React.FC<{ m: Mode; title: string; sub: string; max: number; color: string }> = ({ m, title, sub, max, color }) => (
      <button onClick={() => choose(m)} className={`flex-1 min-w-[8rem] rounded-2xl border-2 ${color} p-5 text-left transition-all active:scale-95 hover:shadow-lg`}>
        <div className="text-xl font-black text-content">{title}</div>
        <div className="text-sm font-bold text-muted mt-0.5">{sub}</div>
        <div className="text-2xl font-black tabular-nums mt-2">{max}<span className="text-base text-muted">点</span></div>
      </button>
    );
    return (
      <div className="w-full h-full overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 py-6">
          <button onClick={onExit} className="flex items-center gap-2 text-muted hover:text-content font-bold px-3 py-2 rounded-xl hover:bg-surface-3 transition-colors mb-2">
            <ChevronLeft size={24} /> ホームへ
          </button>
          <div className="bg-surface rounded-[36px] shadow-2xl border border-line p-8 md:p-12 text-center mt-4">
            <div className="w-24 h-24 rounded-3xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-6"><ClipboardCheck size={44} /></div>
            <h1 className="text-3xl font-black text-content mb-2">本番テストモード</h1>
            <p className="text-muted font-bold leading-relaxed mb-2">「倍の見方」の テストに ちょうせん！</p>
            <p className="text-faint font-bold text-sm mb-6">図・式・答えが それぞれ 点に なるよ。式が 合っていれば 計算を まちがえても 点が もらえる ところも 本物と 同じ。</p>
            <div className="flex flex-wrap gap-3 justify-center">
              <RangeButton m="表" title="表だけ" sub="知識・ぎのう" max={OMOTE_MAX} color="border-blue-300 hover:border-blue-400 bg-blue-50/40" />
              <RangeButton m="ぜんぶ" title="表＋いかそう算数" sub="ぜんぶ通し（参考つき）" max={TOTAL_MAX} color="border-amber-300 hover:border-amber-400 bg-amber-50/40" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ---------------- RESULT ---------------- */
  if (phase === 'RESULT') {
    const omoteSteps = steps.map((s, i) => ({ s, i })).filter((x) => x.s.daimon.section === '表');
    const Row: React.FC<{ s: FlatStep; i: number }> = ({ s, i }) => {
      const d = describeProblem(problems[s.daimonIndex], s.part.focus);
      return (
        <div className="flex items-start justify-between gap-2 py-1.5 border-b border-line/60 last:border-0">
          <div className="min-w-0">
            <span className="font-bold text-content text-sm">大問{s.daimon.daimon}{s.part.sub ?? ''}　{s.part.title}</span>
            <div className="text-xs text-muted font-bold mt-0.5 truncate">{d.q}　→　<span className="text-content">{d.a}</span></div>
          </div>
          <span className={`font-black tabular-nums shrink-0 ${results[i] ? 'text-emerald-600' : 'text-rose-400'}`}>
            {results[i] ? '○' : '×'} {earnedAt(i)}/{s.part.points}
          </span>
        </div>
      );
    };
    return (
      <div className="w-full h-full overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 py-6">
          <div className="bg-surface rounded-[36px] shadow-2xl border border-line p-6 md:p-10 mt-4">
            <div className="text-center mb-6">
              <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }} className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-amber-50 text-amber-500 mb-3"><Trophy size={40} /></motion.div>
              <h1 className="text-2xl font-black text-content">テスト けっか（{mode}）</h1>
              <div className="text-5xl font-black text-blue-600 tabular-nums mt-2">{totalScore}<span className="text-2xl text-muted"> / {totalMax}点</span></div>
            </div>

            {omoteSteps.length > 0 && (
              <div className="rounded-2xl border border-line p-4 mb-3">
                <p className="text-xs font-black text-blue-600 mb-2">表・知識ぎのう</p>
                {omoteSteps.map(({ s, i }) => <Row key={i} s={s} i={i} />)}
              </div>
            )}
            {refIndex >= 0 && (
              <div className="rounded-2xl border border-line p-4 mb-6">
                <p className="text-xs font-black text-faint mb-1">いかそう算数（点数なし・評価）</p>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-content text-sm">差ではなく 倍で くらべられたか</span>
                  <span className={`font-black ${refPerfect ? 'text-emerald-600' : 'text-amber-500'}`}>{refPerfect ? 'A（一発で見ぬけた！）' : 'がんばろう'}</span>
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={restart} className="flex-1 flex items-center justify-center gap-2 py-4 bg-blue-500 hover:bg-blue-600 text-white rounded-2xl font-black text-lg shadow-lg transition-all active:scale-95">
                <RotateCcw size={20} /> もう一度
              </button>
              <button onClick={() => setPhase('INTRO')} className="flex-1 flex items-center justify-center gap-2 py-4 bg-surface border-2 border-line text-content rounded-2xl font-black text-lg hover:bg-surface-2 transition-all active:scale-95">
                範囲をえらぶ
              </button>
              <button onClick={onExit} className="flex-1 flex items-center justify-center gap-2 py-4 bg-surface border-2 border-line text-content rounded-2xl font-black text-lg hover:bg-surface-2 transition-all active:scale-95">
                <Home size={20} /> ホームへ
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ---------------- RUN ---------------- */
  const step = steps[index];
  const tp = problems[step.daimonIndex];
  const focus = step.part.focus;
  const progress = (index / steps.length) * 100;
  const scoredSteps = steps.filter((s) => s.daimon.section !== '参考').length;
  const scoredDone = steps.slice(0, index).filter((s) => s.daimon.section !== '参考').length;

  const renderActivity = () => {
    const common = { onNext: advance, onResult, nextLabel: 'つぎの もんだいへ', focus };
    switch (tp.kind) {
      case 'kihon': return <KihonRound {...common} level={tp.level} problem={tp.p} />;
      case 'times': return <TimesRound {...common} level={tp.level} problem={tp.p} />;
      case 'compare': return <CompareRound {...common} level={tp.level} problem={tp.p} />;
      case 'base': return <BaseRound {...common} level={tp.level} problem={tp.p} />;
      case 'ratio': return <RatioCompareRound {...common} level={tp.level} problem={tp.p} />;
      case 'word': return <WordRound onNext={advance} onResult={onResult} nextLabel="つぎの もんだいへ" level={tp.level} problem={tp.p} />;
      case 'error': return <BaiErrorRound example={tp.p} startStage="judge" onNext={advance} onResult={onResult} nextLabel="つぎの もんだいへ" />;
    }
  };

  const sectionColor = step.daimon.section === '表' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700';

  return (
    <div className="w-full h-full flex flex-col bg-bg">
      <div className="shrink-0 border-b border-line bg-surface/80 backdrop-blur px-4 py-3">
        <div className="max-w-5xl mx-auto flex items-center gap-3">
          <button onClick={onExit} className="flex items-center gap-1 text-muted hover:text-content font-bold px-2 py-1.5 rounded-lg hover:bg-surface-3 transition-colors shrink-0">
            <ChevronLeft size={20} /> やめる
          </button>
          <span className={`px-3 py-1 rounded-full text-xs font-black shrink-0 ${sectionColor}`}>{step.daimon.section}</span>
          <div className="font-black text-content truncate">大問{step.daimon.daimon}{step.part.sub ?? ''}　<span className="text-muted font-bold">{step.part.title}</span></div>
          <div className="ml-auto text-sm font-black text-muted tabular-nums shrink-0">
            {step.daimon.section === '参考' ? '参考もんだい' : `${scoredDone + 1} / ${scoredSteps}問`}
          </div>
        </div>
        <div className="max-w-5xl mx-auto mt-2 h-1.5 bg-surface-3 rounded-full overflow-hidden">
          <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {/* ステップごとに remount して内部状態をリセット */}
      <div className="flex-1 min-h-0" key={`${mode}-${seed}-${index}`}>
        {renderActivity()}
      </div>
    </div>
  );
};
