/**
 * 「時空神」限定「ボス戦」モードの純粋ロジック（わり算ランドのボス戦システムを移植）。
 * 単元の全スキル（基礎・何倍か・何倍かにあたる量・もとにする量・割合でくらべる・文章題・
 * エラーハンター）から、習熟度が低いスキルほど出やすいように重みつきで問題を選ぶ。
 * 戦闘は「ボス独立タイマー＋プレイヤーはアクションポイントで行動選択」のRPG風システム：
 * ボスはプレイヤーの解答状況と無関係に一定間隔で通常攻撃／タメ攻撃を自動発動し、
 * プレイヤーは問題に正解して貯めたアクションポイントを使って「こうげき／かいふく／ガード」を選ぶ。
 * UI（動画・HPバー・ゲージ表示）は BossBattleModule 側が担当する。
 */
import {
  KIHON_LEVELS, KihonLevel, generateKihon,
  TIMES_LEVELS, TimesLevel, generateTimes,
  COMPARE_LEVELS, CompareLevel, generateCompare,
  BASE_LEVELS, BaseLevel, generateBase,
  RATIO_COMPARE_LEVELS, RatioCompareLevel, generateRatioCompare,
  WORD_LEVELS, WordLevel, generateWord,
  EhPreset, makeBaiError,
} from './problems';
import { TestProblem } from './testConfig';

export type BossTier = 'normal' | 'hard' | 'god';

export interface TierConfig {
  id: BossTier;
  label: string;
  subtitle: string;
  /** 1回のバトルで出題される最大問題数（ボスを倒せば途中で終わる） */
  questionCount: number;
  /** 基準タイム（baseSeconds）に掛ける倍率。小さいほど1問の制限時間がきびしい。 */
  timeMultiplier: number;
  hp: number;
  /** ボスの行動ゲージが1周してから次の行動を起こすまでの秒数。短いほど攻撃が速い。 */
  actionCycleSec: number;
  /** ボスの行動が「タメ攻撃（必殺技）」になる確率（0..1）。高いほど大技が多い。 */
  chargeChance: number;
  /** ボスの攻撃が ガードされなかったときに プレイヤーが受けるダメージ */
  attackDamageToPlayer: { normal: number; charge: number };
  /** プレイヤーが「こうげき」を選んだときに ボスへ与えるダメージ */
  attackDamageToBoss: number;
  /** プレイヤーが「かいふく」を選んだときに 回復するHP量 */
  healAmount: number;
}

export const BOSS_TIERS: Record<BossTier, TierConfig> = {
  normal: {
    id: 'normal', label: 'Normal', subtitle: 'ゆっくり戦えるれんしゅう戦',
    questionCount: 15, timeMultiplier: 1.4, hp: 100,
    actionCycleSec: 45, chargeChance: 0.15,
    attackDamageToPlayer: { normal: 12, charge: 26 },
    attackDamageToBoss: 15, healAmount: 20,
  },
  hard: {
    id: 'hard', label: 'Hard', subtitle: '本番テストと同じくらいのペース',
    questionCount: 25, timeMultiplier: 1.0, hp: 100,
    actionCycleSec: 30, chargeChance: 0.25,
    attackDamageToPlayer: { normal: 16, charge: 34 },
    attackDamageToBoss: 11, healAmount: 16,
  },
  god: {
    id: 'god', label: 'GOD', subtitle: '本番テストより速い、真の実力者むけ',
    questionCount: 19, timeMultiplier: 0.7, hp: 100,
    actionCycleSec: 20, chargeChance: 0.35,
    attackDamageToPlayer: { normal: 20, charge: 44 },
    attackDamageToBoss: 9, healAmount: 12,
  },
};

export interface SkillStat { attempts: number; corrects: number }

/** 習熟度が低い（正答率が低い）スキルほど大きい重みを返す。未挑戦は標準の重み。 */
export function weightForSkill(skillId: string, mastery: Record<string, SkillStat>): number {
  const m = mastery[skillId];
  if (!m || m.attempts === 0) return 1;
  const accuracy = m.corrects / m.attempts;
  return 1 + (1 - accuracy) * 3;
}

/** 重みに比例した確率で1件だけ選ぶ（重い項目ほど選ばれやすい）。 */
function weightedPick<T>(items: { item: T; weight: number }[]): T {
  const total = items.reduce((a, x) => a + x.weight, 0);
  let r = Math.random() * total;
  for (const x of items) {
    r -= x.weight;
    if (r <= 0) return x.item;
  }
  return items[items.length - 1].item;
}

