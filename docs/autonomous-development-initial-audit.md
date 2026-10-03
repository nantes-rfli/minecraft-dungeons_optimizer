# Autonomous contract: initial audit

2026-10-03の導入時点の記録。baseline mainは `6cfc447740e3f06611c2d60d9545a17ab5f052ac`。これは契約の運用確認であり、Game Domain populationやApplication開発を開始するiterationではない。候補を恒久的に予約しない。

## Repository findings

- [ROADMAP](../ROADMAP.md) と [structured roadmap](../src/data/roadmap.ts) はResearch/Product並行を許容する。新契約は選定方法だけを持ち、Track状態を複製しない。
- [Identity contract](formal-identity-evidence-v1.md) の本文には146件、[Value contract](formal-value-availability-v2.md) の初期wave記述には27/23件など過去値が残る。一方、current生成物とauditはIdentity 152、Value 31 Melee + 27 Ranged + 3 Artifactを示す。文書の過去wave記述を現況件数として採用しない。
- [Armor foundation audit](armor_formal_value_relation_foundation_design_audit.md) の推奨GearActor breadthと、[Artifact foundation audit](artifact_formal_value_relation_foundation_design_audit.md) のEffect/ItemActorおよび3 narrow Valueは既にcurrent artifactへ反映済み。Armor gameplay ValueのEvidence不足を、Relationの存在から解消した扱いにしない。
- [Remaining Relation audit](artifact_remaining_relation_semantic_design_audit.md) は固定baseline `4957c9b5912b853f581ec16b0f4f6f73360ec1e2` を読む。過去10候補のうちSpinWheelActor、FishHook、SporeGrenadeはcurrent Relationに存在する。残りは7 occurrencesで、6つはStructural source bindingのfoundation候補、1つはrodのsemantic ambiguity。過去censusをcurrentとして再生成しない。
- [Data Browser](../src/screens/DataBrowserPage.tsx) は4つの代表装備専用のFormal browser modelを持つ。例えば [Fighter's Bindings model](../src/screens/dataBrowser/fightersBindingsBrowserModel.ts) はknown configured valuesとunresolved effective mechanicsを分離する。既存Formal breadthを利用者へ説明する共通readerは次回比較に値する。
- [PR #147](https://github.com/nantes-rfli/minecraft-dungeons_optimizer/pull/147) はfoundation + 3 Value、[#149](https://github.com/nantes-rfli/minecraft-dungeons_optimizer/pull/149)〜[#151](https://github.com/nantes-rfli/minecraft-dungeons_optimizer/pull/151) は1 familyずつ。新契約はEvidenceのguardを維持しながら、候補選定をApplication payoffと再利用単位へ移す。
- 導入時には過去の検証専用 [PR #138](https://github.com/nantes-rfli/minecraft-dungeons_optimizer/pull/138) がopenだった。同一missionではなく、この作業では変更・closeしない。mainの [Validate](https://github.com/nantes-rfli/minecraft-dungeons_optimizer/actions/runs/37040650915) はbaseline SHAでsuccess。
- [CI](../.github/workflows/ci.yml) はPRイベントでfull Validateを起動しない。手動起動はMarkdown変更でもE2E必須。新契約はこの既存経路を使い、workflowを変更しない。

## Selection dry run

以下はcurrent artifactと既存監査を使った比較例。readinessはこのbaselineの範囲での仮分類であり、次回はsource・依存・対象集合を再確認してから実装へ進む。

| 候補 / Track | 分類 | benefit対cost / risk | 判断 |
| --- | --- | --- | --- |
| 既存Formalのconfigured値・unavailable・provenanceを説明する共通Data Browser reader / P6 | `READY_SMALL_FOUNDATION` | 現行の複数domainを直接consumerへ接続できる。schema追加よりconsumer側の境界・表示回帰が中心。effective値やscoringを変えない設計が条件 | 次回の第一比較候補。1装備ずつではなく共通readerの安全な適用集合を確定する |
| 残るArtifact RelationのStructural binding / R1関連 | `READY_SMALL_FOUNDATION`（source bindingのみ） | 6 occurrencesを共通adapterで扱える可能性はあるが、family別guardは必要。現時点のconsumer/Value解禁経路が未確認 | population候補としては `APPLICATION_NOT_USEFUL`。consumerが確認できるまでRelation拡張をfreezeする案を優先比較 |
| Armor gameplay Value / R2 | `NEEDS_EVIDENCE` | 既存foundation監査はsource semanticsをdefer。現在もValueにArmor laneはない | Relationや名前からmodifierを作らない |
| Fishing rod actorのgameplay role / R2 | `SEMANTIC_AMBIGUITY` | Engine.Actor / 空CDO / wiringだけではroleを一意化できない | 対象を保留し、他の候補選定は続ける |
| First runtime promotion / P3B | `NEEDS_EVIDENCE` | auditはeligible 0。独立Evidenceの採用gateを未通過 | gateを迂回せず待つ |

この比較により、未完のRelation件数だけで次タスクを決める必要はない。Product候補が設計時に大規模波及を要すると判明したら再選定し、低ROI候補だけなら停止する。今回は上記候補を実装しない。

件数と過去候補との差分は、baseline checkoutで次のread-only処理から再現できる。これは既存census内の候補との照合に限り、未観測sourceの完全性を主張しない。

```sh
python3 - <<'PY'
import json
from pathlib import Path
def read(path):
    return json.loads(Path(path).read_text())
root = 'research/domain/formal/'
identity = read(root + 'identity-evidence-v1.json')
value = read(root + 'value-availability-v2.json')
relation = read(root + 'serialized-relation-v2.json')
print('Identity:', len(identity['semantic']['identities']))
print('Value domains:', {k: len(v) for k, v in value['semantic'].items()})
print('Relation occurrences:', len(relation['semantic']['relations']))
refs = {r['relationRef'] for r in relation['semantic']['relations']}
census = read('docs/artifact_remaining_relation_semantic_design_census.json')
for row in census['remainingCandidates']:
    ref = f"relation:{row['domainId']}:{row['family']}@1"
    state = 'implemented' if ref in refs else row['classification']
    print(row['domainId'], row['family'], state)
PY
```

## Contract self-review

導入diffを実装passと分けて読み直し、以下の運用ケースを確認した。

| ケース | 契約による結果 |
| --- | --- |
| 過去censusにある実装済み候補を再発見 | current artifactとbaselineを照合し、重複選定しない |
| Sourceはあり、専用readerだけが足りない | 小さなfoundationとして比較。追加確認を既定にしない |
| 一候補にEvidenceがない／曖昧 | そのsemantic実装を保留。他にREADYがあれば続行 |
| 未確認値を0にすればtestを通せる | fail-closed違反として拒否。gate変更が必要なら停止 |
| batchの一部だけprovenanceを満たさない | eligible集合と除外理由を明示し、安全な対象だけを扱う |
| 新kindが必要だが既存kindと異なる意味 | 狭いtyped extensionと独立guardは続行可能。generic taxonomyへの拡張は停止 |
| 自分の変更でtest失敗 | fix → 関連再検証 → 独立review。fixtureの期待値変更だけで隠さない |
| CI成功後にcommit追加 | 最終headでCIを再実行。古いrunを完了証拠にしない |
| CIが使えない／無関係な失敗を局所修正できない | 未検証を明示して停止。成功扱いにしない |
| 未マージPR／merge済みPRから再開 | 前者は待機、後者はfetch → recompute → reprioritize |
| Relationだけが残りconsumerがない | freezeしValue/Productを比較。高価値候補がなければ停止 |

責務分離、リンク、コマンド、CI起動条件を確認。AGENTSの通常main反映規則に対して、自律モードのみ人間mergeというscope制限を明示した。レビューでreadinessとApplication usefulnessの重なりを確認し、Evidenceが足りても用途がなければ選ばないと明文化した。また、fetch後も古いcheckoutを監査し得る手順を修正し、baselineからclean branchを用意してから再計算する順にした。Raw/Domain/Application、CI、既存生成物は変更していない。contractの導入自体ではSite反映条件に該当しない。

## Local validation

導入時の状態確認として次を実行し、すべて成功した。全体tests/type/lint/build/E2Eはローカルで重複させず、最終headのGitHub Validateへ委ねる。そのrun URL・head SHA・結果は導入PR本文に記録する。

- `npm run audit:roadmap` — 13 Work Units / 4 future candidates、driftなし。
- `npm run audit:runtime-promotion` — candidate 1 / eligible 0 / promoted 0。
- `npm run audit:formal-identity-evidence` — matched 152、duplicate 0、unsupported promotions 0。
- `npm run audit:formal-value-availability` — 31 Melee / 27 Ranged / 3 Artifact、source/preservation/drift検証成功。
- `npm run audit:formal-serialized-relation` — 228 Relationのcurrent生成結果・preservation検証成功。
- `npm run audit:formal-integration` — cross-boundary検証成功。
