import { ARMORS } from '../data/armors'
import { RANGED_ENCHANTMENTS, RANGED_LIMITATIONS, RANGED_WEAPONS, isRuntimeRangedEnchantment, isRuntimeRangedWeapon } from '../data/ranged'
import { isAuditedRangedEnchantment, isAuditedRangedWeapon } from '../research/rangedAudit'
import { OptimizerInputError } from './errors'
import type { OwnedRangedWeapon, RangedDamageState, RangedRoll, RangedShotMode, SelectedRangedEnchantment } from './rangedTypes'
import type { Build, DamageMetrics, EnchantmentTier, Scenario } from './types'

const fail = (message: string): never => { throw new OptimizerInputError('INVALID_RANGED', message) }
const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
const text = (value: unknown, field: string): string => typeof value === 'string' && value.trim() ? value : fail(`${field}: 空でない文字列が必要です。`)
const number = (value: unknown, field: string, minimum: number, integer = false): number => typeof value === 'number' && Number.isFinite(value) && value >= minimum && (!integer || Number.isSafeInteger(value)) ? value : fail(`${field}: ${minimum}以上の有限${integer ? '整数' : '数値'}が必要です。`)
function roll(value: unknown): RangedRoll {
  if (!record(value)) return fail('Ranged Enchant roll形式が不正です。')
  const id = text(value.enchantmentId, 'enchantmentId')
  if (!isAuditedRangedEnchantment(id) || ![1, 2, 3].includes(value.tier as number)) return fail(`未監査Enchantまたは不正Tier: ${id}`)
  return { enchantmentId: id, tier: value.tier as EnchantmentTier }
}

/** Storage accepts audited research-only rolls, but never silently discards invalid data. */
export function parseRangedWeapon(value: unknown): OwnedRangedWeapon {
  if (!record(value)) return fail('Ranged個体の形式が不正です。')
  const weaponId = text(value.weaponId, 'weaponId')
  if (!isAuditedRangedWeapon(weaponId)) return fail(`未監査Ranged weapon: ${weaponId}`)
  if (!Array.isArray(value.enchantmentSlots) || value.enchantmentSlots.length > 3) return fail('Rangedスロットは0〜3個です（0はEnchantなし）。')
  const slots = value.enchantmentSlots.map((slot) => {
    if (!record(slot) || !Array.isArray(slot.candidates) || slot.candidates.length < 1 || slot.candidates.length > 3) return fail('Ranged各スロットの候補は1〜3個です。')
    const legacyTiers = new Map<string, EnchantmentTier>()
    const candidates = slot.candidates.map((candidate) => {
      if (typeof candidate === 'string') {
        if (!isAuditedRangedEnchantment(candidate)) return fail(`未監査Ranged Enchant: ${candidate}`)
        return candidate
      }
      const parsed = roll(candidate); legacyTiers.set(parsed.enchantmentId, parsed.tier); return parsed.enchantmentId
    })
    if (new Set(candidates).size !== candidates.length) return fail('Rangedスロットの候補IDが重複しています。')
    const rawSelected = slot.selected ?? (slot.locked === undefined ? undefined : { enchantmentId: slot.locked, tier: legacyTiers.get(String(slot.locked)) })
    const selected = rawSelected === undefined ? undefined : roll(rawSelected)
    if (selected && !candidates.includes(selected.enchantmentId)) return fail('Ranged selectedは候補内から選択してください。')
    return { candidates, ...(selected ? { selected } : {}) }
  })
  let observation: OwnedRangedWeapon['observation']
  if (value.observation !== undefined) {
    const item = value.observation
    if (!record(item) || item.gameVersion !== '1.17.0.0' || !['uncharged', 'charged', 'single'].includes(item.mode as string)) return fail('Ranged observationのversion/modeが不正です。')
    observation = { gameVersion: '1.17.0.0', mode: item.mode as RangedShotMode,
      projectileDamage: number(item.projectileDamage, 'projectileDamage', Number.EPSILON),
      shotCycleSeconds: number(item.shotCycleSeconds, 'shotCycleSeconds', Number.EPSILON),
      availableAmmo: number(item.availableAmmo, 'availableAmmo', 0, true), sourceNote: text(item.sourceNote, 'sourceNote') }
  }
  if (value.rarity !== undefined && !['common', 'rare', 'unique'].includes(value.rarity as string)) fail('rarityはcommon / rare / uniqueのいずれかにしてください。')
  const notes = value.notes === undefined || value.notes === '' ? undefined : text(value.notes, 'notes')
  const isFavorite = value.isFavorite === undefined ? undefined : typeof value.isFavorite === 'boolean' ? value.isFavorite : fail('isFavorite: booleanが必要です。')
  return { instanceId: text(value.instanceId, 'instanceId'), weaponId, powerLevel: number(value.powerLevel, 'powerLevel', 1, true),
    enchantmentSlots: slots, ...(value.gilded === undefined ? {} : { gilded: roll(value.gilded) }), ...(observation ? { observation } : {}),
    ...(value.rarity === undefined ? {} : { rarity: value.rarity as OwnedRangedWeapon['rarity'] }), ...(isFavorite === undefined ? {} : { isFavorite }), ...(notes ? { notes } : {}) }
}

