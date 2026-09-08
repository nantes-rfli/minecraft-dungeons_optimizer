# ゲームデータの同一性・独立reader・処理経路の検証 — Phase 6.8

調査日: 2026-09-08。前提: [Phase 6.7](./game-data-capabilities.md)。アプリコード、既存parser、runtimeデータ、Gap・scoreは変更していない。

## 今回の結論

**静的な値だけでなく、Blueprintの処理・カーブ・参照を取得する道筋は、独立したreaderで実証できた。** 一方、追加ZIPと既存抽出物は完全に同じ内容ではない。重要効果のnative処理を復元できたわけでもないため、全面的なモデル置換を始める段階ではない。

- 47 PAKの索引と134,799エントリの格納データをチェックサム検証し、既存抽出物と比較した。
- 133,277ファイルはパス・内容とも一致。文字化けした名前の2ファイルも内容は一致。1,520ファイルは内容が異なる。
- 独立reader **UAssetAPI 1.1.0** で97アセットを読み、すべて読取→再直列化が元バイナリと一致した。その97組194ファイルは追加PAKとも一致。
- 809 Functionを命令列へデコードできた。前回の簡易probeで不一致だった63 Functionも含む。
- 前回の25数値は完全一致。4つのDataTableと、未対応だった4つのRichCurveのキーも読めた。
- キノコ、CriticalHit、防具倍率、遠隔武器などの参照・継承をnative境界まで追跡した。native側のPower/発動/合成/CD式は未復元。

## Phaseの現在地

| 区分 | 終了条件 | 状態 |
|---|---|---|
| 6.8A 追加PAKと既存データの比較 | 索引・payloadの検証、全パスの比較、差分の保存 | 完了。内容差を残したまま、同一と言える範囲を確定 |
| 6.8B 独立readerの代表検証 | 数値、非CDO、カーブ、関数、前回例外を別実装で検証 | 代表集合では完了。全アセット対応の完了ではない |
| 6.8C 参照・処理の代表追跡 | package/outer/親/Effect参照と関数の意味を確認 | 代表経路で完了。native実効値は未確定 |
| 6.8D native計算と実効挙動 | Power、HP、抽選、合成、CD等の処理を根拠付きで復元 | 未完了。現exeから読めるコードを確立できていない |
| 6.8E timing/notify等の残余検証 | 設定時間と実ヒット時間を結ぶ処理・条件を確認 | 進行中。[攻撃設定・通知の追加調査](./game-data-timing.md)を実施。実効時間との連結・実機検証は未完了 |
| 6.9 再設計判断 | 根拠付きMechanic表現と旧モデルを代表ケースで比較 | 未着手。runtime書き直しを開始しない |

Phase 6.8全体を完了とは扱わない。6.8A〜Cの成果は6.8D/Eに依存せず利用できる。

## PAKとの比較で分かったこと

入力はユーザー指定ZIP（SHA-256 `7ccae0f852b640d9d4c6161798fabbab3c0f3f99c2c8e6c204d9b91634a2e9a1`）から既にローカルへ配置したPAK。元ZIP・旧抽出物を上書きしていない。

47ファイルともfooterのversionは8、索引は暗号化あり。4 compression-name slotと1-byte compression indexを持つV8A配置として読めた。索引復号後のSHA-1、各entryとpayload headerの一致、格納payloadのSHA-1、展開後サイズを検証した。比較には展開後SHA-256を用いた。

初回は暗号化された非圧縮entry 51件でchecksum不一致になった。原因は調査probeが復号後の値をhashしていたことだった。**格納された暗号化bytesの宣言長分をhashする**よう修正し、51件も検証・比較が成功した。データ破損や不明なエラーとして放置していない。

