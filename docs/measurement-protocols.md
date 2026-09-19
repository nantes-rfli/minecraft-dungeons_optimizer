# Phase 5 Measurement Protocols

[構造化protocol](../research/workflow/measurement-protocols.json) / [Gap Map](evidence-gap-map.md)

ゲーム内で結果を集める前の再利用可能な手順です。各protocolはbaseline、必要なvariant、反復、記録項目、close条件を定義し、結果やruntime昇格を含みません。

## OBS-RANGED-CARD — 遠距離カード・可視property観測

**何を調べる？** projectile count・burst・spread・max copies

**なぜ必要？** Source HarvestのGapを再現可能な観測または実験で解決する。測定結果そのものは含まない。

**対象:** ranged-weapon / ranged-enchantment — projectileCount, burstCount, spread, maxCopies

**所要時間:** 1〜5分

### 必要な装備

- 対象装備と比較用の同family装備。

### 準備

- Inventoryと装備カードを開き、Power・rarity・built-inを同時に確認する。

### 手順

1. 対象entity・版・Powerと全modifierを記録する。
2. 同じ条件でbaselineを取得する。
3. raw記録から指定fieldを転記し、除外runと理由を残す。
4. 必要回数とclose条件を満たすか確認する。


### 記録項目

- 表示projectile/burst/spread、copy上限、画面名、screenshot参照。
- game versionと確度、platform、difficulty、記録日時
- entity ID、Power、全装備・Enchant・Artifactとmodifier
- 未編集のscreenshot/video、frame rate、timestamps、run ID、除外runと理由

### 必要回数

同一版・同一装備を1回確認し、表示が条件で変わる場合は各条件を追加確認する。

### 成功条件

- 対象ID・版・表示値を含むscreenshotでpropertyを一意に読める。

### 失敗しやすい点

- 版・装備ID・Powerが不明、tooltipの推測、別familyからの転記。

## OBS-CURRENT-MECHANIC — 現行版mechanic観測

**何を調べる？** 現行版のtrigger・state requirement・visible behavior

**なぜ必要？** Source HarvestのGapを再現可能な観測または実験で解決する。測定結果そのものは含まない。

**対象:** melee-enchantment / armor-enchantment — currentVersionGameplayVerification, stateRequirement

**所要時間:** 1〜5分

### 必要な装備

- 対象Enchantを単独装着できる装備。

### 準備

- 発動前後が見える安全な固定条件。

### 手順

1. 対象entity・版・Powerと全modifierを記録する。
2. 同じ条件でbaselineを取得する。
3. raw記録から指定fieldを転記し、除外runと理由を残す。
4. 必要回数とclose条件を満たすか確認する。


### 記録項目

- 発動アイコン、必要state、対象、表示文、screenshot/video timestamp。
- game versionと確度、platform、difficulty、記録日時
- entity ID、Power、全装備・Enchant・Artifactとmodifier
- 未編集のscreenshot/video、frame rate、timestamps、run ID、除外runと理由

### 必要回数

表示だけなら1確認、発動確認を含む場合は3回。

### 成功条件

- 必要stateと可視挙動を対象IDへ帰属できる。

### 失敗しやすい点

- 複数候補を同時装着し帰属不能、旧版映像。

## OBS-ARTIFACT-BEHAVIOR — Artifact挙動観測

**何を調べる？** target count・ammo・soul・可視挙動

**なぜ必要？** Source HarvestのGapを再現可能な観測または実験で解決する。測定結果そのものは含まない。

**対象:** artifact — mechanicGap.*

**所要時間:** 1〜5分

### 必要な装備

- 対象Artifact、効果を混同しないneutral装備。

### 準備

- 単体と必要時のみ複数target。

### 手順

1. 対象entity・版・Powerと全modifierを記録する。
2. 同じ条件でbaselineを取得する。
3. raw記録から指定fieldを転記し、除外runと理由を残す。
4. 必要回数とclose条件を満たすか確認する。


### 記録項目

- 対象数、生成物、消費resource、可視status、screenshot/video。
- game versionと確度、platform、difficulty、記録日時
- entity ID、Power、全装備・Enchant・Artifactとmodifier
- 未編集のscreenshot/video、frame rate、timestamps、run ID、除外runと理由

### 必要回数