export function rangedWeaponUnsupportedReason(weapon: OwnedRangedWeapon): string | null {
  if (!isRuntimeRangedWeapon(weapon.weaponId)) return `${weapon.weaponId}: Research-only。固有効果を無視した評価はできません。`
  if (!weapon.observation) return `${weapon.weaponId}: neutral projectile damage・完全発射周期・矢数・観測メモが必要です。`
  if (!RANGED_WEAPONS[weapon.weaponId]!.modes.includes(weapon.observation.mode)) return `${weapon.weaponId}: shot modeが一致しません。`
  for (const slot of weapon.enchantmentSlots) {
    const candidates = slot.candidates.map((candidate) => typeof candidate === 'string' ? candidate : (candidate as RangedRoll).enchantmentId)
    const locked = (slot as { locked?: string }).locked
    const effective = slot.selected ? [slot.selected.enchantmentId] : locked ? [locked] : candidates
    if (effective.some((id) => !isRuntimeRangedEnchantment(id))) return `${weapon.weaponId}: 未対応候補を含む自由スロットです。対応候補を選択するか別個体を選択してください。`
  }
  if (weapon.gilded && !isRuntimeRangedEnchantment(weapon.gilded.enchantmentId)) return `${weapon.weaponId}: 金色EnchantがResearch-onlyです。`
  return null
}

export function rangedOptions(weapon: OwnedRangedWeapon): readonly SelectedRangedEnchantment[][] {
  const groups = weapon.enchantmentSlots.map((slot) => {
    const candidates = slot.candidates.map((candidate) => typeof candidate === 'string' ? { enchantmentId: candidate, tier: 3 as const } : candidate as RangedRoll)
    const locked = (slot as { locked?: string }).locked
    return slot.selected ? [slot.selected] : locked ? candidates.filter((candidate) => candidate.enchantmentId === locked) : candidates
  })
  const products = groups.reduce<RangedRoll[][]>((out, group) => out.flatMap((product) => group.map((item) => [...product, item])), [[]])
  return products.map((items) => [...items.map((item) => ({ ...item, source: 'slot' as const })), ...(weapon.gilded ? [{ ...weapon.gilded, source: 'gilded' as const }] : [])])
    .filter((items) => new Set(items.map((item) => item.enchantmentId)).size === items.length)
}

export function rangedCombinationUnsupportedReason(build: Build, scenario: Scenario): string | null {
  if (!build.rangedWeapon) return build.rangedEnchantments?.length ? 'Ranged weaponなしでEnchantを指定できません。' : null
  const share = scenario.rangedTimeShare
  if (share === undefined || !Number.isFinite(share) || share <= 0 || share >= 1) return 'Ranged使用時は0より大きく1未満の遠距離時間割合を明示してください。近接なし専用buildは未対応です。'
  const unsupported = rangedWeaponUnsupportedReason(build.rangedWeapon)
  if (unsupported) return unsupported
  const allowedMelee = ['critical-hit', 'sharpness', 'unchanting', 'smiting', 'radiance', 'leeching', 'guarding-strike', 'refreshment']
  const incompatible = build.enchantments.find((item) => !allowedMelee.includes(item.enchantmentId))
  if (incompatible) return `Rangedと${incompatible.enchantmentId}の共有target/時間/trigger interactionは未検証です。`
  if (build.weapon.weaponId === 'soul-scythe') return 'RangedとSoul Gatheringの撃破帰属は未検証です。'
  if (build.armor) {
    const armor = ARMORS[build.armor.armorId as keyof typeof ARMORS]
    if (!armor || armor.weaponDamageAuraBonus > 0 || armor.lifeStealFraction > 0 || armor.soulGatheringMultiplier > 1) return 'このArmorとRangedのaura/Life Steal/Soul interactionはResearch-onlyです。'
    if (build.armorEnchantments?.some((item) => item.enchantmentId === 'cowardice')) return 'CowardiceとRangedのstackingはResearch-onlyです。'
  }
  return null
}

