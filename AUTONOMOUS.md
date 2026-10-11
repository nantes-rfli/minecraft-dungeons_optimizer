# Autonomous development contract

## Scope and authorities

この契約は、ユーザーが自律ループを依頼したセッションに適用する。1 iterationは1 Work Unitを1検証済みPRにし、merge確認までを扱う。implementerはPR提出までを担当し、マージは人間または下記gateを満たすtrusted independent automated reviewerが行う。通常作業の規則は [AGENTS.md](AGENTS.md) に従う。契約を読むこと自体はループ開始や常駐実行の指示ではない。

| 正本 | 責務 |
| --- | --- |
| [AGENTS.md](AGENTS.md) | 全作業のGit・検証・Site運用 |
| [ROADMAP.md](ROADMAP.md) / [src/data/roadmap.ts](src/data/roadmap.ts) | project goal / Track・status・dependency・completion・next action |
| 本文書 | 自律選定・作業境界・停止・反復手順と初期mission |
| [Data workflow](docs/data-update-workflow.md) / [research layout](research/README.md) | Source・Canonical・Evidence・Promotionの所有権と更新順 |
| [CI](.github/workflows/ci.yml) / [package.json](package.json) | 実行する検証とコマンドの定義 |

進捗やcoverageの新しい正本を作らない。[PROJECT_STATUS.md](PROJECT_STATUS.md) はmerged mainのcanonical stateから生成する人間向けoverviewであり、正本ではない。作業途中の状態やlive GitHub stateを混ぜず、driftは `npm run audit:project-status` で検出する。各iterationの判断・検証記録は [record template](docs/autonomous-iteration-template.md) からPR本文に作る。これはbaseline SHA時点の記録であり、live backlogでもEvidenceでもない。永続的なWork Unit状態を変える場合はroadmapの正本を更新し、既存generatorで反映する。

## North Star and initial mission

Applicationが信頼して利用できるGame Domainをsource-backed / fail-closedで拡張する。Raw / Formal完全網羅を目標にしない。Formal Identity / Value / Relationはそのための内部契約である。

最終ゴールは、3層そのものを完成させることではなく、利用者の装備比較・説明・推薦を実用的に改善できるOptimizerを完成させること。3層はそのためのarchitectureであり、Raw件数、Formal件数、Evidence tooling件数、runtime promotion件数のいずれも単独では最適化対象にしない。

各iterationは **completion frontier** を再計算する。completion frontierとは、(1) Applicationが現在できること、(2) 次に実用価値を増やす最小のuser-facing capability、(3) そのcapabilityを止めている最小のbottleneck（Raw / Domain / Evidence / Runtime / Optimizer / UXのどこか）である。Work Unitは原則としてこのbottleneckを解消するものを選ぶ。候補比較では、**既存coverage内の品質向上** と、**追加の実装可能な装備・mechanicをDomain / Evidence / RuntimeからOptimizerへ到達させるcoverage expansionまたは最寄りのcross-layer blocker解消** を必ず同じ表で比較する。coverageを常に優先するのではなく、安全なcoverage-unlock候補が存在しない場合は既存coverage内のP5 / P6改善を選んでよい。逆に、反復可能なmicro-improvementがuser-facingであることだけでは、coverage reachを広げる候補よりtool completionへの前進が大きいとは扱わない。補助toolingやfoundationは、それ自体が便利だからではなく、名前を挙げたcapabilityの解禁・品質向上・blocker除去へ因果的につながる場合に優先する。

初期missionは、Game Domain breadthをApplicationに必要な境界まで効率よく進めつつ、既に利用可能なruntime範囲ではOptimizer / recommendation qualityも並行して前進させること。reusable foundationと安全なbatch populationを優先するが、具体的なValue・説明・比較・推薦改善への経路がないFormal作業や、隣接する補助toolingだけを連鎖的に増やす作業は後順位にする。Research全体の完了をProduct改善の開始条件にしない。ただしroadmapのparameter単位の依存とPromotion gateは維持する。

固定ローテーション、層ごとのquota、一定回数ごとの強制切替は設けない。同じ層・同じTrack・同じ補助作業が続くことは停止条件ではなく **stagnation signal** とする。signalが出たiterationでは、継続候補と少なくとも1つのApplication / Optimizer候補、1つのcross-layer blocker候補を比較し、それでも継続がcompletion frontier上の最短経路なら続けてよい。逆に、単に「前回の続き」「currentだから」「安全に追加できるから」は継続理由にしない。

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

