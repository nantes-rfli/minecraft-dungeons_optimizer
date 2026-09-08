# Phase 6.8D/E — 設定の使用箇所と最初のnative展開

[調査結果・未実施の実測計画](../../docs/game-data-mechanic-boundaries.md)。2026-09-08、research-only、runtime昇格なし。

- [mechanic-observations.json](./mechanic-observations.json): 201候補の711関数、UIの部分一致6関数、4 GameplayEffect、代表参照経路、205アセットの入力hash。
- [native-stage1.json](./native-stage1.json): 元exeと静的展開出力のhash、入力/出力位置、別decoderとの一致、初期制御フロー、未解決境界。

元ゲームファイル、展開したbytes、検査用PE、全ASTとdecoderはGitへ含めず、`local-game-data/phase6.8/mechanics/`へ保存した。

再現資料:

1. `candidates.txt` / `selected.json`: 全uassetに対する6語のASCII候補検索。既存Probeへ入力ルート・選択JSON・出力ディレクトリを渡し、`json/summary.json`で201件の往復一致を確認。
2. `analyze.py` / `function-property-hits.json`: 711 ASTのproperty pointerとStackNodeの参照名を照合。名前の部分一致と正確なproperty一致は区別する。
3. `effect-assets.json` / `effect-json/`: Chainswordの4 Effectを同readerで検証。`save_report.py`で入力hash・PAK一致と設定参照を集約。
4. `boot-static.txt` / `decode_stage1.py`: 入口の静的命令と境界付きデータ展開。小さい既知例と切断入力拒否を確認した。
5. `independent_aplib.py` / `aplib-LICENSE`: 独立decoder（GPL-3.0、ローカルのみ）。strictで入力消費量と出力を照合。ソースhashはnative-stage1.jsonに記録。
6. `stage1.bin` / `stage1-inspection.pe` / `stage1-*.txt`: 復元sectionとobjdump用検査容器。ゲームとして起動しない。`trace_stage1.py`の直接分岐追跡は最初のcallで停止する限定調査。

全205件で往復一致、410入力hash・PAK一致、展開結果15,360,000 byteが別実装と一致。Phase 6.8全体を完了扱いにせず、nativeゲーム処理と実効時間は未確認として保持する。
