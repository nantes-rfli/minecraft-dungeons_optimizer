# Phase 3 — Public Use Readiness

一般利用に耐えるための安定性・性能・操作性の整備です。製品仕様を固定せず、UI・機能・schema・モデルを安全に変更できるようにします。一般公開はPublic Availabilityで別途扱い、本人限定Sitesのアクセス範囲を変更しません。

## Worker / 探索量

「最適化を開始」で専用Workerを作成し、既存の `optimize` を同じ検証・計算式で実行します。状態はidle / working / complete / error / cancelled。入力変更・中止・画面離脱でWorkerをterminateし、request IDと入力snapshotによってstale結果を破棄します。中止後は新しいWorkerで再実行できます。Workerが使えない環境では明示エラーを表示します。

候補数は、各個体の自由slot候補数の積（lockは1）を装備群ごとに合計し、近接×防具×遠距離×Artifactの組合せ数で上限推定します。未対応/stacking除外前なので実際の評価数より多くなることがあります。未登録の防具・遠距離は1、Artifactは最大3枠の順序なし組合せです。

- 1,000候補以上: 時間がかかる旨を表示。
- 25,000候補超: UIとcore API双方で生成前に拒否。候補を減らすかlockする必要があります。
- Worker開始から60秒: Workerを破棄しエラー。途中結果や最適解を表示しません。
- 成功時は全対応候補を探索した結果のみ表示。割合progressや途中経過の推測はありません。

この上限は安全策であり、あらゆる端末で60秒以内に完了する保証ではありません。除外前推定による保守的な拒否を許容し、精度を下げる枝刈りは導入しません。

## Performance baseline

`tests/performanceFixtures.ts` はsyntheticです。ゲームEvidence・独立測定には使いません。複数近接、防具、Bow/Crossbow、3 Artifact、Enchant候補、Gildedを含みます。

| Fixture | 近接 | 防具 | 遠距離 | 上限推定 / 評価候補 |
| --- | ---: | ---: | ---: | ---: |
| small | 2 | 1 | 1 | 32 |
| medium | 6 | 3 | 3 | 864 |
| large | 12 | 6 | 6 | 6,912 |

`npm run test:performance` は候補数・全探索modeを固定し、wall-clockを参考出力します。各fixtureの60秒は暴走防止です。`npm run test:e2e` は実Workerの時間、UI threadの10msタイマー応答回数/最大間隔を `performance.json` artifactに保存します。large中もタイマーが複数回進み、最大間隔2秒未満という緩い応答性検証を使います。厳密なミリ秒比較や端末依存memory gateは導入しません。

## E2E / Accessibility

Chromiumで近接追加、防具追加、遠距離追加と観測値の検証/適用、候補/lock、Gilded、Artifact、Scenario、最適化、結果、JSON export/import、reload復元、invalid/unsupported拒否を検証します。遠距離なし、中止→再実行、探索中編集、上限拒否、キーボード開始も含みます。Scenarioは従来通りセッション内のみでInventoryだけを永続化します。

所持装備グリッドでは、矢印キーで表示列に沿って移動し、Home / Endで先頭・末尾へ移動できます。移動に合わせて選択を更新し、Enter / Spaceで装備詳細を開けます。絞り込みで選択中の個体が隠れた場合は、最初の表示中個体を次のtab stopにします。

axe-coreのWCAG 2 A/AA・2.1 AA対象で主要入力/結果とMethodologyを自動監査します。フォーム名、JSON/観測エラーの関連付け、live status、focus-visible、本文skip link、寄与度表のcaption/header、summary内の入れ子button、低コントラスト文字を修正しました。状態は文字でも表示し、色だけに依存しません。

用途別装備評価は、各条件の全体最良構成を展開して確認できます。名前・Power・Enchant・個体IDで評価一覧を絞り込み、カテゴリ / 条件別並び替えと組み合わせて対象装備を見つけられます。数値評価できる所持個体は、選択した現在・保存条件ごとに、含めた場合と外した場合の最良構成を比較できます。この比較は選択条件の結果表示だけで、Inventoryを変更せず、未知の効果を数値化したり売却可否を判断したりしません。幅640px以下では条件ごとの値を装備個体カードへ並べ、横スクロールなしで確認できます。desktopでは比較表を使います。残る制限: 自動監査は全支援技術への対応保証ではありません。VoiceOver/NVDAの手動読上げ、タッチ端末、Firefox/WebKit、全装備・全開閉状態の網羅確認は未実施で、その他の高密度な詳細情報には継続改善の余地があります。

## Bundle / Loading

変更前buildでclient chunk >500kB警告を再現しました。MethodologyがCoverage/research詳細を静的importし、OptimizerもUIと同時に読み込まれていました。MethodologyをReact.lazy / Suspenseで遅延読み込みし、探索を独立Worker bundleへ移しました。Evidence削除・validation省略はしていません。共有runtime catalogや入力validationに必要なauditは引き続き利用します。

2026-09-05のローカルbuildでは500kB警告が解消。minify後の主なJavaScriptは以下です（gzip前、chunk名はbuildごとに変化）。

| Chunk | bytes |
| --- | ---: |
| worker | 211,411 |
| App | 71,707 |
| DpsRegressionPanel | 244,563 |
| MethodologyPage | 263,672 |

共有chunkにはruntime catalog / auditも含まれ、名前だけでは用途全体を表しません。総転送量をゼロにする改善ではなく、Methodologyと探索の読込時点を分離しました。

2026-09-05、macOS / Node 26 / Chromiumの参考測定: small 32候補はWorker 88ms / wall-clock 487ms、medium 864候補は97ms / 364ms、large 6,912候補は346ms / 459ms。largeでUIタイマー45回・最大間隔12.2ms。ローカルdev・初回module読込を含み、CIの厳密時間基準ではありません。Methodology遅延ロードは初回navigationで待ち時間が発生するため、読込状態を表示します。

## 更新と進捗

[Data / Evidence Update Workflow](data-update-workflow.md)と[Changes](changes.md)を参照。Git historyが正本です。Phase 3を従来4項目からA〜Fの6項目へ分割し、Roadmapの分母は58→60、完了は43→49（82%）。製品バージョンを廃止し、保存schema / gameVersion / 過去Evidence参照IDを維持。Phase 2-5A/B/Cのpartial、blocker、protocolとLimited表示は維持します。