export function validateRangedBuild(build: Build, scenario?: Scenario): void {
  if (!build.rangedWeapon) {
    if (build.rangedEnchantments?.length) fail('Ranged weaponなしでEnchantを指定できません。')
    return
  }
  parseRangedWeapon(build.rangedWeapon)
  if (!scenario) fail('Ranged buildの検証にはscenarioが必要です。')
  const reason = rangedCombinationUnsupportedReason(build, scenario!)
  if (reason) fail(reason)
  const selected = build.rangedEnchantments ?? []
  const legal = rangedOptions(build.rangedWeapon).some((items) => items.length === selected.length && items.every((item, i) => {
    const actual = selected[i]
    return actual?.enchantmentId === item.enchantmentId && actual.tier === item.tier && actual.source === item.source
  }))
  if (!legal) fail('Rangedのslot/lock/Tier/Gilded/stackingが個体と一致しません。')
}

export function calculateRangedDamage(build: Build, scenario: Scenario): RangedDamageState | undefined {
  if (!build.rangedWeapon) return undefined
  const observation = build.rangedWeapon.observation!
  const share = scenario.rangedTimeShare!
  const shotBudget = scenario.encounterDurationSeconds * share / observation.shotCycleSeconds
  if (!Number.isFinite(shotBudget) || shotBudget > Number.MAX_SAFE_INTEGER) fail('Ranged shot budgetが数値範囲を超えています。')
  const possibleShots = Math.floor(shotBudget + Math.min(1e-9, shotBudget * Number.EPSILON * 4))
  const shots = Math.min(observation.availableAmmo, possibleShots)
  const expectedMultiplier = (build.rangedEnchantments ?? []).reduce((multiplier, item) => {
    const definition = RANGED_ENCHANTMENTS[item.enchantmentId]!
    const value = definition.tiers[item.tier]
    return multiplier * (1 + value * (definition.kind === 'triple-hit-chance' ? 2 : definition.kind === 'enchanted-bonus' ? scenario.enemyComposition.enchantedShare : 1))
  }, 1)
  const directDps = observation.projectileDamage * expectedMultiplier * shots / scenario.encounterDurationSeconds
  if (!Number.isFinite(directDps)) fail('Ranged damageが数値範囲を超えています。')
  return { supportLevel: 'limited', weaponId: build.rangedWeapon.weaponId, mode: observation.mode,
    damageSource: 'user-observed-unmodified-projectile', projectileDamage: observation.projectileDamage,
    shotCycleSeconds: observation.shotCycleSeconds, timeShare: share, shots, shotsPerSecond: shots / scenario.encounterDurationSeconds,
    ammoConsumed: shots, ammoLimited: possibleShots > observation.availableAmmo,
    directSingleTargetDps: directDps, directAoeDps: directDps, indirectSingleTargetDps: 0, indirectAoeDps: 0,
    expectedMultiplier, limitations: RANGED_LIMITATIONS }
}

/** DirectWeapon* retains its historical MELEE meaning for kill/Leeching/Refreshment consumers. */
export function addRangedDamage(melee: DamageMetrics, ranged: RangedDamageState | undefined): DamageMetrics {
  if (!ranged) return melee
  return { ...melee, ranged, singleTargetDps: melee.singleTargetDps + ranged.directSingleTargetDps, aoeDps: melee.aoeDps + ranged.directAoeDps }
}
