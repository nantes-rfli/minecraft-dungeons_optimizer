# Mercenary Armor: Native最大HP経路（PR #218後）

調査日: 2026-10-29〜30。基準は `e0a239a3623a4b16a4cd7cd0eb13f83193ed1f1a`
（PR #218 merge後のmain）。**research only / held**。Optimizer、Formal、
AdoptionDecision、Runtime Promotion、Siteは変更しない。新規計算可能装備はゼロ。

## 結論

`0x363aff`から先を、標準プレイヤーのcomponent型、Active Effect、modifier計算、
属性aggregator、MaxHealthの書き戻しまで静的に接続した。HealthComponentから
baseを設定する経路も特定した。**標準の初期設定値は500だが、任意の実プレイ状態の
有効baseが500だとする証拠ではない**。

最終HPは単純な `500 * healthMultiplier` ではない。少なくともstack補正と
aggregator内のbinary32演算をその順序で通る。これらのleaf関数は復元Nativeを
実行し、独立の有理数丸めモデルと照合した。4,120 stackケース、461 channelケースで
不一致ゼロ。実ゲームのeffect適用、CRT、タグ判定を実行したテストではない。

残る最小の実用的障害は、**一回の装備適用に対応する実オブジェクト状態と実CRT出力**。
既存の静的イメージはゲーム起動前の復元物なので、実際のUFunction、CDO、タグ、
他の効果、base、ItemPower、MXCSRを観測できない。最後の節に、必要な箇所だけを
取得する具体的なcaptureを定義した。全ローダー再実行やUEビルドは不要。

## 根拠の範囲

- [前回の接続調査](armor-hp-connection.md)、[Power復元](power-117-handoff.md)を再利用。
- Native exe SHA-256: `eab80a0ba0c3c4c1bbae6e0e40ed8ada5dc26bf3008b7385579168b793bf0eb8`。
- 復元イメージ SHA-256: `04a990ccbc67454505724a28043eccc595f613a0a877ae55386a4fa8656434d3`。
- RVAはこのイメージに限定。解析時image baseは `0x140000000`。
- [metadata](armor-hp-final-path.json)と[checker](scripts/check_armor_hp_final_path.py)が
  code span、直接call、仮想table、演算instruction、enum、Raw sourceを検証する。
- Raw/exeの同一build証明、公式配布元の認証、実測との独立照合は未完了。
  名前やenumだけから挙動を推定せず、演算命令と接続している。

## 1. 所有者componentと仮想dispatch

Raw `part-004 / packages/63` の `BP_PlayerCharacter` は native
`/Script/Dungeons.PlayerCharacter` を継承する。CDOの `AbilitySystem` はexport 214
`AbilitySystemComponent` を参照し、そのclassは `DungeonsAbilitySystemComponent`。
export 214はnative player templateからの継承で、12-byte payloadには`None`終端と
zero object-guid markerのみ。component型の根拠は実行時推測ではなく、この明示参照。

Nativeでも同じ接続がある。

| 経路 | 根拠RVA / field |
| --- | --- |
| PlayerCharacter登録→constructor | `0xf5de30` → `0xf5fa50` → `0x7e1110` |
| Player constructor→BaseCharacter constructor | call `0x7e1150` → `0x794ad0` |
| BaseCharacterのability subobject生成 | `0x794f42` → class getter `0xed3670`; `0x794f62` → factory `0x1207580`; resultをactor `+0x8b0`へ格納 |
| DungeonsAbilitySystemComponent constructor | `0xed4870` → base `0x356cd0`; vtable `0x33f5530`を設置 |
| ownerからability interface取得 | item loop `0xaea616` → `0x3b2450` → interface virtual `+0x10` |
| Base/Player interface vtable | `0x31b6378` / `0x31d32f0`; slot `+0x10` → `0x7b9f50` |
| interface getter | interface this `actor+0x748` の `+0x168`、すなわちactor `+0x8b0`を返す |
| apply virtual | `0x33f5530 + 0x590` → **`0x362ce0`**。このclassで別overrideにはならない |

