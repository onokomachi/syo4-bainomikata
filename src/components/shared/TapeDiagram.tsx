/**
 * テープ図（帯グラフ）。基準量（もとにする量）と比較量（くらべられる量）の
 * 比率を横棒で視覚的に表現する。「倍の見方」の理解を助ける共通パーツ。
 */
import React from 'react';

interface Props {
  baseLabel: string;
  compareLabel: string;
  /** 基準量の目盛り数（＝1とみる長さ）。省略時は1。 */
  baseUnits?: number;
  /** 比較量の目盛り数（＝倍）。 */
  compareUnits: number;
  baseValue?: number | string;
  compareValue?: number | string;
  maxUnits?: number; // 表示の最大目盛り（はみ出し防止）
}

export const TapeDiagram: React.FC<Props> = ({
  baseLabel, compareLabel, baseUnits = 1, compareUnits, baseValue, compareValue, maxUnits = 10,
}) => {
  const shownCompare = Math.min(compareUnits, maxUnits);
  const barBase = Math.max(8, (baseUnits / Math.max(baseUnits, shownCompare)) * 100);
  const barCompare = Math.max(8, (shownCompare / Math.max(baseUnits, shownCompare)) * 100);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="w-24 shrink-0 text-xs font-black text-muted truncate">{baseLabel}</span>
        <div className="flex-1 h-8 rounded-lg bg-surface-3 overflow-hidden flex">
          <div
            className="h-full bg-sky-400 flex items-center justify-center text-white text-xs font-black"
            style={{ width: `${barBase}%` }}
          >
            {baseValue !== undefined ? baseValue : '1'}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="w-24 shrink-0 text-xs font-black text-muted truncate">{compareLabel}</span>
        <div className="flex-1 h-8 rounded-lg bg-surface-3 overflow-hidden flex">
          <div
            className="h-full bg-rose-400 flex items-center justify-center text-white text-xs font-black"
            style={{ width: `${barCompare}%` }}
          >
            {compareValue !== undefined ? compareValue : compareUnits}
          </div>
        </div>
      </div>
    </div>
  );
};
