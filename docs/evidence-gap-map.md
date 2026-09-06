# Evidence Gap Map

Generated from [Source Harvest](../research/source-harvest.json) by `npm run generate:evidence-gap-map`. Phase 5は取得方法を構造化する派生層で、Gapの削除、Priority計算、ownership signal、runtime昇格、測定結果を含みません。

## Overview

- Total Gap: 2,105
- Classified: 2105 / 2105
- Task Family: 33
- Protocol: 14
- Protocol-backed actionable gaps: 1324 / 1324
- Gap / Protocol ratio: 150.4
- Manual override: 0
- Unclassified: 0

## Resolution Class

| Resolution | Gap count |
| --- | --- |
| source-extractable | 63 |
| public-research | 418 |
| observe | 320 |
| measure | 498 |
| experiment | 506 |
| implementation | 271 |
| objective-design | 29 |
| defer | 0 |

## Category × Resolution Class

| Category | source-extractable | public-research | observe | measure | experiment | implementation | objective-design | defer |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| melee-weapon | 0 | 10 | 0 | 82 | 82 | 0 | 0 | 0 |
| melee-enchantment | 0 | 33 | 33 | 76 | 33 | 5 | 0 | 0 |
| armor | 0 | 0 | 0 | 0 | 73 | 225 | 29 | 0 |
| armor-enchantment | 0 | 42 | 41 | 101 | 41 | 41 | 0 | 0 |
| ranged-weapon | 0 | 282 | 201 | 213 | 142 | 0 | 0 | 0 |
| ranged-enchantment | 0 | 5 | 5 | 0 | 82 | 0 | 0 | 0 |
| artifact | 63 | 46 | 40 | 26 | 53 | 0 | 0 | 0 |

## Gap Cause

| Gap Cause | Count |
| --- | --- |
| conflicting-public-sources | 6 |
| implementation-related | 271 |
| likely-requires-experiment | 439 |
| objective-related | 29 |
| requires-game-observation | 428 |
| source-missing | 806 |
| version-unknown | 126 |

## Task Family

| Task Family | Gap count | Entity count | Resolution | Protocol |
| --- | --- | --- | --- | --- |
| artifact-behavior-observation | 40 | 24 | observe | OBS-ARTIFACT-BEHAVIOR |
| artifact-interaction-experiment | 53 | 26 | experiment | EXP-ARTIFACT-INTERACTION |
| artifact-timing-measurement | 26 | 14 | measure | MEAS-ARTIFACT-TIMING |
| current-mechanic-observation | 74 | 74 | observe | OBS-CURRENT-MECHANIC |
| enchant-power-dependence-experiment | 74 | 74 | experiment | EXP-ENCHANT-POWER |
| enchant-proc-measurement | 56 | 56 | measure | MEAS-ENCHANT-PROC |
| enchant-timing-measurement | 121 | 72 | measure | MEAS-ENCHANT-TIMING |
| implementation-artifact-runtime | 7 | 7 | implementation | — |
| implementation-cooldown-scheduler | 18 | 18 | implementation | — |
| implementation-defense-composition | 35 | 30 | implementation | — |
| implementation-life-steal-policy | 4 | 4 | implementation | — |
| implementation-mechanic-family | 118 | 98 | implementation | — |
| implementation-modifier-ownership | 14 | 14 | implementation | — |
| implementation-position-event-model | 25 | 22 | implementation | — |
| implementation-ranged-runtime | 17 | 17 | implementation | — |
| implementation-soul-economy | 17 | 17 | implementation | — |
| implementation-summon-runtime | 12 | 12 | implementation | — |
| implementation-targeting-model | 4 | 4 | implementation | — |
| melee-attack-scaling-measurement | 82 | 82 | measure | MEAS-MELEE-ATTACK-SCALING |
| objective-arrow-economy | 3 | 3 | objective-design | — |
| objective-mobility | 8 | 8 | objective-design | — |
| objective-party-support | 13 | 13 | objective-design | — |
| objective-resistance-utility | 5 | 5 | objective-design | — |
| power-scaling-experiment | 155 | 155 | experiment | EXP-POWER-SCALING |
| proc-ownership-experiment | 112 | 112 | experiment | EXP-RANGED-PROC-OWNERSHIP |
| projectile-distribution-experiment | 71 | 71 | experiment | EXP-RANGED-PROJECTILE-DISTRIBUTION |
| public-property-research | 286 | 75 | public-research | — |
| ranged-card-observation | 206 | 76 | observe | OBS-RANGED-CARD |
| ranged-mechanic-experiment | 41 | 41 | experiment | EXP-RANGED-MECHANIC |
| ranged-shot-cycle-measurement | 213 | 71 | measure | MEAS-RANGED-SHOT-CYCLE |
| source-conflict-resolution | 6 | 6 | public-research | — |
| structured-source-reconciliation | 63 | 42 | source-extractable | — |
| version-history-research | 126 | 123 | public-research | — |

## Public Research Families

### public-property-research

調査順:

1. dungeons.toolsの既存attemptを確認する。
2. 公式patch notesを確認する。
3. Wiki本文と履歴を確認する。
4. 再現可能な定量公開test・videoを確認する。
5. 必要ならarchived pageを確認する。

