import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

type Category = 'melee-weapon' | 'melee-enchantment' | 'armor' | 'armor-enchantment' | 'ranged-weapon' | 'ranged-enchantment' | 'artifact'
type Interpretation = 'direct' | 'normalized' | 'derived'
type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue }

interface Target {
  category: Category
  id: string
  url: string
}

interface ExtractedClaim {
  entityId: string
  property: string
  value: JsonValue
  sourceId: string
  sourceLocator: string
  extractedAt: string
  sourceGameVersion?: string
  interpretation: Interpretation
  notes?: string
}

const root = fileURLToPath(new URL('..', import.meta.url))
const write = process.argv.includes('--write')
const EXTRACTED_AT = '2026-09-06'
const TARGET_VERSION = '1.17.0.0'
const OUTPUT = path.join(root, 'research/source-harvest/snapshots/dungeons-tools-2026-09-06.json')

const readJson = <T>(relativePath: string): T => JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8')) as T
const rangedWeapons = readJson<{ entries: { id: string; sourceUrl: string }[] }>('research/ranged-weapon-audit.json')
const meleeWeapons = readJson<{ weapons: { weaponId: string; name: { en: string } }[] }>('research/melee-attack-profile-audit.json')
const meleeEnchantments = readJson<{ entries: { id: string }[] }>('research/melee-enchantment-audit.json')
const armors = readJson<{ entries: { id: string }[] }>('research/armor-audit.json')
const armorEnchantments = readJson<{ entries: { id: string }[] }>('research/armor-enchantment-audit.json')
const rangedEnchantments = readJson<{ entries: { id: string }[] }>('research/ranged-enchantment-audit.json')
const artifacts = readJson<{ entries: { id: string; name: string }[]; populationDifferences: { id: string; name: string }[] }>('research/artifact-audit.json')

