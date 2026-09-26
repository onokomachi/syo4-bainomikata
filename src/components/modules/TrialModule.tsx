/**
 * 実力の階段（STEP TO 算数MASTER）── この単元の中で、自分がどこまで確実にできるかを測る。
 *
 * 画面と決まり（極限・無限・セーブ・予想点・記録）は learning-app-kit の TrialScreen。
 * 極限は本番テストの範囲、無限は単元のすべての項目（ENDLESS_FLOORS）。
 * このアプリが決めるのは、層の並び（trialConfig）と、1問の作り方・出し方だけ。
 * 問題は練習と同じ解答画面で出す（練習で解ける問題は試練でも解ける）。
 */
import React from 'react';
import confetti from 'canvas-confetti';
import { TrialScreen } from 'learning-app-kit/react';
import { FLOORS, ENDLESS_FLOORS, TEST_REQS, TEST_MAX } from '../../lib/trialConfig';
import {
  generateKihon, generateTimes, generateCompare, generateBase, generateRatioCompare, generateWord,
  type KihonLevel, type TimesLevel, type CompareLevel, type BaseLevel, type RatioCompareLevel, type WordLevel,
} from '../../lib/problems';
import type { TestProblem } from '../../lib/testConfig';
import { skillToModuleId, type ModuleId } from '../../store/progressStore';
import { playClear, playCorrect, playSoftTry } from '../../lib/sound';
import { TimesRound } from './TimesModule';
import { CompareRound } from './CompareModule';
import { BaseRound } from './BaseModule';
import { RatioCompareRound } from './RatioCompareModule';
import { WordRound } from './WordProblemModule';
import { KihonRound } from './KihonModule';

/** 層の記号 → 問題。練習モードと同じ生成器を使う（練習で解ける問題は試練でも解ける） */
export function genProblem(skillId: string): TestProblem {
  if (skillId.startsWith('kihon-')) return { kind: 'kihon', level: skillId as KihonLevel, p: generateKihon(skillId as KihonLevel) };
  if (skillId.startsWith('times-')) return { kind: 'times', level: skillId as TimesLevel, p: generateTimes(skillId as TimesLevel) };
  if (skillId.startsWith('compare-')) return { kind: 'compare', level: skillId as CompareLevel, p: generateCompare(skillId as CompareLevel) };
  if (skillId.startsWith('base-')) return { kind: 'base', level: skillId as BaseLevel, p: generateBase(skillId as BaseLevel) };
  if (skillId.startsWith('ratio-compare-')) return { kind: 'ratio', level: skillId as RatioCompareLevel, p: generateRatioCompare(skillId as RatioCompareLevel) };
  return { kind: 'word', level: skillId as WordLevel, p: generateWord(skillId as WordLevel) };
}

interface Q { floor: number; tp: TestProblem }

interface Props {
  onExit: () => void;
  /** 結果から「やるべき層」の練習へ飛ぶ */
  onPractice: (id: ModuleId) => void;
}

export const TrialModule: React.FC<Props> = ({ onExit, onPractice }) => (
  <TrialScreen<Q>
    appId="bai"
    supabaseUrl={import.meta.env.VITE_SUPABASE_URL as string | undefined}
    supabaseKey={import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined}
    floors={FLOORS}
    endlessFloors={ENDLESS_FLOORS}
    testReqs={TEST_REQS}
    testMax={TEST_MAX}
    generate={(skillId, floor) => ({ floor, tp: genProblem(skillId) })}
    render={(q, h) => (
      // 練習と同じ出題画面を、明るい面の上に置く（読みやすさを優先）
      <div className="rounded-[28px] bg-bg text-content p-2 sm:p-4 shadow-[0_0_60px_-20px_rgba(103,232,249,0.45)]">
        <Round q={q} onResult={h.onResult} onMiss={h.onMiss} />
      </div>
    )}
    onExit={onExit}
    exitLabel="倍の見方ラボへ"
    onPractice={(skillId) => onPractice(skillToModuleId(skillId))}
    sound={{
      correct: playCorrect,
      miss: playSoftTry,
      clear: () => {
        playClear();
        confetti({ particleCount: 160, spread: 90, origin: { y: 0.4 }, colors: ['#67e8f9', '#f0abfc', '#fde68a'] });
      },
    }}
  />
);

export const Round: React.FC<{ q: Q; onResult: (perfect: boolean) => void; onMiss: () => void }> = ({ q, onResult, onMiss }) => {
  const focus = ENDLESS_FLOORS[q.floor]?.focus ?? 'full';
  const common = { onNext: () => {}, onResult, onMiss, nextLabel: 'つぎへ' };
  const tp = q.tp;
  switch (tp.kind) {
    case 'kihon': return <KihonRound {...common} focus={focus} level={tp.level} problem={tp.p} />;
    case 'times': return <TimesRound {...common} focus={focus} level={tp.level} problem={tp.p} />;
    case 'compare': return <CompareRound {...common} focus={focus} level={tp.level} problem={tp.p} />;
    case 'base': return <BaseRound {...common} focus={focus} level={tp.level} problem={tp.p} />;
    case 'ratio': return <RatioCompareRound {...common} focus={focus} level={tp.level} problem={tp.p} />;
    case 'word': return <WordRound {...common} level={tp.level} problem={tp.p} />;
    default: return null;
  }
};
