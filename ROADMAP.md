# Roadmap

## 完成条件

このプロジェクトの v1.0 は、手持ちの近接・防具・遠距離・アーティファクトを登録し、実測に基づく火力・回復・防御・独立Controlモデルで目的別の推奨ビルドを再現可能に比較できる状態とします。

完了判定は、以下の全項目が満たされ、`npm test`、`npm run lint`、`npm run build` が成功することです。項目数ベースの現在進捗は **23 / 37（62%）** です。精度や作業量の大きさを表す指標ではなく、「どこまで終わったか」を見失わないためのチェックポイントとして使用します。

## Phase 0 — Optimizer Core（5 / 5 完了）

- [x] 個体別の手持ち・候補エンチャント・Power入力
- [x] 確定済みスロット・金色エンチャント Tier I / II / III の入力
- [x] 全探索・目的別シナリオ・Pareto前線
- [x] 効果別の寄与度・根拠・信頼度表示
- [x] localStorage・version付きJSON入出力

## Phase 0.5 — Core Model Integrity（7 / 7 完了）

- [x] tier・sourceを保持するEnchant選択モデル
- [x] Enchantment stackingと重複Build制御
- [x] Artifact stacking behavior
- [x] Build依存kill rateとCombat State境界
- [x] 主要Evidenceを反映するモデル信頼度
- [x] Weapon Power未反映の明示警告
- [x] Golden Testと設計ドキュメント更新

完了条件: Build依存kill rate、Enchant / Artifact stacking、tier保持、主要Evidenceの信頼度、外部実測値テストが一貫した計算経路で動作すること。

## Phase 0.5.1 — Core Model Cleanup（3 / 3 完了）

- [x] Radianceをコピー別係数`100% / 75% / 50% / 25%`でstack
- [x] Gilded Tier I / II / III の編集・保存・JSON入出力
- [x] `directWeaponKillsPerSecond`をCombat Stateで一元算出

完了条件: Radiance stacking、Gilded Tier、Leeching / Guarding Strikeの直接撃破依存が、同じ型・保存・評価・Evidence経路で動作すること。

## Phase 1A — Melee Attack Profile Audit（1 / 1 完了）

- [x] 1.17.0.0の入手可能な近接武器82件を登録・分類し、静的auditデータ、Validator、再生成可能なcoverageレポートを作成

完了条件: 全82武器が `exact / verified-shared / partial / inferred / missing` のいずれかに分類され、公開情報のcoverageと未解決一覧を `npm run audit:melee` で再現できること。現在は `exact 76 / partial 6`、strict runtime-readyは92.7%。research結果だけを根拠にruntime catalogや既存3武器のprofileは変更しない。

## Phase 1 — Accuracy（3 / 4）

- [x] 3武器の公開per-hit timingをruntime登録し、HPSをduration合計から導出（独立実機測定は将来のcross-checkとして継続可能）
- [x] Power 50〜263のAnchor curveと1.17.0.0内部Power rating比を分離し、W/Gモデルを29 sampleでcross-validation（version不明fixtureとの最大45.06%差をmedium-confidence caveatとして保持）
- [x] 虚無の一撃を公開測定に基づく不連続curve（付与hit 1倍、armed minimum 1.25倍、3.6秒でTier III 7倍、5秒で消滅）へ置換し、3武器のper-hit interval・再適用・戦闘時間・attack speedをruntimeへ反映
- [ ] 実測値による回帰テストと誤差範囲の表示（公開候補10件を監査、eligible 0 / 5。provenance・validator・中央値を含む統計・pending/available UIまで実装済み）

完了条件: 対応する3武器について、独立した公開ゲーム内実測を最低5件採用し、モデル出力の誤差統計とP90参考範囲を表示できること。現在は公開条件を再現できるsampleが0件のため、Phase 1 Accuracyは3 / 4を維持する。

## Phase 2 — Equipment Coverage（4 / 13）

- [x] Phase 2-1A: 1.17.0.0の近接エンチャント33種を監査・分類し、runtime実装順序とunsupported境界を確定
- [x] Phase 2-1B: Sharpness / Unchanting + Enemy Composition（直接近接modifier・敵割合UI・Evidence・7 / 33 runtime対応）
- [x] Phase 2-1C: Refreshment / Weakening状態モデル（PotionState・追加回復容量・被ダメージcoverage・9 / 33 runtime対応）
- [ ] Phase 2-1D partial: DamageEvent foundation + Shockwave / Swirling / Thundering（12 / 33、3種はPower範囲限定。全50–263の根拠不足）
- [x] Phase 2-1E: Ambush / Smiting / Committed（catalog 15 / 33、広域12・範囲限定3）
- [ ] Phase 2-1F partial: Artifact Synergy / Rampagingの限定Temporal State（catalog 17 / 33、広域14・範囲限定3、Echo research-only）
- [ ] Phase 2-1H partial: Fire Aspect / Poison Cloud / Exploding（catalog22 / 33、広域17・範囲限定5、stack/Void/overlap未検証）
- [ ] Phase 2-1G partial: Soul Scythe / Soul subsystem / Anima / Siphon（catalog 19 / 33、広域16・範囲限定3、Enigma mapping未検証）
- [ ] Phase 2-1I partial: Control第4軸 + Chains / Stunning / Freezing / Gravity（catalog26 / 33、広域21・限定5、stack/duration/免疫制限）
- [ ] 近接エンチャントを25〜30種類へ拡張（26種へ到達、制限評価を残して進行中）
- [ ] アーティファクトを10〜15種類へ拡張
- [ ] 防具・防具エンチャントをモデル化
- [ ] 遠距離武器・固有効果をモデル化