同条件で3回、ランダム選択が見える場合は結果が安定するまで追加。

### 成功条件

- 対象Artifactだけに帰属できる可視ルールを記録する。

### 失敗しやすい点

- 別Artifact/Enchant混入、target数やSoul残量不明。

## MEAS-RANGED-SHOT-CYCLE — 遠距離発射cycle測定

**何を調べる？** charge・shot・recovery・shots per second

**なぜ必要？** Source HarvestのGapを再現可能な観測または実験で解決する。測定結果そのものは含まない。

**対象:** ranged-weapon — chargeTimeSeconds, recoverySeconds, shotsPerSecond

**所要時間:** 5〜15分

### 必要な装備

- attack speed modifier・関連Artifact・Enchantなし、通常矢。

### 準備

- 固定距離で連続発射し、N shotを録画する。

### 手順

1. 対象entity・版・Powerと全modifierを記録する。
2. 同じ条件でbaselineを取得する。
3. raw記録から指定fieldを転記し、除外runと理由を残す。
4. 必要回数とclose条件を満たすか確認する。


### 記録項目

- 最初と最後の発射frame、shots、elapsed time、charge/recovery境界、計算cycle。
- game versionと確度、platform、difficulty、記録日時
- entity ID、Power、全装備・Enchant・Artifactとmodifier
- 未編集のscreenshot/video、frame rate、timestamps、run ID、除外runと理由

### 必要回数

3 series以上、各series 20射以上。BowとCrossbowを別runにする。

### 成功条件

- 平均cycleをraw frameから再計算でき、chargeとrecoveryを分離できる。

### 失敗しやすい点

- 入力遅延・特殊矢・speed modifier混入、shotとprojectileの混同。

既存protocolの再利用: ranged-cadence をcanonical手順へ統合。旧IDはmappingとして保持します。

## MEAS-MELEE-ATTACK-SCALING — 近接attack speed測定

**何を調べる？** attackSpeedScaling

**なぜ必要？** Source HarvestのGapを再現可能な観測または実験で解決する。測定結果そのものは含まない。

**対象:** melee-weapon — attackSpeedScaling

**所要時間:** 5〜15分

### 必要な装備

- 対象武器、attack speed modifierなしのbaselineと既知modifier条件。

### 準備

- 同じtargetへ完全comboを連続実行。

### 手順

1. 対象entity・版・Powerと全modifierを記録する。
2. 同じ条件でbaselineを取得する。
3. raw記録から指定fieldを転記し、除外runと理由を残す。
4. 必要回数とclose条件を満たすか確認する。


### 記録項目

- 各hit frame、combo開始/終了、modifier、combo数、elapsed time。
- game versionと確度、platform、difficulty、記録日時
- entity ID、Power、全装備・Enchant・Artifactとmodifier
- 未編集のscreenshot/video、frame rate、timestamps、run ID、除外runと理由

### 必要回数

baselineと各variantで3 run以上、各run 10 combo以上。

### 成功条件

- baseline比と各hit intervalを独立runで再現できる。

### 失敗しやすい点

- 空振り、combo中断、未知modifier、異なる武器family混在。

## MEAS-ENCHANT-TIMING — Enchant時間測定

**何を調べる？** duration・cooldown・tick interval

**なぜ必要？** Source HarvestのGapを再現可能な観測または実験で解決する。測定結果そのものは含まない。

**対象:** melee-enchantment / armor-enchantment — duration, cooldown

**所要時間:** 5〜15分

### 必要な装備

- 対象Enchantを単独装着、Tier/copy/Gildedを固定。

### 準備

- trigger前のbaselineから発動・失効・再発動を録画。

### 手順

1. 対象entity・版・Powerと全modifierを記録する。
2. 同じ条件でbaselineを取得する。
3. raw記録から指定fieldを転記し、除外runと理由を残す。
4. 必要回数とclose条件を満たすか確認する。


### 記録項目

- trigger/effect end/再使用可能frame、各interval、Tier、失敗trigger。
- game versionと確度、platform、difficulty、記録日時
- entity ID、Power、全装備・Enchant・Artifactとmodifier
- 未編集のscreenshot/video、frame rate、timestamps、run ID、除外runと理由

### 必要回数

各Tier/条件で3独立run、各run 5周期以上。