1. `git status --short --branch`、`git fetch origin`、`git rev-parse origin/main`で作業状態とbaseline SHAを確認する。fetch失敗時は古いmainをcurrentと呼ばない。他者の未commit変更をreset/stashせず、必要なら分離する。open PRのhead・対象・担当を確認し、open autonomous PRがあれば [PR handoff and resumption](#pr-handoff-and-resumption) の状態別処理へ進み、次のWork Unitを開始しない。無関係なPRは閉じない。新規iterationは、そのbaselineから`codex/` branchを作ったclean checkoutで以下を読む・実行する。fetchしただけで古い作業branchを監査しない。既存PRの修正時はそのheadを使い、mainとの差を記録する。
2. 上記正本、対象familyの契約・generator・audit・preservation tests、最近のPRを読む。過去の監査はbaselineと入力を確認する。固定SHAを読むcensusを再実行してもcurrentの再計算にはならない。古い監査を改変せず、current artifactとの差分を照合する。
3. merged mainのApplication / Optimizerを利用者視点で確認し、completion frontierを1つ定義する。「今できること」「次に増やす実用capability」「そのcapabilityを止める最小bottleneck」を記録する。promotion eligibleが0件でも、既存runtime範囲の推薦品質・比較・説明・入力体験などProduct側で前進できる候補を必ず再探索する。逆にProduct案を作るために未確認semanticsを捏造しない。
4. 選定に関係する既存read-only auditを実行し、committed artifactからcoverage・blocker・未処理populationを再計算する。auditはcompletion frontierのbottleneckを検証するために使い、auditで見つけた作業を自動的に次の仕事へ昇格させない。Game Domain missionではFormal Identity / Value / Relation / integrationとPromotion eligibilityを比較する。countsには意味と分母とsource pathを添える。文書とartifactの差は記録し、推測で件数を埋めない。
5. foundation単位の候補を列挙する。候補ごとにTrack、source locator、consumer／解禁するValue、completion frontierとの因果関係、対象母集団と除外理由、依存、完了条件、cost、semantic risk、下表のreadinessを記録する。候補表には最低限、(a) 既存coverage内で完結するApplication / Optimizer品質改善と、(b) coverage reachを増やすDomain / Evidence / Runtime候補またはその最寄りcross-layer blockerを含める。Formalだけでなく利用可能なEvidence内のProduct改善、既存runtime範囲で完結するOptimizer改善、必要なEvidence acquisitionを同じ候補表で比較する。
6. READY候補を **tool completionへの前進量**、benefit、cost、riskで比較する。理由を残し、最上位を1つ選ぶ。補助tooling候補は、名前を挙げたcapabilityのblockerを実際に閉じる場合を除き、隣接する補助toolingの利便性だけでは上位にしない。候補がない場合もその根拠を残す。作業前に対象・除外・関連検証・preservation baselineを固定する。

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
- `status`は計画上の方向と継続性を示すが、既存作業へのincumbency bonusにはしない。`current / next`は有力候補だが、completion frontier上で別のeligible Product / Domain候補の方がtool completionへ大きく前進するならそちらを選べる。`later`自体は実装禁止ではない。`blocked`はblockerの解消を確認するまで選ばず、`done`の完了済みscopeを再実装しない。
- `current / next`以外を選ぶ場合は、Application payoff・依存解消への効果（該当しなければその旨）と、比較したCurrent/Next候補よりcompletion frontier上で優位な理由をiteration recordへ明示する。逆にCurrentを継続する場合も、直近のWork Unitと同じTrack / layer / support familyが続くなら、他TrackのREADY候補を比較したうえで継続理由を残す。statusだけでもROIだけでも選ばない。
- 選択が継続的な主作業への昇格など恒久的なproject status変更を意味する場合は、同じiterationで`src/data/roadmap.ts`を更新し、既存generatorでROADMAPへ反映する。単発のbounded contributionならstatus変更は必須ではないが、変更しない理由を記録する。

優先するのは、既存foundationで複数domainを処理できる作業、小さなfoundationで複数domainを解禁する作業、Value / Application / explanation / optimizer qualityを直接改善する作業。Identity breadthはそれらの依存を解消する場合に上げる。単独domain専用Relationや利用予定のない構造は低順位。同程度ならsemantic risk、変更範囲、依存解消効果の順で比較し、なお同等なら候補IDの辞書順で選ぶ。固定スコアやFormal件数の最大化は採用しない。

default Work Unitは **1 reusable foundation + そのfoundationで安全に処理可能な全population**。全populationとはEvidence・semantic family・preservation境界が共通のeligible集合であり、Raw全件ではない。1件1PRへ分割する場合は、独立semantic family、高いpreservation risk、schema migration、review boundaryのいずれかを具体的に説明する。共通adapterで異なるfamilyを処理しても、各typed guardをgeneric taxonomyへ潰さない。調査中に集合を修正したら根拠と除外を記録する。

同一Track・同一boundaryのmaintenance defectを選ぶ場合、その時点で隣接する同種invariantも横断確認する。同じacceptance boundary・foundation・同程度のsemantic riskで安全に修正できるものは **1 reusable foundation + all safely eligible adjacent fixes** として1 Work Unitへまとめ、対象と除外理由を記録する。PRサイズや変更ファイル数を目的にしない。

直近の複数Work Unitがmaintenanceだった場合だけでなく、Evidence handoff / audit / validator / acquisition-supportなど **user-facing capabilityを直接増やさないWork Unitが続いた場合** もstagnation signalとして扱う。次のselectionではApplication capability、Optimizer / recommendation quality、reusable breadth foundation、cross-layer handoff、current blocker解消、Evidence acquisition / adoptionを明示的に再探索し、readinessとtool completionへの寄与を比較する。同種のsupport workをさらに選ぶのは、現実的なcorrectness riskまたは具体的なcompletion frontier blockerを閉じ、他のREADY候補よりproject payoffが高い場合に限る。「安全に実装できる」「handoffが少し便利になる」「fail-closed defectを見つけた」だけを連続選定の十分な理由にしない。ただし固定回数での強制切替は行わず、同じcritical pathを進む合理性が残る場合は継続できる。

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

## Inner loop and self-review

`research → design → implementation → focused tests / audits → self-review → fix → revalidate → commit / push → full CI Validate → PR handoff`

調査・実装・レビューだけを返して終了しない。通常の局所判断は自律的に完了する。ただし明示された調査専用scopeや停止条件は守る。

実装passを終えてから、baselineとのdiffを最初から読む別のself-review passを必ず行う。self-reviewには別エージェントは必須ではないが、下記の独立merge reviewの代替にはならない。次をsource・code・testsで確認し、問題ごとにseverity、箇所、修正、再検証結果を記録する:

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
| UI / 配信成果物 | 関連test/build、必要なbrowser/E2E。Siteへの反映可否はAGENTSに従いmerge後に判定し、merge gateに含めない |

PRの最終headではfull Validate成功を必須とする。現行CIは `push: main` と `workflow_dispatch` で動き、PR作成だけでは動かない。commitをbranchへpush後、以下の手順で検証する（placeholderは実際の値へ置換）:

```sh
gh workflow run ci.yml --ref <branch>
gh run list --workflow ci.yml --branch <branch> --event workflow_dispatch --json databaseId,headSha,status,conclusion,url
gh run view <run-id> --json headSha,status,conclusion,url,jobs
```

実行IDのheadShaが `git rev-parse HEAD` と一致することと、全必須jobのsuccessを確認する。Full Validateは独立した `validate`（全audit・全Vitest・生成drift・typecheck・lint）と `browser`（build・Chromium E2E）の両jobで成立する。片方のsuccessだけを全体successとして扱わない。現行CIは手動起動ではMarkdownだけでもChromium/E2Eを実行する。main push時のMarkdown-only skipを手動起動へ流用しない。[Raw inventory CI](.github/workflows/raw-structural-inventory.yml) など対象pathで要求される追加checkも確認する。CIが変わったらcurrent workflowを読む。

ローカルで全CIを理由なく重複実行しない。head変更後の古いsuccessは再利用しない。CI failureはログから原因を特定し、自分の変更を修正して必要な局所検証と最終headのCIを再実行する。CIを弱める、skipする、無関係なvalidation用PRを作ることで迂回しない。

## Trusted automated merge gate

trusted reviewerは、人間が指定または承認した独立automated reviewerであり、implementerとは別のreview主体である。implementer自身のself-review、名義だけを変えた承認、CI successだけではmerge不可。reviewerは最終diff・source・検証証跡を独立に確認し、review主体、対象head SHA、findingsと解決根拠をPRのiteration recordまたはそこからリンクしたreviewへ記録する。この契約だけでbot・scheduler・権限を新設せず、契約変更PR自身を根拠に自分へmerge権限を付与しない。

reviewerはmerge直前にlive GitHub stateとcurrent mainを再取得し、以下を**すべて**確認する。取得失敗や不明な状態をsuccess / 0と扱わない。

| 必須条件 | 確認証跡 |
| --- | --- |
| current main向けautonomous iterationのPR | open / review可能なPRのbaseが当該repositoryのmainであり、1 Work Unitのscope・current mainからの再評価記録がある |
| Human Progress Summaryとiteration recordが存在する | PR本文のsummaryとbaseline / final head・選定・scope・review・検証記録 |
| stop condition非該当 | 上記stop条件とユーザーの停止・予算・merge制限を再確認する |
| architecture / acceptance standard / fail-closedの無断変更がない | architecture invariantsとsource-backed境界を最終diffで照合し、方針変更は明示された人間の承認を確認する |
| unresolved significant review finding = 0 | 独立reviewとself-reviewの重大findingの修正・再review根拠。確認不能は未解決とする |
| unresolved REQUEST_CHANGES / required review thread = 0 | GitHubの有効な変更要求・必須review thread・required approvalを確認する。thread解決だけで有効なREQUEST_CHANGESを解消済みとしない |
| final PR headそのもののFull Validateがsuccess | 上記Validation gateのfull Validate runと全必須job / 追加required checkのsuccess。skip・pending・cancelled・failureは不可 |
| CI head SHA = current PR head SHA | CI runのheadShaとlive PR head SHAの完全一致 |
| PRがmergeable | GitHubのmergeabilityを確認する。branch protection / rulesetが設定されている場合はその必須条件も満たす。利用不可・未設定であること自体は失敗とせず、状態を確認できない場合やmergeabilityがUNKNOWN / 判定中の場合は不可 |
| current mainに対してbehind 0 | 取得したmain SHAがPR headのancestorであり、base側の未取り込みcommit数が0。base差分で選定・preservationが変われば再評価する |
| merge時のexpected head SHA固定 | 確認したfinal head SHAをmerge APIのexpected SHAまたは `gh pr merge <PR> --merge --match-head-commit <SHA>` に渡す |

Site反映はPRのmerge可否に関係しない。Site未反映・デプロイ手段未接続・反映失敗・反映証跡なしを理由にmergeを停止しない。Siteに影響する変更は、merge後、実行環境に更新手段・権限があり既存本人限定Siteの公開範囲を維持できる場合に原則反映する。反映できない場合はスキップまたは失敗の理由を報告する。Site無関係の変更は反映不要。CIのbuild/E2EとSiteへの実デプロイは区別する。
一つでも必須条件が確認不能・不成立ならmergeせず `AWAITING_MERGE` / `STOPPED`で必要判断を示すか、そのPRのfix-upへ戻す。rate limit / interruption / CI failure時もmergeしない。head変更時は独立reviewと最終headのFull Validateをやり直し、main変更時もbehind・選定根拠・preservationを再評価し、必要な更新後に再review / 再検証する。`--admin`等の保護迂回や、gate未確認のまま将来mergeを予約する `--auto` は使わない。

branch protection / rulesetが設定されていてその状態を確認できる場合は、merge前にその必須条件も満たす。GitHub Freeのprivate repositoryのようなプラン制約により未設定・利用不可と確認できた場合、server-side protectionの不在自体はmerge停止理由にしない。権限不足・API error等により保護の有無を判定できない場合はUNKNOWNとして停止し、不在と推測しない。

server-side protection / rulesetが利用できない場合は、merge直前に次を続けて一度に確認・実行する。確認中またはmerge直前にmain / headの変化やraceを疑う状態があればmergeせず、live stateからgate全体を再評価する。

1. GitHubからlive current `main` SHAを再取得する。
2. GitHubからlive PR state、base、head SHA、mergeabilityを再取得する。
3. independent review対象head SHA、Full ValidateのCI head SHA、live PR head SHAが完全一致することを確認する。
4. live current `main` に対してPRがbehind 0であることを確認する。
5. live current `main` SHAがPR headのancestorであることを確認する。
6. live mergeabilityを再確認し、protectionが存在する場合はその必須条件も再確認する。
7. unresolved significant findings、REQUEST_CHANGES、required review threadが0で、必要なapprovalが満たされていることを再確認する。
8. 以上の確認後、不要な処理や待機を挟まず直ちにmerge APIを呼ぶ。
9. 確認済みlive PR head SHAをmerge APIのexpected head SHAまたは `gh pr merge <PR> --merge --match-head-commit <SHA>` に指定する。

GitHub Freeのprivate repositoryではmain SHAをmerge操作にatomicに固定できないため、最後のlive main確認後からmerge API実行までのごく短いrace conditionは完全には排除できない。この残余リスクは人間が明示的に受け入れたものとして扱い、behind 0等の上記gateを省略する理由にはしない。将来server-side branch protection / rulesetが利用可能になった場合は、その必須条件をこのlive-check gateに追加して従う。

merge応答が不明・中断した場合は成功を推測せず停止する。再開時にPRのmerged状態と対象headの統合を確認し、未mergeならgateを最初から確認する。gate確認結果・reviewer・確認時のmain / head SHA・CI URL・merge結果を同じPRのiteration record / reviewに残す。これは監査記録であり、新しい進捗の正本ではない。

## PR handoff and resumption

1. self-reviewと局所検証後、branchをpushしmain向けPRを1つ作る。CI待ちならDraftまたは `VALIDATING` を明示する。必要な局所検証・最終headのFull Validateを完了し、PR recordへ証跡を更新した後にReady for review化する。
2. PR / handoffの最初に `Human Progress Summary` を置き、全体で今どこか、今回何を進めたか、なぜ選んだか、3層のどこが変わったか、blocker、次の方向を人間向けに短く説明する。その後にiteration recordを残す。baseline/final head SHA、selectionとbatch範囲、source/preservation、review/fix-up、検証コマンドと結果、CI URL/headSha、未解決点、次候補と再評価条件を含める。Siteに影響する変更については、merge後に反映を実施できたか、実施不可・失敗ならその理由を報告する（Site無関係なら対象外）。
3. `AWAITING_MERGE` で人間またはtrusted independent automated reviewerへ引き継ぐ。automated reviewerは上記gateをすべて満たす場合だけmergeする。open autonomous PRがある間は次のWork Unitを開始しない。次候補の調査メモは可能だが、別Work Unitの実装は始めない。
4. 次回Developer起動ではlive GitHub state（open / closed / merged、Draft、base / head SHA、review・CI）と同じPRの最新recordを取得し、下表で再開先を決める。PRが存在するだけで待機せず、open中は同じPRだけを扱う。Developerはmergeせず、独立Reviewerのreview / merge gate確認を代行しない。

| 状態 | Developerの処理 |
| --- | --- |
| open / `LOCAL_FIX_REQUIRED` | 同じPRの指摘・失敗をfixし、必要な局所再検証とself-reviewを行い、`VALIDATING` へ戻して下記handoffを完了する。Draft / Readyよりこのfix要求を優先する |
| open / Draft または `VALIDATING` | 同じPRの未完了handoffを継続する。required local / focused validation → final-head Full Validate → PR record更新 → Ready for review化 → `AWAITING_MERGE` の順に完了する。head変更時は既存Validation gateに従って再検証する |
| open / Ready かつ `AWAITING_MERGE` | handoff完了の証跡を確認し、Developerは変更せずReviewer / human mergeを待つ。fix要求があれば `LOCAL_FIX_REQUIRED`、handoff未完了なら `VALIDATING` として同じPRを再開する |
| closed-unmerged | `STOPPED` と理由・再開条件を人間へ示し、自動的に次iterationや同じPRを開始しない |
| merged | fetchしたmainへ統合済みであることを確認してouter loopへ戻る。確認できるまで次iterationを開始しない |

Draft / `VALIDATING` は「open PRがあるため何もしない」状態ではない。実行中のCIは同じheadのrunを確認して待ち、完了後にhandoffを続ける。取得失敗・不明な状態や必須作業を完了できない場合は既存stop条件に従い、原因・未完了作業・再開条件をrecordへ残す。古いrecordの `AWAITING_MERGE` だけでlive Draftや未完了handoffを見落とさない。

次iterationはmerge確認後だけ開始でき、古いnext候補を無条件で実行しない。merge後の人間向け報告は、(1) アプリとして何ができるようになったか（内部整備だけならその旨）、(2) プロジェクト全体のどこが進んだか、(3) 方針逸脱や残る重大リスクがあるか、を短く説明する。細かい実装・検証証跡はPRの記録を参照する。

再開時にはmainのCI失敗や競合変更も確認する。新しいmainにより選択根拠やpreservationが変わった場合は再設計・再検証する。停止時は `STOPPED` と原因・必要判断・再開条件、検証待ちは `VALIDATING` とrun/head、マージ待ちは `AWAITING_MERGE` とPR/headを記録する。常駐schedulerやreviewerの実装・権限設定はこの契約の導入には含めない。
