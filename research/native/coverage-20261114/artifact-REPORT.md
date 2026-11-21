# Artifact Native coverage — 2026-11-14/15

**共通duration計算とcooldown候補値の経路を、hash固定Nativeから接続した。2,219件の条件付き算術比較は一致。新規ArtifactのRuntime READYは0件を維持し、Boots of Swiftnessを次の最小実装候補に絞った。**

研究のみ。runtime変更、commit、PR、merge、Site更新は行っていない。Unknown/unsupported、R3/P3B、Evidence Adoptionを変更しない。

## 証拠の境界

- 基準main: `6bf212dc5ea8f686f981c9882657874264e41791`。
- recovered mapped image SHA-256: `04a990ccbc67454505724a28043eccc595f613a0a877ae55386a4fa8656434d3`。
- original exe SHA-256: `eab80a0ba0c3c4c1bbae6e0e40ed8ada5dc26bf3008b7385579168b793bf0eb8`。
- 以下はimage base `0x140000000`相対RVA。公式配布元の真正性、Raw/exe同一buildは未確定。
- Native静的接続、明示fixtureでの条件付きエミュレーション、実ゲーム観測、独立検証を区別する。実ゲーム観測は今回0件。親の独立検証前に独立検証済みとはしない。
- 後続ranged-final研究は候補SDK CRTを再生済み。このduration/cooldown経路にはpowfを必要とせず、古い「CRT未実行」を今回のblockerへ流用しない。

## 対象数と優先順位

Formal Effectリンク10件とItemActorリンク11件は**16種類の和集合**であり21件ではない。そのうち現在未対応は13件:

`boots-of-swiftness`, `corrupted-pumpkin`, `corrupted-seeds`, `enchanted-grass`, `fishing-rod`, `ghost-cloak`, `light-feather`, `powershaker`, `satchel-of-elements`, `satchel-of-elixirs`, `satchel-of-snacks`, `scatter-mines`, `shadow-shifter`。

既存の`death-cap-mushroom`, `iron-hide-amulet`, `shock-powder`は検証anchorで、新規対応数に数えない。この13件は共通foundationの**調査候補上限**であり、今回全13件の同一実行経路を証明したという意味ではない。全体42未対応へもそのまま拡大しない。

Native `DurationIncrease`クラスをPowerEffects[0]へ設定するconstructorは7種類に結び付く。未対応の5種類は以下の通り。

| ID | Native constructor | 現在の接続 | 次の最小不足 |
|---|---|---|---|
| boots-of-swiftness | `ad8270` | duration→spec、自己適用、SpeedMultiplier、cooldown候補値まで | cooldown providerの後処理、engine duration補正、移動評価契約 |
| gong-of-weakening | `b18500` | 基準duration×callback→専用set-by-caller値、対象適用callerまで | 専用duration keyのeffect側消費、敵の資格/免疫/重複 |
| shadow-shifter | `b19730` | 内部Power×基準duration→Duration、自己適用callerまで | soul支払い・first-hit消費・有効state/重複 |
| enchanters-tome | `ad8980` | DurationIncreaseをPowerEffectsへ設定 | Ally/pet選択と発動後のduration consumer |
| totem-of-shielding | `b1a6c0` | DurationIncreaseをPowerEffectsへ設定 | 生成actorの寿命/zone residenceとduration consumer |

残る2種類は既存対応のDeath Cap/Iron Hide。class名/同一PowerEffectsだけで5種類の最終durationを同一式へ昇格させない。優先順位は **Bootsの限定自己buff → 共通cooldown provider → Gong/Shadow → pet/zone/resourceを伴う残り**。Bootsは追加target抽選やsoul資源を必要とせず、限定された入力契約へ切り出しやすい。

## 接続された共通duration foundation

従来の`b8a5f0` scalar-only境界を越えた。

