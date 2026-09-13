import type { EquipmentCatalogEntry } from './equipmentCatalog'

export interface DisplayField {
  readonly id: string
  readonly label: string
  readonly value: string
}

export interface EquipmentDisplaySection {
  readonly title: string
  readonly fields: readonly DisplayField[]
}

export type EquipmentPresentationCategory = 'melee' | 'ranged' | 'armor' | 'artifact' | 'enchantment'
export type PresentationFact = { readonly property: string; readonly value: unknown; readonly status: string }
export type EquipmentPresentationInput = {
  readonly category: EquipmentPresentationCategory
  readonly nameJa: string
  readonly nameEn?: string
  readonly family: string
  readonly catalog?: EquipmentCatalogEntry
  readonly facts: readonly PresentationFact[]
}

type FieldDefinition = { id: string; label: string; properties?: readonly string[] }

const categoryLabel: Record<EquipmentPresentationCategory, string> = { melee: '近接', ranged: '遠距離', armor: '防具', artifact: 'アーティファクト', enchantment: 'エンチャント' }

const sectionDefinitions: Record<EquipmentPresentationCategory, readonly { title: string; fields: readonly FieldDefinition[] }[]> = {
  melee: [
    { title: '基本情報', fields: [{ id: 'nameJa', label: '日本語名' }, { id: 'nameEn', label: '英語名' }, { id: 'category', label: 'カテゴリ' }, { id: 'family', label: '系統 / family', properties: ['family'] }, { id: 'rarity', label: 'レアリティ', properties: ['baseUniqueRelation'] }, { id: 'soul', label: 'Soul 装備', properties: ['soul'] }] },
    { title: '戦闘データ', fields: [{ id: 'damage', label: 'Damage', properties: ['hitDamageRatios', 'damage'] }, { id: 'speed', label: 'Attack Speed', properties: ['timing', 'speed'] }, { id: 'combo', label: 'Combo / hits', properties: ['combo'] }, { id: 'area', label: 'Area / Range', properties: ['area', 'range'] }, { id: 'power', label: 'Power dependency', properties: ['power', 'powerScaling'] }] },
    { title: '固有情報', fields: [{ id: 'intrinsic', label: '固有効果', properties: ['intrinsicMechanicOwnership', 'intrinsic'] }, { id: 'builtIn', label: 'Built-in Enchantment', properties: ['builtInEnchantments'] }, { id: 'other', label: 'その他固有特性', properties: ['specialHandling'] }] },
  ],
  ranged: [
    { title: '基本情報', fields: [{ id: 'nameJa', label: '日本語名' }, { id: 'nameEn', label: '英語名' }, { id: 'category', label: 'カテゴリ' }, { id: 'family', label: '系統 / family', properties: ['family'] }, { id: 'rarity', label: 'レアリティ', properties: ['baseUniqueRelation'] }, { id: 'soul', label: 'Soul 装備', properties: ['soul'] }] },
    { title: '戦闘データ', fields: [{ id: 'damage', label: 'Damage', properties: ['damage'] }, { id: 'mode', label: 'Firing mode', properties: ['firingMode'] }, { id: 'cadence', label: 'Fire rate / cadence', properties: ['cadence', 'shotsPerSecond'] }, { id: 'charge', label: 'Charge information', properties: ['chargeBehavior'] }, { id: 'ammo', label: 'Ammo', properties: ['ammo'] }, { id: 'projectiles', label: 'Projectile count', properties: ['projectileCount'] }, { id: 'area', label: 'Area / Range', properties: ['area', 'range'] }] },
    { title: '固有情報', fields: [{ id: 'intrinsic', label: '固有効果', properties: ['intrinsic'] }, { id: 'builtIn', label: 'Built-in Enchantment', properties: ['builtInEnchantments'] }] },
  ],
  armor: [
    { title: '基本情報', fields: [{ id: 'nameJa', label: '日本語名' }, { id: 'nameEn', label: '英語名' }, { id: 'category', label: 'カテゴリ' }, { id: 'rarity', label: 'レアリティ', properties: ['baseUniqueRelation'] }, { id: 'soul', label: 'Soul 装備', properties: ['soulProperty'] }] },
    { title: '防御 / Status', fields: [{ id: 'health', label: 'Health / added health', properties: ['health', 'addedHealth'] }, { id: 'dr', label: 'Damage Reduction', properties: ['damageReduction'] }, { id: 'movement', label: 'Movement', properties: ['movement'] }, { id: 'cooldown', label: 'Artifact cooldown', properties: ['artifactCooldown'] }, { id: 'damage', label: 'Melee / ranged modifier', properties: ['damageModifier'] }, { id: 'soulGathering', label: 'Soul gathering', properties: ['soulProperty'] }, { id: 'common', label: 'その他の防具効果', properties: ['intrinsicProperties'] }] },
    { title: '固有情報', fields: [{ id: 'intrinsic', label: 'Intrinsic properties', properties: ['intrinsicProperties'] }, { id: 'builtIn', label: 'Built-in effects', properties: ['builtInEnchantments'] }] },
  ],
  artifact: [
    { title: '基本情報', fields: [{ id: 'nameJa', label: '日本語名' }, { id: 'nameEn', label: '英語名' }, { id: 'category', label: 'カテゴリ' }, { id: 'soul', label: 'Soul 系', properties: ['soul'] }] },
    { title: 'Effect data', fields: [{ id: 'cooldown', label: 'Cooldown', properties: ['cooldown'] }, { id: 'duration', label: 'Duration', properties: ['duration'] }, { id: 'soulCost', label: 'Soul Cost', properties: ['soulCost', 'soul'] }, { id: 'damage', label: 'Damage', properties: ['damage', 'powerScalingEvidence'] }, { id: 'healing', label: 'Healing', properties: ['healing'] }, { id: 'control', label: 'Control effect', properties: ['targeting'] }, { id: 'summon', label: 'Summon / pet', properties: ['summon', 'pet'] }, { id: 'other', label: 'その他の効果', properties: ['stacking'] }] },
  ],
  enchantment: [
    { title: 'エンチャント情報', fields: [{ id: 'nameJa', label: '名前' }, { id: 'category', label: '対応カテゴリ' }, { id: 'trigger', label: 'Trigger', properties: ['trigger'] }, { id: 'tiers', label: 'Tier I / II / III', properties: ['tiers'] }, { id: 'effect', label: 'Effect / value', properties: ['damageChannel', 'effect'] }, { id: 'cooldown', label: 'Cooldown', properties: ['cooldown'] }, { id: 'chance', label: 'Proc chance', properties: ['procChance'] }] },
  ],
}

function renderValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  if (typeof value === 'boolean') return value ? 'あり' : 'なし'
  return JSON.stringify(value)
}

function catalogValue(input: EquipmentPresentationInput, field: FieldDefinition): string | undefined {
  const catalog = input.catalog
  if (!catalog) return undefined
  if (field.id === 'family' && catalog.family) return catalog.family
  if (field.id === 'rarity' && catalog.rarityFamily !== 'not-applicable') return catalog.rarityFamily === 'unique' ? 'Unique' : 'Common / Rare'
  if (field.id === 'soul' && catalog.soulGear) return 'あり'
  if ((field.id === 'builtIn') && catalog.builtInEnchantments.length) return catalog.builtInEnchantments.map((item) => `${item.enchantmentId}${item.tier ? ` Tier ${item.tier}` : ''}`).join(' / ')
  if ((field.id === 'intrinsic' || field.id === 'common') && catalog.intrinsicProperties.length) return catalog.intrinsicProperties.map((item) => item.raw).join(' / ')
  return undefined
}

export function equipmentDisplaySections(input: EquipmentPresentationInput): readonly EquipmentDisplaySection[] {
  const accepted = new Map(input.facts.filter((fact) => fact.status === 'accepted').map((fact) => [fact.property, fact.value]))
  const value = (field: FieldDefinition) => {
    if (field.id === 'nameJa') return input.nameJa
    if (field.id === 'nameEn') return input.nameEn ?? '—'
    if (field.id === 'category') return categoryLabel[input.category]
    const structured = catalogValue(input, field)
    if (structured !== undefined) return structured
    if (field.id === 'family' && !field.properties?.some((property) => accepted.has(property))) return input.family || '—'
    const match = field.properties?.find((property) => accepted.has(property))
    return match ? renderValue(accepted.get(match)) : '—'
  }
  return sectionDefinitions[input.category].map((section) => ({ title: section.title, fields: section.fields.map((field) => ({ id: field.id, label: field.label, value: value(field) })) }))
}
