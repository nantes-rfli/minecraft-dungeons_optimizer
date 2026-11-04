import fs from 'node:fs'
import { calculateConditionalRanged } from '../src/domain/rangedFinalNative.ts'

const filename = process.argv[2]
if (!filename) throw new Error('Usage: npm run calculate:ranged-native -- <explicit-input.json>')
const result = calculateConditionalRanged(JSON.parse(fs.readFileSync(filename, 'utf8')))
console.log(JSON.stringify(result, null, 2))
if (result.state !== 'known') process.exitCode = 2
