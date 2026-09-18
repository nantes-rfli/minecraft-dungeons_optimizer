# Data / Evidence Update Workflow

この文書は、ゲームデータ・外部Evidence・利用者観測を安全に取り込み、必要なときだけruntimeへ反映するための判断フローを定義します。

具体的なコマンド一覧、CI構成、Inventory JSONの現在version、エージェントのcommit / push / deploy手順はそれぞれ `package.json`、GitHub Actions、`src/inventory/storage.ts`、`AGENTS.md` を正本とします。

## 1. Sourceを保存する

対象値を更新する前に、出典と条件を保存します。

- URL / source ID / locator
- game version
- 装備・Power・Tier・条件
- raw observation / snapshot / measurement
- external / self / synthetic の区別
- calibration / holdout / independent run の区別

取得失敗、version不明、競合値を推測で埋めません。既存のresearch snapshotや抽出scriptがある場合はそれを再利用します。

## 2. Research / Canonical modelへ取り込む

Sourceから抽出した値を、そのままOptimizer runtimeへ入れません。

まず対象familyのaudit / canonical research modelへ取り込み、次を明示します。

- entity / property
- raw value と normalized value
- unit / conditions / applicable version
- provenance
- confidence / Evidence Status
- conflict / unknown / unsupported

生成物がある場合は正本から再生成し、生成結果だけを直接編集しません。対象に対応する `generate:*` / `audit:*` は `package.json` を参照します。

## 3. Evidenceを判定する

runtime supportとEvidence Statusは別軸です。

既存runtimeであること、Full / Limitedであること、Catalogに存在することだけを理由にEvidenceをVerified / Measured / Derivedへ昇格させません。

Evidenceの受入・競合・revision・independence・holdout条件は [Evidence intake and validation](./phase8-evidence-intake.md) を基準に扱います。

## 4. Runtime promotionを判断する

未対応・未確認の値を `0` や `1` の代替値としてOptimizerへ登録しません。

parameter / mechanicをruntimeへ昇格できるのは、対象のEvidence Adoption DecisionとProduct側のregression gateを満たした場合だけです。

promotion時は [Runtime Promotion Pipeline](./runtime-promotion-pipeline.md) に従い、同じ変更単位で次を同期します。

- runtime
- support manifest
- 利用者向け説明
- coverage
- regression

Evidenceが弱まった、競合した、versionがずれた場合は、必要に応じてhold / demotion / Limited boundaryへ戻します。

## 5. Coverage / backlogを同期する

runtime support、Evidence coverage、Source Harvest coverage、Research backlogは同じ指標ではありません。

変更した対象に応じて、関連するmanifest / coverage / backlog / measurement protocolを同期します。

- [Runtime limitations / backlog](./runtime-limitations.md)
- [Evidence & Coverage](./combined-evidence-coverage.md)
- [Measurement protocols](./measurement-protocols.md)
- [Roadmap](../ROADMAP.md)

カテゴリごとにdenominatorが異なるため、意味の異なるcoverageを一つの総合percentageへまとめません。

## 6. 変更に関係する検証を行う

ローカルでは、その変更に関係する検証だけを実行します。

例:

- data / Evidence変更: 対応する `audit:*` と生成drift確認
- runtime計算変更: 関連unit test、type check、必要なregression
- UI変更: 関連test / build / 必要なE2E
- schema / migration変更: 現行形式のround-tripと対応する旧形式の読込・復旧

全体のValidateはGitHub Actionsが担当します。理由なくローカルでCIと同じ全検証を重複実行しません。

新しい境界やreject条件を追加した場合は、成功ケースだけでなく拒否ケースもテストします。

## 7. UI / 利用者境界を確認する

利用者に見える変更では、少なくとも次を確認します。

- 入力できる値と制約
- unsupported / unknownの理由表示
- Evidenceやlimitationsの説明
- JSON / localStorageの互換性に影響がないか
- キーボード操作やエラー通知

E2E / a11yは主要フローの自動確認であり、すべての支援技術を保証するものではありません。

## 8. 反映する

commit / push / Site反映の作業範囲は [AGENTS.md](../AGENTS.md) を正本とします。

この文書では、Data / Evidence更新だからという理由だけで追加のdeployや全検証を要求しません。

## Compatibility

Inventory JSONの現在schemaと読込可能versionは `src/inventory/storage.ts` を正本とします。research schemaVersion、EvidenceのgameVersion、source IDも製品versionとは別の互換性軸です。

schemaを変更する場合だけmigrationと互換性条件を明示的に更新し、既存データを黙って破棄・上書きしません。

source revisionやEvidenceを訂正する場合も、追跡可能性を保ち、過去の根拠を黙示的に消しません。

## Related documents

- [Catalog / Inventory / Runtime / Evidence separation](./catalog-evidence-runtime-separation.md)
- [Evidence intake and validation](./phase8-evidence-intake.md)
- [Runtime Promotion Pipeline](./runtime-promotion-pipeline.md)
- [Evidence & Coverage](./combined-evidence-coverage.md)
- [Runtime limitations / backlog](./runtime-limitations.md)
- [Roadmap](../ROADMAP.md)
