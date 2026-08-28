import { cloudflare } from '@cloudflare/vite-plugin'
import { sites } from '@openai/sites-vite-plugin'
import vinext from 'vinext'
import { defineConfig } from 'vite'

const isCodexSeatbeltSandbox = process.env.CODEX_SANDBOX === 'seatbelt'

export default defineConfig({
  server: isCodexSeatbeltSandbox
    ? { watch: { useFsEvents: false, usePolling: true } }
    : undefined,
  plugins: [
    vinext(),
    sites(),
    cloudflare({
      viteEnvironment: { name: 'rsc', childEnvironments: ['ssr'] },
      config: {
        main: './worker/index.ts',
        compatibility_flags: ['nodejs_compat'],
        d1_databases: [],
        r2_buckets: [],
      },
    }),
  ],
})
