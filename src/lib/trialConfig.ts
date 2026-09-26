/**
 * 実力の階段（STEP TO 算数MASTER）の段と、本番テストとの対応。
 *
 * 段は「前の段ができないと、その段は解けない」順に並べる。
 * 止まった段が、その子がいま取り組むべきところになる。
 * 前の学年の内容は入れない（単元アプリの範囲で閉じる、と先生と決めた）。
 * 第1段で止まった子は、この単元より前でつまずいている可能性があるので、
 * 先生の画面（PRISM）に印を出す。
 *
 * 極限は本番テストの範囲（FLOORS）。無限は単元のすべての項目（ENDLESS_FLOORS）。
 */
import type { TrialFloorDef, TestItemReq } from 'learning-app-kit/trial';
import type { RoundFocus } from '../components/shared/roundTypes';
import { TEST_DAIMONS, skillIdOf } from './testConfig';

export interface BaiFloor extends TrialFloorDef {
  /** 以前の見出し（第Ⅰ層…）。いまの画面は kit が「第1段」と出す */
  numeral: string;
  /** その段の問題を、どの段階まで解かせるか（'full' は図→式→答えを通しで） */
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

/**
 * 無限で出す段。本番テストに出ない「基本」の3つを、同じ量を求める段に混ぜる
 * （基本は図の関係だけを問うやさしい形なので、その量を求める最初の段に置く）。
 */
export const ENDLESS_FLOORS: BaiFloor[] = FLOORS.map((f, i) => ({
  ...f,
  skills: [...f.skills, ...(i === 0 ? ['kihon-find-compare'] : i === 1 ? ['kihon-find-times'] : i === 2 ? ['kihon-find-base'] : [])],
}));

/**
 * 本番テストの各設問を「何段まで突破していれば取れるか」に対応させる。
 * 予想点はこの合計（kit の predictScore）。
 *
 * 大問1〜3は、図・式・「1とみると」が考え方（第1〜3段）、答えが大きな数の計算（第4段）。
 * 大問4（割合でくらべる）は第7段。点数は TEST_DAIMONS から取るので、テストの配点と常に一致する。
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
