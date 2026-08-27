# Minecraft Dungeons Gear Optimizer v0.1

Minecraft Dungeons の手持ち近接武器・提示済みエンチャント・アーティファクトを、指定シナリオに対して全探索する React + TypeScript プロトタイプです。

## 対応範囲

- 武器: 闘士の締め具（Fighter's Bindings）/ ダブルアックス（Double Axe）/ アンカー（Anchor）
- エンチャント（すべて Tier III）: クリティカルヒット / 輝き / 吸血 / 虚無の一撃 / ガードストライク
- アーティファクト: シロタマゴテングタケ（Death Cap Mushroom）/ アイアンハイドアミュレット（Iron Hide Amulet）
- 公開 API: `evaluate(build, scenario)` / `optimize(inventory, scenario)`

防具、遠距離武器、実ダメージのパワースケーリング、固有効果、敵個別耐性は未対応です。

画面は日本語を主表示、英語の装備名を補助表示にしています。計算ロジックでは言語に依存しないIDを使用するため、表示名を変更してもOptimizer Coreには影響しません。

## セットアップ

```bash
npm install
npm run dev
```

起動後、ターミナルに表示される `http://127.0.0.1:5173/` をブラウザで開いてください。`index.html` や `dist/index.html` を Finder から直接開いても、Vite のモジュール配信がないため動作しません。

本番ビルドを確認する場合:

```bash
npm run build
npm run preview
```

この場合は `http://127.0.0.1:4173/` を開きます。

検証コマンド:

```bash
npm test
npm run lint
npm run build
```

## Core の構成

```text
src/core/damage.ts     正規化DPS、Critical Hit、Void Strike、AoE
src/core/healing.ts    Radiance、Leeching
src/core/defense.ts    Guarding Strike、Effective HP
src/core/artifact.ts   効果時間、稼働率、平均効果
src/core/evaluate.ts   1ビルドの評価
src/core/optimizer.ts  全組み合わせの探索と順位付け
src/data/              値、出典、信頼度、モデル仮定
```

## 計算モデル

- `Critical Hit III`: `1 + 0.2 × (3 - 1) = 1.4` の期待倍率。
- `Radiance III`: `攻撃回数/秒 × 20% × 1回の回復量`。
- `Leeching III`: `撃破/秒 × 敵HP × 直接撃破率 × 9%`。間接ダメージ撃破を `directKillShare` で除外します。
- `Guarding Strike III`: 撃破を Poisson 過程とみなし、4秒以内に1回以上撃破する確率 `1 - exp(-killsPerSecond × 4)` を稼働率にします。
- アーティファクト: `duration / effectiveCooldown` を最大100%で丸め、稼働時効果を時間平均します。
- `Void Strike III`: 各武器ヒットでリセットされる線形ランプ近似です。正確な時間曲線が未取得なので低信頼度です。
- 目的スコア: `AoE DPS / 敵HP`、`回復/秒 / 被ダメージ/秒`、`軽減ダメージ / 元の被ダメージ` を比率化してから加重平均し、100倍します。異なるシナリオ間の絶対比較には使いません。

Power / Speed / Area はゲーム内の実ダメージや攻撃回数そのものではありません。v0.1 では Speed を攻撃回数へ変換する係数を仮定しているため、出力は「正規化値」です。実測データが得られたら `src/data/model.ts` のみを差し替えられます。

## データ品質

すべての固定値は `Evidence<T>` として `value / source / confidence / note` を持ちます。

- 武器の Power / Speed / Area: [dungeons.tools](https://www.dungeons.tools/tier-list) の 1.17.0.0 ゲームファイル由来データ。
- エンチャントとアーティファクト仕様: [Minecraft Wiki](https://minecraft.wiki/w/Dungeons:Enchantment) に掲載されたゲーム内説明・検証値。
- 攻撃速度換算、Void Strike のランプ、標準シナリオ: `model-assumption` として隔離した未検証値。

次の精度改善で最優先なのは、3武器の無強化時コンボ時間と Void Strike の経過時間別倍率のフレーム計測です。
