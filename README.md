# Minecraft Dungeons Gear Optimizer v0.1

Minecraft Dungeons の手持ち近接武器・提示済みエンチャント・アーティファクトを、指定シナリオに対して全探索する React + TypeScript プロトタイプです。

## 対応範囲

- 武器: 闘士の締め具（Fighter's Bindings）/ ダブルアックス（Double Axe）/ アンカー（Anchor）
- エンチャント（通常枠はTier III、金色枠はTier I / II / III）: クリティカルヒット / 輝き / 吸血 / 虚無の一撃 / ガードストライク
- アーティファクト: シロタマゴテングタケ（Death Cap Mushroom）/ アイアンハイドアミュレット（Iron Hide Amulet）
- 公開 API: `evaluate(build, scenario)` / `optimize(inventory, scenario)`
- 手持ち管理: 個体別 Power、候補エンチャント、同種アーティファクト複数所持、ブラウザ自動保存、version付きJSON入出力
- 比較: 6種類のシナリオプロファイル、飽和Utility、Pareto前線、効果ごとの数値寄与

防具、遠距離武器、固有効果、敵個別耐性は未対応です。近接3武器のPower 50〜263は公開値ベースの推定damageに対応します。

完成条件、現在の進捗、次の実装項目は [ROADMAP.md](./ROADMAP.md) で管理しています。Phase 0 / 0.5 / 0.5.1 / 1Aが完了し、Phase 1は2 / 4項目まで進行しています。

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

検証コマンド:

```bash
npm run audit:melee
npm test
npm run lint
npm run build
```

## Phase 1A — Melee Attack Profile Audit

Minecraft Dungeons 1.17.0.0の入手可能な近接武器82件を、Optimizer本体へ追加する前段として公開情報だけで監査しました。母集団・武器ファミリー・各hitの生timing・damage ratio・source・confidence・調査statusは [`research/melee-attack-profile-audit.json`](./research/melee-attack-profile-audit.json) に保存しています。

`npm run audit:melee` は、ID重複、status、完全profile、hit数とduration数、派生HPS、共有元、source URLなどを検証し、[`research/melee-attack-profile-coverage.md`](./research/melee-attack-profile-coverage.md) を再生成します。現在のstrict coverageは76 / 82（92.7%）です。残る6件は推測で補完せず、daggers系4件の公開値矛盾とsawblade系2件の可変サイクルを`partial`として保持しています。

82武器のresearchデータはruntime catalogと分離しています。Phase 1の最初の項目として、既存3武器だけは監査済みのper-hit timingへ移行しましたが、Optimizer UIと計算対象は3武器のままです。

## Core の構成

```text
src/core/damage.ts     Power換算DPS、Critical Hit、Void Strike、AoE
src/core/enchantment.ts tier・source・stackingの共通処理
src/core/combatState.ts DPSからBuild依存の撃破速度を導出
src/core/healing.ts    Radiance、Leeching
src/core/defense.ts    Guarding Strike、Effective HP
src/core/artifact.ts   効果時間、稼働率、平均効果
src/core/evaluate.ts   1ビルドの評価
src/core/optimizer.ts  全組み合わせの探索、順位付け、Pareto前線
src/core/modelError.ts 実測比較、P90誤差、DPS参考範囲
src/core/powerScalingValidation.ts 公開damageのrange-aware誤差と集計
src/inventory/         localStorageとJSONの検証・入出力
src/pages/             サイト内の計算ロジック・実装状況ページ
src/data/              値、出典、信頼度、モデル仮定
src/research/          researchデータの型・Validator・coverage集計
research/              全近接武器の静的auditデータと生成済みレポート
scripts/               research検証・レポート再生成スクリプト
```

## 計算モデル

