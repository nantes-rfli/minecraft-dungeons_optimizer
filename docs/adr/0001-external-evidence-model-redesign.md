# ADR 0001 — 外部Evidenceを起点とした計算モデルの段階的再設計

日付: 2026-09-09。状態: **設計方針採用、runtime移行未実施**。Phase 6.9A（現行差分と再設計範囲）、6.9B（データ契約と検証方針）の初版。元のPhase 6.8D/Eを完了扱いにしない。

## 決定

外部研究→条件と訂正の整理→取得済みgame dataとの照合→必要区間の公開動画→残余だけ自前実測・限定native解析、の順に進める。nativeの全復元を必須の通過条件から外す。外部研究者の知名度や引用件数はruntime採用条件にしない。

既存の`evaluate / optimize`、Inventory v2、Worker、actual rolls、unsupported拒否、research coverageを保ち、外部Evidenceの台帳と研究用の比較経路を追加してから機能単位で移行する。今回のコードは`scripts/`と`tests/`内のprobeに限定した。

## 現行から何を変えるか

| 領域 | 現状（実コードで確認） | 再設計 |
|---|---|---|
| Evidence | `src/core/types.ts`の`Evidence<T>`は単一source・confidence・note | 複数claim、revision、条件、訂正、導出依存、用途別の採用判断を台帳で保持し、従来型へadapterを提供 |
| データ | runtimeの武器/Power/効果値とresearch registryは分離済み | raw値、表示damage、neutral hit、built-in込み平均、実効rateを別propertyにする |
| Attack | `attackProfile.ts`はduration列からHPS、aggregate時は均一interval | action、damage hit、proc機会、finisher、releaseを独立eventにする。平均HPSは情報量を制限した観測型 |
| Damage | `damage.ts`はdirect / proc / DoTを分離済みだが、direct側は期待倍率の積 | source/channel/effect eligibilityとmodifier family、同条件相関、damage componentを明示 |
| Defense | `defense.ts`は許可された効果を時間平均で合成。未知DR併用は別validatorが拒否 | active状態ごとにfamily式を適用し、その後被damageで重み付け。合成拒否を先に解除しない |
| Committed | `enemyStateDamage.ts`は連続HP積分済み | 連続モデルを参照解として保持し、離散hit・開始HP・overkill・有限encounterへ拡張 |
| Healing | `healing.ts`と`combatState.ts`はdamage share等からkill/回復容量を近似 | proc機会、final blow帰属、実回復、overheal、死体数を区別 |
| Optimizer | 実装済み候補を同一Scenarioで全探索・Pareto、confidenceは別集計 | 評価policyとゲーム規則を分離し、model revision・未知条件・順位の安定性を出力 |

既存channel分離・連続積分・有限CC・soul schedulerを作り直すのではなく、現在の仮定と未対応境界を移行単位に使う。

## データとEvidenceの契約

以下は移行先の論理契約。今回保存した最小台帳はこのうちsource、claim、条件、research-only判定を先行実装した。全schemaの実装完了ではない。

| レコード | 必須項目・責務 |
|---|---|
| SourceRevision | sourceId、URL、author、retrievedAt、publication/edit日（判明時のみ）、snapshot/hash、locator方式、取得状態、origin/共有元 |
| Claim | claimId、sourceRevisionId、entity/property、値/単位/数式、kind、条件、version範囲、原文と解釈の区別 |
| ClaimRelation | supports / contradicts / corrects / derived-from、相手claimId、条件重複、理由。循環導出をreject |
| MechanicRule | ruleId/revision、対象channel、trigger、計算family、適用条件、claimIds、例外、未定義領域 |
| ValidationCase | input条件、expected値/interval、由来、measurement / derived / synthetic、使用目的calibration / holdout |
| AdoptionDecision | 対象rule/property、research-only / limited / full、許容領域、未充足条件、回帰結果、判断理由 |

`community_measurement`は測定手順や観測の記録がある場合だけ使う。作者の「測った」という主張はその主張として保存し、回収していない測定列を作らない。`game_file_crosscheck`や`runtime/video_crosscheck`はclaimの比較・検証レコードに置き、単にURLがあることと分ける。

取得可能性、source authenticity、方法の質、version適合、独立性、モデル適合を別軸にする。publication dateをgameVersionへ代入しない。数式を採用できても、その係数やscenarioに使えるとは限らない。未知値は`null + reason`、真の0とは区別する。

訂正前claimは削除しない。訂正範囲が一致するときだけ`corrects`で旧値の新規採用を止める。例えばGrowing Staffの6.3→4.3は当該guide内の訂正であり、別条件の表4.43を自動置換する指示ではない。同じ実測の転載や数式から算出した表をholdoutとして使わない。

## ゲームロジックと計算の契約

```text
SourceRevision → Claim / Relations → AdoptionDecision → MechanicRule
Game settings → AttackDefinition ────────────────────────┤
Build + Scenario + Observation profile → Combat events → Metrics
Metrics + ObjectivePolicy + modelRevision → Ranking / Explanation
```

AttackDefinitionはvariant、animation参照、configured delay/cooldown、loop、release、cancelを保持する。PlaybackRuleは設定を時間へ変換する仮説。ObservationProfileは`aggregate-rate`か`event-sequence`を区別する。aggregateしかないprofileに仮の均一hit列を作り、精密Void/finisherモデルを装わない。

