import snapshot from '../../research/ranged-source-snapshot.json'
import { RANGED_ENCHANTMENTS, RANGED_LIMITATIONS, RANGED_WEAPONS, isRuntimeRangedEnchantment, isRuntimeRangedWeapon } from '../data/ranged'

// Secondary Gear list transcribed as family membership; aliases are explicit, not fuzzy matched.
export const RANGED_FAMILIES = {
  bow: ['bow', 'bonebow', 'haunted-bow', 'twin-bow'],
  'bubble-bow': ['bubble-bow', 'bubble-burster', 'gloopy-bow'],
  'burst-crossbow': ['burst-crossbow', 'corrupted-crossbow', 'soul-hunter-crossbow'],
  'cog-crossbow': ['cog-crossbow', 'pride-of-the-piglins'],
  crossbow: ['crossbow', 'azure-seeker', 'the-slicer'],
  'dual-crossbows': ['dual-crossbows', 'baby-crossbows', 'spellbound-crossbows'],
  'exploding-crossbow': ['exploding-crossbow', 'firebolt-thrower', 'imploding-crossbow'],
  'harpoon-crossbow': ['harpoon-crossbow', 'nautical-crossbow'],
  'heavy-crossbow': ['heavy-crossbow', 'doom-crossbow', 'slayer-crossbow'],
  'hunting-bow': ['hunting-bow', 'ancient-bow', 'hunter-s-promise', 'master-s-bow'],
  longbow: ['longbow', 'guardian-bow', 'red-snake'],
  'power-bow': ['power-bow', 'elite-power-bow', 'phantom-bow', 'sabrewing'],
  'rapid-crossbow': ['rapid-crossbow', 'auto-crossbow', 'butterfly-crossbow'],
  'scatter-crossbow': ['scatter-crossbow', 'harp-crossbow', 'lightning-harp-crossbow'],
  'shadow-crossbow': ['shadow-crossbow', 'shrieking-crossbow', 'veiled-crossbow'],
  shortbow: ['shortbow', 'love-spell-bow', 'mechanical-shortbow', 'purple-storm'],
  'snow-bow': ['snow-bow', 'webbed-bow', 'winter-s-touch'],
  'soul-bow': ['soul-bow', 'bow-of-lost-souls', 'nocturnal-bow', 'shivering-bow'],
  'soul-crossbow': ['soul-crossbow', 'feral-soul-crossbow', 'voidcaller'],
  trickbow: ['trickbow', 'the-green-menace', 'the-pink-scoundrel', 'sugar-rush'],
  'twisting-vine-bow': ['twisting-vine-bow', 'weeping-vine-bow'],
  'void-bow': ['void-bow', 'call-of-the-void'],
  'wind-bow': ['wind-bow', 'burst-gale-bow', 'echo-of-the-valley'],
} as const
export const WIKI_RANGED_ENCHANTMENT_IDS = ['accelerate', 'anima-conduit', 'artifact-charge', 'bonus-shot', 'burst-bowstring', 'committed', 'cooldown-shot', 'dipping-poison', 'dynamo', 'enigma-resonator', 'exploding', 'fire-aspect', 'fuse-shot', 'growing', 'infinity', 'looting', 'multishot', 'piercing', 'poison-cloud', 'prospector', 'power', 'punch', 'radiance-shot', 'rapid-fire', 'ricochet', 'roll-charge', 'smiting', 'soul-siphon', 'supercharge', 'unchanting', 'weakening', 'wild-rage', 'chain-reaction', 'critical-hit', 'gravity', 'levitation-shot', 'overcharge', 'refreshment', 'shock-web', 'tempo-theft', 'void-strike'] as const
const seasonal = new Set(['haunted-bow', 'gloopy-bow', 'phantom-bow', 'shrieking-crossbow', 'webbed-bow', 'shivering-bow', 'sugar-rush'])
const alias = (id: string) => id === 'burst-gale-bow' ? 'Burst Gust Bow' : snapshot.weapons.rows.find((row) => row.id === id)!.name
export const RANGED_AUDIT_SOURCES = [
  { id: 'primary-weapons', url: snapshot.weapons.url, accessedAt: snapshot.weapons.accessedAt, confidence: 'medium', version: '1.17.0.0 publisher-claimed', note: snapshot.weapons.provenance },
  { id: 'primary-enchantments', url: snapshot.enchantments.url, accessedAt: snapshot.enchantments.accessedAt, confidence: 'medium', version: '1.17.0.0 publisher-claimed', note: 'Shared melee/ranged pages can contain melee values. Keep conflicting channel values separate.' },
  { id: 'secondary-weapons', url: 'https://minecraft.wiki/w/Dungeons:Gear', accessedAt: '2026-09-04', confidence: 'medium', version: 'current listing; not independently version-verified', note: '71 obtainable display definitions, includes seven legacy seasonal variants. Availability today is not guaranteed.' },
  { id: 'secondary-enchantments', url: 'https://minecraft.wiki/w/Dungeons:Enchantment', accessedAt: '2026-09-04', confidence: 'medium', version: 'current listing; not independently version-verified', note: 'Ranged hero roll catalog, excluding exclusive intrinsic-only and unused entries. Search-index text used where direct retrieval was blocked.' },
] as const
const effectFamily = (text: string): string => {
  if (/Ricochet|Piercing|Multiple Targets/i.test(text)) return 'ricochet-pierce'
  if (/explod|Fuse/i.test(text)) return 'explosion'
  if (/Chain Reaction|Bonus Shot|Multishot/i.test(text)) return 'projectile-duplication'
  if (/Soul|Infinity/i.test(text)) return 'resource'
  if (/Faster Projectiles/i.test(text)) return 'projectile-velocity'
  if (/Firerate|Rapid Fire|Accelerate|Wind-up/i.test(text)) return 'cadence'
  if (/projectiles|3 arrows/i.test(text)) return 'projectile-count'
  if (/charg/i.test(text)) return 'charge-modifier'
  if (/Power/i.test(text)) return 'flat-modifier'
  if (/Growing|Dynamo|Void|Enigma|Unchanting|Shadow Shot/i.test(text)) return 'conditional-damage'
  if (/Pets/i.test(text)) return 'summon'
  return text ? 'status-or-special-projectile' : 'none'
}

