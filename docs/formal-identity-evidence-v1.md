# Formal Identity / Evidence v1

This contract formalizes only equipment identity and its evidence boundary. It does not formalize gameplay values, attack configuration, projectiles, armor properties, or gameplay-effect semantics.

## Artifact boundary

The committed artifact is `research/domain/formal/identity-evidence-v1.json`. Its three same-artifact planes are:

```text
semantic.identities[]
  rawEvidence: known(value) | unavailable
  resolution: matched | unresolved
  presentation: present only when matched

identityAssertions[]
  reviewState: accepted | provisional
  confidence: high | omitted
  fixed Raw application scope

provenance.evidence[]
  reviewed support / limitation / conflict
  Raw observations and exact existing node/parent provenance
```

Assertion review and Raw resolution are independent. A provisional assertion can resolve as `matched`; a decoded value such as `Other` remains `known("Other")` while its resolution is `unresolved`. Detailed unavailable reasons stay in provenance rather than expanding the semantic observation state.

## Matching rules

The v1 projector accepts only Raw schema 2, the assertion's exact package path, exactly one CDO, and exact decoded `NameProperty` values at both `ItemIdName` and `ItemId.SerializedId`. Both values must equal `assertion.rawIdentity`. Missing or ambiguous nodes trace an existing parent or collection and never invent a node pointer.

For a match, `resolution.domainId` is materialized from the referenced assertion. An unresolved resolution has no `domainId` and exposes no presentation. The application-facing adapter reads only `semantic.identity.resolution` and never falls back to assertion, presentation, or repository catalog IDs.

## Evidence integrity

Every assertion, resolution, observation, and presentation `EvidenceRef` resolves within the same artifact. The audit rejects duplicate IDs, dangling refs, mismatched semantic/Raw observations, assertion/resolution evidence mixing, and evidence content changed without updating its stored fingerprint. Fingerprints are drift tripwires, not cryptographic authenticity claims.

The audit also grounds the four current reviewed assertions and presentations in their known source records. It directly checks the two accepted alias records, the Fighter's Bindings unresolved alias plus historical mapping and icon conflict, the Battle Robe catalog and absence of an accepted bridge in the known alias source, and all four current English presentation names. These are explicit slice checks, not a generic locator resolver.

Generate and verify with:

```bash
npm run generate:formal-identity-evidence
npm run audit:formal-identity-evidence
npx vitest run tests/formalIdentityEvidence.test.ts
```

The four committed results are Fighter's Bindings (`provisional`, `matched`), Scatter Crossbow (`accepted/high`, `matched`), Battle Robe (`provisional`, `matched`), and Death Cap Mushroom (`accepted/high`, `matched`). Existing temporary Domain projections remain in place for their non-identity slice data.
