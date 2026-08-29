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

Only the five \`implemented\` entries exist in \`EnchantmentId\` and \`ENCHANTMENTS\`. Every other entry remains research-only, so storage, UI candidate controls, evaluation, and optimization reject it instead of assigning a zero effect.

## Focus findings

### Refreshment and kill attribution

Refreshment uses a direct kill by the weapon carrying it. Direct melee hits and direct ranged projectiles qualify; indirect enchantment damage, DoT/proc damage (including Shockwave, Swirling, Fire Aspect, and Thundering), and artifact damage do not. This matches the existing \`CombatState.directWeaponKillsPerSecond\` boundary used by Leeching and Guarding Strike. Runtime still needs potion cooldown/use state and a principled healing/defense value, so Phase 2-1B should reuse the kill-rate signal but not reduce Refreshment to generic healing.

Kill attribution is high confidence for the direct-weapon wording and low confidence for the exhaustive interaction boundary because the latter is community-observed rather than published game-file metadata.

### Unchanting

The exact tiers are +50% / +75% / +100% against enchanted enemies. Runtime needs at least \`scenario.enchantedEnemyShare\`, preferably a reusable enemy-composition object. The exact composition point with Sharpness, Critical Hit, and other multipliers needs a controlled test before implementation.

### Committed

The published tiers are ranges (0–50% / 0–75% / 0–100%), not constants. The Minecraft Wiki documents linear scaling with health already lost: at 50% health lost, Tier III grants 50% bonus, while full health grants zero. A correct average still needs an enemy-health trajectory/distribution or analytic integration because the enchantment changes that trajectory. No boss-specific exception was found, so boss behavior remains a verification target rather than an assumed special case.

### Combo finishers and damage events

Shockwave and Swirling trigger from the last combo attack. Existing \`AttackProfile.comboFinisherHit\` can supply proc cadence, but HPS alone cannot. Their power-scaled damage, AoE, Void Strike interaction, and non-direct kill attribution belong in separate damage events. Proc kills must not increment \`directWeaponKillsPerSecond\` for Leeching, Guarding Strike, or Refreshment.

### DoT, lightning, CC, and utility

Fire Aspect, Poison Cloud, and Thundering require separate power-scaled damage events with trigger/tick/overlap/AoE and interaction evidence. Chains, Stunning, Gravity, Freezing, and Weakening need crowd-control/debuff state; none receive a fabricated DPS or defense conversion. Looting and Prospector are utility-only and require future consumable/emerald objectives rather than a score of zero.

## Existing model assessment

- \`EnchantmentTierValues\`: keep it unchanged for the existing five during 2-1A. Before 2-1B proc expansion, introduce a discriminated \`EnchantmentEffect\` union (passive damage, conditional damage, on-hit proc, combo-finisher event, on-kill effect, crowd control, resource state, utility) and migrate incrementally. Adding optional fields for all 33 would make invalid combinations representable.
- \`combineEnchantmentValues()\`: sufficient for Sharpness's multiplicative copies and scalar additive/non-stackable effects. It is insufficient for independent proc rolls, duration extension/refresh, tier-mixed event streams, and cross-copy caps. Add effect-specific combination policies instead of forcing those behaviors into one scalar.
- \`CombatState\`: reuse \`estimatedKillsPerSecond\` and \`directWeaponKillsPerSecond\`; add attributed kill channels only when DamageEvent work begins. Refreshment also needs potion cooldown/use state, while soul, roll, artifact-use, summon, and Pain Cycle mechanics need explicit resources.
- \`DamageMetrics\`: add typed source/event contributions before Shockwave, Swirling, Thundering, Poison Cloud, Fire Aspect, or Exploding. Keep direct weapon damage separate from proc/DoT/AoE damage so kill attribution remains correct.
- \`HealingMetrics\`: add potion-use and soul-heal contribution types before Refreshment or Anima Conduit; do not treat cooldown seconds as healing directly.
- \`DefenseMetrics\`: add affected-attacker share/debuff uptime and CC utility separately. Weakening and hard CC cannot be represented as unconditional damage reduction.

## Best Phase 2-1B batch

1. **Sharpness** — high-confidence tiers and stacking; existing multiplier helper is sufficient.
2. **Unchanting** — high gameplay relevance; establishes reusable enemy-composition state.
3. **Refreshment** — reuses direct weapon kills; establishes potion cooldown state and attribution tests.
4. **Shockwave** — uses existing combo finisher data and establishes the DamageEvent boundary.
5. **Swirling** — shares combo cadence infrastructure while exercising local AoE.
6. **Weakening** — establishes debuff uptime/affected-attacker modeling without fictional defense conversion.
7. **Thundering** — establishes on-hit, power-scaled AoE proc events and focus interaction.
8. **Committed** — uses the evidenced linear HP-lost curve after reusable enemy-health integration exists.

Implement the batch in smaller commits: Sharpness; enemy composition/Unchanting; Refreshment state; DamageEvent foundation plus Shockwave/Swirling; Weakening; Thundering; then Committed health integration.

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
- [Community interaction report](https://www.reddit.com/r/MinecraftDungeons/comments/1dml95h/enchantments_interfering/) — low-confidence proc/DoT kill-attribution boundary used only as a Phase 2 test target.

## Phase decision

**Phase 2-1A complete — ready for Phase 2-1B.** The parent Phase 2 goal remains incomplete until supported runtime coverage reaches the target.
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