const externalSlug = (name: string): string => name.toLowerCase().replace(/['’]/g, '-').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

const targets: Target[] = [
  ...rangedWeapons.entries.map((entry) => ({ category: 'ranged-weapon' as const, id: entry.id, url: entry.sourceUrl })),
  ...meleeWeapons.weapons.map((entry) => ({ category: 'melee-weapon' as const, id: entry.weaponId, url: `https://www.dungeons.tools/weapons/${externalSlug(entry.name.en)}` })),
  ...meleeEnchantments.entries.map((entry) => ({ category: 'melee-enchantment' as const, id: entry.id, url: `https://www.dungeons.tools/enchantments/${entry.id}` })),
  ...armors.entries.map((entry) => ({ category: 'armor' as const, id: entry.id, url: `https://www.dungeons.tools/armor/${entry.id}` })),
  ...armorEnchantments.entries.map((entry) => ({ category: 'armor-enchantment' as const, id: entry.id, url: `https://www.dungeons.tools/enchantments/${entry.id}` })),
  ...rangedEnchantments.entries.map((entry) => ({ category: 'ranged-enchantment' as const, id: entry.id, url: `https://www.dungeons.tools/enchantments/${entry.id}` })),
  ...[...artifacts.entries, ...artifacts.populationDifferences].map((entry) => ({ category: 'artifact' as const, id: entry.id, url: `https://www.dungeons.tools/artifacts/${externalSlug(entry.name)}` })),
]

const entities = new Map<string, Target[]>()
for (const target of targets) entities.set(target.url, [...(entities.get(target.url) ?? []), target])

function decodeHtml(value: string): string {
  return value
    .replace(/<!--.*?-->/gs, '')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#x2F;/g, '/')
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
}

function text(value: string): string {
  return decodeHtml(value.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim()
}

function classText(html: string, className: string): string | undefined {
  const match = html.match(new RegExp(`<[^>]+class="[^"]*\\b${className}\\b[^"]*"[^>]*>([\\s\\S]*?)<\\/[^>]+>`))
  const value = match ? text(match[1]) : ''
  return value || undefined
}

function allClassText(html: string, className: string): string[] {
  return [...html.matchAll(new RegExp(`<[^>]+class="[^"]*\\b${className}\\b[^"]*"[^>]*>([\\s\\S]*?)<\\/[^>]+>`, 'g'))]
    .map((match) => text(match[1]))
    .filter(Boolean)
}

function sourceId(target: Target): string {
  return `external-dungeons-tools:${target.category}:${target.id}`
}

function numberWord(value: string): number | undefined {
  const normalized = value.toLowerCase()
  const words: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8 }
  if (normalized in words) return words[normalized]
  const numeric = Number(normalized)
  return Number.isFinite(numeric) ? numeric : undefined
}

function claim(target: Target, property: string, value: JsonValue, locator: string, interpretation: Interpretation = 'direct', notes?: string): ExtractedClaim {
  return {
    entityId: `${target.category}:${target.id}`,
    property,
    value,
    sourceId: sourceId(target),
    sourceLocator: `${target.url} — ${locator}`,
    extractedAt: EXTRACTED_AT,
    sourceGameVersion: `${TARGET_VERSION} publisher-claimed`,
    interpretation,
    ...(notes ? { notes } : {}),
  }
}

function extractCommon(target: Target, mainHtml: string, mainText: string): ExtractedClaim[] {
  const claims: ExtractedClaim[] = []
  const name = classText(mainHtml, 'dh1')
  const kick = classText(mainHtml, 'dkick')
  const properties = allClassText(mainHtml, 'prop')
  const family = mainText.match(/\bFamily\s+(.+?)\s+Content pack\b/)?.[1]
  const contentPack = mainText.match(/\bContent pack\s+(.+?)\s+(?:Souls|Cooldown|Category|Drops in)\b/)?.[1]
  const soulRequirement = mainText.match(/\bSouls\s+(.+?)\s+(?:Category|Drops in|Where it drops|How it plays|Properties)\b/)?.[1]
  const variantOf = mainHtml.match(/class="rest"[^>]*>[\s\S]*?variant of[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i)?.[1]
  if (name) claims.push(claim(target, 'externalIdentity', name, 'detail heading'))
  if (family) claims.push(claim(target, 'family', family, 'Stats and details → Family'))
  if (contentPack) claims.push(claim(target, 'externalContentPack', contentPack, 'Stats and details → Content pack'))
  if (soulRequirement) claims.push(claim(target, 'externalSoulRequirement', soulRequirement, 'Stats and details → Souls'))
  if (variantOf) claims.push(claim(target, 'baseUniqueRelation', { variantOf: text(variantOf) }, 'detail classification', 'normalized'))
  else if (kick && target.category.endsWith('weapon')) claims.push(claim(target, 'baseUniqueRelation', { variantOf: null, classification: kick }, 'detail classification', 'normalized'))
  if (properties.length) {
    const property = target.category === 'armor' ? 'intrinsicProperties' : target.category.endsWith('weapon') ? 'intrinsicMechanicOwnership' : 'externalProperties'
    claims.push(claim(target, property, properties, 'Properties and details'))
  }
  return claims
}

function extractProjectileCount(target: Target, mainHtml: string): ExtractedClaim | undefined {
  const headings = allClassText(mainHtml, 'shead')
  const prose = allClassText(mainHtml, 'prose')
  const candidates = [...headings, ...prose]
  const patterns = [
    /\b(one|two|three|four|five|six|seven|eight|\d+)\s+(?:arrows?|bolts?|projectiles?)\s+(?:leave|fly|fire|are fired|on every|per (?:shot|pull))/i,
    /\b(?:fires?|shoots?|launches?|releases?)\s+(?:up to\s+)?(one|two|three|four|five|six|seven|eight|\d+)\s+(?:arrows?|bolts?|projectiles?)/i,
    /^(one|two|three|four|five|six|seven|eight|\d+)\s+(?:arrows?|bolts?|projectiles?)(?:,|\s+and\b)/i,
    /\b(?:pull|shot)\s+(?:sends|fires|shoots|launches|releases)\s+(one|two|three|four|five|six|seven|eight|\d+)\s+(?:arrows?|bolts?|projectiles?)/i,
    /\b(?:spread|volley)\s+of\s+(one|two|three|four|five|six|seven|eight|\d+)\s+(?:arrows?|bolts?|projectiles?)/i,
    /\b(one|two|three|four|five|six|seven|eight|\d+)\s+(?:arrows?|bolts?|projectiles?)\s+per\s+(?:shot|pull)\b/i,
    /\b(?:sends out|fires|shoots|launches|releases)\s+a\s+pair\s+of\s+(?:arrows?|bolts?|projectiles?)/i,
    /\b(?:shot|pull)\s+splits\s+(?:between|across)\s+(?:a\s+pair|two)\b/i,
  ]
  for (const candidate of candidates) {
    for (const pattern of patterns) {
      const match = candidate.match(pattern)
      const value = match ? (match[1] ? numberWord(match[1]) : 2) : undefined
      if (value !== undefined) return claim(target, 'projectileCount', value, `mechanics text: ${candidate.slice(0, 140)}`, 'normalized', 'Count is accepted only when the page states an explicit projectile number in firing context.')
    }
  }
  return undefined
}

function extractEnchant(target: Target, mainHtml: string): ExtractedClaim[] {
  const claims: ExtractedClaim[] = []
  const description = classText(mainHtml, 'dflav')
  const tierRows = [...mainHtml.matchAll(/<div[^>]+class="[^"]*statrow[^"]*"[^>]*>[\s\S]*?<span[^>]+class="k"[^>]*>\s*TIER\s+([^<]+)<\/span>[\s\S]*?<span[^>]+class="v"[^>]*>([\s\S]*?)<\/span>[\s\S]*?<\/div>/g)]
  const tiers = tierRows.map((match) => text(match[2]))
  const tierNote = classText(mainHtml, 'note')
  const stacksMatch = text(mainHtml).match(/\bSTACKS\s+(Yes|No)\b/i)
  if (description) claims.push(claim(target, 'trigger', { activationWording: description }, 'enchantment description', 'direct', 'Source wording is preserved; no runtime event model is inferred.'))
  if (tiers.length === 3) claims.push(claim(target, 'tiers', { values: tiers, label: tierNote ?? null }, 'Tiers'))
  if (stacksMatch) {
    const stackable = stacksMatch[1].toLowerCase() === 'yes'
    claims.push(claim(target, 'stacking', { stackable }, 'detail summary → STACKS', 'normalized'))
    if (!stackable) claims.push(claim(target, 'maxCopies', 1, 'detail summary → STACKS No', 'normalized'))
  }
  if (description) {
    const fixedChance = description.match(/\b(\d+(?:\.\d+)?)%\s+chance\b/i)
    const percentageTiers = tiers.map((value) => Number(value.match(/-?\d+(?:\.\d+)?/)?.[0])).filter(Number.isFinite)
    if (fixedChance) claims.push(claim(target, 'procChance', { percent: Number(fixedChance[1]) }, 'enchantment description', 'normalized'))
    else if (/\bchance\b/i.test(`${description} ${tierNote ?? ''}`) && percentageTiers.length === 3 && percentageTiers.every((value) => value >= 0)) claims.push(claim(target, 'procChance', { tierPercent: percentageTiers }, 'description + Tiers', 'normalized', 'Source-provided tier values are preserved even when the top display value is 101%.'))

    const numericDuration = description.match(/\bfor\s+(?:about\s+|roughly\s+)?(one|two|three|four|five|six|seven|eight|nine|ten|\d+(?:\.\d+)?)\s+seconds?\b/i)
    const durationTier = /seconds?\s+duration\s+per\s+tier/i.test(tierNote ?? '') ? tiers.map((value) => Number(value.match(/\d+(?:\.\d+)?/)?.[0])).filter(Number.isFinite) : []
    if (numericDuration) claims.push(claim(target, 'duration', { seconds: numberWord(numericDuration[1]) ?? Number(numericDuration[1]) }, 'enchantment description', 'normalized'))
    else if (durationTier.length === 3) claims.push(claim(target, 'duration', { tierSeconds: durationTier }, 'Tiers + tier label', 'normalized'))
    else {
      const qualitativeDuration = description.match(/\b(short duration|short time|briefly|temporary|temporarily)\b/i)?.[1]
      if (qualitativeDuration) claims.push(claim(target, 'duration', { sourceWording: qualitativeDuration }, 'enchantment description'))
    }

    const interval = description.match(/\bevery\s+(one|two|three|four|five|six|seven|eight|nine|ten|\d+(?:\.\d+)?)\s+seconds?\b/i)
    const cooldownTiers = /(?:reduced|decreased)\s+cool-?down/i.test(`${description} ${tierNote ?? ''}`) ? tiers : []
    const intervalTiers = /(?:up to\s+)?every\s+x\s+seconds?|triggers every x seconds?/i.test(tierNote ?? '')
      ? tiers.map((value) => /^every second$/i.test(value) ? 1 : Number(value.match(/\d+(?:\.\d+)?/)?.[0])).filter(Number.isFinite)
      : []
    if (interval) claims.push(claim(target, 'cooldown', { periodicIntervalSeconds: numberWord(interval[1]) ?? Number(interval[1]) }, 'enchantment description', 'normalized', 'Periodic interval is retained as such; it is not treated as a player-triggered cooldown.'))
    else if (cooldownTiers.length === 3) claims.push(claim(target, 'cooldown', { tierValues: cooldownTiers, kind: 'cooldown-reduction' }, 'description + Tiers', 'normalized'))
    else if (intervalTiers.length === 3) claims.push(claim(target, 'cooldown', { tierIntervalSeconds: intervalTiers, kind: 'periodic-interval' }, 'Tiers + tier label', 'normalized', 'Periodic interval is retained as such; it is not treated as a player-triggered cooldown.'))
  }
  return claims
}

function extractArtifact(target: Target, mainHtml: string, mainText: string): ExtractedClaim[] {
  const claims: ExtractedClaim[] = []
  const properties = allClassText(mainHtml, 'prop')
  const cooldown = mainText.match(/\bCooldown\s+(\d+(?:\.\d+)?)s\b/i)
  if (cooldown) claims.push(claim(target, 'cooldown', { seconds: Number(cooldown[1]) }, 'Properties and details → Cooldown', 'normalized'))
  const propertyText = properties.join(' ')
  const duration = propertyText.match(/\b(\d+(?:\.\d+)?)\s*seconds?\b/i)
  if (duration) claims.push(claim(target, 'duration', { seconds: Number(duration[1]), sourceWording: propertyText }, 'Properties and details', 'normalized'))
  const targeting = properties.filter((value) => /\b(nearby|allies?|enemies|mobs?|target|player|you|area|cone|forward)\b/i.test(value))
  if (targeting.length) claims.push(claim(target, 'targeting', { sourceWording: targeting }, 'Properties and details'))
  return claims
}

async function fetchHtml(url: string): Promise<{ status: 'available'; html: string } | { status: 'unavailable'; note: string }> {
  let lastError = 'unknown fetch error'
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(20_000), headers: { 'user-agent': 'minecraft-dungeons-optimizer-source-extractor/1.0' } })
      if (response.ok) return { status: 'available', html: await response.text() }
      lastError = `HTTP ${response.status}`
      if (response.status === 404) break
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error)
    }
    await new Promise((resolve) => setTimeout(resolve, 400 * (2 ** (attempt - 1))))
  }
  return { status: 'unavailable', note: lastError }
}

