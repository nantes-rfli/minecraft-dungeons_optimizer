import { formalValuesBrowserIndex, type FormalValuesBrowserModel } from './formalValuesBrowserModel'

const labels: Readonly<Record<string, string>> = {
  'configured-attacks': '攻撃設定のエントリ番号',
  'configured-damage': '設定ダメージ',
  'animation-duration': '設定アニメーション時間（秒）',
  'configured-attack-range': '設定攻撃範囲',
  'configured-cone-angle-degrees': '設定コーン角度（度）',
  'configured-cone-offset-units': '設定コーンオフセット',
  'configured-damage-splash-multiplier': '設定スプラッシュ倍率',
  'configured-damage-delay-seconds': '設定ダメージ遅延（秒）',
  'configured-attack-variant-type': '設定攻撃variant',
  'configured-variant-loop-amount': '設定variant繰り返し数',
  'configured-projectile-velocity-factor': '設定弾速係数',
  'configured-projectile-definitions': '投射物設定のエントリ番号',
  'configured-projectile-count': '設定投射物数',
  'configured-angle-span': '設定角度幅',
  'configured-delay-per-projectile': '設定投射物ごとの遅延（秒）',
  'configured-delay-seconds': '設定遅延（秒）',
  'configured-pushback-enabled': '設定pushback有効',
  'configured-pushback-strength': '設定pushback強度',
  'configured-ignore-friendly-fire': '設定friendly fire無視',
  'configured-target-count': '設定対象数',
  'configured-max-health-multiplier': '設定最大HP倍率',
  'configured-attack-stacks': '設定攻撃スタック数',
  'configured-pet-cap': '設定pet数上限',
  'configured-cooldown-for-each-pet-death': '設定CoolDownForEachPetDeathフラグ',
}

export function FormalValuesPanel({ model }: { model: FormalValuesBrowserModel }) {
  return <details className="technical-detail formal-values-browser" data-formal-values-domain={model.domainId}>
    <summary>ゲームファイルの設定値・取得状況</summary>
    <p className="domain-boundary-note">ゲームファイルに記録された設定値です。最終ダメージ・実効攻撃間隔・実際の効果やOptimizerでの採用を意味しません。取得できない値を0や中立倍率へ置き換えません。</p>
    <p>装備との対応: {model.identityStatus === 'provisional' ? '暫定（provisional）' : '確認済み（accepted）'}。取得不能の理由は各項目に表示します。</p>
    <div className="domain-table-scroll"><table>
      <caption>設定値と取得状況</caption>
      <thead><tr><th scope="col">項目</th><th scope="col">設定値・状態</th><th scope="col">出典</th></tr></thead>
      <tbody>{model.rows.map((row) => <tr key={row.projectionRef} data-formal-projection={row.projectionRef}>
        <th scope="row">{labels[row.mappingId.split(':').slice(1).join(':').split('@')[0]!] ?? row.mappingId}{'sourceIndex' in row.occurrence && <small> · エントリ {row.occurrence.sourceIndex}</small>}</th>
        <td>{row.state === 'known' ? <code>{JSON.stringify(row.value)}</code> : <><strong className="domain-unresolved">取得不能（{row.state}）</strong><p>{row.reason}</p></>}</td>
        <td><details className="domain-trace"><summary>出典を確認</summary><dl>
          <dt>Occurrence</dt><dd><code>{JSON.stringify(row.occurrence)}</code></dd>
          <dt>Projection</dt><dd><code>{row.projectionRef}</code></dd>
          {row.relationProjectionRef && <><dt>Relation dependency</dt><dd><code>{row.relationProjectionRef}</code></dd></>}
        </dl>{row.evidence.map((entry) => <dl key={entry.id}>
          <dt>Evidence</dt><dd><code>{entry.id}</code></dd>
          <dt>Artifact</dt><dd><code>{entry.provenance.artifactPath}</code></dd>
          <dt>Package hash</dt><dd><code>{entry.provenance.packageHash.algorithm}:{entry.provenance.packageHash.value}</code></dd>
          <dt>Package</dt><dd><code>{entry.provenance.packagePath}</code></dd>
          <dt>Dataset</dt><dd><code>{entry.provenance.datasetId}</code></dd>
          <dt>Extraction run</dt><dd><code>{entry.provenance.extractionRunId}</code></dd>
          <dt>Raw node</dt><dd><code>{entry.provenance.nodePointer}</code></dd>
        </dl>)}</details></td>
      </tr>)}</tbody>
    </table></div>
  </details>
}

export function FormalValuesDataBrowser({ domainId }: { domainId: string }) {
  const model = formalValuesBrowserIndex.get(domainId)
  return model ? <FormalValuesPanel model={model} /> : null
}
