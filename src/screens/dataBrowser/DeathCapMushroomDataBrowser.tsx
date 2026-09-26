import {
  deathCapMushroomBrowserProjection as projection,
  type DeathCapMushroomBrowserField,
  type DeathCapMushroomRelationTraceStep,
} from './deathCapMushroomBrowserModel'

function TraceDetails({ domainField, field }: { domainField: string; field: DeathCapMushroomBrowserField<string> }) {
  return <details className="domain-trace"><summary>provenanceを確認</summary><dl>
    <dt>Domain field</dt><dd><code>{domainField}</code></dd><dt>Raw property</dt><dd><code>{field.rawProperty}</code></dd>
    <dt>Raw package</dt><dd><code>{field.provenance.packagePath}</code></dd><dt>Dataset</dt><dd><code>{field.provenance.datasetId}</code></dd>
    <dt>Extraction run</dt><dd><code>{field.provenance.extractionRunId}</code></dd><dt>Raw node</dt><dd><code>{field.provenance.nodePointer}</code></dd>
  </dl></details>
}

function TraceStep({ step }: { step: DeathCapMushroomRelationTraceStep }) {
  return <li><strong>{step.label}</strong><dl>
    <dt>Artifact path</dt><dd><code>{step.provenance.artifactPath}</code></dd>
    <dt>Raw package</dt><dd><code>{step.provenance.packagePath}</code></dd>
    <dt>Dataset</dt><dd><code>{step.provenance.datasetId}</code></dd>
    <dt>Extraction run</dt><dd><code>{step.provenance.extractionRunId}</code></dd>
    <dt>Package hash</dt><dd><code>{step.provenance.packageHash.algorithm}: {step.provenance.packageHash.value}</code></dd>
    {step.provenance.nodePointer && <><dt>Raw node</dt><dd><code>{step.provenance.nodePointer}</code></dd></>}
    {step.provenance.sourceFingerprint && <><dt>Source fingerprint</dt><dd><code>{step.provenance.sourceFingerprint.algorithm}: {step.provenance.sourceFingerprint.value}</code></dd></>}
  </dl></li>
}

export function DeathCapMushroomDataBrowser() {
  const { identity, effectRelation, gameplayEffectBoundary } = projection
  const itemName = identity.rawItemName
  const serializedId = identity.rawSerializedId

  return <section className="fighters-domain death-cap-domain" aria-labelledby="death-cap-domain-title" data-domain-scope={projection.scope}>
    <header><div><p className="eyebrow">FORMAL GAME DOMAIN</p><h3 id="death-cap-domain-title">{identity.displayName}</h3></div><span className={`domain-status ${identity.status}`}>{identity.status}</span></header>
    <p className="domain-boundary-note">Committed Formal Domainのmatched identityとserialized Effect relationを表示しています。ApplicationではRawの再解析・relationの再判定・targetの再解決を行いません。</p>

    <section className="domain-identity" aria-label="Death Cap Mushroom Domain identity"><h4>Domain identity</h4><dl>
      <dt>Domain ID</dt><dd><code>{identity.domainId}</code></dd>
      <dt>Identity status</dt><dd><span className={`domain-status ${identity.status}`}>{identity.status}</span></dd>
      <dt>ItemIdName</dt><dd><code>{itemName.value}</code></dd>
      <dt>ItemId.SerializedId</dt><dd><code>{serializedId.value}</code></dd>
    </dl>
      <TraceDetails domainField="identity.rawEvidence.itemIdName" field={itemName} />
      <TraceDetails domainField="identity.rawEvidence.serializedId" field={serializedId} />
    </section>

    <section className="domain-identity" aria-label="Effect relation"><h4>Effect serialized relation</h4><dl>
      <dt>Relation result</dt><dd><code>{effectRelation.result}</code></dd>
      <dt>Object name</dt><dd><code>{effectRelation.target.objectName}</code></dd>
      <dt>Class name</dt><dd><code>{effectRelation.target.className}</code></dd>
      <dt>Target package</dt><dd><code>{effectRelation.target.gamePackagePath}</code></dd>
      <dt>Target Raw input</dt><dd><code>{effectRelation.targetRawVerification.input}</code></dd>
      <dt>Target resolution</dt><dd><code>{effectRelation.targetRawVerification.result}</code></dd>
    </dl>
      <p className="domain-boundary-note">Effect serialized relationはFormal v2でprojectedされ、target Raw snapshotもresolvedです。これはGameplayEffect semanticsが既知であることを意味しません。</p>
      <details className="domain-trace effect-reference-trace"><summary>reference provenanceを確認</summary><dl>
        <dt>Domain field</dt><dd><code>effectRelation</code></dd>
        <dt>Raw property</dt><dd><code>{effectRelation.rawProperty}</code></dd>
        <dt>Relation ref</dt><dd><code>{effectRelation.relationRef}</code></dd>
        <dt>Projection ref</dt><dd><code>{effectRelation.projectionRef}</code></dd>
      </dl><ol>{effectRelation.provenance.map((step) => <TraceStep key={step.label} step={step} />)}</ol></details>
    </section>

    <section className="domain-unresolved-list" aria-labelledby="death-cap-boundary-title"><h4 id="death-cap-boundary-title">Formal boundary</h4>
      <p>これはDeath Cap Mushroom Data Browser固有のpresentationです。Formal semanticへ追加のGameplayEffect意味論を作っていません。</p>
      <ul><li><strong>未assert</strong> GameplayEffect semantics<br />{gameplayEffectBoundary.explanation}</li></ul>
    </section>
  </section>
}
