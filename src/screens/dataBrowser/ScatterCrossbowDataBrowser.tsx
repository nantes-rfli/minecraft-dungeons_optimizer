import {
  scatterCrossbowBrowserProjection as projection,
  type ScatterCrossbowBrowserField,
  type ScatterCrossbowRelationTraceStep,
} from './scatterCrossbowBrowserModel'

function FieldValue<T extends number | string | boolean>({ field, suffix = '' }: { field: ScatterCrossbowBrowserField<T>; suffix?: string }) {
  return <>{typeof field.value === 'boolean' ? String(field.value) : field.value}{suffix}</>
}

function TraceDetails({ domainField, field }: { domainField: string; field: ScatterCrossbowBrowserField<unknown> }) {
  return <details className="domain-trace"><summary>provenanceを確認</summary><dl>
    <dt>Domain field</dt><dd><code>{domainField}</code></dd>
    <dt>Raw property</dt><dd><code>{field.rawProperty}</code></dd>
    {field.projectionRef && <><dt>Value projection ref</dt><dd><code>{field.projectionRef}</code></dd></>}
    {field.relationProjectionRef && <><dt>Relation projection ref</dt><dd><code>{field.relationProjectionRef}</code></dd></>}
    <dt>{field.projectionRef ? 'Value EvidenceRef' : 'Identity EvidenceRef'}</dt><dd><code>{field.evidenceRefs.join(', ')}</code></dd>
    <dt>Artifact path</dt><dd><code>{field.provenance.artifactPath}</code></dd>
    <dt>Raw package</dt><dd><code>{field.provenance.packagePath}</code></dd>
    <dt>Dataset</dt><dd><code>{field.provenance.datasetId}</code></dd>
    <dt>Extraction run</dt><dd><code>{field.provenance.extractionRunId}</code></dd>
    <dt>Package hash</dt><dd><code>{field.provenance.packageHash.algorithm}: {field.provenance.packageHash.value}</code></dd>
    {field.provenance.nodePointer && <><dt>Raw node</dt><dd><code>{field.provenance.nodePointer}</code></dd></>}
  </dl></details>
}

