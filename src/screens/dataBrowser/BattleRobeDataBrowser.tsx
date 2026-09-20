import type { RawTrace, Trace } from '../../domain/temporary/projectionPrimitives'
import { battleRobeDomainArtifact as domainArtifact } from './battleRobeBrowserModel'

const unresolvedLabels: Readonly<Record<string, string>> = {
  'armor-property-ownership': 'このtemporary Domain projectionではBattle RobeのArmor Property所有関係を確立できていません。propertyの件数や有無は判断していません。',
}

function TraceDetails({ domainField, rawProperty, trace }: { domainField: string; rawProperty: string; trace: Trace }) {
  return <details className="domain-trace"><summary>provenanceを確認</summary><dl>
    <dt>Domain field</dt><dd><code>{domainField}</code></dd><dt>Raw property</dt><dd><code>{rawProperty}</code></dd>
    <dt>Raw package</dt><dd><code>{trace.raw.packagePath}</code></dd><dt>Dataset</dt><dd><code>{trace.raw.datasetId}</code></dd>
    <dt>Extraction run</dt><dd><code>{trace.raw.extractionRunId}</code></dd><dt>Raw node</dt><dd><code>{trace.raw.nodePointer}</code></dd>
  </dl></details>
}

function TraceStep({ label, trace }: { label: string; trace: RawTrace }) {
  return <li><strong>{label}</strong><dl><dt>Raw package</dt><dd><code>{trace.packagePath}</code></dd><dt>Dataset</dt><dd><code>{trace.datasetId}</code></dd><dt>Extraction run</dt><dd><code>{trace.extractionRunId}</code></dd><dt>Raw node</dt><dd><code>{trace.nodePointer}</code></dd></dl></li>
}

export function BattleRobeDataBrowser() {
  const { mappings, projection } = domainArtifact
  const { identity, gearActorReference } = projection
  const itemName = identity.evidence.itemName
  const serializedId = identity.evidence.serializedId

  return <section className="fighters-domain battle-robe-domain" aria-labelledby="battle-robe-domain-title" data-domain-scope={domainArtifact.scope}>
    <header><div><p className="eyebrow">TEMPORARY GAME DOMAIN</p><h3 id="battle-robe-domain-title">{identity.displayName ?? 'Identity unresolved'}</h3></div><span className={`domain-status ${identity.status}`}>{identity.status}</span></header>
    <p className="domain-boundary-note">Committed temporary Domain projectionに記録されたidentityとserialized GearActor referenceを表示しています。参照先Actor packageの内容を解決した表示ではありません。</p>

    <section className="domain-identity" aria-label="Battle Robe Domain identity"><h4>Domain identity</h4><dl>
      <dt>Domain ID</dt><dd><code>{identity.domainId ?? 'unresolved'}</code></dd>
      <dt>Identity status</dt><dd><span className={`domain-status ${identity.status}`}>{identity.status}</span> — 表示名との対応は暫定です</dd>
      <dt>ItemIdName</dt><dd><code>{itemName.state === 'known' ? itemName.value : itemName.state}</code></dd>
      <dt>ItemId.SerializedId</dt><dd><code>{serializedId.state === 'known' ? serializedId.value : serializedId.state}</code></dd>
    </dl>
      <TraceDetails domainField="identity.evidence.itemName" rawProperty={mappings.identity.rawFields[0]} trace={itemName.trace} />
      <TraceDetails domainField="identity.evidence.serializedId" rawProperty={mappings.identity.rawFields[1]} trace={serializedId.trace} />
    </section>

    {gearActorReference.state === 'known' ? <section className="domain-identity" aria-label="GearActor reference"><h4>GearActor reference</h4><dl>
      <dt>Object name</dt><dd><code>{gearActorReference.value.objectName}</code></dd>
      <dt>Class name</dt><dd><code>{gearActorReference.value.className}</code></dd>
      <dt>Target package</dt><dd><code>{gearActorReference.value.gamePackagePath}</code></dd>
    </dl><p className="domain-boundary-note">Serialized reference targetです。Actor packageの内容まで解決済みという意味ではありません。</p>
      <details className="domain-trace gear-actor-reference-trace"><summary>reference provenanceを確認</summary><dl><dt>Domain field</dt><dd><code>gearActorReference</code></dd><dt>Raw property</dt><dd><code>{mappings.gearActorReference.rawField}</code></dd></dl><ol>
        <TraceStep label="ObjectProperty" trace={gearActorReference.trace.objectProperty} />
        <TraceStep label="class import" trace={gearActorReference.trace.classImport} />
        <TraceStep label="outer package import" trace={gearActorReference.trace.outerPackageImport} />
      </ol></details>
    </section> : <section className="domain-identity domain-unresolved" aria-label="GearActor reference"><h4>GearActor reference</h4><p>{gearActorReference.state}: {gearActorReference.reason}</p></section>}

    <section className="domain-unresolved-list" aria-labelledby="battle-robe-unresolved-title"><h4 id="battle-robe-unresolved-title">Unresolved</h4><p>Domainから渡された未解決事項です。Applicationでは補完していません。</p><ul>
      {projection.unresolved.map((item) => <li key={item}><strong>未解決</strong> <code>{item}</code><br />{unresolvedLabels[item] ?? item}</li>)}
    </ul></section>
  </section>
}