### 成功条件

- 開始点と終了点を定義し、全intervalをraw timestampから再計算できる。

### 失敗しやすい点

- 別cooldown/duration modifier混入、発動失敗を周期へ算入。

## MEAS-ENCHANT-PROC — Enchant発動率測定

**何を調べる？** proc chance

**なぜ必要？** Source HarvestのGapを再現可能な観測または実験で解決する。測定結果そのものは含まない。

**対象:** melee-enchantment / armor-enchantment — procChance

**所要時間:** 15〜30分

### 必要な装備

- 対象Enchant単独、Tier/copy/Gilded固定。

### 準備

- 同じ有効triggerを反復し、無効trialを分離する。

### 手順

1. 対象entity・版・Powerと全modifierを記録する。
2. 同じ条件でbaselineを取得する。
3. raw記録から指定fieldを転記し、除外runと理由を残す。
4. 必要回数とclose条件を満たすか確認する。


### 記録項目

- eligible trials、proc count、非proc count、除外理由、推定率と区間。
- game versionと確度、platform、difficulty、記録日時
- entity ID、Power、全装備・Enchant・Artifactとmodifier
- 未編集のscreenshot/video、frame rate、timestamps、run ID、除外runと理由

### 必要回数

3 run以上、合計100 eligible trials以上。rare procは必要に応じ追加する。

### 成功条件

- trial母数とproc帰属が再計算可能で、run間のばらつきを報告する。

### 失敗しやすい点

- eligibleでないhitを母数化、複数proc source、成功例だけの記録。

## MEAS-ARTIFACT-TIMING — Artifact timing測定

**何を調べる？** delay・cadence・lifetime・tick

**なぜ必要？** Source HarvestのGapを再現可能な観測または実験で解決する。測定結果そのものは含まない。

**対象:** artifact — mechanicGap.*

**所要時間:** 5〜15分

### 必要な装備

- 対象Artifact、timing modifierなし。

### 準備

- 開始・tick・終了を識別できる固定条件で録画。

### 手順

1. 対象entity・版・Powerと全modifierを記録する。
2. 同じ条件でbaselineを取得する。
3. raw記録から指定fieldを転記し、除外runと理由を残す。
4. 必要回数とclose条件を満たすか確認する。


### 記録項目

- 入力/発動/tick/終了frame、周期数、elapsed time、resource消費。
- game versionと確度、platform、difficulty、記録日時
- entity ID、Power、全装備・Enchant・Artifactとmodifier
- 未編集のscreenshot/video、frame rate、timestamps、run ID、除外runと理由

### 必要回数

各条件3 run以上、周期効果は各run 10 interval以上。

### 成功条件

- 全timestampとevent定義からtimingを再計算できる。

### 失敗しやすい点

- lag・入力遅延・別status更新・画面外event。

## EXP-POWER-SCALING — 装備Power scaling比較

**何を調べる？** damage・health Power curve

**なぜ必要？** Source HarvestのGapを再現可能な観測または実験で解決する。測定結果そのものは含まない。

**対象:** melee-weapon / armor — powerScaling, healthPowerCurve

**所要時間:** 30〜60分

### 必要な装備

- 同一familyの複数Power、他modifierなし。

### 準備

- baseline Powerと低・中・高Power variantを同じ条件で比較。

### 手順

1. 対象entity・版・Powerと全modifierを記録する。
2. 同じ条件でbaselineを取得する。
3. 指定variantを1条件ずつ変更して取得する。
4. raw記録から指定fieldを転記し、除外runと理由を残す。
5. 必要回数とclose条件を満たすか確認する。
6. Control: 同一entity/family・difficulty・target・modifier。

### 記録項目

- Power、card/observed値、raw hit/health、候補curve残差。
- game versionと確度、platform、difficulty、記録日時
- entity ID、Power、全装備・Enchant・Artifactとmodifier
- 未編集のscreenshot/video、frame rate、timestamps、run ID、除外runと理由

### 必要回数

各Powerで3 run以上、最低5 Power anchor。

### 成功条件

- hold-out Powerを含め、支持範囲と外挿禁止境界を明記する。

### 失敗しやすい点

- 別family混在、card値を内部式と断定、版不明sample。

### 仮説

- 単一curve
- family固有curve
- band/roundingあり

