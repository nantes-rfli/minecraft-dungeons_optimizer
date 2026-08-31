import { representativeBuild } from './runtimeCombinations'
import { DEFAULT_SCENARIO } from '../data/scenarios'
import type { ArtifactId, OwnedArtifact } from '../core/types'

export function artifactRegressionCases() {
  const combinations: readonly (readonly ArtifactId[])[] = [
    [], ['death-cap-mushroom'], ['iron-hide-amulet'],
    ['death-cap-mushroom', 'death-cap-mushroom'], ['iron-hide-amulet', 'iron-hide-amulet'],
    ['death-cap-mushroom', 'iron-hide-amulet'],
    ['death-cap-mushroom', 'death-cap-mushroom', 'iron-hide-amulet'],
    ['death-cap-mushroom', 'iron-hide-amulet', 'iron-hide-amulet'],
    ['death-cap-mushroom', 'death-cap-mushroom', 'death-cap-mushroom'],
    ['iron-hide-amulet', 'iron-hide-amulet', 'iron-hide-amulet'],
  ]
  const families = [
    { name: 'plain', build: representativeBuild(['sharpness']) },
    { name: 'synergy', build: representativeBuild(['artifact-synergy']) },
    { name: 'rampaging', build: representativeBuild(['rampaging', 'artifact-synergy']) },
    { name: 'control', build: representativeBuild(['stunning', 'gravity']) },
    { name: 'soul', build: representativeBuild(['anima-conduit', 'soul-siphon', 'rampaging'], 'soul-scythe') },
    { name: 'pain', build: representativeBuild(['pain-cycle', 'leeching', 'guarding-strike']) },
  ]
  return families.flatMap(({ name, build }) => combinations.flatMap((ids, combo) =>
    [0, 0.5, 0.9].map((cooldownReduction) => ({
      name: `${name}/${combo}/cdr-${cooldownReduction}`,
      build: { ...build, artifacts: ids.map((artifactId, index): OwnedArtifact => ({ instanceId: `artifact-${index}`, artifactId, powerLevel: [210, 251, 263][index]! })) },
      scenario: { ...DEFAULT_SCENARIO, cooldownReduction },
    })),
  ))
}