完了条件: 主要な近接・防具・遠距離の組み合わせを、同じ `evaluate` / `optimize` APIで評価できること。

## Phase 3 — Release Readiness（0 / 4）

- [ ] Web Worker化と探索時間の上限管理
- [ ] 主要操作のE2Eテストとアクセシビリティ監査
- [ ] 大規模手持ちデータの性能基準を達成
- [ ] データ更新手順・リリース判定を文書化

完了条件: 代表的な大規模データでUIが固まらず、主要操作の自動テスト・アクセシビリティ監査・ビルド検証を通過すること。

## 現在の作業位置

Phase 0、Phase 0.5、Phase 0.5.1、Phase 1A、Phase 2-1A、Phase 2-1B、Phase 2-1C、Phase 2-1Eは完了しました。Phase 2-1Aでは1.17.0.0のhero-accessibleな近接エンチャント33種を確定し、`implemented 26（広域21・5種範囲限定） / straightforward 0 / needs-state-model 5 / needs-damage-event-model 0 / needs-enemy-state 0 / utility-only 2`へ進みました。Phase 2-1DはDamageEventと3種のPower範囲限定runtimeを実装しました。公開表38 Power点・114 Tier値から個別log補間を行い、外挿せずpartialを維持します。Shockwave 210–252 / Swirling 210–263 / Thundering 248–263以外は未対応です。近接25〜30種への親項目は未完了です。未実装7種はruntime catalogへ入れず、0点評価を防いでいます。Phase 1では既存3武器の公開per-hit timing、Power 50〜263の換算、Void Strikeの公開測定curveまで完了しています。Phase 1-4は公開候補10件を監査しましたが、run-level raw値・完全build・target・versionを再現できるeligible sampleは0 / 5でpartialです。架空値やmodel-derived値は追加しません。Void Strikeの厳密なframe関数、tier別minimum、外部damage消費、target switching、daggers / sawblade系6件、Power fixtureのversion / roll不明、raw game-file fieldの独立確認も継続課題です。

## 更新ルール

- 機能実装と同じ変更で、このファイルと `src/data/roadmap.ts` の状態を更新する。
- `done` はコード・テスト・画面確認がすべて完了した項目だけに付ける。
- 新しい未対応事項を見つけた場合は、握りつぶさず該当Phaseへ追加する。

Phase 2-1D partial — 低Power proc表と共通curveのEvidenceが未解決です。[詳細](./docs/damage-events.md)。Phase 2-1EはAmbush / Smitingの個別exposure・共通条件stackingとCommittedの解析HP推移を実装済みです。Phase 2-1FはArtifact Synergy / Rampagingを実装、Echoはrepeat/animation/combo/Void/kill根拠不足でpartial。Phase 2-1GはSoul ScytheでAnima / Siphonを実装しましたが、EnigmaのSoul→chance mappingが未検証でpartialです。pickup/resourceを分離し、容量300・開始0・消費なしを採用。[Soul設計と次batch比較](./docs/soul-subsystem.md)を参照。Phase 2-1HではFire Aspect / Poison Cloud / Explodingを限定実装。CC utility subsystemはPhase 2-1Iで限定実装済みです。次はPain Cycle / Dynamoのcharge/consume state監査を推奨します。CC utility、Pain Cycle / Dynamo / Busy Beeとの[比較と制約](./docs/temporal-enchantments.md)を参照。 ポーションの連続rate・追加回復容量、Weakeningの50%coverageと時間平均合成はlow-confidence仮定です。Weakening stackingのdungeons.tools/Wiki矛盾は記録済みで最大1個を採用（medium）。合成interactionの独立実機検証とEnemy Compositionの実測も継続課題です。

Phase 2-1Gの終了条件のうち、合法Soul武器・通常/金色/保存/JSON/Optimizer・Soul収入/ゲージ・Anima/Siphon・Rampaging整合は対応済み。Enigmaの中間ゲージ実測、絶対量/割合、100 cap履歴、Bag of Souls差を解決するまでfull completeにはしません。Anima満タン時の名目容量とSiphonのAoE抽選単位もlow-confidence制限として記録しています。

Phase 2-1Hはpartial。Fire Power70–251・1copy（250の異常値はrawのみ）、Poison184–251・編集可能な滞在／target-secondsとPoisson飽和仮定、Explodingは直接撃破から二次対象へのHP比率damageでno-chain。内側source-rate固定点と外側Rampaging固定点を組み合わせる。3種とVoidの併用は拒否。needs-damage-event-model0は全メカニクスの実測完了を意味しない。[設計と残課題](./docs/dot-and-explosion-damage.md)。


Phase 2-1Iはpartial。4つのraw CC指標とControl utility、4軸objective/Pareto、contribution、通常/確定/金色/保存/JSONを実装。
Chainsはgame4copy/runtime1copy、Stunning基準2秒はcommunity由来low。Freezingをattack-speed-slowへ訂正、Gravityは集敵のみ。
CCをDPS/DR/kill/Ambush/Weakeningへ転用しない。4buildの旧commit回帰、有限Bernoulli coverageの独立oracleを含む検証を追加。
26種のruntimeに意味ある評価と制約があるが、親25〜30種は件数だけでcloseせず進行中とする。
[CCの設計・policy・残課題と次候補比較](./docs/cc-utility.md)を参照。既存のPhase 1-4 / 2-1D / F / G / H partialは維持する。
