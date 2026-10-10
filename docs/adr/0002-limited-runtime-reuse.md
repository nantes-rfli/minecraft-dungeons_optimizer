# ADR 0002 — New Mechanic PromotionとExisting Limited Mechanic Reuseの分離

- Date: 2026-10-10
- Status: **proposed — Architecture PRの人間による設計承認と独立レビューが必要**
- Baseline: `main` at `cb08c34e6c17b857532e0a81fae3cf8b87491738`
- Scope: Runtime coverageの入口契約。既存mechanic・Evidence・数式の認定を変更しない。

## Decision: 2つの独立した入口

**A — New Mechanic Promotion（P3B gate維持）**: これまで使っていない式、未採用のparameter、未検証のinteraction、現在のLimitedモデル外のchannel/発動条件/stacking/compositionを採用する。対象parameter/mechanicごとのR3 accepted AdoptionDecision、version一致、独立したProduct regression、P3B reference、5成果物のSHA-256を含むatomic bundleを必須とする。既存`research/runtime/runtime-promotion-manifest.json`のcandidate/eligible/promotedはこの経路だけを数える。対象がない現状は1/0/0のまま。

**B — Existing Limited Mechanic Reuse（P3Bの別目的の代用ではない）**: 既にLimited runtimeで**実装・境界が固定された同一mechanic**を、source-backedな別装備に適用する。これはその装備に対する実ゲーム精度の新規認定ではなく、既存Limitedモデルの適用対象拡張。Verified/Measured/R3 acceptedやPromotion実績を意味しない。

Bは次のすべてが揃うときだけ許可する。

1. Raw→Canonical装備Identity、対象gameVersion、sourceの特定が可能。
2. 対象装備自身の個別parameterの値とintrinsicの意味、source ID、source locator、版が明示される。親装備の値から単にコピーしない。
3. 同じLimited計算式のmechanic、channel、target scope、activation、inheritance、単位・条件が一致。異なればBを拒否してAへ戻す。
4. donor固有の別effect、built-in、Soul、Aura、Life Steal、DRなどを対象へ誤継承しない。未知の副作用は0/neutralとして無視しない。
5. stacking、composition、proc attribution、外部speed sourceなど未実証のinteractionは明示的に拒否し、適用範囲を数値で拡げない。
6. 対象parameterのEvidence StatusとRuntime Supportを別々に登録。LimitedからDerived/Verifiedへ自動分類しない。Unknown/UnclassifiedはいずれのEvidence policyでも数値評価に使わない。
7. 正例、負例、preservationの回帰とsupport manifest/coverage/説明の同期を対象単位で要求する。Full Validateと独立レビューを省略しない。
8. Bのsourceが撤回・version drift・値不一致・継承破綻した場合はfail-closedしてResearch-onlyに留める。条件に合わない場合はAの手順へ戻す。

## Enforced MVP boundary（Armor）

- `src/core/armorEvidence.ts`はこれまでの7 Armor / 16 non-neutral parameterのEvidenceを**明示的なsource・値・property・版に固定**する。既存分類はすべてDerivedのまま変更しない。runtime定義から自動でEvidenceを生成しない。
- `src/core/evidenceStatus.ts`は明示的なbindingを照合し、未宣言・値ずれ・raw propertyずれの数値をUnclassifiedとする。直接`evaluate`する場合も`src/core/validation.ts`でfail-closedする。
- `src/research/limitedMechanicReuse.ts`の承認台帳は**空**。pre-policy7件を歴史的Limited扱いとするが、R3 acceptedと読み替えない。新規ArmorがBを使うには、source・同じmechanic/版/channel/scope・継承・非継承・併用拒否・テスト参照を備える個別の承認recordが必要。登録だけのArmorは`audit:armor-runtime`で拒否する。 P3B経由の新規Armor（A）は別途`PROMOTED_ARMOR_RUNTIME_LINKS`に対象を明記し、`runtime-promotion-manifest`上のaccepted/eligible/passedかつatomic bundle済みの対象へのlinkだけ許可。AとBの同時指定は拒否する。現行Link件数は0。
- 実装済みB validatorは **Thief系の単独+25%近接cadence**だけに限定。より広いeffectやstackingなどの新しい意味は自動承認せず、Aまたは追加Architecture審査を要求する。これは全mechanicへの包括的な無審査許可ではない。
- 対象parameterのEvidence宣言はBの承認recordと独立して必要。source-backedなDerivedは公開監査値由来の分類に留まり、**ゲーム内interactionの採用やVerified認定ではない**。

