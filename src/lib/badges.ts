/**
 * ごほうびバッジ。進捗データから「獲得済み/未獲得」を計算する純粋関数。
 * バッジ等の報酬で学習意欲・自信を持続させ、算数不安を下げる（GBLE）。
 */
import { MODULES } from '../constants';

export interface BadgeData {
  totalCorrect: number;
  maxStreak: number;
  moduleCounts: Record<string, number>;
  // 本番テストの自己ベスト得点（表/裏/両面）
  bestTestOmote?: number;
  bestTestUra?: number;
  bestTestTotal?: number;
  // 満点をとった回数（表/裏/両面。くり返し満点という高難度の達成を評価する）
  testPerfectCounts?: { omote: number; ura: number; total: number };
  // 習熟度MAX（5連続ノーミス）を達成したモジュール
  masteredModules?: Record<string, boolean>;
}

export interface Badge {
  id: string;
  title: string;
  desc: string;
  icon: string; // lucide アイコン名
  earned: boolean;
}

export function computeBadges(d: BadgeData): Badge[] {
  const omote = d.bestTestOmote ?? 0;
  const list: Badge[] = [
    { id: 'first', title: 'はじめの一歩', desc: '1問 クリア', icon: 'Star', earned: d.totalCorrect >= 1 },
    // がんばり（累計クリア数）
    { id: 't20', title: 'がんばり20', desc: '累計20問 クリア', icon: 'Sparkles', earned: d.totalCorrect >= 20 },
    { id: 't30', title: 'がんばり30', desc: '累計30問 クリア', icon: 'Medal', earned: d.totalCorrect >= 30 },
    { id: 't50', title: 'がんばり50', desc: '累計50問 クリア', icon: 'Award', earned: d.totalCorrect >= 50 },
    { id: 't100', title: 'がんばり100', desc: '累計100問 クリア', icon: 'Trophy', earned: d.totalCorrect >= 100 },
    // ノーミス（連続ノーミス記録）
    { id: 's5', title: 'ノーミス5', desc: '5問連続 ノーミス', icon: 'Flame', earned: d.maxStreak >= 5 },
    { id: 's10', title: 'ノーミス10', desc: '10問連続 ノーミス', icon: 'Crown', earned: d.maxStreak >= 10 },
    { id: 's20', title: 'ノーミス20', desc: '20問連続 ノーミス', icon: 'Zap', earned: d.maxStreak >= 20 },
    { id: 's30', title: 'ノーミス30', desc: '30問連続 ノーミス', icon: 'Target', earned: d.maxStreak >= 30 },
    { id: 's50', title: 'ノーミス50', desc: '50問連続 ノーミス', icon: 'Rocket', earned: d.maxStreak >= 50 },
    // 本番テスト（表・知識技能のみ満点100。この単元のテストに「裏50点」は無いため、
    // 裏・両面（表＋裏）のバッジは作らない：uraMaxが常に0のため永久に獲得できず、
    // 最終称号を含む全バッジ未達成を招くバグになるのを避けている）
    { id: 'to50', title: 'テスト50', desc: 'テストで 50点いじょう', icon: 'ClipboardCheck', earned: omote >= 50 },
    { id: 'to75', title: 'テスト75', desc: 'テストで 75点いじょう', icon: 'ClipboardCheck', earned: omote >= 75 },
    { id: 'to90', title: 'テスト90', desc: 'テストで 90点いじょう', icon: 'ClipboardCheck', earned: omote >= 90 },
    { id: 'to100', title: 'テスト満点', desc: 'テストで 100点', icon: 'Trophy', earned: omote >= 100 },
    // くり返し満点（高難度・2段階）: 一度の満点より ずっと むずかしい「安定して満点」を評価する。
    // 10回は子どもには挫折ラインになりやすいため、上限は5回までにとどめる。
    { id: 'to100x3', title: 'テストマイスターI', desc: 'テストで 満点を 3回', icon: 'ShieldCheck', earned: (d.testPerfectCounts?.omote ?? 0) >= 3 },
    { id: 'to100x5', title: 'テストマイスターII', desc: 'テストで 満点を 5回', icon: 'ShieldCheck', earned: (d.testPerfectCounts?.omote ?? 0) >= 5 },
  ];
  MODULES.forEach((m) =>
    list.push({
      id: `m-${m.id}`,
      title: `${m.title} デビュー`,
      desc: 'はじめて クリア',
      icon: m.icon,
      earned: (d.moduleCounts[m.id] || 0) >= 1,
    })
  );
  // 各モジュールの「習熟度MAX」バッジ（あるスキルで5問連続ノーミス＝熟達バー満タン）
  MODULES.forEach((m) =>
    list.push({
      id: `mx-${m.id}`,
      title: `${m.title} マスター`,
      desc: '習熟度MAX たっせい',
      icon: 'Crown',
      earned: !!(d.masteredModules && d.masteredModules[m.id]),
    })
  );
  // 最後の称号「【倍の見方】神」: ほかの全バッジを獲得したときだけ手に入る。
  // （この時点の list には自分以外の全バッジが入っているので every で判定）
  list.push({
    id: 'god',
    title: '【倍の見方】神',
    desc: 'すべての バッジを かくとく',
    icon: 'Crown',
    earned: list.every((b) => b.earned),
  });
  return list;
}

/** 獲得バッジの割合（0..1）。テーマ解放の判定に使う。 */
export function badgeRatio(d: BadgeData): number {
  const list = computeBadges(d);
  if (list.length === 0) return 0;
  return list.filter((b) => b.earned).length / list.length;
}
