# Catalog / Inventory / Runtime / Evidence の分離

## 目的

OptimizerをResearch Questやnative解析の完了待ちにせず、現在のruntimeで安全に評価できる範囲を利用可能にします。監査済み装備の存在、所持、計算対応、根拠の確かさは別々の状態です。

## 状態軸

- Catalog: 既存の近接82、防具、遠距離、Artifact監査を正本とする。
- Inventory: runtime対応装備に加え、監査済みだが未対応の装備を`catalogItems`として保存する。
- Runtime Support: `Full / Limited / Unsupported`。旧`Research-only`はlegacy runtime support statusとして保持する。
- Evidence Status: parameter単位の`Verified / Measured / Derived / Estimated / Unknown`。

旧`Full`は「現在のscopeで通常実行できる」という意味だけを持ち、`Verified`への自動昇格は行いません。Unsupportedの所持品はOptimizer候補へ入れず、0点や中立倍率にも変換しません。

## Estimatedの利用

`Estimated`にはmechanic ID、parameter ID、根拠、適用条件、対象version、confidenceを必須とします。現在はDeath Cap MushroomとIron Hide Amuletのduration curve・duplicate refresh挙動を登録しています。

Optimizerでは次の2経路を選べます。

- 確度の高い情報のみ: Estimated parameterを必要とするArtifactを候補生成前に除外する。
- Estimatedを含める: 候補として評価し、選ばれたbuildで使用したparameterと根拠を結果へ表示する。

Unknownは候補生成・数値評価へ渡しません。Research Quest、外部Evidence、game files、native解析でEvidenceが更新されたparameterだけを個別に昇格させます。

## Migration

Inventory JSONはschema v3で`catalogItems`を追加します。v1 / v2は引き続き読み込み可能で、旧runtime配列を変更しません。監査・Evidence・Gap・履歴データも既存ファイルを正本として再利用します。
