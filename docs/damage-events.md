# Phase 2-1D — DamageEvent foundation（partial）

2026-08-30。対象mechanicsはMinecraft Dungeons 1.17.0.0。
基盤と3種の範囲限定runtimeは実装済みですが、**Power 50–263全域のproc EvidenceがないためPhase completeではありません**。
catalogは12 / 33（うち3種がPower範囲限定）、未実装21 / 33。非対応の効果を0点で登録しません。

## 設計判断: directとindirect

`DamageChannel = 'direct-melee' | 'enchantment-proc'`。
`DamageEventContribution`はsourceId、channel、tier、triggerKind、requiresTargetHit、
opportunitiesPerSecond、triggerProbability、eventsPerSecond、damagePerEvent、
expectedTargetsHit、singleTargetDps、aoeDps、qualifiesAsDirectWeaponKill=false、confidenceを持ちます。
時刻付きsimulatorではなくsteady-state期待寄与です。

`DamageMetrics`は次を保持します。

- directWeaponSingleTargetDps / directWeaponAoeDps
- indirectSingleTargetDps / indirectAoeDps / damageEvents[]
- singleTargetDps = directWeaponSingleTargetDps + indirectSingleTargetDps
- aoeDps = directWeaponAoeDps + indirectAoeDps

baseDps、damagePerHit、Sharpness/Critical/Void/Unchanting倍率、enchantedTargetDps /
nonEnchantedTargetDps、武器expectedTargetsHitは従来の**直接武器channel**の値です。
observedDamagePerHitは直接hitだけを上書きし、proc damageは常に武器Powerから独立計算します。

typed `EnchantmentEffect`へcombo-finisher-damage / on-hit-proc-damageを追加。
procDamageIdとtierMultiplier（on-hitではtriggerChanceも）を保持し、Enchant別optional scalarは増やしません。
`ProcDamageDefinition`はcurve、公開samples、targeting、attribution、Void interactionを別Evidenceで持ちます。
将来のFire Aspect / Poison Cloud / Explodingはtick・duration・重複・target HPなどのeffectを別途追加し、
集約channelとkill境界を再利用できます。Pain Cycle等も勝手にindirectへ分類せず固有のEvidenceが必要です。
今回はいずれも未実装です。

## 発動cadence

`calculateComboFinisherRate(profile, attackSpeedMultiplier)`:

- published: speed ÷ sum(hitDurationsSeconds)。comboFinisherHitの有効性も検証。
- frame-measured: baseHPS ÷ hitsPerCombo × speed。整数combo数と既存frame検証を利用。
- speed-rating-proxy: combo metadataなしとして明示エラー。HPSから捏造しない。

| 武器 | combo時間 | 速度1のfinisher/s | 速度2 |
| --- | ---: | ---: | ---: |
| Fighter's Bindings | 0.575秒 / 4hit | 1.739130 | 3.478261 |
| Double Axe | 1.2秒 / 2hit | 0.833333 | 1.666667 |
| Anchor | 2.5秒 / 1hit | 0.4 | 0.8 |

Shockwaveはfinisher、Swirlingは**mobへ命中したfinisher**で発動。
継続的な有効targetへの命中を100%とする既存DPS abstractionに合わせます（contact Evidenceはlow）。
Thunderingは直接melee HPS × 0.30。Bindingsでは6.956522 × 0.30 = 2.086957 event/s。
他procからThunderingを再帰発動させません。Mushroom等のattackSpeedMultiplierを全発動頻度に反映します。

## 公開Power表とcurveの選択

