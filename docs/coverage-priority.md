# Coverage Priority

Phase 6のanalysis-only priority read model。未知値をruntimeへ投入せず、Evidenceやruntime supportを変更しない。Priority confidenceとEvidence confidenceは別の指標である。

## Summary

- Gap: 2105
- Global tier: P0 86 / P1 1836 / P2 47 / P3 136
- Rank sensitivity: computed 1072 / insufficient-range 626 / not-applicable 136 / unsupported 271
- Method: bounded-proxy 1072 / optimizer-perturbation 0 / not-applicable 136 / unsupported 897
- Winner flip proxyあり: 779 Gap
- same-family-only: 65 Gap
- Personal confidence: high 136 / medium 793 / low 1176
- Unlock Bundle: 386
- Synthetic owned queue: 15 actionable Gap（P0 4）
- Potential usability: Global P0を全てcloseした場合 0 Entity candidate、P0+P1では 357 Entity candidate（いずれもruntime昇格ではない）

## Formula

Weighted sum: runtime unlock 30%、rank sensitivity 25%、ownership 20%、coverage 10%、near-unlock 10%、acquisition ease 5%。Globalはownershipを除外して残りを再正規化する。閾値はP0 >= 81.5、P1 >= 60、P2 >= 42、P3 < 42。

## Global Top 20 Gap

| # | ID | Score | Tier | Gap | Entity |
|---:|---|---:|:---:|---:|---:|
| 1 | artifact:death-cap-mushroom:duration | 82.6 | P0 | 1 | 1 |
| 2 | artifact:iron-hide-amulet:duration | 82.6 | P0 | 1 | 1 |
| 3 | melee-weapon:anchor:attackSpeedScaling | 81.8 | P0 | 1 | 1 |
| 4 | melee-weapon:axe:attackSpeedScaling | 81.8 | P0 | 1 | 1 |
| 5 | melee-weapon:backstabber:attackSpeedScaling | 81.8 | P0 | 1 | 1 |
| 6 | melee-weapon:battlestaff-of-terror:attackSpeedScaling | 81.8 | P0 | 1 | 1 |
| 7 | melee-weapon:battlestaff:attackSpeedScaling | 81.8 | P0 | 1 | 1 |
| 8 | melee-weapon:bee-stinger:attackSpeedScaling | 81.8 | P0 | 1 | 1 |
| 9 | melee-weapon:bone-cudgel:attackSpeedScaling | 81.8 | P0 | 1 | 1 |
| 10 | melee-weapon:boneclub:attackSpeedScaling | 81.8 | P0 | 1 | 1 |
| 11 | melee-weapon:bonehead-hammer:attackSpeedScaling | 81.8 | P0 | 1 | 1 |
| 12 | melee-weapon:broadsword:attackSpeedScaling | 81.8 | P0 | 1 | 1 |
| 13 | melee-weapon:cackling-broom:attackSpeedScaling | 81.8 | P0 | 1 | 1 |
| 14 | melee-weapon:chill-gale-knife:attackSpeedScaling | 81.8 | P0 | 1 | 1 |
| 15 | melee-weapon:claymore:attackSpeedScaling | 81.8 | P0 | 1 | 1 |
| 16 | melee-weapon:coral-blade:attackSpeedScaling | 81.8 | P0 | 1 | 1 |
| 17 | melee-weapon:cursed-axe:attackSpeedScaling | 81.8 | P0 | 1 | 1 |
| 18 | melee-weapon:cutlass:attackSpeedScaling | 81.8 | P0 | 1 | 1 |
| 19 | melee-weapon:dancers-sword:attackSpeedScaling | 81.8 | P0 | 1 | 1 |
| 20 | melee-weapon:dark-katana:attackSpeedScaling | 81.8 | P0 | 1 | 1 |

P0理由は各Gapのglobal.reasonsに、unlock効果、family coverage、bundle残数、補正後cost、Rank Sensitivity method、weight stabilityを保持する。

## Global Top 20 Entity