したがって、標準BP playerをownerとする装備について、#218の「ownerのoverride不明」は
具体的なRaw/native default経路まで解決した。実個体のowner/class/vptr、authority条件、
インスタンス変更が観測済みになったわけではない。

## 2. Gameplay Effectとcustom計算への接続

前回のArmor native default PowerEffectsは `MaxHealthIncrease` と
`ArmorDamageIncrease`。今回、Health effect constructor `0x7a148b` のeffect `+0x30=1`
をnative duration enum table `0x30f50f8`に接続した。`1=Infinite`。
modifier operation byte `1` はenum table `0x30f8580`で
`EGameplayModOp::Multiplicitive`（Nativeの綴り）。後述の演算でも乗算チャネルを確認。

| 適用段階 | 接続 |
| --- | --- |
| self適用 | `0x363aff` → `0x362ce0`。authority/prediction、modifierの属性有無、適用条件等を検査 |
| 非instant効果 | `0x363092`のduration判定 → `0x3630b5` → `0x3a8180`。既存stack再利用またはactive effect作成 |
| specのtarget capture更新 | `0x3a8b05` → `0x3ac060` |
| modifier magnitude算出 | `0x3a8b0f` → `0x3abce0`。effectのmodifier `+0x48`を評価しspec `+0x1b8`配列へfloat格納 |
| 共通magnitude評価 | `0x3abd54` → `0x3a9c70` → custom branch `0x3a9f06` |
| custom計算呼出 | `0x3a9f6d` → `0x4083f0` |
| 追加と有効化 | `0x3a9208` → `0x3b9740` → `0x3aca10`。タグ要件に応じinhibition更新 |
| 非inhibited modifier追加 | `0x3aca79` → `0x3a6950` |

計算が失敗すると `0x3abd5d` はNative自身のfallbackとしてmagnitudeを0へ書く。
**未確認効果を解析側で0に置換する根拠にはしない**。成功branchと有効modifierを
確認しない限り、最終HPを算出済みにしない。

`0x4083f0`の反射経路も次まで特定した。

1. `0xffb20`が`CalculateBaseMagnitude`のFNameを `0x44758e8` に作る。
2. `0x40844d`でこの名前を `0x123c6e0` に渡し、得たUFunctionを
   object virtual `+0x200`へ渡す（`0x40845d`）。
3. health calculation vtable `0x3443720 + 0x200` は `0x12443e0`。
   object/関数flagsを確認しframeを構築、`0x12446c0`から `0x1130c30`へ。
4. `0x1130ca3`は **選択UFunction `+0xc0`** を呼ぶ。
   native registration `0x40a030` → `0x11338a0` は名前/exec pair
   `0x30f9760`（`CalculateBaseMagnitude`, `0x40acc0`）を登録する。
5. #217で検証済みのexec bridge `0x40ad57` は `+0x240`を呼び、health vtableでは
   `0x7b0300` → spec `+0x298` reader → `0xb94940` となる。

これは登録・lookup・invokeの**静的接続**。ロード済みのUFunction `+0xc0`値や
lookup結果を観測した連続executionではない。その一点はcaptureで直接確認できる。

## 3. MaxHealth集約と正確な演算順

`F`はその都度のbinary32演算結果。以下の再現テストではMXCSR=`0x1f80`
（nearest/ties-even、FTZ/DAZ off）。実ゲーム環境は未観測。

入力のhealth scalar `H` は#217の `0xb94940`をそのまま再利用する。

```text
x = spec +0x298 の内部float32 ItemPower
q = F(F(x - 1) / float32bits(0x4127b7b8))
e = F(clamp(q, 0, 3) * 19)
y = 実Windows math import(1.25f, e)   # powf; 数値出力は未検証
H = F(max(F(F(y * 0.75f) - 0.75f), +0) + 1)
```

