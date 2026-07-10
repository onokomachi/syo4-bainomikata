/**
 * 「本番テストモード」の設定表。
 * 実際の単元テスト「倍の見方」（表＝知識・技能100点／いかそう算数＝参考）
 * と同じ大問構成・同じ問題形式で再現する（数値はランダム生成）。
 * 各設問は既存ジェネレータを呼び、既存アクティビティで解く。
 * 採点: ノーミス完答=満点、ミスありで完答=0点（＝一発正解を採点）。
 *
 * 大問1: 何倍かを もとめる（子どものイルカ・親のイルカ 型）
 * 大問2: 何倍かにあたる量を もとめる（学校・ビル 型）
 * 大問3: もとにする量を もとめる（りんご・メロン 型）
 * 大問4: 割合で くらべる（ゴムA・B 型）
 * 参考（いかそう算数）: 差ではなく 倍で くらべる（サンマ・イワシ 型）
 */
import {
  KihonLevel, BaiTapeProblem, generateKihon,
  TimesLevel, BaseTimesProblem, generateTimes,
  CompareLevel, BaseCompareProblem, generateCompare,
  BaseLevel, BaseBaseProblem, generateBase,
  RatioCompareLevel, RatioCompareProblem, generateRatioCompare,
  WordLevel, BaiWordProblem, generateWord,
  EhPreset, BaiErrorExample, makeBaiError,
} from './problems';

export type TestProblem =
  | { kind: 'kihon'; level: KihonLevel; p: BaiTapeProblem }
  | { kind: 'times'; level: TimesLevel; p: BaseTimesProblem }
  | { kind: 'compare'; level: CompareLevel; p: BaseCompareProblem }
  | { kind: 'base'; level: BaseLevel; p: BaseBaseProblem }
  | { kind: 'ratio'; level: RatioCompareLevel; p: RatioCompareProblem }
  | { kind: 'word'; level: WordLevel; p: BaiWordProblem }
  | { kind: 'error'; preset: EhPreset; p: BaiErrorExample };

export type Section = '表' | '参考';

export interface TestStep {
  daimon: number;
  sub?: string;        // ①②③④⑤
  title: string;       // 大問の説明（採点画面・ヘッダ用）
  section: Section;
  points: number;      // 配点（参考は 0）
  gen: () => TestProblem;
}

const times = (level: TimesLevel): TestProblem => ({ kind: 'times', level, p: generateTimes(level) });
const compare = (level: CompareLevel): TestProblem => ({ kind: 'compare', level, p: generateCompare(level) });
const base = (level: BaseLevel): TestProblem => ({ kind: 'base', level, p: generateBase(level) });
const ratio = (level: RatioCompareLevel): TestProblem => ({ kind: 'ratio', level, p: generateRatioCompare(level) });

