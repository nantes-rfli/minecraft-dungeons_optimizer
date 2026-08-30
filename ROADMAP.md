# Roadmap

## 完成条件

このプロジェクトの v1.0 は、手持ちの近接・防具・遠距離・アーティファクトを登録し、実測に基づく火力・回復・防御モデルで目的別の推奨ビルドを再現可能に比較できる状態とします。

完了判定は、以下の全項目が満たされ、`npm test`、`npm run lint`、`npm run build` が成功することです。項目数ベースの現在進捗は **22 / 32（69%）** です。精度や作業量の大きさを表す指標ではなく、「どこまで終わったか」を見失わないためのチェックポイントとして使用します。

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

## Phase 2 — Equipment Coverage（3 / 8）

- [x] Phase 2-1A: 1.17.0.0の近接エンチャント33種を監査・分類し、runtime実装順序とunsupported境界を確定
- [x] Phase 2-1B: Sharpness / Unchanting + Enemy Composition（直接近接modifier・敵割合UI・Evidence・7 / 33 runtime対応）
- [x] Phase 2-1C: Refreshment / Weakening状態モデル（PotionState・追加回復容量・被ダメージcoverage・9 / 33 runtime対応）
- [ ] Phase 2-1D partial: DamageEvent foundation + Shockwave / Swirling / Thundering（12 / 33、3種はPower範囲限定。全50–263の根拠不足）
- [ ] 近接エンチャントを25〜30種類へ拡張
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

Phase 0、Phase 0.5、Phase 0.5.1、Phase 1A、Phase 2-1A、Phase 2-1B、Phase 2-1Cは完了しました。Phase 2-1Aでは1.17.0.0のhero-accessibleな近接エンチャント33種を確定し、`implemented 12（3種範囲限定） / straightforward 0 / needs-state-model 13 / needs-damage-event-model 3 / needs-enemy-state 3 / utility-only 2`へ進みました。Phase 2-1DはDamageEventと3種のPower範囲限定runtimeを実装しました。公開表38 Power点・114 Tier値から個別log補間を行い、外挿せずpartialを維持します。Shockwave 210–252 / Swirling 210–263 / Thundering 248–263以外は未対応です。近接25〜30種への親項目は未完了です。未実装21種はruntime catalogへ入れず、0点評価を防いでいます。Phase 1では既存3武器の公開per-hit timing、Power 50〜263の換算、Void Strikeの公開測定curveまで完了しています。Phase 1-4は公開候補10件を監査しましたが、run-level raw値・完全build・target・versionを再現できるeligible sampleは0 / 5でpartialです。架空値やmodel-derived値は追加しません。Void Strikeの厳密なframe関数、tier別minimum、外部damage消費、target switching、daggers / sawblade系6件、Power fixtureのversion / roll不明、raw game-file fieldの独立確認も継続課題です。

## 更新ルール

- 機能実装と同じ変更で、このファイルと `src/data/roadmap.ts` の状態を更新する。
- `done` はコード・テスト・画面確認がすべて完了した項目だけに付ける。
- 新しい未対応事項を見つけた場合は、握りつぶさず該当Phaseへ追加する。

Phase 2-1D partial — 低Power proc表と共通curveのEvidenceが未解決です。[詳細](./docs/damage-events.md)。次はこの精度境界の補強を優先し、2-1E候補にはCommitted + simple/state系の独立した調査を提案します。 ポーションの連続rate・追加回復容量、Weakeningの50%coverageと時間平均合成はlow-confidence仮定です。Weakening stackingのdungeons.tools/Wiki矛盾は記録済みで最大1個を採用（medium）。合成interactionの独立実機検証とEnemy Compositionの実測も継続課題です。
