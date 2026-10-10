# Catalog / Inventory / Runtime / Evidence の分離

## 目的

OptimizerをResearch Questやnative解析の完了待ちにせず、現在のruntimeで安全に評価できる範囲を利用可能にします。監査済み装備の存在、所持、計算対応、根拠の確かさは別々の状態です。

## 状態軸

- Catalog: 既存の近接82、防具、遠距離、Artifact監査を正本とする。
- Inventory: runtime対応装備に加え、監査済みだが未対応の装備を`catalogItems`として保存する。
- Runtime Support: `Full / Limited / Unsupported`。旧`Research-only`はlegacy runtime support statusとして保持する。
- Evidence Status: parameter単位の`Verified / Measured / Derived / Estimated / Unknown / Unclassified`。

旧`Full`は「現在のscopeで通常実行できる」という意味だけを持ち、`Verified`への自動昇格は行いません。Unsupportedの所持品はOptimizer候補へ入れず、0点や中立倍率にも変換しません。

## Estimatedの利用

`Estimated`にはmechanic ID、parameter ID、根拠、適用条件、対象version、confidenceを必須とします。Death Cap MushroomとIron Hide Amuletのduration curve・duplicate refresh挙動に加え、装備種別を問わず実際のbuildが使う推定parameterを登録します。

Optimizerでは次の2経路を選べます。

- 確度の高い情報のみ: 明示的に`Verified / Measured / Derived`へ分類されたparameterだけを許可する。
- Estimatedを含める: 候補として評価し、選ばれたbuildで使用したparameterと根拠を結果へ表示する。

`Unknown / Unclassified`はどちらの経路でも候補生成・数値評価へ渡しません。`Full / Limited`からEvidence statusを推定しません。Research Quest、外部Evidence、game files、native解析でEvidenceが更新されたparameterだけを個別に昇格させます。

既存runtimeを一括で`Derived`にはしません。武器のinternal Power・area・attack timing・hit sequence、Enchantのproc chance・倍率・stackingなど、実際に参照するparameterを分け、登録sourceと個別auditから根拠を説明できる値だけを`Measured / Derived`にします。runtime実装は残しても、未再評価のparameterは`Unclassified`のまま評価対象外です。

## Migration

Inventory JSONはschema v4で`catalogItems[].research`に実物のEnchant / 金色Enchant、Armor固有値、観測値を追加します。v1〜v3は引き続き読み込み可能で、旧runtime配列を変更しません。Catalogの監査済み固有値と個体別の研究属性はResearch Questの準備判定に利用できますが、Runtime supportは別軸のままです。監査・Evidence・Gap・履歴データも既存ファイルを正本として再利用します。

## Runtime拡張時の独立した2経路（ADR 0002）

- **A: New Mechanic Promotion** — 新しい式・未採用parameter・未検証interactionは、R3 accepted、P3B、独立Product regression、atomic promotion bundleを従来どおり要求。LimitedをVerifiedへ昇格しない。
- **B: Existing Limited Mechanic Reuse** — 既存Limitedモデルの適用装備を増やす場合は、targetのIdentity、source付きparameter値/version、mechanic/channel/scope/継承関係、donor固有効果の非継承、未検証compositionの拒否、対象別Evidence宣言、support manifest、正/負/preservation testがすべて必要。適用範囲外はAへ戻す。

`ARMORS`へ数値を加えることはEvidence採用を意味しない。既存7件/16 non-neutral parameterのDerived宣言を別台帳に固定し、未登録・値driftの新parameterはUnclassifiedとして直接評価/Optimizerの両経路で拒否する。BによってR3 accepted/P3Bのpromoted数を増やさない。詳細とThief Armor審査は[ADR 0002](./adr/0002-limited-runtime-reuse.md)に記録する。
