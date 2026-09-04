import fs from 'node:fs'
import { createHash } from 'node:crypto'

// Explicit, offline acquisition step. Normal audits never fetch or refresh evidence.
const [weaponsFile, enchantsFile] = process.argv.slice(2)
if (!weaponsFile || !enchantsFile) throw new Error('Usage: node scripts/extract-ranged-sources.ts weapons.html enchantments.html')
const decode = (text: string) => text.replaceAll('&quot;', '"').replaceAll('&#x27;', "'").replaceAll('&amp;', '&')
const extract = (file: string, kind: 'weapons' | 'enchantments') => {
  const html = fs.readFileSync(file, 'utf8')
  const rows = [...html.matchAll(/data-tip="([^"]+)" href="([^"?]+)"/g)].flatMap((match) => {
    const tip = JSON.parse(decode(match[1]!)) as { n: string; k: string; r?: string; f: string[] }
    if (!(kind === 'weapons' ? tip.k.toLowerCase().includes('ranged') : tip.f[0]?.includes('ranged'))) return []
    return [{ id: match[2]!.split('/').at(-1)!, name: tip.n, classification: tip.k, rarity: tip.r ?? (tip.k.startsWith('Powerful') ? 'Powerful' : 'Common'),
      // Store factual ratings/tier text; the source prose is not copied into the snapshot.
      facts: kind === 'weapons' ? tip.f : tip.f.slice(0, 2), sourceUrl: `https://www.dungeons.tools${match[2]}` }]
  }).sort((a, b) => a.id.localeCompare(b.id, 'en'))
  if (rows.length === 0 || new Set(rows.map((row) => row.id)).size !== rows.length) throw new Error(`${kind}: empty or duplicate extracted population`)
  return { url: `https://www.dungeons.tools/${kind}`, accessedAt: '2026-09-04', claimedGameVersion: '1.17.0.0',
    provenance: 'Publisher claims extraction from game files; this project did not independently inspect game binaries.',
    htmlSha256: createHash('sha256').update(html).digest('hex'), rows }
}
fs.writeFileSync('research/ranged-source-snapshot.json', JSON.stringify({ schemaVersion: 1, weapons: extract(weaponsFile, 'weapons'), enchantments: extract(enchantsFile, 'enchantments') }, null, 2) + '\n')
