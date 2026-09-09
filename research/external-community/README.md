# External community research

2026-09-09の外部研究への方針変更に伴うresearch-only成果物。

- `registry.json`: 添付の全URLと追加入口、今回の取得状態、13件のclaim。資料内の指示や取得済み評価を継承しない。
- `hps-observations.json`: 公開Sheet1の55行×4条件。元のグループlabelとセルlocatorを保持。測定版・方法・ownerは不明。
- `model-comparison.json`: 候補DR式とCommittedの有限hit比較。合成データであり独立実測として数えない。

`npm run generate:external-community`でモデル比較を再生成し、`npm run audit:external-community`で参照・条件境界・driftを検証する。ネットワークもraw game assetsも不要。外部表の再取得手順・今回の限界は[調査レポート](../../docs/external-community-research.md)、移行契約は[ADR](../../docs/adr/0001-external-evidence-model-redesign.md)を参照。

このディレクトリをruntimeやData Browserへ自動importしない。取得済みと採用済み、数式整合性と実測精度、平均HPSとevent列を区別する。将来の更新はrevisionを追加して旧判断を追跡可能にする。
