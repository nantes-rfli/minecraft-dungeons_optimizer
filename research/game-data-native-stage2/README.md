# Phase 6.8D — native起動処理の観測

2026-09-09、research-only。[調査結果](../../docs/game-data-native-stage2.md)と[観測JSON](./observations.json)。アプリコード・runtime・Gap判定は変更しない。

`observations.json` は入力hash、仮想環境の条件、API呼び出し列、GetThreadContextの3条件比較、例外ハンドラの限定試験、全16セクションの前後hash、再実行一致とローカル証拠のhashを保存する。生のゲームコードやメモリダンプは含まない。

## ローカルの再現索引

以下はすべて `local-game-data/phase6.8/native-stage2/` 配下。実験ごとにAPIモデルが異なるため、ファイルを混ぜて件数・hashを比較しない。

| ファイル | 用途 |
| --- | --- |
| `trace_cpu.py`、`first/teb/clock/clock-slow/exports-trace.json` | 初期の逐次命令追跡。TEB、RDTSC、import、DLL探索の境界。各出力の条件はJSONとscriptに保存 |
| `imports.json` | 元exeのIAT位置とimport名 |
| `*.spec` | Wineの6 DLLのexport名定義。実DLL本体ではない。取得元は `https://raw.githubusercontent.com/wine-mirror/wine/master/dlls/{name}/{name}.spec`、正確な内容をhashで識別 |
| `context-probes/trace_context.py` | 16セクション比較を修正した4条件の共通トレーサー |
| `context-probes/{stop-context,zero-debug,marker-debug,failed-context}.{json,bin,log}` | GetThreadContext停止条件、および3つの反実仮想比較。3比較はクラス7のプロセス情報問い合わせで停止 |
| `firmware-boundary/trace_process.py`、`api-trace.json`、`api-dungeon.bin` | プロセス情報の限定応答を加えたSMBIOS問い合わせまでのチェックポイント |
| `replay-checks.json` | 基準実験とSMBIOS境界実験を再実行。経過時間以外のJSON全体が一致 |
| `section-checks.json` | 元PEの14セクションをraw bytesとゼロ埋めから独立照合。他2セクションは仮IATと前段の展開入力 |
| `save_report.py` | 保存済みチェックポイントからGit用のcompact JSONを生成 |
| `verify_report.py`、`report-validation.json` | 入出力hash、16セクション、条件間の差分、件数、リンク、アプリソース不変を検証 |
| `tools/`、`tools-install.log` | ローカル限定のCapstone 5.0.6 / Unicorn 2.1.4。アプリ依存には追加しない |

実行する場合は作業ルートから次を使う。CPUエミュレーションを行い、未知のAPI・設定した境界で停止する限定トレーサーであり、Windows実行環境の代替ではない。

```sh
python3 local-game-data/phase6.8/native-stage2/trace_context.py stop-context
python3 local-game-data/phase6.8/native-stage2/trace_context.py zero-debug
python3 local-game-data/phase6.8/native-stage2/trace_context.py marker-debug
python3 local-game-data/phase6.8/native-stage2/trace_context.py failed-context
python3 local-game-data/phase6.8/native-stage2/trace_process.py zero-debug
```

各コマンドはルート直下の `api-trace.json` と `api-dungeon.bin` を上書きする。比較用の `context-probes/` と `firmware-boundary/` は保存済みスナップショットとして保持する。記載のコマンドだけでGit用JSONが自動更新されるわけではない。

保存した結果だけの検証は `python3 local-game-data/phase6.8/native-stage2/verify_report.py` で行える。3つの既存game-data auditは再実行して成功し、アプリ側の1,435テスト・lint・buildは変更のない `02b073e` の成功結果を再利用した。

## 検証上の注意

初期の `trace_veh.py` とルート直下の古い `*-debug.json` は途中経過。セクション名重複による集計漏れを修正する前の出力があるため、最終報告には使わない。採用する16セクション比較は上表のスナップショットのみ。

UnicornのPythonパッケージmetadataはBSDを表示するが、coreの配布ライセンスも別途確認した。[Unicorn 2.1.4 COPYING](https://github.com/unicorn-engine/unicorn/blob/2.1.4/COPYING) はGPL-2.0、Capstone同梱LICENSEはBSD。依存ライブラリとWine定義はローカル解析用のまま保持し、サイトやGitへ同梱していない。

全結果は仮のWindows環境に依存する。再現性とWindows実機での正しさを区別する。ゲーム本体の関数・戦闘式・実効時間は未検証で、nativeの取得可能性が完全に確定した資料ではない。
