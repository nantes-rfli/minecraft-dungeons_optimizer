import { createServer } from 'vite'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const server = await createServer({ root, configFile: false, server: { middlewareMode: true, hmr: false, watch: null, ws: false } })
try {
  const module = await server.ssrLoadModule('/src/research/armorExpansionAudit.ts')
  const errors = module.collectArmorExpansionAuditErrors()
  if (errors.length) throw new Error(errors.join('\n'))
  const completion = module.ARMOR_EXPANSION_AUDIT.completion
  console.log(`Armor runtime ${completion.runtimeArmorCount} / 73 · Armor Enchant runtime ${completion.runtimeArmorEnchantmentCount} / 41 · CDR stacking inconclusive`)
} finally {
  await server.close()
}