- Attack Profile: 既存3武器は公開Stats表のper-hit durationを保持し、`hit数 ÷ duration合計`から攻撃回数を導出します。出典、独立実機検証、frame measurementへの差し替え方法は[登録・検証手順](./docs/attack-profile-measurement.md)を参照してください。
- Power scaling: 表示ダメージ未入力時は公開Anchor表のPower 50〜263をlog補間し、武器のbase hit damageへ適用します。3武器29件でcross-validationし、Double Axeはmax 6.22%、Fighter's BindingsはP114に21.35%の外れ値を確認しました。武器別補正へ過学習せずmedium-confidenceの共通式を維持します。正確な個体表示値で上書きする場合は全武器への入力が必要です。詳細は[調査・実装記録](./docs/power-scaling.md)を参照してください。
- `Critical Hit III`: `1 + 0.2 × (3 - 1) = 1.4` の期待倍率。
- `Radiance III`: `攻撃回数/秒 × 20% × 1回の回復量`。複数コピーは発動率を増やさず、tier値の高い順に`100% / 75% / 50% / 25%`の回復量係数を適用します。
- Build依存kill rate: [CombatState](./docs/combat-state.md)で`min(敵供給上限, AoE DPS ÷ 平均敵HP)`を算出し、`直接撃破/秒 = 推定撃破/秒 × directKillShare`を一元管理します。
- `Leeching III`: `直接撃破/秒 × 敵HP × 9%`。間接ダメージ撃破はCombat Stateで除外済みです。
- `Guarding Strike III`: 武器本体の直接撃破をPoisson過程とみなし、`1 - exp(-directWeaponKillsPerSecond × 4)`を稼働率にします。
- アーティファクト: `duration / effectiveCooldown` を時間平均します。同種の一時効果は[Artifact stackingモデル](./docs/artifact-stacking.md)に従って効果量を重ねず、交互使用による稼働率だけを合算します。
- `Void Strike III`: 各武器ヒットでリセットされる時間曲線です。現在は1倍から3秒で7倍になる線形近似で、[計測手順](./docs/void-strike-measurement.md)に従った複数サンプルの中央値・補間へ差し替え可能です。
- Enchantment選択: BuildはIDだけでなくtier・slot/gilded/built-inのsourceを保持します。金色枠はUI・localStorage・JSON・Optimizerを通してTier I / II / IIIを維持します。重複可否と追加コピーの扱いは[Enchantモデル](./docs/enchantment-model.md)に集約しています。
- 目的スコア: 火力と回復を `1 - exp(-値 / 目標値)` で飽和させ、防御Utilityとシナリオ別の重みで加重平均します。過剰回復などが無制限に加点されることを防ぎます。
- 説明可能性: 選択効果を1つずつ外して再評価し、スコア・DPS・回復・実効HPの差分を寄与度として表示します。
- Pareto前線: AoE DPS・回復/秒・実効HPのすべてで他候補に支配されるビルドを除外します。
- 誤差範囲: [回帰検証手順](./docs/model-regression.md)に従った実測サンプルが5件揃うと、P90絶対誤差に基づくDPS参考範囲を表示します。それまでは「実測待ち」と明示します。
- Evidence coverage: 実際の計算経路に含まれるEvidenceを重要度付き幾何平均で集計します。[指標の定義](./docs/evidence-coverage.md)どおり正解確率ではなく、主な不確実要因を見つける品質指標です。

Power / Speed / Area rating自体は実ダメージや攻撃回数ではありません。既存3武器ではper-hit timingとbase hit damageを別に保持し、Power曲線からゲーム内damage単位へ換算します。実測データは `src/data/attackProfiles.ts`、`src/data/powerScaling.ts`、`src/data/voidStrike.ts`、`src/data/regressionSamples.ts` の対応するデータ境界へ登録します。

## データ品質

すべての固定値は `Evidence<T>` として `value / source / confidence / note` を持ちます。

- 武器の Power / Speed / Area: [dungeons.tools](https://www.dungeons.tools/tier-list) の 1.17.0.0 ゲームファイル由来データ。
- base hit damageとGear Power Curve: Minecraft Wiki個別Stats表。独立fixtureでcross-validation済みですが、row versionとitem rollが不明でBindings P114に外れ値があるためmedium confidence。
- エンチャントとアーティファクト仕様: [Minecraft Wiki](https://minecraft.wiki/w/Dungeons:Enchantment) に掲載されたゲーム内説明・検証値。
- Void Strike のランプ、標準シナリオ: `model-assumption` として隔離した未検証値。既存3武器のAttack Profileは公開Stats表由来のmedium confidence。

次の精度改善で最優先なのは、Void Strike の経過時間別倍率の検証です。Power換算は公開値cross-validation済みですが、Bindings P114外れ値の原因確認と独立実機測定は継続課題です。
