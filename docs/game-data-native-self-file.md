# Native解析再開 — 自己exe読み取りと計算式候補

調査日: 2026-10-22。基準main: `8fd4bde40f42d1aeee2571d441d8b6214e1c3046`。

今回は従来の静的スキャンを繰り返すだけでなく、停止していた `CreateFileW` の先を条件付きCPUエミュレーションで追跡した。自己exeのマッピングと実際の読み取りまで進んだ。並行して、旧版由来と明記されたPower計算式と公開SDKのクラス名を発見した。**手元の1.17.0.0で戦闘式を確定した結果ではない。** 全成果をresearch-onlyとし、Application、Formal、runtime support、Gap判定へ昇格させていない。

## ローカルで新しく観測したこと

入力exeは従来と同じSHA-256 `eab80a0ba0c3c4c1bbae6e0e40ed8ada5dc26bf3008b7385579168b793bf0eb8`。配布元の真正性は未検証のまま。Windowsのゲーム起動や隣接DLLのロードは行わず、ハッシュ確認済みexeのバイトだけをUnicornの読み取り専用メモリへ渡した。

| 呼び出し | 戻り先RVA | 観測・限定モデル |
| --- | --- | --- |
| `CreateFileW` | `0x50dea6c` | 直前に取得した自己exeパス。GENERIC_READ、FILE_SHARE_READ、OPEN_EXISTING、属性0x20。指定パス以外は停止 |
| `CreateFileMappingW` | `0x50d5b1d` | PAGE_READONLY、最大サイズ0、名前なし |
| `MapViewOfFile` | `0x50dde55` | FILE_MAP_READ、offset 0、長さ0。37,613,072 byteの同一exeを仮想アドレス `0xc1000000` に配置 |
| `GetFileSize` | `0x50e02cb` | 同じ入力の実サイズを返す |

両条件で、RVA `0x4cf723c` の `mov r15d, dword ptr [r15]` がファイルビューを読むことをメモリフックで確認した。続く `0x4cf723f` は `add dword ptr [r12], r15d` とデコードされる。先頭256回のサンプルは4 byte読みで、観測範囲はoffset 0〜1039。その範囲で `0x240`、`0x248`、`0x298`、`0x29c` を読んでいない。これらは入力PEのSizeOfImage、CheckSum、Security Directoryの2 dwordに対応する。ファイル検査・集計処理の候補だが、ループ全体、比較値、成功条件、チェックサム方式を確定したとは扱わない。

サンプル採取は256回で停止する。最後のサンプル位置は実行全体の最終読み取り位置ではない。

## 条件差と旧モデルの訂正

| 条件 | SMBIOS応答 | API件数（停止境界を含む） | 結果 |
| --- | --- | ---: | --- |
| `self-file-legacy` | 旧条件を維持: サイズ4096、書き込み4096、戻り値80 | 83 | 自己exe読みに到達、実行上限で停止 |
| `self-file-consistent` | Type 1＋127の合成fixtureを89 byteとして問い合わせに応答 | 78 | サイズが0xff未満の経路に入り、buffer-fill呼び出しなしで同じ自己exe読みに到達 |

旧モデルのSMBIOSサイズと返却長は不整合だった。今回は比較のためそのまま残す条件と、サイズ・書き込み・返却長を一致させる条件を明示的に分けた。後者ではfill自体が呼ばれていないため、fixture内容の解析成功を主張しない。

