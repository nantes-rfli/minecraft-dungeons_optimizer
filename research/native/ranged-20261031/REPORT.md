# 遠距離通常攻撃のRaw / Native復元 — Bow起点

解析日: 2026-10-31。対象はローカルで1.17.0.0とされているRawとWin64 Native。
**解析のみ。Optimizer変更、runtime昇格、PR、Site反映なし。**

## 結論

Bowの通常矢について、Rawの攻撃定義から、装備→攻撃component→矢の倍率→命中時の
Gameplay Effect計算までを静的に接続した。チャージ完了フラグ、次回攻撃可能時刻、
プレイヤーの行動制限、TimerManagerの期限判定も復元した。

- **Power・追加効果・対象側補正を適用する前の通常矢の基準ダメージは、未チャージ50、
  フルチャージ125。** 通常経路では部分チャージ率の連続補間ではなく完了フラグで切り替える。
- Bowの設定はAttackRateSeconds ≈0.42秒、ChargeTimeSecond ≈0.35秒。
  速度倍率1、通常のチャージ、他の行動制限なしでは、最速の反復攻撃を支配する設定時間は
  未チャージ約0.42秒、毎回フルチャージ約0.77秒。初弾が既に発射可能なら、
  チャージ開始から完了タイマーまでの設定時間は約0.35秒。
- **0.77秒を実際の発射間隔として固定してはいけない。** 発射には入力・発射可能時刻・
  チャージ完了callbackの順序があり、タイマーは期限を「超えた」tickで処理する。
  tick列が与えられれば静的に得た状態遷移で計算できるが、Rawだけから一意の実秒値にはならない。
- Shortbow / Longbow / Powerbow / HeavyCrossbowは同じNative攻撃定義と計算経路を共有する。
  Rawの継承を解決してパラメータを差し替える横展開は可能。全遠距離武器・固有効果・
  特殊矢・複数弾を一括して対応済みとはしない。
- 特定の表示Powerから最終ダメージ整数を確定するところまでは到達していない。
  残る数値上の最小障害は、内部float32 ItemPowerと実効属性の入力、および#217から残る
  **外部math importの正確な出力**。これを「Windowsで新規実測しないと式を得られない」
  という障害と混同しない。

## 1. 再利用した成果と入力の同一性

参照した成果:

- [PR #217](https://github.com/nantes-rfli/minecraft-dungeons_optimizer/pull/217): 復元Native image、Power式、math importの識別。
- [PR #218](https://github.com/nantes-rfli/minecraft-dungeons_optimizer/pull/218): 装備のPowerEffectsからspec ItemPowerへ至る共通適用経路。
- [PR #219](https://github.com/nantes-rfli/minecraft-dungeons_optimizer/pull/219): 標準playerのAbilitySystem型、反射dispatch、stack/属性集約の演算順。

ローカルの後続成果は既存worktree
`/Users/nanto/.codex/worktrees/native-hp-integration/minecraft-dungeons_optimizer/research/native/`
にある`power-117-handoff.md`、`armor-hp-connection.md`、`armor-hp-final-path.md/json`を読んだ。
新たにloaderを起動し直してはいない。

| 入力 | SHA-256 |
|---|---|
| Dungeons-Win64-Shipping.exe | `eab80a0ba0c3c4c1bbae6e0e40ed8ada5dc26bf3008b7385579168b793bf0eb8` |
| recovered mapped-image.bin | `04a990ccbc67454505724a28043eccc595f613a0a877ae55386a4fa8656434d3` |

RVAは後者に対するもの。解析時image baseは`0x140000000`。
imageは`local-game-data/phase6.8/native-stage2/self-file-experiments/verified-copy-20261024-a/mapped-image.bin`。

Rawは既存`research/raw/game-data-raw-structural-inventory/shards/part-*.json.gz`。
今回選んだ23パッケージについて、元の`QuickBMS 1.17.0.0`配下46ファイルを
manifestのsize / SHA-256と照合した。FloatProperty / IntPropertyはvalueRangeの実バイトも再読した。
完全な出典と継承は同じフォルダの`raw-evidence.json`に保存した。

**Rawとexeが厳密に同一buildである証明、公式配布物としての認証、実ゲームとの独立照合は未完了。**
一致するローカル入力への復元結果と、配布版全般への保証を区別する。

## 2. 代表武器Bow: Raw値とNative既定値

`BP_BowInstance`の継承:

```text
/Game/Actors/Equipment/RangedWeapons/Bow/BP_BowInstance
  -> /Game/Actors/Equipment/RangedWeapons/BP_ArrowBaseRangedWeapon
  -> /Script/Dungeons.RangedWeaponGearItemInstance
```

武器は`part-022 / packages[36]`、矢`BP_BowArrow`は同shardの`packages[35]`。
以下の位置は各`.uexp`内の半開区間。名称`AttackDefintion`はゲームデータの綴り。

| 値 | float32値 | bits | 根拠 |
|---|---:|---|---|
| 矢damage B | 50 | `42480000` | BP_BowArrow.uexp `[810,814)` |
| AttackRateSeconds R | 0.41999998688697815 | `3ed70a3d` | BP_BowInstance.uexp `[592,596)` |
| ChargeTimeSecond C | 0.3499999940395355 | `3eb33333` | 同 `[621,625)` |
| ChargeDamageMultiplier K | 2.5 | `40200000` | 同 `[650,654)` |
| ProjectileDamageFactor P | 1 | `3f800000` | Rawにoverrideなし、native constructor `0xb19418` |
| ActiveCancelPorintFactor A | 1 | `3f800000` | Rawにoverrideなし、native constructor `0xb19404` |

通常ProjectileDefinitionはBP_BowArrow_C、NumberOfProjectiles=1、DelaySeconds=0、
DelaySecondsPerProjectile=0。ChargedProjectileDefinitionはnativeで空、Bow/親Rawに上書きなし。
したがって通常のcharged Bowも同じ矢classを選ぶ。

`BP_BowArrow -> BP_Arrow -> BP_Projectile -> native Arrow`。
親BP_Projectileのdamage=20はBowArrowの明示値50で上書きされる。
native Arrow constructor `0x8231b0`はBaseProjectile constructor `0x8233d0`を呼ぶ。

省略値を機械的に0にしていない。RangedWeapon constructor `0xb19370`が、
AttackDefintionを`+0x500`に作り、次の値を明示設定している。

```text
struct +0x3c R=1; +0x40 C=0
+0x44 chargeVelocity=2; +0x48 K=1; +0x4c A=1
+0x50 projectileVelocity=1; +0x54 P=1
```

`0xb193e5`のqword `0x000000003f800000`はR=1とC=0を同時に設定する。
未対応効果を0にした例ではなく、Nativeで確認した既定値である。

Reflection descriptor:

| プロパティ | descriptor RVA | struct offset |
|---|---|---|
| AttackRateSeconds | `0x4264d10` | `+0x3c` |
| ChargeTimeSecond | `0x4264ce8` | `+0x40` |
| ChargeDamageMultiplier | `0x4264c98` | `+0x48` |
| ProjectileDamageFactor | `0x4264c20` | `+0x54` |
| BaseProjectile.damage | `0x41f0d20` | object `+0x3fc` |

装備更新`0xa2ce00`は武器`+0x500`をcomponent`+0x3b0`へコピーする。
copy helper `0xa0b350`は上記各floatを同じoffsetへコピーする。
よって使用時はcomponent `R:+0x3ec / C:+0x3f0 / K:+0x3f8 / P:+0x404`。

## 3. ダメージの共通式

以下、`F`は各命令でのbinary32丸め。今回の限定再生はMXCSR=`0x1f80`
（nearest/ties-even、FTZ/DAZ off）。実ゲームのFP状態を取得したものではない。

### 3.1 装備から矢への倍率

`0xa19894..0xa198b8`:

```text
W = F((charged ? K : 1) * P)
projectile[+0xc24] = W
```

chargedはcomponent`+0x2d9`から受け渡される。
経路は`0xa2d5a0 -> 0xf733b0 SpawnProjectileMulticast`、登録pair
`0x3491710`→exec`0xf75080`→virtual`+0x428`→`0xa32950`→`0xa32130`
→`0xa19cf0`→`0xa19610`。
reflection lookupを含む静的な接続であり、実オブジェクトでの連続実行を観測したものではない。

`0xa19894`の分岐はboolだけを読み、保持時間の比率を掛けていない。
倍率K=2.5の「途中まで引いたら1.75」などの補間は行わない。

### 3.2 命中時の基準値

`0x83b7a8..0x83b7c0`:

```text
H0 = F(F(G * W) * B)
```

Gはprojectile`+0xc28`。constructor`0x823589`で1となり、Growing等の別経路
（例`0x9b7730`）が変更する。**GをPower係数と誤認しない。**
通常の追加効果なしの矢ではG=1という既定経路を使う。

陸上・G=1・通常矢の条件では:

```text
Bow 未チャージ: F(F(1 * F(1 * 1)) * 50) = 50
Bow チャージ済: F(F(1 * F(2.5 * 1)) * 50) = 125
```

この値は**衝突時基準値**。画面表示整数や任意の敵のHP減少量そのものではない。

水中分岐もある。`0x84a048..0x84a086`が、対応フラグ`+0x3b6`とowner状態に応じて
projectile`+0xc20`を設定する。`0x7c31e0`は`StatusEffect.Underwater`あり、
`Immunity.Underwater`なしを確認する。
`0x83b7cb..0x83b887`はこのフラグが立つ場合、現在速度のノルム / movement`+0x138`の
比率を0..1へ制限してH0へ掛け、最終的に`F(H0 * 0.33000001311302185)`〜H0へ制限する。
分母の絶対値が約1e-8以下の場合の分岐もある。水中を陸上の固定ダメージと同一視しない。

さらに`0xc14d00`等のイベント経路が命中値を変更できる。
値が未確認のenchantment / 固有効果 / 特殊矢を無効とみなしていない。

### 3.3 Powerと攻撃・被ダメージ属性への接続

RangedWeaponのPowerEffects配列`+0x470`は、constructor`0xb19448`以降で
`RangedDamageIncrease`と`RangedHealingIncrease`を設定する。
Bowとその武器親RawにはPowerEffectsの上書きがない。

```text
RangedDamageIncrease getter 0xf1c0e0
  -> constructor 0xb7bcb0
     -> tooltip/functionにも0xb88f20を登録
     -> effect class getter 0xf1b4f0
        RangedDamageItemPowerGameplayEffect
        -> constructor 0x7a3340
           -> custom class getter 0xf1bb30
              ItemPowerRangedDamageModCalculation
              -> vtable 0x34434d0 +0x240 -> 0x7b02e0
                 -> spec internal ItemPower reader -> 0xb88f20
           -> target attribute accessor 0x7cfb30
              RangedAttackItemPowerFactor
```

共通装備適用のItemPower`+0x480`→spec`+0x298`は#218の経路を再利用できる。
RangedAttackItemPowerFactorはdescriptor `0x42660e0`でattrset`+0x30`、
constructor`0xf72a20`のbase既定値は1。
effectはInfinite、modifier operationはMultiplicitive（native綴り）という
#219のenum/構造体offsetと同じ接続になる。

Power scalarは#217で復元済みの次式:

```text
x = 内部float32 ItemPower（表示Power整数そのものではない）
d = float32bits(0x4127b7b8) = 10.482353210449219
q = F(F(x - 1) / d)
e = F(clamp(q, 0, 3) * 19)
y = external_math_import(1.25f, e)
t = max(F(F(y * 0.75f) - 0.75f), +0)
M(x) = F(F(t + t) + 1)
```

Nativeの根拠は`0xb8f610`（正規化）、`0xb88f20`（damage multiplier）。
math importは#217で`powf`の名前/hash/parser/IAT接続を条件付き実証しているが、
実CRT DLLの数値出力は検証されていない。ホストの`pow`で穴埋めしない。

また**有効属性Q=RangedAttackItemPowerFactorを単にM(x)で置換しない**。
#219で判明したstack/aggregatorの演算順を同じ有効属性にも適用する必要がある。
たとえばbase=1、既定coefficient=1/pre=0/post=0、curveなし、有効な乗算modifierが
1 stack・1 channelで一つだけなら、custom評価後のmagnitudeをmとして:

```text
m = F(0 + F(1 * F(0 + M(x))))
ms = F(F(1 * F(m - 1)) + 1)
mc = F(F(1 + ms) - 1)
Q = F(F(F(+0 + 1) * mc) / 1)
```

これらを実数上の恒等変換で消すと、binary32の端数が変わり得る。
複数modifier、タグqualification、Override、stack数が異なれば、#219の一般aggregator式を使う。

命中成功側の通常effectは`BaseProjectileDamageGameplayEffect`:
`0x849a48 -> 0xeb1f50 -> 0x828950`。
RangedAttackHitChanceMultiplierを使う分岐`0x8499fd..0x849a2d`の後に選択される。
反対側は別effectなので、全発射がこの成功経路を通るとは仮定しない。

impact helper`0x82f7a0`が符号反転した命中値をset-by-callerへ設定し、
通常effectのcustom class`RangedDamageModCalculation`は以下の計算を行う。
`H`をイベント等の処理後の正の命中値、`I`をRangedAttackDamageIncreaseとする。

```text
v0 = F(F(-I + (-H)) * TakeDamageMultiplier)          # 0x7af4b0, vcall +0x250 -> 0x7cf380
v1 = F(F(v0 * DamageMultiplier) * DealDamageMultiplier) # 0x7aef10
v2 = F(v1 * DifficultyDealDamageMultiplier)           # 0x7af740
v3 = F(F(F(Q * v2) * RangedAttackDamageMultipler)
                         * TakeRangeDamageMultiplier) # 0x7b0370, ending 0x7b0446
```

`Multipler` / `TakeRange`は名前をNativeの綴りで記した。
これは**signed custom magnitudeの式**。最終Healthの書き戻し・無敵・吸収・UI丸めを
この式だけで確定したことにはしない。各属性はeffect specのcapture結果であり、
未確認の属性を1または0で埋めていない。

この接続により、通常矢のRaw値と#217のPower式が別々の知識で終わらず、
実際のdamage calculationのQ入力で合流することまで確認できた。

## 4. チャージと実効発射周期

### 4.1 発射後の期限

RangedAttackComponent vtable`0x3256140`の`+0x420 -> 0xa0fa40`が発射本体。
RangedAttackSpeedMultiplierを`0x7cfd70 -> 0x37c370`で取得する。
descriptor`0x4266068`でattrset`+0x3c`、native base既定値は1。

`S_f`を発射時に取得した実効速度倍率、`now`をWorld`+0x528`のfloat32時刻、
`w`をItemTypeの追加待ち時間とすると:

```text
r = F(F(1 / S_f) * R)          # 0xa0fc6d..0xa0fc87
nextAllowed = F(F(r + now) + w) # 0xa0fcc6..0xa0fcda, component +0x10c
```

R/Sを一命令で計算しているわけではない。逆数の丸め→乗算の順序を保持する。
またwは速度倍率で割っていない。

Bowのw=0の根拠:

1. Bowのnative ItemType initializer`0x14da80`がbuilder`0xb1c110`を使用。
2. builder`0xb1c1cf`が`+0xa8`へ0を明示設定。
3. Bowのその後の呼出はcallback設定`0xb67770`（領域`+0xb8`以降）、tag設定`0xb64820`、
   description設定`0xa7b460`であり、`+0xa8`を変更しない。
4. copy`0xb1bd36..0xb1bd3c`が`+0xa8`を保持。
5. build`0xb6501b..0xb65023`がそれを引数へ渡し、`0xb1b5ab..0xb1b5b3`でItemType`+0x98`へ格納。
6. 発射時に装備ItemIdでregistryを引き、`0x6df440`でItemType`+0x98`を読む。

0はRawに欄がないから置いた値ではなく、native初期化/コピー/読み出し経路に基づく。
Shortbow`0x16ed10`、Longbow`0x164a80`、Powerbow`0x16a330`、HeavyCrossbow`0x161850`
も同じbuilder既定値を保持する。追加の`0xb64c00`は`+0x60`の配列へ要素を追加する処理で、
待ち時間`+0xa8`のsetterではない。

### 4.2 発射可否は期限二つと状態判定

try-fire`0xa10480`→gate`0xa14c00`→base gate`0x9912d0`。
弾数やplayer状態の確認後、`0x991369..0x991388`で:

```text
canFire = (now >= component.nextAllowed) and (now >= owner.actionAllowed)
```

owner側は`+0xa78`。発射本体はplayer virtual`+0x970`を呼び、
標準PlayerCharacter vtable`0x31d27d0 +0x970 -> 0x7d2b90`が期限を書き込む。

```text
a = F(F(r * 0.6000000238418579) * A)
b = F(r * 0.800000011920929)
owner.actionAllowed = F(now + a)
owner[+0xa7c] = F(now + b)
```

0.6/0.8はbase attack component constructor`0x978ae1 / 0x978aeb`の既定値。
Bow A=1ならa<rであり、この攻撃が設定したactionAllowedは武器側期限より短い。
他の行動・状態がowner期限を書き換える場合は、その値を保持して判定する。

### 4.3 チャージ開始と完了

`0xa10750`は押下でBegin処理`0xa109d0`へ進む。C>0なら、非チャージ武器用の
自動反復`0x98b480`には入らない。

`0xa109d0`は古い終了処理timerをclearし、`+0x2d9=0`に戻す。
`0xa10cae`付近で通常のチャージでは:

- now >= nextAllowedなら`0xa10ec0`へ直行。
- まだ期限前なら`F(nextAllowed-now)`後に`0xa10ec0`をtimerで呼ぶ。

component`+0x3a1`の即時チャージ分岐も存在するが、この値の意味を一般装備へ推定適用しない。
今回の通常チャージ条件はfalse。

`0xa10ec0`はその時点の速度`S_c`を取り直し、次のtimerを設定する。

```text
c = F(C / S_c)                  # 0xa1112e..0xa1113b
timer(c, callback=0xa14e00)      # 0xa11195 -> 0x2312c00
callback: charged = true        # 0xa14e2c, component +0x2d9
```

押し続けた時間からchargedを毎回直接比較していない。完了callbackが走る前の同時刻の
releaseは、理想的な実数時間でC秒経っていても完了済みとは限らない。

release`0xa17930`はC>0の通常player経路でtry-fireを呼び、後処理`0xa17ab0`が
charge timerをclearしてcharged=falseへ戻す。C<=0の武器は押下のrepeat経路へ進む。
repeat処理`0x98b040`はweapon/owner期限のmaxを見て次回callbackを設定する。

### 4.4 APIの時間と実際の時間を区別する

`GetWeaponChargeTime`の登録exec`0xf74720`→本体`0xa23320`:

```text
T_api = F(F(C + R) / S)
```

これはC/Sだけではない。同時に、実際の経路の`F(F(1/S_f)*R)`、
別時点での`F(C/S_c)`、w、timer、入力判定の完全な代用でもない。

通常Bow、S_f=S_c=1、w=0、G等の追加効果なし、発射後すぐ次の押下を受理し、
完了後すぐreleaseを受理できるという条件で:

| 区間 | Native設定値 |
|---|---:|
| 発射後の武器待ち時間r | 0.41999998688697815 s |
| チャージ開始後の完了timer c | 0.3499999940395355 s |
| API値 F(R+C) | 0.7699999809265137 s |
| rとcを実数として足した値 | 0.769999980926513671875 s |

この組合せではたまたま和がfloat32で表せる。一般の速度倍率でも同一とはしない。
未チャージ射撃を繰り返す場合はreleaseが武器期限以降に必要で、約0.42秒が
この条件下の基準となる。毎回完了を待つ反復なら約0.77秒が基準となる。

### 4.5 TimerManagerまで確認した理由

`SetTimer`に相当する`0x2312c00`は、duration<=0なら通常のtimer作成に進まない。
正のdurationをfloat32からdoubleへ変換する。

- そのframeでtimer managerが既にtick済みなら、内部double clock`+0x140`を足してactiveにする
  （`0x2312e29..0x2312e77`）。
- 未tickならpendingへ入れ（`0x2312e7e`以降）、tick末尾でその時の内部clockを加算する
  （`0x2322f5a..0x2322f6c`）。

tick`0x2322870`は同一frameの二重tickを抑止し、`0x23228ca..0x23228d7`で
float deltaをdoubleへ変換してclockを進める。
期限判定`0x2322a65..0x2322a79`は`expiry >= internalClock`ならそのtimerをまだ実行しない。
すなわち**internalClock > expiry**でcallback側へ進む。

したがって厳密な実効周期は、次の順序を与えた状態遷移として計算する。

```text
fire_i -> nextAllowed_i を設定
press_(i+1)を受理
  -> 必要ならnextAllowedまでのtimerを待つ
  -> チャージ開始callbackでS_cを読みcを設定
  -> timer期限を超えたtickでcharged=true
release_(i+1)を受理
  -> 弾数・状態・weapon期限・owner期限を通ればfire_(i+1)
effectivePeriod_i = time(fire_(i+1)) - time(fire_i)
```

World時刻はfloat32、TimerManager内部時刻はdoubleの累積値であり、
単に`ceil(0.77 * FPS)/FPS`へ置換する根拠もない。
入力処理がtickの前か後か、速度変更がいつ入るか、pending timerの扱いが効く。
**固定FPS・固定入力遅延・特定の余分なフレーム数を推測で補っていない。**

## 5. 他武器への横展開

下表は同じ通常矢の式に、それぞれのRawとnative既定値を入れた結果。
ダメージはPower/追加効果/対象補正前の陸上基準値。
時間はS=1・上記ItemType既定のw=0における設定値であり、実測周期ではない。

| 武器 | 未チャージ基準値 | charged基準値 | R | C | GetWeaponChargeTime |
|---|---:|---:|---:|---:|---:|
| Bow | 50 | 125 | 0.41999998688697815 | 0.3499999940395355 | 0.7699999809265137 |
| Shortbow | 37.5 | 61.874996185302734 | 0.20999999344348907 | 0.125 | 0.3349999785423279 |
| Longbow | 60.000003814697266 | 180 | 0.41999998688697815 | 0.3499999940395355 | 0.7699999809265137 |
| Powerbow | 100 | 300 | 0.41999998688697815 | 0.3499999940395355 | 0.7699999809265137 |
| HeavyCrossbow | 135 | 適用なし | 1（native既定） | 0（native既定） | 1 |

ShortbowはP=0.75、K=float32(1.65)。`F(K*P)`を先に作るため61.875とbit一致しない。
LongbowはP=float32(1.2)、K=3で、未チャージ60とbit一致しない。
Powerbowの矢はBowArrowを継承し、damageのoverrideがないためB=50。
HeavyCrossbowのR/C省略は親Rawにもoverrideがないためnativeの1/0を使える。

横展開のために武器ごとの推定damage式や推定reload時間を追加する必要はない。
ただし各武器のinheritance、ProjectileDefinition / ChargedProjectileDefinition、発射弾数、
DelaySeconds / DelaySecondsPerProjectile、ItemType追加待ち時間、native/Blueprint override、
固有効果は個別に解決する必要がある。たとえば複数弾なら一発の周期と一斉射全体の周期を
区別する。今回の5例の結果から全武器を既知として埋めない。

## 6. 残る最小障害と「実行時情報は不可欠か」

| 求める結果 | 現時点の障害 | 新規実行時情報の必要性 |
|---|---|---|
| Raw/CDO条件の基準ダメージ、チャージ方式、発射制限式 | この通常Bow経路については復元済み | 不可欠ではない。今回取得せずに復元した |
| 他の通常武器へ共通式を適用 | 個別パラメータ、継承、override/特殊処理の確認 | 原則静的に進められる。今回5種で確認 |
| 特定内部Power xに対するbit単位のPower scalar | 外部math providerの正確な実装/出力、FP条件 | Windows起動や動画は論理的必須ではない。hashを固定した対応DLLを別途静的解析/限定再生する方法でも解消できる。現ローカルinventoryには該当CRTが見当たらない |
| 表示Power整数だけからの一意な最終damage | 表示の逆変換が一意でない。x、effect stack/qualification、capture属性、hit分岐等が不足 | 特定実個体を主張するなら、その入力を証明する既存save/capture等が要る。仮定を明示したCDOモデルの計算には実プレイ観測そのものは不要 |
| 特定プレイの厳密な発射間隔 | 入力受理時刻、tick delta/順序、World/Timer clock、速度/行動状態が未指定 | 実際のそのプレイを再現するなら状態/時系列情報が必要。ただし定数を知るための新規測定ではない。固定条件のシミュレーションは既存Nativeから可能 |
| 画面に出るdamage整数または対象HPの差分 | custom magnitude以後の対象処理と表示丸めは今回未完結 | 追加静的解析の余地がある。未解析であることだけからruntime必須とは言えない |

最小の次の解析作業は、目的に応じて一つを選べる。

1. bit単位のdamageを優先するなら、**math providerの同定とその実装の取得/検証**。
   同時に入力xを表示整数から推定しない。
2. 特定入力条件の周期を優先するなら、**tickと入力の条件を明示したnative状態遷移モデル**。
   既存コードから再現でき、測定用Windowsや動画に戻る必要はない。
3. 全武器表を優先するなら、**同じRaw継承解決と例外検出を残りの武器へ適用**。
   共通式を再発見する作業は不要。

#219で挙げられた実オブジェクトcaptureは「ある実プレイの最終値を実証する」手段として有効。
今回の結果は、それが通常遠距離攻撃の式を復元するための必須条件ではないことを示す。

## 7. 再現と検証の限界

同ディレクトリのスクリプト:

```sh
python3 -B local-game-data/ranged-native-20261031/extract_raw.py
python3 -B local-game-data/ranged-native-20261031/check_ranged.py
```

`extract_raw.py`は元manifestから対象を再抽出し、source hashとfloat/intのvalueRangeを照合。
`check_ranged.py`はmapped imageの全体hash、reflection descriptor 7件、vtable等pointer 9件、
個別命令13件を確認し、Unicornで**4,158回の限定区間**を再生する。
damage積、Rの逆数乗算、C/S、API式、期限加算、行動制限時間、二期限gate、
capture後のranged倍率積、timerの厳密比較が対象。
独立の有理数→nearest/ties-even binary32丸めモデルとの不一致は0。

各区間は最大64命令・100ms、importやエンジン関数を呼ばない範囲に限定。
fixtureのG=1、速度、属性、時刻は明示的入力であり、観測済み実ゲーム値と称さない。
loaded UFunction、Blueprint VM、authority/network、実CRT、effect適用全体、
対象の最終Health更新を通したテストではない。
比較成功から未知の効果を0、未観測の属性を1に変更することはしない。

機械可読の結果は`verification.json`、対象Rawの出典は`raw-evidence.json`。
各asmファイルは探索・読解用。任意アドレスからの逆アセンブルには途中命令から始まるものが
含まれ得るため、根拠に使う際は関数先頭または検証済み命令境界から読む。
今回のcheckerのreplay範囲は命令境界を固定している。

元checkoutに元々stagedされていたUI等の9ファイルは変更していない。
成果物はgitignore対象の`local-game-data/ranged-native-20261031/`にのみ保存した。