const claims: ExtractedClaim[] = []
const attempts: { entityId: string; sourceId: string; sourceUrl: string; result: 'value-found' | 'not-found' | 'unavailable'; propertiesFound: string[]; note?: string }[] = []
const sources: { id: string; sourceType: 'game-file'; title: string; url: string; gameVersion: string; versionStatus: 'claimed-current'; retrievedAt: string; notes: string }[] = []
const urlEntries = [...entities.entries()]

for (let offset = 0; offset < urlEntries.length; offset += 6) {
  const batch = urlEntries.slice(offset, offset + 6)
  const results = await Promise.all(batch.map(async ([url, entries]) => ({ url, entries, response: await fetchHtml(url) })))
  for (const { url, entries, response } of results) {
    for (const target of entries) {
      sources.push({ id: sourceId(target), sourceType: 'game-file', title: `dungeons.tools ${target.id}`, url, gameVersion: `${TARGET_VERSION} publisher-claimed`, versionStatus: 'claimed-current', retrievedAt: EXTRACTED_AT, notes: 'The publisher identifies database stats and assets as 1.17.0.0 game-file-derived. Only displayed fields and restrained normalizations are harvested; guide prose is not treated as a game-file claim, and the version claim is not independent verification.' })
      if (response.status === 'unavailable') {
        attempts.push({ entityId: `${target.category}:${target.id}`, sourceId: sourceId(target), sourceUrl: url, result: 'unavailable', propertiesFound: [], note: response.note })
        continue
      }
      const mainHtml = response.html.match(/<main id="content"[\s\S]*?<\/main>/)?.[0]
      if (!mainHtml || /This page could not be found/.test(mainHtml)) {
        attempts.push({ entityId: `${target.category}:${target.id}`, sourceId: sourceId(target), sourceUrl: url, result: 'not-found', propertiesFound: [], note: 'Detail page missing or did not contain the expected main content.' })
        continue
      }
      const mainText = text(mainHtml)
      const extracted = [
        ...extractCommon(target, mainHtml, mainText),
        ...(target.category.endsWith('enchantment') ? extractEnchant(target, mainHtml) : []),
        ...(target.category === 'ranged-weapon' ? [extractProjectileCount(target, mainHtml)].filter((value): value is ExtractedClaim => Boolean(value)) : []),
        ...(target.category === 'artifact' ? extractArtifact(target, mainHtml, mainText) : []),
      ]
      claims.push(...extracted)
      attempts.push({ entityId: `${target.category}:${target.id}`, sourceId: sourceId(target), sourceUrl: url, result: extracted.length ? 'value-found' : 'not-found', propertiesFound: [...new Set(extracted.map((item) => item.property))], ...(extracted.length ? {} : { note: 'Page was available but no accepted structured field matched.' }) })
    }
  }
  console.log(`Fetched ${Math.min(offset + batch.length, urlEntries.length)} / ${urlEntries.length} dungeons.tools pages`)
}