```text
Native constructor -> PowerEffects[0] = UDurationIncrease class
 -> af7440(item, index=0): 配列classからCDO取得/型検査
 -> b903e0(CDO, internal ItemPower): CDO+68のfunction objectをdispatch
 -> a7a3a0: float引数をXMM0へ移しcallbackへtail jump
 -> b8a5f0: DurationIncrease scalar
 -> itemtype base duration (+9c)とMULSS
 -> 3ca070: Effect specのset-by-caller値
```

`b78ad1`がcallback=`b8a5f0`、`3290ff0`のdispatch pointer=`a7a3a0`を固定する。Bootsの実起動vtable `32c4688+6d8 → ae5e60`。`ae5fe4`はitem `+480`をXMM1へ読み、`ae5fec`が`b903e0`へ渡す。`ae6000`のMULSS後、`ae6016`でDuration keyへ格納。tooltip専用経路だけを根拠にしていない。

F=演算ごとのbinary32 RN-even、MXCSR=`0x1f80`、有限通常入力。xは**内部float32 ItemPower**で、表示整数Powerではない。

```text
q = F(F(x - 1) / float32bits(0x4127b7b8))
a = F(18 * float32bits(0x3e1c9c9c))
s = F(F(max(F(q * a), +0) * 0.25) + 1)
DurationSetByCaller = F(BaseDurationSeconds * s)
```

qに上限3のclampはない。Native scalarのNaN/MAXSS等の範囲は既存linear-power proofを参照し、今回のfinite oracleを非有限入力へ一般化しない。欠損Power・基準durationを0/1へ補完しない。

## Boots: 新規1種類の具体的な接続

Native catalog初期化`14d7c0`はBootsOfSwiftness文字列を伴い、builder `+a8=5.0`、`+ac=1.5`を設定。`b6500d..29`と`b1b5ab..cb`の実命令で、builder `+a8 → ItemType+98`（cooldown）、`+ac → ItemType+9c`（duration）を接続した。反射登録`GetDefaultDurationForItemType → f20370 → b532c0`も`+9c`を読み、default cooldown reader=`6df440`は`+98`を読む。

- 基準duration: **1.5秒**、基準cooldown: **5秒**。秒という解釈はnamed cooldown interfaceとduration利用経路の文脈に依存する。全game frameやUI表示整数を観測した値ではない。
- instance constructor `ad829b`: speed magnitude=`float32bits(3fcccccd)`（約1.6）。activation `ae601b..32`はこれを専用set-by-caller keyへ渡す。
- native effect constructor `adb2f0`はDurationPolicy=2、StatusDurationModCalculation、SpeedMultiplierへのmultiplicative modifier、StatusEffect.Positive tagを設定。
- item owner=`item+108`を型検査し、そのownerのability-system interfaceを`ae5ed5`で取得。`ae6064`は同じability systemの`+590`自己適用経路へspecを渡す。指定した敵へのdamageやtarget-countとは無関係な経路である。
- StatusDurationModCalculationの`7a51e0`/`7a5256`はPositive/Negative duration属性を**Target、snapshot=false**でcapture。`7b0ab0`はDuration set-by-callerを取得し、effect tagにより正/負の属性を選び、`7b0ca7`で掛ける。BootsはPositive tagなので、対象である自己の有効PositiveStatusDurationMagnitudeが残る入力。

既存private Bootsのinstance/effectの2packageをrepositoryのstrict UE parserで追加確認した（`artifact-raw.json`）。Instanceの親=`BootsOfSwiftnessInstance`、Effect参照=`BP_BootsOfSwiftnessGameplayEffect_C`、effectの親=`BootsOfSwiftnessGameplayEffect`。両CDO property streamはterminated、unparsed range/diagnosticは空。Instanceにゲーム数値のserialized overrideはなく、effect CDOはUIDataのみ。これは照合した2packageのCDO範囲であり、engine parent初期化や全Blueprint scriptを実行した証拠ではない。

したがって、照合したCDO範囲とNative既定が有効であり、有効target属性Pが入力された条件では、custom duration calculatorの出力は `F(P * F(1.5 * s))`。**装備だけから常にP=1とはしない。** GameplayEffectのその後のduration coefficient/curve/engine modifier、重複再適用と実際のタイマー/移動attribute消費まで閉じた「実ゲーム滞在時間」ではない。UIで速度1.6をそのまま60%の移動時間短縮へ変換してはいけない。

