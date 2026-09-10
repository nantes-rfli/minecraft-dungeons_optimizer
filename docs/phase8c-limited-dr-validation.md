# Phase 8C — Limited DR Independent Validation

検証日: 2026-09-10。対象は35% Armor + Iron Hide + Guarding Strikeのdirect mob attack。検証前に許容範囲を固定し、旧モデル（単純乗算）と研究モデル（Armor/Iron Hideのinverse-score + Guarding Strike別乗算）を同条件で比較した。

## 事前固定したgate

- ゲーム版1.17.0.0、同一incoming hit、baseline・単独3種・pair 3種・三効果の全8条件
- 各条件3独立run以上、各run 10 hit以上。run IDは別々に実施した反復測定を表し、同じ測定者の別runもそれぞれ数える
- origin groupはEvidenceの由来・測定者/取得元を表す。runの一意性には使わず、calibration originとholdout originの分離には引き続き使う
- 重複run IDは拒否し、同一runの複製と同じraw traceの再利用は独立runへ数えない
- mean absolute damage-taken fraction error <= 0.005、各hitのraw damage error <= 1
- calibration originと同じrow、合成probe、単発自己観測はVerifiedに数えない

## 旧新比較と順位感度

既存の2021年row（baseline 396,591、三効果78,116）は研究モデルのdamage-taken fraction 0.196970 とほぼ一致し、旧単純乗算 0.1625 より残差が小さい。ただし、このrowは式を導いたsourceと同じorigin、版不明、1観測のみなので独立holdoutから除外した。damage-taken 0.18の比較候補に対して、研究モデルと旧モデルで順位が反転するため、未検証の切替はOptimizer順位を変え得る。

## AdoptionDecision

判定は **保留（hold）**。eligible independent holdoutは0 run / 0 hitで、全8条件が不足している。再現性は測定不能。runtime昇格0、新規Gap close 0を維持する。これは8Cの検証手続きを完了して保留を保存した結果であり、Limited DRモデルをVerifiedまたは不採用としたものではない。次回は上記gateを変えずにraw traceを追加し、同じauditを再実行する。
