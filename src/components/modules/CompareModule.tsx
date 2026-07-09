/**
 * 何倍かにあたる量を もとめるモジュール。
 * 基準量（もとにする量）× 倍 ＝ 比較量（くらべられる量）。
 */
import React, { useState } from 'react';
import confetti from 'canvas-confetti';
import { Wand2 } from 'lucide-react';
import { AppShell } from '../shared/AppShell';
import { AdaptiveBar } from '../shared/AdaptiveBar';
import { AnswerEntry } from '../shared/AnswerEntry';
import { TapeDiagram } from '../shared/TapeDiagram';
import { HintBox, ResultPanel, SetupScreen, LevelCard } from '../ui/primitives';
import { COMPARE_LEVELS, CompareLevel, BaseCompareProblem, generateCompare } from '../../lib/problems';
import { useProgressStore } from '../../store/progressStore';
import { useAdaptive } from '../../lib/useAdaptive';
import { playClear, playSoftTry } from '../../lib/sound';

interface Props { onExit: () => void; }

const LEVEL_IDS = COMPARE_LEVELS.map((l) => l.id);

export const CompareModule: React.FC<Props> = ({ onExit }) => {
  const [mode, setMode] = useState<'setup' | 'level' | 'auto'>('setup');
  const [level, setLevel] = useState<CompareLevel>('compare-basic');
  const [round, setRound] = useState(0);
  const getMasteryStreak = useProgressStore((s) => s.getMasteryStreak);
  const getTodaySkillCount = useProgressStore((s) => s.getTodaySkillCount);
  const adaptive = useAdaptive<CompareLevel>(LEVEL_IDS, 'compare');

  if (mode === 'setup') {
    return (
      <SetupScreen title="何倍かにあたる量" subtitle="もとにする量 × 倍 ＝ くらべられる量" onBack={onExit}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          {COMPARE_LEVELS.map((l) => (
            <LevelCard
              key={l.id}
              label={l.label}
              desc={l.desc}
              mastery={getMasteryStreak(l.id)}
              todayCount={getTodaySkillCount(l.id)}
              accentBorder="hover:border-emerald-400"
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
    <AppShell title="何倍かにあたる量" subtitle={COMPARE_LEVELS.find((l) => l.id === activeLevel)?.label} onBack={() => setMode('setup')}>
      <div className="flex flex-col h-full">
        {mode === 'auto' && (
          <AdaptiveBar index={adaptive.index} total={adaptive.total} leveledUp={adaptive.leveledUp} onClearLevelUp={adaptive.clearLevelUp} />
        )}
        <div className="flex-1 min-h-0">
          <CompareRound
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

export const CompareRound: React.FC<{
  level: CompareLevel;
  problem?: BaseCompareProblem;
  onNext: () => void;
  onResult?: (perfect: boolean) => void;
  nextLabel?: string;
}> = ({ level, problem: given, onNext, onResult, nextLabel }) => {
  const [problem] = useState<BaseCompareProblem>(() => given ?? generateCompare(level));
  const [stage, setStage] = useState<'answer' | 'done'>('answer');
  const [mistakes, setMistakes] = useState(0);
  const [hint, setHint] = useState<string | null>(null);
  const recordResult = useProgressStore((s) => s.recordResult);

  const finish = () => {
    playClear();
    confetti({ particleCount: 110, spread: 65, origin: { y: 0.6 } });
    recordResult({ moduleId: 'compare', skillId: level, label: `${problem.base} × ${problem.times}`, correct: mistakes === 0 });
    onResult?.(mistakes === 0);
    setStage('done');
  };

  const submit = (v: string) => {
    if (Number(v) === problem.compare) {
      finish();
    } else {
      playSoftTry();
      setMistakes((m) => m + 1);
      setHint(problem.hint);
    }
  };

  return (
    <div className="h-full overflow-y-auto p-4 md:p-8">
      <div className="max-w-xl mx-auto space-y-5">
        <div className="bg-surface border border-line rounded-[28px] shadow-xl p-6 md:p-8">
          <div className="flex items-start gap-3 mb-4">
            <span className="text-4xl shrink-0">{problem.scene.emoji}</span>
            <p className="text-lg md:text-xl font-black text-content leading-relaxed flex-1">
              {problem.scene.baseName}の{problem.scene.measure}は {problem.base}{problem.scene.unit}です。{problem.scene.compareName}の{problem.scene.measure}は、{problem.scene.baseName}の {problem.times}倍に なります。{problem.scene.compareName}の{problem.scene.measure}は 何{problem.scene.unit}ですか？
            </p>
          </div>
          <TapeDiagram
            baseLabel={problem.scene.baseName}
            compareLabel={problem.scene.compareName}
            baseUnits={1}
            compareUnits={problem.times}
            baseValue={`${problem.base}${problem.scene.unit}`}
            compareValue="□"
          />
        </div>

        {hint && <HintBox tone="wrong">{hint}</HintBox>}

        {stage === 'answer' && (
          <AnswerEntry onSubmit={submit} allowDecimal={false} accentText="text-emerald-600" />
        )}

        {stage === 'done' && (
          <ResultPanel
            perfect={mistakes === 0}
            detail={<span>{problem.explain}</span>}
            onNext={onNext}
            nextLabel={nextLabel}
            accentClass="bg-emerald-500 hover:bg-emerald-600"
          />
        )}
      </div>
    </div>
  );
};
