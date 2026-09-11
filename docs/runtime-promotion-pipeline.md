# Runtime Promotion Pipeline

P3で固定した、parameter / mechanic単位のruntime昇格契約。正本は[machine-readable manifest](../research/runtime-promotion-manifest.json)。

## Current state

Candidate 1 · Eligible 0 · Promoted 0。現在は昇格可能な対象がないため、runtime値・support level・Optimizer候補・Gap closureは変更しない。

| Target | Kind | Adoption | Eligibility | Reasons | Source decision |
| --- | --- | --- | --- | --- | --- |
| defense.damage-taken-composition | mechanic | held | ineligible | adoption-held<br>regression-not-run<br>blocker:insufficient-independent-holdout:baseline<br>blocker:insufficient-independent-holdout:armor-35<br>blocker:insufficient-independent-holdout:iron-hide<br>blocker:insufficient-independent-holdout:guarding-strike<br>blocker:insufficient-independent-holdout:armor-iron<br>blocker:insufficient-independent-holdout:armor-guarding<br>blocker:insufficient-independent-holdout:iron-guarding<br>blocker:insufficient-independent-holdout:armor-iron-guarding<br>blocker:no-eligible-independent-raw-trace | [decision](../research/phase8c-limited-dr-validation.json#/adoptionDecision) |

## Atomic promotion contract

AdoptionDecisionがaccepted、対象版が一致、値が既知、blockerが空、regressionがpassedの場合だけeligibleになる。eligibleになった対象は同じpromotion bundleで次の5成果物をすべて宣言し、それぞれのSHA-256を固定する。

- `runtime`
- `support-manifest`
- `explanation`
- `coverage`
- `regression`

欠落、内容drift、decision参照の不一致、非eligible対象のbundle、eligible対象のbundle未登録はauditで拒否する。rollbackは対象commitのrevertを基本契約とする。未検証値を0や1として登録せず、support分類やGap closeを自動推定しない。

## First promotion procedure

1. R3でparameter / mechanic単位のaccepted decisionを保存する。
2. runtime実装、support manifest、利用者向け説明、coverage、regressionを同じ変更で作成する。
3. 5ファイルのpathとSHA-256、support level、rollback noteをpromotion bundleへ登録する。
4. `npm run audit:runtime-promotion`と関連audit、test、lint、buildを通す。
5. P3Bの最初のeligible単位をreference implementationとして記録する。
