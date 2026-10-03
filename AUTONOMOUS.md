# Autonomous development contract

## Scope and authorities

この契約は、ユーザーが自律ループを依頼したセッションに適用する。1 iterationは1 Work Unitを検証済みPRにするまで。マージは人間が行い、auto-mergeは有効化しない。通常作業の規則は [AGENTS.md](AGENTS.md) に従い、このモードだけ提出先をPRまでに制限する。契約を読むこと自体はループ開始や常駐実行の指示ではない。

| 正本 | 責務 |
| --- | --- |
| [AGENTS.md](AGENTS.md) | 全作業のGit・検証・Site運用 |
| [ROADMAP.md](ROADMAP.md) / [src/data/roadmap.ts](src/data/roadmap.ts) | project goal / Track・status・dependency・completion・next action |
| 本文書 | 自律選定・作業境界・停止・反復手順と初期mission |
| [Data workflow](docs/data-update-workflow.md) / [research layout](research/README.md) | Source・Canonical・Evidence・Promotionの所有権と更新順 |
| [CI](.github/workflows/ci.yml) / [package.json](package.json) | 実行する検証とコマンドの定義 |

進捗やcoverageの新しい正本を作らない。各iterationの判断・検証記録は [record template](docs/autonomous-iteration-template.md) からPR本文に作る。これはbaseline SHA時点の記録であり、live backlogでもEvidenceでもない。永続的なWork Unit状態を変える場合はroadmapの正本を更新し、既存generatorで反映する。

## North Star and initial mission

Applicationが信頼して利用できるGame Domainをsource-backed / fail-closedで拡張する。Raw / Formal完全網羅を目標にしない。Formal Identity / Value / Relationはそのための内部契約である。

初期missionは、Game Domain breadthをApplicationに必要な境界まで効率よく進めること。reusable foundationと安全なbatch populationを優先し、具体的なValue・説明・比較・推薦改善への経路がないFormal作業は後順位にする。Research全体の完了をProduct改善の開始条件にしない。ただしroadmapのparameter単位の依存とPromotion gateは維持する。

毎iterationでRelation breadthの継続／freezeを判断する。残るRelation候補が単独family専用で、具体的なconsumerやValue解禁への効果を説明できない場合、その候補群をfreezeし、既知のValueやApplication payoffを比較対象へ移す。freezeはunknownの解決でも全体完了でもない。新Evidence・consumer・再利用可能foundationが現れたら再評価する。domain名・件数・PR番号をmissionへ固定しない。

## Architecture invariants

`Raw Game Sources → Game Domain / Canonical → Application / Optimizer` を維持する。Domainからruntimeへは [separation](docs/catalog-evidence-runtime-separation.md) と [Runtime Promotion](docs/runtime-promotion-pipeline.md) の採用gateを通す。既存契約を短く参照すると:

- [Separation](docs/catalog-evidence-runtime-separation.md): Unsupportedを「0点や中立倍率にも変換しません」。Unknown / Unclassifiedを数値評価へ渡さない。
- [Identity](docs/formal-identity-evidence-v1.md): identityとそのevidence境界だけを扱う。identity evidenceはgameplay semantic evidenceではない。
- [Value](docs/formal-value-availability-v2.md): configured serialized valueはeffective behaviorではない。unknown / unsupported / parse-failed / not-extractedを保持する。実際にdecodedされた `0` / `false` / `[]` はknownであり、欠損の代替値とは区別する。
- [Relation](docs/formal-serialized-relation-v2.md): serialized target known、Structural解決、full Raw検証、gameplay semantic knownは別々。relation existenceはruntime effectを証明しない。
- [Model alignment](docs/game-data-model-alignment.md): source identity・configured値・effective semanticsを混ぜない。過去のPhaseや件数は現在の優先順位として使わない。

判定条件・schema・provenance形式はリンク先を正本とし、ここで緩和・再定義しない。

