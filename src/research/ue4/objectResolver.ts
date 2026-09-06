import type { ResolvedPackageIndex, UeExportEntry, UeImportEntry } from './packageTypes.ts'

export class PackageObjectResolver {
  private readonly imports: readonly UeImportEntry[]
  private readonly exports: readonly UeExportEntry[]

  constructor(
    imports: readonly UeImportEntry[],
    exports: readonly UeExportEntry[],
  ) {
    this.imports = imports
    this.exports = exports
  }

  resolve(rawPackageIndex: number): ResolvedPackageIndex {
    return this.resolveInternal(rawPackageIndex, new Set())
  }

  private resolveInternal(rawPackageIndex: number, visited: Set<number>): ResolvedPackageIndex {
    if (rawPackageIndex === 0) return { rawPackageIndex, kind: 'null' }
    if (rawPackageIndex < 0) {
      const index = -rawPackageIndex - 1
      const entry = this.imports[index]
      if (!entry) return { rawPackageIndex, kind: 'invalid', index }
      return {
        rawPackageIndex, kind: 'import', index,
        objectName: entry.objectName.value,
        className: entry.className.value,
      }
    }
    const index = rawPackageIndex - 1
    const entry = this.exports[index]
    if (!entry) return { rawPackageIndex, kind: 'invalid', index }
    if (visited.has(rawPackageIndex)) return { rawPackageIndex, kind: 'export', index, objectName: entry.objectName.value }
    visited.add(rawPackageIndex)
    const classResolution = entry.classIndex === rawPackageIndex ? undefined : this.resolveInternal(entry.classIndex, visited)
    return {
      rawPackageIndex, kind: 'export', index,
      objectName: entry.objectName.value,
      ...(classResolution?.objectName ? { className: classResolution.objectName } : {}),
    }
  }
}