## EXP-RANGED-PROJECTILE-DISTRIBUTION — Projectile damage配分実験

**何を調べる？** neutral projectile damage distribution

**なぜ必要？** Source HarvestのGapを再現可能な観測または実験で解決する。測定結果そのものは含まない。

**対象:** ranged-weapon — neutralProjectileDamageDistribution

**所要時間:** 15〜30分

### 必要な装備

- 対象武器、Enchantなし、通常矢。

### 準備

- 単体baseline、十分離した複数target、重なった複数target。

### 手順

1. 対象entity・版・Powerと全modifierを記録する。
2. 同じ条件でbaselineを取得する。
3. 指定variantを1条件ずつ変更して取得する。
4. raw記録から指定fieldを転記し、除外runと理由を残す。
5. 必要回数とclose条件を満たすか確認する。
6. Control: 同一Power・距離・target armor/DR。

### 記録項目

- 1入力のprojectile数、各projectile/target damage、total damage、ammo。
- game versionと確度、platform、difficulty、記録日時
- entity ID、Power、全装備・Enchant・Artifactとmodifier
- 未編集のscreenshot/video、frame rate、timestamps、run ID、除外runと理由

### 必要回数

baselineと各variantで3 run以上、各run 20入力。

### 成功条件

- projectileとtargetの帰属を追跡し、card値の単位を一意にする。

### 失敗しやすい点

- proc/爆発/特殊矢混入、missを0 damage projectileと混同。

### 仮説

- card値は1 projectile
- card値は全projectile合計
- projectileごとに非均等配分

既存protocolの再利用: ranged-projectiles をcanonical手順へ統合。旧IDはmappingとして保持します。

## EXP-RANGED-PROC-OWNERSHIP — 遠距離Proc帰属実験

**何を調べる？** per-shot・per-projectile・per-hit ownership

**なぜ必要？** Source HarvestのGapを再現可能な観測または実験で解決する。測定結果そのものは含まない。

**対象:** ranged-weapon / ranged-enchantment — procOwnership, triggerOwnership

**所要時間:** 15〜30分

### 必要な装備

- 単発武器とmulti-projectile武器、対象Enchant単独。

### 準備

- baseline 0 copy、1 copy、必要なら2 copyを同じtarget条件で比較。

### 手順

1. 対象entity・版・Powerと全modifierを記録する。
2. 同じ条件でbaselineを取得する。
3. 指定variantを1条件ずつ変更して取得する。
4. raw記録から指定fieldを転記し、除外runと理由を残す。
5. 必要回数とclose条件を満たすか確認する。
6. Control: 同一Power・target・距離・Tier。

### 記録項目

- shots、projectiles、hits、eligible trials、proc、kill attribution。
- game versionと確度、platform、difficulty、記録日時
- entity ID、Power、全装備・Enchant・Artifactとmodifier
- 未編集のscreenshot/video、frame rate、timestamps、run ID、除外runと理由

### 必要回数

各条件3 run以上、合計100 eligible units以上。

### 成功条件

- どの母数で率が安定するかを独立runで再現する。

### 失敗しやすい点

- shot/projectile/hitの混同、複数proc source。

### 仮説

- per-shot
- per-projectile
- per-hit

既存protocolの再利用: ranged-interactions をcanonical手順へ統合。旧IDはmappingとして保持します。

## EXP-RANGED-MECHANIC — 遠距離mechanic比較実験

**何を調べる？** ammo・charge interaction

**なぜ必要？** Source HarvestのGapを再現可能な観測または実験で解決する。測定結果そのものは含まない。

**対象:** ranged-enchantment — ammoChargeInteractions

**所要時間:** 15〜30分

### 必要な装備

- 対象EnchantとBow/Crossbow各1、通常矢。

### 準備

- 0 copy baselineと1 copy、未charge/partial/full chargeを比較。

### 手順

1. 対象entity・版・Powerと全modifierを記録する。
2. 同じ条件でbaselineを取得する。
3. 指定variantを1条件ずつ変更して取得する。
4. raw記録から指定fieldを転記し、除外runと理由を残す。
5. 必要回数とclose条件を満たすか確認する。
6. Control: 同一Power・target・距離。

### 記録項目