## Outer loop: recompute → select

1. `git status --short --branch`、`git fetch origin`、`git rev-parse origin/main`で作業状態とbaseline SHAを確認する。fetch失敗時は古いmainをcurrentと呼ばない。他者の未commit変更をreset/stashせず、必要なら分離する。open PRのhead・対象・担当を確認し、同じmissionの未完了PRがあれば新規着手よりその状況確認を優先する。無関係なPRは閉じない。新規iterationは、そのbaselineから`codex/` branchを作ったclean checkoutで以下を読む・実行する。fetchしただけで古い作業branchを監査しない。既存PRの修正時はそのheadを使い、mainとの差を記録する。
2. 上記正本、対象familyの契約・generator・audit・preservation tests、最近のPRを読む。過去の監査はbaselineと入力を確認する。固定SHAを読むcensusを再実行してもcurrentの再計算にはならない。古い監査を改変せず、current artifactとの差分を照合する。
3. 選定に関係する既存read-only auditを実行し、committed artifactからcoverage・blocker・未処理populationを再計算する。Game Domain missionではFormal Identity / Value / Relation / integrationとPromotion eligibilityを比較する。countsには意味と分母とsource pathを添える。文書とartifactの差は記録し、推測で件数を埋めない。
4. foundation単位の候補を列挙する。候補ごとにTrack、source locator、consumer／解禁するValue、対象母集団と除外理由、依存、完了条件、cost、semantic risk、下表のreadinessを記録する。Formalだけでなく利用可能なEvidence内のProduct改善も比較する。
5. READY候補をbenefit対cost対riskで比較する。理由を残し、最上位を1つ選ぶ。候補がない場合もその根拠を残す。作業前に対象・除外・関連検証・preservation baselineを固定する。

| Readiness | 判定と扱い |
| --- | --- |
| `READY_EXISTING_FOUNDATION` | 必要なEvidenceと依存を満たし、既存schema/adapterで完了できる |
| `READY_SMALL_FOUNDATION` | Evidenceは存在し、限定adapter / typed kind等の追加で完了できる。変更面と全eligible populationを列挙できる |
| `NEEDS_EVIDENCE` | source、unit、version、independence等が足りない。実装候補から除外し、必要Evidenceと再開条件を記録 |
| `SEMANTIC_AMBIGUITY` | source-backedな解釈を一意化できない。semantic実装を停止 |
| `APPLICATION_NOT_USEFUL` | 具体的consumer・Value・説明・optimizer品質への経路を示せない。形式上追加可能でも選ばない |

readinessとROIは別。readinessは上から判定し、Evidence不足・曖昧さをREADYとしない。Evidenceが十分でも用途がなければ `APPLICATION_NOT_USEFUL` とする。単なるadapter欠如とEvidence欠如を区別する。

ROADMAPの依存条件と計画上の優先順位は、次のように扱う:

- `dependsOn` / `dependencyCondition` は着手可否の必須条件（hard eligibility gate）。対象parameter / mechanic単位の条件がある場合はその単位で充足を確認し、依存先Track全体のDoneを要求しない。未充足の条件を高ROIや`current / next`というstatusで迂回しない。
- `status`は計画上の優先順位を示す。`current / next`を先に比較するが、`later`自体は実装禁止ではない。`blocked`はblockerの解消を確認するまで選ばず、`done`の完了済みscopeを再実装しない。
- `current / next`より`later`を選ぶ場合は、Application payoff・依存解消への効果（該当しなければその旨）と、比較したCurrent/Next候補がblockedまたは相対的に低ROIである理由をiteration recordへ明示する。statusを無視してROIだけで選ばない。
- 選択が継続的な主作業への昇格など恒久的なproject status変更を意味する場合は、同じiterationで`src/data/roadmap.ts`を更新し、既存generatorでROADMAPへ反映する。単発のbounded contributionならstatus変更は必須ではないが、変更しない理由を記録する。