export const TEST_STEPS: TestStep[] = [
  /* ===== 表・知識技能（計100点） ===== */
  // 大問1: 何倍かを もとめる（イルカ型：くらべられる量 ÷ もとにする量）
  { daimon: 1, sub: '①', title: '何倍かを もとめる', section: '表', points: 5, gen: () => times('times-big') },
  { daimon: 1, sub: '②', title: '何倍かを もとめる', section: '表', points: 5, gen: () => times('times-big') },
  { daimon: 1, sub: '③', title: '何倍かを もとめる', section: '表', points: 5, gen: () => times('times-big') },
  { daimon: 1, sub: '④', title: '何倍かを もとめる', section: '表', points: 5, gen: () => times('times-big') },
  { daimon: 1, sub: '⑤', title: '何倍かを もとめる', section: '表', points: 5, gen: () => times('times-basic') },

  // 大問2: 何倍かにあたる量を もとめる（学校・ビル型：もとにする量 × 倍）
  { daimon: 2, sub: '①', title: '何倍かにあたる量を もとめる', section: '表', points: 5, gen: () => compare('compare-big') },
  { daimon: 2, sub: '②', title: '何倍かにあたる量を もとめる', section: '表', points: 5, gen: () => compare('compare-big') },
  { daimon: 2, sub: '③', title: '何倍かにあたる量を もとめる', section: '表', points: 5, gen: () => compare('compare-big') },
  { daimon: 2, sub: '④', title: '何倍かにあたる量を もとめる', section: '表', points: 5, gen: () => compare('compare-big') },
  { daimon: 2, sub: '⑤', title: '何倍かにあたる量を もとめる', section: '表', points: 5, gen: () => compare('compare-basic') },

  // 大問3: もとにする量を もとめる（りんご・メロン型：くらべられる量 ÷ 倍）
  { daimon: 3, sub: '①', title: 'もとにする量を もとめる', section: '表', points: 5, gen: () => base('base-big') },
  { daimon: 3, sub: '②', title: 'もとにする量を もとめる', section: '表', points: 5, gen: () => base('base-big') },
  { daimon: 3, sub: '③', title: 'もとにする量を もとめる', section: '表', points: 5, gen: () => base('base-big') },
  { daimon: 3, sub: '④', title: 'もとにする量を もとめる', section: '表', points: 5, gen: () => base('base-big') },
  { daimon: 3, sub: '⑤', title: 'もとにする量を もとめる', section: '表', points: 5, gen: () => base('base-basic') },

  // 大問4: 割合で くらべる（ゴムA・B型：2つの倍を もとめて くらべる）
  { daimon: 4, sub: '①', title: '割合で くらべる（Aの倍）', section: '表', points: 5, gen: () => ratio('ratio-compare-basic') },
  { daimon: 4, sub: '②', title: '割合で くらべる（Bの倍）', section: '表', points: 5, gen: () => ratio('ratio-compare-basic') },
  { daimon: 4, sub: '③', title: '割合で くらべる（どちらが大きいか）', section: '表', points: 5, gen: () => ratio('ratio-compare-basic') },
  { daimon: 4, sub: '④', title: '割合で くらべる（差は同じでも倍で見ると）', section: '表', points: 5, gen: () => ratio('ratio-compare-diff') },
  { daimon: 4, sub: '⑤', title: '割合で くらべる（差は同じでも倍で見ると）', section: '表', points: 5, gen: () => ratio('ratio-compare-diff') },

  /* ===== いかそう算数（参考・点数なし） ===== */
  // サンマ・イワシ型：差ではなく 倍で くらべる 気づき
  { daimon: 5, title: 'いかそう算数（差ではなく 倍で くらべる）', section: '参考', points: 0, gen: () => ratio('ratio-compare-diff') },
];

/**
 * テスト結果のきろく用に、各問題を「問題文」と「正しい答え」の文字列にする。
 * 児童の入力値そのものは保存せず、問題・正答・○×だけを残す。
 */
export function describeProblem(tp: TestProblem): { q: string; a: string } {
  switch (tp.kind) {
    case 'kihon': {
      const p = tp.p;
      const ans = p.missing === 'compare' ? p.compare : p.missing === 'times' ? p.times : p.base;
      return { q: `${p.scene.baseName} と ${p.scene.compareName}（${p.missing} を もとめる）`, a: String(ans) };
    }
    case 'times':
      return { q: `${tp.p.compare} ÷ ${tp.p.base}（何倍？）`, a: `${tp.p.times}倍` };
    case 'compare':
      return { q: `${tp.p.base} × ${tp.p.times}（何倍かにあたる量）`, a: `${tp.p.compare}${tp.p.scene.unit}` };
    case 'base':
      return { q: `${tp.p.compare} ÷ ${tp.p.times}（もとにする量）`, a: `${tp.p.base}${tp.p.scene.unit}` };
    case 'ratio':
      return {
        q: `${tp.p.pair.itemA}(${tp.p.beforeA}→${tp.p.afterA}) と ${tp.p.pair.itemB}(${tp.p.beforeB}→${tp.p.afterB}) はどちらが よく変化した？`,
        a: `${tp.p.pair.itemA}=${tp.p.timesA}倍・${tp.p.pair.itemB}=${tp.p.timesB}倍 → ${tp.p.biggerLabel === 'A' ? tp.p.pair.itemA : tp.p.pair.itemB}`,
      };
    case 'word':
      if (tp.p.kind === 'ratio') {
        return { q: tp.p.text, a: `${tp.p.biggerLabel === 'A' ? tp.p.pair?.itemA : tp.p.pair?.itemB}` };
      }
      return { q: tp.p.text, a: `${tp.p.finalAnswer}${tp.p.finalUnit}` };
    case 'error':
      return { q: `まちがい探し：${tp.p.wrongExpr}`, a: `正しくは ${tp.p.correctExpr}` };
  }
}

export const OMOTE_MAX = TEST_STEPS.filter((s) => s.section === '表').reduce((a, s) => a + s.points, 0); // 100
export const SANKOU_MAX = TEST_STEPS.filter((s) => s.section === '参考').reduce((a, s) => a + s.points, 0); // 0
export const TOTAL_MAX = OMOTE_MAX + SANKOU_MAX; // 100
