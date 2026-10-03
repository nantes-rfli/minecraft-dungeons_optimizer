# Iteration record template

[AUTONOMOUS.md](../AUTONOMOUS.md) に従い、下の枠をPR本文へコピーして埋める。PR以前はセッション内の作業メモを使い、停止してPRがない場合は最終報告に残す。これは判断の記録であり、roadmapやEvidenceの正本を置き換えない。該当しない欄も理由を書く。

```markdown
## Outcome and scope

- Work Unit / Track:
- Status: SELECTING | IMPLEMENTING | VALIDATING | AWAITING_MERGE | STOPPED
- Baseline main SHA / final head SHA:
- Existing PR reconciliation / current main CI:
- Application consumer / Value unlocked / observable completion:
- Foundation + eligible population / exclusions and split rationale:

## Selection at baseline

- Inputs: canonical paths, audit commands/results, source locators, historical baseline reconciliation
- Coverage/blockers: meaning + denominator + source, without a combined percentage

| Candidate / Track | Readiness | Evidence / dependency | Consumer / benefit | Cost / semantic risk | Decision |
| --- | --- | --- | --- | --- | --- |
| ... | ... | ... | ... | ... | ... |

- Why this candidate wins / rejected alternatives:
- Relation breadth: continue or freeze, reason / reopen condition:
- Required evidence or human decision / resume condition:

## Implementation and review

- Changed source/generator/consumer/artifacts:
- Preservation baseline / stable identity / determinism:
- Independent review: source grounding; overclaim; Raw/Domain/Application boundaries;
  schema creep; duplicate truth; preservation; determinism; projection/evidence identity;
  test completeness; unrelated changes
- Findings → fix → revalidation → review result (or no findings and inspected scope):

## Validation and handoff

| Command / check | Result | Tested SHA / CI URL |
| --- | --- | --- |
| ... | ... | ... |

- CI run headSha matches final PR head / additional required checks:
- Site applicability and result:
- Unresolved items / limitations:
- Next candidate and reason, to recompute after merge:
- PR URL / human merge pending or stop/resume condition:
```
