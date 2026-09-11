# Roadmap

## Current Project Goal

利用可能なEvidenceだけを安全な境界でOptimizerへ反映しつつ、parameter / mechanic単位の根拠を継続的に取得・検証する。Research TrackとProduct Trackは並行し、Research全体の完了をProduct改善の開始条件にしない。

旧Phase 0〜8と旧将来計画は[Historical Roadmap](./docs/historical-roadmap.md)へ凍結した。旧Phase番号・旧チェック数・旧percentageはCurrent / Next判断や現行進捗の分母に使用しない。

## Current State

- Catalog / Inventory / Runtime / Evidenceの分離、parameter-level Evidence classification、Evidence-aware optimizer boundaryは実装済み。
- Research Quest、Evidence Repository、game data research artifacts、validation / audit infrastructureは実装済み。
- Researchでは独立raw trace取得を継続する。限定DRのeligible independent holdoutは0 run / 0 hitで、AdoptionDecisionは保留。
- ProductではRuntime Promotion Pipelineの基盤を次の実装対象とする。現時点でpromotion eligibleなparameter / mechanicは0件で、今回runtime promotionは行わない。
- runtime / Inventory / Evidence truth / optimizer scoreはこのRoadmap rebaselineで変更しない。

### Runtime coverage snapshot

<!-- runtime-support:start -->
Population 33 · Catalog runtime 28 / 33 · Full 19 · Limited 9 · Research-only 5 · Broad Power 22 · Power-limited 6
<!-- runtime-support:end -->

<!-- artifact-support:start -->
Artifacts · Audited source population 45 · Catalog runtime 3 / 45 · Full 2 · Limited 1 · Research-only 42
<!-- artifact-support:end -->

Armorは監査母集団73件中7件、Armor Enchantは41件中7件をLimited runtime対応。RangedはBow / Crossbowと3 Enchantを観測入力付きLimited runtime対応。カテゴリごとに意味と母集団が異なるため、横断の総合percentageは表示しない。

## Research Track

目的: Optimizerが使用するparameter / mechanicの根拠を取得・検証し、採用判断可能な状態にする。Runtime実装そのものはこのTrackの完了条件に含めない。

### Done

- **R1 — Research Infrastructure**: Source Harvest、Gap Map、Priority、game-file artifact、Research Quest、Evidence Repository、validation / auditを再現可能にする。完了条件: checked-in artifactから監査を再実行でき、raw traceとadoption decisionをruntimeから分離できること。

### Current

- **R2 — Evidence Acquisition**: Personal Research Quest、独立raw trace、Measure / Experimentを優先度順に取得する。依存: R1。完了条件: 対象parameterごとにversion・conditions・unit・run identityを備えた独立Evidenceを保存できること。次のaction: Limited DRの8条件を別runとして取得する。

### Next

- **R3 — Evidence Validation / Adoption**: 取得済みEvidenceをsemantic / version / conflict / holdout gateで評価し、parameter単位のAdoptionDecisionを確定する。依存: R2の対象単位。unlocks: Product P3B。完了条件: accepted / rejected / heldと理由が再現可能で、未検証値を昇格対象にしないこと。

### Blocked

- **R3B — Limited DR Adoption Decision**: 独立raw trace不足で保留。再開条件: 1.17.0.0、同一incoming hit、全8条件、3独立run×各10 hit以上を取得し、固定済みgateを変更せず再監査できること。

### Later

- **R4 — Targeted Deep Research**: 外部観測でも解けないruntime-relevantな問いに限りnative計算・effective timingを追加調査する。R2/R3で必要性が確認されるまで常時Currentにしない。
- **R5 — Evidence Maintenance / Version Drift**: source revision、game version、conflict、採用済みEvidenceのdriftを監視し、再検証条件を明確にする。

## Product Track

目的: 現在利用可能なEvidenceを安全な境界で製品へ反映し、coverage・推薦品質・説明・UXを改善する。Research全体の完了を待たず、eligibleな単位だけを扱う。

