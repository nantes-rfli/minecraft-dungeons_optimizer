import coverage from '../../research/evidence-coverage-dashboard.json'

const sourceUrl = (ref: string) => `https://github.com/nantes-rfli/minecraft-dungeons_optimizer/blob/main/${ref.split('#')[0]}`

export function DataCoverageSection() {
  return <section className="panel" id="data-coverage" aria-labelledby="data-coverage-title">
    <p className="section-label">PHASE 2-4 / DATA COVERAGE</p>
    <h2 id="data-coverage-title">使える範囲と、次に必要な根拠</h2>
    <p>Fullは現在のscopeで通常対応、LimitedはPower・コピー・併用などに制限、Research-onlyは候補未登録です。Evidenceの質や実測済みかどうかは別に扱います。<strong>Coverageは正解確率でも、Roadmapの完成率でもありません。</strong></p>
    <div className="control-policy-table"><table>
      <caption>カテゴリ別の監査母集団とruntime対応</caption>
      <thead><tr><th scope="col">カテゴリ</th><th scope="col">監査数</th><th scope="col">Full</th><th scope="col">Limited</th><th scope="col">Research-only</th><th scope="col">未分類 / 非該当</th><th scope="col">Evidence待ち</th><th scope="col">未実装</th></tr></thead>
      <tbody>{coverage.categories.map((category) => <tr key={category.id}>
        <th scope="row">{category.label}</th><td>{category.population}</td><td>{category.runtime.full}</td><td>{category.runtime.limited}</td><td>{category.runtime.researchOnly}</td><td>{category.runtime.unknown} / {category.runtime.notApplicable}</td><td>{category.blockers.evidenceBlocked}</td><td>{category.blockers.notImplemented}</td>
      </tr>)}</tbody>
    </table></div>
    <p>Attack profileのexact / partialは根拠の状態です。武器runtimeのFull / Limited分類がないため{coverage.categories.find((category) => category.id === 'melee-attack-profile')!.runtime.unknown}件を未分類のまま表示しています。DPS監査{coverage.regression.candidates}候補はruntime分類の非該当です。カテゴリの分母が異なるので総合率は出しません。</p>
    <p><strong>独立DPS実測: {coverage.regression.eligible} / {coverage.regression.minimum}</strong>。公開候補{coverage.regression.candidates}件を監査済みですが採用条件を満たす実測が不足し、誤差範囲は表示していません。</p>
    <p>優先度付きbacklog: {Object.entries(coverage.backlogSummary.priorities).map(([priority, count]) => `${priority} ${count}`).join(' / ')}。P1のEvidence待ちは{coverage.blockerSummary.p1EvidenceBlocked}件。未実装の設計項目は{coverage.backlogSummary.notImplemented}件です。</p>
    <details><summary>優先度が高い未解決項目とclose条件</summary>
      <div className="control-policy-table"><table>
        <thead><tr><th scope="col">対象 / 優先度</th><th scope="col">対応状況</th><th scope="col">不足 / 分類</th><th scope="col">必要な根拠</th></tr></thead>
        <tbody>{coverage.highPriority.map((blocker) => <tr key={blocker.id}><th scope="row">{blocker.label}<br />{blocker.priority}</th><td>{blocker.supportContext}</td><td>{blocker.description}<br />{blocker.kind}</td><td>{blocker.closeCondition}<br /><a href={sourceUrl(blocker.sourceRefs[0]!)} target="_blank" rel="noreferrer">根拠・backlog</a></td></tr>)}</tbody>
      </table></div>
    </details>
    <details><summary>Artifact: 公開Evidence調査後も不足が残る{coverage.evidenceAcquisition.length}候補</summary>
      <p>公開調査の範囲では根拠が尽きています。Power・unit・version・interactionの不足を推測で埋めず、Research-onlyを維持しています。</p>
      <div className="control-policy-table"><table>
        <thead><tr><th scope="col">Artifact</th><th scope="col">調査状態 / high-Power</th><th scope="col">残る問題</th></tr></thead>
        <tbody>{coverage.evidenceAcquisition.map((candidate) => <tr key={candidate.id}><th scope="row">{candidate.name}</th><td>{candidate.evidenceStop}<br />{candidate.highPowerReady ? '準備済み' : '未充足'} / {candidate.readiness}</td><td>{candidate.previousBlocker}<br />{candidate.otherBlockers.join(' / ')}</td></tr>)}</tbody>
      </table></div>
    </details>
    <details><summary>集計単位・出典・実測手順</summary>
      <p>blockerは項目単位で、装備数ではありません。カテゴリを跨ぐ項目は各カテゴリに表示し、全体では1回だけ数えます。個別runtimeの制限は{coverage.blockerSummary.unclassified}件が未分類、優先度未設定は{coverage.blockerSummary.unprioritized}件です。元の表現を残し、Evidence待ちか実装待ちかを推測で決めていません。</p>
      <ul>{coverage.categories.map((category) => <li key={category.id}>{category.label}: {category.populationDefinition} <a href={sourceUrl(category.sourceRefs[0]!)} target="_blank" rel="noreferrer">監査元</a></li>)}</ul>
      <p>DPS regression、Cooldown/DR compositionに加え、Ranged cadence、projectile配分、trigger/Armor interactionの再現手順を用意しました。実測結果や投稿受付機能は含みません。</p>
      <a href={sourceUrl('docs/measurement-protocols.md')} target="_blank" rel="noreferrer">実測プロトコル</a>{' / '}<a href={sourceUrl('docs/combined-evidence-coverage.md')} target="_blank" rel="noreferrer">横断Coverage report・Power範囲・出典</a>
    </details>
  </section>
}