優先するのは、既存foundationで複数domainを処理できる作業、小さなfoundationで複数domainを解禁する作業、Value / Application / explanation / optimizer qualityを直接改善する作業。Identity breadthはそれらの依存を解消する場合に上げる。単独domain専用Relationや利用予定のない構造は低順位。同程度ならsemantic risk、変更範囲、依存解消効果の順で比較し、なお同等なら候補IDの辞書順で選ぶ。固定スコアやFormal件数の最大化は採用しない。

default Work Unitは **1 reusable foundation + そのfoundationで安全に処理可能な全population**。全populationとはEvidence・semantic family・preservation境界が共通のeligible集合であり、Raw全件ではない。1件1PRへ分割する場合は、独立semantic family、高いpreservation risk、schema migration、review boundaryのいずれかを具体的に説明する。共通adapterで異なるfamilyを処理しても、各typed guardをgeneric taxonomyへ潰さない。調査中に集合を修正したら根拠と除外を記録する。

## Continue, defer, stop

上の境界内では、current-state audit、deterministic census、existing schema reuse、小さなsource adapter、狭いschema/kind/typed semantic extension、batch population、tests・fixtures・expected counts・生成物・docs更新、focused validation、CI Validate、self-review、自己変更のfix-up、commit/push、PR作成・更新、次候補選定を追加確認なしで行う。生成物は正本から更新する。新reject条件にはnegative testを追加し、preservation fixtureを失敗隠しのために書き換えない。

次は対象候補を保留し、安全な別候補があれば選定を続ける。選択中のWork Unitで起きた場合は、そのsemantic実装を進めず再選定またはescalationを記録する:

- source evidenceが存在しない、またはsource-backedに解釈を一意化できない。
- configured値からruntime / effective semanticsを推測しなければ進めない。

次はiterationを止め、必要な判断と最小の再開条件を人間へ示す。自分で契約を緩めて通過しない:

- 3-layer architecture、fail-closed guarantee、Evidence acceptance standardを変える必要がある。
- unknownをruntime値・neutralとして扱う、optimizer objective semanticsを変える、broad generic taxonomyを導入する必要がある。
- destructive migration、scope外への大規模波及、データや既存作業を失う操作が必要。
- 今回変更外のvalidation failureが、安全な局所修正では解消できない。
- 選べる候補がEvidence待ち・曖昧・低ROIだけになった。低ROIとはconsumer/依存解消を示せない、またはそのbenefitに対し専用実装・semantic riskが見合わない場合。比較根拠を記録する。
- CI・権限・必須source・履歴baselineが利用できず、検証の完了を確認できない。

小さなadapter、deterministic audit、狭いkind追加、複数domain、自己変更によるtest failure、docs/count/fixtureの正当な更新は停止理由ではない。反復が進展しない場合は、同一原因へのfix-upを3回までとして診断と未解決点を引き継ぐ。新Evidenceもcode差分も得られない再監査を繰り返さない。ユーザー指定の時間・予算・中断があれば従う。

## Inner loop and independent self-review

`research → design → implementation → focused tests / audits → self-review → fix → revalidate → commit / push → full CI Validate → PR handoff`

調査・実装・レビューだけを返して終了しない。通常の局所判断は自律的に完了する。ただし明示された調査専用scopeや停止条件は守る。

実装passを終えてから、baselineとのdiffを最初から読む別のself-review passを必ず行う。別エージェントは必須ではない。次をsource・code・testsで確認し、問題ごとにseverity、箇所、修正、再検証結果を記録する:

- source grounding、semantic overclaim、Raw → Domain境界、Domain → Applicationへの未採用値の漏れ。
- schema creep、重複するsource of truth、無関係な変更。
- 既存recordとorderingのpreservation、生成のdeterminism、ProjectionRef / EvidenceRef / sourceIndexの安定性。
- positive / negative / dependency failure tests、consumer側の制限表示、変更範囲に対するtest completeness。

