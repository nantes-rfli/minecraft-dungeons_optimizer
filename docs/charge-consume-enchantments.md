# Phase 2-1J — Charge / Consume（partial）

Pain Cycle / Dynamoを4武器に限定して実装。catalog **28/33**、広域Power **22/33**、Power範囲限定damage **6/33**、research-only **5/33**、needs-state-model **3**、utility-only **2**。これは全33種・全組合せの完全対応ではない。

監査の正本は[charge-consume audit](../research/charge-consume-enchantment-audit.json)。出典の優先順は1.17.0.0由来dungeons.tools、Minecraft Wiki、定量community検証、複数報告、明示的モデル仮定。現在版の独立実測がない項目は低信頼度を維持する。

## 根拠と採用境界

| 項目 | 採用 | 信頼度と残課題 |
| --- | --- | --- |
| Pain充填/倍率 | 5回充填→次攻撃3/4/5x、重複不可 | high、[dungeons.tools](https://www.dungeons.tools/enchantments/pain-cycle) |
| Pain自己damage | 充填ごと最大HP3% | published high、[Wiki](https://minecraft.wiki/w/Dungeons:Pain_Cycle)。古い5%報告は不採用 |
| Pain6回目のcost/reset | costなし・次周期の1stackを兼ねず0へ戻る | low。[最初5回と6回目を区別した報告](https://www.reddit.com/r/MinecraftDungeons/comments/1fa7s1n/)からの限定解釈。独立イベントtrace未済 |
| attack vs hit | profile hit ≒ 1 attack action | low。Fighter's Bindings / Double Axe / Anchor / Soul Scytheの均一base hit限定。AoE対象数はcharge数に掛けない |
| Dynamo充填/消費 | roll+1、cap20、次攻撃に全量→reset | [dungeons.tools](https://www.dungeons.tools/enchantments/dynamo)の公開説明。cap20は1.8.0.0以降 |
| Dynamo直接帰属 | direct meleeへの加算 | mediumの推論。公開next-attack記述と[追加base melee damageの報告](https://www.reddit.com/r/MinecraftDungeons/comments/1hkqkhu/)を採用。独立kill trace未済 |
| Dynamo AoE | 命中した各近接対象に同じ加算 | low。[報告1](https://www.reddit.com/r/MinecraftDungeons/comments/1c6giia/)と[報告2](https://www.reddit.com/r/MinecraftDungeons/comments/1d0hx4w/)は同意するが著者独立性未確認。既存expectedTargetsHitを使用 |
| miss | runtimeは全攻撃命中を仮定 | 空振り時の充填/保持/消費は未確定。全武器へ一般化しない |

自己damageは敵攻撃用のIron Hide / Guarding Strike / Weakeningで軽減しない。軽減可否は未解決であり、勝手な軽減を導入しない。Sawblade、Light Feather、roll armor、Jungle Poison、遠距離、HP-floor/死亡・overheal・対象交代は今回対象外。

## Pain Cycleの有限列

初撃t=0、終了時刻の攻撃を除外した `[0,T)` で、公開profileの間隔を速度で短縮して攻撃数Nを数える。周期とphase別出現数を使うので計算量はprofile長に比例し、Encounter長に比例する配列・ループは作らない。

```text
E = floor(N / 6)         empowered attacks
C = N - E               charging attacks
unused = N mod 6        5ならready
bonusDamage = E × B × (chargedMultiplier - 1)
finiteTotalDamage = N × B + bonusDamage
selfDamage = C × maxHP × 0.03
```

B=100、maxHP100の場合:

| N | charging | empowered | 終了stack | 自己damage | TierIII有限total |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 0 | 0 | 0 | 0 | 0 | 0 |
| 1 | 1 | 0 | 1 | 3 | 100 |
| 5 | 5 | 0 | 5 | 15 | 500 |
| 6 | 5 | 1 | 0 | 15 | 1000 |
| 7 | 6 | 1 | 1 | 18 | 1100 |
| 11 | 10 | 1 | 5 | 30 | 1500 |
| 12 | 10 | 2 | 0 | 30 | 2000 |

6回のTierI/II/III合計は800/900/1000。長期平均1.333333/1.5/1.666667は整合チェックにだけ使い、短期の充填損失を消さない。

主DPSは従来の平均base `B×H` を維持し、**有限bonusDamage/Tだけを加算**するハイブリッド。`finiteTotalDamage/T`と主DPSは端数周期で異なり得る。UIは有限列base/bonus/totalと主DPSの違いを明記する。これにより未強化の短期Encounterでも基本武器DPSが勝手に変わらず、Painなしの数値経路を維持できる。全direct攻撃をfiniteへ移行するのは別Phase。

## 回復・自己damage・ランキング

```text
grossHealingCapacityPerSecond = Radiance + Leeching + incremental Potion + Anima
selfDamagePerSecond = Pain selfDamage / T
netSustainPerSecond = grossHealingCapacityPerSecond - selfDamagePerSecond
totalPerSecond = netSustainPerSecond  // 既存ranking/Paretoとの共通境界
```

回復utilityはnet>=0なら従来の `1-exp(-net/target)`、net<0なら `-(1-exp(net/target))`。負値を0へ潰さず、回復源がないPainにも減点が働く。Paretoも負値を保ったnetを比較する。回復重みをユーザーが0にすればscoreでは無視するが、raw Paretoでは不利が残る。これは好みの重みでありmechanicsではない。

効果寄与は既存のleave-one-out再計算を使い、`selfDamagePerSecondDelta`と`netSustainPerSecondDelta`を追加。既存`healingPerSecondDelta`もnet差になる。UIはgross/self/netを分離する。自己damageを外部被ダメージやeffectiveHPへ二重計上しない。

例: Double Axeの6攻撃は3.6秒。B100/HP100/TierIIIでbonus400、+111.111111 direct DPS、自己damage15、4.166667 HP/s。回復なしならnet=-4.166667。5攻撃/3秒ならbonus0だがnet=-5。

## Dynamo Tier曲線とfinite consume

[公開数値表](https://minecraft.wiki/w/Dungeons:Dynamo)の10 Power点×3Tier=30値を独立に保存。Power210–263内でTier別log-linear補間、exact knotは原値を返す。Power209以下・264以上へ外挿しない。同Power個体差とversion不明のため原表medium、補間モデルlow。

UIラベル `+X / +1.25X / +1.5X` と数値表は矛盾する。P251は191087/305739/420391（約1/1.6/2.2）なのでTierI×1.25/1.5は禁止。表示武器damageからの換算も禁止。

Advancedに `rollsPerSecond`（有限・0以上）と `dynamoInitialStacks`（整数0〜20）を追加。全profileで初期値0、旧Scenarioの省略も0。mission由来の自動rollは作らない。Scenarioはセッション内、inventory JSONは従来versionのまま。

```text
最初の攻撃(t=0): initialStacksを全消費、以後stack=0
各完了攻撃間隔g: income=rollsPerSecond*g
  次攻撃のconsume=min(20,income)、overflow=max(0,income-20)、reset0
最後の攻撃〜Encounter終了: 同様に蓄積、未使用として保持（damageにしない）
totalConsumed + overflow + endUnused = initialStacks + rollsPerSecond*T
Dynamo direct DPS = damagePerStack * totalConsumed / T
```

rollは連続期待量とし、小数stackを許す低信頼度近似。各rollの整数時刻やanimationはない。等間隔の長期消費は `min(rollsPerSecond,H*20)`、不均等間隔ではcapによりそれ以下となる。初期stackを含めた有限消費率と長期消費率は別に表示する。roll animationの攻撃機会損失を無視するため評価は上限寄り。

- P251/TierIII/initial20/roll0: 初撃だけ **+8,407,820**。P263なら **+13,203,960**。
- H=2、roll1/s、T1000: 初撃0、総消費999.5、0.9995stack/s、平均0.49975stack/attack、終了0.5。長期は1stack/s。
- H=.1、roll5/s、T1000: 容量2stack/s、総消費1980、平均19.8、overflow3/s、終了20。
- H=1、roll.5/s、T1000、P251/TierIII: 有限209985.3045 direct DPS、長期210195.5。開始/終了の差を隠さない。

direct成分なのでLeeching / Guarding Strike / Refreshment / Rampaging / Exploding sourceへ既存のdamage-share撃破近似を通じて影響する。これは最初の巨大hitのoverkillやkill時刻を厳密再現するものではない。

## Modifier interaction matrix

| 相手 | Pain Cycle | Dynamo |
| --- | --- | --- |
| Critical Hit | uncertain / runtime unsupported | uncertain / runtime unsupported |
| Void Strike | uncertain / runtime unsupported | uncertain / runtime unsupported |
| Sharpness | uncertain / runtime unsupported | uncertain / runtime unsupported |
| Unchanting | uncertain / runtime unsupported | uncertain / runtime unsupported |
| Ambush | uncertain / runtime unsupported | uncertain / runtime unsupported |
| Smiting | uncertain / runtime unsupported | uncertain / runtime unsupported |
| Artifact Synergy | uncertain / runtime unsupported | uncertain / runtime unsupported |
| Committed | uncertain / runtime unsupported | uncertain / runtime unsupported |
| Pain Cycle + Dynamo | unsupported | unsupported |
| Shockwave/Swirling/Thundering/Fire Aspect/Poison Cloud | independent（増幅なし） | independent（増幅なし） |
| Exploding | formula独立、直接撃破sourceだけ変化 | formula独立、直接撃破sourceだけ変化 |

一般的な乗算・flat bonusのcommunity式だけでは現行版の各pair・順序・消費を確定できなかったため、今回supported multiplicative/additiveを無理に作らない。[flat bonus合成への警告](https://www.reddit.com/r/MinecraftDungeons/comments/15fndnu/)も記録。共通`enchantmentCombinationUnsupportedReason()`で候補を理由付き除外、唯一の候補なら明示エラー。通常・locked・gildedで同じ境界を使う。Pain×平均Void、Pain×Dynamo、Committed平均近似はいずれも採用しない。

Death Cap / Rampagingが速度を上げるとPainの有限cycle数・自己damageも再計算する。Dynamoはroll固定なら1attack当たりstackが低下し、roll収入以上の新規stackを受理しない。charge自体は速度を変えずControlへ直接feedbackしない。Rampagingが増えた場合のControl変化は既存速度経路に限る。有限chargeに由来するRampaging写像は階段状になり得て、真の固定点がなければ既存の収束エラーを返す（強制収束・架空平均を作らない）。

## 検証・回帰・運用

`npm run audit:charge-enchants`は必須claim/出典/分類/数値表/主audit/未対応pair境界を検査しCIにも追加。Golden・小規模独立逐次oracle・不正入力・optimizer除外・通常/金色重複・UI・撃破連動をテストする。新規依存関係なし。

`tests/fixtures/charge-legacy-baseline.json`は変更前c24f377から保存した8ケース（従来4ケース＋各Stunning金色）。全既存damage/healing/defense/control/state/score/confidence/reason/contributionを数値丸めなしで完全比較する。新しいgross/self/netの明示字段だけを比較前に取り除く。これはゲーム実測Evidenceではない。`evaluateCandidate()`は説明/寄与度を計算しないfast pathのまま。

## 次Phaseの比較

| 候補 | 既存基盤の再利用 | 必要Evidence・依存 | 判断 |
| --- | --- | --- | --- |
| Busy Bee | direct kill/finite時間/出典の基盤 | summon生成率・最大数・寿命・攻撃cadence・Power・撃破帰属 | 次のdamage拡張候補。ただし独立summon subsystemの研究が先 |
| Looting + Prospector | Controlで目的分離を導入済み | drop率/独立抽選/stacking・emeraldやconsumable価値 | farming目的が必要な場合に先行可能。DPSへ換算しない |
| Echo revisit | action cadenceとfinite count | repeat選択・animation cost・CD開始・combo/trigger/Void | 依然Evidenceが先、無料damage/cooldown近似禁止 |
| Enigma revisit | Soulゲージ軌跡が既存 | 現行version中間ゲージと発動率、absolute/fraction cap | Soul→chance実測が先。固定chance/線形mapping禁止 |

親項目「25〜30種類」は意味ある限定runtime28種へ到達したので完了提案が可能。ただし親を閉じても2-1Jなどのpartial・残り5種・全33完全対応とは独立。今回のロードマップは提案待ちとして進行中を維持する。
