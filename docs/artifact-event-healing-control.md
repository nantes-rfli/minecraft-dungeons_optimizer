# Artifact event / healing zone / positional control — Phase 2-2D

Phase 2-2Dはmechanics architectureとEvidence判断まで完了しました。Powershaker、Totem of Regeneration、Wind Hornはいずれもruntime gateを通らず、Artifact runtimeは **3 / 45（Full 2、Limited 1、Research-only 42）** のままです。未対応効果を0点候補として登録していません。

Source factとmodel architectureは分離しています。機械可読の正本は[`research/artifact-event-healing-control-audit.json`](../research/artifact-event-healing-control-audit.json)、整合性検証は`npm run audit:artifact-event`です。

## 共通境界

- 1回のArtifact使用actionを1 activationとします。Powershakerの爆発数、Totemのtick数、Wind Hornの対象数はArtifact Synergy activationへ加えません。
- 継続効果を`encounterDuration`と同時刻に初めて置いた場合、active timeは0でeffect creditも0です。instant effectは発動時刻がencounter内の場合だけcredit可能です。activation accountingとeffect creditは別です。
- 未対応familyは`ArtifactId` / `ARTIFACTS`へ登録しません。Power範囲外を0点評価せず、候補から除外し、forced inputなら明示エラーにする設計を維持します。

## Powershaker — Research-only

[dungeons.tools 1.17.0.0](https://www.dungeons.tools/artifacts/powershaker)と[Wiki](https://minecraft.wiki/w/Dungeons:Powershaker)から、cooldown 10秒、最大15秒、最大5爆発、melee-hit mobに爆発を置くことを確認しました。[1.16.2.0履歴](https://minecraft.wiki/w/Dungeons:1.16.2.0)の変更はstack 4→5、係数235→259、cooldown 8→10秒です。

これは通常のtimed buffではありません。効果は15秒経過と5爆発消費の早い方で終わるため、`15 / cooldown`をuptimeには使えません。将来runtime化する場合は、発動ごとの有限budget、未消費数、時間切れ回数、budget消費完了回数をeventとして追跡します。爆発は`artifact-damage`であり、direct-meleeやenchantment-procではありません。Leeching、Guarding Strike、Refreshment、Rampagingのdirect killへ自動加算しません。

複数のcommunity reportは広い1 swingが複数mobに爆発を置けると一致しますが、5 budgetがattack action単位かhit target単位かを統制条件で数えていません。miss、同一target、deterministic/chance wording、active中の再使用（reset / refresh / replace / stack / 使用不可）、爆発AoEとprimary overlapも未解決です。

係数259はabsolute damageではありません。current Power→absolute damage sampleが0件で、武器curve、Anchor、Dynamo、共通Artifact curveを借りません。Gong、Artifact damage boost、Void Strike、Critical Hit、Sharpness、Committed、Explodingとのmodifier境界、artifact killのSoul生成適格性も未解決です。

runtime blockerは、trigger確率/miss、multi-target budget粒度、再発動/duplicate、absolute curveとPower範囲、AoE/kill attribution、modifier/Soul境界です。

## Totem of Regeneration — Research-only

[dungeons.tools 1.17.0.0](https://www.dungeons.tools/artifacts/totem-of-regeneration)からcooldown 25秒と、zone内を徐々に回復するauraであることを確認しました。[Wiki](https://minecraft.wiki/w/Dungeons:Totem_of_Regeneration)は半径4 blocks、約5〜10秒、Power 31→229、111→2659、114→2917の`health healed`を報告します。[1.7.2.0履歴](https://minecraft.wiki/w/Dungeons:1.7.2.0)は回復が20/sから40/sへ倍増したと記録します。

Totemは置いた瞬間のinstant healではありません。将来は`placed-healing-zone`としてradius、exact duration、healing rateを持ち、`rawZoneUptime × selfResidenceShare × nominalHealingPerSecondInsideZone`で自己の名目回復capacityを求めます。party総回復はheroのHealing objectiveへ加えません。default residence 1を採用する場合もsolo stationary / ideal placement baselineと明記します。missing HP、overheal、knockback、ally movementは別問題です。

しかし、5〜10秒はnumeric runtimeに使えるexact durationではなく、固定・Power scaling・tick countのどれかも不明です。`health healed`がtotal、per-second、per-tick、Power-scaled rateのどれかを40/s履歴と整合できません。3 sampleのversionは不明でPower 114までしかなく、endgameへ外挿しません。zone重複が加算・refresh・置換のどれかも未解決です。

runtime blockerは、exact duration/tick count、表示単位、現行Power curve、自分のresidenceとparty帰属、duplicate zone overlapです。

## Wind Horn — Research-only

[dungeons.tools 1.17.0.0](https://www.dungeons.tools/artifacts/wind-horn)と[Wiki](https://minecraft.wiki/w/Dungeons:Wind_Horn)から、cooldown 10秒、円形blast、押し出し、brief slow、密着したmobは押されないがslowは受けることを確認しました。

公開push表は次のとおりです。

| Reported Power | Blocks pushed |
| --- | ---: |
| 1–13 | 4 |
| 13–39 | 5 |
| 39–65 | 6 |
| 65–90 | 7 |
| 90–108 | 8 |

13 / 39 / 65 / 90の境界は重複し、Power 109以上の値はありません。8 blocks capを仮定せず、Power 251へ外挿しません。密着cutoff、boss/immovableのpushとslow適格性、duplicate refresh/overlapも定量化されていません。

Wind HornはGravityと逆方向の`separation`です。将来raw metricを追加するなら`separationCoverage`とし、既存のhardDisable / attackSlow / root / groupingの4軸は変更しません。意味あるpolicyなしにdefault weightを足さず、push距離をDPSまたはdamage reductionへ変換しません。slowはmovement speed / attack speed / bothの分類、magnitude、durationがすべて未解決です。pushとslowのeligible target shareは密着例外があるため別入力です。

runtime blockerは、band境界とhigh-Power範囲、slowの分類/値、密着対象share、boss/immovable適格性、duplicate behavior、意味あるseparation objectiveです。

## 次Phase

Phase 2-2Cと2-2Dを通じて新runtime Artifactは0でした。別Artifact batchを続けず、次は **Artifact Evidence Acquisition / Curve Extraction** を第一候補にします。game-file-derived curve、raw unit、duration/tick、interactionの取得は今回までの6候補へ直接再利用できます。

Armor / Armor Enchantmentsは実用性が高い一方で新しいequipment/defense contractが必要なため第二候補、Equipment Box→Simulation UXは既存modelだけで進めやすいもののcoverage blockerを解決しないため第三候補です。

なおControl説明表示では、Stunning行をStunning自身の`effectiveHardDisableCoverage`へ修正し、Shock Powderとのunionは`Combined hard-disable coverage`として別行にしました。Control数値式は変更していません。