export function buildRangedWeaponAudit() {
  const secondaryIds = Object.values(RANGED_FAMILIES).flat() as string[]
  const primaryIds = snapshot.weapons.rows.map((row) => row.id)
  const entries = snapshot.weapons.rows.map((row) => {
    const family = Object.entries(RANGED_FAMILIES).find(([, ids]) => (ids as readonly string[]).includes(row.id))?.[0]
    if (!family) throw new Error(`Unreconciled ranged family: ${row.id}`)
    const crossbow = family.includes('crossbow')
    const base = snapshot.weapons.rows.find((entry) => entry.id === family)!
    const rawEffects = row.facts.slice(3)
    const inherited = row.id === family ? [] : base.facts.slice(3)
    const supportLevel = isRuntimeRangedWeapon(row.id) ? 'limited' : 'research-only'
    return { id: row.id, name: { en: row.name, ja: RANGED_WEAPONS[row.id]?.name.ja ?? null }, japaneseNameStatus: RANGED_WEAPONS[row.id] ? 'runtime-label' : 'not-yet-verified',
      baseWeaponId: row.id === family ? null : family, variantOf: row.id === family ? null : family, family,
      heroAccessible: true, obtainable: true, obtainabilityScope: 'published hero equipment population; seasonal re-obtainment is not guaranteed',
      eventExclusive: seasonal.has(row.id), rarity: row.id === family ? 'common-rare' : 'unique', primaryRarity: row.rarity,
      firingMode: family === 'burst-crossbow' ? 'burst' : family === 'rapid-crossbow' ? 'rapid-fire' : family === 'cog-crossbow' ? 'wind-up' : crossbow ? 'single-shot' : 'chargeable',
      chargeBehavior: crossbow ? 'not-chargeable' : 'manual; timings unknown',
      projectileFamily: family === 'harpoon-crossbow' ? 'harpoon' : family === 'bubble-bow' ? 'bubble' : family === 'exploding-crossbow' ? 'explosive-arrow' : family === 'twisting-vine-bow' ? 'poison-trail-arrow' : 'arrow',
      multiProjectile: isRuntimeRangedWeapon(row.id) ? false : ['burst-crossbow', 'dual-crossbows', 'scatter-crossbow'].includes(family) || /Multiple projectiles|Double Projectiles|more projectiles|Bonus Shot|Multishot|3 arrows|Chain Reaction/i.test(rawEffects.join(' ')) ? true : null,
      projectileCount: isRuntimeRangedWeapon(row.id) ? 1 : null,
      chargeTimeSeconds: null, recoverySeconds: null, shotsPerSecond: null, burstCount: null, spread: null,
      multiHitPossibility: isRuntimeRangedWeapon(row.id) ? false : null, duplication: null, pierce: null, ricochet: null,
      ammo: { consumptionPerShot: isRuntimeRangedWeapon(row.id) ? 1 : null, quiverSize: null, policy: 'no rating-to-ammo conversion; special quivers excluded' },
      soul: { related: family.startsWith('soul-') || row.id === 'soul-hunter-crossbow', gathering: null, consumption: null },
      intrinsic: { own: rawEffects, inherited, families: [...new Set([...rawEffects, ...inherited].map(effectFamily))], support: supportLevel, completeMechanicVerification: false },
      rawRatings: row.facts.slice(0, 3), gameVersion: '1.17.0.0', currentVersionApplicability: 'publisher-claimed; no independent gameplay verification',
      sourceIds: ['primary-weapons', 'secondary-weapons'], sourceUrl: row.sourceUrl,
      sharedMechanicsProvenance: { familySource: 'secondary-weapons', inheritsTiming: false, inheritsEnchantRuntime: false },
      confidence: 'medium', auditStatus: 'population-reconciled-mechanics-partial', supportLevel,
      blockers: isRuntimeRangedWeapon(row.id) ? [...RANGED_LIMITATIONS] : ['発射周期・damage単位・intrinsic全体・projectile interactionの現行版Evidenceが不足。base相当として評価しない。'],
    }
  })
  return { schemaVersion: 1, gameVersion: '1.17.0.0', phaseStatus: 'partial', sources: RANGED_AUDIT_SOURCES,
    population: { definition: 'Normalized hero-accessible/obtainable published display union, including seasonal legacy items; not raw game IDs.', primaryIds, secondaryIds,
      commonIds: primaryIds.filter((id) => secondaryIds.includes(id)), primaryOnly: primaryIds.filter((id) => !secondaryIds.includes(id)), secondaryOnly: secondaryIds.filter((id) => !primaryIds.includes(id)),
      aliases: [{ primary: 'Burst Gale Bow', secondary: 'Burst Gust Bow', normalizedId: 'burst-gale-bow', note: 'Shared Wind Bow variant relationship; preserve both labels.' }],
      excluded: ['Unused/mob-only definitions outside the hero display list'], exhaustiveRawGameIdClaim: false,
      rarityDifferences: entries.filter((entry) => entry.eventExclusive && entry.primaryRarity === 'Common').map((entry) => entry.id), secondaryNames: secondaryIds.map(alias) },
    selection: { promotedIds: Object.keys(RANGED_WEAPONS), rationale: 'Two simple projectile archetypes: chargeable Bow and non-chargeable Crossbow. No Power curve or cadence inferred; requires explicit neutral observations.', powerFallback: false, independentMeasuredRuns: 0 }, entries }
}

