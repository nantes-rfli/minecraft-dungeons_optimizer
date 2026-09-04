# Data / Evidence Update Workflow

目的は、仕様を自由に変えながら根拠・対応範囲・保存データを安全に更新できることです。製品のsemantic version・正式版判定は運用しません。変更追跡の正本はGit commit history、軽量な案内は[changes](changes.md)です。

1. **Source snapshot**: 対象データの出典URL、取得日、ゲーム版、装備・Power・Tier・条件、原文/画像の位置を保存します。既存research配下のsnapshotと抽出スクリプトを使い、利用者観測・synthetic fixture・独立実測を区別します。取得失敗や版不明を推測で埋めません。
2. **Audit**: 対象familyの構造化auditとsource参照を更新します。母集団のprimary/secondary差分、未確認値、競合Evidenceを維持します。例: 遠距離なら `npm run generate:ranged` → `npm run audit:ranged` → `npm run audit:ranged-enchants`。既存生成コマンドで再現できることを確認し、生成物だけを手編集しません。
3. **Runtime判断**: Evidence・計算式・stacking・channel・state/objective・対応境界・testsが揃った効果だけをpromotionします。弱まった根拠はdemotionまたは明示的なLimitedへ戻します。未対応候補を0点としてOptimizerに登録しません。独立実測がなければPhase 2-5A/B/Cをcloseしません。
4. **Coverage**: manifest/read modelを更新し、`npm run generate:evidence-coverage` → `npm run audit:evidence-coverage`。カテゴリ別denominatorとsupport分類が一致すること、関連生成docsに意図しない差がないことをレビューします。
5. **Measurement / backlog**: `docs/measurement-protocols.md`、structured backlog、優先度・blocker・close条件を同期します。独立性を満たさない測定はeligibleへ昇格しません。Roadmapの歴史的completion条件を都合よく変更しません。
6. **検証**: `package.json` の全 `audit:*`、`npm test`、`npx tsc -b`、`npm run lint`、`npm run build`、`npm run test:e2e` を実行。性能は `npm run test:performance` の候補数と参考時間、E2E artifactのブラウザ応答性を確認します。新しい境界は正常・拒否の両方を振る舞いとしてテストします。schema変更時は旧JSON/import/localStorage復元と壊れたデータ保持も検証します。
7. **UI確認**: 対象装備の入力、未対応理由、結果の根拠/limitations、Coverage/Methodology、キーボード・エラー通知を確認。E2E/a11yは主要フローの自動確認であり全支援技術の保証ではありません。
8. **反映**: 意図した差分のみを英語Conventional Commitで作業ブランチへコミットし、検証済みcommitをmainへ反映してpushします。AGENTS.mdの手順で同じcommitを既存本人限定Sitesへ反映し、アクセスと成功状態を確認します。認証情報は保存しません。失敗時は到達点を記録し、成功と表現しません。

## 互換性と復旧

Inventory JSON `version: 2`、旧version 1の読込、localStorageの既存key、research schemaVersion、EvidenceのgameVersionは製品バージョンとは別です。互換性が変わるときだけschema/migrationを明示的に更新します。既存source IDは根拠を追跡するため維持します。

公開後に問題が見つかった場合は原因・影響を記録し、修正またはrevertを新しいcommitとして検証し直して同じ本人限定サイトへ反映します。force pushや根拠の黙示削除は行いません。一般公開やfeedback・privacy/analyticsの整備はPublic Availabilityで別途判断します。