また、`RegOpenKeyA` は3引数であり、旧記録の `accessMask` は第4レジスタR9を誤って意味付けしていた。新記録はR8を `outputHandlePointer` として保存する。旧ファイルは履歴証拠として変更せず、この訂正を適用する。[MicrosoftのAPI仕様](https://learn.microsoft.com/en-us/windows/win32/api/winreg/nf-winreg-regopenkeya)

記録した最終再実行は各条件1 slice。1 sliceの上限は5億命令または60秒であり、実行命令数を5億と断定しない。先行の6 slice探索と時間上限のみの追加探索でも自己exe読みに進んだが、これらはローカルの途中記録として保持し、最終再実行と混ぜてhash・件数を比較しない。両条件とも変更セクションは13番 `.dungeon` のみで、元のゲーム本体領域への命令実行は観測されなかった。全mapped imageもローカル保存したが、これは合成環境の途中状態であり、展開完了ダンプではない。実行上限による停止はハング・クラッシュの証拠でもない。

## 見つかった計算式の候補

[MCD-PEのItemPowerStats](https://github.com/Minecraforever/MCD-PE/blob/be646dcd82a689e24709b7abd4cff30fb60b7c9f/_re/systems/item/source/game/item/power/ItemPowerStats.cpp) は、先頭で1.8.0.0由来の復元ソースと宣言している。作者による最終版のクラス照合という説明は、演算内容の一致を証明しない。公開ミラーの真正性も独立確認していない。

旧ソースの候補を実数演算として整理すると、内部Powerを `x` として次の形になる。

```text
q = (x - 1) / ((99 / 170) * 18)
E = 0.75 * 1.25^(19 * clamp(q, 0, 3)) + 0.25
L = 1 + (2.6 / 17) * 18 * q
```

| 対象 | 旧ソースから得た倍率候補 |
| --- | --- |
| ダメージ | `1 + 2 * max(E - 1, 0)` |
| 最大体力・回復 | `1 + max(E - 1, 0)` |
| 被ダメージ | `0.25 + 0.75 / (1 + max(L - 1, 0))` |
| 効果時間 | `1 + 0.25 * max(L - 1, 0)` |
| クールダウン | `0.5 + 0.5 / (1 + 0.33 * max(L - 1, 0))` |

19は旧ソースの難易度3種×Threat 7段階−重複2段階から得た値。現在版の定数として採用していない。上記は絶対ダメージや絶対秒数ではなく倍率で、対応する基本値と呼び出し側の確認が別途必要。

[表示Power処理](https://github.com/Minecraforever/MCD-PE/blob/be646dcd82a689e24709b7abd4cff30fb60b7c9f/_re/systems/item/source/game/item/power/ItemPowerUtil.cpp) の候補は `floor(1 + 10 * max(x - 1, 0))`。したがって表示Powerだけでは内部値を一意に定められない。旧式の例として内部値10.9は表示100、ダメージ倍率約81.74085、体力倍率約41.37043になるが、これらは現行ゲームの実測値ではない。floatの丸めも再現していない。

この候補により、無差別に係数を推測する代わりに、内部Powerを固定した低・中・高Powerの比率、上限付近の指数部分、線形部分、表示の丸めを分けて検証できる。エンチャントのCooldownや効果スタック全体をこの式だけで説明してはいけない。

## 新しい識別名と外部資料の限界

[公開SDK](https://github.com/zH4x-SDK/zMCDungeons-SDK/blob/ab9d8f0ab04b215577dd2eb067e65015b5a70521/Cpp/SDK/Dungeons_classes.h) から `ItemPowerMeleeDamageModCalculation`、`ItemPowerRangedDamageModCalculation`、`ItemPowerHealthModCalculation`、`ItemPowerArmorDamageModCalculation`、`ItemPowerUtil`、`MeleeAttackComponent` 等を探索語にできた。ただしヘッダの別ゲーム名、サイズ0のクラス、空の引数wrapperなど品質上の問題があり、layoutや外部offsetは採用できない。

これら15識別名を、exe・Stage1・今回の2 mapped imageにASCII/UTF-16LEで照合したが、完全一致の平文は見つからなかった。これは符号化済み識別名や後続処理で生成される名前を否定しない。旧来の「公開SDKを発見できなかった」は過去の探索範囲の記録として扱い、今回の新発見で補足する。

[MCD-PEの手順](https://github.com/Minecraforever/MCD-PE/blob/be646dcd82a689e24709b7abd4cff30fb60b7c9f/_re/TECHNICAL_PROCESS.md) はWindows上の実プロセスから読み取る別経路を報告している。ただしその入力はentry RVA `0x5ad8058`、Stage1 RVA `0x4c00000`、15,564,800 byteで、手元の入力と一致しない。掲載OEP・アドレスを転用していない。配布スクリプトは実行せず、ゲームバイナリも取得していない。

## 次に証拠を増やす手順

1. 今回特定した読み取り・加算位置の前後で、カーソル、加算先、終了条件と比較先を記録する。ループの結果が入力exeから独立再計算できると確認してから、エミュレーション短縮の可否を判断する。未知の判定を成功扱いして飛ばさない。
2. 別経路として同一buildのWindowsメモリcaptureを取得できる場合、exe SHA-256、実ロードbase、section RVA、実読取byte数、各hashを同時保存する。外部スクリプトの固定ASLR baseや部分readをそのまま信用しない。
3. 同一buildのreflection/registrationからPower計算クラスの関数ポインタと呼び出し元を結び、旧式の定数と演算を確認する。独立したゲーム観測との照合までruntime昇格しない。

## 証拠と再現

- [ローカル継続観測](../research/native/self-file-continuation.json)
- [外部候補・commit固定出典・検証入力](../research/native/external-native-candidates-20261022.json)
- [再現コマンド](../research/native/README.md#self-file-continuation-2026-10-22)

ゲームexe、生メモリ、外部ソース本文はGitへ追加しない。モデルの境界テストとNative artifact validatorを実行する。サイト表示・配信成果物への変更はないためSite反映は不要。
