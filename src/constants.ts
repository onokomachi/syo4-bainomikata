import { ModuleId } from './store/progressStore';

/**
 * 「倍の見方ラボ」のモジュール一覧。
 * 単元「倍の見方（小4）」で身につける知識・技能を段階的に網羅する。
 */
export interface ModuleMeta {
  id: ModuleId;
  title: string;
  description: string;
  /** lucide-react のアイコン名 */
  icon: string;
  /** Tailwind の色トークン（カードのアクセント） */
  accent: string;
  status: 'ready' | 'soon';
}

export const MODULES: ModuleMeta[] = [
  {
    id: 'kihon',
    title: '基礎：倍の見方',
    description: 'もとにする量・倍・くらべられる量の 関係を おぼえよう',
    icon: 'Sprout',
    accent: 'sky',
    status: 'ready',
  },
  {
    id: 'times',
    title: '何倍かを もとめる',
    description: 'くらべられる量 ÷ もとにする量 ＝ 倍',
    icon: 'Divide',
    accent: 'blue',
    status: 'ready',
  },
  {
    id: 'compare',
    title: '何倍かにあたる量',
    description: 'もとにする量 × 倍 ＝ くらべられる量',
    icon: 'X',
    accent: 'emerald',
    status: 'ready',
  },
  {
    id: 'base',
    title: 'もとにする量',
    description: 'くらべられる量 ÷ 倍 ＝ もとにする量',
    icon: 'Undo2',
    accent: 'violet',
    status: 'ready',
  },
  {
    id: 'ratio-compare',
    title: '割合で くらべる',
    description: '差ではなく 倍で 2つを くらべよう',
    icon: 'Scale',
    accent: 'fuchsia',
    status: 'ready',
  },
  {
    id: 'word-problem',
    title: 'ことばの もんだい',
    description: 'どんな関係かな？ しきを 考えよう',
    icon: 'BookOpen',
    accent: 'teal',
    status: 'ready',
  },
  {
    id: 'error-hunter',
    title: 'エラーハンター',
    description: 'まちがいを 見つけて なおそう',
    icon: 'Search',
    accent: 'rose',
    status: 'ready',
  },
];
