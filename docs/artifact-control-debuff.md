# Artifact Control / Debuff — Phase 2-2B

対象versionは1.17.0.0。3候補を同時にruntime化するのではなく、公開Evidenceが各効果の状態・時間・対象境界を支えたものだけを登録します。機械可読監査は [`research/artifact-control-debuff-audit.json`](../research/artifact-control-debuff-audit.json) です。

## Decision

| Artifact | Decision | Reason |
| --- | --- | --- |
| Shock Powder | Limited | CD 15秒とPower 12 / 58 / 108 / 262のstun時間4点があり、範囲内だけの補間とScenario対象割合でhard Controlを構成できる |
| Fishing Rod | Research-only | 1.16.2.0の「1.5秒→3秒」と現行のPower-scaled表示の関係・現行式が不明 |
| Gong of Weakening | Research-only | Power-scaled表示時間、Weakening 5秒、2x vulnerabilityのduration/state ownershipが分離できない |

## Shock Powder

公開値はCD 15秒、周囲の敵へのstun、Power 12→3.5秒、58→5.3秒、108→7.2秒、262→13秒です。4点をexact knotとして保持し、区間内だけを線形補間します。damage系curveやDeath Cap式は使わず、Power 11と263は拒否します。

```text
effectiveCooldown = 15 × (1 - cooldownReduction)
rawActiveCoverage = min(1, stunDuration / effectiveCooldown)
hardDisableCoverage = rawActiveCoverage
                    × shockPowderEligibleTargetShare
                    × shockPowderAffectedTargetShare
```

Power 108、CDR 0、eligible 80%、affected 60%なら、7.2 / 15 = raw 48%、hard disableは23.04%です。これは行動不能Controlであり、DPS・回復・hero防御・Soul・撃破率へ変換しません。別のhard stunとの合成は飽和する独立union近似 `1-(1-a)(1-b)` で、source contributionを保持します。

時間モデルはsteady-stateの「使用可能になり次第使う」です。有限戦闘のt=0初回使用を別加算しません。CDRでCDがduration未満になってもcoverageは1以下に飽和し、同じ状態のrefresh近似とします。duplicateのrefresh/overlap根拠がないため、ゲーム上3slotへ装備できてもruntimeは1copyだけです。

Artifact Synergyは使用1回につきactivation 1回です。stun tickや敵数、成功対象割合をactivation rateへ掛けません。boss profileはShock Powder eligibilityを0にし、通常profileも50%の編集可能なlow-confidence初期値です。半径、powerful mob、miniboss、Apocalypse+耐性はScenario割合に含め、game truthとは扱いません。

根拠: [Shock Powder](https://minecraft.wiki/w/Dungeons:Shock_Powder)

## Fishing Rod

1.16.2.0でCDは5秒から1.5秒、stunは1.5秒から3秒へ変更されました。一方、現行説明はclosest mobを引き寄せ、stun時間がPowerで変化するとします。旧式 `(power - 1) × 0.02 + 1.5` はpatch前baseと見られるため流用しません。現在版の複数Power sample、game-file式、または独立して裏付けた現行式がないのでruntime IDを登録しません。

将来のstateでは、use actionとsuccessful mob effectを分離し、item / emerald / XPの取得、空振り、boss immunityをsuccessful shareへ含めます。pullは単体positional control、stunはhard disableであり、Gravity groupingやDPS倍率にはしません。

根拠: [Fishing Rod](https://minecraft.wiki/w/Dungeons:Fishing_Rod) / [1.16.2.0](https://minecraft.wiki/w/Dungeons:1.16.2.0)

## Gong of Weakening

確認できる値はCD 20秒、影響対象が受けるdamage 2x、約7 blockの報告、1.16.2.0でraw range 400→500・multiplier 3x→2x・Weakening 4秒→5秒です。しかし表示上のPower-scaled durationがvulnerabilityとWeakeningのどちらを指すか、両者が同じ時間か、Weakening magnitudeが何かは確定しません。

このため `GongVulnerabilityState` と `GongWeakeningState` を作らず、total DPSへ2xを掛けるzero/placeholder実装も行いません。Weapon Weakeningとのrefresh/overwrite、Void・Critical・Unchanting・Smiting・proc/DoT/pet/partyへのchannel ownership、outgoing/incomingの別target shareが揃うまでResearch-onlyです。

根拠: [Gong of Weakening](https://minecraft.wiki/w/Dungeons:Gong_of_Weakening) / [1.16.2.0](https://minecraft.wiki/w/Dungeons:1.16.2.0)

## Next batch

Phase 2-2C候補はSoul Healer / Harvester / Lightning Rodです。共通dependencyは有限Soul支出schedulerであり、cooldown capacityを実使用率に置き換える必要があります。