## PR #209 fix-up: classificationとPromotion対象の追加gate

- `validateBuild(build, scenario?)`はScenario省略時も`include-estimated`を既定方針としてArmor parameter Evidenceを検証する。Scenarioありの場合は既存Evidence policyを尊重し、未分類を許可しない。
- `Derived`の既存7 Armor / 16 parameter分類は維持。新しい`Measured` / `Verified`分類は個別bindingやaccepted/approvedの判断レコードだけでは認めない。現行`hasIndependentArmorClassification`はResearch Evidenceの参照先ファイル実在性・raw trace真正性・異なるoriginの実質的独立性を検証できないため、**全Measured/Verified分類をfail-closedで拒否**しUnclassifiedとする（合成テストfixtureの承認ラベルも不許可）。将来の採用には対象装備・parameter・値・version・statusが一致する独立レビュー済みDecisionだけでなく、永続化された実Evidenceとmeasurement origin、Verifiedなら別holdoutの参照検証・内容/独立性検査を実装してからgateを更新する。これはR3/P3Bの代替ではない。
- A経路の新Armorを有効化するには、Promotion candidate/bundleの存在だけでなく、claim target IDが正確に`armor.<armorId>.<parameter-id>`であり、対象Armor自身のaudit property・source・版・parameter・適用channel・`self-armor` scopeが一致しなければならない。独立Product regression、eligibility、atomic bundle検査を維持し、無関係なPromotion targetからの横流用を拒否する。現行のPromotion件数・active link件数は変更しない。
- A経路でArmorに複数のnon-neutral runtime parameterがある場合、**有効なparameterごと**に対応するR3 accepted / P3B eligible / atomic bundle済みPromotion linkが必要。1つのtarget linkを装備全体の許可に読み替えず、同じArmorの異なるparameterへの正当なlinkは許すが、同じtargetの重複は拒否する。現在のA link表現は数値intrinsicのみ対応するため、built-in Enchantments、Soul受付・modifier、linkのない非数値intrinsicは黙ってneutral扱いせず拒否し、別途対応するPromotion契約が成立するまでA経路に載せない。source-backed Derived Evidenceだけでは個別P3B gateを満たさない。
- これらはsource-backedかつreview済みの意思決定レコードを**別途登録するためのgate**であり、新たなMeasured/Verified認定やA経路での実装済みmechanicを宣言するものではない。

## Thief Armor: PR #208の独立審査で確認すべき事項

対象のaudit entryは`thief-armor` / `AssassinArmor` / 1.17.0.0で、`dungeons-tools-armor-index`をsourceとした`+25% melee attack speed`を持つ。既存Limited donorは`spider-armor` / `AssassinArmor_Unique1`。audit上Spiderの`baseArmorId=thief-armor`でspeedのみがinherited、`6% life steal aura`はSpider unique-only。共通+25% cadence単独ならB validatorに適合する（**テストfixture上の成立**）。

Bで承認するならPR #208の対象runtimeは、観測Armor Health必須・Power fallback禁止、直接近接cadence+25%だけを適用し、Spider固有のLife Steal、DR、別Aura、Soul効果を継承しない。Death Cap Mushroom/Rampaging合成は引き続き明示拒否し、無検証のspeed stack/activationは推測しない。

**まだ成立していない条件**: PR #208は独立のreuse承認recordとThief自身のsource-bound parameter Evidence宣言を必要とする。support manifest・count・runtime audit・positive/negative/preservation regressionを同期し、PR headに対してFull Validate（validate/browser両job）と独立レビューを成功させる。Architecture承認後に別PRのままfix-upする。本ADRではThiefを`ARMORS`へ追加しない。

## PromotionとReviewの境界

Research Evidence → R3 decision → P3B promotionの既存契約と`research/runtime/runtime-promotion-manifest.json`、候補1/eligible0/promoted0は**一切変更しない**。Bの承認はPromotion eligibilityを増やさない。PR #208はDraftのまま、Architecture PR自身も自動mergeしない。両PRとも設計/実装の自己レビュー、第三者の独立レビュー、人間の承認を区別する。

新規B実装時もruntime、support manifest、説明、coverage、testsを同じPRで整合させる。既存7 Armorの計算式、Evidence分類、counterは改変しない。
