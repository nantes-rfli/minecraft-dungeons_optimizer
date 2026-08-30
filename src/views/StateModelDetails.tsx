import type { Evaluation } from '../core/types'

export function StateModelDetails({ evaluation }: { evaluation: Evaluation }) {
  const { potionState: potion, defense } = evaluation
  const has = (id: string) => evaluation.build.enchantments.some((item) => item.enchantmentId === id)
  return <>
    {has('refreshment') && <details className="contributions">
      <summary>Health Potionの推定CD・追加回復容量</summary>
      <p>基礎CD {potion.baseCooldownSeconds}秒 → 推定CD {potion.effectiveCooldownSeconds.toFixed(2)}秒。直接撃破 {potion.directWeaponKillsPerSecond.toFixed(2)}/秒、撃破ごとに{potion.refreshmentReductionPerDirectKillSeconds}秒短縮。</p>
      <p>推定使用頻度 {potion.estimatedUsesPerSecond.toFixed(4)}/秒（基礎 {potion.baseUsesPerSecond.toFixed(4)}/秒）。1回の回復容量 {potion.healPerUse.toFixed(2)}（最大HPの約75%）。</p>
      <p>Refreshment healing capacity: +{potion.incrementalHealingCapacityPerSecond.toFixed(2)}/秒。回復指標・スコアは追加容量だけを含みます。一定の直接撃破と即再使用を仮定したlow-confidence近似で、実回復量ではありません。ArtifactのCD短縮は適用しません。</p>
    </details>}
    {has('weakening') && <details className="contributions">
      <summary>Weakeningの被ダメージ割合・防御との合成</summary>
      <p>弱体化対象の被ダメージ割合 {(defense.weakeningAffectedIncomingDamageShare * 100).toFixed(0)}%、対象の攻撃ダメージ軽減 {(defense.weakeningDamageReduction * 100).toFixed(0)}%。敵攻撃ダメージ倍率 {defense.weakeningEnemyDamageMultiplier.toFixed(3)}。</p>
      <p>敵倍率 {defense.weakeningEnemyDamageMultiplier.toFixed(3)} × Artifact倍率 {defense.artifactDamageTakenMultiplier.toFixed(3)} × Guarding Strike倍率 {defense.guardingStrikeDamageTakenMultiplier.toFixed(3)} = 最終被ダメージ倍率 {defense.damageTakenMultiplier.toFixed(3)}。</p>
      <p>攻撃で周囲の敵へ{defense.weakeningDurationSeconds}秒適用。割合は効果時間・位置・攻撃稼働率を含む仮定で、効果時間を再度掛けません。敵の攻撃力低下とheroの防御は別の段階です。</p>
    </details>}
  </>
}
