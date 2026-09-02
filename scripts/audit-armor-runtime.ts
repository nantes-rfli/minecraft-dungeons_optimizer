import { createServer } from 'vite'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const server = await createServer({ root, configFile: false, server: { middlewareMode: true, hmr: false, watch: null, ws: false } })
try {
  const runtime = await server.ssrLoadModule('/src/research/armorRuntimeAudit.ts')
  const armor = await server.ssrLoadModule('/src/research/armorAudit.ts')
  const errors = [...runtime.collectArmorRuntimeAuditErrors(), ...armor.collectArmorSupportErrors()]
  if (errors.length) throw new Error(errors.join('\n'))
  const audit = runtime.ARMOR_CORE_RUNTIME_AUDIT
  console.log(`Armor runtime ${audit.completion.runtimeArmorCount} / 73 · Armor Enchant runtime ${audit.completion.runtimeArmorEnchantmentCount} / 41 · ${audit.completion.supportLevel}`)
} finally {
  await server.close()
}
