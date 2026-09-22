import { fightersBindingsBrowserProjection as projection, type BrowserField } from './fightersBindingsBrowserModel'

const unresolvedLabels: Readonly<Record<string, string>> = {
  'final-damage': '最終ダメージ',
  'power-scaling': 'Power scaling',
  'effective-attack-cadence': '実効攻撃間隔',
  'complete-combo-mechanic': '完全なコンボ挙動',
}

function FieldValue({ field, suffix = '' }: { field: BrowserField<number | string>; suffix?: string }) {
  return <>{field.value}{suffix}</>
}

function TraceDetails({ domainField, field }: { domainField: string; field: Pick<BrowserField<unknown>, 'rawProperty' | 'provenance'> }) {
  return <details className="domain-trace">
    <summary>provenanceを確認</summary>
    <dl>
      <dt>Domain field</dt><dd><code>{domainField}</code></dd>
      <dt>Raw property</dt><dd><code>{field.rawProperty}</code></dd>
      <dt>Raw package</dt><dd><code>{field.provenance.packagePath}</code></dd>
      <dt>Dataset</dt><dd><code>{field.provenance.datasetId}</code></dd>
      <dt>Extraction run</dt><dd><code>{field.provenance.extractionRunId}</code></dd>
      <dt>Raw node</dt><dd><code>{field.provenance.nodePointer}</code></dd>
    </dl>
  </details>
}

export function FightersBindingsDataBrowser() {
  const { identity, configuredAttacks } = projection
  const rawIdentity = identity.rawItemName
  const serializedIdentity = identity.rawSerializedId

  return <section className="fighters-domain" aria-labelledby="fighters-domain-title" data-domain-scope={projection.scope}>
    <header>
      <div>
        <p className="eyebrow">FORMAL GAME DOMAIN</p>
        <h3 id="fighters-domain-title">{identity.displayName ?? 'Identity unresolved'}</h3>
      </div>
      <span className={`domain-status ${identity.status}`}>{identity.status}</span>
    </header>
    <p className="domain-boundary-note">committed Formal Domainのidentity・configured値を表示しています。configured値は最終ダメージや実効攻撃速度を意味しません。</p>

    <section className="domain-identity" aria-label="Domain identity">
      <h4>Domain identity</h4>
      <dl>
        <dt>Domain ID</dt><dd><code>{identity.domainId ?? 'unresolved'}</code></dd>
        <dt>Identity status</dt><dd><span className={`domain-status ${identity.status}`}>{identity.status}</span> — 表示名との対応は暫定です</dd>
        <dt>Raw internal ID</dt><dd><FieldValue field={rawIdentity} /></dd>
      </dl>
      <TraceDetails domainField="identity.rawEvidence.itemIdName" field={rawIdentity} />
      <TraceDetails domainField="identity.rawEvidence.serializedId" field={serializedIdentity} />
    </section>

    <section className="domain-attacks" aria-labelledby="configured-attacks-title">
      <h4 id="configured-attacks-title">Configured attack entries</h4>
      <>
        <div className="domain-table-scroll"><table>
          <thead><tr><th scope="col">Entry</th><th scope="col">Configured damage</th><th scope="col">Configured animation duration</th></tr></thead>
          <tbody>{configuredAttacks.attacks.map((entry) => <tr key={entry.sourceIndex}>
            <th scope="row">#{entry.sourceIndex + 1}</th>
            <td data-domain-field={`configuredAttacks[${entry.sourceIndex}].configuredDamage`}>
              <FieldValue field={entry.configuredDamage} />
              <TraceDetails domainField={`attacks[${entry.sourceIndex}].configuredDamage`} field={entry.configuredDamage} />
            </td>
            <td data-domain-field={`configuredAttacks[${entry.sourceIndex}].configuredAnimationDurationSeconds`}>
              <FieldValue field={entry.configuredAnimationDurationSeconds} suffix=" s" />
              <TraceDetails domainField={`attacks[${entry.sourceIndex}].configuredAnimationDurationSeconds`} field={entry.configuredAnimationDurationSeconds} />
            </td>
          </tr>)}</tbody>
        </table></div>
        <TraceDetails domainField="configuredAttacks" field={configuredAttacks} />
      </>
    </section>

    <section className="domain-unresolved-list" aria-labelledby="unresolved-title">
      <h4 id="unresolved-title">Unresolved</h4>
      <p>以下のmechanicはData Browserでは導出・assertしていません。数値を推定・導出していません。</p>
      <ul>{projection.unresolved.map((item) => <li key={item}><strong>未解決</strong> {unresolvedLabels[item] ?? item}</li>)}</ul>
    </section>
  </section>
}