- ammo消費、charge段階、projectile、damage、proc。
- game versionと確度、platform、difficulty、記録日時
- entity ID、Power、全装備・Enchant・Artifactとmodifier
- 未編集のscreenshot/video、frame rate、timestamps、run ID、除外runと理由

### 必要回数

各baseline/variantで3 run以上、各run 20入力。

### 成功条件

- ammoとchargeの影響を別々に識別する。

### 失敗しやすい点

- 特殊矢・別ammo効果・入力失敗。

### 仮説

- ammo単位
- shot単位
- charge段階依存

## EXP-ENCHANT-POWER — Enchant Power依存実験

**何を調べる？** absolute outputのPower依存

**なぜ必要？** Source HarvestのGapを再現可能な観測または実験で解決する。測定結果そのものは含まない。

**対象:** melee-enchantment / armor-enchantment — powerDependence

**所要時間:** 30〜60分

### 必要な装備

- 同一Enchant/Tierを持つ複数Power装備。

### 準備

- 同じtarget・triggerでPowerだけを変える。

### 手順

1. 対象entity・版・Powerと全modifierを記録する。
2. 同じ条件でbaselineを取得する。
3. 指定variantを1条件ずつ変更して取得する。
4. raw記録から指定fieldを転記し、除外runと理由を残す。
5. 必要回数とclose条件を満たすか確認する。
6. Control: 同一Tier・target・difficulty・他modifier。

### 記録項目

- Power、Tier、raw output、baseline、ratio、rounding。
- game versionと確度、platform、difficulty、記録日時
- entity ID、Power、全装備・Enchant・Artifactとmodifier
- 未編集のscreenshot/video、frame rate、timestamps、run ID、除外runと理由

### 必要回数

最低5 Power anchor、各Power 3 run以上。

### 成功条件

- hold-out Powerを含め依存有無と適用範囲を示す。

### 失敗しやすい点

- TierとPowerを同時変更、別damage source混入。

### 仮説

- Power非依存
- 装備Power依存
- 別Power curve依存

## EXP-ARTIFACT-INTERACTION — Artifact相互作用・stacking実験

**何を調べる？** stacking・targeting・ownership・overlap

**なぜ必要？** Source HarvestのGapを再現可能な観測または実験で解決する。測定結果そのものは含まない。

**対象:** artifact — stacking, interactions, mechanicGap.*

**所要時間:** 15〜30分

### 必要な装備

- 対象Artifact 1個/複数copy、比較対象効果。

### 準備

- 0 copy baseline、1 copy、2 copy、順序入替を同じ条件で比較。

### 手順

1. 対象entity・版・Powerと全modifierを記録する。
2. 同じ条件でbaselineを取得する。
3. 指定variantを1条件ずつ変更して取得する。
4. raw記録から指定fieldを転記し、除外runと理由を残す。
5. 必要回数とclose条件を満たすか確認する。
6. Control: 同一Power・target・difficulty・buff。

### 記録項目

- 各source単独値、pair結果、発動順、target、owner、overlap window。
- game versionと確度、platform、difficulty、記録日時
- entity ID、Power、全装備・Enchant・Artifactとmodifier
- 未編集のscreenshot/video、frame rate、timestamps、run ID、除外runと理由

### 必要回数

baselineと各variantで3独立run以上。確率挙動は100 eligible trials以上。

### 成功条件

- 単独baselineからpairを説明し、target/owner/refresh規則を分離する。

### 失敗しやすい点

- 単独値なし、Powerやtargetを同時変更、kill帰属不明。

### 仮説

- 加算
- 乗算
- 上限
- 更新
- stackしない

---

# Measurement protocols

Generated by `npm run generate:evidence-coverage`. [構造化protocol](../research/workflow/measurement-protocols.json) / [Coverage](combined-evidence-coverage.md)

実験定義のみ。測定済みの結果・投稿受付・自動的なruntime昇格は含みません。compositionの反復数は新しいprotocol設計上の最低条件です。

## phase-1-dps-regression

observed card damageを固定し、Power curve誤差を混ぜず独立DPSと比較する。

対象: dps-regression / end-to-end single-target DPS。要求version: 1.17.0.0

### Equipment

- runtime対応武器、observedDamagePerHit、attack speed modifier
- 関連する全Enchant/Artifact。なしの場合も空配列を記録する。

