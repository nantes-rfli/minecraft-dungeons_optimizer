# Ranged最終ダメージ — Native解析結果（2026-11-01）

**指定したCRT・内部Power・有効属性の下で、基準ダメージからPower適用後の単発ダメージまでを再現できた。任意の対象の最終HP減少量を装備だけから決めることはできない。** 対象側の拒否・属性振り替え・HP閾値処理まで接続し、その理由をNative命令から確認した。

今回の成果は研究用。Optimizer実装、Runtime Promotion、PR、merge、Site変更は行っていない。未確認の効果を0、未確認の倍率を1として計算対象へ追加していない。

## 1. 基準・証拠の境界

- 基準main: `bd9249efcebc78934e69fd1ebfe43e5adc7390c3`（PR #219・#220 merge後）。
- exe SHA-256: `eab80a0ba0c3c4c1bbae6e0e40ed8ada5dc26bf3008b7385579168b793bf0eb8`。
- recovered image SHA-256: `04a990ccbc67454505724a28043eccc595f613a0a877ae55386a4fa8656434d3`。
- 以下のゲームRVAはimage base `0x140000000`からの相対位置。
- **配布元の真正性、およびRawとexeが同一buildであることは引き続き未確認。** アーカイブの1.17.0.0表記とhash一致を、公式版全般への保証に拡張しない。

再利用した成果:

