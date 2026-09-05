import type { Evaluation, LocalizedName, SelectedEnchantment } from '../core/types'
import type { ArmorId, SelectedArmorEnchantment } from '../core/armor'
import type { SelectedRangedEnchantment } from '../core/rangedTypes'
import { getEnchantmentRuntimeSupport } from '../core/runtimeSupport'
import { ARTIFACTS } from '../data/artifacts'
import { ARMORS, ARMOR_ENCHANTMENTS } from '../data/armors'
import { ENCHANTMENTS } from '../data/enchantments'
import { RANGED_ENCHANTMENTS, RANGED_WEAPONS } from '../data/ranged'
import { WEAPONS } from '../data/weapons'

const numberFormat = new Intl.NumberFormat('ja-JP', { maximumFractionDigits: 2 })
const TIER_LABELS = { 1: 'I', 2: 'II', 3: 'III' } as const
const SOURCE_LABELS = { slot: '通常枠', gilded: 'Gilded', 'built-in': 'Built-in' } as const

function BilingualName({ name }: { name: LocalizedName }) {
  return <span className="build-item-name"><strong>{name.ja}</strong><small lang="en">{name.en}</small></span>
}

function EnchantmentList({ enchantments }: { enchantments: readonly SelectedEnchantment[] }) {
  if (enchantments.length === 0) return <p className="empty-equipment">Enchantなし</p>
  return <ul className="build-enchantments">{enchantments.map((selected, index) => {
    const enchantment = ENCHANTMENTS[selected.enchantmentId]
    return <li key={`${selected.enchantmentId}-${selected.source}-${index}`}>
      <span className={`enchant-source ${selected.source}`}>{SOURCE_LABELS[selected.source]}</span>
      <span>{enchantment.name.ja} {TIER_LABELS[selected.tier]}<small lang="en">{enchantment.name.en}</small></span>
    </li>
  })}</ul>
}

function ArmorEnchantmentList({ enchantments = [] }: { enchantments?: readonly SelectedArmorEnchantment[] }) {
  if (enchantments.length === 0) return <p className="empty-equipment">Enchantなし</p>
  return <ul className="build-enchantments">{enchantments.map((selected, index) => {
    const enchantment = ARMOR_ENCHANTMENTS[selected.enchantmentId]
    return <li key={`${selected.enchantmentId}-${selected.source}-${index}`}>
      <span className={`enchant-source ${selected.source}`}>{SOURCE_LABELS[selected.source]}</span>
      <span>{enchantment.name.ja} {TIER_LABELS[selected.tier]}<small lang="en">{enchantment.name.en}</small></span>
    </li>
  })}</ul>
}

function RangedEnchantmentList({ enchantments = [] }: { enchantments?: readonly SelectedRangedEnchantment[] }) {
  if (enchantments.length === 0) return <p className="empty-equipment">Enchantなし</p>
  return <ul className="build-enchantments">{enchantments.map((selected, index) => {
    const enchantment = RANGED_ENCHANTMENTS[selected.enchantmentId]
    return <li key={`${selected.enchantmentId}-${selected.source}-${index}`}>
      <span className={`enchant-source ${selected.source}`}>{SOURCE_LABELS[selected.source]}</span>
      <span>{enchantment?.name.ja ?? selected.enchantmentId} {TIER_LABELS[selected.tier]}<small lang="en">{enchantment?.name.en ?? selected.enchantmentId}</small></span>
    </li>
  })}</ul>
}

function Metric({ label, value, detail }: { label: string; value: number; detail?: string }) {
  return <div className="metric"><span>{label}</span><strong>{numberFormat.format(value)}</strong>{detail && <small>{detail}</small>}</div>
}

