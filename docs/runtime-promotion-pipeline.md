# Runtime Promotion Pipeline

P3で固定した、parameter / mechanic単位のruntime昇格契約。正本は[machine-readable manifest](../research/runtime/runtime-promotion-manifest.json)。

## Current state

Candidate 1 · Eligible 0 · Promoted 0。現在は昇格可能な対象がないため、runtime値・support level・Optimizer候補・Gap closureは変更しない。

| Target | Kind | Adoption | Regression | Eligibility | Reasons | Sources |
| --- | --- | --- | --- | --- | --- | --- |
| defense.damage-taken-composition | mechanic | held | not-run | ineligible | adoption-held<br>regression-not-run<br>blocker:insufficient-independent-holdout:baseline<br>blocker:insufficient-independent-holdout:armor-35<br>blocker:insufficient-independent-holdout:iron-hide<br>blocker:insufficient-independent-holdout:guarding-strike<br>blocker:insufficient-independent-holdout:armor-iron<br>blocker:insufficient-independent-holdout:armor-guarding<br>blocker:insufficient-independent-holdout:iron-guarding<br>blocker:insufficient-independent-holdout:armor-iron-guarding<br>blocker:no-eligible-independent-raw-trace | [decision](../research/runtime/phase8c-limited-dr-validation.json#/adoptionDecision) · [regression](../research/runtime/runtime-promotion-regression.json#/targets/0) |

## Independent gates

Research AdoptionDecisionとProduct Regressionは独立したgateであり、acceptedになっただけではeligibleにならない。AdoptionDecisionがaccepted、対象版が一致、値が既知、Research blockerが空、独立したProduct regression sourceがpassedの場合だけeligibleになる。

## Atomic promotion contract

eligibleになった対象は同じpromotion bundleで次の5成果物をすべて宣言し、それぞれのSHA-256を固定する。

- `runtime`
- `support-manifest`
- `explanation`
- `coverage`
- `regression`

欠落、内容drift、decision参照の不一致、regression sourceとの不一致、非eligible対象のbundle、eligible対象のbundle未登録はauditで拒否する。rollbackは対象commitのrevertを基本契約とする。未検証値を0や1として登録せず、support分類やGap closeを自動推定しない。

## First promotion procedure

1. R3でparameter / mechanic単位のaccepted decisionを保存する。
2. Product側のruntime変更とregressionを準備する。
3. regressionを実行し、結果とprovenanceをmachine-readable regression sourceへ保存する。
4. eligibilityを再評価し、全gateを通った対象だけをeligibleにする。
5. eligible対象についてruntime、support manifest、利用者向け説明、coverage、regressionの5ファイルとSHA-256、support level、rollback noteを同じpromotion bundleへ登録する。
6. `npm run audit:runtime-promotion`と関連audit、test、lint、buildを通す。
7. P3Bの最初のeligible単位をreference implementationとして記録する。
## Independent Existing Limited Mechanic Reuse

This is a **separate conditional P4 path**, not a Promotion candidate or an exemption for new formulas. See [ADR 0002](./adr/0002-limited-runtime-reuse.md).

An already-Limited calculation may be reused for another source-backed equipment identity only after exact parameter/value/version, mechanic/channel/scope/inheritance, noninheritance of donor-only effects, and rejection of unverified interaction are reviewed. Explicit per-target Evidence classification, support manifest and positive/negative/preservation tests are required. An unclassified target cannot be evaluated. This path does **not** change R3 acceptance, P3B, Product regression, the five-hash promotion bundle, or Candidate/Eligible/Promoted totals. Outside the existing Limited model's boundary, use New Mechanic Promotion (A).

