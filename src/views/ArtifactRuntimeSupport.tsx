import { ARTIFACT_RUNTIME_SUPPORT, artifactRuntimeSupportSummaryText } from '../core/artifactRuntimeSupport'

export function ArtifactRuntimeSupportSection() {
  const runtime = ARTIFACT_RUNTIME_SUPPORT.entries.filter((entry) => entry.supportLevel !== 'research-only')
  return <section className="panel" aria-labelledby="artifact-runtime-heading">
    <h2 id="artifact-runtime-heading">Artifacts — Runtime Support</h2>
    <p>{artifactRuntimeSupportSummaryText()}</p>
    <p>近接Enchantとは別の母集団です。現在の計算対象は次の3種。Research-onlyを0点の候補として登録しません。</p>
    <ul>{runtime.map((entry) => <li key={entry.id}>{entry.name}: {entry.supportLevel === 'full' ? 'Full' : 'Limited'} / {entry.mechanicFamily}</li>)}</ul>
    <details>
      <summary>Artifact監査の範囲・Phase 2-2A complete</summary>
      <p>dungeons.tools 44件とWiki表示定義45件を照合し、差分はCorrupted Seeds 1件と確定しました。project母集団は表示定義の正規化和集合45件。raw game ID全体の網羅性は主張しません。</p>
      <p>Fullは現在scopeで主要経路が完結。LimitedはPower・対象・併用等の具体的な境界。Phase partialとEvidence confidenceはsupport levelとは別軸です。</p>
      <p>既存2種は従来どおり8 + 0.052 × Power秒。CD 30 / 25秒、重複は効果量を重ねない交互使用モデルを維持。使用頻度は効果時間と分離しています。</p>
      <p>Shock PowderはPower 12〜262の公開4点間だけを区分線形補間し、CD 15秒、1copy限定、対象・免疫割合を編集可能なhard Controlとして実装。Fishing RodとGongはduration/stateの根拠不足でResearch-onlyです。</p>
      <p>根拠: <a href="https://www.dungeons.tools/artifacts" target="_blank" rel="noreferrer">dungeons.toolsのArtifact一覧</a> / <a href="https://minecraft.wiki/w/Dungeons:Corrupted_Seeds" target="_blank" rel="noreferrer">Corrupted Seeds</a></p>
    </details>
  </section>
}
