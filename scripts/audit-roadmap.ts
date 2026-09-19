import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {
  FUTURE_CANDIDATES,
  ROADMAP_STATUS_ORDER,
  ROADMAP_TRACKS,
  ROADMAP_WORK_UNITS,
  collectRoadmapWorkUnitErrors,
  type RoadmapWorkStatus,
} from '../src/data/roadmap.ts'

const root = path.resolve(new URL('..', import.meta.url).pathname)
const roadmapPath = path.join(root, 'ROADMAP.md')
const statusHeading: Readonly<Record<RoadmapWorkStatus, string>> = {
  done: 'Done',
  current: 'Current',
  next: 'Next',
  blocked: 'Blocked',
  later: 'Later',
}

function renderUnit(unit: (typeof ROADMAP_WORK_UNITS)[number]): string {
  const lines = [
    `- **${unit.id} — ${unit.title}**: ${unit.goal}`,
    unit.dependsOn?.length ? `  - Depends on: ${unit.dependsOn.join(', ')}` : null,
    unit.dependencyCondition ? `  - Entry condition: ${unit.dependencyCondition}` : null,
    unit.unlocks?.length ? `  - Unlocks: ${unit.unlocks.join(', ')}` : null,
    `  - Completion: ${unit.completionCriteria}`,
    unit.nextAction ? `  - Next: ${unit.nextAction}` : null,
  ]
  return lines.filter((line): line is string => Boolean(line)).join('\n')
}

function renderRoadmapData(): string {
  const trackSections = (['research', 'product'] as const).map((trackId) => {
    const track = ROADMAP_TRACKS[trackId]
    const units = ROADMAP_WORK_UNITS.filter((unit) => unit.track === trackId)
    const groups = ROADMAP_STATUS_ORDER.map((status) => {
      const matching = units.filter((unit) => unit.status === status)
      if (!matching.length) return null
      return `#### ${statusHeading[status]}\n\n${matching.map(renderUnit).join('\n\n')}`
    }).filter((section): section is string => Boolean(section))
    return `### ${track.title}\n\n${track.goal}\n\n${groups.join('\n\n')}`
  }).join('\n\n')

  const future = FUTURE_CANDIDATES.map((candidate) => `- **${candidate.title}**: ${candidate.goal}`).join('\n')
  return `<!-- roadmap-data:start -->\n## Work Units\n\nGenerated from \`src/data/roadmap.ts\`. Do not edit this block directly.\n\n${trackSections}\n\n### Future Candidates\n\n${future}\n<!-- roadmap-data:end -->`
}

const errors = collectRoadmapWorkUnitErrors(ROADMAP_WORK_UNITS)
assert.deepEqual(errors, [], errors.join('\n'))

const source = fs.readFileSync(roadmapPath, 'utf8')
const generated = renderRoadmapData()
assert(source.includes('<!-- roadmap-data:start -->'), 'ROADMAP.md: missing roadmap-data marker')
const next = source.replace(/<!-- roadmap-data:start -->[\s\S]*?<!-- roadmap-data:end -->/, generated)

if (process.argv.includes('--write')) fs.writeFileSync(roadmapPath, next)
else assert.equal(source, next, 'ROADMAP.md roadmap data drift; run npm run generate:roadmap')

console.log(`Roadmap audit passed: ${ROADMAP_WORK_UNITS.length} work units, ${FUTURE_CANDIDATES.length} future candidates.`)