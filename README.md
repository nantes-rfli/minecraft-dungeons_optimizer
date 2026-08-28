# Minecraft Dungeons Gear Optimizer v0.1

Minecraft Dungeons の手持ち近接武器・提示済みエンチャント・アーティファクトを、指定シナリオに対して全探索する React + TypeScript プロトタイプです。

## 対応範囲

- 武器: 闘士の締め具（Fighter's Bindings）/ ダブルアックス（Double Axe）/ アンカー（Anchor）
- エンチャント（すべて Tier III）: クリティカルヒット / 輝き / 吸血 / 虚無の一撃 / ガードストライク
- アーティファクト: シロタマゴテングタケ（Death Cap Mushroom）/ アイアンハイドアミュレット（Iron Hide Amulet）
- 公開 API: `evaluate(build, scenario)` / `optimize(inventory, scenario)`
- 手持ち管理: 個体別 Power、候補エンチャント、同種アーティファクト複数所持、ブラウザ自動保存、version付きJSON入出力
- 比較: 6種類のシナリオプロファイル、飽和Utility、Pareto前線、効果ごとの数値寄与

防具、遠距離武器、実ダメージのパワースケーリング、固有効果、敵個別耐性は未対応です。

完成条件、現在の進捗、次の実装項目は [ROADMAP.md](./ROADMAP.md) で管理しています。現在は Phase 0（Optimizer Core）が完了し、Phase 1（実測による精度改善）へ進む段階です。

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
npm test
npm run lint
npm run build
```

## Core の構成

```text
src/core/damage.ts     正規化DPS、Critical Hit、Void Strike、AoE
src/core/enchantment.ts tier・source・stackingの共通処理
src/core/combatState.ts DPSからBuild依存の撃破速度を導出
src/core/healing.ts    Radiance、Leeching
src/core/defense.ts    Guarding Strike、Effective HP
src/core/artifact.ts   効果時間、稼働率、平均効果
src/core/evaluate.ts   1ビルドの評価
src/core/optimizer.ts  全組み合わせの探索、順位付け、Pareto前線
src/core/modelError.ts 実測比較、P90誤差、DPS参考範囲
src/inventory/         localStorageとJSONの検証・入出力
src/pages/             サイト内の計算ロジック・実装状況ページ
src/data/              値、出典、信頼度、モデル仮定
```

## 計算モデル

- Attack Profile: 武器別の攻撃回数データを使用します。現在はSpeed Rating由来の暫定値で、[計測手順](./docs/attack-profile-measurement.md) に従ったフレーム実測へ差し替え予定です。
- Power scaling: 全武器にゲーム内表示ダメージを入力した場合は実数値で比較します。未入力時は正規化値を使い、入力済み・未入力の混在は拒否します。自動換算の制約は[調査記録](./docs/power-scaling.md)を参照してください。
- `Critical Hit III`: `1 + 0.2 × (3 - 1) = 1.4` の期待倍率。
- `Radiance III`: `攻撃回数/秒 × 20% × 1回の回復量`。
- Build依存kill rate: [CombatState](./docs/combat-state.md)で`min(敵供給上限, AoE DPS ÷ 平均敵HP)`を算出します。
- `Leeching III`: `推定撃破/秒 × 敵HP × 直接撃破率 × 9%`。間接ダメージ撃破を `directKillShare` で除外します。
- `Guarding Strike III`: 撃破を Poisson 過程とみなし、4秒以内に1回以上撃破する確率 `1 - exp(-estimatedKillsPerSecond × 4)` を稼働率にします。
- アーティファクト: `duration / effectiveCooldown` を時間平均します。同種の一時効果は[Artifact stackingモデル](./docs/artifact-stacking.md)に従って効果量を重ねず、交互使用による稼働率だけを合算します。
- `Void Strike III`: 各武器ヒットでリセットされる時間曲線です。現在は1倍から3秒で7倍になる線形近似で、[計測手順](./docs/void-strike-measurement.md)に従った複数サンプルの中央値・補間へ差し替え可能です。
- Enchantment選択: BuildはIDだけでなくtier・slot/gilded/built-inのsourceを保持します。重複可否と追加コピーの扱いは[Enchantモデル](./docs/enchantment-model.md)に集約しています。
- 目的スコア: 火力と回復を `1 - exp(-値 / 目標値)` で飽和させ、防御Utilityとシナリオ別の重みで加重平均します。過剰回復などが無制限に加点されることを防ぎます。
- 説明可能性: 選択効果を1つずつ外して再評価し、スコア・DPS・回復・実効HPの差分を寄与度として表示します。
- Pareto前線: AoE DPS・回復/秒・実効HPのすべてで他候補に支配されるビルドを除外します。
- 誤差範囲: [回帰検証手順](./docs/model-regression.md)に従った実測サンプルが5件揃うと、P90絶対誤差に基づくDPS参考範囲を表示します。それまでは「実測待ち」と明示します。
- Evidence coverage: 実際の計算経路に含まれるEvidenceを重要度付き幾何平均で集計します。[指標の定義](./docs/evidence-coverage.md)どおり正解確率ではなく、主な不確実要因を見つける品質指標です。

Power / Speed / Area はゲーム内の実ダメージや攻撃回数そのものではありません。v0.1 では Speed を攻撃回数へ変換する係数を仮定しているため、出力は「正規化値」です。実測データは `src/data/attackProfiles.ts`、`src/data/voidStrike.ts`、`src/data/regressionSamples.ts` の対応するデータ境界へ登録します。

## データ品質

すべての固定値は `Evidence<T>` として `value / source / confidence / note` を持ちます。

- 武器の Power / Speed / Area: [dungeons.tools](https://www.dungeons.tools/tier-list) の 1.17.0.0 ゲームファイル由来データ。
- エンチャントとアーティファクト仕様: [Minecraft Wiki](https://minecraft.wiki/w/Dungeons:Enchantment) に掲載されたゲーム内説明・検証値。
- 攻撃速度換算、Void Strike のランプ、標準シナリオ: `model-assumption` として隔離した未検証値。

次の精度改善で最優先なのは、3武器の無強化時コンボ時間と Void Strike の経過時間別倍率のフレーム計測です。
