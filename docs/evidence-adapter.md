# Phase 6.9C — Evidence adapter

2026-09-09。研究用adapterを実装。runtimeへの組み込み・昇格、Gap closeは0。

`src/research/evidenceAdapter/model.ts`はSourceRevision、Claim、ClaimRelation、AdoptionDecisionと、従来の`Evidence<T>`への変換を提供する。既存`Evidence<T>`・evaluate/optimize・Inventory・Worker・scoreは変更しない。

## 保存と移行

`research/external-community/evidence-ledger.json`に31 source revision、15 claim revision、6 relation、15 research-only採用判定を保存。元の13 claimを保持し、Growing Staff訂正報告に含まれる旧6.3・訂正4.3を2 claimとして明示した。訂正は同じguide内だけに適用し、別条件の4.43へ適用しない。旧slideの独立取得を意味しない。DRの4例はfamily式からのderived-from、Dynamoの分類衝突は条件重複unknownとして記録。

sourceのhashは**保存済みregistry sourceレコードのJSON**を識別し、取得していないremote本文のhashではない。ゲーム版・entity mapping・単位等の未確認情報を推定で補わない。版は論理IDと正整数revision、参照は版固有IDで固定する。更新時は旧台帳レコードを消さず新しいrevisionを追加する。既存生成器は初回移行専用であり、将来の追記時には旧レコードを保全する生成器へ変更する。

## 変換と拒否

`toLegacyEvidence(ledger, request)`へdecisionの版固有ID、entity、property、purpose、gameVersion、conditionsと値型のtype guardを渡す。成功時は従来のvalue/source/confidence/noteだけを返し、noteにclaim・decision・全source revisionを残す。代表sourceはclaimの先頭source、confidenceは明示的な採用判定から取り、引用数で引き上げたりscoreへ掛けたりしない。

- research-only、blockerあり、回帰未成功、旧decision revisionを拒否。
- 採用用途・ゲーム版・entity/property・条件は完全一致を要求。limited/fullとも宣言したdomain内に限定し、範囲推論は未実装。
- null・非有限値・入れ子の未知値・単位不明・未確認sourceを拒否。真の0は保持。
- 不正参照、重複ID/論理revision、導出/訂正の循環を検出。
- 同条件の訂正先は新規採用不可。部分/未知の訂正や矛盾は未解決として拒否。derived-fromの依存先にも検査を適用。
- `assertIndependent`はcalibration/holdoutのsource originと導出・訂正の祖先を照合。同じ由来と由来不明を拒否。supportsの本数を独立実測数に換算しない。

このAPIは型付きの内部台帳用で、任意のユーザーJSONを受け入れる公開parserではない。採用判断・回帰成功はレビュー済みレコードを前提とし、adapter自体がゲーム内精度や独立性を証明するものではない。

## 再現と次工程

`npm run generate:evidence-adapter`で初回移行台帳を再生成、`npm run audit:evidence-adapter`で再現性・全件runtime拒否・DR例のholdout拒否を監査する。ネットワーク・raw assets不要。`tests/evidenceAdapter.test.ts`は合成fixtureで採用成功、旧形式、真の0、異常系を検証する。

次は6.9Dのattack/event比較。HPS条件とentity mapping、aggregate-rateとevent-sequenceの区別を進める。6.9E以降の検証やruntime昇格はこの実装の完了に含めない。アプリからimportされない研究module・台帳・test・script・文書のみの変更なのでSites更新対象外。
