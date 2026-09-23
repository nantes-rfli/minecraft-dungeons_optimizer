import { describe, expect, it } from 'vitest'
import {
  RAW_STRUCTURAL_CODE_PATHS, RAW_STRUCTURAL_INPUT_PATHS,
  breadthFirstPackageWalk, classifySeedCandidateStatus, resolveRawSeedCandidates,
  type RawSeedCandidateInput,
} from '../scripts/game-data-raw-structural-inventory.ts'

describe('Raw structural inventory traversal', () => {
  it('visits a cyclic graph once while retaining a deterministic breadth-first discovery edge', () => {
    const graph: Record<string, { id: string; targetPath: string }[]> = {
      A: [{ id: 'a-b', targetPath: 'B' }, { id: 'a-c', targetPath: 'C' }],
      B: [{ id: 'b-a', targetPath: 'A' }, { id: 'b-d', targetPath: 'D' }],
      C: [{ id: 'c-d', targetPath: 'D' }],
      D: [{ id: 'd-b', targetPath: 'B' }],
    }
    const result = breadthFirstPackageWalk(['A'], (packagePath) => graph[packagePath] ?? [])

    expect(result.visitedPaths).toEqual(['A', 'B', 'C', 'D'])
    expect(result.depths).toEqual({ A: 0, B: 1, C: 1, D: 2 })
    expect([...result.discoveryEdgeIds].sort()).toEqual(['a-b', 'a-c', 'b-d'])
  })

  it('separates implementation code identity from repository generation inputs', () => {
    expect(RAW_STRUCTURAL_CODE_PATHS).toEqual([
      'scripts/game-data-raw-structural-inventory.ts',
      'scripts/game-data-package-source.ts',
      'src/research/ue4/binaryReader.ts',
      'src/research/ue4/objectResolver.ts',
      'src/research/ue4/packageReader.ts',
      'src/research/ue4/packageTypes.ts',
      'src/research/ue4/propertyReader.ts',
    ])
    expect(RAW_STRUCTURAL_INPUT_PATHS).toEqual([
      'research/melee-attack-profile-audit.json',
      'research/armor-audit.json',
      'research/ranged-weapon-audit.json',
      'research/artifact-audit.json',
      'research/raw/game-data-asset-index.json',
      'generated/equipment-icons/manifest.json',
    ])
    expect(RAW_STRUCTURAL_CODE_PATHS.filter((path) => RAW_STRUCTURAL_INPUT_PATHS.includes(path as never))).toEqual([])
  })

  it('requires a serialized catalog identifier for exact status; icon heuristics alone stay provisional', () => {
    expect(classifySeedCandidateStatus([])).toBe('not-found')
    expect(classifySeedCandidateStatus([{ role: 'instance', evidence: ['seed-search:icon-manifest-path-used-as-candidate-search-hint-only'] }])).toBe('provisional')
    expect(classifySeedCandidateStatus([{ role: 'instance', evidence: ['serialized-identity-match:ItemIdName->catalog:death-cap-mushroom'] }])).toBe('exact')
    expect(classifySeedCandidateStatus([
      { role: 'instance', evidence: ['serialized-identity-match:ItemIdName->catalog:fireworks-arrow'] },
      { role: 'instance', evidence: ['serialized-identifier:ItemIdName=FireworksArrowItem'] },
    ])).toBe('ambiguous')
  })

  it('keeps all Gauntlets unique ordinals as raw candidates for each family catalog entry', () => {
    const candidates = ['1', '2', '3'].map((ordinal) => rawCandidate(
      `Dungeons/Content/Actors/Equipment/MeleeWeapons/Gauntlets_Unique${ordinal}/BP_Gauntlets_Unique${ordinal}Instance`,
      'melee', `Gauntlets_Unique${ordinal}`,
    ))
    for (const [catalogId, displayName, iconOrdinal] of [
      ['fighters-bindings', "Fighter's Bindings", '1'], ['maulers', 'Maulers', '2'], ['soul-fists', 'Soul Fists', '3'],
    ]) {
      const resolution = resolveRawSeedCandidates(
        { category: 'melee', catalogId: catalogId!, displayName: displayName! },
        iconHint('melee', catalogId!, `Dungeons/Content/Actors/Equipment/MeleeWeapons/Gauntlets_Unique${iconOrdinal}`),
        candidates,
      )
      expect(resolution.candidates.map((candidate) => candidate.packagePath)).toEqual(candidates.map((candidate) => candidate.packagePath))
      expect(classifySeedCandidateStatus(resolution.candidates)).toBe('ambiguous')
    }
  })

  it('finds Satchel of Elements and Scatter Mines in gameplay folders separated from their icon folders', () => {
    const cases = [
      {
        id: 'satchel-of-elements', name: 'Satchel of Elements', folder: 'SatchelOfTheElements',
        gameplayPackage: 'Dungeons/Content/Content_DLC3/Actors/Items/SatchelOfTheElements/BP_SatchelOfTheElementsInstance',
      },
      {
        id: 'scatter-mines', name: 'Scatter Mines', folder: 'ChargedRedstoneMines',
        gameplayPackage: 'Dungeons/Content/Content_DLC3/Actors/Items/ChargedRedstoneMines/BP_ChargedRedstoneMinesInstance',
      },
    ]
    for (const item of cases) {
      const gameplayCandidate = rawCandidate(item.gameplayPackage, 'artifact', item.folder)
      const resolution = resolveRawSeedCandidates(
        { category: 'artifact', catalogId: item.id, displayName: item.name },
        iconHint('artifact', item.id, `Dungeons/Content/Actors/Items/${item.folder}`),
        [gameplayCandidate],
      )
      expect(resolution.candidates.map((candidate) => candidate.packagePath)).toEqual([item.gameplayPackage])
      expect(classifySeedCandidateStatus(resolution.candidates)).toBe('provisional')
      expect(resolution.matchBasis).toContain('icon-manifest-path-used-as-candidate-search-hint-only')
    }
  })

  it('does not collapse Fireworks Arrow sibling Instance packages when one serialized ID matches', () => {
    const candidates = [
      rawCandidate('Dungeons/Content/Actors/Items/FireworksArrowItem/BP_FireworksArrowInstance', 'artifact', 'FireworksArrow', 'FireworksArrow'),
      rawCandidate('Dungeons/Content/Actors/Items/FireworksArrowItem/BP_FireworksArrowItemInstance', 'artifact', 'FireworksArrowItem', 'FireworksArrowItem'),
    ]
    const resolution = resolveRawSeedCandidates(
      { category: 'artifact', catalogId: 'fireworks-arrow', displayName: 'Fireworks Arrow' },
      iconHint('artifact', 'fireworks-arrow', 'Dungeons/Content/Actors/Items/FireworksArrowItem'),
      candidates,
    )
    expect(resolution.candidates.map((candidate) => candidate.packagePath)).toEqual(candidates.map((candidate) => candidate.packagePath))
    expect(classifySeedCandidateStatus(resolution.candidates.map((candidate) => ({ role: candidate.role, evidence: candidate.evidence })))).toBe('ambiguous')
  })
})

function rawCandidate(packagePath: string, category: string, rawIdentity: string, serializedId = rawIdentity): RawSeedCandidateInput {
  const base = packagePath.split('/').at(-1)!
  return {
    packagePath,
    objectName: `${base}_C`,
    category,
    role: 'instance',
    serializedIdentifiers: [
      { field: 'ItemIdName', value: rawIdentity },
      { field: 'ItemId.SerializedId', value: serializedId },
    ],
    serializedIdentityReadState: 'decoded',
    evidence: [`local-uasset:${packagePath}.uasset`],
  }
}

function iconHint(category: string, catalogId: string, sourcePackage: string) {
  return { category, catalogId, status: 'matched', matchMethod: 'family-unique-ordinal', sourcePackage }
}