Combat eventの必要項目は、time、actionId、targetId、sourceEffect、componentId、channel tags、proc eligibility、ownership、ruleRevision。direct/indirectは**発生源の属性**、physical/fire/poison/soulは**damage種別**、globalは**modifierの適用範囲**として扱う。Dynamoをchannel名に固定せず、追加componentと適用順の規則として表す。jungle poisonはpoison tagだけでeligibilityを推定せず、発生源固有の明示例外を持つ。

modifierのfamilyは、同family加算、自己stack、条件付き乗算、element focus、対象への全体増幅などを候補とする。`eligible / ineligible / unresolved`をeffect×componentに持たせ、unresolvedを倍率1に変換しない。2021説明と2026式のDynamo衝突を解決するまで、その組合せはresearch比較に留める。

Voidは対象ごとの付与・消費・更新と各damage eventの時刻を評価する。総DPS増加率を全channelに同じ倍率で掛けない。比較する観測は同じ速度・hit weighting・初撃・対象切替条件に正規化する。

DRは`E[damageTaken(active state)]`を求める。`damageTaken(E[reduction])`は一般に一致しない。BarrierとIron Hideのuptimeが同じでも重複率で結果が変わるため、joint statesが不明なら独立近似を明示するか結果を限定する。Weakeningは敵側debuffとして別stateを持ち、被damage構成を考慮する。

Committedは瞬間rule `1+b(1-h)`とScenario期待値を分離する。今回probeで有限hitの順位比較に必要なoverkillと攻撃予算を確認した。次はhit/event列を入力し、CritやDoTの乱数・対象切替・roundingを必要な範囲で追加する。決定的な期待値法が可能な部分を優先し、Monte Carloを使う場合はseed・試行数・誤差を保存する。

Healing/CCはdamage hitsとproc opportunitiesを別に数える。Radianceの名目回復容量と実回復、Leechingのenemy HPと撃破帰属、Stunningのrefreshと免疫を独立に扱う。単純なdamage share→final-blow shareは残す場合も仮定として出力する。

## Optimizer評価

比較対象は同じmodel revision・scenario・評価policy・対応範囲に揃える。目的はraw DPSだけでなく、指定時間内の有効damage、撃破時間/撃破数、実回復、被damage、CC coverage。有限モデルとsteady-stateの値を同じDPS欄に無説明で混ぜない。

未知効果を含むbuildは従来どおり理由付き除外、または対応部分だけの参考表示に留め、完全対応buildと同じランキングへ混入させない。confidenceをscoreの係数として掛けない。検証されていない誤差分布から95%区間を作らない。

根拠付きの上下限がある場合だけ複数仮説でrank / Top3 / Paretoの変化を比較し、「この範囲では順位安定」「仮定で逆転」を示す。tier listを正解ラベルにしない。所有装備のactual rolls、gilded、固定slot、合法性・search budget・Worker中止は維持する。cache keyはbuildだけでなくscenario hash、rule revision、evidence decision revision、objective revisionを含める。

## 段階的な移行と完了条件

| 単位 | 変更内容 | 通過条件 |
|---|---|---|
| 6.9A/B 初版（今回） | 外部台帳、条件・訂正・衝突、現行との差、研究probe、ADR | offline audit、既存式との照合、通常検証。runtimeは同一 |
| 6.9C Evidence adapter | versioned claim/関係/採用判定を追加、既存Evidenceへ橋渡し | invalid refs・循環・訂正・重複由来・unknown拒否、旧出力の互換性 |
| 6.9D attack/event比較 | 4 runtime武器+Claymore+Sawbladeの研究profile | entity/条件照合、集計rateとevent列の区別、未使用観測との比較 |
| 6.9E DR / modifier比較 | 対象を限定したfamily規則とstate計算 | holdout、競合解決、丸め/単位/activation範囲、順位影響を説明 |
| 6.9F Scenario / Optimizer | finite hit・ownership・目的別metricsと感度 | 同条件の旧新比較、性能・再現性、未知を0点にしない |
| Phase 9 昇格 | 合格したsliceだけcatalog/manifest/UIへ反映 | 関連audit・test・lint・build、必要なE2E、説明/coverage/台帳同期 |

全Phase 6.9完了までruntime昇格を一切禁止する趣旨ではない。独立したsliceが条件を満たせば先に昇格可能。逆に根拠未回収のsliceを期限や表の行数だけで昇格しない。Phase 7の自前実測queueは外部取得後の残余へ絞り、Phase 8のvalidationは外部・自前の両方に適用する。

## 検討した代案と理由

- native全面復元を待つ案: 起動環境の追跡が律速で、観測済みの戦闘条件へ到達していない。必要な問いだけに限定して保留する。
- community表を直接runtimeへ輸入する案: 版、built-in平均、異なるmetric、作者訂正、source共有が混ざるため採用しない。
- 全面イベントシミュレータへ即置換する案: 未確定の規則を大量実装し、既存の解析式と高速探索を失うリスクがある。研究比較とadapterを先行させる。

今回のprobeは数学整合性を確かめる道具であり、モデルのゲーム内精度を上げたと主張しない。未解決事項と次の取得対象は[外部研究レポート](../external-community-research.md)に集約する。
