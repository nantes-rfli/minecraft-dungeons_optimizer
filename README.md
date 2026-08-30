# Minecraft Dungeons Gear Optimizer v0.1

Minecraft Dungeons の手持ち近接武器・提示済みエンチャント・アーティファクトを、指定シナリオに対して全探索する React + TypeScript プロトタイプです。

## 対応範囲

- 武器: 闘士の締め具（Fighter's Bindings）/ ダブルアックス（Double Axe）/ アンカー（Anchor）
- エンチャント（通常枠はTier III、金色枠はTier I / II / III）: クリティカルヒット / 輝き / 吸血 / 虚無の一撃 / ガードストライク / 切れ味（Sharpness）/ エンチャント解除（Unchanting）/ リフレッシュ（Refreshment）/ 弱体化（Weakening）
- アーティファクト: シロタマゴテングタケ（Death Cap Mushroom）/ アイアンハイドアミュレット（Iron Hide Amulet）
- 公開 API: `evaluate(build, scenario)` / `optimize(inventory, scenario)`
- 手持ち管理: 個体別 Power、候補エンチャント、同種アーティファクト複数所持、ブラウザ自動保存、version付きJSON入出力
- 比較: 6種類のシナリオプロファイル、飽和Utility、Pareto前線、効果ごとの数値寄与

防具、遠距離武器、固有効果、敵個別耐性は未対応です。近接3武器のPower 50〜263は公開値ベースの推定damageに対応します。

完成条件、現在の進捗、次の実装項目は [ROADMAP.md](./ROADMAP.md) で管理しています。Phase 0 / 0.5 / 0.5.1 / 1Aが完了し、Phase 1は3 / 4項目まで進行しています。Phase 1-4の公開DPS回帰監査は候補10件・eligible 0件で、full regressionはpending 0 / 5です。

画面は日本語を主表示、英語の装備名を補助表示にしています。計算ロジックでは言語に依存しないIDを使用するため、表示名を変更してもOptimizer Coreには影響しません。

## セットアップ

```bash
npm install
npm run dev
```

起動後、ターミナルに表示される `http://localhost:3000/` をブラウザで開いてください。現在の配信ランタイムは Codex Sites 対応の Vinext です。

本番ビルドを確認する場合:

```bash
npm run build
npm run preview
```

この場合もターミナルに表示されるURLを開きます。

## ホスティング

本番サイトはCodex Sitesの所有者限定アクセスで運用します。GitHub Pagesの公開Workflowは使用せず、GitHubリポジトリも非公開のまま維持します。

