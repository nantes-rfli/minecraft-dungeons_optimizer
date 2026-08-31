import fs from 'node:fs'
import { runtimeSupportSummaryDataText } from '../src/research/runtimeSupportSummary.ts'
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
  const source = [runtimeCatalogPath, path.join(projectRoot, 'src', 'data', 'control.ts')].map((file) => fs.readFileSync(file, 'utf8')).join('\n')
  return [...source.matchAll(/^\s{4}id: '([^']+)',/gm)].map((match) => match[1]!)
}

const blocker = (entry: MeleeEnchantmentAuditEntry): string => {
  if (entry.runtimePowerRange) return `Power ${entry.runtimePowerRange.min}–${entry.runtimePowerRange.max} only; ${entry.notes?.split('. ')[0] ?? 'partial'}`
  if (entry.runtimeMaxCopies !== undefined) return entry.notes?.split('. ')[0] ?? 'Limited CC model'
  if (entry.runtimeStatus === 'implemented' || entry.runtimeStatus === 'straightforward') return '—'
  return entry.notes?.split('. ')[0] ?? 'Evidence/model boundary unresolved'
}

const buildReport = (audit: MeleeEnchantmentAudit): string => {
  const summary = summarizeMeleeEnchantmentAudit(audit)
  const support = JSON.parse(fs.readFileSync(path.join(projectRoot, 'research/melee-runtime-support.json'), 'utf8'))
  const rows = audit.entries.map((entry) =>
    `| ${entry.name.en} | ${entry.runtimeStatus} | ${entry.modelCategory} | ${blocker(entry)} |`,
  ).join('\n')
  return `# Minecraft Dungeons Melee Enchantment Audit

Generated from mechanics audit by \`npm run audit:enchants\`. Runtime summary uses the separate support manifest.

## Current runtime support

${runtimeSupportSummaryDataText(support)}

Fullは現Optimizer scope内の通常対応で、完全なゲーム再現ではありません。Limitedは具体的な機能境界、Research-onlyは未登録です。
[Runtime support matrix](../docs/melee-runtime-support.md) / [limitations and close gates](../docs/runtime-limitations.md)。
Phase partialは履歴上の未達gate、Evidence confidenceは根拠品質で、supportとは別軸です。

## Mechanics research scope

Game version: ${audit.gameVersion}; audited: ${audit.auditedAt}.
Population: ${audit.population.definition}
Source: [population source](${audit.population.source.url}).

This report asks what the game mechanic appears to do. The support manifest asks what the current optimizer can safely execute.
Research classifications below are not Full/Limited labels.

| Research status | Count |
| --- | ---: |
${Object.entries(summary.counts).map(([status, count]) => `| ${status} | ${count} |`).join('\n')}
| Total | ${summary.total} |

## Mechanics / research matrix

| Enchantment | Research status | Category | Main research boundary |
| --- | --- | --- | --- |
${rows}

Tier raw values, sources, confidence, conflicting claims, stacking and applicability remain in [mechanics audit](melee-enchantment-audit.json).
Low confidence is not an automatic Limited verdict. Unimplemented effects are never registered as zero-score candidates.

## Historical phase gates

Parent 25–30 meaningful runtime is complete in Phase 2-1K; it does not mean all 33 mechanics are fully reproduced.
Phase 1-4 / 2-1D / 2-1F / 2-1G / 2-1H / 2-1I / 2-1J remain partial under their original gates.

- [1-4: independent run-level regression](../docs/model-regression.md)
- [2-1B: direct modifiers](../docs/damage-modifiers.md)
- [2-1C: PotionState](../docs/potion-state.md) / [Enemy debuffs](../docs/enemy-debuffs.md)
- [2-1D: Power-range proc damage](../docs/damage-events.md)
- [2-1E: enemy-state damage](../docs/enemy-state-damage.md)
- [2-1F: Temporal State / Echo](../docs/temporal-enchantments.md)
- [2-1G: Soul subsystem / Enigma](../docs/soul-subsystem.md)
- [2-1H: DoT / Exploding](../docs/dot-and-explosion-damage.md)
- [2-1I: independent Control](../docs/cc-utility.md)
- [2-1J: finite charge / consume](../docs/charge-consume-enchantments.md)
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