- [PR #217 handoff](../power-117-handoff.md): 正規化、Power関数、import record→IAT、item→effect spec。
- [Armor HP final path](../armor-hp-final-path.md): Gameplay Effectのcustom magnitude・stack・channel・属性書き込み。
- [PR #220原解析](../ranged-20261031/REPORT.md)と[integration](../../../docs/ranged-native-integration.md): Raw/Native基準値、charge bool、発射・命中、Blueprintの限定レビュー。

既存のRaw抽出・loader・全体探索を再実行していない。今回追加した43 Native区間と7 pointerを[evidence.json](evidence.json)で固定した。静的なcall chainの接続、局所命令再生、ゲーム全体の実行を区別する。

## 2. 外部数学関数: 本物のCRTをWindowsなしで再生

既存のimport recordはmodule 36=`api-ms-win-crt-math-l1-1-0.dll`、名前checksum=`0xc6b8f5fd`、IAT=`0x3095e38`を指定する。checksumは多項式`0x54495041`、初期/最終XOR=`0xffffffff`、ASCIIの末尾NULを含む。

Microsoft所有の[Windows SDK CPP 10.0.22621.1パッケージ](https://www.nuget.org/packages/Microsoft.Windows.SDK.CPP/10.0.22621.1)から、x64の2ファイルだけを取得した。取得URL・ZIP entry・size・SHA-256は[crt-download.json](crt-download.json)。

| ファイル | SHA-256 | 新たに確認した接続 |
|---|---|---|
| api-ms-win-crt-math-l1-1-0.dll | `6ea15153e8948e7fc9e0aee7cfc5cb7b9b8f872f94e6714bc510b9bc7291ad9b` | `powf` exportは`ucrtbase.powf`へのforwarder |
| ucrtbase.dll | `fbed69a52fdcf571dd37fe4cc63cb86ed3732b5b998807f14968788027c00754` | `powf` RVA=`0x34630` |

両DLLの全named exportを照合し、該当checksumはどちらも`powf`だけだった。従来のsynthetic export fixtureより進み、**この候補DLL組における名前衝突の不確実性を解消した**。

ゲームの`0xb88f20`を入口として、正規化→実CRT `powf`→Power倍率の末尾まで連続実行した。IATだけを明示的なproviderへ束縛し、数学関数の戻り値はstubしていない。CRTの命令・定数をそのまま使い、Python/C/JavaScript等のhost `pow`を代用していない。

CRT内`0x1007d4`のdispatch flag=0はSSE2、非0はAVX/FMA側へ進む。Unicorn 2.1.4は後者の`vfmadd213sd`（RVA `0x34e4b`）を実行できなかったため、失敗を成功として扱わず、x86-64 Macの実CPUに同じDLL/game命令をmapして照合した。Windows loader/APIは起動していない。最終suiteは269入力のSSE2再生と、同じ269入力×2 dispatchの実CPU再生が一致した。**全入力・全CRT版での同値性は証明していない。**

これは「実ゲームがこのDLLを使った」という証拠ではない。UCRTはOSの構成要素で、Windows 10/11ではsystem copyが優先されるため、ゲームexeのバージョンだけではproviderを固定できない。[Microsoft UCRT deployment](https://learn.microsoft.com/en-us/cpp/windows/universal-crt-deployment) 実機provider hashとMXCSRは未観測。今回の正確な出力は、明記した参照DLLとMXCSR=`0x1f80`に対するもの。

## 3. 内部float32 Power: 保存数値から装備へ

表示Powerを逆算する必要のない入力経路が見つかった。

```text
保存データの解析済み数値 "power"
  de72f9: key (3383470) → 316ae0 lookup
  de730e: 3164c0 numeric-to-float → XMM7
  de7753: XMM2へ → b1abe0 item record constructor
  b1ac14: record[+0x14]へmovss
  7e2e5a: recordの移送で同じbitsを保持
  b5997e: record[+0x14] → XMM1
  b59986: bb1490 item factory
  bb14c2 / bb15b0: XMM1を保存・復元
  bb15b6: b02900 setter
  b02900: item[+0x480]へmovss
  既存#217経路: effect spec[+0x298] → 3b4ac0 → b88f20
```

`0xb02900`はunwind関数一覧に載らないleafだった。従来の`.pdata`単位の検索が見逃していたsetterを限定したbyte pattern検索で発見し、実際のfactory callerにつないだ。unwindの範囲を関数の完全な範囲と同一視しない。

`0x3164c0`は数値variantのtagを分岐する。tag=3はdoubleから`CVTPD2PS`、tag=1はsigned int64、tag=2はunsigned int64の変換経路。今回の104入力再生はtag=3を検証した。field欠落時のNative fallbackがあっても、Optimizerで欠損情報を0とみなす根拠にはしない。

逆方向も`0xdf01c0`がrecord `+0x14`を読み、`CVTPS2PD`→数値constructor `0x315dd0`→`"power"`へ保存する。float32→doubleはこの有限値域では正確で、104入力で再生した。

**実際のsaveファイルの復号、decimal text→numeric variantのparser、保存対象・装備選択の完全な照合は未実施。** 解析済み数値または内部bitsを正しく取得すればWindowsセッションなしで計算できる見通しが立ったのであり、任意のsave importerが完成したわけではない。factoryには明示的な別Powerを渡すcallerもあり、全アイテム生成経路をこのsave経路に一般化しない。

隣接する2入力の参照CRT結果:

| 内部bits | x | Power scalar M | Bow chargedの正のcustom magnitude |
|---|---:|---:|---:|
| `412e6666` | 10.899999618530273 | 81.7408218383789 | 10217.6025390625 |
| `412e6667` | 10.90000057220459 | 81.74085235595703 | 10217.6064453125 |

表示整数は内部bitsを保存する入力ではない。表示値から選んだ近傍の一値を実個体の確定値にしてはいけない。

## 4. 基準値→Power→有効属性の演算順

以下`F`は各演算のbinary32丸め、nearest/ties-even。有限の通常入力、MXCSR=`0x1f80`、陸上・通常矢を対象とする。式は数学的に同値でも並べ替えない。

### Power関数と属性集約

```text
x = 内部float32 ItemPower
d = bits(0x4127b7b8) = 10.482353210449219
q = F(F(x - 1) / d)
e = F(clamp(q, 0, 3) * 19)
y = pinned_ucrt_powf(1.25f, e)
t = max(F(F(0.75 * y) - 0.75), 0)
M = F(F(t + t) + 1)
```

`M`をそのまま最終倍率にするのも厳密には誤る。既存#219の一modifier・一stack・一channel・base=1・custom既定設定という条件で:

```text
m  = F(0 + F(1 * F(0 + M)))
ms = F(F(1 * F(m - 1)) + 1)
mc = F(F(1 + ms) - 1)
Q  = F(F(F(0 + 1) * mc) / 1)
```

`0x3d2510`のstackと`0x3d30e0`のchannelを269入力で再生した。内部Power=5では`M=0x40e20739`、`Q=0x40e20738`となる。**実際にPower関数から出た値でも、属性集約で1 ULP変わる。** 複数modifier、tag資格、override、別channel、stack数がある場合はこの限定式を流用しない。

### 命中値とsigned custom magnitude

既存#220の`H0=F(F(G*W)*B)`を再利用する。Bowでは陸上・G=1・通常矢で未charge50、charged125。water、Growing、特殊矢、命中イベント等を除外できない場合、`H=H0`とは断定しない。以下Hは、これらを経たcustom計算への入力値。

```text
I  = RangedAttackDamageIncrease
v0 = F(F(-I + -H) * TakeDamageMultiplier)
v1 = F(F(v0 * DamageMultiplier) * DealDamageMul)
v2 = F(v1 * DifficultyDealDamageMultiplier)
V  = F(F(F(Q * v2) * RangedAttackDamageMultipler)
        * TakeRangeDamageMultiplier)
```

VはHealthへの負のcustom magnitude。`I`は固定加算として最終段に足されるのではなく、基準値と合算され、後続のPowerを含む倍率を受ける。一般/難易度の演算順は#220の静的証拠を再利用し、今回の再生では`0x7af568..574`の加算・takeと`0x7b0446..459`の末尾3積を確認した。capture関数やエンジンの戻り値をstubして全体実行と呼んでいない。

### 有効属性の取得元

constructor連鎖`7a35c0 → 79ca00 → 797890 → 79bd50`を復元した。capture struct `+0x20`はSource=0/Target=1、`+0x21`はbSnapshot。enum table=`30f84d8`、AttributeSource descriptor=`41a2710`、bSnapshot setter=`3e4950`（descriptor pointer=`41a2708`）。綴りはNativeそのまま。

| 属性 | 取得元 | snapshot | calculator内offset / 初期化RVA |
|---|---|---|---|
| TakeDamageMultiplier | 対象 | false | `+40 / 79bdea` |
| DamageMultiplier | source | true | `+68 / 797942` |
| DealDamageMul | source | true | `+90 / 797a1b` |
| DifficultyDealDamageMultiplier | source | true | `+b8 / 79ca8f` |
| RangedAttackDamageMultipler | source | true | `+e0 / 7a364f` |
| RangedAttackItemPowerFactor (Q) | source | true | `+108 / 7a36b9` |
| RangedAttackDamageIncrease | source | false | `+130 / 7a374e` |
| TakeRangeDamageMultiplier | 対象 | false | `+158 / 7a37c8` |

従来の記述の`DealDamageMultiplier`は、この経路の実プロパティ名では`DealDamageMul`（getter `7b2180`、文字列`31b4c10`）。snapshot=trueから「発射時の値」とまでは断定しない。specの作成・capture時点と実効値が別途必要。装備、armor、enchantment、プレイヤーbuff、難易度から各値を作る全writerの網羅は今回の確定範囲外。

## 5. custom magnitudeから対象Healthへ

通常Projectile Effect constructor=`0x828950`。Instant、HealthへのAdditive modifier、そのcustom計算classがRangedDamageModCalculationとなる。execution配列の順序はRangedLifestealExecution、DamageExecutionCalculation、DynamoRangedCueExecution。

エンジン側`0x3af071..3af0ec`は**modifierを先に適用**し、その後`0x3af142`以降でexecutionsを処理する。DamageExecutionを「Healthへ初めてdamageを足す場所」と誤認しない。

```text
V (negative)
 → 3b9450: 属性pre hook
 → 7cedf0: Healthの負の変更を検査
 → 7b0e90: acceptance / tags / cancel event / player分岐
 → 7c5200: magnitude更新、必要なら対象属性をShield/Barrierへ変更
 → 3a9830: Additive演算・base/current再評価・書き込み
 → 7ce4f0: post hook / events
 → 上記3 executions
```

HealthAttributeSet vtable=`342f8c0`: `+240 → 7cedf0`、`+248 → 7ce4f0`、`+250 → 7cebc0`、`+258 → 7cea90`。

### 受理・対象tag・振り替え

- `7b1210`はHealth、owner/HealthComponent、状態flag、source/target context等を検査する。全flagの意味を推測で命名していない。受理されないとこのHealth変更は進まない。
- `99c260 → c2aa70`は対象HealthComponent `+290`のmapをspecのtag列で検索し、T=1から一致する倍率を**列の順に**`mulss`する。空の確認済みmap/tagなら1。未取得のmapを空と扱ってはいけない。
- cancel event=`c14900`の後、通常の正のdamageは`d=-F(T*V)`。T<=0やcancelでも通常適用は進まない。
- `7c5200`は評価済みmodifierを`-d`へ更新する。Shield `+30 > 0`ならShieldへ、さらにBarrier `+3c > 0`かつBarrierCharge `+44 > 0`ならBarrierへ変更する。両方なら後者が優先。この書き換えだけから余剰damageのspill-through仕様は決定しない。
- `7c5200`内の追加callback、Health post event、executionの全副作用を閉じたわけではない。実際のframe終了時HPや画面表示整数は未確定。

プレイヤーtargetにはさらに、Health>60、d>Health、d>120、d<F(Health+240)で外部の整数値を返すimport `IAT 3096298`を使う分岐がある。1回目をfloat化して`bits(38000100)`倍し、0.5未満なら2回目とMaxHealthから残すHPを計算する。import名・乱数状態はこの作業で同定していないので確率を断定しない。通常の非プレイヤーmobにはこのplayer class分岐は該当しない。

### HealthThreshold: 装備だけでは決まらない具体例

Additive演算=`3d9300`。既存のHealth aggregatorがある場合はbase/currentを区別する必要があり、常に`current + V`とは限らない。`7cea90`はHealth baseをMaxHealth以下に制限し、`7cebc0`はcurrentに加えResistDeath等を扱う。Healthを常に0以上にclampする式ではない。

両側から呼ばれる`7ac8b0..7ac91b`のHealthThreshold（`+6c`）を復元・再生した。最後の11 bytesは最初のunwind範囲の外にあった。

```text
c = 現在Health; m = MaxHealth > 0; p = 変更後候補; t = HealthThreshold
eps = bits(0x3c23d70a)  # float32の0.01
|F(t-1)| <= eps または |t| <= eps なら pを維持
u = F(1/m)
F(u*p) < t かつ F(u*c) > t かつ |F(F(u*c)-t)| > eps なら
    p = F(m*t)
```

同じ入力damage=150、current=MaxHealth=1000でも、t=0なら候補850、t=float32(0.9)なら900となる。268 fixturesでNativeと独立の有理数binary32 modelが一致し、この2例も明示検証した。これは対象属性が変われば結果が変わる反例であり、特定mobの実際のtが0.9であるという主張ではない。

明示的な中立条件（非player、受理、T=1、cancel/追加副作用なし、Shield/Barrierなし、Healthの持続modifierなし、閾値・ResistDeath/debug分岐が作用しない）なら即時Healthは`F(current+V)`、格納値の差は`current-F(current+V)`になる。後者はHealth側の丸めも含むため`-V`と常に同じではない。**この条件を実対象で確認したわけではなく、ゲーム全体を再生した結果でもない。**

## 6. 自動計算できる具体的な範囲と横展開

研究計算の入力条件を、内部Power bits、上記provider/MXCSR、陸上・通常単発矢・G=1、確定したcharge bool、I=0・他の補正倍率=1、Power effectは一modifier/一stack/一channelと明示すれば、5武器9モードのcustom magnitudeを計算できる。これらの中立値はfixtureの入力であり、未確認の装備効果を消したものではない。

例: 内部Power=`412e6666`、Q=`42a37b4d`。

| 武器 / mode | 既存#220のH0 | 今回の正のcustom magnitude |
|---|---:|---:|
| Bow uncharged | 50 | 4087.041015625 |
| Bow charged | 125 | 10217.6025390625 |
| Shortbow uncharged | 37.5 | 3065.28076171875 |
| Shortbow charged | 61.874996185302734 | 5057.712890625 |
| Longbow uncharged | 60.000003814697266 | 4904.44970703125 |
| Longbow charged | 180 | 14713.34765625 |
| Power Bow uncharged | 100 | 8174.08203125 |
| Power Bow charged | 300 | 24522.24609375 |
| Heavy Crossbow single | 135 | 11035.0107421875 |

共通のPower effect・Ranged計算経路へ接続するため、基準値以降をこの5武器へ横展開できる。Shortbow/LongbowのRaw floatは十進数の見栄えで丸め直さない。Power Bow unchargedはNative研究上のモードであり、現在のOptimizerの対応モードを増やしたものではない。固有武器、未知enchantment、特殊矢、水中、複数hit、DPSへ拡張していない。

全例の`actualGameFinalDamage`は[verification.json](verification.json)で`null`を保持している。中立条件付きcustom値を、実測済みdamage・UI表示・任意の敵への最終HP減少に昇格させない。

## 7. 残る最小の障害と判断

| 目的 | 残る入力・証拠 | Windows実行なしでの最短手段 |
|---|---|---|
| 実個体のPower適用後単発値 | 実saveのpower→内部bits、provider/MXCSR、装備/buff由来の有効属性 | 実save一件の復号済み数値とitem選択を照合。providerをhashで指定する参照計算なら今回の再生を使用可能 |
| 実ゲームとbit単位で一致する保証 | 実際に解決されるDLL/build・CPU dispatch・FP状態 | 対象環境のDLLファイル/hashやOS情報をオフライン入手して同様に再生。候補SDK一版の一致だけでは保証不可 |
| 任意の敵への最終HP減少 | 対象の現在HP、tag map、受理状態、Shield/Barrier、閾値、active effects、event/確率状態 | 対象・戦闘状態を入力にするか、証明済みの標準対象条件に限定。装備情報から欠落状態を逆算することはできない |
| 画面表示整数 | 表示イベントへ渡る値と丸め/表示経路 | 必要な成果の定義を決めてから表示経路に限った別調査。今回のcustom値を丸めて代用しない |

一般の最終値には実行時状態が不可欠だが、Windowsでゲームを動かすこと自体が数学再生の前提ではない。固定された状態をオフライン入力・限定命令再生で処理できる。一方、現在のbuffやtargetのHP等が装備情報に含まれないという情報不足は、Native解析を増やしても消えない。

**このWork Unitはここで終了し、次は「実save一個体の内部Power検証と、計算provider・標準対象条件の固定」へ移るのが有効。** 全loader再解析、全武器探索、全combat eventの再現を続ける必要はない。実環境とのbit一致が要件ならまずprovider/FP環境の証拠を入手する。標準条件の予測値が目的なら、その条件を明示した入力契約を先に確定する。今回は次Work UnitやOptimizer実装を開始していない。

## 8. 再現方法・結果

ファイル:

- [verify.py](verify.py): 正確な有理数→binary32 oracle、genuine CRT/game命令再生、CPU照合。
- [pe_math.py](pe_math.py): PE export/forwarderとchecksum。Windows DLL loaderは使わない。
- [fetch_crt.py](fetch_crt.py): 公式packageのHTTP Range取得。必要な2 DLLだけをprivate directoryへ取得しhashを検証。
- [disassemble_evidence.py](disassemble_evidence.py): pinned imageから指定roleの命令を再表示。
- [evidence.json](evidence.json)、[verification.json](verification.json)、[Watchdog結果](verification.json.watchdog.json)、[manifest.json](manifest.json): 根拠・結果・保存ファイルhash。
- [exploration.json](exploration.json): 初期FMA失敗とprivate探索script/resultのhash。最終suiteの成功数に合算しない。

既存private inputの配置をそのまま使う。`MCD_LOCAL`には`archive-1.17.0.0`と`phase6.8/native-stage2`を含むlocal-game-dataを指定する。Unicorn 2.1.4、disassemblyにはCapstone 5.0.6を既存toolsから読む。Python標準ライブラリ以外の新規導入はない。DLLやゲームpayloadは成果物に含めない。

```sh
MCD_LOCAL=/path/to/private/local-game-data
MCD_CRT=/path/to/private/crt-sdk
python3 -B research/native/ranged-final-20261101/fetch_crt.py --output-dir "$MCD_CRT"
python3 -B research/native/ranged-final-20261101/verify.py \
  --local-root "$MCD_LOCAL" --crt-root "$MCD_CRT" \
  --output /tmp/ranged-final-verification.json --cpu
python3 -B research/native/ranged-final-20261101/disassemble_evidence.py \
  --local-root "$MCD_LOCAL" --role 'HealthThreshold'
```

既存DLLならfetchに`--check-existing`を付ければネットワーク不要。`--cpu`はx86-64かつ当該AVX/FMA命令を実行可能なUnix系host用。使えないhostでは省略し、CPU照合はnot-requestedと記録する。UnicornのFMA非対応を別の数学式で補完しない。

最終検証は**Native 2,467ケース＋実CPU 538ケース、不一致0**。内訳: 完全Power+CRT 269、stack 269、channel 269、save値変換/移送/保存6区間×104、HealthThreshold 268、customの2区間×256、Health加算256。Powerと集約の実行命令212区間もhash記録した。固定seedの境界・ランダムfixturesであり、全float値や実ゲーム全体の網羅ではない。

既存Watchdogの45秒上限、各Unicorn区間10,000命令/100ms上限。最終runは正常終了、forcedKill=false、cleanupComplete=true。新しい公式DLL取得スクリプトも実際の再取得で2件のhash一致を確認した。初期FMA試行の制限は上述のとおり保持し、最終suiteの成功と混同しない。
