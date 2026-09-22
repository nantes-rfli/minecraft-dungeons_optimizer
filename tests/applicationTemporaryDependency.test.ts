import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const repositoryRoot = process.cwd()
const sourceRoot = path.join(repositoryRoot, 'src')
const excludedPrefixes = ['src/domain/formal/', 'src/domain/temporary/']
const forbiddenRoots = ['research/domain/temporary', 'src/domain/temporary']

function toRepositoryPath(filePath: string): string {
  return path.relative(repositoryRoot, filePath).split(path.sep).join('/')
}

function isApplicationSource(filePath: string): boolean {
  const repositoryPath = toRepositoryPath(filePath)
  return (
    /\.tsx?$/.test(repositoryPath)
    && !excludedPrefixes.some((prefix) => repositoryPath.startsWith(prefix))
  )
}

function listApplicationSourceFiles(directory = sourceRoot): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name)
    if (entry.isDirectory()) return listApplicationSourceFiles(entryPath)
    return isApplicationSource(entryPath) ? [entryPath] : []
  })
}

function maskComments(source: string): string {
  let result = ''
  let quote: "'" | '"' | '`' | null = null

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index]!
    const next = source[index + 1]

    if (quote) {
      result += character
      if (character === '\\') {
        if (next !== undefined) {
          result += next
          index += 1
        }
      } else if (character === quote) {
        quote = null
      }
      continue
    }

    if (character === "'" || character === '"' || character === '`') {
      quote = character
      result += character
      continue
    }

    if (character === '/' && next === '/') {
      result += '  '
      index += 1
      while (index + 1 < source.length && source[index + 1] !== '\n') {
        result += ' '
        index += 1
      }
      continue
    }

    if (character === '/' && next === '*') {
      result += '  '
      index += 1
      while (index + 1 < source.length) {
        const blockCharacter = source[index + 1]!
        const blockNext = source[index + 2]
        if (blockCharacter === '*' && blockNext === '/') {
          result += '  '
          index += 2
          break
        }
        result += blockCharacter === '\n' ? '\n' : ' '
        index += 1
      }
      continue
    }

    result += character
  }

  return result
}

function codeMask(source: string): boolean[] {
  const mask = Array.from({ length: source.length }, () => true)
  let quote: "'" | '"' | '`' | null = null

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index]!

    if (quote) {
      mask[index] = false
      if (character === '\\') {
        if (index + 1 < source.length) {
          mask[index + 1] = false
          index += 1
        }
      } else if (character === quote) {
        quote = null
      }
      continue
    }

    if (character === "'" || character === '"' || character === '`') {
      quote = character
      mask[index] = false
    }
  }

  return mask
}

function moduleSpecifiers(source: string): string[] {
  const commentFreeSource = maskComments(source)
  const mask = codeMask(commentFreeSource)
  const patterns = [
    /\b(?:import|export)\s+(?:type\s+)?[^'"`;()]+?\s+from\s*['"]([^'"]+)['"]/g,
    /\bimport\s*['"]([^'"]+)['"]/g,
    /\bimport\s*\(\s*['"]([^'"]+)['"]/g,
    /\brequire\s*\(\s*['"]([^'"]+)['"]/g,
  ]

  return patterns.flatMap((pattern) => {
    const specifiers: string[] = []
    let match: RegExpExecArray | null
    while ((match = pattern.exec(commentFreeSource)) !== null) {
      if (mask[match.index]) specifiers.push(match[1]!)
    }
    return specifiers
  })
}

function isForbiddenDependency(repositoryPath: string, specifier: string): boolean {
  const normalizedSpecifier = specifier.replaceAll('\\\\', '/').replace(/^\/+/, '')
  const resolved = normalizedSpecifier.startsWith('.')
    ? path.posix.normalize(path.posix.join(path.posix.dirname(repositoryPath), normalizedSpecifier))
    : normalizedSpecifier

  return forbiddenRoots.some((root) => resolved === root || resolved.startsWith(`${root}/`))
}

function forbiddenDependencies(repositoryPath: string, source: string): string[] {
  return moduleSpecifiers(source).filter((specifier) => isForbiddenDependency(repositoryPath, specifier))
}

describe('Application temporary Domain dependency guard', () => {
  it('keeps Application/runtime source independent from temporary Domain modules', () => {
    const violations = listApplicationSourceFiles().flatMap((filePath) => {
      const repositoryPath = toRepositoryPath(filePath)
      const source = fs.readFileSync(filePath, 'utf8')
      return forbiddenDependencies(repositoryPath, source).map((specifier) => `${repositoryPath}: ${specifier}`)
    })

    expect(violations).toEqual([])
  })

  it('detects module dependencies without matching comments or UI prose', () => {
    const source = `
      import type { A } from '../domain/temporary/a'
      import { b } from '../../research/domain/temporary/b'
      const dynamic = import('../domain/temporary/c')
      const legacy = require('../domain/temporary/d')
      // import { ignored } from '../domain/temporary/comment'
      /* require('../domain/temporary/comment-block') */
      const uiCopy = "temporary projectionPrimitives fightersBindingsIdentity"
      const codeExample = "import '../domain/temporary/ui-example'"
    `

    expect(forbiddenDependencies('src/screens/example.ts', source)).toEqual([
      '../domain/temporary/a',
      '../../research/domain/temporary/b',
      '../domain/temporary/c',
      '../domain/temporary/d',
    ])
  })
})