export function RecommendedBuild({ evaluation }: { evaluation: Evaluation }) {
  const weapon = WEAPONS[evaluation.build.weapon.weaponId]
  const armorItem = evaluation.build.armor
  const armor = armorItem ? ARMORS[armorItem.armorId as ArmorId] : undefined
  const rangedItem = evaluation.build.rangedWeapon
  const ranged = rangedItem ? RANGED_WEAPONS[rangedItem.weaponId] : undefined
  const limitedMelee = [...new Set(evaluation.build.enchantments.map((item) => item.enchantmentId))]
    .some((id) => getEnchantmentRuntimeSupport(id).supportLevel === 'limited')
  return <article className="result-card recommended-build" aria-labelledby="recommended-build-title">
    <header className="result-heading">
      <div><p className="eyebrow">おすすめビルド</p><h2 id="recommended-build-title">この装備セットを使う</h2></div>
      <div className="score"><span>総合スコア / 100</span><strong>{numberFormat.format(evaluation.objectiveScore)}</strong></div>
    </header>

    <div className="build-equipment-grid">
      <section className="build-equipment melee" aria-label="近接">
        <div className="build-equipment-heading"><p>近接</p>{limitedMelee && <span className="support limited">Limited</span>}</div>
        <h3 id="recommended-melee"><BilingualName name={weapon.name} /><span>Power {evaluation.build.weapon.powerLevel}</span></h3>
        <EnchantmentList enchantments={evaluation.build.enchantments} />
      </section>
      <section className="build-equipment armor" aria-label="防具">
        <div className="build-equipment-heading"><p>防具</p>{armor && <span className="support limited">Limited</span>}</div>
        <h3 id="recommended-armor">{armor && armorItem ? <><BilingualName name={armor.name} /><span>Power {armorItem.powerLevel}</span></> : <span className="empty-equipment">未選択</span>}</h3>
        {armor && <ArmorEnchantmentList enchantments={evaluation.build.armorEnchantments} />}
      </section>
      <section className="build-equipment ranged" aria-label="遠距離">
        <div className="build-equipment-heading"><p>遠距離</p>{ranged && <span className="support limited">Limited</span>}</div>
        <h3 id="recommended-ranged">{ranged && rangedItem ? <><BilingualName name={ranged.name} /><span>Power {rangedItem.powerLevel}</span></> : <span className="empty-equipment">未選択</span>}</h3>
        {ranged && <RangedEnchantmentList enchantments={evaluation.build.rangedEnchantments} />}
      </section>
      <section className="build-equipment artifacts" aria-label="Artifact">
        <div className="build-equipment-heading"><p>Artifact</p></div>
        <h3 id="recommended-artifacts" className="sr-only">Artifact 3枠</h3>
        <ol className="artifact-slots">{Array.from({ length: 3 }, (_, index) => {
          const item = evaluation.build.artifacts[index]
          if (!item) return <li key={`empty-${index}`}><span>枠 {index + 1}</span><span className="empty-equipment">未選択</span></li>
          const definition = ARTIFACTS[item.artifactId]
          return <li key={item.instanceId}><span>枠 {index + 1}</span><span className="build-artifact-info"><BilingualName name={definition.name} /><small>Power {item.powerLevel}{item.artifactId === 'shock-powder' ? ' · Limited' : ''}</small></span></li>
        })}</ol>
      </section>
    </div>

    <section className="primary-metrics" aria-label="おすすめビルドの主要評価">
      <Metric label="Damage / 単体DPS" value={evaluation.damage.singleTargetDps} detail={`AoE ${numberFormat.format(evaluation.damage.aoeDps)}`} />
      <Metric label="Healing / 秒" value={evaluation.healing.totalPerSecond} />
      <Metric label="Defense / 実効HP" value={evaluation.defense.effectiveHealth} />
      <Metric label="Control / 100" value={evaluation.control.utility * 100} />
    </section>
  </article>
}

function difference(value: number, baseline: number) {
  if (baseline === 0) return null
  const percent = ((value - baseline) / Math.abs(baseline)) * 100
  return `${percent >= 0 ? '+' : ''}${numberFormat.format(percent)}%`
}

export function BuildAlternative({ evaluation, best, title = '次点候補' }: { evaluation: Evaluation; best: Evaluation; title?: string }) {
  const weapon = WEAPONS[evaluation.build.weapon.weaponId]
  const armor = evaluation.build.armor ? ARMORS[evaluation.build.armor.armorId as ArmorId].name.ja : 'なし'
  const ranged = evaluation.build.rangedWeapon ? RANGED_WEAPONS[evaluation.build.rangedWeapon.weaponId]?.name.ja ?? evaluation.build.rangedWeapon.weaponId : 'なし'
  const artifacts = evaluation.build.artifacts.map((item) => ARTIFACTS[item.artifactId].name.ja).join(' / ') || 'なし'
  const scoreDelta = evaluation.objectiveScore - best.objectiveScore
  return <article className="result-card compact build-alternative">
    <header><p className="eyebrow">{title}</p><div className="alternative-score"><strong>{numberFormat.format(evaluation.objectiveScore)}</strong><span>1位との差 {scoreDelta >= 0 ? '+' : ''}{numberFormat.format(scoreDelta)}</span></div></header>
    <dl className="alternative-equipment"><dt>近接</dt><dd>{weapon.name.ja}<small lang="en">{weapon.name.en}</small></dd><dt>防具</dt><dd>{armor}</dd><dt>遠距離</dt><dd>{ranged}</dd><dt>Artifact</dt><dd>{artifacts}</dd></dl>
    <dl className="alternative-deltas"><div><dt>Damage</dt><dd>{difference(evaluation.damage.singleTargetDps, best.damage.singleTargetDps) ?? '比較不可'}</dd></div><div><dt>Defense</dt><dd>{difference(evaluation.defense.effectiveHealth, best.defense.effectiveHealth) ?? '比較不可'}</dd></div></dl>
  </article>
}
