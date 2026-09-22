import {
  battleRobeBrowserProjection as projection,
  type BattleRobeBrowserField,
  type BattleRobeRelationTraceStep,
} from './battleRobeBrowserModel'

function TraceDetails({ domainField, field }: { domainField: string; field: BattleRobeBrowserField<string> }) {
  return <details className="domain-trace"><summary>provenanceを確認</summary><dl>
    <dt>Domain field</dt><dd><code>{domainField}</code></dd><dt>Raw property</dt><dd><code>{field.rawProperty}</code></dd>
    <dt>Raw package</dt><dd><code>{field.provenance.packagePath}</code></dd><dt>Dataset</dt><dd><code>{field.provenance.datasetId}</code></dd>
    <dt>Extraction run</dt><dd><code>{field.provenance.extractionRunId}</code></dd><dt>Raw node</dt><dd><code>{field.provenance.nodePointer}</code></dd>
  </dl></details>
}

function TraceStep({ step }: { step: BattleRobeRelationTraceStep }) {
  return <li><strong>{step.label}</strong><dl>
    <dt>Raw package</dt><dd><code>{step.provenance.packagePath}</code></dd>
    <dt>Dataset</dt><dd><code>{step.provenance.datasetId}</code></dd>
    <dt>Extraction run</dt><dd><code>{step.provenance.extractionRunId}</code></dd>
    <dt>Raw node</dt><dd><code>{step.provenance.nodePointer}</code></dd>
  </dl></li>
}

export function BattleRobeDataBrowser() {
  const { identity, gearActorRelation, armorPropertyBoundary } = projection
  const itemName = identity.rawItemName
  const serializedId = identity.rawSerializedId

  return <section className="fighters-domain battle-robe-domain" aria-labelledby="battle-robe-domain-title" data-domain-scope={projection.scope}>
    <header><div><p className="eyebrow">FORMAL GAME DOMAIN</p><h3 id="battle-robe-domain-title">{identity.displayName ?? 'Identity unresolved'}</h3></div><span className={`domain-status ${identity.status}`}>{identity.status}</span></header>
    <p className="domain-boundary-note">Committed Formal Domainのmatched identityとserialized GearActor relationを表示しています。ApplicationではRawの再解析・relationの再判定・target解決を行いません。</p>

    <section className="domain-identity" aria-label="Battle Robe Domain identity"><h4>Domain identity</h4><dl>
      <dt>Domain ID</dt><dd><code>{identity.domainId}</code></dd>
      <dt>Identity status</dt><dd><span className={`domain-status ${identity.status}`}>{identity.status}</span> — 表示名との対応は暫定です</dd>
      <dt>ItemIdName</dt><dd><code>{itemName.value}</code></dd>
      <dt>ItemId.SerializedId</dt><dd><code>{serializedId.value}</code></dd>
    </dl>
      <TraceDetails domainField="identity.rawEvidence.itemIdName" field={itemName} />
      <TraceDetails domainField="identity.rawEvidence.serializedId" field={serializedId} />
    </section>

    <section className="domain-identity" aria-label="GearActor relation"><h4>GearActor serialized relation</h4><dl>
      <dt>Relation result</dt><dd><code>{gearActorRelation.result}</code></dd>
      <dt>Object name</dt><dd><code>{gearActorRelation.target.objectName}</code></dd>
      <dt>Class name</dt><dd><code>{gearActorRelation.target.className}</code></dd>
      <dt>Target package</dt><dd><code>{gearActorRelation.target.gamePackagePath}</code></dd>
      <dt>Target Raw input</dt><dd><code>{gearActorRelation.targetResolution.input}</code></dd>
      <dt>Target resolution</dt><dd><code>{gearActorRelation.targetResolution.result}</code> — <code>{gearActorRelation.targetResolution.reason}</code></dd>
    </dl>
      <p className="domain-boundary-note">Serialized GearActor relationはFormal v1でprojectedです。一方、target Raw snapshotは供給されておらず、targetはresolvedではありません。</p>
      <details className="domain-trace gear-actor-reference-trace"><summary>reference provenanceを確認</summary><dl>
        <dt>Domain field</dt><dd><code>gearActorRelation</code></dd>
        <dt>Raw property</dt><dd><code>{gearActorRelation.rawProperty}</code></dd>
        <dt>Relation ref</dt><dd><code>{gearActorRelation.relationRef}</code></dd>
        <dt>Projection ref</dt><dd><code>{gearActorRelation.projectionRef}</code></dd>
      </dl><ol>{gearActorRelation.provenance.map((step) => <TraceStep key={step.label} step={step} />)}</ol></details>
    </section>

    <section className="domain-unresolved-list" aria-labelledby="battle-robe-unresolved-title"><h4 id="battle-robe-unresolved-title">Formal boundary</h4>
      <p>これはBattle Robe Data Browser固有のpresentationです。Formal semanticにunknownやownership fieldを追加していません。</p>
      <ul><li><strong>未assert</strong> <code>{armorPropertyBoundary.key}</code><br />{armorPropertyBoundary.explanation}</li></ul>
    </section>
  </section>
}
