import fs from 'node:fs'
import process from 'node:process'
import { collectDamageEventAuditErrors, type DamageEventAudit } from '../src/research/damageEventAudit.ts'

const value: unknown = JSON.parse(fs.readFileSync(new URL('../research/damage-event-audit.json', import.meta.url), 'utf8'))
const errors = collectDamageEventAuditErrors(value)
if (errors.length) {
  console.error(errors.join('\n'))
  process.exitCode = 1
} else {
  const audit = value as DamageEventAudit
  console.log('DamageEvent audit passed — Phase 2-1D partial; no extrapolation')
  for (const entry of audit.entries) {
    const power = entry.powerScaling
    const error = audit.commonCurveAudit.maxTierReconstructionRelativeErrors[entry.id]
    console.log(`${entry.id}: ${power.publishedSamples.length} tier samples, Power ${power.supportedPowerRange.min}–${power.supportedPowerRange.max}, maximum tier reconstruction error ${(error * 100).toFixed(6)}%`)
  }
  console.log('Component validation only; independent absolute/interpolation accuracy remains unknown.')
}
