import { deathCapMushroomDomainArtifact as domainArtifact, type DomainTrace, type RawTrace } from './deathCapMushroomBrowserModel'

const unresolvedLabels: Readonly<Record<string, string>> = {
  'gameplay-effect-semantics': 'GameplayEffectのgameplay semanticsは、このtemporary Domainでは未解決です。Applicationでは解釈・補完していません。',
}

function TraceDetails({ domainField, rawProperty, trace }: { domainField: string; rawProperty: string; trace: DomainTrace }) {
  return <details className="domain-trace"><summary>provenanceを確認</summary><dl>
    <dt>Domain field</dt><dd><code>{domainField}</code></dd><dt>Raw property</dt><dd><code>{rawProperty}</code></dd>
    <dt>Raw package</dt><dd><code>{trace.raw.packagePath}</code></dd><dt>Dataset</dt><dd><code>{trace.raw.datasetId}</code></dd>
    <dt>Extraction run</dt><dd><code>{trace.raw.extractionRunId}</code></dd><dt>Raw node</dt><dd><code>{trace.raw.nodePointer}</code></dd>
  </dl></details>
}

function TraceStep({ label, trace }: { label: string; trace: RawTrace }) {
  return <li><strong>{label}</strong><dl>
    <dt>Artifact path</dt><dd><code>{trace.artifactPath}</code></dd>
    <dt>Raw package</dt><dd><code>{trace.packagePath}</code></dd>
    <dt>Dataset</dt><dd><code>{trace.datasetId}</code></dd>
    <dt>Extraction run</dt><dd><code>{trace.extractionRunId}</code></dd>
    <dt>Package hash</dt><dd><code>{trace.packageHash.algorithm}: {trace.packageHash.value}</code></dd>
    {trace.nodePointer && <><dt>Raw node</dt><dd><code>{trace.nodePointer}</code></dd></>}
    {'sourceFingerprint' in trace && <><dt>Source fingerprint</dt><dd><code>{trace.sourceFingerprint.algorithm}: {trace.sourceFingerprint.value}</code></dd></>}
  </dl></li>
}

export function DeathCapMushroomDataBrowser() {
  const { mappings, projection } = domainArtifact
  const { identity, effectReference } = projection
  const itemName = identity.evidence.itemName
  const serializedId = identity.evidence.serializedId

  return <section className="fighters-domain death-cap-domain" aria-labelledby="death-cap-domain-title" data-domain-scope={domainArtifact.scope}>
    <header><div><p className="eyebrow">TEMPORARY GAME DOMAIN</p><h3 id="death-cap-domain-title">{identity.displayName ?? 'Identity unresolved'}</h3></div><span className={`domain-status ${identity.status}`}>{identity.status}</span></header>
    <p className="domain-boundary-note">Death Cap MushroomからGameplayEffect packageへのserialized relationは確認済みですが、GameplayEffectのgameplay semanticsを確定した表示ではありません。</p>

    <section className="domain-identity" aria-label="Death Cap Mushroom Domain identity"><h4>Domain identity</h4><dl>
      <dt>Domain ID</dt><dd><code>{identity.domainId ?? 'unresolved'}</code></dd>
      <dt>Identity status</dt><dd><span className={`domain-status ${identity.status}`}>{identity.status}</span></dd>
      <dt>ItemIdName</dt><dd><code>{itemName.state === 'known' ? itemName.value : itemName.state}</code></dd>
      <dt>ItemId.SerializedId</dt><dd><code>{serializedId.state === 'known' ? serializedId.value : serializedId.state}</code></dd>
    </dl>
      <TraceDetails domainField="identity.evidence.itemName" rawProperty={mappings.identity.rawFields[0]} trace={itemName.trace} />
      <TraceDetails domainField="identity.evidence.serializedId" rawProperty={mappings.identity.rawFields[1]} trace={serializedId.trace} />
    </section>

    {effectReference.state === 'known' ? <section className="domain-identity" aria-label="Effect reference"><h4>Effect reference</h4><dl>
      <dt>Object name</dt><dd><code>{effectReference.value.objectName}</code></dd>
      <dt>Class name</dt><dd><code>{effectReference.value.className}</code></dd>
      <dt>Target Raw package</dt><dd><code>{effectReference.value.targetRawPackagePath}</code></dd>
    </dl><p className="domain-boundary-note">Serialized relationと参照先Raw snapshotの存在だけを示します。参照先の内容や意味は解釈していません。</p>
      <details className="domain-trace effect-reference-trace"><summary>cross-package provenanceを確認</summary><dl><dt>Domain field</dt><dd><code>effectReference</code></dd><dt>Raw property</dt><dd><code>{mappings.effectReference.rawField}</code></dd></dl><ol>
        <TraceStep label="ObjectProperty" trace={effectReference.trace.objectProperty} />
        <TraceStep label="class import" trace={effectReference.trace.classImport} />
        <TraceStep label="outer package import" trace={effectReference.trace.outerPackageImport} />
        <TraceStep label="target Raw snapshot" trace={effectReference.trace.targetRawSnapshot} />
      </ol></details>
    </section> : <section className="domain-identity domain-unresolved" aria-label="Effect reference"><h4>Effect reference</h4><p>{effectReference.state}: {effectReference.reason}</p></section>}

    <section className="domain-unresolved-list" aria-labelledby="death-cap-unresolved-title"><h4 id="death-cap-unresolved-title">Unresolved</h4><p>Domainから渡された未解決境界です。Applicationでは解決・解釈していません。</p><ul>
      {projection.unresolved.map((item) => <li key={item}><strong>未解決</strong> <code>{item}</code><br />{unresolvedLabels[item] ?? item}</li>)}
    </ul></section>
  </section>
}
