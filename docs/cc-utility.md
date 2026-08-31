# Phase 2-1I — Control utility（partial）

対象は Minecraft Dungeons 1.17.0.0。Chains / Stunning / Freezing / Gravity を近接runtimeへ追加。
catalog 26/33、広域Power 21/33、Power限定damage enchant 5、research-only 7、needs-state-model 5。
Chainsの複数copyとCCの実測不足を残すため、Phase全体はpartial。既存partialは解決した扱いにしない。

## 設計判断: CCを第4軸にする

CCは敵の行動・位置の状態であり、そのままDPS、回復、被ダメージ削減率にはならない。
敵のanimation、既に開始した攻撃、projectile、免疫、移動、target densityを再現していないため、
DefenseMetrics・DamageMetrics・HealingMetricsへCCを変換しない。

`ControlMetrics` の最終schema:

```ts
interface ControlMetrics {
  hardDisableCoverage: number
  attackSlowEquivalentCoverage: number
  rootCoverage: number
  groupingCoverage: number
  stunning?: StunningState
  freezing?: FreezingState
  chains?: ChainsState
  gravity?: GravityState
  utility: number
}
```

4つのraw値とutilityは0〜1。Stunningはモデル対象1体の時間coverage、
Freezingは同じ対象の時間平均の攻撃速度低下量。Chains / Gravityは射程内対象全体に対する
target-time coverage（active × 影響対象比率 × 適用可能対象割合）。同じ対象へ継続命中する限定モデルであり、
全ての敵を必ず殴れているという実測を表すものではない。

effect stateは共通でtriggerChance、opportunitiesPerSecond、durationSeconds、activeCoverage、
eligibleTargetShareを持つ。StunningはbaseDurationSeconds・durationConfidence・effectiveHardDisableCoverage、
FreezingはattackSpeedReduction・attackSlowEquivalentCoverage、ChainsはexpectedTargetsPerProc・affectedTargetFraction・rootCoverage、
GravityはexpectedTargetsPerHit・affectedTargetFraction・groupingCoverageを追加する。

計算は収束したoffensive stateの後に行う。Death Cap / Rampagingを含む最終速度をcadenceへ適用し、
状態には最終DamageMetrics.hitsPerSecondを表示。Controlを固定点変数に加えず、
Control → DPS → kill → Controlの循環は作らない。

## Coverage: finite periodic Bernoulli expectation

初撃はt=0、戦闘終了Tで効果の残りを切り捨てる。各モデル対象についてprofile hitごとに1抽選。
`expectedTargetsHit`や射程内敵数をHPSへ掛けない。roll granularityの実機根拠は不足している。

```text
n(t) = (t-d, t] 内にある、t>=0のprofile hit数
activeCoverage = (1/T) ∫[0,T] { 1 - (1-p)^n(t) } dt
```

同じ対象/clusterへの再発動はrefreshというlow-confidence仮定。
重なるdurationやcoverageを加算しない。Chainsのcluster選択や対象交代は未モデル化。
durationまでの立ち上がりは等比級数、その後はhit位相とexpiry位相で区切った周期積分で処理する。
計算量はprofileの長さmについてO(m²)、戦闘中のhit数には依存しない。full event simulatorは追加しない。
数値表現できない極端なcadenceはエラーにする。

p=1は各hit後の`min(hit間隔, duration)`を積分。`finiteRefreshCoverage`をFreezing / Gravity / Fire Aspectで共用する。
既存`finiteBurnUptime`は互換wrapperとして残す。

比較したPoisson案 `1-exp(-HPS*p*d)` は定常・連続到着近似で、有限戦闘の立ち上がりと周期抽選の差を落とすため不採用。
例えば15 hit/s、p=.15、d=2秒では、定常Bernoulliは`1-.85^30=99.2369%`、Poissonは98.8891%。
30秒戦闘のcoverageは初期transient分だけ定常Bernoulliより小さくなる。
この一致はformula sanity checkであり、ゲーム実測Goldenではない。

