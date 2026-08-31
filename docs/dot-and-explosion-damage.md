# Phase 2-1H — DoTと撃破時爆発（partial）

対象はMinecraft Dungeons 1.17.0.0。**catalog 22 / 33、広域Power対応17、範囲限定damage enchant5、research-only11、needs-damage-event-model0**。Fire/Poisonの全Power、Fire重複、Void interaction、雲overlapの実測が残るためpartial。Phase 2-1D / F / Gもpartialを維持する。

## Evidenceの区別

[監査JSON](../research/dot-damage-event-audit.json)はtrigger、duration、DPS表、再付与、targeting、kill attribution、Voidの増幅／消費／再適用を別項目として保持する。情報の優先順は1.17.0.0由来公開データ、Wiki表・履歴、定量実験、複数community報告、model assumption。

[dungeons.tools](https://www.dungeons.tools/enchantments)のtier/flagと編集記事を区別し、game-file fieldを直接解析したとは主張しない。Wiki本文の直接取得はrobots制限のため、検索インデックス経由で表を確認した。表のversion・同Power内のrollは不明で、1.17.0.0の実機goldenではない。数値テストは公開表整合またはmodel-derived goldenであり、実測DPS回帰には登録しない。

## Fire Aspect

- [1.17.0.0由来公開値](https://www.dungeons.tools/enchantments/fire-aspect): 3秒、Tier倍率1 / 1.25 / 1.5（high）。直接hitの対象へburnを付与する。
- [Wiki Power表](https://minecraft.wiki/w/Dungeons:Fire_Aspect): 11 Power点・33 Tier値、Power70–251（表medium、補間low）。runtimeはTier Iの10点をlog-linear補間しTier倍率を掛ける。武器hit damageや武器係数を使わない。50–69 / 252–263へ外挿しない。
- **Power250 Tier I=126649はrawへ保存し、250の行全体をruntime knotから除外**。249の206102と251の226443から幾何補間し、250は216033.227 DPS。Tier II/1.25=216648.8、Tier III/1.5=216649.33なので転記ミスが有力だが未確定。roll変動、表破損、別係数の可能性も監査に記録。値を216649へ無断訂正しない。
- 同一copyはrefreshして1targetのburn uptime≤1とする限定モデル（low）。hitごとに3秒分を加算しない。tick位相resetや個別tickは未実測。
- 攻撃間隔Δを速度で割り、各hitから次hitまでの燃焼時間を`min(Δ,3)`として積分する。定常式は`Σmin(Δ,3)/ΣΔ`。runtimeは**初撃t=0、有限encounter内だけ**を集計し、最後のtailを終了時刻で切る。既存Voidと同じ初撃規約で、初撃前の待機はモデル化しない。周期をまとめて計算するため長いencounterでもhitごとのループ不要。
- single DPS=`listedDps × finiteBurnUptime`。AoEはこれに武器の`expectedTargetsHit`を掛ける。同じ対象へ継続命中するhomogeneous-target仮定（low）で、敵交代・移動・倒した敵への残りburnを再現しない。
- **runtimeは1copy限定**。Wikiの通常3枠＋Enchantsmith経由の金色併用は最大4を支持するが、Wikiのmultiplicativeという説明、[2020年の定量報告](https://www.reddit.com/r/MinecraftDungeons/comments/he5bsy/)の2個目50%、[2023年報告](https://www.reddit.com/r/MinecraftDungeons/comments/15pbk2a/)の75%が一致しない。Tier混在・4copyの式が確定するまで`combineEnchantmentValues`へ流さない。catalogのspecial/maxCopies1は**runtimeの制限でありゲームのnon-stackable宣言ではない**。
- Fire Focus・防具は未実装。

例: Power251 IIIは226443×1.5=339664.5 DPS（公開339665との差は丸め）。通常速度の4武器は全間隔が3秒以内なので100%coverageで同じ絶対burn DPS。5秒間隔・10秒encounterでは60%、速度2倍で100%。速い武器ほど無限に増える効果ではない。

## Poison Cloud

- [1.17.0.0由来公開値](https://www.dungeons.tools/enchantments/poison-cloud): hit時30%、地面に3秒、Tier倍率1 / 2 / 3、non-stackable（high）。通常＋金色も最大1copy。
- [Wiki Power表](https://minecraft.wiki/w/Dungeons:Poison_Cloud): 7 Power点・21 Tier値、184–251。独自Tier I log-linear補間（low）とTier比を使用。範囲外へ外挿しない。251 IIIは113598×3=340794 DPS、公開340793との差1は丸め扱い。
- `cloudSpawnsPerSecond=directProfileHps×0.3`。1swing内のtarget別rollは未確認なのでprofile hitごと1回の限定仮定（low）。AoE対象数を発生率へ再乗算しない。
- 単体滞在rは0–3秒。AoE target-seconds Tは1cloudあたり各targetの滞在秒数の合計（2体×1.5秒なら3）。デフォルトはr=1.5、T=1.5（low、実測でない）。任意Scenarioの`persistentAreaTargeting`省略時も同じ値。Tはr以上かつ`3×averageTargetsInReach`以下、全値は有限・非負。
- **overlapは実測で未確定**。[同一対象上の固定DPS報告](https://www.reddit.com/r/MinecraftDungeons/comments/n431gd/)を参考に、指示書Option Bの飽和近似を採用。copyのnon-stackableはcloud非重複の証明ではない。独立加算を事実扱いしない。
- 発生率λをPoisson近似した**定常状態**で、単体uptime=`1-exp(-λr)`、AoE有効対象数=`N×(1-exp(-λT/N))`、Nは`averageTargetsInReach`。それぞれにlistedDpsを掛ける。雲ごとのgeometryを追跡せず、同じN体へ均一なexposureを割り当てる仮定。飽和上限は単体listedDps、AoEはN×listedDps。
- 低占有率では`λ×T×listedDps`へ近づくが、重なる場面では下回る。**単体滞在を3秒→1秒へ変えても寄与が常に1/3になるわけではない**。それは独立加算モデルの性質であり、本モデルでは非線形の飽和差になる。0秒なら0。
- 実際のBernoulli hit cadence、雲の位置、移動、開始時transient、Poison Focusは未再現。特に短いencounterは定常近似で過大評価し得る。

例: HPS10なら3cloud/s。listedDps100、λ1、N2、T3なら`200×(1-exp(-1.5))=155.374 DPS`で、単純加算300 DPSにはしない。Power251 III、HPS3、r1.5なら単体`340794×(1-exp(-1.35))≈252446.475 DPS`。これは実測値ではなくモデル出力。

## Power curve比較

Model Aは個別curve、Model Bは共通curve＋係数。FireとShockwaveのTier IはPower210で42257が一致、213は47870対49058（約2.42%差）、251は226443対227196（約0.33%差）。PoisonもShockwaveの約半分だが常に一致しない。共通のゲーム式と係数、同一rollでのraw実測を確定できないためModel Aを採用。Phase 2-1Dの低Power未対応を閉じない。

## Exploding

- [公開Tier値](https://www.dungeons.tools/enchantments/exploding)は倒した敵のHPの20 / 40 / 60%、Power非依存、non-stackable（high）。[Wiki](https://minecraft.wiki/w/Dungeons:Exploding)は最大HPを説明する。
- [武器killの報告](https://www.reddit.com/r/MinecraftDungeons/comments/1c28h74/)と[独立したno-chain報告](https://www.reddit.com/r/MinecraftDungeons/comments/13eqs3l/)から`CombatState.directWeaponKillsPerSecond`だけをsourceにする（medium）。artifact／indirect killはsourceではない。
- `averageEnemyHealth`を倒した敵のmax HP Hと近似する（low）。boss/add混在のHP偏りは未再現。
- 二次対象n=`min(1,max(0,averageTargetsInReach-1))`を導出する（low）。範囲内の全員に自動命中させず最大1体の基準値。**死んだsourceには加算しない。pure bossでは単体DPS=0、AoE DPS=0**。addsからbossへの個別damage配分も未モデル化。
- AoE DPS=`directSourceKills/s × H × tierFraction × n`。例えばk1/s、H100、III、n1で60 DPS。
- burstの発生遅延と遭遇終了時の未発爆弾は再現しない。定常rateモデル。

### 固定点とdirect-kill effects

現在のsource rate→爆発DPS→total AoE→damage share→次のdirect source rateを内側のbracketed固定点で解く。外側のRampaging uptime固定点の各評価で内側も解き直す。Committedのdirect HP推移も各内側評価で更新。直接撃破のみを戻すので**aggregate feedbackは爆発chainではない**。

内側のsource rateは供給上限×directKillShareとdamage由来の上限の小さい方で正規化する。極端に大きい供給上限で「残差が小さいので爆発0」と誤判定しない。内外とも残差1e-8以下、各solve上限100回、未収束・不正値は例外。表示の内側反復は外側全評価の累計なので100を超え得る。最終damage／CombatState／Rampaging／Soul／Potionは同じ評価点から導出し、source入力と算出direct rateの差は許容残差内。

**model-derived収束例**: Double Axe、Power251、表示hit100、Exploding III＋Rampaging III＋Refreshment III、Artifactなし。敵HP100、供給1/s、directKillShare1、射程内2、他はdefault。

| 指標 | 値 |
|---|---:|
| 初期direct kill rate（速度bonus0・爆発0） | 1 /s |
| 初回の一方向Exploding | 60 DPS |
| 収束Exploding | 53.47560972 DPS |
| 最終direct damage share | 0.8912601601 |
| 最終direct kill rate | 0.8912601601 /s |
| Rampaging uptime | 0.7373387865 |
| 反復 | 外側6、内側累計159 |
| 残差 | Rampaging 3.36e-10、爆発1.91e-9（正規化） |
| 最終total AoE | 491.77568923 DPS |
| Refreshment追加回復容量 | 4.45630080 HP/s |

爆発なしでは供給capでdirect1/s、Refreshment追加容量5 HP/s。爆発追加で総DPSは増えるがdirect kill shareが減り、Refreshment容量が下がる。Fire/Poisonも同じdamage-share proxyを通じてLeeching／Guarding Strike／Refreshment／Rampagingへ影響する。

## Voidと撃破帰属

[Void／DoT報告](https://www.reddit.com/r/MinecraftDungeons/comments/15xk3z1/)はFire/Poisonのtick増幅を示唆するが、増幅・消費・timer reset/reapplyの正確な順序は未確定。**Fire / Poison / ExplodingとVoid Strikeの併用をすべて未対応にする**。平均Void倍率を掛けたり、silentに増幅0で通したりしない。既存instant procの限定Voidモデルは変更しない。

間接最終打撃は[direct-kill effectsを発動しない](https://www.reddit.com/r/MinecraftDungeons/comments/1dml95h/)。runtimeの`directWeaponAoeDps / totalAoeDps`はlow-confidence代理値で、DoT tick時刻、残HP、overkill、移動、他プレイヤーを追跡しない。各Enchant未選択のbuildには新しいtargeting/overlap confidenceを追加しない。

## 型・API・UI・検証

`DamageEventModel`はinstant／attached-dot／persistent-area-dot／on-kill-explosionの判別union。互換性のため従来の`damageEvents`はinstantだけを保持し、新しい`dotDamageEvents`と`explosionDamageEvents`を別に追跡する。瞬間damage/event、DoT damage/sec、撃破HP比率を同じcurveやscalarへ入れない。`DamageMetrics`はdirect、instant、DoT、explosion、indirect合計とtotalを公開する。

`calculateDamage`単独でExplodingを計算する場合はsource rate必須で、省略を例外にする。公開`evaluate`／`optimize`が固定点を解く。通常候補、locked、金色I/II/III、保存、JSON、寄与差分、reasons、confidenceに対応。Power範囲外の自由候補と未対応組合せを理由付き除外し、固定候補だけで合法buildがない場合はエラー。UIの微調整にPoison滞在とtarget-secondsを追加し、爆発の対象数は自動導出。

`npm run audit:dot-damage`をCIに追加。公開表一致／異常値保持／境界／有限burn／飽和／invalid入力／no-chain／解析解との一致／Rampaging・Refreshment・Committed連携／保存・Optimizer・UIをテストする。既存damage-events／temporal／soul／enchants／dps／melee auditsも維持する。

## 残課題と次候補

| 残課題 | 状態 |
|---|---|
| Fire全Power | 70–251のみ。50–69、252–263未対応 |
| Fire複数copy | ゲーム最大4、runtime1。混在Tier式未確定 |
| Fire/Poison/ExplodingとVoid | 未対応combination。増幅／消費／再適用の測定が必要 |
| Poison overlap | 飽和仮定で限定対応。独立重複の有無は未検証 |
| Poison residence | 編集可能、実測でない。geometry／移動モデル未対応 |
| Exploding source attribution | direct-onlyをcommunityから採用。raw triggerの確認待ち |
| DoT final blow timing | damage-share proxyのみ。tick別再現なし |

次は**CC utility subsystemの研究監査**を推奨。Chains／Stunning／Freezing／Gravityの発動率・duration・対象範囲と、被damage／contactへの影響を分けて定義できればOptimizerの比較に意味を持つ。人数達成だけで0点候補を追加しない。次点はPain Cycleの自傷・回復・攻撃周期を明示するcomplex offensive stateで、Dynamoのroll保持とBusy Beeの召喚AIはさらに別モデルが必要。Looting／Prospectorは消耗品・emerald目的ができるまでutility-onlyを維持。Echo／Enigma、armor、Soul artifacts、full discrete event simulatorは今回対象外。
