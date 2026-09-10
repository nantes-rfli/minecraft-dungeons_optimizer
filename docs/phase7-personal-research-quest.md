# Phase 7 — Personal Research Quest

実施日: 2026-09-10。Phase 8Bで再評価した残余から、最初の限定DR単位だけをactual Inventoryと既存の`damage-reduction-composition` protocolへ接続した。

## 7A — 所有装備に結びつく最小queue

35% Armor、Iron Hide Amulet、Guarding Strikeを実際に登録している場合だけExperimentを実施可能にする。未所持装備は不足理由として表示するが、本人の必須taskや進捗分母へ加えない。対象は5 Gapで、外部取得済み課題やPhase 8B外の2,083 Gapは追加していない。

## 7B — 任意の限定実測

Observe / Measure / Experimentを選択でき、現在の残余taskはExperimentだけ。スキップ・中断・再開、条件別進捗、raw trace URLとSHA-256、版・platform・difficulty・incoming hit・activation frame・10 hit以上のdamage列を保存する。全8条件 × 3独立run × 10 hitの固定gateは変更しない。

保存済みrunはPhase 8AのEvidence RepositoryとPhase 8Cの`LimitedDrRun`へ同時変換し、同じ画面で固定済みvalidatorを再実行できる。個人観測はブラウザlocalStorageにだけ保存し、Gitへ含めない。

## Boundary

runtime昇格0、新規Gap close 0、8CのAdoptionDecisionはholdのまま。queue消化率をモデル精度とは扱わない。
