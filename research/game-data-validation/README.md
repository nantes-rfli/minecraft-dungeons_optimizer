# Phase 6.8 — ゲームデータ検証の観測記録

調査日: 2026-09-08。結論とPhaseの終了条件は[検証レポート](../../docs/game-data-validation.md)を参照。アプリコードとruntimeデータは変更していない。6.8A〜Cは代表検証まで完了、6.8D/Eと6.9は未完了。

## 保存した証拠

| ファイル | 内容 |
|---|---|
| [archive-validation.json](./archive-validation.json) | ZIP hash、47 PAKの索引検証、全134,799エントリの比較集計、名前差と内容差 |
| [independent-reader.json](./independent-reader.json) | reader/DLL hash、97アセットと194入力ファイルのhash、809関数、25数値、4表、4カーブ、前回63例外 |
| [asset-differences.json](./asset-differences.json) | uassetと対になる33変更uexpの新旧差分。独立readerでのみ見つかった3組のCDO差分を含む |
| [reference-chains.json](./reference-chains.json) | package・親・Effectの参照経路と、敵の盾・音・粒子の処理の代表確認 |
| [native-boundary.json](./native-boundary.json) | PE構造・VERSIONINFO・native計算の未解決境界 |

比較の基準はPhase 6.7のcommit `1adb4e505ad5ebee0fed193553cca313bcf07949`。ゲームファイル、デコードした全本文、SDK、依存ライブラリはGitへ含めない。ソース配布物の真正性は未確認。checksum一致は内容の整合性を示すが、真正性を保証しない。

## ローカルの再現資料

以下はリポジトリ直下のgitignore対象に保存している。他環境ではユーザーが持つ同じ入力が必要になる。

- `local-game-data/archive-1.17.0.0/`: 入力ZIP、抽出した47 PAKと実行ファイル、import-manifest.json。
- `local-game-data/QuickBMS 1.17.0.0/`: 既存抽出物。上書きしていない。
- `local-game-data/phase6.8/`: 調査probe、全件比較、独立readerのJSON、検証ログ。

Phase 6.8のローカル手順と生成物:

1. `pak_probe.py` / `compare_paks.py`で索引・entry・格納payload・展開長を検証し、既存ファイルとSHA-256比較する。索引復号のキーは`MCD_PAK_AES_KEY`環境変数で受け取り、ここへ記載しない。`pak-indexes.json`、`pak-comparison-full.json`、`pak-comparison-summary.json`が全件の根拠。
2. `selected-assets.json`と`chain-assets.json`の入力を、`uasset-probe/Probe.csproj`で読む。.NET SDK 10.0.400とNuGet UAssetAPI 1.1.0をローカルに配置し、UE4_22を指定。Probe.dllの引数は入力ルート、選択JSON、出力ディレクトリ。`VerifyBinaryEquality()`で読取後の直列化を元バイトと比較し、ゲームファイルへは書き戻さない。
3. `validate_independent.py`が`uasset-json/`と`chain-json/`の計97件を集計。`independent-validation.json`に数値・表・曲線の照合結果を残す。
4. `extract_changed.py`で対象33組を`archive-differences/`へ分離。新旧双方を同じreaderで読み、`compare-independent-differences.py`で比較する。`baseline-diff-json/summary.json`、`archive-diff-json/summary.json`が66回の往復確認、`independent-differences.json`が差分の根拠。`changed-cdo-comparison.json`は既存の部分readerによる比較であり、これだけで一致と判定しない。
5. `trace-chains.py`でOuterIndexを辿り、`native_probe.py`で実行せずPE構造を読む。`reference-chains.json`、`native-structure.json`へ保存する。
6. `save_reports.py`でこのディレクトリへ集約する。大型の全件結果や未解釈のゲーム本文はローカルに残す。

独立readerは[UAssetAPI](https://github.com/atenfyr/UAssetAPI)、PAK配置の参照は[repak](https://github.com/trumank/repak)。実際のreaderバージョンとDLL hashは観測JSONを優先する。調査probeはアプリの正式な取得器ではない。

## 検証と限界

関連audit（game-data-extractor / game-data-model-alignment）、`npm test`（53ファイル・1,435テスト）、`npm run lint`、`npm run build`が成功。ログはPhase 6.8のローカルフォルダに保存した。`check_reports.py`で観測JSONの件数・194入力hash・計163回の往復結果・33組の差分・相対リンクを別に確認した。

97アセットの往復一致は全45,311アセットの対応保証ではない。未解釈Extrasの保存も往復一致に含まれる。命令列のデコードと意味の検証を分け、nativeのPower・発動率・倍率合成・CDは未確定のまま保持する。ゲーム実行ファイルや同梱DLLは実行していない。