function TraceStep({ step }: { step: ScatterCrossbowRelationTraceStep }) {
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

export function ScatterCrossbowDataBrowser() {
  const {
    identity,
    configuredProjectileDefinitions,
    configuredProjectileVelocityFactor,
    boundary,
  } = projection
  const definition = configuredProjectileDefinitions.definitions[0]

  return <section className="fighters-domain scatter-domain" aria-labelledby="scatter-domain-title" data-domain-scope={projection.scope}>
    <header><div><p className="eyebrow">FORMAL GAME DOMAIN</p><h3 id="scatter-domain-title">{identity.displayName}</h3></div><span className={`domain-status ${identity.status}`}>{identity.status}</span></header>
    <p className="domain-boundary-note">Committed Formal Domainのmatched identity・configured Value・Projectile relationを表示しています。ApplicationではRawの再解析、Value availability、serialized relation、target resolutionを再判定しません。</p>

    <section className="domain-identity" aria-label="Scatter Crossbow Domain identity"><h4>Domain identity</h4><dl>
      <dt>Domain ID</dt><dd><code>{identity.domainId}</code></dd>
      <dt>Identity status</dt><dd><span className={`domain-status ${identity.status}`}>{identity.status}</span></dd>
      <dt>ItemIdName</dt><dd><code>{identity.rawItemName.value}</code></dd>
      <dt>ItemId.SerializedId</dt><dd><code>{identity.rawSerializedId.value}</code></dd>
    </dl>
      <TraceDetails domainField="identity.rawEvidence.itemIdName" field={identity.rawItemName} />
      <TraceDetails domainField="identity.rawEvidence.serializedId" field={identity.rawSerializedId} />
    </section>

    <section className="domain-attacks" aria-labelledby="configured-projectile-title"><h4 id="configured-projectile-title">Configured projectile definition</h4>
      {definition ? <><div className="domain-table-scroll"><table><thead><tr><th scope="col">Entry</th><th scope="col">Configured projectile count</th><th scope="col">Configured angle span</th><th scope="col">Configured delay per projectile</th></tr></thead><tbody><tr>
        <th scope="row">#{definition.sourceIndex + 1}</th>
        <td data-domain-field="configuredProjectileDefinitions[0].configuredProjectileCount"><FieldValue field={definition.configuredProjectileCount} /><TraceDetails domainField="projectileDefinitions[0].configuredProjectileCount" field={definition.configuredProjectileCount} /></td>
        <td data-domain-field="configuredProjectileDefinitions[0].configuredAngleSpan"><FieldValue field={definition.configuredAngleSpan} /><TraceDetails domainField="projectileDefinitions[0].configuredAngleSpan" field={definition.configuredAngleSpan} /></td>
        <td data-domain-field="configuredProjectileDefinitions[0].configuredDelaySecondsPerProjectile"><FieldValue field={definition.configuredDelaySecondsPerProjectile} suffix=" s" /><TraceDetails domainField="projectileDefinitions[0].configuredDelaySecondsPerProjectile" field={definition.configuredDelaySecondsPerProjectile} /></td>
      </tr></tbody></table></div><TraceDetails domainField="configuredProjectileDefinitions" field={configuredProjectileDefinitions} /></> : <p className="domain-boundary-note">Formal Value artifactにはconfigured projectile definition entryがありません。</p>}
    </section>

    <section className="domain-identity" aria-label="Configured projectile velocity factor"><h4>Configured projectile velocity factor</h4><dl>
      <dt>Serialized value</dt><dd data-domain-field="configuredProjectileVelocityFactor"><FieldValue field={configuredProjectileVelocityFactor} /></dd>
    </dl><TraceDetails domainField="configuredProjectileVelocityFactor" field={configuredProjectileVelocityFactor} /></section>

    {definition && <section className="domain-identity" aria-label="Projectile relation"><h4>Projectile serialized relation</h4><dl>
      <dt>Source index</dt><dd><code>{definition.projectileRelation.sourceIndex}</code></dd>
      <dt>Relation result</dt><dd><code>{definition.projectileRelation.result}</code></dd>
      <dt>Object name</dt><dd><code>{definition.projectileRelation.target.objectName}</code></dd>
      <dt>Class name</dt><dd><code>{definition.projectileRelation.target.className}</code></dd>
      <dt>Target package</dt><dd><code>{definition.projectileRelation.target.gamePackagePath}</code></dd>
      <dt>Target Raw input</dt><dd><code>{definition.projectileRelation.targetRawVerification.input}</code></dd>
      <dt>Target resolution</dt><dd><code>{definition.projectileRelation.targetRawVerification.result}</code></dd>
    </dl>
      <p className="domain-boundary-note">Projectile relationとtarget resolutionはFormal Relation artifactの結果をそのまま表示しています。ApplicationではObjectProperty validity・import chain・target correspondenceを再検証しません。</p>
      <details className="domain-trace projectile-reference-trace"><summary>reference provenanceを確認</summary><dl>
        <dt>Domain field</dt><dd><code>projectileDefinitions[0].projectileRelation</code></dd>
        <dt>Raw property</dt><dd><code>{definition.projectileRelation.rawProperty}</code></dd>
        <dt>Relation ref</dt><dd><code>{definition.projectileRelation.relationRef}</code></dd>
        <dt>Projection ref</dt><dd><code>{definition.projectileRelation.projectionRef}</code></dd>
        <dt>Relation EvidenceRef</dt><dd><code>{definition.projectileRelation.evidenceRefs.join(', ')}</code></dd>
      </dl><ol>{definition.projectileRelation.provenance.map((step) => <TraceStep key={step.label} step={step} />)}</ol></details>
    </section>}

    {definition && <section className="domain-identity" aria-label="Configured referenced projectile parameters"><h4>Configured referenced projectile parameters</h4><dl>
      <dt>Configured pushback enabled</dt><dd data-domain-field="configuredPushbackEnabled"><FieldValue field={definition.configuredPushbackEnabled} /><TraceDetails domainField="projectileDefinitions[0].configuredPushbackEnabled" field={definition.configuredPushbackEnabled} /></dd>
      <dt>Configured pushback strength</dt><dd data-domain-field="configuredPushbackStrength"><FieldValue field={definition.configuredPushbackStrength} /><TraceDetails domainField="projectileDefinitions[0].configuredPushbackStrength" field={definition.configuredPushbackStrength} /></dd>
      <dt>Configured ignore friendly fire</dt><dd data-domain-field="configuredIgnoreFriendlyFire"><FieldValue field={definition.configuredIgnoreFriendlyFire} /><TraceDetails domainField="projectileDefinitions[0].configuredIgnoreFriendlyFire" field={definition.configuredIgnoreFriendlyFire} /></dd>
    </dl>
      <p className="domain-boundary-note">上記3 ValueはFormal Value artifactに存在する値を表示しています。relationProjectionRefは対応Relationのpresentation参照にのみ使用し、ApplicationでValue validityを再判定しません。</p>
    </section>}

    <section className="domain-unresolved-list" aria-labelledby="scatter-boundary-title"><h4 id="scatter-boundary-title">Formal boundary</h4>
      <p>以下はScatter Crossbow Data Browser固有のApplication boundary presentationです。Formal artifactのfield欠落からgeneric unknownを推論していません。</p>
      <ul>{boundary.map((item) => <li key={item}><strong>未assert</strong> {item}</li>)}</ul>
    </section>
  </section>
}
