import type { CatalogResearchAttributes, EnchantmentTier } from './types'

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
function requireString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim() === '') throw new Error(`${field}は空でない文字列にしてください。`)
  return value
}
function optionalString(value: unknown, field: string): string | undefined {
  if (value === undefined || value === '') return undefined
  return requireString(value, field)
}

/** Preserve validated research facts as provenance, never as runtime inputs. */
export function parseCatalogResearch(value: unknown, field: string): CatalogResearchAttributes | undefined {
  if (value === undefined) return undefined
  if (!isRecord(value)) throw new Error(`${field}の形式が正しくありません。`)
  const enchantments = value.enchantments === undefined ? undefined : (() => {
    if (!Array.isArray(value.enchantments)) throw new Error(`${field}.enchantmentsは配列にしてください。`)
    return value.enchantments.map((item, index) => {
      const itemField = `${field}.enchantments[${index}]`
      if (!isRecord(item) || ![1, 2, 3].includes(item.tier as number) || !['slot', 'gilded', 'built-in'].includes(item.source as string)) throw new Error(`${itemField}の形式が正しくありません。`)
      return { enchantmentId: requireString(item.enchantmentId, `${itemField}.enchantmentId`), tier: item.tier as EnchantmentTier, source: item.source as 'slot' | 'gilded' | 'built-in' }
    })
  })()
  const intrinsicProperties = value.intrinsicProperties === undefined ? undefined : (() => {
    if (!Array.isArray(value.intrinsicProperties)) throw new Error(`${field}.intrinsicPropertiesは配列にしてください。`)
    return value.intrinsicProperties.map((item, index) => {
      const itemField = `${field}.intrinsicProperties[${index}]`
      if (!isRecord(item)) throw new Error(`${itemField}の形式が正しくありません。`)
      return { kind: requireString(item.kind, `${itemField}.kind`), raw: requireString(item.raw, `${itemField}.raw`) }
    })
  })()
  const observations = value.observations === undefined ? undefined : (() => {
    if (!Array.isArray(value.observations)) throw new Error(`${field}.observationsは配列にしてください。`)
    return value.observations.map((item, index) => {
      const itemField = `${field}.observations[${index}]`
      if (!isRecord(item)) throw new Error(`${itemField}の形式が正しくありません。`)
      return {
        parameterId: requireString(item.parameterId, `${itemField}.parameterId`), value: requireString(item.value, `${itemField}.value`),
        ...(optionalString(item.unit, `${itemField}.unit`) ? { unit: optionalString(item.unit, `${itemField}.unit`) } : {}),
        ...(optionalString(item.conditions, `${itemField}.conditions`) ? { conditions: optionalString(item.conditions, `${itemField}.conditions`) } : {}),
        ...(optionalString(item.gameVersion, `${itemField}.gameVersion`) ? { gameVersion: optionalString(item.gameVersion, `${itemField}.gameVersion`) } : {}),
        ...(optionalString(item.notes, `${itemField}.notes`) ? { notes: optionalString(item.notes, `${itemField}.notes`) } : {}),
      }
    })
  })()
  return { ...(enchantments ? { enchantments } : {}), ...(intrinsicProperties ? { intrinsicProperties } : {}), ...(observations ? { observations } : {}) }
}