const families: Record<string, string[]> = {
  'on-shot': ['accelerate', 'bonus-shot', 'chain-reaction', 'fuse-shot', 'multishot', 'piercing', 'infinity', 'rapid-fire'],
  'on-hit': ['critical-hit', 'gravity', 'poison-cloud', 'radiance-shot', 'ricochet', 'tempo-theft', 'wild-rage', 'fire-aspect', 'soul-siphon', 'weakening', 'levitation-shot', 'void-strike', 'punch'],
  'on-kill': ['exploding', 'looting', 'prospector', 'refreshment'],
  charge: ['supercharge', 'overcharge', 'cooldown-shot', 'shock-web'],
  roll: ['burst-bowstring', 'roll-charge', 'dynamo'], resource: ['anima-conduit', 'enigma-resonator', 'dipping-poison', 'artifact-charge'],
  'direct-modifier': ['power', 'unchanting', 'growing', 'smiting', 'committed'],
}
export function buildRangedEnchantmentAudit() {
  const primaryIds = snapshot.enchantments.rows.map((row) => row.id)
  const secondaryIds: string[] = [...WIKI_RANGED_ENCHANTMENT_IDS]
  const ids = [...new Set([...primaryIds, ...secondaryIds])].sort()
  return { schemaVersion: 1, gameVersion: '1.17.0.0', sources: RANGED_AUDIT_SOURCES,
    population: { definition: 'Union of hero ranged roll catalogs. Exclusive intrinsic-only and unused effects remain weapon taxonomy, not roll candidates.', primaryIds, secondaryIds,
      commonIds: primaryIds.filter((id) => secondaryIds.includes(id)), primaryOnly: primaryIds.filter((id) => !secondaryIds.includes(id)), secondaryOnly: secondaryIds.filter((id) => !primaryIds.includes(id)) },
    entries: ids.map((id) => {
      const row = snapshot.enchantments.rows.find((entry) => entry.id === id)
      const runtime = RANGED_ENCHANTMENTS[id]
      const conflict = id === 'anima-conduit' ? 'primary 2/4/6% shared page vs ranged Wiki 4/6/8%; not resolved'
        : id === 'void-strike' ? 'primary 200/400/600% shared melee values vs ranged Wiki 100/200/300%; not transferred'
          : !row ? 'primary index omits ranged applicability; present in secondary ranged catalog' : null
      return { id, name: { en: runtime?.name.en ?? row?.name ?? id.split('-').map((part) => part[0]!.toUpperCase() + part.slice(1)).join(' '), ja: runtime?.name.ja ?? null },
        rarity: row?.rarity ?? null, tierValues: row?.facts[1] ?? null,
        tierStatus: row ? 'published-not-independently-verified' : 'not-captured',
        stackable: runtime ? false : null, maxCopies: runtime?.maxCopies ?? null,
        triggerFamily: Object.entries(families).find(([, members]) => members.includes(id))?.[0] ?? 'unknown',
        damageChannel: runtime ? 'direct-ranged' : 'unresolved-effect-specific',
        directIndirectStatus: runtime ? 'direct only' : 'not promoted; proc/kill attribution needs audit',
        currentVersionApplicability: row ? '1.17.0.0 publisher-claimed' : 'secondary listing, probable current; verify independently',
        gameVersion: '1.17.0.0', confidence: conflict ? 'low' : 'medium', conflict,
        sourceIds: [...(row ? ['primary-enchantments'] : []), 'secondary-enchantments'], sourceUrl: row?.sourceUrl ?? 'https://minecraft.wiki/w/Dungeons:Enchantment',
        supportLevel: runtime ? 'limited' : 'research-only', readiness: runtime ? 'single-normal-projectile-only' : 'needs-ranged-mechanics-evidence',
        runtimeTiers: runtime?.tiers ?? null, reuseMeleeRuntime: false,
        blockers: runtime ? ['normal single projectile; one copy; modifier expectation factorization and target share are model assumptions, no proc/unique interaction'] : [conflict ?? 'Ranged-specific trigger/stack/channel/current-tier/interaction evidence incomplete; never reuse melee runtime by name.'],
      }
    }) }
}
export const RANGED_WEAPON_AUDIT = buildRangedWeaponAudit()
export const RANGED_ENCHANTMENT_AUDIT = buildRangedEnchantmentAudit()
export const isAuditedRangedWeapon = (id: string) => RANGED_WEAPON_AUDIT.entries.some((entry) => entry.id === id)
export const isAuditedRangedEnchantment = (id: string) => RANGED_ENCHANTMENT_AUDIT_IDS.has(id)
const RANGED_ENCHANTMENT_AUDIT_IDS = new Set(RANGED_ENCHANTMENT_AUDIT.entries.map((entry) => entry.id))