## 共通cooldown候補値

`aecae0..aecc7d`はitem ownerのability systemから、通常itemで`ItemCooldownMultiplier`と`ItemCooldownOverride`を取得する。別type branchはPotionCooldownMultiplierを選ぶ。通常itemの算術は:

```text
C = F(BaseCooldownSeconds * effective ItemCooldownMultiplier)
if effective ItemCooldownOverride > 0 and effective ItemCooldownOverride < C:
    C = effective ItemCooldownOverride
```

実命令は`aecc56` MULSS、`aecc5f..70`比較/選択。Override=0/負/同値/大きい場合はCを維持する。これは減算ではない。getter内にItemPower読出しはなく、DurationIncreaseをcooldownへ掛けてはいけない。

共通起動処理`ae8ce3..ae8d24`は`item+489==0`の場合にこの候補Cを計算し、`item+4b8`のcooldown provider virtual `+40`へ渡す。従って**通常発動時にproviderへ渡す秒値**は確認済みだが、provider内のfixed reduction、stack/refresh/開始時刻/無効化を全て閉じた最終cooldownは未確定。`GetCooldownSecondsReduction → f20210 → b531e0`がitemslot `+254`を読むことは確認したものの、ここでその減算位置を推測しない。

これは13/42候補に再利用できるfoundation。各itemのprovider bindingと特殊起動flagを確認せず、全Artifactに同じuse-when-readyモデルを適用しない。

## 検証とREADY判定

`artifact_probe.py`がimage hash、nativeSpans、direct call/pointerを再確認し、`artifact_replay.py`が5,000命令以下の各sliceを一度ずつ実行する。loader/Windows/gameplayは起動しない。

| 比較 | 件数 |
|---|---:|
| 完全native callback→DurationIncrease、独立の有理数binary32 oracle | 313 |
| Bootsの基準duration乗算 | 313 |
| target status-duration乗算 | 1,252 |
| cooldown product/override分岐 | 336 |
| builder→type cooldown/durationのbit輸送 | 5 |
| 合計 | **2,219、相違0** |

fixtureはcallback object、ItemTypeフィールド、target属性を明示する。callbackの計算結果をstubせず、b903e0→a7a3a0→b8a5f0→正規化を完全に実行。ただしcaller、status suffix、builder輸送、cooldownは**別々のslice**であり、連続したgame activationの実行ではない。5種類のID全てについて実Gameplayを再現した結果でもない。

- **READY for independent verification:** 共通Power callbackと基準duration乗算、target status-duration乗算、cooldown候補算術/override。独立検証後の限定foundation実装候補。
- **PARTIAL:** Bootsの限定self-buff仕様、他4種類のduration family。new item runtime READY=0。
- **Unknown:** 実際の装備/target属性、未確認Blueprint上書き、provider最終処理、zone/pet/resource/重複/免疫、公式provenance。

最小の次作業は、照合済みBoots classを入口に同じproviderの`+40`実装とengine duration後処理を照合し、`{internalPowerBits, effectivePositiveStatusDurationMagnitude, effectiveItemCooldownMultiplier, effectiveItemCooldownOverride, provider state, movement objective}`を入力契約として限定すること。新しいWindows/gameplay記録や全loader再解析を要求する段階ではない。

再現:

```sh
python3 -B research/native/coverage-20261114/artifact_probe.py --local-root /path/to/local-game-data --output /tmp/artifact-evidence.json
python3 -B research/native/coverage-20261114/artifact_replay.py --local-root /path/to/local-game-data --output /tmp/artifact-replay.json
node research/native/coverage-20261114/artifact_raw.mjs /path/to/repository /path/to/local-game-data /tmp/artifact-raw.json
```

Boots instanceとeffectの私的package hashは`artifact-raw.json`で固定する。

private binaries/Raw payload/full disassemblyは成果物に含めない。共有記録はhash、限定RVA/field/call relations、条件・式・検証結果のみ。