調査順序はgame-file-derived metadata → Wiki数値/履歴 → 定量community → 複数一致report → 仮定。
[dungeons.tools](https://www.dungeons.tools/enchantments)でTier、発動、non-stackableを確認。
数値表はWikiの本文(action=raw)から収集し、[damage-event-audit.json](../research/damage-event-audit.json)へ全Tier値を保存しました。
metadataの1.17.0.0と、測定version不明の数値表を同じ確実性として扱いません。

| Proc | Power点数 | Tier sample数 | 対応Power | Tier倍率 | 最大Tier再構成誤差 |
| --- | ---: | ---: | --- | --- | ---: |
| [Shockwave](https://minecraft.wiki/w/Dungeons:Shockwave) | 14 | 42 | 210–252 | 1 / 1.5 / 2 | 0.001129% |
| [Swirling](https://minecraft.wiki/w/Dungeons:Swirling) | 18 | 54 | 210–263 | 1 / 1.5 / 2 | 0.225955% |
| [Thundering](https://minecraft.wiki/w/Dungeons:Thundering) | 6 | 18 | 248–263 | 1 / 2 / 3 | 0.000603% |
| 合計 | 38 | 114 | 共通対応区間248–252 | — | — |

採用: **Enchant別Tier I曲線のlog-linear補間 × Tier倍率**。
隣接knot間を `exp((1−t)log(d0) + t log(d1))`、knot上はTier I原値をそのまま使用します。
GEAR_POWER_CURVE / CROSS_WEAPON_DAMAGE_SCALINGや武器damage係数は使いません。
source samplesはmedium、補間curveはlow。**外挿なし**。sample間の真値や個体rollへの精度は不明です。

全114値を0.3%以内で再構成するcomponent testを固定しました。この許容値はsource Tier比率の監査用で、
ゲーム内damageが0.3%正確という主張でも、独立したend-to-end回帰sampleでもありません。
Swirling Power 243では公開Tier I=221783、Tier III=442566が2倍から1000ずれます。
原値を修正せず保持し、runtimeは宣言済みTier倍率から443566を計算するため0.225955%の差になります。
他の比率差は丸め程度です。

### 共通curve仮説の監査

[1.6.0.0履歴](https://minecraft.wiki/w/Dungeons:1.6.0.0)にはShockwave 35→30、
Swirling 45→40。Thunderingには1.3.2.0で+25%の履歴があります。
Shockwave Tier I/30 と Swirling Tier I/40を共有6 Power点で比較すると、
213/221/234ではほぼ一致する一方、210で3.598764%、250で2.058632%、251で1.064263%ずれます。
Swirling/Thunderingも共有6点で3.182878〜3.209711（およそ3.2）ですが一定ではありません。
Swirling基数40を仮定して逆算したThundering基数は12.462180〜12.567242となりますが、
**逆算値は公開されたbase coefficientではありません**。

同Powerのroll差で説明できる可能性はあり、共通curveの存在を反証したわけではありません。
しかし、近い比率と履歴だけでは共通の関数や低Power域を確定できません。
公開された低Power proc表・共通関数が見つからなかったためChoice 2を採用し、Phaseをpartialとします。

## Power 251の代表例

Fighter's Bindings、速度1、proc平均命中数は全種1。各procを単独で使う例です。

| Proc | 公開Tier I / II / III | runtime damage/event I / II / III | event/s | Tier III 単体 / AoE DPS |
| --- | --- | --- | ---: | ---: |
| Shockwave | 227196 / 340793 / 454391 | 227196 / 340794 / 454392 | 1.739130 | 790246.96 / 790246.96 |
| Swirling | 299738 / 449607 / 599476 | 同左 | 1.739130 | 1042566.96 / 1042566.96 |
| Thundering | 94172 / 188344 / 282516 | 同左 | 2.086957 | 589598.61 / 589598.61 |

Shockwave差1はTier I原値×倍率による丸め。Swirlingはfinisher contact必須。
すべてindirectでdirect kill資格なし、Void増幅・消費はruntimeで行いません。
Thunderingはbase lightningのみでLightning Focusは未実装です。

## AoE仮定

`Scenario.damageEventTargeting = { shockwave: 1, swirling: 1, thundering: 1 }`を全6profileへ追加。
各値は**1 proc eventが平均何体へdamageを与えるか**です。
定量的geometry/coverageを確認できなかったため、精密そうな種別値を作らず、
共通の単体baseline=1を採用（low）。「追加ダメージの詳細設定」で変更できます。
すべて有限、1以上、averageTargetsInReach以下。NaN/Infinity/未指定も拒否します。
射程内敵数をUIで減らす場合は各命中数を新上限まで下げ、表示も同期します。

`singleTargetProcDps = eventsPerSecond × damagePerEvent`、
`aoeProcDps = singleTargetProcDps × expectedTargetsHit`。
Shockwave directional wave / Swirling local radius / Thundering nearby lightningは別geometry metadata。
**weapon.areaは流用しません**。通常壁で止まるShockwaveと、Geomancer walls/bombsの例外記述は分けてauditへ残します。
壁をdamage/eventの減算係数には変換しません。

## Kill attributionと具体例

```text
estimatedKills = min(enemySupply, totalAoeDps / enemyHP)
directDamageShare = directWeaponAoeDps / totalAoeDps
directWeaponKills = estimatedKills × scenario.directKillShare × directDamageShare
indirectEstimatedKills = estimatedKills × (1 − directDamageShare)
```

総damage=0ではshare=1、kills=0。procなしはshare=1で従来結果を維持します。
indirectEstimatedKillsはchannel shareによる総間接撃破proxyで、scenario.directKillShareは掛けません。
外部要因の除外を含むdirectWeaponKillsと足して総撃破になるとは限りません。

`DAMAGE_CHANNEL_KILL_ATTRIBUTION`はlow: damage contribution share ≈ final-blow share。
hit/proc timing、残HP、overkill、AoE分布は未モデル化です。
[community report](https://www.reddit.com/r/MinecraftDungeons/comments/1dml95h/enchantments_interfering/)と
[別の報告](https://www.reddit.com/r/MinecraftDungeons/comments/vb335j/)は3種が直接撃破効果を阻害し得ることを支持しますが、
この数式自体の実測根拠ではありません。

例: Bindings Power 251、表示hit=100000、速度1、平均射程内敵2.5、
Shockwave III平均1体、敵HP=1000000、供給0.5/s、directKillShare=0.9。

- 直接AoE=800000、間接AoE=790246.96、総AoE=1590246.96。
- directDamageShare=50.306652%、総撃破=0.5/s、直接撃破=0.226380/s（procなしは0.45/s）。
- Leeching III=20374.19 HP/s（procなし40500）、Guarding III uptime=59.5668%（83.4701%）。
- Refreshment III推定CD=26.7994秒（procなし19.1489秒）。これら3効果はそれぞれ併用した比較例。

damage-limitedかつ未capではproc追加によるtotal kills増分とshare減少が相殺し、
direct kill rateは変わりません。供給capで初めて下がり得ます。実ゲームのexact final blowではありません。
Radianceは直接HPSだけが入力なので同速度のproc追加で回復量は不変です。
contributionは効果を外してCombat/Potion/Healing/Defenseを再計算し、非線形な負の回復寄与も残します。

## Interaction・coverage境界

Sharpness/Critical/Unchantingは直接武器channelのみ。Voidの増幅と消費は**別々にuncertain**。
限定runtimeは「proc増幅なし・Void状態変更なし」で、interactionが存在しないという確定ではありません。
3種はmaxCopies=1、通常IIIと金色I/II/IIIを既存経路で保持、通常＋金色重複も拒否。
Whirlwind / Sheer Daggers / Stormlanderのbuilt-in Tier Iはresearchのみ。

range外の自由候補はoptimizerが明示的なunsupportedChoicesへ返して除外します。
locked/gildedや評価可能な候補のないスロットは明示エラー。直接evaluateも拒否。
UIは未対応の新規選択を無効化し、既存選択は削除可能に保持します。
JSON/localStorage version 1はrange外になった候補も保存でき、再計算時に境界を検証します。
範囲外damageを0として評価したり、所持情報を黙って削除したりしません。
Scenario APIにはdamageEventTargetingが必要です（Scenario自体は従来どおりセッション内）。

## 検証と残リスク

`audit:damage-events`でschema、全Tier、range、発動、targeting、帰属、source、Tier再構成誤差を確認。
testsでruntimeとfixtureの一致、3武器、速度、実際のMushroom、modifier分離、範囲外、
direct-kill阻害、Radiance不変、寄与度、保存/金色/lock、UI callback、Evidenceの条件付き集計を検証します。
12候補×3slotではnon-stackable除外後1422 build（旧9候補579）。Web Worker化はしません。

残リスクはproc絶対精度・低Power表・AoE命中数・final-blow帰属・Void間接interaction・壁geometry・
Swirling contact・Lightning Focus。独立実機回帰は依然pendingです。
次は低Power/共通curveのEvidence補強を優先。Phase 2-1Eを並行検討するなら、
未確定Power曲線・DoT重複に依存するFire Aspect/Poison Cloud/Explodingの一括追加より、
**Committed + simple/state系**の敵HP trajectory調査が依存関係上独立です。自動的な実装決定ではありません。
