# Phase 2-1F — Temporal State（partial）

対象はMinecraft Dungeons 1.17.0.0。Artifact SynergyとRampagingを**限定的なsteady-stateモデル**で実装し、Echoは`needs-state-model` / research-onlyのままです。full combat simulator・Armor・Ranged・unique built-insは追加しません。

現在のcoverageはcatalog **17 / 33**、広域Power **14 / 33**、Power範囲限定proc **3 / 33**、research-only **16 / 33**、needs-state-model **11**。Phase 2-1Dはpartial（Shockwave 210–252、Swirling 210–263、Thundering 248–263、外挿なし）。親目標の近接25〜30種は未完了です。

## 調査とEvidenceの扱い

[interaction audit](../research/temporal-enchantment-audit.json)に主張ごとの根拠、confidence、採用した仮定、未解決点を記録しました。[既存33種audit](../research/melee-enchantment-audit.json)ともTierと状態を照合します。

優先順はgame-file由来metadata、具体的なWiki mechanics、定量的community測定、community報告、モデル仮定。2026-08-31に[dungeons.tools](https://www.dungeons.tools/enchantments)の個別ページを再確認しました。Wiki個別ページは取得制限があり、[Enchantment一覧の検索index](https://minecraft.wiki/w/Dungeons:Enchantment)でRampagingの「2×III、10%、30秒」という具体例を確認しています。全文を再取得できたとは扱いません。

dungeons.toolsのTier/STACKS metadataと、編集文の「roll stacks」「free repeat」は証拠の強さが異なります。編集文から独立rollや無料の追加攻撃を確定しません。communityの5%記述もgame-derived 10%を上書きしません。

## Artifact Synergy

[dungeons.tools: Artifact Synergy](https://www.dungeons.tools/enchantments/artifact-synergy)のTier I/II/IIIは**+40/+60/+80%**、発動はArtifactを使用した瞬間、効果は次の近接攻撃。non-stackableで通常＋金色を含め最大1個です。持続型Artifactの稼働中すべての攻撃を強化しません。

`ArtifactActivationState`は各instanceの推定CDと使用頻度を保持し、持続時間/uptimeと独立させています。

```text
A_i = 1 / effectiveCooldown_i
A = Σ A_i
C = min(A, H)
chargedShare = H > 0 ? C/H : 0
expectedDirectMultiplier = 1 + chargedShare × tierBonus
```

- `ARTIFACT_USE_RATE_MODEL`（low）: CDごとに即使用。開始時burst、使用animation、操作待ちを再現しません。
- pending capacity **1**（low）: 攻撃前に複数使用してもqueueや倍率stackを作らない限定モデル。ゲームでの厳密な挙動は未確認です。
- optimal staggering（low）: 使用を別攻撃へ分散できると仮定。CD周期と攻撃時刻が毎回両立する保証はなく、実プレイの上限寄りの近似です。
- `H`は現在のAttackProfileの**1 hitを1 attack actionと近似**した頻度。コンボ終了頻度や`HPS × 命中対象数`ではありません。複数targetへの同一攻撃は1機会です。

| Runtime武器 | 既存profile | 採用粒度と不足情報 |
| --- | --- | --- |
| Fighter's Bindings | 0.15/0.15/0.15/0.125秒、4 hit | 1 hit = 1 action近似。action/sub-hit metadataなし |
| Double Axe | 0.6/0.6秒、2 hit | 同上。1 combo全体を強化しない |
| Anchor | 2.5秒、1 hit | 同上。animation cancelを再現しない |

1 attack内の複数hit・空振り消費・combo hit別damage・AoE各敵への適用を独立測定できていません。現在の均一hit damageと均一AoEへ限定し、将来のmulti-hit武器へ自動拡張しません。

例えば有効CD20秒のArtifactは0.05回/秒。合計A=0.12、H=1、Tier IIIなら強化割合12%、direct倍率**1.096倍**です。複数Artifactはinstance別に合算し、Hを超えた分は飽和します。Artifact未装備ならA=C=0、倍率1、寄与0（発動源なし）。CD短縮はAを増やします。

`ARTIFACT_SYNERGY_DIRECT_COMPOSITION`（low）としてSharpness/Critical/Void/Unchanting/Smiting/Ambushのfactorized direct期待倍率へ乗算し、**CommittedのHP推移へ渡す前**に適用します。これらの厳密な実機合成順序は未検証。Shockwave/Swirling/Thunderingのdamage/eventへは掛けません。ArtifactやEnchantの寄与度は、除去後に全経路を再評価した差です。

## Rampaging

[dungeons.tools: Rampaging](https://www.dungeons.tools/enchantments/rampaging)の基本値は**10%発動、+50% attack speed、5/10/15秒**（high）。[間接撃破のcommunity報告](https://www.reddit.com/r/MinecraftDungeons/comments/1ekyxv0/)をlow confidenceで採用し、既存`CombatState.directWeaponKillsPerSecond`だけを発動源にします。

```text
k = min(enemySupply, totalAoE / enemyHP) × scenario.directKillShare × directAoE / totalAoE
λ = 0.1 × k
T = Σ tierDuration
u = 1 − exp(−λ × T)
finalSpeed = artifactSpeedMultiplier + 0.5 × u
```

**コピーは秒数だけ加算**。III＋III=30秒、III＋II=25秒。通常3枠＋金色で最大4コピー、強さは+50%のままです。通常スロットは既存のTier III固定、金色はI/II/III。mixed tierの合成関数は順序に依存しません。

Wikiの具体例に基づく**共通10% trigger＋合計duration**の限定モデル（medium）。STACKS Yesだけから2コピー20%と推定していません。実ゲームのcopy別rollを独立確認できておらず、4コピーの厳密なroll仕様とunique built-in制限は引き続き調査対象です。

再発動時に残り時間をTへ戻すrefreshを仮定し、過去T秒に1回以上procするPoisson確率で稼働率を近似します（low）。残り時間へTを追加する動作、離散kill、戦闘開始・終了、短時間のwarm-upは再現しません。**k=0なら発動率・稼働率・平均速度bonusは0**。

[Death Capとのcommunity説明](https://www.reddit.com/r/MinecraftDungeons/comments/14ejzt7/)に従い速度bonusを加算します（low）。Death Cap常時なら2→2.5倍で相対+25%、なしなら1→1.5倍で相対+50%。Armor速度も加算との[報告](https://www.reddit.com/r/MinecraftDungeons/comments/v0b79x/)がありますがArmorは未実装です。

### 固定点の設計と例

`resolveOffensiveSteadyState()`が明示的な循環の境界です。

```text
u=0から開始
→ Artifact速度 + Rampaging平均bonus
→ HPS、Void時間曲線、Artifact Synergy、direct/proc、Committed
→ CombatState（供給cap・direct attribution維持）
→ 新しいu
```

`solveUnitIntervalFixedPoint()`は許容誤差**1e-8**、最大**100回**。非有限値・範囲外・非収束はエラーで、黙って旧値を返しません。評価した入力uとその残差を返すため、表示速度/DPS/killは同一状態に対応し、uptime式との差は許容誤差以内です。Rampaging不使用buildはdamage/combat計算1回・iteration 0で従来経路に近いコストです。

検証例: Double Axe、表示damage=30、単体、敵HP=100、供給100/秒、directKillShare=1、Artifactなし、Rampaging III。baseline HPS=1/0.6、DPS=50です。

| 指標 | 値 |
| --- | ---: |
| 初期速度倍率 | 1 |
| 初回uptime | 0.5276334473 |
| 収束uptime（11回） | 0.6265435263 |
| 最終速度倍率 | 1.3132717632 |
| 最終DPS | 65.6635881582 |
| 最終直接撃破/秒 | 0.6566358816 |
| 残差 | 1.80125e-9 |

これは`u=1-exp(-0.75*(1+0.5*u))`を満たすモデルのGoldenです。固定kill 1/秒、IIIなら`1-exp(-1.5)=0.7768698399`。実測性能値ではありません。

最終速度でVoidを再計算するので、攻撃間隔短縮によりVoid倍率は下がり得ます。procはdamage/eventを変えず発生頻度だけ更新。総killが供給capなら無限にfeedbackせず、procがdirect shareを減らす分も維持します。除去寄与はLeeching/Guarding/Refreshment、Synergyの攻撃機会まで全再計算します。

**制限**: 平均速度でのVoid倍率はon/off状態の倍率平均とは異なります。既存AttackProfileの線形速度モデルはframe上限や[Fighter's Bindingsの非線形速度報告](https://www.reddit.com/r/MinecraftDungeons/comments/10chuqi/)を再現せず、特に高速武器を過大評価し得ます。数値的収束のhigh confidenceは、ゲーム内精度の証明ではありません。

## Echo: runtime gateを満たさずresearch-only

[dungeons.tools: Echo](https://www.dungeons.tools/enchantments/echo)で**Tier I/II/III cooldown 5/4/3秒、non-stackable、追撃**は確認できます（high）。ただし以下の独立根拠が不足しています。

1. repeatするcombo hitとdamage基準。3武器の名目hitが同質でも時間・modifierは未確定。
2. repeat animationの時間、通常attack cadenceを消費する量、attack speedとの関係。
3. cooldownの開始/再開時刻、miss時の扱い。
4. combo progressionとShockwave/Swirlingのfinisher資格。
5. Voidの消費・再付与・repeat時の倍率。
6. Critical、Radiance、Thundering、Weakeningそれぞれのon-hit機会。
7. direct/indirect分類とLeeching、Guarding Strike、Refreshment、Rampagingのkill trigger。

[Anchorでのanimation lock報告](https://www.reddit.com/r/MinecraftDungeons/comments/1e4em3n/)と[repeat/Void/miss報告](https://www.reddit.com/r/MinecraftDungeons/comments/1k3rg06/)はlow confidenceの未解決根拠として保持します。編集文の無料追撃だけでは、これらを解決できません。

したがって`damagePerHit/3`を加算せず、HPS、DamageEvent、direct killへ混ぜません。EchoStateやschedulerも未実装。Echoはcatalogに存在せず、JSON・optimizer・Echo+Void/Shockwaveも明示的に拒否します。unsupportedを0点で採用しません。

## 検証と再利用

`npm run audit:temporal-enchants`は3種のTier/stacking/runtimeをmain auditと照合し、根拠参照・仮定confidence・Echo blocker・3武器の粒度記録を検査。runtimeとの数値照合、飽和、無発動、供給cap、固定点Golden、非収束、間接proc分離、除去寄与、JSON/storage、lock/gilded、UIはテストで確認します。

同じ評価結果に稼働率・初回値・残差・iteration countを保持します。既存15種のGoldenと4 auditも維持。Web Worker化・full combat simulatorは行いません。

### 性能測定（2026-08-31、ローカル参考値）

上のDouble Axe fixture、Artifactなしでoffensive coreを500回warm-up後、1,000回×7試行の中央値を比較しました。damage+CombatStateを直接1回ずつ呼ぶ経路は2.04 ms、Rampagingなしのresolverは2.12 ms、Rampaging III（11反復）は19.61 ms / 1,000評価でした。旧commitとの比較ではなく同一ソースの単回経路との比較です。confidence・寄与度を含む全optimizer時間ではなく、端末/JITに依存する参考値でCI閾値にはしません。

全17候補×3通常枠の既存全探索テストでも、合法な4,325 buildすべてを評価しています。反復数0/11の経路差と上限をテストで確認し、Web Worker化は今回行いません。

## 次のPhase 2-1G候補

既存33種auditの依存関係と根拠範囲からの提案です。次batch自体は今回実装しません。

| 候補 | 再利用できるもの | 追加基盤・根拠の課題 | 優先 |
| --- | --- | --- | --- |
| A: Soul / Anima Conduit・Soul Siphon・Enigma Resonator | hit/kill rate、回復、proc期待値 | soul対応gear適用範囲、獲得/消費/cap、保有量とcritの連携。Tier値の根拠は既存auditにあり、共通資源としてまとめられる | **推奨** |
| B: CC / Chains・Stunning・Freezing・Gravity | hit率、enemy-state、対象割合 | 耐性、位置、集敵、coverage、攻撃中断の価値。単純な防御%への換算を裏付ける証拠が不足 | 次点 |
| C: Pain Cycle・Dynamo・Busy Bee | Temporal State、direct channel | HP drain/5-hit周期、roll蓄積、召喚AI/attack profileという異なる基盤。特殊武器interactionも大きい | 後続 |

Aは資源の追加が必要ですが、3効果で同じsoul獲得・保有量・消費のモデルを共有できるため次に進めやすいと判断します。現行3武器にSoul専用効果を無条件に解放せず、適用gearと不足Evidenceの監査を先に行うことが条件です。CCは位置・耐性とutility定義、Cは異質な状態系が多く、今回の小さいTemporal Stateだけでは安全に埋まりません。
