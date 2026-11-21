# Chains の限定 native 根拠（2026-11-15）

**他の適格な Chains 候補がない場合、主対象への Chains 適用も呼ばれない。** これは回収済み image の対象選択経路に対する結論であり、通常攻撃が1体だけに命中したことや `averageTargetsInReach=1` から導ける条件ではない。

基礎分岐は次の独立検証へ進める **READY**。Flail／Jailor の固有IDと固定レコードは新たに静的接続できたが、既存 Formal への採用、装備からの完全な dispatch、既存 Limited 契約への統合は **PARTIAL** のまま。新規 runtime 対応は **0**。

## 根拠と再現

- main baseline: `6bf212dc5ea8f686f981c9882657874264e41791`。
- image base `0x140000000`、recovered image SHA-256 `04a990ccbc67454505724a28043eccc595f613a0a877ae55386a4fa8656434d3`。
- `check_chains.py` は private image を hash 照合し、18関数区間のhash、12個の短い決定的命令区間、2個体のRaw property locatorを `chains-evidence.json` に生成する。ゲームbyte、private payload、全体decompilationは出力しない。
- `python3 -B research/native/coverage-20261114/check_chains.py --check` は保存JSONと再生成結果の完全一致を確認する。既存 `phase6.8/native-stage2/tools` のCapstoneを使用。`--local-root`でprivate data rootを指定可能。
- parent が別に作成した `independent_branch_review.py` / `independent-branch-review.json` は独立した11ケースの短いUnicorn分岐再生。query／engine return をstubせず、engine call前に停止する。こちらのstatic checkerとは別の検証層。

Rawとexeの同一build性・公式配布物としての真正性は未確定。Windows・実ゲーム・world全体queryを実行した証拠ではない。

## クラスと発火経路

UTF16 `UChains` (`0x33da240`) → 登録 `0x1be300` → getter `0xebec50` / builder `0xebbe80` → construction callback `0xebd300` → ctor `0xa484f0`。ctorがvtable `0x327c038` を設置する。slot `+0x3d8` は対象選択 `0xa66ad0`、slot `+0x3e0` はRNGでarmed flagを作る `0xa6ba90`。`0xe9a6c0 -> 0xef2e70` は親クラス登録であり、Chainsのctorではない。

対象選択は `+0x218` armed flag、primaryのclass、authority role結果3、`0xa5c270(primary)` の資格判定を通る必要がある。query `0x820ef0` の引数はprimaryと `+0x20c` radius。query内 `0x821000` のcandidate==primary比較で主対象自身を除外する。World/class iteration、predicate、距離の二乗との比較も残る。

候補配列を `0xa42470` が同じ `0xa5c270` でfilterし、`0xa42a60` がprimary相対にsort、`0xa44530` が上限 `+0x1f8 + +0x1d8 - 1` のprefixを作る。`0xa66bf6` のselected countが0なら `0xa66bfc -> 0xa66ca5` に分岐し、primary追加と適用callを飛ばす。非空なら `0xa66c20/24` でprimaryを追加して `0xa66c95 -> 0xa74f00` に進む。

したがって「当該queryが完了し、他の適格な候補を返さない」という明示条件下ではno-callが成立する。未確認効果を便宜上0にしたものではない。周囲の別mob、味方、召喚物、既存Chains状態、無効対象が関わる条件を単体モデルから推測してはならない。

資格判定にはcandidate classification/lookup、owner actorのvirtual `+0x900` のfalse、`0xe4ade0 -> 0x7c30f0` と `0xc1eb20 -> 0x7c2560` のtrue、`StatusEffect.Chains` のabsence、target `+0x84` mask `0x04` のclearが必要。各関数の役割を「敵」「生存」「免疫なし」と命名する完全な意味接続は未完なので、これらを勝手に緩和しない。

Ctor既定値はbase neighbor count `+0x1f8=2`、chain間隔引数候補 `+0x1fc=0.1f`、tier factor `+0x200=1.0f`、別class用値 `+0x204=4.0f`、random threshold `+0x208=0.3f`、radius引数 `+0x20c=1200.0f`。radiusはnative空間単位であり、m／blockへ換算していない。`0xa7aa70` はsigned tierをbinary32へ変換し `+0x200` を乗算する。適用側の `0xa7518e..0xa7519c` は値をset-by-callerへ渡すが、最終duration、refresh、timer、耐性の全面式は未確定。これらはno-neighbor no-callの根拠には不要。

## 2個体の正しいIDと固定効果

| Catalog | 正しいraw ID | Native catalog function | Raw locator |
|---|---|---|---|
| Flail | `Mace_Unique2` | `0x165c10` | `part-018.json.gz#/packages/33` |
| Jailor's Scythe | `SoulScythe_Unique1` | `0x173b40` | `part-020.json.gz#/packages/13` |

2関数とも `ItemType` namespace、ID key、英語display名を同じcatalog構築で束ねる。Flailのkey/displayは `0x32cdd48` / `0x32cde10`、Jailorは `0x32d1340` / `0x32d1368`。さらに各関数が `DL=0x18, R8D=1` を `0xad9f70` へ渡す。helperはrecord `+0` にID、`+4` にtierを書き、wrapper `0xad9fb0`、20byte strideのarray copy `0xb67390` を経てcatalog `+0x70` に入る。enum table `0x3414a60` は文字列 `EEnchantmentTypeID::Chains` と値 `0x18` を持ち、UChains ctorも `+0x1dc=0x18` を設定する。これは両個体のnative固定Chains Iレコードの静的根拠である。装備適用からclass生成までの全dispatchを連続再生したとは主張しない。

Rawは両方の `ItemIdName` と `ItemId.SerializedId` が上記IDと一致。正しい個体自身のconfigured attack rowsはFlail damage81/81/175、duration約.44/.44/.77、Jailor damage80/80、duration約.48/.56。双方のVariantActiveEffect/VariantChangeEffectはserialized null。これらはconfigured値であり、実際の最終damageやcycleを確定するものではない。

**古いicon seedのordinalを採用しない。** `Mace_Unique1` は既存受理sourceではSun's Grace、`SoulScythe_Unique2` はFrost Scythe。Flail/JailorのRaw catalogSeedsは今もambiguousで、この古い候補を含む。現在のFormal identityAssertionsには2件とも存在しない。今回のnative identityは新規研究根拠として保存し、既存Formalを無断更新していない。

## 次の最小作業

次の研究PR候補は、上記2件の正しいidentityと固定Chains Iを独立照合し、有限の「他の適格Chains候補なし」契約を設計すること。単体近接の既存入力だけで満たしたことにしない。完全combo観測値・基本cadence・速度効果制限・Soul gathering等の既存Limited条件を別に保持する。装備対応を実装する場合はidentity受理・固定効果dispatch・契約の拒否条件を先に検証する。今回の依頼範囲ではruntime実装、PR、merge、Site変更をしない。
