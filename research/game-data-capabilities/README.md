# Phase 6.7 取得可能性調査の観測記録

調査日: 2026-09-07。判断・Phase・項目別対応は [調査報告](../../docs/game-data-capabilities.md)。

本ディレクトリは新しい取得能力の観測を保存する。既存のformal extraction record/canonical mappingと区別するため、`status: capability-observation`、`promotionStatus: research-only` を付けた。既存auditの対象に自動追加される形式ではなく、今回のJSON検証は別途行った。

| ファイル | 内容 |
|---|---|
| inventory.json | 全uasset走査の集計、全DataTable一覧、ゲーム版の設定値とhash |
| static-observations.json | 24アセット25数値。object、property型、配列index、byte range、export位置、両ファイルhash |
| logic-observations.json | 関数候補レイアウトの件数、63件の未対応、代表関数の位置・長さ・hash、native親の証拠 |
| table-observations.json | 4表の行数・行名・終端・未対応診断、4カーブの読めない構造 |

## 証拠の読み方

- asset pathは `local-game-data/QuickBMS 1.17.0.0/` からの相対パス。生ファイルはGitへ含めない。
- staticの`byteRange`はCDO export内相対値。`exportUexpOffset`を加えるとuexp内の位置になる。property tagを含む範囲であり、数値payloadだけの範囲ではない。
- logicの`uexpOffset`はfunction exportの位置、`scriptOffset`はそのexport内の候補script開始位置。`scriptSha256`はその候補領域のみのhash。元ファイル版の保証と混同しない。
- `candidate-layout-consistent-not-full-disassembly`は探索的な境界整合。63例外を含め完全なUFunction readerの実績ではない。
- tableの残り0 byteは構造上の終了確認。TextProperty等の未対応値は解読成功と数えない。
- semanticとversionの未解決を保持する。ゲーム設定のProjectVersionは元配布物の真正性や全ファイル同版の証明ではない。

## ローカルの再現資料

同じワークスペースのignoredディレクトリ `local-game-data/capability-research-2026-09-07/` に、実行した5つの探索用スクリプト、全体走査の詳細JSON、検証ログを保存した。アプリ、既存の抽出器、npm dependenciesへの変更はない。

プロジェクトrootで次の順序で実行する。スクリプトは今回のワークスペース絶対パスと `/tmp/mcd-*.json` の中間出力を使用するため、他のチェックアウトではパスを調整する。手元の元データが必要で、CIでの実行は前提にしない。

```sh
node local-game-data/capability-research-2026-09-07/mcd-capability-probe.mjs
node local-game-data/capability-research-2026-09-07/mcd-deep-probe.mjs
node local-game-data/capability-research-2026-09-07/mcd-function-probe.mjs
node local-game-data/capability-research-2026-09-07/mcd-table-probe.mjs
```

`mcd-save-capability.mjs` は上記出力を選別して本ディレクトリを生成した保存処理。再実行には5スクリプトを `/tmp/` にも置く必要がある。探索用コードは独立readerと照合していないので、正式parserへそのまま転用しない。

Gitからのみ再確認する場合は、baseline commitの `src/research/ue4/packageReader.ts` / `propertyReader.ts` / `objectResolver.ts` と本JSONを読む。全体走査は同じデータから全`.uasset`を辞書順に列挙し、summary/import/exportを読み、classIndexを解決してFunction/DataTable等を数える。CDO property読取はtolerant。表は通常exportのtagged properties終端後のGUID有無・行数・行名・行propertyを順に読む。詳細な試験レイアウトと不一致の扱いは報告書を参照。

ローカル詳細JSONは探索中のproperty値やファイル名を広く含む。Gitへ追加せず、必要な観測だけを出典とともに選別する。

## 検証（2026-09-07）

- `npm run audit:game-data-inventory`: 成功。元ツリーのpath/size fingerprintが既存値と一致。
- `npm run audit:game-data-extractor`: 成功。既存5アセットのraw再読取とhash一致。
- `npm run audit:game-data-model-alignment`: 成功。歴史的結果の再現性を維持（推薦Phase 7という当時の値も保持）。
- `npm test`: 53ファイル、1,435テスト成功。
- `npm run lint`: 成功。
- `npm run build`: 成功。vinextのroute分類に関する既存のinformational表示あり。
- 新規JSON: JSON構文、件数の一致、重複、hash、選択したstatic値の元ファイル再読取、相対リンクを別途確認。

これらの既存audit/test成功は、今回の探索用function/table readerの意味的な正しさを保証しない。Phase 6.8の独立検証は未実施。

サイトの表示・計算・配信設定に影響しない内部資料のため、Sites更新は不要。