### Done

- **P1 — Catalog / Inventory Foundation**: runtime未対応の監査済み装備を所持品とResearch対象として保持し、Optimizer候補へ混ぜない。完了条件: 保存・JSON移行・装備カテゴリ入力が既存回帰を維持すること。
- **P2 — Evidence-aware Runtime Boundary**: Full / Limited / Research-onlyとEvidence Statusを分離し、Unknown / Estimatedを0や1へ代替しない。完了条件: 利用者がEvidence適用方針と制限理由を確認できること。

### Current

- **P3 — Runtime Promotion Pipeline Foundation**: parameter単位のeligibility、manifest更新、説明、coverage、regressionを一つの反復可能な変更として扱う。依存: P2。完了条件: 未検証値を昇格せず、対象が0件でも状態を正しく表現し、最初のeligible単位を安全に受け入れられること。

### Next

- **P4 — Runtime Coverage Expansion**: P3Bを通過した小さい単位ごとにruntime coverageを拡張する。巨大な全装備Promotion Phaseは作らない。

### Blocked

- **P3B — First Eligible Runtime Promotion**: R3でacceptedになった最初の1 parameter / mechanicをEnd-to-Endで昇格し、reference implementationにする。依存: P3と対象単位のR3。完了条件: 同一変更でruntime、manifest、説明、coverage、regressionが同期し、既存挙動を保護すること。actual promotion targetはまだeligibleではないが、P3の基盤整備は進行可能であり、Product Track全体は停止しない。

### Later

- **P5 — Recommendation / Optimizer Quality**: available runtime scope内でobjective、scoring、推薦品質、説明を改善する。
- **P6 — Product UX / Public-use Readiness**: Inventory workflow、UX、performance、regression、本人実利用での有用性を継続改善する。

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

## Recommended Execution Order

1. このRoadmap rebaselineを正本として固定する。
2. R2 Evidence AcquisitionとP3 Pipeline Foundationを並行して進める。
3. Evidenceが得られた対象だけをR3でvalidation / adoptionする。
4. 最初のeligible対象をP3BでEnd-to-End promotionし、監査可能なreference implementationにする。
5. Research acquisition → adoption → runtime promotion → regression / coverageを小さい単位で反復する。
6. available runtime scopeに応じてP4/P5/P6を継続し、未解決Researchの全完了を待たない。

## Blocked / Waiting

- Limited DR AdoptionDecision: 独立raw trace待ち。
- First Eligible Runtime Promotion: acceptedなparameter / mechanic待ち。
- native / effective timing調査: 外部観測で解けない重要課題が特定されるまで条件付き保留。
- Public Availability: 本人実利用でcoverageとUXの有用性を確認するまで保留。

## Future Candidates

以下はCurrent Trackへ自動追加しない。実施決定後にResearchまたはProductのwork unitへ移す。

- Optimizer Engine Generalization
- New Drop Comparison / Keep-Salvage
- Public Availability
- Minecraft Dungeons II / other future game support

## Document Links

- [Historical Roadmap](./docs/historical-roadmap.md)
- [Architecture / Separation Design](./docs/catalog-evidence-runtime-separation.md)
- [Evidence Model ADR](./docs/adr/0001-external-evidence-model-redesign.md)
- [Research workflow / Personal Research Quest](./docs/phase7-personal-research-quest.md)
- [Evidence intake and validation](./docs/phase8-evidence-intake.md)
- [Runtime Promotion boundary / limitations](./docs/runtime-limitations.md)
- [Coverage and limitations](./docs/combined-evidence-coverage.md)

## Update Rules

- work unitごとにTrack、status、dependency、completion condition、next actionを更新する。
- Research / Productは個別にDone / Current / Next / Blocked / Laterを管理する。
- Historical Phaseを現行進捗へ戻さず、作業量の異なるTrackを合算percentageにしない。
- 未対応効果を0点としてOptimizerへ登録しない。runtime / Evidence truthを変える変更はRoadmap更新と分離する。
