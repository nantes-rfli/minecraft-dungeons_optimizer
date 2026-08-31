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
- Radiance回復量や直接撃破率など、選択効果が実際に参照する値。直接撃破率はLeeching・Guarding Strike・Refreshment・Rampagingのいずれかを使うBuildで追加する

使用しないEnchantやArtifactのEvidenceは集計しません。

Sharpness / Unchantingのtier値とstackingはhigh、Unchanting対象条件もhighです。Unchanting選択時だけ`enchanted-enemy-share`と`unchanting-mixture`（各low）を追加し、割合0でも選択中なら根拠を示します。SharpnessまたはUnchantingと別の直接ダメージmodifierを併用する場合は、独立期待値の合成`direct-weapon-composition`（low）を追加します。Tierの高信頼度で未検証interactionや敵割合の仮定を覆い隠しません。詳細は[damage-modifiers.md](./damage-modifiers.md)を参照してください。

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

## Phase 2-1Cの条件付きEvidence

Refreshment選択時はTier・直接kill条件（high）、間接kill除外リスト（community由来low）、Health Potion基礎CD（high）・約75%回復（medium）、連続rate近似（low）、直接撃破割合（low）を分離して集計します。追加回復容量を実回復と断定しません。

Weakening選択時はTier・周囲への適用・5秒duration（high）、対象incoming damage割合（low）、資料間で矛盾するstacking（medium）を追加します。Guarding / Iron Hide併用時だけ独立した時間平均の合成（low）を追加します。未選択BuildへWeakening割合の低信頼度を混ぜません。

## Phase 2-1Fの条件付きEvidence

Artifact SynergyはTier・next-attack・non-stackableをhigh、使用頻度・pending capacity 1・最適分散・profile hit/action近似・Committed前のdirect合成を個別のlow factorとして追加します。不使用Buildへ混ぜません。

RampagingはTierをhigh、copy duration/shared triggerをmedium、直接kill帰属・Poisson refresh・速度加算・平均速度の線形cadenceをlowとして保持。固定点のhighは数値的整合性だけで実測精度ではありません。Fighter's Bindingsのframe上限やon/off分布の未対応も説明します。Echoはruntime不使用のため評価factorへ追加しません。[監査と制限](./temporal-enchantments.md)。
