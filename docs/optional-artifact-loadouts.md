# Artifactを外した構成も比較する

最適化画面の「Artifactを外した構成も比較する」を有効にすると、所持Artifactから0〜3個を装備する全構成を比較する。Inventoryは変更しない。保存した条件にも選択を保持し、最適化・用途別評価・ドロップ追加前後の比較は、それぞれの条件に従う。

たとえばCutlass / Pickaxe / Soul Knife / Whip / Great Hammer / Whirlwind / Stormlanderは、現在の根拠では基本速度限定である。Mushroomを必ず使う構成は拒否されるが、この設定ならMushroomを外した合法構成も探索できる。単体対象、Soul KnifeのRanged制約、固定Built-in、各proc Power範囲、Voidや速度効果などの既存制限は維持する。

## 探索と保存の契約

- `Scenario.includeUnequippedArtifacts`はoptional boolean。省略・falseは従来どおり最大3個を選ぶ経路であり、旧結果・順序・出力形式を保持する。trueだけが探索範囲を広げる。
- trueでは最大装備数から0個へ順に全ての部分集合を列挙する。同点時に既存の最大装備数の構成を先に扱い、重複した個体IDを作らない。
- 所持数nに対するArtifactの上限推定は `Σ C(n,k), k=0..min(3,n)`。nが0〜5なら1 / 2 / 4 / 8 / 15 / 26通りである。除外前の全InventoryとEnchant候補から見積もり、安全上限25,000通りを探索前に適用する。上限の引上げや探索の省略は行わない。
- 用途別評価は条件ごとに予算を判定する。ある条件が上限を超えても、別の予算内の条件を評価できる。全条件が上限超過なら実行しない。ドロップ比較も、各保存条件自身の設定で追加前・追加後をそれぞれ確認する。
- 省略とfalseは同じ評価入力として集計し、trueは異なる探索条件として扱う。保存条件schema v1と既存WorkerのScenario転送を使う。新しいInventory schemaやゲーム効果の値は追加しない。

## Fail-closedと評価可能性

未装備は明示された既知の選択肢である。trueの探索では、対応Power範囲外のArtifactは既存の型付きエラーを理由に選択肢から除外する。Shock Powderの重複構成は既存のEvidence判定で除外し、単独使用を含む合法構成を比較する。計算中のエラーは探索失敗として伝える。

評価済み個体は、計算が成功した合法候補に実際に含まれたものだけである。一部の組み合わせが失敗しても、他に合法な構成がある個体を未対応と誤分類しない。外した後の構成だけが成功するArtifact自身は、評価済みにはならない。Research-only装備の登録はこの設定で昇格しない。

ArmorやRangedの未装備探索は追加しない。ArmorのHP権限やRanged時間配分には別の意味上の境界があり、このArtifact選択の拡張には含めない。ゲーム式・Runtime装備数・Evidence分類・R3/P3Bの採用数も変えない。

基準mainはPR #229統合後の `afa15f022e09ae331dbef0415deaaf776e65d43b`。実装と検証の記録は対応PRを参照する。
