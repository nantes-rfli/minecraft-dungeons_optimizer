import meleeAudit from '../../research/melee-attack-profile-audit.json'
import armorAudit from '../../research/armor-audit.json'
import rangedAudit from '../../research/ranged-weapon-audit.json'
import artifactAudit from '../../research/artifact-audit.json'
import { WEAPONS } from './weapons'
import { ARMORS } from './armors'
import { RANGED_WEAPONS } from './ranged'
import { ARTIFACTS } from './artifacts'
import type { EquipmentCategory } from '../core/types'

export type RuntimeSupportLevel = 'full' | 'limited' | 'unsupported'

export interface EquipmentCatalogEntry {
  readonly category: EquipmentCategory
  readonly id: string
  readonly name: { readonly ja?: string; readonly en: string }
  readonly runtimeSupport: RuntimeSupportLevel
  readonly legacyRuntimeSupport: 'full' | 'limited' | 'research-only'
  readonly auditStatus: string
}

const runtimeLevel = (category: EquipmentCategory, id: string): RuntimeSupportLevel => {
  if (category === 'melee') return id in WEAPONS ? 'full' : 'unsupported'
  if (category === 'armor') return id in ARMORS ? 'limited' : 'unsupported'
  if (category === 'ranged') return id in RANGED_WEAPONS ? 'limited' : 'unsupported'
  return id in ARTIFACTS ? (id === 'shock-powder' ? 'limited' : 'full') : 'unsupported'
}

const entry = (category: EquipmentCategory, id: string, name: EquipmentCatalogEntry['name'], auditStatus: string): EquipmentCatalogEntry => {
  const runtimeSupport = runtimeLevel(category, id)
  return { category, id, name, runtimeSupport, legacyRuntimeSupport: runtimeSupport === 'unsupported' ? 'research-only' : runtimeSupport, auditStatus }
}

export const EQUIPMENT_CATALOG: readonly EquipmentCatalogEntry[] = [
  ...meleeAudit.weapons.map((item) => entry('melee', item.weaponId, { en: item.name.en, ...(item.name.ja ? { ja: item.name.ja } : {}) }, item.status)),
  ...armorAudit.entries.map((item) => entry('armor', item.id, { en: item.name }, item.runtimeReadiness)),
  ...rangedAudit.entries.map((item) => entry('ranged', item.id, { en: item.name.en, ...(item.name.ja ? { ja: item.name.ja } : {}) }, item.auditStatus)),
  ...artifactAudit.entries.map((item) => entry('artifact', item.id, { en: item.name }, item.runtimeReadiness)),
  ...artifactAudit.populationDifferences.map((item) => entry('artifact', item.id, { en: item.name }, item.runtimeReadiness)),
].sort((left, right) => left.category.localeCompare(right.category) || left.name.en.localeCompare(right.name.en))

export const CATALOG_ONLY_EQUIPMENT = EQUIPMENT_CATALOG.filter((item) => item.runtimeSupport === 'unsupported')

export function getEquipmentCatalogEntry(category: EquipmentCategory, id: string): EquipmentCatalogEntry | undefined {
  return EQUIPMENT_CATALOG.find((item) => item.category === category && item.id === id)
}