暗号化形式の入口には公開情報のキー候補を使用したが、候補の投稿だけを正しさの根拠にはしていない。根拠は47個の索引checksum一致と全entryの構造・payload検証。鍵値はレポートやGitのファイルへ保存せず、ローカルprobeの環境変数で渡す。PAKの配置・構造の確認には[repakのfooter](https://github.com/trumank/repak/blob/master/repak/src/footer.rs)と[entry実装](https://github.com/trumank/repak/blob/master/repak/src/entry.rs)を参照した。

| 分類 | 件数 |
|---|---:|
| 索引エントリ（重複パスなし） | 134,799 |
| 同じパス・同じ内容 | 133,277 |
| 同じパス・異なる内容 | 1,520 |
| 名前が異なるが内容が一致 | 2 |
| 旧ツリーだけの.DS_Store | 7 |
| 最終の読取/検証エラー | 0 |

2ファイルは絵画素材名の `Måns` と `M†ns` の相違で、uasset/uexpのSHA-256は一致する。名前の修正・旧データの改名は実施していない。

1,520の差分は `.uexp` 990、`.umap` 523、`.ushaderbytecode` 4、`.bin` 3。**uassetヘッダーに内容差はない**（上の名前差1組は別扱い）。`Dungeons/Config/DefaultGame.ini` もバイト一致し、1.17.0.0という設定の一致は確認できた。ただし同じ版の設定があるだけで、すべて同一build・同一配布元・改変なしとは証明できない。

### 旧readerの「一致」だけでは足りなかった

内容差のあるuexp 990件のうち、uassetと対になるものは33組。残り957件は今回のuasset比較の対象外であり、umap関連の本文等を含む。33組は新旧双方をUAssetAPIで読み、66回すべてバイナリ往復一致した。

- Functionの命令列は33組すべて一致。
- CDOのDataは30組一致、3組不一致。
- 不一致のCDOはNavigationBar、UMG_Popup_Base、UMG_Popup_UpsellのUI用Textフィールド内の識別値。
- 既存readerでは33組すべて同じ結果だった。未対応TextPropertyなどの内容を保持できないためで、**部分解析結果の一致は元の値の一致を保証しない**実例になった。
- 他の差分はArrowVobbleComponent、MovieScene、BodySetup、MediaPlayer等の非CDO exportにも存在する。演出らしい名前でも無害と一括判定しない。物理・弾道への影響は未確定として残す。

今回選んだ97の代表アセットの194ファイルはPAKと旧ツリーがすべてバイト一致しているため、その集合の検証に新旧混在の問題はない。全体を新ZIP版で置き換えることはしない。

## 独立readerで何を確かめたか

[UAssetAPI](https://github.com/atenfyr/UAssetAPI)のNuGet安定版1.1.0を、ローカル専用.NET SDK 10.0.400で実行した。プロジェクトのnpm依存へ追加していない。readerへ渡したエンジン設定は`VER_UE4_22`。選択集合の97/97で`VerifyBinaryEquality()`が成功し、RawExportは0だった。

[公式の利用説明](https://atenfyr.github.io/UAssetAPI/guide/basic.html)は現行開発版を説明するため、実際に実行した1.1.0のパッケージ・DLL hash・エンジン設定を観測JSONに固定した。現行masterと同じ実装だとは仮定しない。

| 対象 | 確認結果 | この結果だけでは分からないこと |
|---|---|---|
| 前回24アセット25数値 | 元のfloat/int値、object、property名、array indexが一致 | 装備への付与・適用順序・実効倍率 |
| DataTable 4つ | 行数198 / 18 / 2 / 83と行名が前回と一致 | その表の実使用条件 |
| RichCurve 4つ | Default 5キー、Linear/Ramping/Smooth各2キー。時刻・値・補間方式・接線を取得 | 難易度/Power式への呼出関係と単位 |
| Function 809個 | ScriptBytecodeが命令列として得られる | 809個すべての意味を人が検証したわけではない |
| 前回の63例外 | 全件デコード成功、全件Netフラグあり、Extrasは10 byte | Extrasの全フィールドの意味は未解明 |

通常の代表関数ではExtrasが8 byte、前回例外の63件では10 byteだった。前回の固定12-byte後続領域という仮定（flagsを含む）が合わないことを説明できる。UAssetAPIもExtrasを未解釈のまま保存するため、**バイナリ往復一致を完全な意味解読と同一視しない**。

RichCurveの取得が可能になったので、カーブ値を手動の観測点だけで表現する必要があるか再検討できる。ただし今回のEndlessStruggle曲線を装備Power曲線として採用する根拠はない。

## 読めた処理と、その対象

### 敵の盾とプレイヤーの反射効果を区別できた

`BP_DeflectingWithShield.GetShield` は、GetOwnerの結果を`BP_IllagerTowerGuardCharacter_C`へcastし、成功側で`Shield.ChildActor`を返り値へ代入する処理だった。命令列、cast先のclass参照、メンバー参照を確認した。

これは敵の盾を取得する経路であり、プレイヤー用Deflectの確率式ではない。**asset名とOptimizerの効果名が似ているだけで同じentityに寄せない**ことを、モデル再設計時の要件にする。

### 音・粒子の処理は戦闘式から分ける

- ClaymoreのExecuteUbergraphではSwingSFX、StabSFX、PoundSFXを使うCreateSound2D呼出を確認。前回の手作業による音の初期化という判定を独立readerで裏付けた。
- PoisonCloudのGetImpactEffectでは、EffectMapのキー列挙、所有者のclass取得、ClassIsChildOf、Map_Findという流れを確認。SpawnImpactEffectではImpactParticlesのtemplateを設定する。毒のtickダメージ式として扱わない。
- Exploding/Acceleratingの短いExecuteUbergraphも命令列として読めたが、そこに主要な倍率や発動式はない。親/native側を調べる必要が残る。

## native境界まで追えた経路

FPackageIndexを名前だけへ変換せず、OuterIndexの連鎖からpackageを含む参照へ解決した。

- DeathCapMushroomInstanceの`Effect` → BP_DeathCapMushroomGameplayEffect → `/Script/Dungeons.DeathCapMushroomGameplayEffect`。
- BP_CriticalHit → `/Script/Dungeons.CriticalHit`。当該CDOにはCriticalDamageTypeタグがあり、発動率・倍率はない。
- BP_MeleeDamageBoost → `/Script/Dungeons.MeleeDamageBoost`。Multiplierは1.2999999523162842。適用処理はnative側で未確定。
- ScatterCrossbowInstance → BP_ArrowBaseRangedWeapon → `/Script/Dungeons.RangedWeaponGearItemInstance`。
- ScatterCrossBow_Arrow → BP_Arrow → BP_Projectile → `/Script/Dungeons.Arrow`。

Game側の親を実際に読み、nativeで止まった箇所を記録した。子にない値を0や推測のdefaultへ置き換えていない。ここから装備Damage/Power補正を得るには、native親の初期化や呼出引数を確かめる必要がある。

## 実行ファイルの調査限界

Shipping.exeはx64 PE32+。resource treeのVERSIONINFOを辿ってFileVersion/ProductVersionともに4.22.3.0を確認し、前回のsignature検索だけの状態から検証を進めた。これはゲーム版1.17.0.0の証明ではない。

entry pointは`.boot`内。先頭セクションのentropyは約7.988 bit/byteで、raw sizeとvirtual sizeにも大きな差がある。前回の主要class名5つのASCII/UTF-16検索は一致なし。この構造は圧縮/保護の可能性を示すが、製品名や方式は特定していない。

今回、nativeの計算関数を読み取れるコード領域と参照対応は確立できなかった。したがってPower、HP、CriticalHit、stack合成、CDの正式な式は得ていない。ファイル実行、起動時のメモリ取得、同梱DLLのロードは実施していない。配布物の真正性や同梱DLLの役割も未確認。

次のnative調査には、**検証可能な静的展開手順、または同版・由来を記録できる読み取り可能な実行ファイル**が必要になる。単に文字列が見つからないことを「仕様が存在しない」と扱わない。

## モデルへの判断

今回の成果は、全面書き直しの承認ではなく、次の設計要件を裏付ける。

1. **取得器の制限とゲーム仕様の不足を分離する。** Map、Text、RichCurve、Functionを旧readerが読めないことは、ゲームデータに情報がないことではない。
2. **同じ版名でもソースを識別する。** archive/hash、asset/hashを保持し、異なるファイルを無言で統合しない。
3. **効果の適用対象と参照経路を持つ。** player/enemy、native/Blueprint、計算/演出を分け、名前の類似で正規化しない。
4. **raw値・設定曲線・処理・Scenarioを分ける。** 設定値の取得を実効DPSや被覆率の確定に飛躍させない。

現時点では、ゲーム由来のDefinition/Mechanic層を拡充する方向が妥当。Optimizerの評価式を置換する範囲は6.8D/Eの証拠を待つ。未対応効果を0点登録したり、既存Gapを自動closeしたりしない。

## 保存・検証

[観測JSONと再現案内](../research/game-data-validation/README.md)に、PAK比較、独立reader、差分、参照、native境界を保存した。全索引・全件比較・デコードしたゲームデータ・試験コード・SDK・ライブラリはignoredの`local-game-data/phase6.8/`に保持する。

関連audit（extractor/model-alignment）、npm test（53ファイル・1,435テスト）、lint、buildが成功。新規観測JSONの件数・194入力ファイルのsource hash・代表値の照合結果・相対リンクも確認した。既存テストは新しい探索用readerの正しさを保証するものではない。

内部調査資料のみのためSites更新は不要。