その後、汎用custom評価は `F(post + F(coefficient * F(pre + H)))` と
任意のFinalLookupCurveを通る。係数・加算・曲線は#218で確認したconstructor defaultと
実ロード状態を区別する。表示Power整数は`x`を一意に決めない。

まず `0x3a6a6c` → `0x3d2510` がstack数 `s` を適用する。
operation bias table `0x30de8c8` は `[0,1,1,0]`。

```text
operation == Override: stackedMagnitude = magnitude
otherwise:
  stackedMagnitude = F(F(float32(max(s, 0)) * F(magnitude - bias)) + bias)
```

`0x3a6aa8` → `0x3b1250`は属性descriptorでaggregatorを検索/作成する。
新規aggregatorのbaseはcurrent/base reader `0x37c3d0`から取得し `+0x4c`へ格納。
`0x3a6b20` → `0x3d1130`はoperationで16-byte配列headerを選び、40-byte recordに
magnitude (`+0x10`)、effect handle (`+0x18`)、prediction flag (`+0x20`)等を追加。
タグ等によるqualificationは `0x3d2d80` → `0x3d9b00`で更新され、record `+0x21`を使う。
その判定結果は状態依存であり、今回のleaf replayでは明示的なfixture入力。

`0x3d30e0`の1 channel評価は次のとおり。配列の順序も保持する。

```text
qualified Overrideがあれば、先頭のそのmagnitudeを返す
A = +0
for qualified Additive m:       A = F(A + m)
M = 1
for qualified Multiplicitive m: M = F(F(M + m) - 1)
D = 1
for qualified Division m:       D = F(F(D + m) - 1)
if abs(D) <= float32bits(0x322bcc77): D = 1
# Native COMISS/JAではunorderedの場合もD=1側。
result = F(F(F(A + base) * M) / D)
```

`0x3d31e0`は各channelの出力を次のchannelのbaseに渡す。channel数、実際の順序、
有効modifier、overrideの有無を省略して「すべて掛け算」に置換してはいけない。

**MercenaryのHealth効果だけが1 stack・1 channelで有効**、他のmodifierなし、
constructorのcoefficient=1/pre=0/post=0/curveなしが保たれ、有限のhealth scalarが
`H`である場合に限って、経路は以下に簡約できる（まだ最終HPの採用式ではない）。

```text
m = F(F(1 * F(H - 1)) + 1)   # stack helperを残す
M = F(F(1 + m) - 1)           # aggregatorの実際の順序
HP = F(F(F(+0 + B) * M) / 1) # Bはその時点のaggregator base
```

合成入力 `B=500 (0x43fa0000)`, `m=0x3f800001`で、Native channelの結果は
`0x43fa0000`。単純な `F(B*m)` は`0x43fa0002`。
この差は実命令のreplayでも確認した。**実装の丸め差を示す反例であり、そのmagnitudeが
実際のMercenaryで発生したゲーム測定ではない**。

書き戻しまでの経路:

```text
3d1130 → 3d1c00 (dirty; batching時は後でflush)
 → delegate 382e20 (3b1250で登録)
 → 3bdb40 → 3d2c60 → 3d31e0 → 3d30e0
 → 3ba190 → 38f150 → 3c9bd0
 → HealthAttributeSet virtual +250 (7cebc0)
 → numeric property virtual +350 → 属性storage
```

MaxHealthのdescriptorは前回確認済みのHealthAttributeSet `+0x38`。
`0x7cebc0`の条件付き変更対象はHealth、Shield、Endurance、Barrier、BarrierCharge。
MaxHealthを丸めてinteger化する処理はこのhookにはない。

propertyの型もNative登録から追跡した。MaxHealth登録record `0x42234c8`は
`+0x18 & 0x1f = 10`、field offset `+0x24 = 0x38`。
Healthの反射構築 `0xf05200` → `0x1237d80` → property loop `0x1237ebd` →
`0x12386f0`がこのrecordを読む。switch table `0x123a0f4[10]`は `0x1238e64`、
このcaseはFloatProperty class getter `0x1228750`を使い、propertyに
vtable `0x351fa80`、要素size 4を設定する。field offsetは `0x1202c81`で
property `+0x44`に保存される。

