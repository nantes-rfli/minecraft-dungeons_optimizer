import { fightersBindingsDomainArtifact as domainArtifact, type DomainField, type Trace } from './fightersBindingsBrowserModel'

const unresolvedLabels: Readonly<Record<string, string>> = {
  'final-damage': '最終ダメージ',
  'power-scaling': 'Power scaling',
  'effective-attack-cadence': '実効攻撃間隔',
  'complete-combo-mechanic': '完全なコンボ挙動',
}

function FieldValue({ field, suffix = '' }: { field: DomainField<number | string>; suffix?: string }) {
  if (field.state !== 'known') return <span className="domain-unresolved">未解決（{field.state}）: {field.reason}</span>
  return <>{field.value}{suffix}</>
}

function TraceDetails({ domainField, rawProperty, trace }: { domainField: string; rawProperty: string; trace: Trace }) {
  return <details className="domain-trace">
    <summary>provenanceを確認</summary>
    <dl>
      <dt>Domain field</dt><dd><code>{domainField}</code></dd>
      <dt>Raw property</dt><dd><code>{rawProperty}</code></dd>
      <dt>Raw package</dt><dd><code>{trace.raw.packagePath}</code></dd>
      <dt>Dataset</dt><dd><code>{trace.raw.datasetId}</code></dd>
      <dt>Extraction run</dt><dd><code>{trace.raw.extractionRunId}</code></dd>
      <dt>Raw node</dt><dd><code>{trace.raw.nodePointer}</code></dd>
    </dl>
  </details>
}

export function FightersBindingsDataBrowser() {
  const { projection, mappings } = domainArtifact
  const { identity, configuredAttacks } = projection
  const rawIdentity = identity.evidence.itemName
  const serializedIdentity = identity.evidence.serializedId

  return <section className="fighters-domain" aria-labelledby="fighters-domain-title" data-domain-scope={domainArtifact.scope}>
    <header>
      <div>
        <p className="eyebrow">TEMPORARY GAME DOMAIN</p>
        <h3 id="fighters-domain-title">{identity.displayName ?? 'Identity unresolved'}</h3>
      </div>
      <span className={`domain-status ${identity.status}`}>{identity.status}</span>
    </header>
    <p className="domain-boundary-note">Rawから生成したtemporary Domain projectionを表示しています。configured値は最終ダメージや実効攻撃速度を意味しません。</p>

    <section className="domain-identity" aria-label="Domain identity">
      <h4>Domain identity</h4>
      <dl>
        <dt>Domain ID</dt><dd><code>{identity.domainId ?? 'unresolved'}</code></dd>
        <dt>Identity status</dt><dd><span className={`domain-status ${identity.status}`}>{identity.status}</span> — 表示名との対応は暫定です</dd>
        <dt>Raw internal ID</dt><dd><FieldValue field={rawIdentity} /></dd>
      </dl>
      <TraceDetails domainField="identity.evidence.itemName" rawProperty={mappings.identity.rawFields[0]!} trace={rawIdentity.trace} />
      <TraceDetails domainField="identity.evidence.serializedId" rawProperty={mappings.identity.rawFields[1]!} trace={serializedIdentity.trace} />
    </section>

    <section className="domain-attacks" aria-labelledby="configured-attacks-title">
      <h4 id="configured-attacks-title">Configured attack entries</h4>
      {configuredAttacks.state === 'known' ? <>
        <div className="domain-table-scroll"><table>
          <thead><tr><th scope="col">Entry</th><th scope="col">Configured damage</th><th scope="col">Configured animation duration</th></tr></thead>
          <tbody>{configuredAttacks.value.map((entry) => <tr key={entry.sourceIndex}>
            <th scope="row">#{entry.sourceIndex + 1}</th>
            <td data-domain-field={`configuredAttacks[${entry.sourceIndex}].configuredDamage`}>
              <FieldValue field={entry.configuredDamage} />
              <TraceDetails domainField={`configuredAttacks[${entry.sourceIndex}].configuredDamage`} rawProperty={mappings.damage.rawField} trace={entry.configuredDamage.trace} />
            </td>
            <td data-domain-field={`configuredAttacks[${entry.sourceIndex}].configuredAnimationDurationSeconds`}>
              <FieldValue field={entry.configuredAnimationDurationSeconds} suffix=" s" />
              <TraceDetails domainField={`configuredAttacks[${entry.sourceIndex}].configuredAnimationDurationSeconds`} rawProperty={mappings.duration.rawField} trace={entry.configuredAnimationDurationSeconds.trace} />
            </td>
          </tr>)}</tbody>
        </table></div>
        <TraceDetails domainField="configuredAttacks" rawProperty={mappings.entries.rawField} trace={configuredAttacks.trace} />
      </> : <div className="domain-unresolved"><FieldValue field={configuredAttacks} /></div>}
    </section>

    <section className="domain-unresolved-list" aria-labelledby="unresolved-title">
      <h4 id="unresolved-title">Unresolved</h4>
      <p>以下はDomainで未解決です。数値を推定・導出していません。</p>
      <ul>{projection.unresolved.map((item) => <li key={item}><strong>未解決</strong> {unresolvedLabels[item] ?? item}</li>)}</ul>
    </section>
  </section>
}