`review → fix → relevant revalidation → review`を問題解消まで回す。未解決の重大問題や必須検証未実行を「完了」としない。最終差分を変えたらその変更をレビューし直す。

## Validation gate

[Data workflow](docs/data-update-workflow.md) の局所検証と、[Validate](.github/workflows/ci.yml) の全体検証を分担する。下表は選び方であり、CIのコマンド一覧を複製しない。すべての変更で `git diff --check` を実行する。

| 変更 | ローカルgate |
| --- | --- |
| Markdownのみ | links/path/command実在、正本との整合、scope diff。roadmap等の生成blockに関係するときは対応audit |
| Formal / source adapter / population | 関連unit・negative・preservation test、family audit、integration、生成drift。generator変更時は2回生成しbyte一致を確認 |
| Evidence / Promotion / runtime | 既存採用gate、対象audit、関連regression。Promotionは既存atomic bundle契約を適用 |
| TypeScript / schema / migration | 関連testとtype/lint、互換性・round-trip・旧形式復旧。履歴baselineを読めるcheckoutを使用 |
| UI / 配信成果物 | 関連test/build、必要なbrowser/E2E。Site反映の条件・公開範囲はAGENTSを参照 |

PRの最終headではfull Validate成功を必須とする。現行CIは `push: main` と `workflow_dispatch` で動き、PR作成だけでは動かない。commitをbranchへpush後、以下の手順で検証する（placeholderは実際の値へ置換）:

```sh
gh workflow run ci.yml --ref <branch>
gh run list --workflow ci.yml --branch <branch> --event workflow_dispatch --json databaseId,headSha,status,conclusion,url
gh run view <run-id> --json headSha,status,conclusion,url,jobs
```

実行IDのheadShaが `git rev-parse HEAD` と一致することと、全必須jobのsuccessを確認する。現行CIは手動起動ではMarkdownだけでもChromium/E2Eを実行する。main push時のMarkdown-only skipを手動起動へ流用しない。[Raw inventory CI](.github/workflows/raw-structural-inventory.yml) など対象pathで要求される追加checkも確認する。CIが変わったらcurrent workflowを読む。

ローカルで全CIを理由なく重複実行しない。head変更後の古いsuccessは再利用しない。CI failureはログから原因を特定し、自分の変更を修正して必要な局所検証と最終headのCIを再実行する。CIを弱める、skipする、無関係なvalidation用PRを作ることで迂回しない。

## PR handoff and resumption

1. self-reviewと局所検証後、branchをpushしmain向けPRを1つ作る。CI待ちならDraftまたは検証待ちを明示する。最終CI成功後にreview可能にする。
2. PR本文にiteration recordを残す。baseline/final head SHA、selectionとbatch範囲、source/preservation、review/fix-up、検証コマンドと結果、CI URL/headSha、未解決点、次候補と再評価条件を含める。Site対象なら既存本人限定projectへの反映結果も記録する。
3. `AWAITING_MERGE` で人間へ引き継ぐ。AIはマージしない。未マージの同一missionから次PRを量産しない。次候補の調査メモは可能だが、別Work Unitの実装は始めない。
4. 次回起動でPRの状態を確認する。openなら検証済みheadを報告して待ち、ユーザーから修正依頼があればそのPRを更新する。closed-unmergedなら理由を確認して再選定し、同じPRを自動再作成しない。mergedならfetchしたmainへ統合済みであることを確認してouter loopへ戻る。古いnext候補を無条件で実行しない。

再開時にはmainのCI失敗や競合変更も確認する。新しいmainにより選択根拠やpreservationが変わった場合は再設計・再検証する。停止時は `STOPPED` と原因・必要判断・再開条件、検証待ちは `VALIDATING` とrun/head、マージ待ちは `AWAITING_MERGE` とPR/headを記録する。常駐schedulerや自動mergeはこの契約の導入には含めない。
