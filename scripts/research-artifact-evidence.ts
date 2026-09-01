import fs from 'node:fs'
import path from 'node:path'
import {
  buildArtifactCurveAudit,
  buildArtifactCurveValidation,
  collectArtifactEvidenceErrors,
  renderArtifactCurveAnalysis,
  renderArtifactEvidenceMatrix,
  renderArtifactEvidenceReport,
} from '../src/research/artifactEvidence.ts'

const errors = collectArtifactEvidenceErrors()
if (errors.length) throw new Error(errors.join('\n'))

const root = process.cwd()
const writes = new Map<string, string>([
  ['research/artifact-evidence/curve-validation.json', `${JSON.stringify(buildArtifactCurveValidation(), null, 2)}\n`],
  ['research/artifact-curve-audit.json', `${JSON.stringify(buildArtifactCurveAudit(), null, 2)}\n`],
  ['docs/artifact-evidence-matrix.md', renderArtifactEvidenceMatrix()],
  ['docs/artifact-curve-analysis.md', renderArtifactCurveAnalysis()],
  ['docs/artifact-evidence-acquisition.md', renderArtifactEvidenceReport()],
])

for (const [relativePath, content] of writes) {
  fs.writeFileSync(path.join(root, relativePath), content)
}

console.log(`Generated ${writes.size} Artifact evidence outputs from checked-in snapshots; no network access used.`)