## 4種の仕様・Evidence・境界

| 効果 | Tier I / II / III | metric | 境界 |
| --- | --- | --- | --- |
| Chains | 各hit30%、1 / 2 / 3秒 | rootCoverage | 移動束縛中も近くへ攻撃可能。hard disableには加えない |
| Stunning | 各hit5 / 10 / 15%、基準2秒 | hardDisableCoverage | 移動・攻撃不能。2秒は低信頼度、適用割合と持続補正を別入力 |
| Freezing | 3秒、攻撃速度30 / 40 / 50%低下 | attackSlowEquivalentCoverage | 移動速度を下げない。Defenseへ掛けない |
| Gravity | hitごと、1 / 1.5 / 2秒 | groupingCoverage | impact pointへの集敵。stun/root/DR/DPSへ変換しない |

Chains / Gravityは`active × min(平均対象数/射程内敵数,1) × eligibility`。
Freezingは`active × tier低下率 × eligibility`。Stunningは`active × eligibility`。
例として1秒間隔・T=30秒・Tier III・eligibility50%・射程内2体・平均影響1体なら、
Freezingはactive100%・attackSlow25%、Gravityはactive100%・grouping25%。
Chainsはactive64.02%・root16.005%、Stunningはactive27.325%・hard disable13.6625%（初期transientを含む）。
数値例はシナリオ仮定によるモデル出力であり、mob共通の実測値ではない。

### Chains stacking

gameMaxCopies=4 / runtimeMaxCopies=1。game-data pageはstack可能というflagを示すだけで、
同時proc、mixed tier、3/4copy、active bind中の再発動のdurationを決める情報がない。
旧auditの「独立roll」をゲームデータページへhigh-confidenceで帰属させた記述を修正した。
Wikiの「multiplicative duration」と一般ページの独立roll説明は今回直接取得できず、具体的な持続式を解決できていない。
2コピーの独立抽選を仮定すれば少なくとも1つ51%、両方9%だが、この計算だけではdurationを決められない。
30%をcopy数倍したり、持続式を捏造したりしない。
自由候補の重複組み合わせは理由付き除外。通常/確定/金色の強制重複は評価エラーになる。
Stunning / Freezing / Gravityは各1copy（non-stackable）。

### Stunning duration gateと耐性

