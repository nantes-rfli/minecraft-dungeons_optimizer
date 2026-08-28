# Evidence coverage

## 表示の意味

結果画面の`Evidence coverage: x / 100`は正解確率ではありません。選択されたBuildとScenarioの計算経路が、どの程度信頼できるデータで構成されているかを比較する品質指標です。

## 対象factor

- 武器Power / Speed / Area
- Attack Profile
- Powerから実ダメージへの換算、または入力した表示ダメージ
- AoE平均命中モデルと平均射程内敵数
- Build依存kill rate、平均敵HP、敵供給上限
- 被ダメージ、最大HPなどのScenario仮定
- 選択されたEnchantのtier値とstacking
- Void Strike時間曲線
- ArtifactのCooldown、Power別継続時間、効果量、stacking
- Radiance回復量や直接撃破率など、選択効果が実際に参照する値。直接撃破率はLeechingまたはGuarding Strikeを使うBuildで追加する

使用しないEnchantやArtifactのEvidenceは集計しません。

## 集計方法

confidenceを`high = 0.90`、`medium = 0.65`、`low = 0.35`へ写像し、計算結果への影響度に応じた重み付き幾何平均を取ります。

```text
coverage = exp（Σ weight × ln(confidence score) ÷ Σ weight）
```

Attack Profile、Power換算、Void Strike曲線など主要な計算境界は重みを大きくしています。幾何平均により、重要経路にlow Evidenceがある場合は、多数のhigh固定値で問題が隠れにくくなります。

表示ラベルは次の内部基準です。

- 高: 78以上
- 中: 55以上78未満
- 低: 55未満

数値はモデル改善前後の比較に使い、ゲーム内結果がその割合で正しいという解釈はしません。主なlow factorは「計算上の注意」に最大3件表示します。
