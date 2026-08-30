import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import {
  collectMeleeEnchantmentAuditErrors,
  summarizeMeleeEnchantmentAudit,
  type MeleeEnchantmentAudit,
  type MeleeEnchantmentAuditEntry,
} from '../src/research/meleeEnchantmentAudit.ts'

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(scriptDirectory, '..')
const auditPath = path.join(projectRoot, 'research', 'melee-enchantment-audit.json')
const reportPath = path.join(projectRoot, 'research', 'melee-enchantment-coverage.md')
const runtimeCatalogPath = path.join(projectRoot, 'src', 'data', 'enchantments.ts')

const readRuntimeEnchantmentIds = (): string[] => {
  const source = fs.readFileSync(runtimeCatalogPath, 'utf8')
  return [...source.matchAll(/^\s{4}id: '([^']+)',$/gm)].map((match) => match[1]!)
}

const blocker = (entry: MeleeEnchantmentAuditEntry): string => {
  if (entry.runtimeStatus === 'implemented' || entry.runtimeStatus === 'straightforward') return '—'
  return entry.notes?.split('. ')[0] ?? 'Evidence/model boundary unresolved'
}

const buildReport = (audit: MeleeEnchantmentAudit): string => {
  const summary = summarizeMeleeEnchantmentAudit(audit)
  const rows = audit.entries.map((entry) =>
    `| ${entry.name.en} | ${entry.runtimeStatus} | ${entry.modelCategory} | ${blocker(entry)} |`,
  ).join('\n')
  const names = audit.entries.map((entry) => entry.name.en).join(', ')

  return `# Minecraft Dungeons Melee Enchantment Audit

Generated from \`research/melee-enchantment-audit.json\` by \`npm run audit:enchants\`.

## Scope and population

- Target game version: ${audit.gameVersion}
- Audit date: ${audit.auditedAt}
- Melee-applicable, hero-accessible enchantments: **${summary.total}**
- Runtime implemented: **${summary.counts.implemented}**
- Population rule: ${audit.population.definition}
- Source of truth: [dungeons.tools 1.17.0.0 game-file-derived enchantments](${audit.population.source.url})

The 33 entries are: ${names}.

The source index explicitly separates player enchantments from mob/innate records. The population therefore includes shared melee/ranged entries and the three entries omitted from the initial candidate list (Busy Bee, Dynamo, Soul Siphon), while excluding name-based guesses and internal-only effects.

## Coverage summary

| Runtime status | Count |
| --- | ---: |
| implemented | ${summary.counts.implemented} |
| straightforward | ${summary.counts.straightforward} |
| needs-state-model | ${summary.counts['needs-state-model']} |
| needs-damage-event-model | ${summary.counts['needs-damage-event-model']} |
| needs-enemy-state | ${summary.counts['needs-enemy-state']} |
| utility-only | ${summary.counts['utility-only']} |
| insufficient-evidence | ${summary.counts['insufficient-evidence']} |
| **Total** | **${summary.total}** |

## Runtime capability matrix

| Enchantment | Runtime | Category | Main blocker |
| --- | --- | --- | --- |
${rows}

Only the ${summary.counts.implemented} \`implemented\` entries exist in \`EnchantmentId\` and \`ENCHANTMENTS\`. Every other entry remains research-only, so storage, UI candidate controls, evaluation, and optimization reject it instead of assigning a zero effect.

## Focus findings

### Refreshment and kill attribution

Refreshment uses a direct kill by the weapon carrying it. Direct melee hits and direct ranged projectiles qualify; indirect enchantment damage, DoT/proc damage (including Shockwave, Swirling, Fire Aspect, and Thundering), and artifact damage do not. This matches the existing \`CombatState.directWeaponKillsPerSecond\` boundary used by Leeching and Guarding Strike. Phase 2-1C derives PotionState using C / (1 + k × r), then adds only incremental healing capacity to utility. Base cooldown 45 seconds and approximately 75% healing have independent Evidence. This is a low-confidence steady-state availability model, not actual healing or an event simulator. Artifact cooldownReduction is not applied. See [PotionState](../docs/potion-state.md).

Kill attribution is high confidence for the direct-weapon wording and low confidence for the exhaustive interaction boundary because the latter is community-observed rather than published game-file metadata.

### Unchanting

Phase 2-1B implements +50% / +75% / +100% only against enchanted targets, using \`scenario.enemyComposition.enchantedShare\` and expected multiplier \`1 + share × bonus\`. Every profile has the same editable 25% low-confidence assumption, including boss. Tier, condition and stacking are high confidence; equal-baseline mixture and cross-enchantment composition are separate low-confidence model assumptions. See [direct weapon modifiers](../docs/damage-modifiers.md).

### Committed

The published tiers are ranges (0–50% / 0–75% / 0–100%), not constants. The Minecraft Wiki documents linear scaling with health already lost: at 50% health lost, Tier III grants 50% bonus, while full health grants zero. A correct average still needs an enemy-health trajectory/distribution or analytic integration because the enchantment changes that trajectory. No boss-specific exception was found, so boss behavior remains a verification target rather than an assumed special case.

### Combo finishers and damage events

Shockwave and Swirling trigger from the last combo attack. Existing \`AttackProfile.comboFinisherHit\` can supply proc cadence, but HPS alone cannot. Their power-scaled damage, AoE, Void Strike interaction, and non-direct kill attribution belong in separate damage events. Proc kills must not increment \`directWeaponKillsPerSecond\` for Leeching, Guarding Strike, or Refreshment.

### DoT, lightning, CC, and utility

Fire Aspect, Poison Cloud, and Thundering require separate power-scaled damage events with trigger/tick/overlap/AoE and interaction evidence. Chains, Stunning, Gravity and Freezing still need crowd-control state. Phase 2-1C implements Weakening through an explicit time-weighted affected incoming damage share, not unconditional defense. Looting and Prospector are utility-only and require future consumable/emerald objectives rather than a score of zero.

## Existing model assessment

- \`EnchantmentTierValues\`: Phase 2-1C keeps the original five unchanged and expands the typed \`effect\` union to direct weapon bonuses, potion cooldown on direct kill, and enemy damage debuffs. Numeric bonuses live only in tier data. Extend effect channels incrementally before any proc/DoT work; do not add 33 optional scalar fields.
- \`combineEnchantmentValues()\`: sufficient for Sharpness's multiplicative copies and scalar additive/non-stackable effects. It is insufficient for independent proc rolls, duration extension/refresh, tier-mixed event streams, and cross-copy caps. Add effect-specific combination policies instead of forcing those behaviors into one scalar.
- \`CombatState\`: reuse \`estimatedKillsPerSecond\` and \`directWeaponKillsPerSecond\`; add attributed kill channels only when DamageEvent work begins. Refreshment now consumes this signal in independent PotionState; soul, roll, artifact-use, summon, and Pain Cycle mechanics still need explicit resources.
- \`DamageMetrics\`: add typed source/event contributions before Shockwave, Swirling, Thundering, Poison Cloud, Fire Aspect, or Exploding. Keep direct weapon damage separate from proc/DoT/AoE damage so kill attribution remains correct.
- \`HealingMetrics\`: Refreshment contributes only incremental potion healing capacity, explicitly a low-confidence proxy; Anima Conduit still needs soul-heal state.
- \`DefenseMetrics\`: Weakening preserves affected incoming damage share, reduction, duration and enemy multiplier separately from Artifact/Guarding hero DR. Hard CC utility remains unsupported.

## Phase 2-1B completed scope

- **Sharpness** — audit tier values, multiplicative copies (maximum four), mixed tiers and direct-hit modifier.
- **Unchanting** — non-stackable conditional modifier with reusable enemy composition, editable UI and traceable target DPS.
- The seven enchantments available at Phase 2-1B completion used the existing storage, slot lock, gilded and exhaustive optimizer paths.
- That phase did not include Refreshment or Weakening; both are added in Phase 2-1C below.

## Phase 2-1C completed scope

- **Refreshment** — Tier reductions 1/2/3 seconds, direct-weapon kills only, PotionState and incremental healing capacity (base potion healing excluded).
- **Weakening** — enemy damage reductions 20/30/40%, five-second nearby-enemy application, and editable 50% affected incoming damage share for every profile. This share includes duration/positioning/attack uptime; duration is not multiplied again.
- Weakening enemy multiplier is \`1 - share × reduction\`; Artifact and Guarding Strike remain separate hero-defense stages. See [enemy debuffs](../docs/enemy-debuffs.md).
- **Source conflict**: dungeons.tools says Weakening STACKS Yes; the prior audit interpreted maxCopies=4/special. The requested maxCopies=1/non-stackable rule follows the Wiki's explicit normal/gilded/unique-slot semantics. Raw conflicting metadata and the correction are retained in audit sources; runtime stacking confidence is medium, not asserted game-file agreement.
- Both additions use normal candidates, locks, gilded tiers, JSON/storage, contribution and exhaustive optimizer paths. Runtime coverage is **${summary.counts.implemented} / ${summary.total}**, unsupported **${summary.unsupportedNames.length} / ${summary.total}**.
- No other enchantments, DamageEvent framework, Potion Barrier, armor, CC utility or target-switching simulator were implemented.

## Next: Phase 2-1D

DamageEvent foundation with Shockwave / Swirling / Thundering is the next candidate scope, not part of this change. Proc damage, kill attribution, power scaling and Void Strike interactions need separate Evidence. Committed still needs enemy-health integration. The parent goal of 25–30 melee enchantments remains incomplete.

## Highest-risk mechanics

- Committed health-trajectory integration and unverified boss exceptions.
- Shockwave/Swirling power scaling, Void Strike interaction, AoE, and kill attribution.
- Thundering/Fire Aspect/Poison Cloud power curves, overlap/ticks, and focus interactions.
- CC/debuff valuation without inventing defense equivalence.
- Independent-proc and duration-based stacking beyond scalar combination.
- Utility-only objectives for loot and emerald farming.

## Evidence limits

Each entry preserves raw Tier I/II/III text separately from interpreted fields. \`X / 2X / 3X\` values are never converted to percentages. Source records declare which claims they support and their confidence, so high-confidence tier values do not promote low-confidence kill attribution or interactions. Built-in Tier I availability is recorded for future unique-weapon modeling but is not runtime-enabled.

## Primary sources

- [dungeons.tools enchantment index](https://www.dungeons.tools/enchantments) — 1.17.0.0 game-file-derived population, applicability, rarity, tiers, stacking flags, and built-ins.
- [Minecraft Wiki enchantment list](https://minecraft.wiki/w/Dungeons:Enchantment) — hero/mob/unused separation, stacking mechanics, history, and unique built-ins.
- [Minecraft Wiki: Committed](https://minecraft.wiki/w/Dungeons:Committed) — linear health-lost example and tiers.
- [Minecraft Wiki: Shockwave](https://minecraft.wiki/w/Dungeons:Shockwave) and [Swirling](https://minecraft.wiki/w/Dungeons:Swirling) — combo-finisher trigger, power scaling, stacking, and built-ins.
- [Community interaction report](https://www.reddit.com/r/MinecraftDungeons/comments/1dml95h/enchantments_interfering/) — low-confidence proc/DoT kill-attribution boundary kept separate from high-confidence direct-weapon wording.

## Phase decision

**Phase 2-1C complete — ready for Phase 2-1D.** Runtime coverage is ${summary.counts.implemented} / ${summary.total}; unsupported coverage is ${summary.unsupportedNames.length} / ${summary.total}. The parent Phase 2 goal remains incomplete until supported runtime coverage reaches the target.
`
}

let parsed: unknown
try {
  parsed = JSON.parse(fs.readFileSync(auditPath, 'utf8'))
} catch (error) {
  console.error(`Failed to read ${path.relative(projectRoot, auditPath)}:`, error)
  process.exitCode = 1
  process.exit()
}

const errors = collectMeleeEnchantmentAuditErrors(parsed, readRuntimeEnchantmentIds())
if (errors.length > 0) {
  console.error('Melee enchantment audit failed:')
  errors.forEach((error) => console.error(`- ${error}`))
  process.exitCode = 1
  process.exit()
}

const audit = parsed as MeleeEnchantmentAudit
fs.writeFileSync(reportPath, buildReport(audit))
const summary = summarizeMeleeEnchantmentAudit(audit)
console.log(`Melee enchantment audit passed: ${summary.total} entries`)
for (const [status, count] of Object.entries(summary.counts)) {
  console.log(`- ${status}: ${count}`)
}
console.log(`Coverage report: ${path.relative(projectRoot, reportPath)}`)
