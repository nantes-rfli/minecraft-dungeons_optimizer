# DPSモデルの独立回帰と誤差範囲

## 現在の結論

Phase 1-4は **partial**、full DPS regressionは **pending 0 / 5** です。2026-08-29の公開調査では10候補を監査し、eligible 0件、rejected 10件でした。不足を架空値、理論表、既存モデルの出力で補っていません。

監査のsource of truthは [`research/dps-regression-audit.json`](../research/dps-regression-audit.json) です。`npm run audit:dps` はschema、ID、source URL、採否理由、eligible条件、auditとruntime fixtureの1対1対応を検証します。

## 回帰scope

Optimizerのsingle-target DPSを、同じbuild・同じ条件で得たゲーム内観測DPSと比較します。Phase 1-4で分離したいのは、武器カード上の実damageが既知の場合のcombat model誤差です。そのため、すべてのruntime sampleで `observedDamagePerHit` を必須にし、Power Curveの誤差を混ぜません。

採用対象は次のいずれかです。

- single target dummy等のcontrolled measurement
- 公開動画から独立に集計できるframe / timestamp / damage sequence
- 公開されたtotal damageとduration
- 条件が完全に記録された複数run平均または十分長いreported DPS

同じ動画やrunの連続frameを複数sampleには分解しません。1 runは原則1 observationです。

## Eligibility

採用には最低限、次のすべてが必要です。

- 対応武器と表示damage（`observedDamagePerHit`）
- attack speed modifier
- 関連する全EnchantとArtifact（何もない場合は空配列）
- measurement durationとtotal damage、または直接reported DPS
- single-target条件とtarget armor / damage reduction
- game versionとその確度
- 公開sourceと、観測値の導出手順
- `complete`な再現性

次はfull DPS sampleとして禁止します。

- runtime model output
- dungeons.tools calculator output
- Wiki理論damage表だけから合成したDPS
- 既存Attack Profile・Void Strike curve・Power Curveから計算したDPS
- 定性的な強弱評価
- mobbing / target switching footage
- Power・Attack timing・Void Strike timingだけのcomponent validation

## Public measurement search

Reddit community tests、YouTube / video・frame analysis、Minecraft Wikiのmeasurement provenance、公開table / spreadsheet、その他のcontrolled testを検索しました。

| Source | Candidate | 判定 |
| --- | --- | --- |
| [Full weapon DPS list / methodology](https://www.reddit.com/r/MinecraftDungeons/comments/nd98db/) | Fighter's Bindings / Double Axe / Anchor | reject: run-level raw total不足、旧version、target reduction不明。hit countから再構成するとAttack timing validationとの独立性も失う |
| [Weapon DPS summary](https://www.reddit.com/r/MinecraftDungeons/comments/100lxg7/) | Fighter's Bindings / Double Axe family / Anchor | reject: 既存計算値の再掲。duration、target、version不明 |
| [Void Strike target-dummy table](https://www.reddit.com/r/MinecraftDungeons/comments/phyg2p/) | Fighter's Bindings | reject: damage-per-hitのcomponent testで、total damage / duration / DPSなし |
| [Fighter's Bindings single-target comparison](https://www.reddit.com/r/MinecraftDungeons/comments/s20ju8/) | Fighter's Bindings | reject: approximate DPSのみ。表示damage、duration、速度、完全build、target reduction、version不足 |
| [Manual weapon damage tests](https://kirokiro.cc/games/26709) | Fighter's Bindings / Double Axe | reject: launch-eraで、再現可能な入力条件とraw runが不足 |

合計は候補10、eligible 0、rejected 10です。Fighter's Bindings 0、Double Axe 0、Anchor 0で、verified 1.17.0.0 sampleも0件です。採用済みsampleはありません。

## Game version

targetはMinecraft Dungeons 1.17.0.0です。auditは `verified / probable / unknown` を保持します。旧版やversion不明でも監査候補としては残しますが、変更されたmechanicsを安全に除外できず、他の再現条件も欠ける候補は採用しません。

将来5件以上集まった場合は、overallに加えてfinal-version-only、武器別、mechanic別（plain / Critical Hit / Void Strike / attack-speed modified）を分けます。各scopeは独立に5件へ達するまで `insufficient samples` です。1〜2件のscopeを強い誤差範囲として表示しません。

## 集計方法

各sampleの符号付き誤差は次です。

```text
signed error = (predicted DPS - observed DPS) / observed DPS
```

5件以上で次を集計します。

- MAPE（平均絶対パーセント誤差）
- median absolute percentage error
- P90 absolute percentage error（nearest-rank）
- maximum absolute percentage error
- mean signed percentage error（bias）
- median signed percentage error

参考rangeは `predicted DPS × (1 ± P90 absolute error)` です。これは既存の実測誤差P90を使った経験的な参考範囲であり、**90% confidence intervalではありません**。5件未満ではrangeを返さず、UIに不足数を表示します。

サンプルを見てから合否閾値を都合よく変更しないため、将来の監視目標は事前に `MAPE <= 15%`、`P90 <= 20%`、mean signed error `-10%〜+10%` を参考値とします。ただしPhase 1完了そのものは根拠のない小さい誤差を要求せず、観測・表示・制約公開を条件とします。sampleが揃った時点で、公開observed値に対する悪化をCIで検出します。

## UIとEvidence coverage

結果画面とMethodologyは次を分離します。

- Evidence coverage: 計算経路の根拠coverage。正解確率ではない
- DPS実測回帰: end-to-endのempirical model error

現在は `公開条件を再現できる実測sample: 0 / 5` と表示し、予測rangeを出しません。availableになればsample数、MAPE、P90、biasと、選択buildの予測DPSに対するP90参考rangeを表示します。

## Target switchingとremaining uncertainty

Void Strike modelは同じtargetへの連続hitを前提にします。Boss / single targetには比較的適しますが、mobbingでtargetが切り替わると過大評価し得ます。Phase 1-4ではtarget-switch simulatorを実装せず、Phase 2以降の課題として残します。

残る不確実性は、公開sample size、game version、random proc variance、Void Strikeのexternal damage consumption、exact frame curve、attack-speed cap / modifierの実測、target armorです。Outlierが得られた場合は削除して精度を良く見せず、condition mismatch、version、reduction、missing effect、model limitationを先に調査し、除外理由をauditへ残します。

Phase 1-4ではcombat formulaをcalibrateしていません。**validation only; no calibration** です。