### Scenario

- single-target固定、target armor/DR既知、難易度・位置・バフ状態を固定

### Observations

- 対応武器と表示damage（`observedDamagePerHit`）
- attack speed modifier
- 関連する全EnchantとArtifact（何もない場合は空配列）
- measurement durationとtotal damage、または直接reported DPS
- single-target条件とtarget armor / damage reduction
- game versionとその確度
- 公開sourceと、観測値の導出手順
- `complete`な再現性

### Acceptance

- 対応武器と表示damage（`observedDamagePerHit`）
- attack speed modifier
- 関連する全EnchantとArtifact（何もない場合は空配列）
- measurement durationとtotal damage、または直接reported DPS
- single-target条件とtarget armor / damage reduction
- game versionとその確度
- 公開sourceと、観測値の導出手順
- `complete`な再現性

### Submission metadata

- game versionと確度、platform、difficulty、記録日時
- 全装備のID・Power・表示値・全EnchantのTier/copy/slot/Gilded・全Artifact
- 公開source URL、未編集raw記録、frame rate/timestamps、観測の導出手順、run ID
- 対象とarmor/DR、scenario、発動順、除外runと理由、計測分解能

### Invalidating conditions

- runtime model output
- dungeons.tools calculator output
- Wiki理論damage表だけから合成したDPS
- 既存Attack Profile・Void Strike curve・Power Curveから計算したDPS
- 定性的な強弱評価
- mobbing / target switching footage
- Power・Attack timing・Void Strike timingだけのcomponent validation

反復: 1 run = 1 observation。同一動画の連続frameや再掲は独立sampleではない。必要総数はCoverageのDPS minimumSamplesを参照。

backlog:dps-regression: 独立public run-levelのdamage・duration・完全build・target・versionが再現可能な5件。[gate](model-regression.md)

