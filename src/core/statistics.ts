export function median(values: readonly number[]): number {
  if (values.length === 0) throw new Error('中央値には1件以上の値が必要です。')
  const sorted = [...values].sort((left, right) => left - right)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 1
    ? sorted[middle]!
    : (sorted[middle - 1]! + sorted[middle]!) / 2
}

export function nearestRankPercentile(
  values: readonly number[],
  percentile: number,
): number {
  if (values.length === 0) throw new Error('パーセンタイルには1件以上の値が必要です。')
  if (!Number.isFinite(percentile) || percentile <= 0 || percentile > 1) {
    throw new Error('パーセンタイルは0より大きく1以下で指定してください。')
  }
  const sorted = [...values].sort((left, right) => left - right)
  return sorted[Math.ceil(percentile * sorted.length) - 1]!
}
