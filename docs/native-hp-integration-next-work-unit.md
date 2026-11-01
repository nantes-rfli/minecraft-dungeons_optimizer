# Armor HP解析統合レビューと次Work Unit

調査日: 2026-10-30。基準は取得済みGitHub `main`
`e0a239a3623a4b16a4cd7cd0eb13f83193ed1f1a`（[PR #218](https://github.com/nantes-rfli/minecraft-dungeons_optimizer/pull/218) merge後）。
**今回の新規計算可能装備・効果は0件。次タスクの実装・mergeは行わない。**
Researchとしての保存と、Evidence Adoption / Formal認定 / Runtime Promotionは別である。

## 解析成果のレビュー結果

[PR #217](https://github.com/nantes-rfli/minecraft-dungeons_optimizer/pull/217)のPower scalar・input transport・CRT境界と、
#218のArmor PowerEffects接続を起点に、Astra Ultraの
[final path](../research/native/armor-hp-final-path.md)・[metadata](../research/native/armor-hp-final-path.json)・
[checker](../research/native/scripts/check_armor_hp_final_path.py)・[6テスト](../research/native/scripts/test_armor_hp_final_path.py)を確認した。
元worktreeを編集せず、元の6新規ファイルとREADMEの追記をコピーした。
既存の#217/#218成果、private data、ゲームbinary・memory imageは変更・追加していない。

| 報告された成果 | 今回の確認と採用範囲 |
| --- | --- |
| Gameplay Effect → MaxHealth → float32 storage | hash固定の復元imageとRawに対してcall/命令/vtable/反射property/enumを再照合。標準default経路の静的接続として保存。実個体の連続executionとは扱わない。 |
| 基礎HP初期設定500 | HealthComponent constructor `+0x100`、role条件付き初期化call、MaxHealth base setterへの接続を確認。**初期設定候補**であり任意sessionの実効baseではない。既存runtimeの観測HPモデルを変更しない。 |
| Native 4,581ケース不一致ゼロ | Macで元checkerを再実行。stack 4,120 / channel 461、digest `ee8695fccf15784218e909b282023a0ad56b15e799b23d41a5c16d4f08653d62` が元結果と一致。 |
| 関連16テストPASS | #218の10件＋新規6件を再実行し全PASS。unknown消去・誤promotion・source drift・binary32丸め反例を確認。 |

元[Astra replay](../research/native/armor-hp-aggregation-replay.json)と[watchdog](../research/native/armor-hp-aggregation-replay.watchdog.json)を保存した。
今回の[統合時replay](../research/native/armor-hp-integration-replay.json)と[watchdog](../research/native/armor-hp-integration-replay.watchdog.json)は別名で保存し、元実行の所要時間等を上書きしていない。
両replayは同じchecker SHA-256 `f56aa4e051613f088f8a18cc057801b9099c26c5be5135ee1c6d9b2752c961ab`、
exe/image hash、case digestと出力に一致。watchdogはいずれも `exited / returncode=0 / cleanupComplete=true`。
Capstone 5.0.6 / Unicorn 2.1.4は既存private toolsを読み取り利用した。

実装者と別のreview agent `/root/independent_review` もprivate checker・16テスト・4,581 replayを独立再実行し、
命令列を別途読み取った。初期レビューで重大findingなし。最終headの独立レビューとCI証跡はPR本文に記録する。
これは実ゲームの独立測定やGitHubの人間による承認ではない。

演算検証は**明示した合成base/stack/qualificationとMXCSR=`0x1f80`でleaf関数2個だけ**を実行したもの。
有限・非overflowの選定corpusでの一致であり、全binary32入力、NaN/Inf、signed zero、全FP mode、
全channel配置やゲーム全体の正しさを保証しない。式の結合順を変えると結果が変わる反例は再現できた。

実ゲーム最終HP、実効base、内部ItemPower、実modifier/qualification/channel構成、ロード済みUFunction/CDO、
CRT出力、MXCSR、Raw/exe同一build・公式配布元真正性は未確定のまま。
**500や表示Power整数から最終HPを生成しない。** Native内のfailure fallback=0をunknownの代用にしない。
既存Evidence / Formal / support manifest / Promotion候補1・eligible0・promoted0を変更しない。

新checkerと6テストは既存 `audit:game-data-native-analysis` へ接続した。
Full Validateの `validate` jobでも実行される。新censusのdrift検査も同じ監査に接続した。
ローカルでは関係する監査に絞り、全体はGitHubのValidate（validate / browser両job）で確認する。
今回の変更はResearch / docs / 検証コードのみで表示・runtime・配信成果物に影響しないため、Site反映は対象外。

## 現行mainからの候補比較

[census](../research/native/next-work-unit-census.json)と[再生成・検査コード](../research/native/scripts/summarize_runtime_candidates.py)は、
既存runtime ID、監査母集団、Formal Identity/Value/Relation、対象source参照と入力SHA-256を保存する。
件数は実装可能性の上限と実際のruntime件数を分けた。

現行はMelee **4 / 82**、Armor **11 / 73**、Ranged **2 / 71**、Artifact **3 / 45**。
Thief / Hungry Horror / Hungriest Horror / The Spooky Gourdianは既に対応済みで、新規利得に数えない。
過去のPhase文書の候補・空台帳・Armor7件等は履歴であり、現行コードを優先する。

| 候補 | 条件付きの利得・実用性 | 最小の不足と実装コスト | 判断 |
| --- | --- | --- | --- |
| 観測入力型single-projectile Rangedの対象拡張 | **最大4新規装備**。弓3種と重クロスボウを所持個体のdamage/cycleで比較・推薦でき、既存3Enchantを再利用できる。 | 対象ごとの全固有効果の審査、1射/1矢/1hitの小規模Switch trace、限定reuse契約と正負回帰。Power式不要。 | **次WU** |
| Dark Armor / Titan's Shroud | 2装備が既存numeric familyだけを持つ。Darkは35%DR+50%Soul、Titanは更に20%aura。 | 現行BはThiefの単独cadence、B2は全intrinsic一致のみ。Darkのsubset再利用も新たな限定契約が必要。Titanのaura/Soul併用は未審査。自動で2件eligibleにしない。 | 代替。Dark単独+1を優先、Titanを便乗追加しない。 |
| Armor HP Power fallback | 対応済み11装備で観測HP入力の負担を減らすが、未知intrinsicのArmorは解放しない。 | 今回のNative成果だけでは実効base/内部Power/CRT/実modifierが残る。Switch cardだけでこれらを同定できない。 | Windowsなしの次WUにしない。 |
| DR一般合成 | 既存Armor/Enchant/Artifactの組合せを増やす。装備数増加とは別の利得。 | [既存検証](../research/runtime/phase8c-limited-dr-validation.json)はheld。baseline・単独・pair/tripleの独立holdout不足。Switchで被hit観測は可能だが、R3/P3Bを満たす複数状態の証拠が要る。 | 少量の設定値取込では解放できず後順位。 |
| Artifact設定値/計算式 | 未対応42装備の候補は多いが即eligibleな件数は0。 | FormalのPowershaker AttackStacks=5、Vex PetAmountCap=3等は設定値。damage、実duration、target、charge消費、pet lifecycleを代替しない。Gong/Fishing等にもcurve/ownership/適用条件の不足がある。 | 新mechanicのR3/P3Bなしに登録しない。 |
| Melee profile横展開 | strict timingあり76/82に対しruntime4。潜在利得は大きい。 | timingの存在だけでは装備ごとの全intrinsic・internal rating・Area/効果帰属・multi-hit/combo semanticは揃わない。既存damage計算は均一hitを仮定し、per-hit差や新固有効果を省略できない。 | 次WUより広いbinding/semantic審査が必要。76件readyと誤認しない。 |
| Rangedのbuilt-in neutral damage/cadence | 現行Bow/Crossbowの入力負担を減らす。これだけでは新規装備0。 | 設定AttackRateSecondsの逆数は実効周期でない。全Powerのdamageやcharge/recoveryには別の採用証拠が要る。 | 観測入力モデルの拡張を先行。 |

Twisting Vine Bowは公開auditのintrinsic配列が空でも除外する。
Formal projectile relationの先のRaw `part-060#/packages/49`、CDO `SporeDamageEffect` に
`TwistingVineDamageGameplayEffect` のdecoded参照がある。
追加効果の大きさ・実挙動はunknownであり、単純矢として黙って省略できない。
Rapidのrapid-fire、Burst/Cog/Dual/Scatter/Exploding、Soul、pet/roll/built-in付き、unique/event variantsも今回の単一射境界外。
空配列、名前、同familyだけで適格にしない。

## 確定する次Work Unit

**Source-bound observed single-projectile Ranged batch**。
共通の厳格な対象別審査＋通過した最大4装備を1PRで実装する。
今回のcensusは選定資料であり、approval台帳やR3 AdoptionDecisionではない。

| 装備 | Raw Identity | 初回対応モード | 既存資料 |
| --- | --- | --- | --- |
| Shortbow | `Shortbow` | charged限定 | accepted Formal Identity、configured projectile定義[0]/count1、projectile Relation、公開audit own intrinsic空（完全性未検証） |
| Longbow | `Longbow` | charged限定 | 同上。公開`Strong Charged Attacks`は当該charged観測damageへ含め、追加倍率を重ねない。 |
| Power Bow | `Powerbow` | charged限定 | 同上。ChargeShootEffectTag等の設定も追跡し、一次hit以外の未対応効果があれば対象を保留する。 |
| Heavy Crossbow | `HeavyCrossbow` | single限定 | 同上。公開`Powerful Shots`は当該個体の観測damageへ含める。 |

各装備のexact package、Identity/evidence ID、Value projection/evidence ID、Relation target/occurrenceはcensusに保持。
Raw→Canonical→FormalはIdentity・設定・参照の根拠に使い、実効damage/時間へ自動変換しない。
Native #217/#218/今回成果はPower/HP境界の説明に使えるが、このRanged機能の数値入力には使わない。

新しくできる機能は、これら4装備の所持個体をInventoryからevaluate / optimizeへ通し、
既存の有限時間・有限矢数・明示time shareによるdirect single-target DPSとEnchant選択を比較・推薦すること。
純Ranged build、時分割の自動最適化、飛翔・miss・貫通・二次hit・party aura・Life Steal・Soulを追加しない。
既存Power / Critical Hit / Unchanting各1copyの宣言済みLimitedモデルを対象範囲内で使う。
既存モデルの未検証な期待倍率合成はその仮定のまま、実ゲームで独立認定済みと表示しない。

### 不足する最小情報とMac / Switchでの取得

1. **まずMacでsourceの対象別審査**。Identity→configured projectile→target package→継承/Effect/component/Blueprintの設定を追う。
   1 configured projectileだけで1 actual hitや1 ammoを証明しない。未decodeやnative既定値はunknownとして残す。
   全intrinsicと観測モデルの境界が一致しない装備は除外し、固有効果をneutralにしない。
2. **所持状況を確認してから撮影**。対象を所持しているとは仮定しない。周回取得は本WUに含めない。
   既存の再利用可能なversion付きtraceがあれば重複撮影しない。
   Switchの画面に出るversion/platform、装備名・Power・rarity・実slot/Gilded・card、Armor/Artifact/一時buff状態を記録する。
   Switch版とprivate Windows exeが同一buildであるとは宣言しない。既存1.17.0.0入力契約との対応が確認できなければ採用を止める。
3. **各装備1モード×3独立run、最大12短clip**。安全な固定単体target・同じ距離で、各runは目安10完全周期。
   各bowはfull chargeを画面で確認し、charge開始→release→次charge開始可能までを含める。
   Crossbowは発射→reload/recovery→次発射可能まで。途中frameを落とさず、実frame rateとstart/end frameを保存する。
   console録画で読めない場合は既存の撮影手段を使い、追加機材購入は前提にしない。
4. 中立状態で単一hit damageとarrow counterの差を確認する。card rangeなら中点や内部Powerを逆算せず、
   対応する単一hitを採る。追加damage表示・追加矢・proc・target移動等で判別できないrunは失敗扱い。
   neutral damageは選択Enchant/Armor/Strength/target DRを混入させない。敵DRが不明ならdamage sourceとして不適格。
5. Macでclip/観測表のhash、条件、独立run ID、各周期frame、release/charge/recovery境界、damage/ammoを記録する。
   frame分解能の不確かさとrun間変動を明示し、既存完全周期モデルで扱えない不安定さは保留する。
   run1で校正しrun2/3で同条件の有限shots・ammo上限・damageを照合する。
   この3runは対象個体のモデル適合確認であり、**R3/P3Bの独立origin/holdout要件の代替ではない**。

これは全Power・全rarity・全modeを測る計画ではない。ユーザーは実際に評価する個体についてdamage/cycle/ammo/sourceNoteを入力する。
保存した動画から他Powerの値を生成せず、未撮影のmodeを対応済みにしない。
採用条件を満たす最小個体・モードだけで始められ、3 bowのunchargedは別の証拠が揃うまでunsupported。

Switchで得られるのは画面上の版/装備/card/命中damage/矢数/発射・charge・recoveryの時間。
内部ItemPower bits、実効aggregator base、modifier配列、UFunction/CDO、CRT provider/output、MXCSRは取得できない。
後者はHPの未解決境界として残し、本WUの完了条件から外す。

### 実装・検証の方法

- 最初に `src/data/ranged.ts` / `src/core/ranged.ts` の既存モデルを対象別にbindする小さな設計審査を行う。
  対象ID・版・mode・全intrinsic/source・値の由来・拒否するinteraction・観測必須を明示したallowlist/審査recordを設ける。
  **Armor用B/B2をRangedへ無条件流用しない**。新mechanic/新parameter/新interactionが必要になればこのreuse WUから外し、AのR3/P3Bへ戻す。
  既存gateに収まると独立に確認できるまでruntimeへ登録しない。
- 通過対象だけをLimited登録し、observation欠損/違うmode/版/未対応roll・Gilded・固有効果をfail-closedで拒否する。
  観測値のEvidenceは個体の観測provenanceとし、Formal count1やNative leafからMeasured/Verifiedを生成しない。
- `tests/rangedRuntime.test.ts`を拡張し、対象ごとの正例、有限shot境界、ammo、mode、double-count防止、
  evaluate/optimize/lock/Gilded/serialization、対象外variant/特殊矢/不足観測の拒否を確認。
  算術fixtureはsyntheticと明記し、Switch traceの適合検査と独立に保持する。
- 既存Bow/Crossbow、Melee4、Armor11、Artifact3の出力・未知/unsupported拒否をpreservationで確認。
  Ranged audit/support、共通coverage、利用者説明を同期する。
  関連audit/testをローカルで実行し、最終headのFull Validate両jobと独立レビューを通す。
  runtimeを変更するそのPRでは既存 `.openai/hosting.json` projectの本人限定Siteへ反映する。

### 完了条件・停止条件・代替

完了: 審査を通った具体的なID/modeだけが実際にInventory→evaluate→optimize→説明へつながり、
新規装備件数（上限4）と保留装備を報告できる。新しい承認のない式・値・interactionを導入せず、
不足観測を入力画面で補わせ、監査・回帰・最終head CI・独立レビュー・本人限定Site反映が揃った1PRを提出する。
4件全てがeligibleでなければ、証拠が同じ境界で揃う部分集合を明記し、成功数を水増ししない。

停止: 版対応不明、所持なし、必要frame/neutral damage/ammoが読めない、追加effect/secondary hitが残る、
1周期モデルに乗らない、全intrinsic/source境界が審査不能、独立採用/新mechanicが必要、重大review/CI失敗。
不足をunknownのまま記録する。全メモリdump/CRT追跡/Windows環境構築や大量手動実測へ範囲を拡大しない。

代替候補は **Dark Armor単独の既存DR+Soul subset reuse（+1）**。
既存WitherからLife Stealを継承せず、Dark自身の35%DR / +50%Souls / Soul受付とsource・版をbindし、
全intrinsicを保った狭いsubset契約の設計・独立審査が最小の不足となる。
現在のB/B2では未承認なので、単なる定義コピーは不可。
観測HP必須・sole DR・Soul Siphon/他DR/Ranged interaction拒否を維持する。
契約審査が新interactionを要求するなら停止し、Titanへ拡大しない。
本PRはこの代替を実装せず、次回に所持/evidence/最新mainを再確認して適格な対象集合を確定する。

## 再現コマンド

```sh
python3 -B research/native/scripts/check_armor_hp_final_path.py
python3 -B -m unittest discover -s research/native/scripts -p 'test_armor_hp*.py'
python3 -B research/native/scripts/check_armor_hp_final_path.py \
  --local-root /path/to/private/local-game-data --replay \
  --output /tmp/new-independent-replay.json
python3 -B research/native/scripts/summarize_runtime_candidates.py
python3 -B research/native/scripts/validate_native_artifacts.py
npm run audit:formal-integration
npm run audit:runtime-promotion
```

censusを更新する場合だけ `summarize_runtime_candidates.py --write` を用い、入力差分と選定理由を再審査する。
private入力がなければprivate検証/replayは未実施であり、public CIの成功をその代わりにしない。
