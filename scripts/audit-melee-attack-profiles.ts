import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import {
  collectMeleeAuditErrors,
  summarizeMeleeAudit,
  type MeleeAttackProfileAudit,
  type MeleeWeaponAuditEntry,
} from '../src/research/meleeAttackProfileAudit.ts'

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(scriptDirectory, '..')
const auditPath = path.join(projectRoot, 'research', 'melee-attack-profile-audit.json')
const reportPath = path.join(projectRoot, 'docs', 'melee-attack-profile-coverage.md')

const legacyRuntimeProxySnapshot: Readonly<Record<string, number>> = {
  'fighters-bindings': 7,
  'double-axe': 1.05,
  anchor: 0.5,
}

const percentage = (count: number, total: number): string =>
  `${((count / total) * 100).toFixed(1)}%`

const displayName = (entry: MeleeWeaponAuditEntry): string =>
  `${entry.name.en} (${entry.weaponId})`

const listOrNone = (
  entries: readonly MeleeWeaponAuditEntry[],
  describe: (entry: MeleeWeaponAuditEntry) => string = displayName,
): string => entries.length === 0
  ? '- None.'
  : entries.map((entry) => `- ${describe(entry)}`).join('\n')

const buildReport = (audit: MeleeAttackProfileAudit): string => {
  const summary = summarizeMeleeAudit(audit)
  const exactWithCompleteTimings = audit.weapons.filter((entry) => entry.status === 'exact').length
  const attackSpeedUnknown = audit.weapons.filter((entry) => entry.attackSpeedScaling.status === 'unknown').length
  const runtimeRows = Object.entries(legacyRuntimeProxySnapshot).map(([weaponId, proxy]) => {
    const entry = audit.weapons.find((weapon) => weapon.weaponId === weaponId)
    const audited = entry?.attackProfile?.hitsPerSecond
    if (audited === null || audited === undefined) return `| ${weaponId} | ${proxy} | unresolved | — |`
    const difference = ((proxy / audited) - 1) * 100
    return `| ${weaponId} | ${proxy} | ${audited} | ${difference >= 0 ? '+' : ''}${difference.toFixed(1)}% |`
  }).join('\n')

  return `# Minecraft Dungeons Melee Attack Profile Audit

Generated from \`research/melee-attack-profile-audit.json\` by \`npm run audit:melee\`.

## Scope and population

- Game version: ${audit.gameVersion}
- Audit date: ${audit.auditedAt}
- Obtainable melee weapons: ${audit.population.obtainableMeleeWeapons}
- Known melee weapons: ${audit.population.knownMeleeWeapons}
- Excluded known/non-obtainable records: ${audit.population.excludedKnownWeapons.join(', ')}
- Population sources: [Minecraft Wiki gear list](${audit.population.sources[0]?.url}), [dungeons.tools 1.17.0.0 game-file-derived tier list](${audit.population.sources[1]?.url})

The Wiki count (88 known / 82 obtainable) was reconciled with the independent 82-row list derived from the 1.17.0.0 game files. Per-hit durations come from each weapon's current Minecraft Wiki Stats table; the game-file-derived source establishes population and family context but does not publish those durations.

## Coverage

| Classification | Weapons | Coverage |
| --- | ---: | ---: |
| Exact | ${summary.counts.exact} | ${percentage(summary.counts.exact, summary.total)} |
| Verified shared | ${summary.counts['verified-shared']} | ${percentage(summary.counts['verified-shared'], summary.total)} |
| Partial | ${summary.counts.partial} | ${percentage(summary.counts.partial, summary.total)} |
| Inferred | ${summary.counts.inferred} | ${percentage(summary.counts.inferred, summary.total)} |
| Missing | ${summary.counts.missing} | ${percentage(summary.counts.missing, summary.total)} |
| **Strict runtime-ready** | **${summary.strictRuntimeReady} / ${summary.total}** | **${percentage(summary.strictRuntimeReady, summary.total)}** |
| Relaxed runtime-ready (includes inferred) | ${summary.relaxedRuntimeReady} / ${summary.total} | ${percentage(summary.relaxedRuntimeReady, summary.total)} |

Strict runtime-ready requires a complete per-hit timing profile, a source, and status \`exact\` or \`verified-shared\`. Relaxed coverage additionally accepts \`inferred\`; this audit deliberately contains no inferred or family-only shared profiles.

## Public information richness

| Public evidence | Weapons |
| --- | ---: |
| Any directly published attack-duration rows | ${summary.directDurationData} |
| Complete, internally consistent per-hit duration profiles | ${exactWithCompleteTimings} |
| Combo count only (no duration rows) | ${summary.comboOnly} |
| Completed by verified profile sharing | ${summary.sharedProfiles} |
| No public profile data | ${summary.noPublicProfileData} |
| Attack-speed modifier scaling still unknown | ${attackSpeedUnknown} |

All 82 pages expose at least one attack-duration row. Six cannot be converted into a fixed profile without resolving contradictory or non-fixed combo structures. Damage ratios are derived only for internally consistent profiles from the raw base-damage rows; raw values remain stored. No attack-speed modifier scaling rule was guessed.

## Partial weapons

${listOrNone(summary.partial, (entry) => `${displayName(entry)} — ${entry.notes}`)}

## Missing weapons

${listOrNone(summary.missing)}

## Special handling required

${listOrNone(summary.specialHandling, (entry) => `${displayName(entry)} — ${entry.specialHandlingNotes}`)}

## Low-confidence entries

${listOrNone(summary.lowConfidence)}

Individual timing sources are rated medium confidence: each value is directly visible in a concrete Wiki Stats table, but those tables do not expose a primary game-file citation for every duration. The population cross-check from dungeons.tools is high confidence because it explicitly identifies the 1.17.0.0 game files as its source.

## Legacy runtime proxy comparison

Before the first Phase 1 runtime migration, the three supported weapons used the proxies below. Runtime now stores these audit per-hit timings and calculates HPS as \`comboHits / sum(hitDurationsSeconds)\`; the legacy comparison remains here to make the model change explicit.

| Weapon | Legacy runtime proxy HPS | Audit-derived HPS | Proxy difference |
| --- | ---: | ---: | ---: |
${runtimeRows}

The Double Axe and Anchor differences motivated the deliberate Phase 1 migration. Fighter's Bindings was close to the rounded proxy, but runtime now preserves its raw four-hit structure as well.

## Recommendation

**B. Some additional research is required.** Public information produces strict fixed profiles for ${summary.strictRuntimeReady}/${summary.total} weapons (${percentage(summary.strictRuntimeReady, summary.total)}), so broad Phase 1 work can proceed. The four dagger-family contradictions and two sawblade cycle models must be resolved separately, and attack-speed modifier behavior remains unverified for every weapon.
`
}

const rawAudit: unknown = JSON.parse(fs.readFileSync(auditPath, 'utf8'))
const errors = collectMeleeAuditErrors(rawAudit)
if (errors.length > 0) {
  console.error(`Melee attack profile audit failed with ${errors.length} error(s):`)
  errors.forEach((error) => console.error(`- ${error}`))
  process.exitCode = 1
} else {
  const audit = rawAudit as MeleeAttackProfileAudit
  fs.writeFileSync(reportPath, buildReport(audit))
  const summary = summarizeMeleeAudit(audit)
  console.log(`Validated ${summary.total} melee weapons for Minecraft Dungeons ${audit.gameVersion}.`)
  console.log(`Exact ${summary.counts.exact}; partial ${summary.counts.partial}; missing ${summary.counts.missing}.`)
  console.log(`Strict runtime-ready ${summary.strictRuntimeReady}/${summary.total} (${percentage(summary.strictRuntimeReady, summary.total)}).`)
  console.log(`Wrote ${path.relative(projectRoot, reportPath)}.`)
}