| # | ID | Score | Tier | Gap | Entity |
|---:|---|---:|:---:|---:|---:|
| 1 | melee-weapon:anchor | 79.4 | P1 | 2 | 1 |
| 2 | melee-weapon:axe | 79.4 | P1 | 2 | 1 |
| 3 | melee-weapon:backstabber | 79.4 | P1 | 2 | 1 |
| 4 | melee-weapon:battlestaff | 79.4 | P1 | 2 | 1 |
| 5 | melee-weapon:battlestaff-of-terror | 79.4 | P1 | 2 | 1 |
| 6 | melee-weapon:bee-stinger | 79.4 | P1 | 2 | 1 |
| 7 | melee-weapon:bone-cudgel | 79.4 | P1 | 2 | 1 |
| 8 | melee-weapon:boneclub | 79.4 | P1 | 2 | 1 |
| 9 | melee-weapon:bonehead-hammer | 79.4 | P1 | 2 | 1 |
| 10 | melee-weapon:broadsword | 79.4 | P1 | 2 | 1 |
| 11 | melee-weapon:cackling-broom | 79.4 | P1 | 2 | 1 |
| 12 | melee-weapon:chill-gale-knife | 79.4 | P1 | 2 | 1 |
| 13 | melee-weapon:claymore | 79.4 | P1 | 2 | 1 |
| 14 | melee-weapon:coral-blade | 79.4 | P1 | 2 | 1 |
| 15 | melee-weapon:cursed-axe | 79.4 | P1 | 2 | 1 |
| 16 | melee-weapon:cutlass | 79.4 | P1 | 2 | 1 |
| 17 | melee-weapon:dancers-sword | 79.4 | P1 | 2 | 1 |
| 18 | melee-weapon:dark-katana | 79.4 | P1 | 2 | 1 |
| 19 | melee-weapon:diamond-pickaxe | 79.4 | P1 | 2 | 1 |
| 20 | melee-weapon:diamond-sword | 79.4 | P1 | 2 | 1 |

## Synthetic Personal Top 20 Gap

Synthetic inventoryは Harp Crossbow / Bow / Wither Armor。本人Inventoryは保存せず、ブラウザから同じbuilderへ渡す。Globalではownershipを除外し、Personalだけowned / actual same-family / not-ownedを反映する。

| # | ID | Score | Tier | Gap | Entity |
|---:|---|---:|:---:|---:|---:|
| 1 | ranged-weapon:bow:burstCount | 85.3 | P0 | 1 | 1 |
| 2 | ranged-weapon:harp-crossbow:burstCount | 85.2 | P0 | 1 | 1 |
| 3 | ranged-weapon:bow:procOwnership | 81.8 | P0 | 1 | 1 |
| 4 | ranged-weapon:harp-crossbow:procOwnership | 81.6 | P0 | 1 | 1 |
| 5 | ranged-weapon:bow:chargeTimeSeconds | 81.0 | P1 | 1 | 1 |
| 6 | ranged-weapon:bow:recoverySeconds | 81.0 | P1 | 1 | 1 |
| 7 | ranged-weapon:harp-crossbow:chargeTimeSeconds | 80.9 | P1 | 1 | 1 |
| 8 | ranged-weapon:harp-crossbow:recoverySeconds | 80.9 | P1 | 1 | 1 |
| 9 | armor:wither-armor:healthPowerCurve | 79.0 | P1 | 1 | 1 |
| 10 | ranged-weapon:bow:neutralProjectileDamageDistribution | 76.5 | P1 | 1 | 1 |
| 11 | ranged-weapon:harp-crossbow:neutralProjectileDamageDistribution | 76.3 | P1 | 1 | 1 |
| 12 | armor:wither-armor:runtimeBoundary.1 | 74.0 | P1 | 1 | 1 |
| 13 | ranged-weapon:bow:spread | 71.6 | P1 | 1 | 1 |
| 14 | ranged-weapon:harp-crossbow:spread | 71.4 | P1 | 1 | 1 |
| 15 | ranged-weapon:bow:duplication | 70.7 | P1 | 1 | 1 |
| 16 | ranged-weapon:bow:pierce | 70.7 | P1 | 1 | 1 |
| 17 | ranged-weapon:bow:ricochet | 70.7 | P1 | 1 | 1 |
| 18 | ranged-weapon:harp-crossbow:duplication | 70.6 | P1 | 1 | 1 |
| 19 | ranged-weapon:harp-crossbow:multiHitPossibility | 70.6 | P1 | 1 | 1 |
| 20 | ranged-weapon:harp-crossbow:pierce | 70.6 | P1 | 1 | 1 |

**same-family-only**はSource Harvestでacceptedな同一family relationが確認できる装備だけに付ける。同categoryであるだけでは付けず、Enchant / Artifactには適用しない。Owned Research Queueは引き続き **availability === owned** だけを含む。