`0x3c9c46`はfloatをdoubleへ変換してnumeric writerに渡す。
**FloatProperty vtable `0x351fa80 + 0x350` → `0x1230d60`** は
`CVTSD2SS` → `MOVSS [RDX]`。したがって標準経路では最後もfloat32 storageであり、
有限の通常値についてこのfloat→double→float往復による追加丸めはない。
実ロードproperty/vptrの確認はcaptureに残す。GUI上のHP表示への変換は本調査の
「属性としての最終最大HP」と区別し、未検証の表示丸めを付加しない。

## 4. プレイヤー基礎HP

HealthAttributeSet constructorの500だけをbaseとする前回の推測を、具体的な設定経路に
置き換えた。

- `HealthComponent`登録 `0xf0a980` → thunk `0xf0c120` → constructor `0x97cd40`。
- constructor `0x97cd8d`がcomponent `+0x100`に500（`0x43fa0000`）を格納。
- component vtable `0x322dd30 + 0x2f8` → 初期化 `0x98ee00`。
- role検査 `0x98ee98`で3のbranchに入ると、`0x98eea1`でMaxHealth descriptorを取得し、
  `0x98eea9`でcomponent `+0x100`をXMM2へロード、`0x98eeb4`で`0x38f0f0`へ渡す。
- `0x38f133` → `0x3c9560`。pre-base hook `+0x258`を通り、既存aggregatorがあれば
  `0x3d92d0`でbase `+0x4c`を書き換えて再評価。未作成ならcurrent setterへ進む。
- HealthAttributeSetのpre-base hook `0x7cea90`はHealthだけをMaxHealthでclampする。
  MaxHealthのbase値自体にはその変更を行わない。

Raw playerのexport 270 `HealthComponent_GEN_VARIABLE`はnative HealthComponentを使い、
`Default__HealthComponent`をtemplateとする。12-byte payloadはexport 214と同じ
`None`終端のみ。チェックはuassetのName Map（index1015=`None`）とuexpの原バイトまで
照合しており、「非CDO exportが未decodeだから空だろう」とは判断していない。

これで**標準HealthComponentの初期化候補500**はコードとRawから説明できる。
一方、Blueprint実行、instance変更、後続base変更、他のactive effectsを全て否定する
証明はない。任意のセーブ/難易度/ステージ/装備状態に500を無条件代入しない。

## 5. 最小の残障害と取得手順

最も有効な次の一手は、**hashを照合したWindows実ゲームで、Mercenaryを一回だけ
着脱して以下の停止点を採取すること**。新しいツールチェーンや全メモリdumpは不要。
WinDbg等でmodule baseにRVAを加えたsoftware breakpointを使い、命令書換え前の
該当spanが今回の復元物と一致することをまず確認する。breakpointは記録後に解除する。
第三者セッションや他プレイヤーの状態は採取しない。