優先した[dungeons.tools](https://www.dungeons.tools/enchantments/stunning)のHTMLと埋め込みデータを確認したが、
hidden durationは見つからなかった。元game archiveは取得していない。
Wiki Stunning/history/Frozenの直接取得は403等で失敗し、数値durationは検証できていない。
[Stunned status](https://minecraft.wiki/rest.php/v1/page/Dungeons%3AStunned/html)の検索indexは行動不能の意味だけを支持する。

[2022年の定量説明](https://www.reddit.com/r/MinecraftDungeons/comments/vtrd6t/)と
[2023年1月の計算](https://www.reddit.com/r/MinecraftDungeons/comments/10chuqi/)は約2秒を使う。
後者はApocalypse+25と28.12 hit/2秒、約99%を明示する。著者が重複しており独立実測ではない。
[別の2023年の報告](https://www.reddit.com/r/MinecraftDungeons/comments/13ce18u/)も2秒を前提にするが追認に留まる。
2022/2023で値は整合するものの、実行versionを確認した1.17.0.0測定はなく、**2秒をlow-confidenceの限定runtime値**として採用。
その数値からDefenseやAmbushを自動変更する記述は採用しない。

[boss/miniboss immunity報告](https://www.reddit.com/r/MinecraftDungeons/comments/z369zy/)に従って、boss presetのStunning適用割合は0。
powerful mob全てをimmuneとは断定せず、mob matrixは未解決。
Apocalypse+のstagger耐性と全てのstunの耐性が同じとは限らない。
[artifact由来stunについての2026年の議論](https://www.reddit.com/r/MinecraftDungeons/comments/1rx9deh/)からStunningの数値補正を作らず、
編集可能なduration multiplierを持たせる。0なら無効、1なら報告の基準2秒。
初期1は「耐性なしが確定」という意味ではない。

### Freezing分類

[game-data page](https://www.dungeons.tools/enchantments/freezing)と
[Wiki index](https://minecraft.wiki/w/Dungeons%3AFreezing)を照合。
1.16.2.0のbuff後は30/40/50%、持続3秒。audit分類をmovement-slowからattack-speed-slowへ訂正。
root/groupingへ加えず、hero damageTakenMultiplierにも接続しない。

### Gravityと相互作用

[Gravityの公開Tier値](https://www.dungeons.tools/enchantments/gravity)は1/1.5/2秒。
半径の定量根拠がないため、平均対象数はadvanced assumption。
Gravity+Stunningは2つのraw metricを保持するだけでsynergy bonusなし。
GravityでAoE命中数、Poison target-seconds、Exploding二次対象、Stunning確率を変更しない。
Chains+StunningやStunning+Freezingも敵行動の抑制率として合算しない。
既存Anchorを含む武器内蔵効果は今回のスコープ外で、自動追加しない。

## Scenario defaultsとranking policy

`crowdControl`は7入力: 4種のeligibleTargetShare、stunningEffectiveDurationMultiplier、
chainsExpectedTargetsPerProc、gravityExpectedTargetsPerHit。
4割合は全profile共通0.5を、mission独立の実測がないため編集可能な中間例として採用。
boss Stunningのみ上記免疫報告に基づいて0。平均対象数は両方1の保守的baseline、
1〜averageTargetsInReachの範囲で入力する。射程内敵数を減らすUI操作ではCC対象数も上限へ合わせる。
割合・duration multiplierは0〜1、NaN/Infinityや論理範囲外はreject。

```text
Control utility = Σ(subweight_i × rawCoverage_i) / Σ(subweight_i)
Objective score = 100 × Σ(weight_axis × utility_axis) / Σ(weight_axis)
```

subweightsはhardDisable/attackSlow/root/grouping各1。0の軸は無視し、全て0ならutility0。
これはranking preferenceで、Evidenceではない。confidenceへpolicyを混ぜない。
raw値を別表示し、100%+100%=200% suppressionなどと解釈しない。

| preset | Damage | Healing | Defense | Control |
| --- | ---: | ---: | ---: | ---: |
| balanced | .50 | .25 | .25 | .20 |
| damage | .80 | .10 | .10 | .05 |
| survival | .10 | .45 | .45 | .30 |
| boss | .75 | .10 | .15 | .05 |
| mobbing | .50 | .20 | .30 | .30 |
| apocalypse-plus | .30 | .30 | .40 | .20 |

既存3軸の比率を保持し、Controlの重みだけを追加、総和で正規化する。
上記はproduct policyでゲームmechanicsのEvidenceではない。詳細設定でControl全体とsubweightを変更できる。
CCなしでもcontrol>0なら正規化によって旧スコアから低下する。control=0なら旧3軸スコアに完全一致する。

Pareto dominanceはAoE DPS、回復/秒、EHP、Control utilityの4軸。
scoreのcontrol=0でもParetoは機械的な4軸比較を保つ。Controlだけ改善すれば他3軸が同じ候補を支配し、
火力とControlがtradeoffなら両方を残す。
`EffectContribution.controlUtilityDelta`を効果除去の再評価で計算し、objectiveDeltaと別表示する。
CC単独の追加はDPS/回復/EHP delta=0。Death CapやRampagingの寄与にはcoverage変化が自然に含まれる。


### 代表buildのobjective

Fighter’s Bindings、Power251、表示hit damage100、通常枠Stunning III / Gravity III / Radiance III、Artifactなし。
全てbalanced default（戦闘30秒、射程内2.5体、適用割合50%、Gravity平均1体、subweight各1）:

| 項目 | 出力 |
| --- | ---: |
| 最終HPS | 6.956521739 |
| Stunning active | 0.8780452803 |
| hardDisableCoverage | 0.4390226401 |
| groupingCoverage | 0.2000000000 |
| Damage utility | 0.9999998875 |
| Healing utility | 0.5012509292 |
| Defense utility | 0 |
| Control utility | 0.1597556600 |
| 重み D / H / Def / C | .5 / .25 / .25 / .2 |
| 最終objective | **54.7719840041 / 100** |

ControlをDPSやDefenseへ混ぜず、`100×(.5D+.25H+.25Def+.2C)/1.2`を使用する。
数値の精密さは計算の再現性であり、ゲーム内での確度を意味しない。

## Confidenceと検証

Tier確率/秒数はgame-data由来high、Stunning秒数は別Evidenceでlow。
Freezingがattack-speed-onlyであること、Stunnedが移動/攻撃不能であることも別に確認。
roll粒度、refresh、cluster半径/対象数、対象継続、免疫割合はlowの仮定。
CC未選択buildへCC-specific factorを追加しない。選択したCCに必要なduration/target evidenceだけを追加。
コミュニティのframe cap報告に対して既存の平均attack-speedモデルは未対応で、高速CCを過大評価し得る。

`tests/fixtures/cc-legacy-baseline.json`は変更前commit
`523d677eca0059f53b866d2c4fece7c993882dc2`を別ディレクトリで実行して採取した4buildの出力。
旧3軸utility/score、全Damage/Healing/Defense、Combat/Potion/Temporal/Soul/Artifact stateを比較し、
各buildへCCを金色枠で追加しても既存値が変わらないことを検証する。これはsoftware regressionでゲーム実測ではない。
coverage自体は、小さいfixtureの全proc組み合わせ列挙と区間union積分を独立oracleとして比較する。
stunlock式、長時間、slow/fast、tier、eligibility、target数、policy、Pareto、illegal stacking、
通常/確定/金色I/II/III、storage/JSON、UIの意味表示を検証する。`audit:cc`をCIへ追加。

26種の全探索で詳細作成とPareto比較が増えたため、全候補は数値評価のみ、説明・confidence・寄与は表示候補だけ生成する。
同じ4軸metricの組み合わせはPareto比較の代表を1つにし、同値build自体は最終の安定ソートまで保持する。
一時的な詳細cacheはoptimize呼び出し内だけで破棄し、Scenario変更をまたいで共有しない。

## 残課題と次フェーズ

Chains複数copy、Stunning durationのversion付き測定、CC全般のroll粒度/refresh/免疫matrix、
Gravity/Chainsの半径、target switchingは未完了。将来enemy action modelとtarget-density modelを作る際に
effect-specific stateを接続できるが、今回のControl値をそのままDPS/DRへ転用しない。
Echo、Enigma、DoTのPower/stack/Void/overlap、低Powerの3proc、独立DPS回帰0/5は継続partial。
近接25〜30種の親目標は件数だけではcloseしない。26種の意味あるruntime/制約/4軸/検証が揃ったため
完了判断の候補にはできるが、制限評価を残して親項目はin-progressとする。

| 次候補 | 依存・費用 | 判断 |
| --- | --- | --- |
| Pain Cycle / Dynamo | charge/stack蓄積・consume・攻撃/HP条件。既存temporal層を利用可能 | 次の第一候補。最初にstate semanticsを監査し、解けたものから限定runtime化 |
| Busy Bee | pet lifecycle、cap、DPS、targeting、寿命 | 新しい召喚subsystemが必要で費用が大きい |
| Looting / Prospector | loot/goldとcombatの別objective、run単位の価値 | combat最適化とは目的を分ける必要がある |
| Echo / Enigma | repeat/cadenceまたはSoul→chanceの新Evidence | 根拠が増えた場合のみ再監査。既知の未解決式を埋めない |

全調査の参照・取得制限・source fact/assumptionの区別は[CC audit](../research/cc-subsystem-audit.json)に保持する。
