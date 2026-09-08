# 攻撃タイミング・通知イベントの取得調査 — Phase 6.8E

調査日: 2026-09-08。[前回の検証](./game-data-validation.md)に続き、アプリコードを変更せず近接武器の設定とアニメーションを調べた。

## 結論

**攻撃間隔の単一値より詳しい、攻撃段階・連続ダメージ・発動契機・キャンセルの設定を取得できる。** ただし、実時間への換算とnativeでの適用順序が未確定のため、これを実効ヒット頻度へ直接採用しない。

近接武器ディレクトリ内のAnimations配下とInstance、ClaymoreのAnimBlueprintを選び、378個の異なるアセットを379回読んだ（ClaymoreInstanceを重複読取）。さらに通知用Blueprint 5個を読み、合計383アセット・384回すべてUAssetAPI 1.1.0 / UE4_22でバイナリ往復一致した。入力766ファイルは前回PAK比較とすべて一致する。全アニメーションの網羅や、選択したものすべてのゲーム内使用を証明する集合ではない。

| 取得対象 | 結果 |
|---|---:|
| 明示的ConfiguredAttackVariantsを持つInstance | 82 |
| 明示的な攻撃variant | 293 |
| AnimComposite / AnimSequence | 256 / 32 |
| 通知イベント | 671 |
| 連続ダメージ間隔・複数ループ設定のあるvariant | 2 |
| キャンセル位置を上書きするvariant | 6 |

## 同じ武器に複数の時間がある

クレイモアの設定値は以下。表は表示用に丸めている。元のfloatは[観測JSON](../research/game-data-timing/weapon-timing.json)に保存した。

| variant | 対応AnimComposite長 | 攻撃設定時間 | DamageDelaySeconds | CooldownSeconds |
|---|---:|---:|---:|---:|
| Forehand | 1.0 | 0.7 | 0.2 | 0.15 |
| Backhand | 0.8 | 0.5 | 0.2 | 0.15 |
| Lunge | 1.2 | 0.8 | 0.5 | 0.4 |

`AttackSequence`参照で3つのCompositeへ繋がる。ForehandのCompositeは元AnimSequenceの約0.2〜1.2を参照し、AnimPlayRateは1。元のClaymoreComboはNumFrames 90、SequenceLength約3.70833を持つ。フレーム番号や長さだけからゲームのヒット間隔を決めない。

Forehandの通知には音（LinkValue約0.13914）、粒子（約0.24914、Duration約0.03333）、カメラ揺れ（約0.26665）がある。DamageDelaySecondsの0.2とは別の設定である。LinkValueと通知オフセットは保存するが、実効発生時刻への換算を確定したとは扱わない。攻撃速度補正、blend、途中キャンセル、cooldownの起算点は未解明。

## 連続攻撃・発動契機・キャンセルを分ける必要がある

チェーンソード通常版のStretchには次が設定されている。

- 攻撃設定時間0.2、DamageDelaySeconds 0、CooldownSeconds 1.5。
- ContinuousDamageInterval約0.15、VariantLoopAmount 10（Unique1は15）。
- bTriggerEnchantmentsAfterDamageはfalse、bTriggerEnchantmentsOnReleaseはtrue。

従って「variant 1つ＝ヒット1回」「ダメージごとにすべてのエンチャントを試行」と固定する設計には根拠が足りない。ただし、ループ回数と間隔からヒット数やDPSを計算するには、終了条件・押下/解放・nativeのスケジューリングを確認する必要がある。すべてのエンチャントがこの設定だけに従うとも断定しない。

アンカー通常版のHeavyForehandには攻撃設定時間2.5、DamageDelaySeconds 1.0、bOverrideCancelPoint=true、CancelPointOverride約0.9がある。後者の単位や実際のキャンセル許可条件は未確認であり「0.9秒でキャンセルできる」とは結論しない。AnchorとUnique1、BoneclubとUnique1で計6variantの上書きがあった。

## 通知イベントはダメージイベントと同義ではない

671件の分類は、DungeonsPlaySound 289、CustomParticle 291、CameraShake 41、PlayParticleEffect 29、武器固有Blueprint通知6、名前のみSlash0/Slash1 15。これらの件数は保存された設定であり、実ゲームでの発火回数ではない。

5つのBlueprintを追加で読み、命令列から以下を確認した。

- CameraShakeNotifyはPlayWorldCameraShakeAtPawnを呼ぶ。
- Katana_Unique2 / Hammer_Unique1 / Hammer_Unique2の通知にはSetGearActorMaterialInstanceScalar呼出がある。Katanaでは開始時にEmissivePowerを3000、終了時に0へ設定する。tickでも数値計算とmaterial操作を行う。
- Whipの通知はcomponent取得・有効性判定の後にPlayAnimationを呼ぶ。

これだけでnative親や他の処理の副作用を否定はできないが、読めた処理をダメージ式として登録する根拠はない。

Slash0/Slash1は15通知にある。全ローカルuassetをASCII文字列で検索したところ17ファイルが一致し、今回の選択外は粒子名PS_EndMasterBackstabberSlash1の1ファイルだった。AnimNotify_Slash0/1という受信関数名候補は一致しなかった。**名前検索は参照解決ではなく、受け手が存在しない証明ではない。** 受信処理・native側の名前照合は未確定。

AnimSequence 32個のExtrasは合計1,009,108 byteで、バイナリ一致の際にも未解釈で保存されている。骨の圧縮トラックや軌跡を復元したわけではなく、当たり判定の時空間範囲も未確定。

## native側の追加調査

[MicrosoftのPE仕様](https://learn.microsoft.com/en-us/windows/win32/debug/pe-format)に沿ってimport descriptor、64-bit thunk、export、debug directoryを静的に読み取った。41 import descriptorに各1 entry、90 named export、3 debug entryがある。CodeViewにはDungeons-Win64-Shipping.pdb、age 2が記録されている。これはPDB本体の入手やシンボル解決を意味しない。

PrintScriptCallstackのexportもあるが、RVAは前回確認した高entropyの先頭セクション内を指す。export名があるだけでは、当該位置を実行時と同じ機械語として読めると保証できない。Power・抽選・倍率合成・攻撃時間のスケジューリングは今回も復元できていない。ゲームexeと同梱DLLは実行していない。

## モデルと次のPhaseへの反映

`src/core/attackProfile.ts`は現在、公開されたhit duration列または実測コンボ時間から頻度を求める。今回の設定時間をこの列へ直接代入するのは不適切。次の4層を分離した設計案をPhase 6.9で検討する。

1. Source: archive・asset hash、元のproperty名・参照。
2. AttackDefinition: variant列、遅延、連続間隔、ループ、発動契機、キャンセル設定。
3. Playback/Mechanic: animation参照、通知、速度補正とnative処理の適用規則。
4. Observation/Scenario: 実測ヒット列、入力の押下/解放、対象・距離・中断条件。

6.8Eは**設定と代表通知の読解まで進行、実効時間への連結は未完了**。6.8Dも継続未完了。次の優先対象はチェーンソードの連続ダメージと発動契機、アンカーのキャンセル、通常武器の速度/CD適用規則。それぞれ「設定から確定」「native確認が必要」「実測が必要」を分ける。既存Gapの自動close、未対応効果の0点登録、runtimeの置換はしていない。

調査JSONと再現案内は[research/game-data-timing](../research/game-data-timing/README.md)。内部調査のみのためSites更新は不要。
