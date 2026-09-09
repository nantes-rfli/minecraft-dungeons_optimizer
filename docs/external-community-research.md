# 外部コミュニティ研究の整理と追加調査 — 2026-09-09

## 方針と今回の到達点

ユーザーの方針変更に従い、外部研究の取得・条件照合を優先する。Phase 6.8D/Eのnative解析は保留し、取得済みgame assetsを照合材料として再利用する。native復元を再設計開始の必須条件にしない。

添付 `mcd_external_community_research_summary.md` は調査の入口として扱った。資料中の推薦・取得済み表示は作業指示や今回の検証結果に読み替えない。元資料のSHA-256と全URLの索引を[台帳](../research/external-community/registry.json)に保持した。

成果は32 source、15件の個別claim、HPS 55行×4条件、再現可能な研究用モデル比較、[再設計ADR](./adr/0001-external-evidence-model-redesign.md)。runtime昇格・新規Gap closeは0。これは「全外部研究を回収済み」でも「モデル置換完了」でもない。

## 取得状態を分ける

| 状態 | 意味 |
|---|---|
| content-reviewed | 本文・コメント・説明欄の関連部分を確認。画像全件や動画の実測まで確認した意味ではない |
| data-extracted | 公開表のセルを取得し数値を保存。測定法・ゲーム版の確認とは別 |
| index-only | ページ・資料の入口を確認。本文の数値根拠として未使用 |
| retrieval-failed | 今回の取得はtimeoutなどで失敗。不在・非公開とは断定しない |
| lead-only | 添付の索引を整理した段階。今回未確認 |

Google SheetsとYouTubeはweb readerだけでは取得できなかったため、公開CSV/XLSXと公開HTMLを読み取り専用で取得した。ログイン、Discord参加、研究者への連絡、非公開資料へのアクセスは行っていない。ネット取得はこの調査時だけで、通常auditは保存JSONを使う。

## 追加確認で重要だった点

### HPS表は実体を取得できた

