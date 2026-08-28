# Roadmap

## 完成条件

このプロジェクトの v1.0 は、手持ちの近接・防具・遠距離・アーティファクトを登録し、実測に基づく火力・回復・防御モデルで目的別の推奨ビルドを再現可能に比較できる状態とします。

完了判定は、以下の全項目が満たされ、`npm test`、`npm run lint`、`npm run build` が成功することです。項目数ベースの現在進捗は **15 / 27（56%）** です。精度や作業量の大きさを表す指標ではなく、「どこまで終わったか」を見失わないためのチェックポイントとして使用します。

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

## Phase 1 — Accuracy（0 / 4）

- [ ] 3武器のコンボ時間をフレーム計測（データ形式・計算境界・回帰テストは実装済み、実測待ち）
- [ ] Power Levelから実ダメージへの換算（表示ダメージ入力と混在防止は実装済み、共通曲線の実測待ち）
- [ ] 虚無の一撃の時間曲線を実測（複数サンプルの中央値・補間・消滅処理は実装済み、実測待ち）
- [ ] 実測値による回帰テストと誤差範囲の表示（集計・P90参考範囲・不足表示は実装済み、実測サンプル待ち）

完了条件: 対応する3武器について、ゲーム内実測値とモデル出力の誤差範囲を表示できること。

## Phase 2 — Equipment Coverage（0 / 4）

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

Phase 0、Phase 0.5、Phase 0.5.1は完了しました。Radiance stacking、Gilded Tier I / II / III、武器本体の直接撃破数までCore Model Integrityを仕上げたため、Phase 1の実測データ登録へ進行可能です。

## 更新ルール

- 機能実装と同じ変更で、このファイルと `src/data/roadmap.ts` の状態を更新する。
- `done` はコード・テスト・画面確認がすべて完了した項目だけに付ける。
- 新しい未対応事項を見つけた場合は、握りつぶさず該当Phaseへ追加する。
