/**
 * 割合（倍）で くらべるモジュール。
 * ゴムA・B型：2つの ペア（のばす前 → のばした後）から それぞれ 倍を もとめて、
 * どちらが よく変化したか（倍が大きいか）を 判定する。
 * 「差ではなく 倍で くらべる」という 見方の 転換を あつかう。
 */
import React, { useState } from 'react';
import confetti from 'canvas-confetti';
import { Wand2 } from 'lucide-react';
import { AppShell } from '../shared/AppShell';
import { AdaptiveBar } from '../shared/AdaptiveBar';
import { AnswerEntry } from '../shared/AnswerEntry';
import { HintBox, ResultPanel, SetupScreen, LevelCard } from '../ui/primitives';
import { RATIO_COMPARE_LEVELS, RatioCompareLevel, RatioCompareProblem, generateRatioCompare } from '../../lib/problems';
import { useProgressStore } from '../../store/progressStore';
import { useAdaptive } from '../../lib/useAdaptive';
import { playClear, playCorrect, playSoftTry } from '../../lib/sound';

interface Props { onExit: () => void; }

const LEVEL_IDS = RATIO_COMPARE_LEVELS.map((l) => l.id);

export const RatioCompareModule: React.FC<Props> = ({ onExit }) => {
  const [mode, setMode] = useState<'setup' | 'level' | 'auto'>('setup');
  const [level, setLevel] = useState<RatioCompareLevel>('ratio-compare-basic');
  const [round, setRound] = useState(0);
  const getMasteryStreak = useProgressStore((s) => s.getMasteryStreak);
  const getTodaySkillCount = useProgressStore((s) => s.getTodaySkillCount);
  const adaptive = useAdaptive<RatioCompareLevel>(LEVEL_IDS, 'ratio');

  if (mode === 'setup') {
    return (
      <SetupScreen title="割合で くらべる" subtitle="差ではなく 倍で くらべてみよう" onBack={onExit}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          {RATIO_COMPARE_LEVELS.map((l) => (
            <LevelCard
              key={l.id}
              label={l.label}
              desc={l.desc}
              mastery={getMasteryStreak(l.id)}
              todayCount={getTodaySkillCount(l.id)}
              accentBorder="hover:border-fuchsia-400"
              onClick={() => { setLevel(l.id); setRound((r) => r + 1); setMode('level'); }}
            />
          ))}
        </div>
        <button
          onClick={() => { setRound((r) => r + 1); setMode('auto'); }}
          className="w-full p-5 rounded-3xl bg-gradient-to-r from-indigo-500 to-violet-500 text-white font-black text-lg shadow-lg hover:shadow-xl transition-all active:scale-[0.99] flex items-center justify-center gap-2"
        >
          <Wand2 size={22} /> おまかせモード（じどうで レベルアップ）
        </button>
      </SetupScreen>
    );
  }

  const activeLevel = mode === 'auto' ? adaptive.level : level;

  return (
    <AppShell title="割合で くらべる" subtitle={RATIO_COMPARE_LEVELS.find((l) => l.id === activeLevel)?.label} onBack={() => setMode('setup')}>
      <div className="flex flex-col h-full">
        {mode === 'auto' && (
          <AdaptiveBar index={adaptive.index} total={adaptive.total} leveledUp={adaptive.leveledUp} onClearLevelUp={adaptive.clearLevelUp} />
        )}
        <div className="flex-1 min-h-0">
          <RatioCompareRound
            key={`${activeLevel}-${round}`}
            level={activeLevel}
            onNext={() => setRound((r) => r + 1)}
            onResult={mode === 'auto' ? adaptive.onResult : undefined}
          />
        </div>
      </div>
    </AppShell>
  );
};