## Task Family ranking

| # | ID | Score | Tier | Gap | Entity |
|---:|---|---:|:---:|---:|---:|
| 1 | melee-attack-scaling-measurement | 81.6 | P0 | 82 | 82 |
| 2 | enchant-timing-measurement | 78.3 | P1 | 121 | 72 |
| 3 | proc-ownership-experiment | 77.6 | P1 | 112 | 112 |
| 4 | enchant-proc-measurement | 76.3 | P1 | 56 | 56 |
| 5 | power-scaling-experiment | 75.8 | P1 | 155 | 155 |
| 6 | ranged-card-observation | 75.1 | P1 | 206 | 76 |
| 7 | ranged-shot-cycle-measurement | 71.5 | P1 | 213 | 71 |
| 8 | enchant-power-dependence-experiment | 70.4 | P1 | 74 | 74 |
| 9 | projectile-distribution-experiment | 70.2 | P1 | 71 | 71 |
| 10 | artifact-timing-measurement | 68.3 | P1 | 26 | 14 |
| 11 | implementation-mechanic-family | 68.0 | P1 | 118 | 98 |
| 12 | structured-source-reconciliation | 68.0 | P1 | 63 | 42 |
| 13 | artifact-behavior-observation | 65.9 | P1 | 40 | 24 |
| 14 | artifact-interaction-experiment | 64.7 | P1 | 53 | 26 |
| 15 | ranged-mechanic-experiment | 64.1 | P1 | 41 | 41 |
| 16 | implementation-defense-composition | 63.3 | P1 | 35 | 30 |
| 17 | public-property-research | 63.2 | P1 | 286 | 75 |
| 18 | implementation-position-event-model | 62.5 | P1 | 25 | 22 |
| 19 | implementation-cooldown-scheduler | 62.4 | P1 | 18 | 18 |
| 20 | implementation-ranged-runtime | 62.2 | P1 | 17 | 17 |
| 21 | implementation-soul-economy | 61.8 | P1 | 17 | 17 |
| 22 | implementation-modifier-ownership | 61.6 | P1 | 14 | 14 |
| 23 | implementation-summon-runtime | 61.2 | P1 | 12 | 12 |
| 24 | implementation-artifact-runtime | 60.4 | P1 | 7 | 7 |
| 25 | implementation-life-steal-policy | 59.9 | P2 | 4 | 4 |
| 26 | implementation-targeting-model | 59.7 | P2 | 4 | 4 |
| 27 | source-conflict-resolution | 51.5 | P2 | 6 | 6 |
| 28 | current-mechanic-observation | 49.8 | P2 | 74 | 74 |
| 29 | version-history-research | 49.2 | P2 | 126 | 123 |
| 30 | objective-party-support | 28.6 | P3 | 13 | 13 |
| 31 | objective-mobility | 28.0 | P3 | 8 | 8 |
| 32 | objective-resistance-utility | 27.5 | P3 | 5 | 5 |
| 33 | objective-arrow-economy | 27.4 | P3 | 3 | 3 |

Implementation Gapはmeasurementと混ぜずimplementationPriorities、Objective-designはPersonal Research Queueへ入れずobjectiveDesignPrioritiesに分離する。最大のimplementation familyをupstream critical pathとしてcoverage gainとruntime unlockへ反映する。

| # | ID | Score | Tier | Gap | Entity |
|---:|---|---:|:---:|---:|---:|
| 1 | implementation-mechanic-family | 68.0 | P1 | 118 | 98 |
| 2 | implementation-defense-composition | 63.3 | P1 | 35 | 30 |
| 3 | implementation-position-event-model | 62.5 | P1 | 25 | 22 |
| 4 | implementation-cooldown-scheduler | 62.4 | P1 | 18 | 18 |
| 5 | implementation-ranged-runtime | 62.2 | P1 | 17 | 17 |
| 6 | implementation-soul-economy | 61.8 | P1 | 17 | 17 |
| 7 | implementation-modifier-ownership | 61.6 | P1 | 14 | 14 |
| 8 | implementation-summon-runtime | 61.2 | P1 | 12 | 12 |
| 9 | implementation-artifact-runtime | 60.4 | P1 | 7 | 7 |
| 10 | implementation-life-steal-policy | 59.9 | P2 | 4 | 4 |
| 11 | implementation-targeting-model | 59.7 | P2 | 4 | 4 |

## Protocol ranking

