import { getEnchantmentRuntimeSupport, MELEE_RUNTIME_SUPPORT, runtimeCombinationPartners, runtimeLimitationLines, runtimeSupportSummaryText } from '../core/runtimeSupport'
import type { SelectedEnchantment } from '../core/types'

export function RuntimeSupportBadge({ id }: { id: string }) {
  const support = getEnchantmentRuntimeSupport(id)
  const label = support.supportLevel === 'full' ? 'Full' : support.supportLevel === 'limited' ? 'Limited / 制限付き対応' : 'Unsupported (legacy Research-only)'
  return <small className={`runtime-badge runtime-${support.supportLevel}`}>{label}</small>
}

export function RuntimeSupportWarnings({ enchantments }: { enchantments: readonly SelectedEnchantment[] }) {
  const limited = [...new Set(enchantments.map((item) => item.enchantmentId))].map(getEnchantmentRuntimeSupport).filter((entry) => entry.supportLevel === 'limited')
  if (!limited.length) return null
  return <aside className="runtime-warnings" aria-label="選択エンチャントの対応制限">
    <h3>制限付き対応</h3>
    {limited.map((entry) => <div key={entry.id}><strong>{entry.name}</strong><ul>{runtimeLimitationLines(entry).map((line) => <li key={line}>{line}</li>)}</ul></div>)}
    <a href="#/model/evidence/details">対応範囲・仮定の詳細</a>
  </aside>
}

export function RuntimeSupportSection() {
  return <section className="panel" id="runtime-support">
    <p className="section-label">PHASE 2-1K / RUNTIME SUPPORT LEVELS</p>
    <h2>現在使える範囲と、未解決の根拠を分ける</h2>
    <p>{runtimeSupportSummaryText()}</p>
    <p>Full runtime supportは現在のOptimizer scope内で通常の候補として実行可能という意味で、正確性の保証ではありません。LimitedはPower・複数コピー・併用に明示的な制限があります。Unsupported（旧Research-only）はInventoryとResearchで保持し、計算候補には登録しません。</p>
    <p>Historical phase partialは当時のfull completion gateが未達という履歴です。Evidence confidenceは根拠品質で、低信頼度だけを理由にLimitedにはしません。近接25〜30種の親目標は達成しましたが、全33種完全対応ではありません。</p>
    <p>Soul gear限定はゲーム本来の装着条件。Anima / Soul Siphonは現在Soul Scytheのみ。シナリオの敵割合、CC適用対象、Soul名目回復、平均Temporal State等の仮定は、以下の各モデル説明が適用されます。</p>
    <details><summary>全種の対応範囲・併用制限</summary><div className="control-policy-table"><table>
      <thead><tr><th>Enchant</th><th>Runtime</th><th>具体的な制限 / blocker</th><th>適用条件</th><th>Origin</th></tr></thead>
      <tbody>{MELEE_RUNTIME_SUPPORT.entries.map((entry) => <tr key={entry.id}>
        <th>{entry.name}</th><td><RuntimeSupportBadge id={entry.id} /></td>
        <td>{runtimeLimitationLines(entry).join('。') || '固有の追加制限なし'}{entry.supportLevel === 'full' && runtimeCombinationPartners(entry.id).length > 0 && <small> ※Limited側の併用制限あり: {runtimeCombinationPartners(entry.id).map((id) => getEnchantmentRuntimeSupport(id).name).join(' / ')}</small>}</td>
        <td>{entry.weaponLegality === 'soul-gear' ? 'Soul gearのみ' : '近接'}{entry.runtimeMaxCopies !== null && ` / 最大${entry.runtimeMaxCopies}コピー`}</td><td>{entry.phaseOrigin}</td>
      </tr>)}</tbody>
    </table></div></details>
  </section>
}
