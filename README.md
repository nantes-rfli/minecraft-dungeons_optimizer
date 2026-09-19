# Minecraft Dungeons Gear Optimizer

Minecraft Dungeons の手持ち装備を、現在確認できているゲーム仕様とEvidenceの範囲内で比較する React + TypeScript 製のOptimizerです。

未対応・未確認の効果は0点や中立値として扱わず、Optimizerの評価対象から分離します。Catalog / Inventory / Runtime Support / Evidence Statusを別々に管理し、確認できた範囲だけを計算へ接続します。

## Current support

<!-- runtime-support:start -->
Population 33 · Catalog runtime 28 / 33 · Full 19 · Limited 9 · Research-only 5 · Broad Power 22 · Power-limited 6
<!-- runtime-support:end -->

<!-- artifact-support:start -->
Artifacts · Audited source population 45 · Catalog runtime 3 / 45 · Full 2 · Limited 1 · Research-only 42
<!-- artifact-support:end -->

現在の主なruntime範囲:

- 近接武器: Fighter's Bindings / Double Axe / Anchor / Soul Scythe
- Armor: 7種をLimited対応
- Ranged: Bow / Crossbowを観測値入力付きでLimited対応
- Artifact: Death Cap Mushroom / Iron Hide Amulet / Shock Powder
- Enchantment: Full / Limited / Research-onlyを明示し、未対応候補を0点評価しない
- 比較: Damage / Healing / Defense / Control、6種のScenario profile、Pareto前線、効果ごとの寄与
- Inventory: 監査済み装備をruntime対応外も含めて保持し、ブラウザ保存とJSON入出力に対応
- Evidence: Verified / Measured / Derived / Estimated / Unknown / Unclassifiedをruntime supportとは別軸で管理

詳細な対応範囲と制約:

- [Melee runtime support](./docs/melee-runtime-support.md)
- [Armor runtime support](./docs/armor-runtime-support.md)
- [Ranged runtime](./docs/ranged-runtime.md)
- [Artifact runtime support](./docs/artifact-runtime-support.md)
- [Runtime limitations / backlog](./docs/runtime-limitations.md)
- [Evidence & Coverage](./docs/combined-evidence-coverage.md)

## App

本人限定のSites環境で運用しています。

[Minecraft Dungeons 最適装備ツール](https://nanto-minecraft-dungeons-optimizer.nantos.chatgpt.site)

InventoryとResearch Questの途中データはブラウザ内に保存します。Research-onlyやEvidence不足の値は、根拠が揃うまでOptimizer runtimeへ自動昇格しません。

## Setup

```bash
npm install
npm run dev
```

本番相当の確認:

```bash
npm run build
npm run preview
```

## Architecture

主要な情報は次の境界で分離しています。

```text
Raw Game Sources / External Evidence
  ↓
Research / Canonical Game Domain
  ↓
Runtime Support + Evidence Adoption
  ↓
Application / Optimizer
```

Catalogに存在すること、ユーザーが所持していること、runtimeで計算可能であること、Evidenceが十分であることは同じ意味ではありません。

詳細:

- [Catalog / Inventory / Runtime / Evidence separation](./docs/catalog-evidence-runtime-separation.md)
- [Evidence Model ADR](./docs/adr/0001-external-evidence-model-redesign.md)
- [Runtime Promotion Pipeline](./docs/runtime-promotion-pipeline.md)
- [Raw package snapshot — Step 3A](./docs/game-data-raw-package-snapshot.md)
- [Game Data Model Alignment](./docs/game-data-model-alignment.md)
- [Canonical Game Data Properties](./docs/game-data-canonical-properties.md)

主要ディレクトリ:

```text
src/core/       Optimizer runtime / evaluation
src/data/       runtime data and definitions
src/research/   research read models and validators
research/       audited data, snapshots, generated research artifacts
scripts/        audit / generation / extraction scripts
docs/           design, evidence, support boundaries and historical records
e2e/            browser-level major flow tests
```

## Development

通常の変更では、その変更に関係する検証だけをローカルで実行します。全体検証はGitHub Actionsの `Validate` workflowが担当します。Markdownだけの変更ではChromium準備とE2Eを省略し、それ以外の変更と手動実行ではE2Eを実行します。

代表的なコマンド:

```bash
npm test
npx tsc -b
npm run lint
npm run build
npm run test:e2e
```

データ・Evidence・runtime supportを変更する場合は、対象に対応する `audit:*` / `generate:*` scriptを `package.json` から選びます。生成物だけを直接編集せず、正本と生成結果のdriftをauditで確認します。

エージェント向けの作業ルールは [AGENTS.md](./AGENTS.md)、CIの正本は [.github/workflows/ci.yml](./.github/workflows/ci.yml) です。

## Project status

現在の目標と人間向けoverviewは [ROADMAP.md](./ROADMAP.md)、Work UnitのTrack / status / dependency / completion / next actionは [src/data/roadmap.ts](./src/data/roadmap.ts) を構造化正本とします。ROADMAPのWork Unitsはそこから生成します。

旧Phase 0〜8の経緯や過去の完了記録は [Historical Roadmap](./docs/historical-roadmap.md) に凍結しています。現行の判断へ旧Phase番号や過去のpercentageを再利用しません。

主な現状:

- Research: 独立Evidence acquisitionを継続
- Product: Runtime Promotion Pipeline foundationは実装済み
- promotion eligibleなparameter / mechanicは現在0件
- Limited DR adoptionは独立raw trace待ち
- 未検証値を0や1としてruntimeへ昇格しない

## Documentation

入口として読む文書:

- [Documentation index](./docs/README.md)
- [Roadmap](./ROADMAP.md)
- [Historical Roadmap](./docs/historical-roadmap.md)
- [Runtime limitations](./docs/runtime-limitations.md)
- [Evidence & Coverage](./docs/combined-evidence-coverage.md)
- [Evidence intake and validation](./docs/phase8-evidence-intake.md)
- [Personal Research Quest](./docs/phase7-personal-research-quest.md)
- [Research artifact layout](./research/README.md)
- [Runtime Promotion Pipeline](./docs/runtime-promotion-pipeline.md)
- [Public-use readiness](./docs/public-use-readiness.md)
- [Changes](./docs/changes.md)

Git commit historyを変更追跡の正本とします。