記録: source URL / 公開日・対象version / 原文またはlocator / 対象property / 候補値 / 競合と採否理由

Close: 現行版へ帰属できる複数sourceまたは一次sourceで値を確定する。 / 確定不能なら調査済みsourceと理由を残し、observe / measure / experimentへ送る。

### source-conflict-resolution

調査順:

1. dungeons.toolsの既存attemptを確認する。
2. 公式patch notesを確認する。
3. Wiki本文と履歴を確認する。
4. 再現可能な定量公開test・videoを確認する。
5. 必要ならarchived pageを確認する。

記録: source URL / 公開日・対象version / 原文またはlocator / 対象property / 候補値 / 競合と採否理由

Close: 競合する全候補をversion・unit・条件で分離し、現行版の採用値または未解決理由を確定する。

### structured-source-reconciliation

調査順:

1. Gapのproperty-level sourceAttemptsを確認する。
2. value-foundの元claim・locator・解釈を照合する。
3. 現行版への適用可否を決め、採用しない場合は理由を残す。

記録: source ID / URL / source locator / raw value / normalized value / game version / 採否と理由

Close: 値とversionをaccepted factへ昇格できる、または取得不能理由を確定して別Resolution Classへ再分類できる。

### version-history-research

調査順:

1. dungeons.toolsの既存attemptを確認する。
2. 公式patch notesを確認する。
3. Wiki本文と履歴を確認する。
4. 再現可能な定量公開test・videoを確認する。
5. 必要ならarchived pageを確認する。

記録: source URL / 公開日・対象version / 原文またはlocator / 対象property / 候補値 / 競合と採否理由

Close: 現行版へ帰属できる複数sourceまたは一次sourceで値を確定する。 / 確定不能なら調査済みsourceと理由を残し、observe / measure / experimentへ送る。

## Implementation Families

| Family | Required evidence / decision | Affected runtime subsystem |
| --- | --- | --- |
| implementation-artifact-runtime | Artifact damage runtime | artifact evaluator |
| implementation-cooldown-scheduler | CooldownとPotion event scheduler | artifact / potion scheduler |
| implementation-defense-composition | 防御合成と離散hit model | defense / incoming damage |
| implementation-life-steal-policy | Life Steal対象channel policy | healing / damage events |
| implementation-mechanic-family | 未対応mechanic family | runtime support manifest |
| implementation-modifier-ownership | Modifier bucket ownership | damage modifier composition |
| implementation-position-event-model | Roll・位置・event model | combat state / control |
| implementation-ranged-runtime | Ranged catalog/runtime接続 | ranged optimizer adapter |
| implementation-soul-economy | Soul単位とresource economy | soul scheduler |
| implementation-summon-runtime | Pet / summon runtime | artifact summon runtime |
| implementation-targeting-model | Threat / party targeting model | target selection |

## Objective-design Families

| Family | Missing user goal | Required metric | Product decision |
| --- | --- | --- | --- |
| objective-arrow-economy | 矢消費を評価するか | ammo efficiency / encounter duration | Phase 6以降でユーザー価値と重みを決定する。Phase 5ではscoreを計算しない。 |
| objective-mobility | 移動・rollの価値を評価するか | travel time / survival utility | Phase 6以降でユーザー価値と重みを決定する。Phase 5ではscoreを計算しない。 |
| objective-party-support | solo最適化とparty貢献をどう分離するか | ally healing / team uptime | Phase 6以降でユーザー価値と重みを決定する。Phase 5ではscoreを計算しない。 |
| objective-resistance-utility | 環境・ノックバック耐性の価値をどう扱うか | prevented displacement / effective uptime | Phase 6以降でユーザー価値と重みを決定する。Phase 5ではscoreを計算しない。 |

## Acquisition Cost

| Cost | Count |
| --- | --- |
| high | 506 |
| low | 738 |
| medium | 527 |
| trivial | 63 |
| very-high | 271 |

## Runtime Relevance

| Relevance | Count |
| --- | --- |
| high | 124 |
| low | 29 |
| medium | 1952 |

## Unlock Effect

| Unlock effect | Count |
| --- | --- |
| explanation-only | 29 |
| metadata-only | 107 |
| rank-accuracy | 124 |
| runtime-eligibility | 1845 |

## Classification policy

- `source-missing`でも既存attemptに`value-found`がある63件は、未採用・未正規化を再確認する`source-extractable`へ分離します。
- `requires-game-observation`は画面確認、時間計測、条件比較の必要性から`observe / measure / experiment`へ分けます。
- `likely-requires-experiment`も、単純な時間計測でcloseできるArtifact Gapは`measure`へ落とします。
- implementation / objective-design familyは必要Evidence・影響subsystemまたは不足する目的・metricを保持し、Measurement Protocolを付けません。
- 例外は`manualOverrides`へ理由とreviewedAtを残します。現在はルールだけで全件分類できるため0件です。

## Phase 6 handoff

各Gapの`runtimeRelevance`、`unlockEffect`、`acquisitionCost`をread modelとして提供します。rank sensitivity、所持・利用signal、Priority scoreは未計算です。