const snapshot = {
  schemaVersion: 1,
  targetGameVersion: TARGET_VERSION,
  extractedAt: EXTRACTED_AT,
  extractionPolicy: {
    acceptedInterpretations: ['direct', 'normalized'],
    derivedClaimsAccepted: false,
    fullHtmlStored: false,
    guideProseUsedAsGameFileEvidence: false,
  },
  sources: sources.sort((a, b) => a.id.localeCompare(b.id, 'en')),
  claims: claims.sort((a, b) => `${a.entityId}:${a.property}`.localeCompare(`${b.entityId}:${b.property}`, 'en')),
  attempts: attempts.sort((a, b) => a.entityId.localeCompare(b.entityId, 'en')),
}

const output = `${JSON.stringify(snapshot, null, 2)}\n`
if (write) {
  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true })
  fs.writeFileSync(OUTPUT, output)
  console.log(`Wrote ${path.relative(root, OUTPUT)} with ${snapshot.claims.length} claims and ${snapshot.attempts.length} property-source attempts.`)
} else {
  if (!fs.existsSync(OUTPUT)) throw new Error(`Missing snapshot: ${path.relative(root, OUTPUT)}. Run npm run research:source-extract -- --write.`)
  if (fs.readFileSync(OUTPUT, 'utf8') !== output) throw new Error(`Snapshot drift: ${path.relative(root, OUTPUT)}. Run npm run research:source-extract -- --write.`)
  console.log(`External source snapshot is current: ${snapshot.claims.length} claims.`)
}