[Redditの紹介コメント](https://www.reddit.com/r/MinecraftDungeons/comments/1u8yqtg/dps_mod/)のリンク先は、添付された[Google Sheets](https://docs.google.com/spreadsheets/d/1S90t9lTPIGhpcllATfRUniFnsBy-gqB7R_nBkUPSK1k/edit?gid=0)と同じIDだった。Pancakecatへの帰属はanotherraaltの説明であり、所有者情報による確認ではない。

Sheet1の55 data rowsを取得。列はBase Hps、25% Armor Hps、Death-cap Hps、Hps with both、Power **263**基準のdamage説明。CSVとXLSXの56×6セル（header込み）を照合し一致した。取得したXLSXにformula cellは0、owner・更新日時のmetadataはなく、ゲーム版・fps・測定法・反復数も未確認。値が定数であることは「実測値である」証明にはならない。

[HPS数値snapshot](../research/external-community/hps-observations.json)は元の行・label・4条件を保持する。55は武器数ではなくグループ行数で、同じSawbladeが異なるmetricで2回現れる。全82武器への自動展開や同familyの無条件共有はしない。damage説明の全文は転載せず、混入条件を記録した。

| 表の対象 | Base | 防具25% | Death Cap | 両方 | 解釈上の注意 |
|---|---:|---:|---:|---:|---|
| Anchor | 0.42 | 0.52 | 0.84 | 0.94 | 平均値からキャンセル点やhit列は復元できない |
| Claymore群 | 1.1 | 1.3 | 2.2 | 2.4 | game-file設定時間を実効intervalと同一視しない |
| Fighters Bindings | 6.8 | 8.5 | 13.6 | 15 | 一律2.25倍で全表示値が一致するわけではない |
| Sawblade enchant機会 | 4 | 4 | 4 | 4 | damage頻度と別metric |
| Sawblade damage | 6 | 6 | 6 | 6 | overheat cancel条件の記述あり |

Sawbladeの4/sと6/sは**表にそう記載されている**というclaim。[6.8Eの設定](./game-data-timing.md)にある約0.15秒と6/sの相違を誤差と決めつけない。設定・実効tick・解放・overheat・proc eligibilityの対応を追加確認する。

既存runtimeとのBase HPS比較（差は `表 / runtime − 1`）:

| 武器 | runtime | 表 | 相対差 |
|---|---:|---:|---:|
| Anchor | 0.4 | 0.42 | +5.00% |
| Double Axe | 1.666667 | 1.6 | −4.00% |
| Fighters Bindings | 6.956522 | 6.8 | −2.25% |
| Soul Scythe | 1.923077 | 1.8 | −6.40% |

これは独立実測に対するモデル誤差ではなく**資料間の数値差**。丸め、条件、測定法、共有元を確認するまで平均して採用しない。per-hit profileを平均HPSの逆数へ置き換えると、Void・finisher・CCの情報が失われる。

Damage欄はbuilt-in Crit、Committed、Smiting、Enigma等を平均化済みの行や、間接ダメージを含む行がある。neutral base damageとして取り込むと二重計上する。添付のMaster's Katana例も `(651,813×2+958,549)/3 = 754,058.33` であり、904,870には約1.2倍が含まれる。built-in Critの平均化が候補だが、その元投稿は今回取得できず、原文の条件が確定するまで転記を採用しない。

### 作者訂正を追加で確認

[2023 SS guide](https://www.reddit.com/r/MinecraftDungeons/comments/10jvyk4/weapon_statsenchants_guides_1_ss_tier/)では、ShinkuNYがGrowing StaffのHPSを**6.3→4.3**と訂正していた。さらにFighter's Bindingsの推奨組合せにRadianceを書き忘れたと説明している。前者は数値訂正、後者はbuild adviceの訂正として区別する。

[A guide](https://www.reddit.com/r/MinecraftDungeons/comments/10k4ak9/)のSoul Siphon旧説明の訂正も確認。未回収だった[BL guideの入口](https://www.reddit.com/r/MinecraftDungeons/comments/10jvzb0/weapon_statsenchants_guides_2_bl_tier/)を取得した。画像を保存するだけではコメントの訂正を取り逃す。元claimを消さず、訂正関係と適用条件を持たせる。

同じSS guideのEncrusted Anchor説明にはVoidのphysical +175%、poison +81%、overall +140.8%がある。これはchannel分離の根拠候補だが、平均HPSだけから3つの値を再現したとは扱わない。

### DRには具体的な式と動画導線がある

[ShinkuNYのDRコメント](https://www.reddit.com/r/MinecraftDungeons/comments/1bsib6o/)は逆数換算したarmor値の加算を説明し、Potion Barrierをarmor側、Guarding Strikeを別乗算側として明示していた。6.9A/B時点では未取得だった[本人の検証動画](https://www.youtube.com/watch?v=CiD2YIL1nMY)と[表投稿](https://www.reddit.com/r/MinecraftDungeons/comments/ptddv6/)を6.9Eで追加確認し、条件・未使用行・競合は[DR / Modifier比較](./dr-modifier-comparison.md)へ分離した。

コメントを一般化した**研究側の候補式**:

```text
armorScore = Σ r_i / (1 − r_i)
damageTaken = 1 / (1 + armorScore) × Π (1 − separateReduction_j)
```

| 同時に有効な効果 | 投稿のDR | 候補式のDR |
|---|---:|---:|
| 防具35% + Iron Hide50% | 60.6% | 60.6061% |
| 上記 + Guarding Strike50% | 80.3% | 80.3030% |
| Potion Barrier90% + Iron Hide50% | 90.9% | 90.9091% |
| Potion Barrier90% + Guarding Strike50% | 95% | 95% |

4例とも丸め精度内で一致。ただし**同じ作者・同じ投稿の算術整合性4件**であり、独立した実測4件ではない。Protection・Ghost Cloak・Shulker・Weakening・Gongまで自動一般化しない。非線形なので、uptimeを先に効果量へ掛けず状態ごとのdamageTakenを計算してから平均する。

### Modifier分類にはDynamoの衝突が残る

[Shin FTW動画](https://www.youtube.com/watch?v=3adc9uaDUUo)の説明欄を公開HTMLから取得できた。physical加算、physical乗算、間接、Focus、全体倍率の区別、Sharpness自己stack、jungle poison、Fireworksの例外が記載される。これは説明欄の回収であり、全interactionの動画実測ではない。

一方、[2026 DPS投稿](https://www.reddit.com/r/MinecraftDungeons/comments/1u8yqtg/dps_mod/)は `Full × [(1+Additive)×(Base×Multiplicative+Dynamo)+Indirect]` を提示する。2021説明で間接側に列挙されるDynamoが式では別の位置にある。両者を同じ規則として結合せず、version差・近接/遠距離差・不具合利用・言葉の定義を確認する。全効果を単一式へ当てはめる段階ではない。

### Committedは既存式を確認し、有限hitの課題を絞った

[2026再解析](https://www.reddit.com/r/MinecraftDungeons/comments/1ucj2v1/)の `1/ln(2)` は、Tier III・満タン敵・直接攻撃のみ・連続極限なら数学的に再現できる。既存の[Committed実装](../src/core/enemyStateDamage.ts)と[設計](./enemy-state-damage.md)はすでにこの1.442695...倍を採用している。36.8%固定から直す作業は不要。

研究用の離散比較では、HP100・hit60なら2hit→2hitで攻撃予算あたりの撃破効率の増加は0%、hit45なら3hit→2hitで50%、hit150なら1hit→1hitで0%。3hit→2hitの攻撃回数自体の削減率は33.3%であり、効率増加率と分ける。したがって44.27%は有限hitの普遍的上限でもなく、常に「ここから約5%引けば実戦値」でもない。比較は同一敵HP・同一hit条件で、攻撃回数の節約とraw damageを分ける。

このprobeは固定damage・1対象・Crit/procなし・丸めなし。`N/HPS`という攻撃時間予算と、初撃t=0での`(N−1)/HPS`という撃破時刻を別々に返す。実戦のkill rate、target switching、HP分布を再現する完成モデルではない。

## 調査の次順と採用条件

| 優先 | 対象 | 次の取得・照合 | 終了条件 |
|---|---|---|---|
| P0 | HPS / hit / proc機会 | 55行のentity mapping、Shin各slide+訂正、既存Wiki timingとの条件照合 | 同条件比較と不一致理由を記録。平均HPSだけならaggregate用途に限定 |
| P0 | DR family | 特定した本人動画から装備・active状態・被damage対照を採取 | 非線形合成とfamilyを未使用の観測点で検証。uptime重複条件も分離 |
| P0 | damage modifier | 2021分類の例外、Dynamoの2026式との差、jungle poison | effect×channel×triggerのeligibilityと合成順を条件付きで確定 |
| P1 | Void / Committed | 速度条件・hit列・開始HP・有限encounterを対応 | 数式の正しさ、観測への適合、scenario期待値を別判定 |
| P1 | Healing / CC | Radiance/Leeching/Stunning原本とproc/kill条件 | damage hit数・抽選機会・final-blow ownership・overhealを分離 |
| P2 | Ranged | Pancakecat crossbow原図、発射周期・矢数・glitch条件 | projectile/shot/impactを分離。glitchは通常モデルへ混入しない |

これは今回の研究順であり、既存Phase 6の数値Priority scoreを再生成したものではない。ShinとPancakecat、Wiki、引用投稿が同じ元測定を使っていれば独立票に数えない。GitHub briefは二次索引、Tierは評価意見として扱う。2021原本やDiscord限定原本の入手を全体の前提にはしない。

## 保存・再現

- [source / claim台帳](../research/external-community/registry.json): 添付全URL、今回の確認範囲、locator、未確定条件。
- [HPS snapshot](../research/external-community/hps-observations.json): 55行の数値・4列・元行番号・export hash。
- [モデル比較](../research/external-community/model-comparison.json): DR丸め整合性とCommitted有限hit例。独立ゲームEvidenceではない。
- [DR / Modifier比較](../research/external-community/dr-modifier-comparison.json): 6.9Eの限定family/state、same-origin holdout、channel・競合・順位感度。
- [Scenario / Optimizer比較](../research/external-community/scenario-optimizer-comparison.json): 6.9Fのfinite hit、final-blow ownership、目的・duration感度、再現性・性能境界。
- `npm run generate:external-community`: 保存claimから研究用モデル比較を再生成。
- `npm run audit:external-community`: 参照・重複・取得状態・未昇格・行とmetric・比較結果driftをoffline検証。
- `npm run audit:scenario-optimizer-comparison`: finite event、ownership、未知候補除外、rank感度、再現性、性能をoffline検証。
- `tests/externalCommunityResearch.test.ts`: 既存runtimeとの数学比較、HPS差、非線形uptime、入力エラーと有限hitの境界。

公開データを再取得する場合はGoogle Sheetsの同一IDに対する`export?format=csv&gid=0`と`export?format=xlsx`を使い、Sheet1・header・行数・数値型・CSV/XLSX一致を検証する。変更された表は旧snapshotへ上書きせず、新revisionと差分を作る。保存hashは今回取得したbytesの識別子であり、オンライン原本が将来も同じである保証ではない。公開表・動画・投稿の著作物全文やローカルgame raw assetsはコミットしない。

## 検証結果

2026-09-10: 6.9F完了時に`audit:external-community`、`audit:evidence-adapter`、`audit:attack-event-comparison`、`audit:dr-modifier-comparison`、`audit:scenario-optimizer-comparison`が成功。`npm test`は58 files / 1,473 tests成功、`npm run lint`、`npx tsc -b`、`npm run build`も成功。buildは500 kB超chunkの警告とroute静的分類の制限を表示したが終了成功。アプリのbundle分割は今回の調査範囲に含めない。

変更対象は内部Markdown・research JSON・開発script・test・CIとaudit用npm script。runtime・配信設定・依存パッケージは変更していないためSites更新を省略。新しいauditはCIにも追加した。
