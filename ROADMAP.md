# Roadmap

## Current Project Goal

利用可能なEvidenceだけを安全な境界でOptimizerへ反映しつつ、parameter / mechanic単位の根拠を継続的に取得・検証する。Research TrackとProduct Trackは並行し、Research全体の完了をProduct改善の開始条件にしない。

旧Phase 0〜8と旧将来計画は[Historical Roadmap](./docs/historical-roadmap.md)へ凍結した。旧Phase番号・旧チェック数・旧percentageはCurrent / Next判断や現行進捗の分母に使用しない。

## Current State

Work UnitのTrack・status・dependency・completion condition・next actionは `src/data/roadmap.ts` を正本とし、下のWork Unitsへ自動反映する。ROADMAP.md側では同じ進捗情報を手書きで重複管理しない。

runtime / Inventory / Evidence truth / optimizer scoreはRoadmap更新だけでは変更しない。現在のruntime coverageは各manifest / auditの生成summaryを参照する。

### Runtime coverage snapshot

<!-- runtime-support:start -->
Population 33 · Catalog runtime 28 / 33 · Full 19 · Limited 9 · Research-only 5 · Broad Power 22 · Power-limited 6
<!-- runtime-support:end -->

<!-- artifact-support:start -->
Artifacts · Audited source population 45 · Catalog runtime 3 / 45 · Full 2 · Limited 1 · Research-only 42
<!-- artifact-support:end -->

Armorは監査母集団73件中7件、Armor Enchantは41件中7件をLimited runtime対応。RangedはBow / Crossbowと3 Enchantを観測入力付きLimited runtime対応。カテゴリごとに意味と母集団が異なるため、横断の総合percentageは表示しない。

<!-- roadmap-data:start -->
## Work Units

Generated from `src/data/roadmap.ts`. Do not edit this block directly.

### Research Track

Optimizerが使用するparameter / mechanicの根拠を取得・検証し、採用判断可能な状態にする。

#### Done

- **R1 — Research Infrastructure**: Source Harvest、Gap Map、Priority、game-file artifact、Research Quest、Evidence Repository、validation / auditを再現可能にする。
  - Unlocks: R2, R3
  - Completion: checked-in artifactから監査を再実行でき、raw traceとadoption decisionをruntimeから分離できる。

#### Current

- **R2 — Evidence Acquisition**: Personal Research Quest、独立raw trace、Measure / Experimentを優先度順に取得する。
  - Depends on: R1
  - Unlocks: R3
  - Completion: 対象parameterごとにversion・conditions・unit・run identityを備えた独立Evidenceを保存できる。
  - Next: Limited DRの8条件を別runとして取得する。

#### Next

- **R3 — Evidence Validation / Adoption**: 取得済みEvidenceをsemantic / version / conflict / holdout gateで評価し、parameter単位のAdoptionDecisionを確定する。
  - Depends on: R2
  - Entry condition: 対象parameter / mechanicについて独立Evidenceが取得済み
  - Unlocks: P3B
  - Completion: accepted / rejected / heldと理由が再現可能で、未検証値を昇格対象にしない。

#### Blocked

- **R3B — Limited DR Adoption Decision**: 固定済みの独立holdout gateでLimited DRの採用可否を判断する。
  - Depends on: R2
  - Unlocks: P3B
  - Completion: 1.17.0.0、同一incoming hit、全8条件、3独立run×各10 hit以上を取得し、gateを変えず再監査できる。
  - Next: 独立raw traceの取得を待つ。

#### Later

- **R4 — Targeted Deep Research**: 外部観測でも解けないruntime-relevantな問いに限りnative計算・effective timingを追加調査する。
  - Depends on: R2, R3
  - Entry condition: R2 / R3で追加のnative調査が必要と判断された対象に限る
  - Completion: 対象の問い、停止条件、runtime relevanceを先に固定し、推測値を生成せず結論を記録する。

- **R5 — Evidence Maintenance / Version Drift**: source revision、game version、conflict、採用済みEvidenceのdriftを追跡する。
  - Depends on: R1
  - Completion: drift検出と再検証条件がparameter単位で記録される。

### Product Track

現在利用可能なEvidenceを安全な境界で製品へ反映し、実用性を高める。

#### Done

- **P1 — Catalog / Inventory Foundation**: runtime未対応の監査済み装備を所持品とResearch対象として保持し、Optimizer候補へ混ぜない。
  - Unlocks: P2, P4
  - Completion: 保存・JSON移行・装備カテゴリ入力が既存回帰を維持する。