export function collectRangedAuditErrors(weapons = buildRangedWeaponAudit(), enchants = buildRangedEnchantmentAudit()): string[] {
  const errors: string[] = []
  const check = (condition: boolean, message: string) => { if (!condition) errors.push(message) }
  for (const audit of [weapons, enchants]) {
    const union = [...new Set([...audit.population.primaryIds, ...audit.population.secondaryIds])].sort()
    check(JSON.stringify(audit.entries.map((entry) => entry.id).sort()) === JSON.stringify(union), 'Ranged population drift/duplicates')
    for (const entry of audit.entries) {
      check(entry.blockers.length > 0 && entry.sourceIds.length > 0 && entry.gameVersion === '1.17.0.0', `${entry.id}: missing provenance/boundary`)
      check(entry.sourceIds.every((id) => audit.sources.some((source) => source.id === id)), `${entry.id}: unknown source`)
    }
  }
  for (const entry of weapons.entries) {
    check(entry.supportLevel === (isRuntimeRangedWeapon(entry.id) ? 'limited' : 'research-only'), `${entry.id}: weapon support drift`)
    check(entry.projectileCount === (isRuntimeRangedWeapon(entry.id) ? 1 : null) && entry.shotsPerSecond === null && entry.chargeTimeSeconds === null, `${entry.id}: invented projectile/cadence value`)
    check(!entry.sharedMechanicsProvenance.inheritsTiming && !entry.sharedMechanicsProvenance.inheritsEnchantRuntime, `${entry.id}: unsupported inheritance`)
  }
  for (const id of Object.keys(RANGED_WEAPONS)) check(weapons.entries.some((entry) => entry.id === id), `missing runtime weapon ${id}`)
  for (const entry of enchants.entries) check(entry.supportLevel === (isRuntimeRangedEnchantment(entry.id) ? 'limited' : 'research-only') && JSON.stringify(entry.runtimeTiers) === JSON.stringify(RANGED_ENCHANTMENTS[entry.id]?.tiers ?? null), `${entry.id}: enchant support/tier drift`)
  for (const id of Object.keys(RANGED_ENCHANTMENTS)) check(enchants.entries.some((entry) => entry.id === id), `missing runtime enchant ${id}`)
  check(!weapons.population.exhaustiveRawGameIdClaim && !weapons.selection.powerFallback, 'Unsupported completeness/Power claim')
  return errors
}
