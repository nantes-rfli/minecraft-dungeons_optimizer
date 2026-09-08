# Phase 6.8E: 攻撃設定と通知の観測

[調査結果](../../docs/game-data-timing.md)。2026-09-08、research-only、runtime昇格なし。

- [summary.json](./summary.json): 選択範囲・件数・5通知Blueprintの呼出先・名前検索の限界。
- [weapon-timing.json](./weapon-timing.json): 82 Instance、293 variantの時間・連続攻撃・キャンセル・発動契機。値は設定であり実測値ではない。
- [animation-timing.json](./animation-timing.json): 288 animation exportの長さ・未解釈Extras量・通知件数、Claymoreの詳細。
- [native-imports.json](./native-imports.json): exe hash、import/export/debugの静的観測。実行やnative式の復元はしていない。

ゲームデータ全本文と試験コードはgitignore対象`local-game-data/phase6.8/timing/`に保存。既存のローカルUAssetAPI Probeを使い、`selected.json` / `instances.json` / `notify-assets.json`を入力ルート、選択JSON、出力ディレクトリの順で渡す。`json/` / `instances-json/` / `notify-json/`のsummaryが384回の往復一致の根拠。`analyze.py`が全設定と通知を`observations.json`へ抽出し、`save_report.py`が必要な観測へ絞って本ディレクトリへ保存する。`native_imports.py`はPEテーブルを実行せず読む。

383個の異なるアセット、766入力ファイルが旧抽出物とPAKで一致。各sourceHashesはローカル入力のSHA-256。複製読取1回を独立した追加サンプルとして数えない。前回の97アセットとの重複もあるため、前回件数と単純加算しない。

アプリコードに変更はなく、前回b02503dで確認した関連audit・1,435テスト・lint・buildの成功結果を再利用する。今回の観測は`check_report.py`で件数、766入力hashとPAK一致、384回の往復結果、相対リンク、research-onlyフラグを別に検証し成功した。設定値の単位や適用処理が未確認の項目を、表示名だけから実効仕様へ昇格しない。