- **P2 — Evidence-aware Runtime Boundary**: Full / Limited / Research-onlyとEvidence Statusを分離し、Unknown / Estimatedを0や1へ代替しない。
  - Depends on: P1
  - Unlocks: P3
  - Completion: 利用者がEvidence適用方針と制限理由を確認できる。

- **P3 — Runtime Promotion Pipeline Foundation**: parameter単位のeligibility、manifest更新、説明、coverage、regressionを一つの反復可能な変更として扱う。
  - Depends on: P2
  - Unlocks: P3B, P4
  - Completion: 未検証値を昇格せず、対象が0件でも状態を正しく表現し、最初のeligible単位を安全に受け入れられる。

#### Next

- **P4 — Runtime Coverage Expansion**: P3Bを通過した小さい単位ごとにruntime coverageを拡張する。
  - Depends on: P3B
  - Entry condition: 対象単位についてP3BのEnd-to-End promotion reference implementationが成立済み
  - Unlocks: P5
  - Completion: 追加単位ごとにsupport boundaryとregressionが明示され、Research-onlyを0点候補へ混ぜない。

#### Blocked

- **P3B — First Eligible Runtime Promotion**: R3でacceptedになった最初の1 parameter / mechanicをEnd-to-Endで昇格し、reference implementationにする。
  - Depends on: P3, R3
  - Entry condition: 対象parameter / mechanicがR3でaccepted
  - Unlocks: P4
  - Completion: 同一変更でruntime、manifest、説明、coverage、regressionが同期し、既存挙動を保護する。
  - Next: eligible targetなし。P3の基盤整備を継続し、acceptedな対象を待つ。

#### Later

- **P5 — Recommendation / Optimizer Quality**: available runtime scope内でobjective、scoring、推薦品質、説明を改善する。
  - Depends on: P2
  - Completion: 変更した目的・順位・説明を代表fixtureと回帰で検証できる。

- **P6 — Product UX / Public-use Readiness**: Inventory workflow、UX、performance、regression、本人実利用での有用性を継続改善する。
  - Depends on: P1, P2
  - Completion: 主要フローがaccessibility・performance・E2E基準を満たし、公開判断は別途明示される。

### Future Candidates

- **Optimizer Engine Generalization**: Dungeons 1で実証後、必要になった境界だけを段階的に分離する。
- **New Drop Comparison / Keep-Salvage**: 新しく拾った装備を仮追加し、現在Bestとの差と残す価値を判断する。
- **Public Availability**: 本人実利用でCoverageとUXが十分に有用だと確認できた時点で再判断する。
- **Minecraft Dungeons II / other future game support**: 新しいゲーム要件が具体化した時点でResearchまたはProductへ正式移行する。
<!-- roadmap-data:end -->

## Cross-track Handoff

```text
Research Evidence
  → Evidence Adoption Decision
  → Promotion Eligibility
  → Product Runtime Promotion
  → Optimizer Runtime
  → Coverage / Recommendation
```

handoffはparameter / mechanic単位で行う。Track全体の完了、Full / Limited分類、既存runtimeであることのいずれからもEvidence Statusを推定しない。

## Document Links

- [Historical Roadmap](./docs/historical-roadmap.md)
- [Architecture / Separation Design](./docs/catalog-evidence-runtime-separation.md)
- [Evidence Model ADR](./docs/adr/0001-external-evidence-model-redesign.md)
- [Research workflow / Personal Research Quest](./docs/phase7-personal-research-quest.md)
- [Evidence intake and validation](./docs/phase8-evidence-intake.md)
- [Runtime Promotion boundary / limitations](./docs/runtime-limitations.md)
- [Runtime Promotion pipeline contract](./docs/runtime-promotion-pipeline.md)
- [Coverage and limitations](./docs/combined-evidence-coverage.md)

## Update Rules

- Work Unitの変更は `src/data/roadmap.ts` だけを編集し、`npm run generate:roadmap` でこの文書へ反映する。
- CIの `npm run audit:roadmap` でWork Unitsのdriftとdependency graphを検証する。
- Research / Productは個別にDone / Current / Next / Blocked / Laterを管理する。
- Historical Phaseを現行進捗へ戻さず、作業量の異なるTrackを合算percentageにしない。
- 未対応効果を0点としてOptimizerへ登録しない。runtime / Evidence truthを変える変更はRoadmap更新と分離する。
