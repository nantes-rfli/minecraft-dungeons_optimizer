# Phase 2-1G — Soul subsystem（partial）

Soul Scytheを1種だけ追加し、Soul SiphonとAnima Conduitを限定モデルで実装しました。Enigma ResonatorはSoul量から発動率への換算式が未検証のためresearch-onlyです。catalog 19 / 33、広域Power 16 / 33、Power範囲限定proc 3 / 33、research-only 14、needs-state-model 9。Phase 2-1D / 2-1Fはpartialを維持します。

## 採用武器と合法性

- Soul Scythe（common、内蔵Enchantなし）。Phase 1Aの`exact`、完全profile・出典ありでstrict runtime-ready。等damageの2 hit、0.48 / 0.56秒、基礎HPS `2 / 1.04 = 1.923076923`。公開timingのconfidenceはmedium、攻撃速度への線形追従は既存モデルの仮定です。
- [dungeons.tools calculator](https://www.dungeons.tools/damage-calculator)の1.17.0.0由来serialized rowはPower **6.915**、Speed **2.646**、Area **9.425**。[武器ページ](https://www.dungeons.tools/weapons/soul-scythe)の+1 Soul Gatheringを採用。丸めたUIのPower 7やWikiのbase damage 80を係数にしません。
- Anchor基準の既存Power curveを使用。Power 251の計算値885585はモデル出力であり、独立実測ではありません。Soul Scytheの回帰sampleは0件、精度未検証です。
- `WeaponDefinition.soul`で装着可否と基礎Gatheringを分離。既存3武器はfalse / 0。装備全体のSoul収入が増えても、non-soul武器がSoul enchantを装着できるようにはしません。
- 3 Soul enchantは型付きmetadataに`soulGearOnly: true`を保持。Anima / Siphonだけをruntime catalogに登録し、Enigmaは登録しません。core、Optimizer、通常候補（未選択も含む）、locked、gilded、JSON読込、保存すべてで不正装着を拒否します。
- Soul Knifeも既存監査でexactですが、今回の追加は第一候補1種に限定しました。

## Evidenceの境界

[機構監査](../research/soul-subsystem-audit.json)にsource、version、claim別confidence、source conflictを保持しています。優先順は1.17.0.0由来game data、Wikiの具体的機構・履歴、定量community測定、複数報告、モデル仮定です。dungeons.toolsの解説文はraw codeと同一視しません。Wikiの直接取得が拒否されたページは検索indexの取得可能な記述に限定し、未読のSoulページに新規claimを帰属させません。

| Claim | Confidence / 根拠 |
| --- | --- |
| 容量300・開始0 | high / [Utility Bar](https://minecraft.wiki/w/Dungeons:Utility_Bar) |
| Soul gear限定・non-stackable・Tier値 | high / 個別game-dataページとWiki履歴 |
| 本体+選択Soul enchant各+1の加算 | medium / 1.3.2.0変更とcommunityの具体例 |
| gildedも同じ+1 | low / slot非依存propertyとして採用、現行版の比較測定なし |
| SiphonのTier値をpickup個数と解釈・Gathering倍 | medium / [2023 soul guide](https://www.reddit.com/r/MinecraftDungeons/comments/14o1lub/)とWiki履歴 |
| AoEのroll単位 | low / 下記の限定モデル |
| 連続Soul推移、吸収遅延省略、通常撃破の代理 | low / モデル仮定 |
| Animaの満タン時・実回復 | low / 名目回復容量、未検証事項を含む |

これらのSoul固有のconfidence factorはSoul enchantを使うbuildにだけ追加します。AnimaやSiphon固有のfactorもそれぞれ使用時だけ、gilded仮定もSoul enchantが金色枠の場合だけです。

## Pickupとresource

`SoulIncome`は`pickupEventsPerSecond`と`resourceUnitsPerSecond`を別フィールドにします。`SoulState`は通常/Siphon/合計を別々に保持します。

```text
Gathering = weapon base + selected soul enchants + external
normal pickups/s = eligibleSoulGeneratingKillsPerSecond
normal resource/s = normal pickups/s × Gathering
```

外部Gatheringは今回は0。防具の倍率、遠距離、Soul消費Artifactを実装していません。将来外部componentを拡張しても、武器の装着適性とは独立です。

通常pickupはGathering > 0のときに推定総撃破`estimatedKillsPerSecond`を使います。Animaの1.3.2.0履歴は任意のkill sourceを認めるため、`directWeaponKillsPerSecond`へ限定しません。Soul消費Artifactの撃破は原則Soulを生まず、Soul Lantern例外の報告もあるため、将来は明示的なeligible kill channelが必要です。現在のArtifact2種はSoulを消費せずdamageも与えません。

## Encounter trajectory

遭遇開始をミッション開始の空ゲージと同一視し、一定rate・消費0とします。途中から満タンの状態で遭遇する場合には適用できません。

```text
g = totalResourceUnitsPerSecond, C = capacity, T = encounterDurationSeconds

g = 0: average = end = 0, fillTime未定義
g > 0: fillTime = C / g
fillTime >= T: end = T / fillTime, average = end / 2
fillTime < T: end = 1, average = 1 - fillTime / (2T)
```

容量は独立parameterで、runtime defaultは300。spending=0のみで、未実装の消費を受け付けて無視するAPIはありません。数値はfinite/nonnegativeを検証し、overflowを明示エラーにします。

Golden: `g=10,C=300,T=10 → end=1/3,average=1/6`。`g=30,C=300,T=30 → fill=10,average=5/6,end=1`。

収入は**潜在収入**であり満タン後のゲージ実増分ではありません。容量を超えるresourceは保持されませんが、visual pickupを消去しません。orb travel、吸収遅延、離散kills、target switching、frame cadence、戦闘序盤のbuff立ち上がりは再現しません。

## Soul Siphon

[1.17.0.0 metadata](https://www.dungeons.tools/enchantments/soul-siphon)は20%・Tier 1/3/5、non-stackable。[Wiki履歴](https://minecraft.wiki/w/Dungeons:Soul_Siphon)では1.16.2.0に5%から20%、3/6/9から1/3/5へ変更。1.3.2.0以後はGathering bonusがcollected resourceへ適用されます。

```text
opportunities/s = resolved HPS
proc/s = opportunities/s × 0.20
siphon pickups/s = proc/s × Tier pickup count
siphon resource/s = siphon pickups/s × total Gathering
```

[community guide](https://www.reddit.com/r/MinecraftDungeons/comments/14o1lub/)には複数mobへ当てると抽選機会が増えるとの報告があります。ただし1.17.0.0の統制されたtarget別抽選測定は確認できません。今回は**profile hitごとに1回**をlow confidenceで採用。AoE期待命中数を掛けず、広範囲攻撃の収入を過小評価し得ると明記します。proc damageや空振りを新たな抽選機会にせず、連続的にhit可能なtargetがいる想定です。tower wraithなど個体別例外は未モデル化です。

例: HPS 3.2ならproc 0.64/s。Tier IIIで3.2 pickups/s、Gathering 3なら9.6 resources/s。攻撃速度を上げればpickupが増え、Gatheringだけを上げればresourceのみ増えます。Siphon単独の資源量自体には効用点を付けません。Animaを併用した際の回復容量は評価します。これは効果未実装の0点登録ではなく、消費先がないbuildでのモデル化済み効果です。

## Anima Conduit

近接は最大HPの2/4/6%、non-stackable。[履歴](https://minecraft.wiki/w/Dungeons:Anima_Conduit)の1.3.2.0で資源量倍率が回復から除かれ、visual pickup基準になりました。遠距離の1.16.2.0以後4/6/8%を混ぜません。

```text
animaHealingCapacity/s = total pickups/s × maxHealth × healFractionPerPickup
```

10 pickups/s、最大HP100、Tier IIIなら60 capacity/s。resource収入が100/sでも600にはしません。Siphon IIIの1procが5 pickupsなら30% maxHP capacityであり、Gathering 5で25 resourcesを得ても150%にはしません。

Utility Barにはゲージ満タン時にもvisual pickupが流入する記述があります。しかし**その際にもAnimaが回復するかの現行版定量測定は確認できません**。満タン後も上式の名目容量を維持する楽観的なモデルとして採用し、実回復とは表示しません。[定量community報告](https://www.reddit.com/r/MinecraftDungeons/comments/wmbi04/)には名目値より小さい回復やHPが満タンに近い場合の低下もあり、吸収遅延・overhealとともに未再現です。

`HealingMetrics.animaHealingCapacityPerSecond`を独立表示し、既存`totalPerSecond`とhealing utilityへ加えます。従って生存能力を過大評価する可能性があります。満タン時の挙動を確認する際はSoul meterの満タンとhealthの満タンを別条件として測定してください。

## Enigma Resonator — research-only

[metadata](https://www.dungeons.tools/enchantments/enigma-resonator)の最大15/20/25%、3x、Soul gear限定、non-stackableは保持。Criticalとの別roll・同時9xはmediumの説明根拠です。発動率pが判明した場合には`(1+2p) × Critical expectation`で、満タン時のp=.25ならCritical IIIと`1.5×1.4=2.1`。単一45%の3xとして合算しません。

**未確認の点:**

1. 1.17.0.0のSoul→chance関数そのもの。
2. 中間ゲージの測定数と発動数（線形を裏付けるデータ）。
3. 絶対300を閾値とするか、容量に対する割合か。
4. [2020年の100 souls cap報告](https://www.reddit.com/r/MinecraftDungeons/comments/h09uq1/)と、[2025年の割合説／Bag of Souls不具合報告](https://www.reddit.com/r/MinecraftDungeons/comments/1kp257u/)のversion整合。

[2024年の割合説](https://www.reddit.com/r/MinecraftDungeons/comments/1drch1j/)もありますが、複数の「fullness」記述だけでは線形性を確定できません。`p(t)=pMax×soulFraction(t)`は研究候補の式に留め、固定12.5%や0点placeholderを実装しません。容量変更防具も未対応です。

## Direct境界・resolver

現在のdirect pipelineはbase × Sharpness × Critical × Void × Unchanting × Smiting × Ambush × Artifact Synergy → preCommitted direct → Committed trajectory → final direct。Soul Siphon / Animaはdamage multiplierを加えず、Shockwave / Swirling / Thunderingのdamageを変えません。

`resolveOffensiveSteadyState()`の各評価で、Rampaging uptime → speed → HPS → direct/proc/Committed → DPS → CombatState → Soul Siphon / normal Soul income → Soul trajectoryを導出します。同じ評価の状態だけを返すため、最終HPS・撃破率・pickup・meterが一致します。Rampagingの固定点は許容1e-8、上限100回、非finite・非収束は明示エラー。

Enigmaが未対応なのでSoul→DPSの逆向き依存はなく、新しい独立固定点やnested recursionは不要です。Rampagingなしなら1回評価、SoulなしならSoulStateを作りません。将来Enigmaを入れる際は同じresolverの未知数を拡張し、direct multiplierをCommitted前へ入れ、procには掛けず、kill/Soul/Enigmaを同時に整合させる必要があります。

Anima / Siphon / RampagingやCritical / Committed / Artifact Synergyのremoval contributionは`calculateCore()`を通じて全再計算します。Worker・full discrete simulatorは追加していません。

### 固定点例（モデル出力、実測ではない）

Soul Scythe表示damage26、Soul Siphon III + Anima III + Rampaging III、Artifactなし、最大HP100、敵HP100、供給100/s、directKillShare=1、1 target、30秒。

| 値 | 初期u=0 | 初回更新 | 収束 |
| --- | ---: | ---: | ---: |
| Rampaging uptime | 0 | 0.527633447 | 0.626543526 |
| attack speed | 1 | 1.263816724 | 1.313271763 |
| HPS | 1.923076923 | 2.430416776 | 2.525522621 |
| DPS | 50 | 63.190836181 | 65.663588158 |
| kill/s（通常pickup/s） | 0.5 | 0.631908362 | 0.656635882 |
| resource/s | 7.269230769 | 9.186975414 | 9.546475509 |
| 平均Soul割合 | 0.363461538 | 0.459348771 | 0.477323775 |

11回、残差1.80125e-9。最終Siphon proc0.505104524/s、Siphon pickup2.525522621/s、合計pickup3.182158503/s。Gathering=3、容量300、spending=0、満タンまで31.425210248秒、終了割合0.954647551、Anima capacity19.092951018/s。Enigma chanceは未計算（0%を代入した意味ではありません）。

## 次batchの比較

| 候補 | 追加基盤・リスク | 推奨 |
| --- | --- | --- |
| A: Chains / Stunning / Freezing / Gravity | CC uptime、敵耐性、配置、行動阻害のutility objectiveが必要。架空DPS/DRへの換算不可 | 4種だが評価目的の設計から始める |
| B: Pain Cycle / Dynamo / Busy Bee | self damage、roll stacks、summon lifetime/cap/targetingという別々の状態が必要 | 後続へ |
| C: Fire Aspect / Poison Cloud / Exploding | 既存DamageEventを再利用。DoT tick/refresh/重複、Power曲線、kill attributionの調査が必要 | **次batchに推奨**。まず研究監査し、根拠の揃うeffectだけ追加 |

Enigmaの不足測定が得られた場合はPhase 2-1Gの解消を優先できます。今回、Cの3種やSoul消費Artifact、Soul Healer、Beacon、Harvester、Lightning Rod、Torment Quiver、Bag of Souls、Soul Focus / Speed、armor、rangedは実装していません。

## 検証

`npm run audit:soul`をCIに追加。Soul監査のschema、claim出典、scope gate、Tier、既存auditとの整合、coverageを検証します。振る舞いテストは合法性（通常・金色・候補・lock・保存・JSON・Optimizer）、ゼロ/途中/満タン、overflow、resource/pickup分離、AoE限定、gathering、回復容量、resolverとremoval contributionを対象にします。既存damage-events / temporal-enchants / enchants / dps / meleeのaudit、全test、tsc、lint、buildも実行します。