Sources: [docs/model-regression.md#eligibility](../docs/model-regression.md) / [research/dps-regression-audit.json#/eligibilityPolicy](../research/dps-regression-audit.json) / [src/research/dpsRegressionAudit.ts](../src/research/dpsRegressionAudit.ts)

## cooldown-composition

source別の単独値と組合せtraceを取得し、合成式・起点・丸めを識別する。

対象: armor / armor-enchantment / artifact / intrinsic・Cool Down・external cooldown合成。要求version: 1.17.0.0

### Equipment

- 同一Artifact ID・Power・表示cooldownを固定。即時使用型と持続型を別実験にする。
- Armorなし / Battle Robe単独 / Cool Down各Tier単独 / Battle Robe + Cool Downを対にする。
- Cool Down 1〜4 copyはTierとslot/Gildedを個別記録。external sourceは名称・強度・持続を記録し、単独・pair・複合条件を別runにする。

### Scenario

- 敵・kill・Soul消費・他cooldown効果を除外または一定にする。
- 各runの開始時に全cooldownを回復。発動順とeffect endを固定・記録する。

### Observations

- 入力受付、発動、effect end、再使用可能、次回入力受付のframe/timestamp
- 各条件の全interval、使用回数とtotal duration、失敗入力・遅延・FPS

### Acceptance

- 同条件baselineと全source単独を併記し、pair・複合で再現する。
- frame分解能・分布・開始点差を明示し、候補式は全anchorを説明するまで採用しない。
- 37% / 38%表示差とhistorical anchorを別に保持し、現在版の答えへ混ぜない。

### Submission metadata

- game versionと確度、platform、difficulty、記録日時
- 全装備のID・Power・表示値・全EnchantのTier/copy/slot/Gilded・全Artifact
- 公開source URL、未編集raw記録、frame rate/timestamps、観測の導出手順、run ID
- 対象とarmor/DR、scenario、発動順、除外runと理由、計測分解能

### Invalidating conditions

- 未知のexternal cooldown・Refreshment等が混入
- 入力遅延をcooldownとして計測
- 版・Tier・Power混在、連続区間を独立runとして分割

反復: 各単独/pair条件で独立3 run以上、各runで10 cooldown周期以上。protocol設計上の最低条件であり測定済み件数ではない。

backlog:armor-cooldown: current internal式または再現可能なcooldown trace

Sources: [research/runtime/armor-core-runtime-audit.json#/decisions/artifactCooldownComposition](../research/runtime/armor-core-runtime-audit.json) / [research/armor-expansion-state-enchant-audit.json#/cooldownStacking](../research/armor-expansion-state-enchant-audit.json)

## damage-reduction-composition

一定のincoming hitを使い、被ダメージ軽減のfamily・順序・重複を識別する。

対象: armor / armor-enchantment / melee-enchantment / artifact / Armor DR・Protection・Potion Barrier・Iron Hide・Guarding・Weakening合成。要求version: 1.17.0.0

### Equipment

- Armor DRなしbaselineと35% Armor、Protection各Tier、Potion Barrier各Tier、Iron Hide、Guarding Strike、Weakeningを個別記録。
- 単独、各pair、主要複合を別runにし、装着slot/Gilded、copy、発動順を記録。

### Scenario

- 同じ敵種・難易度・attack channel・距離を固定。敵の装備やbuffも記録。
- HPをhit前後に読める状態とし、回復・吸収・回避・Chilling・無敵等を除外。
- Weakeningは攻撃した敵へのdebuff、Guardingはkill trigger、Potion Barrierはpotion後のactive windowを確認。

### Observations

- 各hitのHP前後、raw incoming damage baseline、発動/失効frame、敵debuff状態
- 非発動・単独・pair・複合のdamage sequenceと同時active window
- 表示丸め、damage channel、proc/無効hitとその理由

### Acceptance

- 全source単独baselineからpairの差を再現し、順序を入れ替えて比較。
- 瞬間DRと時間平均uptimeを分離。rounding・分散を説明できるまで一般式を確定しない。
- 対象・版・Tier・damage channelが一致するraw traceだけを検証へ採用。

### Submission metadata

- game versionと確度、platform、difficulty、記録日時
- 全装備のID・Power・表示値・全EnchantのTier/copy/slot/Gilded・全Artifact
- 公開source URL、未編集raw記録、frame rate/timestamps、観測の導出手順、run ID
- 対象とarmor/DR、scenario、発動順、除外runと理由、計測分解能

### Invalidating conditions

- HP回復やabsorptionをDRに含める
- active window外、攻撃者のWeakening状態不明、違うdamage channelを混ぜる
- 既存モデル出力や過去版の率だけを観測結果として使用

反復: 条件ごと独立3 run以上、各runのactive window内で10有効hit以上を確保。windowを跨ぐ場合は再発動を明示する。

backlog:armor-dr: current traceで各family/orderを検証

Sources: [research/runtime/armor-core-runtime-audit.json#/decisions/damageReductionComposition](../research/runtime/armor-core-runtime-audit.json) / [research/armor-expansion-state-enchant-audit.json#/armorEnchantments](../research/armor-expansion-state-enchant-audit.json) / [docs/armor-runtime-batch.md](../docs/armor-runtime-batch.md)

## ranged-cadence

現行版の不足Evidenceを実測で解決する。測定済み結果は含まない。

対象: ranged / shot / charge / recovery and direct DPS。要求version: 1.17.0.0

### Equipment

- BowとCrossbowを別runにする。全Power・neutral projectile card/observed damage・Enchantなし・通常矢。

### Scenario

- 固定難易度・同じ敵・既知のarmor/DR・固定距離・単体baseline。外部buff/特殊矢/partyなし。

### Observations

- charge開始/発射/recovery終了frame、damage/矢消費、全shot間隔、total durationとtotal damage、観測値と予測値の差

### Acceptance

- neutral damageと完全周期からの有限shot予測を独立hold-out runで比較。charge/recoveryを混ぜない。

### Submission metadata

- game versionと確度、platform、difficulty、記録日時
- 全装備のID・Power・表示値・全EnchantのTier/copy/slot/Gilded・全Artifact
- 公開source URL、未編集raw記録、frame rate/timestamps、観測の導出手順、run ID
- 対象とarmor/DR、scenario、発動順、除外runと理由、計測分解能

### Invalidating conditions

- 版/装備/全Enchant/targetが不明
- Strengthや特殊矢が混入、shotとprojectileの混同、未知DR
- 予測値を観測値として投稿、連続frameを独立runへ水増し

反復: 各条件で3独立run以上、各run最低20射。proc確率は全trial数と分散を報告し、20射だけで確定しない。

backlog:ranged-cadence: 1.17.0.0で装備/neutral card/shot mode/全frame/矢数が揃う複数archetype各3独立run。chargeとrecoveryを別に確認。

Sources: [docs/ranged-runtime.md](../docs/ranged-runtime.md) / [research/ranged-weapon-audit.json](../research/ranged-weapon-audit.json) / [research/ranged-enchantment-audit.json](../research/ranged-enchantment-audit.json)

## ranged-projectiles

現行版の不足Evidenceを実測で解決する。測定済み結果は含まない。

対象: ranged / projectile distribution / ammo。要求version: 1.17.0.0

### Equipment

- Scatter・Burst・Exploding familyを別実験にする。baseとuniqueはpaired run。Enchantなし。

### Scenario

- 固定難易度・同じ敵・既知のarmor/DR・固定距離・単体baseline。外部buff/特殊矢/partyなし。

### Observations

- 1入力ごとのprojectile数、各targetへのdamage列、burst各射timestamp、消費ammo、直撃/爆発/跳弾を識別した映像

### Acceptance

- card値が1矢/全矢/chargeのどれかを識別。各projectileとtargetの帰属が追えるまでDPSへ昇格しない。

### Submission metadata

- game versionと確度、platform、difficulty、記録日時
- 全装備のID・Power・表示値・全EnchantのTier/copy/slot/Gilded・全Artifact
- 公開source URL、未編集raw記録、frame rate/timestamps、観測の導出手順、run ID
- 対象とarmor/DR、scenario、発動順、除外runと理由、計測分解能

### Invalidating conditions

- 版/装備/全Enchant/targetが不明
- Strengthや特殊矢が混入、shotとprojectileの混同、未知DR
- 予測値を観測値として投稿、連続frameを独立runへ水増し

反復: 各条件で3独立run以上、各run最低20射。proc確率は全trial数と分散を報告し、20射だけで確定しない。

backlog:ranged-projectiles: Scatter/Burst/Exploding等で1入力→射数→projectile→target damage→ammoを分離した現行版raw traceと実装。

Sources: [docs/ranged-runtime.md](../docs/ranged-runtime.md) / [research/ranged-weapon-audit.json](../research/ranged-weapon-audit.json) / [research/ranged-enchantment-audit.json](../research/ranged-enchantment-audit.json)

## ranged-interactions

現行版の不足Evidenceを実測で解決する。測定済み結果は含まない。

対象: ranged / proc attribution / ranged Armor modifiers。要求version: 1.17.0.0

### Equipment

- 同一Bow/Crossbow、Power/Critical/Unchanting単独とpair、別runでranged Armor/aura/Cowardiceを比較。

### Scenario

- 固定難易度・同じ敵・既知のarmor/DR・固定距離・単体baseline。外部buff/特殊矢/partyなし。

### Observations

- neutral baseline、単独/pairのdamage列、proc発動/非発動、直接/間接の最終撃破、HP状態、Tier/Gilded、敵種類

### Acceptance

- meleeとrangedの同名Enchant値を別に記録。単独→pairのstackingとkill帰属が独立再現するまで共有しない。

### Submission metadata

- game versionと確度、platform、difficulty、記録日時
- 全装備のID・Power・表示値・全EnchantのTier/copy/slot/Gilded・全Artifact
- 公開source URL、未編集raw記録、frame rate/timestamps、観測の導出手順、run ID
- 対象とarmor/DR、scenario、発動順、除外runと理由、計測分解能

### Invalidating conditions

- 版/装備/全Enchant/targetが不明
- Strengthや特殊矢が混入、shotとprojectileの混同、未知DR
- 予測値を観測値として投稿、連続frameを独立runへ水増し

反復: 各条件で3独立run以上、各run最低20射。proc確率は全trial数と分散を報告し、20射だけで確定しない。

backlog:ranged-interactions: baseline・単独・pairを比較した1.17.0.0のchannel別damage/proc/kill帰属、stacking、Tier/sourceの独立trace。

Sources: [docs/ranged-runtime.md](../docs/ranged-runtime.md) / [research/ranged-weapon-audit.json](../research/ranged-weapon-audit.json) / [research/ranged-enchantment-audit.json](../research/ranged-enchantment-audit.json)
