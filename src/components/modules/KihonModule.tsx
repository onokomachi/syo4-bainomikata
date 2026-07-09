/**
 * 基礎：倍の見方 入門モジュール。
 * 「基準量（もとにする量）× 倍 ＝ 比較量（くらべられる量）」の関係を、
 * 小さい整数・テープ図のイメージで やさしく身につける。
 */
import React, { useState } from 'react';
import confetti from 'canvas-confetti';
import { Wand2 } from 'lucide-react';
import { AppShell } from '../shared/AppShell';
import { AdaptiveBar } from '../shared/AdaptiveBar';
import { AnswerEntry } from '../shared/AnswerEntry';
import { TapeDiagram } from '../shared/TapeDiagram';
import { HintBox, ResultPanel, SetupScreen, LevelCard } from '../ui/primitives';
import { KIHON_LEVELS, KihonLevel, BaiTapeProblem, generateKihon } from '../../lib/problems';
import { useProgressStore } from '../../store/progressStore';
import { useAdaptive } from '../../lib/useAdaptive';
import { playClear, playSoftTry } from '../../lib/sound';

interface Props { onExit: () => void; }

const LEVEL_IDS = KIHON_LEVELS.map((l) => l.id);

export const KihonModule: React.FC<Props> = ({ onExit }) => {
  const [mode, setMode] = useState<'setup' | 'level' | 'auto'>('setup');
  const [level, setLevel] = useState<KihonLevel>('kihon-find-compare');
  const [round, setRound] = useState(0);
  const getMasteryStreak = useProgressStore((s) => s.getMasteryStreak);
  const getTodaySkillCount = useProgressStore((s) => s.getTodaySkillCount);
  const adaptive = useAdaptive<KihonLevel>(LEVEL_IDS, 'kihon');

  if (mode === 'setup') {
    return (
      <SetupScreen title="基礎：倍の見方" subtitle="もとにする量・倍・くらべられる量の 関係を おぼえよう" onBack={onExit}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          {KIHON_LEVELS.map((l) => (
            <LevelCard
              key={l.id}
              label={l.label}
              desc={l.desc}
              mastery={getMasteryStreak(l.id)}
              todayCount={getTodaySkillCount(l.id)}
              accentBorder="hover:border-sky-400"
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
    <AppShell title="基礎：倍の見方" subtitle={KIHON_LEVELS.find((l) => l.id === activeLevel)?.label} onBack={() => setMode('setup')}>
      <div className="flex flex-col h-full">
        {mode === 'auto' && (
          <AdaptiveBar index={adaptive.index} total={adaptive.total} leveledUp={adaptive.leveledUp} onClearLevelUp={adaptive.clearLevelUp} />
        )}
        <div className="flex-1 min-h-0">
          <KihonRound
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

export const KihonRound: React.FC<{
  level: KihonLevel;
  problem?: BaiTapeProblem;
  onNext: () => void;
  onResult?: (perfect: boolean) => void;
  nextLabel?: string;
}> = ({ level, problem: given, onNext, onResult, nextLabel }) => {
  const [problem] = useState<BaiTapeProblem>(() => given ?? generateKihon(level));
  const [stage, setStage] = useState<'answer' | 'done'>('answer');
  const [mistakes, setMistakes] = useState(0);
  const [hint, setHint] = useState<string | null>(null);
  const recordResult = useProgressStore((s) => s.recordResult);

  const answer = problem.missing === 'compare' ? problem.compare : problem.missing === 'times' ? problem.times : problem.base;

  const finish = () => {
    playClear();
    confetti({ particleCount: 100, spread: 60, origin: { y: 0.6 } });
    recordResult({ moduleId: 'kihon', skillId: level, label: `${problem.scene.baseName} と ${problem.scene.compareName}`, correct: mistakes === 0 });
    onResult?.(mistakes === 0);
    setStage('done');
  };

  const submit = (v: string) => {
    if (Number(v) === answer) {
      finish();
    } else {
      playSoftTry();
      setMistakes((m) => m + 1);
      setHint(problem.hint);
    }
  };

  const questionText = problem.missing === 'compare'
    ? `${problem.scene.baseName}の${problem.scene.measure}は ${problem.base}${problem.scene.unit}。これを「1」と見ると、${problem.scene.compareName}は「${problem.times}」にあたります。${problem.scene.compareName}の${problem.scene.measure}は 何${problem.scene.unit}ですか？`
    : problem.missing === 'times'
      ? `${problem.scene.baseName}の${problem.scene.measure}は ${problem.base}${problem.scene.unit}、${problem.scene.compareName}の${problem.scene.measure}は ${problem.compare}${problem.scene.unit}です。${problem.scene.baseName}を「1」と見ると、${problem.scene.compareName}は いくつに あたりますか？`
      : `${problem.scene.compareName}の${problem.scene.measure}は ${problem.compare}${problem.scene.unit}で、${problem.scene.baseName}の ${problem.times}倍に あたります。${problem.scene.baseName}の${problem.scene.measure}は 何${problem.scene.unit}ですか？`;

  return (
    <div className="h-full overflow-y-auto p-4 md:p-8">
      <div className="max-w-xl mx-auto space-y-5">
        <div className="bg-surface border border-line rounded-[28px] shadow-xl p-6 md:p-8">
          <div className="flex items-start gap-3 mb-4">
            <span className="text-4xl shrink-0">{problem.scene.emoji}</span>
            <p className="text-lg md:text-xl font-black text-content leading-relaxed flex-1">{questionText}</p>
          </div>
          <TapeDiagram
            baseLabel={problem.scene.baseName}
            compareLabel={problem.scene.compareName}
            baseUnits={1}
            compareUnits={problem.times}
            baseValue={problem.missing === 'base' ? '□' : `${problem.base}${problem.scene.unit}（1）`}
            compareValue={problem.missing === 'compare' ? '□' : problem.missing === 'times' ? `${problem.compare}${problem.scene.unit}（□）` : `${problem.compare}${problem.scene.unit}（${problem.times}）`}
          />
        </div>

        {hint && <HintBox tone="wrong">{hint}</HintBox>}

        {stage === 'answer' && (
          <AnswerEntry onSubmit={submit} allowDecimal={false} accentText="text-sky-600" />
        )}

        {stage === 'done' && (
          <ResultPanel
            perfect={mistakes === 0}
            detail={<span>{problem.explain}</span>}
            onNext={onNext}
            nextLabel={nextLabel}
            accentClass="bg-sky-500 hover:bg-sky-600"
          />
        )}
      </div>
    </div>
  );
};