公開URL: [Minecraft Dungeons 最適装備ツール](https://nanto-minecraft-dungeons-optimizer.nantos.chatgpt.site)

このプロジェクトでエージェントへ実装・修正・ドキュメント更新を依頼した場合の標準サイクルは、**変更 → 検証 → 作業ブランチでコミット → mainへ反映・GitHubへpush → 同じcommitを本人限定Sitesへ反映 → 公開成功確認**です。コミットとpushを毎回追加で依頼する必要はありません。明示的な「push不要」「ローカルのみ」「PRまで」などの制限を優先し、「公開不要」「GitHubのみ」ならSites更新だけを省略します。調査・相談・レビューだけの依頼や差分のない作業では不要なコミットを作りません。手順は[AGENTS.md](./AGENTS.md)に記載しています。GitHubへのpushだけではSitesは更新されず、現在のGitHub Actionsは検証のみを行います。

検証コマンド:

```bash
npm run audit:dps
npm run audit:melee
npm run audit:enchants
npm test
npm run lint
npm run build
```

## Phase 1A — Melee Attack Profile Audit

Minecraft Dungeons 1.17.0.0の入手可能な近接武器82件を、Optimizer本体へ追加する前段として公開情報だけで監査しました。母集団・武器ファミリー・各hitの生timing・damage ratio・source・confidence・調査statusは [`research/melee-attack-profile-audit.json`](./research/melee-attack-profile-audit.json) に保存しています。

`npm run audit:melee` は、ID重複、status、完全profile、hit数とduration数、派生HPS、共有元、source URLなどを検証し、[`research/melee-attack-profile-coverage.md`](./research/melee-attack-profile-coverage.md) を再生成します。現在のstrict coverageは76 / 82（92.7%）です。残る6件は推測で補完せず、daggers系4件の公開値矛盾とsawblade系2件の可変サイクルを`partial`として保持しています。

82武器のresearchデータはruntime catalogと分離しています。Phase 1の最初の項目として、既存3武器だけは監査済みのper-hit timingへ移行しましたが、Optimizer UIと計算対象は3武器のままです。

## Phase 2-1A — Melee Enchantment Audit

[`research/melee-enchantment-audit.json`](./research/melee-enchantment-audit.json) は、1.17.0.0でhero-accessibleかつ近接へ適用できる33種を、tier・stacking・trigger・runtime blocker・Evidence別confidence付きで保持します。`npm run audit:enchants` はpopulation、schema、source-backed tier、runtime 9種との一致、未対応Enchantがruntime catalogへ混入していないことを検証し、[`research/melee-enchantment-coverage.md`](./research/melee-enchantment-coverage.md) を再生成します。

## Phase 2-1B — Sharpness / Unchanting + Enemy Composition

Phase 2-1B時点ではruntime対応 **7 / 33**、未対応 **26 / 33** でした。現在は次節のPhase 2-1Cまで完了しています。SharpnessはTier I / II / IIIが+10% / +21% / +33%、最大4コピーを乗算します。Unchantingは+50% / +75% / +100%をenchanted対象だけへ適用し、期待倍率は `1 + enchantedShare × tierBonus` です。

シナリオの「エンチャントされた敵の割合」を0〜100%で変更できます。全profile（bossを含む）の初期値25%は実測ではないlow-confidence仮定です。割合0ならUnchantingの寄与も0です。通常候補・ロック・金色Tier・保存・JSON入出力は既存経路を利用します。シナリオ自体は従来どおりセッション内の設定です。

```text
単体期待DPS = baseDps × Sharpness × Critical期待倍率 × Void期待倍率
             × (1 + enchantedShare × Unchanting bonus)
```

対象は直接近接hitのみで、proc/DoT等には拡張しません。Tier/stackingの根拠とinteraction/敵構成の仮定を分け、Unchanting選択時だけ敵構成Evidenceを集計します。式、typed effectの段階移行、remaining uncertaintyは [damage-modifiers.md](./docs/damage-modifiers.md) を参照してください。

## Phase 2-1C — Refreshment / Weakening State Models

現在は **implemented 9 / 33、unsupported 24 / 33** です。その他24種はruntime候補へ登録しません。

- **Refreshment**: 直接撃破ごとにTier I / II / IIIで1 / 2 / 3秒短縮、最大1個。独立したPotionStateで`推定CD = 45 / (1 + 直接撃破/s × 短縮秒数)`とし、`最大HP × 約0.75 × (1/推定CD − 1/45)`を追加回復容量として評価します。最大HP100・直接撃破1/秒・Tier IIIならCD11.25秒、追加容量5 HP/秒です。実回復ではないlow-confidenceの連続rate近似で、既存Buildへ基礎ポーション回復は加点しません。ArtifactのCD短縮も流用しません。[PotionStateの仕様・Evidence・制限](./docs/potion-state.md)。
- **Weakening**: 攻撃で周囲の敵の攻撃ダメージを5秒間、20% / 30% / 40%低下。対象割合は被ダメージ発生時点で弱体化中の敵から来る割合で、全profile共通の編集可能な50%（実測ではないlow仮定）です。Tier III・50%なら敵攻撃倍率0.80。5秒durationを再度掛けず、Artifact / Guardingのhero防御倍率と別段階で乗算します。[Enemy debuffの仕様・Evidence・制限](./docs/enemy-debuffs.md)。

Weakeningのstackingはdungeons.toolsのSTACKS YesとWikiの明示的な重複不可が矛盾しています。今回の仕様では最大1個を採用し、旧auditの4個/specialからの訂正と矛盾を残しました。Tier・継続時間はhigh、stackingはmedium、coverageと時間平均の合成はlowです。RefreshmentのTier/直接撃破条件はhigh、ポーションの約75%回復はmedium、rateモデルはlowで分離します。

結果の「回復・容量 / 秒」はRefreshmentの追加capacityを含みます。ポーションCD・使用頻度・容量、Weakening対象割合・敵倍率・hero防御との合成を内訳で追跡できます。金色Tier、候補/lock、保存・JSON・Optimizerにも対応します。新しいScenario APIには`enemyDebuffs: { weakeningAffectedIncomingDamageShare: 0.5 }`が必要です（Scenarioはセッション内設定のまま、inventory JSONはversion 1を維持）。

**Phase 2-1C complete — ready for Phase 2-1D.** 親項目の近接25〜30種への拡張は未完了。DamageEvent・Shockwave / Swirling / Thundering / Committed・Potion Barrier・防具は今回実装していません。

## Core の構成

```text
src/core/damage.ts     Power換算DPS、直接近接modifier、対象別期待DPS、AoE
src/core/enchantment.ts tier・source・stackingの共通処理
src/core/combatState.ts DPSからBuild依存の撃破速度を導出
src/core/potion.ts     Health Potion使用頻度とRefreshment追加回復容量
src/core/enemyDebuffs.ts Weakeningの時間平均coverageと敵攻撃倍率
src/core/healing.ts    Radiance、Leeching、Refreshment追加capacity
src/core/defense.ts    敵debuff × Artifact × Guarding Strike、Effective HP
src/core/artifact.ts   効果時間、稼働率、平均効果
src/core/evaluate.ts   1ビルドの評価
src/core/optimizer.ts  全組み合わせの探索、順位付け、Pareto前線
src/core/modelError.ts 実測比較、P90誤差、DPS参考範囲
src/core/powerScalingValidation.ts 公開damageのrange-aware誤差と集計
src/inventory/         localStorageとJSONの検証・入出力
src/views/             サイト内の計算ロジック・実装状況ページ
src/data/              値、出典、信頼度、モデル仮定
src/research/          researchデータの型・Validator・coverage集計
research/              全近接武器の静的auditデータと生成済みレポート
scripts/               research検証・レポート再生成スクリプト
```

## 計算モデル

- Attack Profile: 既存3武器は公開Stats表のper-hit durationを保持し、`hit数 ÷ duration合計`から攻撃回数を導出します。出典、独立実機検証、frame measurementへの差し替え方法は[登録・検証手順](./docs/attack-profile-measurement.md)を参照してください。
- Power scaling: 表示ダメージ未入力時は公開Anchor表のPower 50〜263をlog補間し、1.17.0.0の内部Power rating比を適用します。Wiki base damage比とのW/G比較は29 sampleのGolden Testへ固定し、version不明fixtureとの最大45.06%差をmedium-confidence caveatとして残します。正確な個体表示値で上書きする場合は全武器への入力が必要です。詳細は[調査・実装記録](./docs/power-scaling.md)を参照してください。
- `Critical Hit III`: `1 + 0.2 × (3 - 1) = 1.4` の期待倍率。
- `Radiance III`: `攻撃回数/秒 × 20% × 1回の回復量`。複数コピーは発動率を増やさず、tier値の高い順に`100% / 75% / 50% / 25%`の回復量係数を適用します。
- Build依存kill rate: [CombatState](./docs/combat-state.md)で`min(敵供給上限, AoE DPS ÷ 平均敵HP)`を算出し、`直接撃破/秒 = 推定撃破/秒 × directKillShare`を一元管理します。
- `Leeching III`: `直接撃破/秒 × 敵HP × 9%`。間接ダメージ撃破はCombat Stateで除外済みです。
- `Guarding Strike III`: 武器本体の直接撃破をPoisson過程とみなし、`1 - exp(-directWeaponKillsPerSecond × 4)`を稼働率にします。
- アーティファクト: `duration / effectiveCooldown` を時間平均します。同種の一時効果は[Artifact stackingモデル](./docs/artifact-stacking.md)に従って効果量を重ねず、交互使用による稼働率だけを合算します。
- `Void Strike`: [公開測定audit](./docs/void-strike-measurement.md)に基づき、最初の付与hitは1倍、armed後は1.25倍から3.6秒でTier III 7倍へ線形増加し、5秒で消滅します。3武器は平均HPSへ潰さず、combo内の各per-hit intervalをattack speedで短縮し、hitごとの消費・再適用と戦闘時間を計算します。curve形状・正確な消滅frame・tier別minimumはlow confidenceです。
- Enchantment選択: BuildはIDだけでなくtier・slot/gilded/built-inのsourceを保持します。金色枠はUI・localStorage・JSON・Optimizerを通してTier I / II / IIIを維持します。重複可否と追加コピーの扱いは[Enchantモデル](./docs/enchantment-model.md)に集約しています。
- 目的スコア: 火力と回復を `1 - exp(-値 / 目標値)` で飽和させ、防御Utilityとシナリオ別の重みで加重平均します。過剰回復などが無制限に加点されることを防ぎます。
- 説明可能性: 選択効果を1つずつ外して再評価し、スコア・DPS・回復・実効HPの差分を寄与度として表示します。
- Pareto前線: AoE DPS・回復/秒・実効HPのすべてで他候補に支配されるビルドを除外します。
- 誤差範囲: [回帰検証手順](./docs/model-regression.md)に従った独立実測sampleが5件揃うと、MAPE・P90・biasとP90絶対誤差に基づくDPS参考範囲を表示します。公開監査は[`research/dps-regression-audit.json`](./research/dps-regression-audit.json)へ分離し、現在は0 / 5のためrangeを表示しません。
- Evidence coverage: 実際の計算経路に含まれるEvidenceを重要度付き幾何平均で集計します。[指標の定義](./docs/evidence-coverage.md)どおり正解確率ではなく、主な不確実要因を見つける品質指標です。

Power ratingは武器間のper-hit damage係数、Speed / Area ratingは別軸です。既存3武器ではper-hit timingと内部Power ratingを別に保持し、AnchorのGear Power curveからゲーム内damage単位へ換算します。実測データは `src/data/attackProfiles.ts`、`src/data/powerScaling.ts`、`src/data/voidStrike.ts`、`src/data/regressionSamples.ts` の対応するデータ境界へ登録します。

## データ品質

すべての固定値は `Evidence<T>` として `value / source / confidence / note` を持ちます。

- 武器の内部Power / Speed / Area: [dungeons.tools](https://www.dungeons.tools/tier-list) の 1.17.0.0 ゲームファイル由来データ。武器間換算は[damage calculator](https://www.dungeons.tools/damage-calculator)の共通curve・内部rating比をmedium confidenceで採用。
- Gear Power Curve: Minecraft WikiのAnchor Power 50〜263表をmedium confidenceで保持。Wiki base damageは出典とversionが不明なため、runtimeではなくW/G比較用のlow-confidence Evidenceとして分離。
- エンチャントとアーティファクト仕様: [Minecraft Wiki](https://minecraft.wiki/w/Dungeons:Enchantment) に掲載されたゲーム内説明・検証値。
- Void Strike: tier最大値とresetはhigh、1.25倍minimumと約5秒消滅はmedium、3.6秒の線形curveとtier換算はlow confidenceです。raw公開値は [`research/void-strike-audit.json`](./research/void-strike-audit.json) にruntimeとは独立して保存しています。既存3武器のAttack Profileは公開Stats表由来のmedium confidenceです。

Phase 1-4の監査・eligibility validator・source provenance・pending/available UIは実装済みですが、再現可能な公開sampleが0 / 5のためpartialです。追加の公開観測が得られるまでPhase 1 Accuracyは3 / 4を維持します。Void Strikeの完全なframe series、target switching、Power換算の同一1.17.0.0・同一roll条件の実測、raw game-file fieldの独立確認は継続課題です。
