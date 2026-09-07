import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
import { loadAlignmentInputs, buildModelAlignment, auditModelAlignment, alignmentOutputs } from './game-data-model-alignment.ts'
const root = fileURLToPath(new URL('..', import.meta.url))
const input = loadAlignmentInputs(root)
const result = buildModelAlignment(input)
const errors = auditModelAlignment(input, result)
if (errors.length) throw new Error(errors.join('\n'))
for (const [file, content] of Object.entries(alignmentOutputs(result))) {
  if (process.argv.includes('--write')) fs.writeFileSync(new URL(`../${file}`, import.meta.url),content)
  if (fs.readFileSync(new URL(`../${file}`, import.meta.url),'utf8')!==content) throw new Error(`${file}: deterministic artifact/docs drift`)
}
if (/\.(uasset|uexp|umap|ubulk)$/im.test(execFileSync('git',['ls-files'],{cwd:root,encoding:'utf8'}))) throw new Error('Raw assets tracked')
console.log(JSON.stringify(result.summary,null,2))
console.log('Model alignment audit passed; runtime promotion not performed.')