| # | ID | Score | Tier | Gap | Entity |
|---:|---|---:|:---:|---:|---:|
| 1 | MEAS-MELEE-ATTACK-SCALING | 81.6 | P0 | 82 | 82 |
| 2 | MEAS-ENCHANT-TIMING | 78.3 | P1 | 121 | 72 |
| 3 | EXP-RANGED-PROC-OWNERSHIP | 77.6 | P1 | 112 | 112 |
| 4 | MEAS-ENCHANT-PROC | 76.3 | P1 | 56 | 56 |
| 5 | EXP-POWER-SCALING | 75.8 | P1 | 155 | 155 |
| 6 | OBS-RANGED-CARD | 75.1 | P1 | 206 | 76 |
| 7 | MEAS-RANGED-SHOT-CYCLE | 71.5 | P1 | 213 | 71 |
| 8 | EXP-ENCHANT-POWER | 70.4 | P1 | 74 | 74 |
| 9 | EXP-RANGED-PROJECTILE-DISTRIBUTION | 70.2 | P1 | 71 | 71 |
| 10 | MEAS-ARTIFACT-TIMING | 68.3 | P1 | 26 | 14 |
| 11 | OBS-ARTIFACT-BEHAVIOR | 65.9 | P1 | 40 | 24 |
| 12 | EXP-ARTIFACT-INTERACTION | 64.7 | P1 | 53 | 26 |
| 13 | EXP-RANGED-MECHANIC | 64.1 | P1 | 41 | 41 |
| 14 | OBS-CURRENT-MECHANIC | 49.8 | P2 | 74 | 74 |

Top Protocolは MEAS-MELEE-ATTACK-SCALING。同一Protocolのowned EntityはgroupedResearchQueueにまとめる。

## Rank sensitivity

現在のmethodは **bounded-proxy**。明示できるpropertyだけをnominal 1.0の保守的なrelative rangeで評価し、6 objectiveごとに3候補fixtureのwinner margin 10% / Top3 margin 6%と比較する。Optimizerを直接perturbしてBest Buildを再計算した値ではないため、**winnerFlipProxyRate** / **top3ChangeProxyRate** として保持し、これだけでPriority confidenceをhighにしない。score接続不能・range不明はunsupported / insufficient-rangeとして計算せず、計算済みproxyはrange provenanceを保持する。

## Unlock and critical path

unlock:artifact:corrupted-seeds は必要Gapが1件だけのnear-unlock例。 implementation familyはdownstream Entity数をcoverage gainとして持ち、runtime-eligibilityと合わせてcritical pathを優先する。解決はcandidate化までで、runtime supportを自動昇格しない。

## Cost and queue

Protocolのestimated minutesにsetup、minimum repetitions、controls、variantsの補正を加える。同じProtocolのowned EntityをgroupedResearchQueueへ束ね、Phase 7がentity / gap / protocol / priority / reason / cost / prerequisitesを直接読める。Availabilityはowned / same-family-only / not-owned / unknownを区別する。Personal reasonには所持relation、Rank Sensitivity method、weight stability、推定時間を含める。

## Global Weight Sensitivity

| Variant | Default Top 20との重複 |
|---|---:|
| default | 20 / 20 |
| rank-heavy | 0 / 20 |
| unlock-heavy | 20 / 20 |
| coverage-heavy | 2 / 20 |

Globalはownership componentを除外し、ownership-heavy variantを持たない。

## Personal Weight Sensitivity

| Variant | Default Top 20との重複 |
|---|---:|
| default | 20 / 20 |
| ownership-heavy | 12 / 20 |
| rank-heavy | 19 / 20 |
| unlock-heavy | 15 / 20 |

Personalはsynthetic ownershipを含め、ownership-heavyで所持Gapへの寄与を増やす。各Gapのscore range、tier stability、Top 20 membership retentionからweight stabilityを決め、不安定なrankingをhigh confidenceにしない。

## Priority confidence

Priority confidenceはRank Sensitivity method、range充足、ownership relation、cost、weight stabilityから決める。bounded-proxyは最大medium、insufficient-rangeまたは大幅なweight変動はlow。同familyだけの場合もownership確定とは区別する。Priority tierがP0でもconfidence lowを許容し、Evidence confidenceとは混同しない。

## Safety boundary

Runtime、Optimizer formula、Inventory schema、Evidence、Research Quest UI、Public Availabilityは変更していない。Priorityは候補選定のanalysis metadataであり、support昇格を意味しない。
