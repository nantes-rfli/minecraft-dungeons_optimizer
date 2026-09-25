import assert from 'node:assert/strict'
import fs from 'node:fs'
import { collectFormalIntegrationErrors } from '../src/domain/formal/integrationAudit.ts'
import type { FormalIdentityEvidenceArtifact } from '../src/domain/formal/identityEvidence.ts'
import type { FormalValueAvailabilityArtifact } from '../src/domain/formal/valueAvailability.ts'
import type { FormalSerializedRelationArtifact } from '../src/domain/formal/serializedRelation.ts'

const root = new URL('..', import.meta.url)
const read = <T>(path: string): T => JSON.parse(fs.readFileSync(new URL(path, root), 'utf8')) as T
const identity = read<FormalIdentityEvidenceArtifact>('research/domain/formal/identity-evidence-v1.json')
const value = read<FormalValueAvailabilityArtifact>('research/domain/formal/value-availability-v2.json')
const relation = read<FormalSerializedRelationArtifact>('research/domain/formal/serialized-relation-v2.json')
assert.deepEqual(collectFormalIntegrationErrors(identity, value, relation), [])
console.log('Formal Value v2 cross-boundary integration audit passed.')
