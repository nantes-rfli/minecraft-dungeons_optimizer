import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

export const PARSER_ID = 'ue4-package-property-parser' as const
export const PARSER_SCHEMA_VERSION = 1 as const
export const LOCAL_DATASET_RELATIVE_ROOT = 'local-game-data/QuickBMS 1.17.0.0'

export function localDatasetRoot(repositoryRoot: string): string {
  return path.join(repositoryRoot, LOCAL_DATASET_RELATIVE_ROOT)
}

export function hashLogicalAsset(datasetRoot: string, sourceFiles: readonly string[]): string {
  const hash = crypto.createHash('sha256')
  for (const sourceFile of [...sourceFiles].sort()) {
    assertSafeAssetPath(sourceFile)
    hash.update(sourceFile, 'utf8')
    hash.update(Uint8Array.of(0))
    hash.update(fs.readFileSync(resolveWithinDatasetRoot(datasetRoot, sourceFile)))
  }
  return hash.digest('hex')
}

export function assertSafeAssetPath(assetPath: string): void {
  if (!isCanonicalAssetPath(assetPath) || path.isAbsolute(assetPath)) throw new Error(`Unsafe dataset-relative asset path: ${assetPath}`)
}

function isCanonicalAssetPath(value: string): boolean {
  return Boolean(value) && !value.startsWith('/') && !value.startsWith('\\')
    && !/^[a-zA-Z]:[\\/]/.test(value) && !value.includes('\\') && !value.split('/').includes('..')
}

export function resolveWithinDatasetRoot(rootRealPath: string, relativePath: string): string {
  assertSafeAssetPath(relativePath)
  const candidate = path.join(rootRealPath, relativePath)
  const candidateRealPath = fs.realpathSync(candidate)
  if (candidateRealPath !== rootRealPath && !candidateRealPath.startsWith(`${rootRealPath}${path.sep}`)) throw new Error(`Asset path escapes the dataset root: ${relativePath}`)
  return candidateRealPath
}
