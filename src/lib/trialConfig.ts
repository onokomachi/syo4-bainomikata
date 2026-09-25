/**
 * 神域の試練（この単元の中の実力チェック）の層と、本番テストとの対応。
 *
 * 層は「前の層ができないと、その層は解けない」順に並べる。
 * 止まった層が、その子がいま取り組むべきところになる。
 * 前の学年の内容は入れない（単元アプリの範囲で閉じる、と先生と決めた）。
 * 第Ⅰ層で止まった子は、この単元より前でつまずいている可能性があるので、
 * 先生の画面（PRISM）に印を出す。
 */
import type { TrialFloorDef, TestItemReq } from 'learning-app-kit/trial';
import type { RoundFocus } from '../components/shared/roundTypes';
import { TEST_DAIMONS, skillIdOf } from './testConfig';

export interface BaiFloor extends TrialFloorDef {
  /** 画面の見出し（第Ⅰ層…） */
  numeral: string;
  /** その層の問題を、どの段階まで解かせるか（'full' は図→式→答えを通しで） */
  focus: RoundFocus;
}

export const FLOORS: BaiFloor[] = [
  { numeral: 'Ⅰ', label: 'くらべられる量を もとめる', skills: ['compare-basic'], focus: 'full' },
  { numeral: 'Ⅱ', label: '何倍かを もとめる', skills: ['times-basic'], focus: 'full' },
  { numeral: 'Ⅲ', label: 'もとにする量を もとめる', skills: ['base-basic'], focus: 'full' },
  { numeral: 'Ⅳ', label: '大きな数で 3つとも', skills: ['times-big', 'compare-big', 'base-big'], focus: 'answer' },
  { numeral: 'Ⅴ', label: '文章題（何倍・くらべられる量）', skills: ['wp-times', 'wp-compare'], focus: 'full' },
  { numeral: 'Ⅵ', label: '文章題（もとにする量）', skills: ['wp-base'], focus: 'full' },
  { numeral: 'Ⅶ', label: '差ではなく 倍で くらべる', skills: ['ratio-compare-basic', 'ratio-compare-diff', 'wp-ratio'], focus: 'full' },
];

export const FLOOR_COUNT = FLOORS.length;

/** 突破した層の数 → 画面に出す名前（0＝まだ第Ⅰ層を越えていない、全層＝神座） */
export function floorName(cleared: number): string {
  if (cleared >= FLOOR_COUNT) return '神座';
  if (cleared <= 0) return '第Ⅰ層に挑戦中';
  return `第${FLOORS[cleared - 1]!.numeral}層`;
}

/**
 * 本番テストの各設問を「何層まで突破していれば取れるか」に対応させる。
 * 予想点はこの合計（kit の predictScore）。
 *
 * 大問1〜3は、図・式・「1とみると」が考え方（第Ⅰ〜Ⅲ層）、答えが大きな数の計算（第Ⅳ層）。
 * 大問4（割合でくらべる）は第Ⅶ層。点数は TEST_DAIMONS から取るので、テストの配点と常に一致する。
 */
const CONCEPT_FLOOR: Record<string, number> = {
  'compare-big': 1,
  'times-big': 2,
  'base-big': 3,
  'ratio-compare-basic': 7,
  'ratio-compare-diff': 7,
};

export const TEST_REQS: TestItemReq[] = TEST_DAIMONS.flatMap((d) => {
  const skill = skillIdOf(d.gen());
  const concept = CONCEPT_FLOOR[skill] ?? FLOOR_COUNT;
  return d.parts
    .filter((p) => p.points > 0)
    .map((p) => ({
      points: p.points,
      floor: concept >= FLOOR_COUNT ? concept : p.focus === 'answer' ? 4 : concept,
    }));
});

export const TEST_MAX = TEST_REQS.reduce((s, r) => s + r.points, 0);
