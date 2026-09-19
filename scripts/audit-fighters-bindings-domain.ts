import assert from 'node:assert/strict'
import fs from 'node:fs'
import { projectFightersBindings, fightersBindingsMappings } from '../src/domain/temporary/fightersBindings.ts'
import { fightersBindingsIdentity } from '../src/domain/temporary/fightersBindingsIdentity.ts'
import type { RawPackageSnapshot } from './game-data-raw-package.ts'

const root = new URL('..', import.meta.url)
const source = `research/raw/packages/${fightersBindingsIdentity.packagePath}.raw.json`
const raw = JSON.parse(fs.readFileSync(new URL(source, root), 'utf8')) as RawPackageSnapshot
const projection = projectFightersBindings(raw)
assert.equal(projection.identity.status, 'provisional')
assert.equal(projection.identity.domainId, fightersBindingsIdentity.domainId)
assert.equal(projection.configuredAttacks.state, 'known')
if (projection.configuredAttacks.state === 'known') {
  assert.equal(projection.configuredAttacks.value.length, 4)
  for (const entry of projection.configuredAttacks.value) {
    for (const field of [entry.configuredDamage, entry.configuredAnimationDurationSeconds]) {
      assert.equal(field.state, 'known')
      const node = field.trace.raw.nodePointer.split('/').slice(1).reduce<unknown>((value, key) => (value as Record<string, unknown>)[key], raw)
      if (field.state === 'known') assert.equal(field.value, (node as { decoding: { value: unknown } }).decoding.value)
    }
  }
}
for (const evidence of fightersBindingsIdentity.evidence) assert.ok(fs.existsSync(new URL(evidence.path, root)))
const aliases = JSON.parse(fs.readFileSync(new URL('research/domain/game-data-entity-aliases.json', root), 'utf8')) as { aliases: { id: string; status: string }[] }
assert.equal(aliases.aliases.find((alias) => alias.id === `melee-weapon:${fightersBindingsIdentity.rawIdentity}`)?.status, 'unresolved', 'Historical alias evidence changed; review identity assertion')
const icons = JSON.parse(fs.readFileSync(new URL('generated/equipment-icons/manifest.json', root), 'utf8')) as { entries: { catalogId: string; sourcePackage: string; matchMethod: string }[] }
assert.ok(icons.entries.some((entry) => entry.catalogId === 'soul-fists' && entry.sourcePackage === fightersBindingsIdentity.packagePath.slice(0, fightersBindingsIdentity.packagePath.lastIndexOf('/')) && entry.matchMethod === 'family-unique-ordinal'), 'Conflicting icon evidence changed; review identity assertion')
const result = { schemaVersion: 1, scope: 'temporary-domain-only', identityAssertion: fightersBindingsIdentity, mappings: fightersBindingsMappings, projection }
const target = new URL('research/domain/temporary/fighters-bindings.json', root)
const serialized = JSON.stringify(result, null, 2) + '\n'
if (process.argv.includes('--write')) { fs.mkdirSync(new URL('.', target), { recursive: true }); fs.writeFileSync(target, serialized) }
assert.equal(fs.readFileSync(target, 'utf8'), serialized, 'Temporary Domain drift; run generate:fighters-bindings-domain')
console.log('Fighter’s Bindings temporary Domain audit passed: provisional identity, 4 configured entries, Raw node traceability; no runtime promotion.')