export const RatioCompareRound: React.FC<{
  level: RatioCompareLevel;
  problem?: RatioCompareProblem;
  onNext: () => void;
  onResult?: (perfect: boolean) => void;
  nextLabel?: string;
}> = ({ level, problem: given, onNext, onResult, nextLabel }) => {
  const [problem] = useState<RatioCompareProblem>(() => given ?? generateRatioCompare(level));
  const [stage, setStage] = useState<'timesA' | 'timesB' | 'judge' | 'done'>('timesA');
  const [mistakes, setMistakes] = useState(0);
  const [hint, setHint] = useState<string | null>(null);
  const [pickedWrong, setPickedWrong] = useState<'A' | 'B' | null>(null);
  const recordResult = useProgressStore((s) => s.recordResult);

  const finish = () => {
    playClear();
    confetti({ particleCount: 130, spread: 70, origin: { y: 0.6 } });
    recordResult({
      moduleId: 'ratio-compare',
      skillId: level,
      label: `${problem.pair.itemA} と ${problem.pair.itemB}`,
      correct: mistakes === 0,
    });
    onResult?.(mistakes === 0);
    setStage('done');
  };

  const submitTimesA = (v: string) => {
    if (Number(v) === problem.timesA) {
      playCorrect();
      setHint(null);
      setStage('timesB');
    } else {
      playSoftTry();
      setMistakes((m) => m + 1);
      setHint(`${problem.pair.itemA}は ${problem.beforeA}${problem.pair.unit} → ${problem.afterA}${problem.pair.unit}。あと ÷ まえ を 計算しよう。`);
    }
  };

  const submitTimesB = (v: string) => {
    if (Number(v) === problem.timesB) {
      playCorrect();
      setHint(problem.hint);
      setStage('judge');
    } else {
      playSoftTry();
      setMistakes((m) => m + 1);
      setHint(`${problem.pair.itemB}は ${problem.beforeB}${problem.pair.unit} → ${problem.afterB}${problem.pair.unit}。あと ÷ まえ を 計算しよう。`);
    }
  };

  const chooseBigger = (label: 'A' | 'B') => {
    if (label === problem.biggerLabel) {
      finish();
    } else {
      playSoftTry();
      setMistakes((m) => m + 1);
      setPickedWrong(label);
      setHint(`倍を くらべてみよう。${problem.pair.itemA}は ${problem.timesA}倍、${problem.pair.itemB}は ${problem.timesB}倍。差ではなく 倍の 大きさで くらべるよ。`);
    }
  };

  return (
    <div className="h-full overflow-y-auto p-4 md:p-8">
      <div className="max-w-xl mx-auto space-y-5">
        <div className="bg-surface border border-line rounded-[28px] shadow-xl p-6 md:p-8">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-4xl">{problem.pair.emojiA}</span>
            <p className="text-content font-black text-lg tabular-nums">{problem.pair.itemA}：{problem.beforeA}{problem.pair.unit} → {problem.afterA}{problem.pair.unit}</p>
          </div>
          <div className="flex items-center gap-3 mb-3">
            <span className="text-4xl">{problem.pair.emojiB}</span>
            <p className="text-content font-black text-lg tabular-nums">{problem.pair.itemB}：{problem.beforeB}{problem.pair.unit} → {problem.afterB}{problem.pair.unit}</p>
          </div>
          {problem.showDiffTrap && (
            <p className="text-sm text-faint font-bold mt-2">
              差（ふえた量）は どちらも {problem.diffA}{problem.pair.unit}。でも 倍で くらべると どうかな？
            </p>
          )}
        </div>

        {hint && <HintBox tone={stage === 'judge' && pickedWrong ? 'wrong' : 'hint'}>{hint}</HintBox>}

        {stage === 'timesA' && (
          <div>
            <p className="text-center text-muted font-black mb-3">{problem.pair.itemA}は もとの 何倍に なりましたか？</p>
            <AnswerEntry onSubmit={submitTimesA} allowDecimal={false} accentText="text-fuchsia-600" />
          </div>
        )}

        {stage === 'timesB' && (
          <div>
            <p className="text-center text-muted font-black mb-3">{problem.pair.itemB}は もとの 何倍に なりましたか？</p>
            <AnswerEntry onSubmit={submitTimesB} allowDecimal={false} accentText="text-fuchsia-600" />
          </div>
        )}

        {stage === 'judge' && (
          <div>
            <p className="text-center text-content font-black text-lg mb-4">よく変化したのは どちら？（倍で くらべよう）</p>
            <div className="flex justify-center gap-4">
              <button onClick={() => chooseBigger('A')} className={`flex items-center gap-2 px-8 py-5 rounded-2xl border-2 font-black text-xl active:scale-95 transition-all ${pickedWrong === 'A' ? 'bg-amber-50 border-amber-300 text-amber-500' : 'bg-surface border-line text-content hover:border-fuchsia-400'}`}>
                {problem.pair.emojiA} {problem.pair.itemA}
              </button>
              <button onClick={() => chooseBigger('B')} className={`flex items-center gap-2 px-8 py-5 rounded-2xl border-2 font-black text-xl active:scale-95 transition-all ${pickedWrong === 'B' ? 'bg-amber-50 border-amber-300 text-amber-500' : 'bg-surface border-line text-content hover:border-fuchsia-400'}`}>
                {problem.pair.emojiB} {problem.pair.itemB}
              </button>
            </div>
          </div>
        )}

        {stage === 'done' && (
          <ResultPanel
            perfect={mistakes === 0}
            detail={<span>{problem.explain}</span>}
            onNext={onNext}
            nextLabel={nextLabel}
            accentClass="bg-fuchsia-500 hover:bg-fuchsia-600"
          />
        )}
      </div>
    </div>
  );
};