/** 出題プールの1エントリ。単元の全レベルを1問ずつのフラットな配列にする。 */
interface BossPoolEntry {
  skillId: string;
  points: 1 | 2; // 2＝時間がかかる分、正解時のアクションポイントも多い
  baseSec: number; // 素の制限時間（秒）。本番テストの実時間感覚から逆算した目安値。
  gen: () => TestProblem;
}

const BOSS_POOL: BossPoolEntry[] = [
  ...KIHON_LEVELS.map((l): BossPoolEntry => ({
    skillId: l.id, points: 1, baseSec: 16,
    gen: () => ({ kind: 'kihon', level: l.id as KihonLevel, p: generateKihon(l.id) }),
  })),
  ...TIMES_LEVELS.map((l): BossPoolEntry => ({
    skillId: l.id, points: l.id === 'times-big' ? 2 : 1, baseSec: l.id === 'times-big' ? 22 : 16,
    gen: () => ({ kind: 'times', level: l.id as TimesLevel, p: generateTimes(l.id) }),
  })),
  ...COMPARE_LEVELS.map((l): BossPoolEntry => ({
    skillId: l.id, points: l.id === 'compare-big' ? 2 : 1, baseSec: l.id === 'compare-big' ? 22 : 16,
    gen: () => ({ kind: 'compare', level: l.id as CompareLevel, p: generateCompare(l.id) }),
  })),
  ...BASE_LEVELS.map((l): BossPoolEntry => ({
    skillId: l.id, points: l.id === 'base-big' ? 2 : 1, baseSec: l.id === 'base-big' ? 24 : 18,
    gen: () => ({ kind: 'base', level: l.id as BaseLevel, p: generateBase(l.id) }),
  })),
  ...RATIO_COMPARE_LEVELS.map((l): BossPoolEntry => ({
    skillId: l.id, points: 2, baseSec: 20,
    gen: () => ({ kind: 'ratio', level: l.id as RatioCompareLevel, p: generateRatioCompare(l.id) }),
  })),
  ...WORD_LEVELS.map((l): BossPoolEntry => ({
    skillId: l.id, points: 2, baseSec: 32,
    gen: () => ({ kind: 'word', level: l.id as WordLevel, p: generateWord(l.id) }),
  })),
  ...(['eh-swap', 'eh-diff', 'eh-muldiv', 'eh-order'] as EhPreset[]).map((preset): BossPoolEntry => ({
    skillId: preset, points: 2, baseSec: 26,
    gen: () => ({ kind: 'error', preset, p: makeBaiError(preset) }),
  })),
];

export interface BossQuestion {
  skillId: string;
  problem: TestProblem;
  isBig: boolean;
  timeLimitSec: number;
  /** 正解でもらえるアクションポイント（ふつう1・大きい問題は2） */
  pointReward: number;
}

/** ティアと習熟度データから、1バトル分の出題列をつくる（苦手なスキルほど出やすい）。 */
export function pickBossQuestions(tier: BossTier, mastery: Record<string, SkillStat>): BossQuestion[] {
  const config = BOSS_TIERS[tier];
  const weighted = BOSS_POOL.map((entry) => ({ item: entry, weight: weightForSkill(entry.skillId, mastery) }));

  // 重みに比例した確率で毎回1問ずつ選ぶ（苦手なスキルほど出やすい）。
  // 同じスキルが連続しがちなときは1回だけ引き直して、極端な連続出題をやわらげる。
  const order: BossPoolEntry[] = [];
  let lastSkillId: string | null = null;
  for (let i = 0; i < config.questionCount; i++) {
    let picked = weightedPick(weighted);
    if (picked.skillId === lastSkillId && BOSS_POOL.length > 1) {
      picked = weightedPick(weighted);
    }
    order.push(picked);
    lastSkillId = picked.skillId;
  }

  return order.map((entry) => {
    const isBig = entry.points === 2;
    const timeLimitSec = Math.max(8, Math.round(entry.baseSec * config.timeMultiplier));
    return { skillId: entry.skillId, problem: entry.gen(), isBig, timeLimitSec, pointReward: entry.points };
  });
}

export type BossActionKind = 'normal' | 'charge';

/** ボスの行動ゲージが満タンになったとき、次の行動が通常攻撃かタメ攻撃かを抽選する。 */
export function rollBossAction(tier: BossTier): BossActionKind {
  return Math.random() < BOSS_TIERS[tier].chargeChance ? 'charge' : 'normal';
}

/** ボスの攻撃がガードされなかったときに プレイヤーが受けるダメージ。 */
export function damageToPlayer(tier: BossTier, action: BossActionKind): number {
  const cfg = BOSS_TIERS[tier];
  return action === 'charge' ? cfg.attackDamageToPlayer.charge : cfg.attackDamageToPlayer.normal;
}