| 停止点 | 必要な最小データ | 解決する不明点 |
| --- | --- | --- |
| `0x98eeb4`（必要なら新規player初期化時） | RCX=ability、RDX=MaxHealth descriptor、XMM2の32-bit値、HealthComponent `+0x100`、MXCSR | 実際に設定された初期base |
| `0x363aff` | RCX=componentのclass/vptrとslot `+0x590`、R8=specの先頭effect pointerと`+0x298` bits、item `+0x480` bits、PowerEffectsの実配列 | owner/dispatch、正確なPower、実際の効果 |
| `0x408452` / `0x1130ca3` | lookupで得たUFunctionとその `+0xc0`、計算object class/vptr `+0x200/+0x240` | ProcessEventの実際のexec bridge |
| `0xb94986` と `0xb9498b` | 呼出前XMM0/XMM1、戻りXMM0の下位32-bit、MXCSR; IAT `module+0x3095e38` の解決先module/version/SHA-256、forward先 | CRTの正しい入力/出力と数値環境 |
| `0x3bdc27` | RCX=aggregator `+0x40` callback、`+0x4c` baseと`+0x50` channel map、MaxHealth descriptorとの対応 | 装備適用時の実効base・channel構成（callback後の入力は次行で確認） |
| `0x3d30e0`（MaxHealthに対応する呼出だけ） | XMM1 base、RCXの4配列header、各40-byte recordのmagnitude/handle/prediction/qualification | 全ての有効加算/乗算/除算/overrideと順序 |
| `0x3bdc5d`と`0x3c9c49`の前後 | 前者のXMM2 float32評価結果、後者のXMM2 float64とRDX=storage、property vptr/slot `+0x350`と`+0x44` offset、最終HealthAttributeSet `+0x38` bits | pre-changeとwriterを含めた計算値からstorageへの最終一致 |

合わせてeffect CDOのmodifier配列からoperation、magnitude kind、custom class、
coefficient/pre/postのFScalableFloat（scalarだけでなくcurve参照）、FinalLookupCurve、
duration/period、spec stack数を採る。非null曲線なら該当curve/評価結果を追加取得する。
`0x3d30e0`でqualification済みrecordを捕まえれば、全タグシステムの再実装は不要。
このsnapshotなら「この実個体・この状態のHP」を再計算・照合できる。全Powerに対する
bit-exact汎用計算には、実provider DLLの固定と境界入力の検証を引き続き要する。

表示Power整数から内部floatを逆算する方法ではこの障害は解けない。
また、上記が一致してもEvidence/Formal/R3採用とRuntime Promotionは別の判断。

## 再現と今回の停止理由

```sh
python3 -B research/native/scripts/check_armor_hp_final_path.py
python3 -B -m unittest discover -s research/native/scripts -p test_armor_hp_final_path.py
python3 -B research/native/scripts/check_armor_hp_final_path.py \
  --local-root /path/to/local-game-data
python3 -B research/native/scripts/check_armor_hp_final_path.py \
  --local-root /path/to/local-game-data --replay \
  --output /tmp/armor-hp-aggregation-replay.json
```

checkerの引数なし実行はpublic Raw/metadataとscopeを検査する。unittestは
unknownの消去・昇格・入力差し替えを拒否すること、丸めの境界例、保存済みreplayと
現在のchecker/imageのhash対応を確認する。`--local-root`ではexe/image hash、各span、
instruction/呼出/table、Raw原ファイルを追加検証する。`--replay`は既存
`native_watchdog.supervise`で45秒の外部workerを起動し、各leaf呼出を一度の同期
`emu_start`で実行する。instruction上限10,000、timeoutからのresumeなし。
出力JSONと隣の`.watchdog.json`の成功・cleanupを共に確認する。

[今回のreplay結果](armor-hp-aggregation-replay.json)と
[watchdog結果](armor-hp-aggregation-replay.watchdog.json)を保存した。
合成recordのqualification、stack数、baseを明示し、ゲーム呼出の成功を偽装していない。
外部関数をstubで成功扱いせず、依存のない二つのleafだけを実行した。
再現に使用した依存はprivate tools内のCapstone 5.0.6 / Unicorn 2.1.4。
今回の新規publicテスト6件、#218の既存テスト10件、両checkerのprivate検証は通過。

新たな全ローダー実行、外部source探索、ゲーム/UEの大規模ビルドはしていない。
現在のmacOS環境にはWindows実ゲームのcaptureと対応math provider DLLがなく、
ゲームやWindows CRTの実行結果は取得していない。停止理由は、残っている入力が
ロード済みオブジェクトと外部CRT・実行時FP状態に属すること。静的解析で別の初期化や
変更経路を追加調査しても、それだけでは装備適用時の値の観測を代替できない。
現在の資料だけから実ゲームの最終HP値を確定することはできない。
