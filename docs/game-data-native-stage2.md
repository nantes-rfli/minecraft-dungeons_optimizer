# Phase 6.8D — native起動処理の条件付き追跡

2026-09-09。調査資料のみ。アプリコード・runtimeデータ・既存Gapの判定は変更していない。

最初の圧縮層を復元した[前回の調査](./game-data-mechanic-boundaries.md)から進め、CPUエミュレーションで起動処理のAPI呼び出しと条件分岐を追跡した。**PCのSMBIOS情報を要求する箇所まで到達したが、ゲーム本体のコード領域や戦闘式の復元には至っていない。** 「核心まであと少し」と判断できる証拠はまだない。

今回の成果は、止まっていた間接分岐を追跡可能にし、native側の環境依存を具体的に切り分けたこと。設定の抽出可能性とは別に、nativeロジックの復元には起動環境と制御フローの検証が必要だと分かった。Phase 6.8D/Eは進行中を維持する。

## 入力と実施範囲

- 入力exeは追加ZIPから取り出した同一ファイル。SHA-256は `eab80a0ba0c3c4c1bbae6e0e40ed8ada5dc26bf3008b7385579168b793bf0eb8`。
- `.dungeon` への入力は前回、独立した2つのdecoderで一致した15,360,000 byte。SHA-256は `d68e1bdf0e4ac23427d9978198a9b459183ad75b34666ca1ea298689e99d925b`。
- 開始VAは `0x144e7c95f`。Unicorn 2.1.4でゲストCPU命令をエミュレートし、Capstone 5.0.6で必要な命令を確認した。**今回は純粋な静的解析だけではない。** Windowsのゲームプロセスは起動せず、実Windows DLLのロードやホストOSへのWindows API転送も行っていない。
- 仮想メモリ上に最小限のTEB/PEB、スタック、DLLのexport表、API応答を用意した。ホストPCのウィンドウ・権限・ファームウェア情報をゲームへ渡していない。
- 元exe、メモリ出力、解析用スクリプトと依存ライブラリはGit管理外の `local-game-data/phase6.8/native-stage2/` に保存。Gitには[観測JSONと再現索引](../research/game-data-native-stage2/README.md)だけを追加する。配布物の真正性は引き続き未検証。

## どこまで進んだか

| 到達点 | 観測 | 解釈の範囲 |
| --- | --- | --- |
| CPUのみ | 425命令でGS経由のTEB参照に停止 | Windows用のスレッド環境が必要 |
| 最小TEB/PEBを追加 | 310,305命令でRDTSCに停止 | 時刻に依存する命令がある |
| 初期の時刻モデルを追加 | 712,183命令で未解決importに停止 | `GetModuleHandleA` の呼び出し先が必要 |
| 仮のexport表を追加 | 989,523命令で `LoadLibraryA("user32.dll")` に到達 | 入口からDLL探索までの制御フローを追える |
| 6 DLLの名前表と限定APIモデル | `GetThreadContext` まで58 API呼び出し・34種類 | 起動時の環境確認を観測。停止したAPIも件数に含む |
| 文脈値の比較実験と追加のプロセス情報モデル | `GetSystemFirmwareTable` まで64 API呼び出し・37種類 | SMBIOSサイズ問い合わせで停止。返却データは作っていない |

前半の命令数は逐次トレーサーで計測した値。後半は速度改善のため基本ブロックの記録を最初の120,000訪問で止めており、これを実行全体の命令数・ブロック数とは扱わない。後半のイベント総数66はAPI 64回とRDTSC 2回の合計。

Wineの公開export定義からkernel32 / user32 / ntdll / advapi32 / shell32 / shlwapiの名前表を作成した。登録名はそれぞれ1,269 / 788 / 1,421 / 517 / 280 / 308件。これは関数探索を可能にする仮の表であり、WindowsのDLL実装や特定バージョンの正確なexport表を再現したものではない。[Wineの定義例](https://github.com/wine-mirror/wine/blob/master/dlls/kernel32/kernel32.spec)

## 起動・保護に関係すると考えられる処理

呼び出し列には、スレッドを開く処理、作業ディレクトリ・コマンドラインの参照、例外ハンドラの登録、トークンとSIDの照合、管理者状態の問い合わせが含まれた。さらに以下を観測した。API名と引数は仮のDLL表へ到達した時点の値であり、Windows実機で採取したトレースではない。

- `VirtualProtect` が仮の `ntdll.DbgUiRemoteBreakin` / `DbgBreakPoint` の領域を指定した。仮のstubページへのゲスト書き込みを3回記録。実DLLは読み込んでいない。
- `ZwSetInformationThread` が現在スレッドの擬似ハンドル、情報クラス `0x11`、空のデータで呼ばれた。調査モデルでは属性設定の成功だけを返した。
- 一時的な例外ハンドラ `0x144ee7423` の登録後、`RaiseException(0xc000008e, 0, 0, NULL)` を観測した。
- `GetThreadContext`、`CheckRemoteDebuggerPresent`、`ZwQueryInformationProcess` のクラス7と `0x1e` が順に呼ばれた。

この並びから、現段階は起動時の環境確認・保護処理に相当すると推定する。特定の保護製品名、配布元による改変の有無、ゲームの戦闘処理との関係は確定しない。

例外については単に無視して先へ進めず、限定した `EXCEPTION_POINTERS` / `CONTEXT` を作り、登録されたゲストハンドラを呼んだ。その結果は `0xffffffff`、用意したCONTEXTの変更byte数は0。調査モデルではこの場合だけ呼び出し元へ復帰した。ただし実Windowsの例外発生位置・完全なCPU文脈・ハンドラ探索・unwindを再現したものではない。[例外の仕様](https://learn.microsoft.com/en-us/windows/win32/api/errhandlingapi/nf-errhandlingapi-raiseexception)、[EXCEPTION_POINTERS](https://learn.microsoft.com/en-us/windows/win32/api/winnt/ns-winnt-exception_pointers)

## 重要な境界：GetThreadContext

観測した引数は現在スレッドの擬似ハンドル `0xfffffffffffffffe` とバッファ `0xa0010000`。ContextFlagsは `0x100010`、AMD64のデバッグレジスタを求める設定だった。[フラグ定義](https://github.com/wine-mirror/wine/blob/master/include/winnt.h)

Microsoftは、現在スレッドを対象とするGetThreadContextは成功を返すものの、返却contextは有効ではないと説明している。そのため「デバッグレジスタは0になる」と仕様から確定できない。[GetThreadContext](https://learn.microsoft.com/en-us/windows/win32/api/processthreadsapi/nf-processthreadsapi-getthreadcontext)

ここで止める基準実験を保存したうえで、分岐を調べるために3つの**反実仮想の応答**を比較した。実際のWindowsの挙動やユーザーの環境を表す値ではない。

| 応答 | バッファの読み取り | 結果 |
| --- | --- | --- |
| 成功、Dr0/1/2/3/6/7を0 | `+0x48 / +0x50 / +0x58 / +0x60` を各8 byte読む | 4つのアドレスレジスタを調べる経路 |
| 成功、Dr0だけ `0x12345678` | `+0x48` を8 byte読む | 次の基本ブロックから異なる経路へ進む |
| 失敗、バッファを保持 | 上記範囲を読まない | 別経路で先へ進む |

読み取り命令は共通して `0x144e6a8da`。バッファ位置はx64 CONTEXTのDr0〜Dr3と一致する。[CONTEXT構造](https://learn.microsoft.com/en-us/windows/win32/api/winnt/ns-winnt-context)

3条件とも、デバッガー未接続という追加の仮定では `ZwQueryInformationProcess` クラス7まで進んだ。しかしDr0を変えた条件では `.dungeon` の出力hashが異なり、0条件と失敗条件の出力hashは一致した。**同じAPI境界へ到達したことは、内部状態の一致や正常な復元を意味しない。** その状態が後の展開鍵や終了判定へどう使われるかは未解析。

## 最後のチェックポイント

Dr0等を0とする診断条件に、次の限定応答を加えて先へ進めた。

- `CheckRemoteDebuggerPresent`: 仮の現在プロセスにはデバッガーが接続されていないという応答。
- `ZwQueryInformationProcess` クラス7: ProcessDebugPortを0、返却長を8とした。クラス7の意味はMicrosoftの説明に基づく。[NtQueryInformationProcess](https://learn.microsoft.com/en-us/windows/win32/api/winternl/nf-winternl-ntqueryinformationprocess)
- クラス `0x1e`: デバッグオブジェクトがないという仮説で、空のhandleと `STATUS_PORT_NOT_SET` を返した。これはWineの公開実装を参考にした限定モデルで、対象Windows版での検証はしていない。[Wineのprocess実装](https://github.com/wine-mirror/wine/blob/master/dlls/ntdll/unix/process.c)

続いて `GetSystemFirmwareTable(0x52534d42, 0, NULL, 0)` で停止した。これは `RSMB`、すなわちraw SMBIOSの必要バッファ長を求める呼び出しに該当する。SMBIOS本体の読み取りや、その後の利用目的はまだ確認していない。[GetSystemFirmwareTable](https://learn.microsoft.com/en-us/windows/win32/api/sysinfoapi/nf-sysinfoapi-getsystemfirmwaretable)

この地点の `.dungeon` はSHA-256 `f991a4e0b28c36e2469817bab6bc9d283a64077838c8adca807dcfbd4fae30d5`。これを「展開済みゲーム本体」とは呼ばない。

## 検証と制約

基準実験とSMBIOS境界までの実験をそれぞれ再実行し、経過時間を除く観測JSON全体と出力hashの一致を確認した。同じモデルでの再現性を示す検証であり、独立したWindows実行との一致検証ではない。

PEの全16セクションを**名前ではなくindexとRVA**で識別し、初期配置後と停止時のhashを比較した。空白8文字の名前が8セクションで重複するため、名前だけをキーとする初期の集計を修正して再実行した。今回の観測JSONは修正後の結果だけを採用している。

- 全条件で変化したのはindex 13の `.dungeon` だけ。他15セクションは初期配置後の状態と一致。
- 初期の `.idata` には仮のIATを設定済み。従って、元exeとの完全一致を主張していない。
- 14セクションは元ファイルのraw bytesとゼロ埋めから独立にhashを再計算し、初期値と一致。残る `.idata` は仮IAT、`.dungeon` は検証済みの前段出力という別の入力条件を持つ。
- ゲスト書き込みを記録した187ページのうち186は `.dungeon`、1は仮のDLL stub。ヒープ等はこの書き込みページ集計の対象外。
- `.dungeon` より前の元イメージ領域 `0x140000000–0x144bb7fff` に命令実行が移れば停止するhookを設けたが、今回の条件では到達しなかった。

なお、初期イメージはRWX、TEB/PEBは最小構成、DLL forwarderと実ordinal、API内部のレジスタ変化、OS objectの完全な寿命管理は未再現。RDTSCは既知の1箇所だけをモデル化した。CPUID・SYSCALL・割り込み・不正メモリアクセスでは停止するが、他の環境依存命令をすべて個別検出する保証はない。未対応のAPIもその場で停止する。仮の通常ユーザー権限・言語・時刻などは観測値と分けて扱う。

アプリに影響するソースは検証済みの `02b073e` から変わっていないため、1,435テスト・lint・buildの成功結果を再利用する。今回はprovenance・model alignment・gap reconciliationの3 auditを再実行して成功。再実行比較・入力hash・16セクション比較に加え、保存した観測とローカル証拠・リンクの整合を検証した。内部調査のみのためSites更新は不要。

## Optimizerへの意味と次の到達条件

今回新たに確定した戦闘式・閉じたGapはいずれも0。ダメージ、Power補正、効果の加算・乗算、cooldown、通知の受信、実効hit列はまだnativeから検証できていない。APIを何個通過したかを効果のcoverageへ加算しない。

Phase 6.8Dの作業を次の到達条件に分ける。

1. **D-1：最初の圧縮層の復元 — 完了。** 前回の独立decoder一致を再利用する。
2. **D-2：起動処理から元のコード領域への移行 — 進行中。** 次はSMBIOS応答の利用箇所と、環境確認で変わった内部状態の使われ方を追う。仮の成功応答だけを増やさず、失敗・差分条件と比較する。元領域への書き込み・移行と、その出力を検査可能な形で保存できることを到達条件とする。
3. **D-3：ゲームの関数を同定し式と条件を抽出 — 未着手。** 復元領域をアセットのnative親・クラス・設定の使用経路へ結び付ける。文字列が出ただけで成功にしない。代表効果から呼び出し・入力・分岐・定数を確認する。
4. **D/E検証：nativeとアセットを接続 — 未完了。** Claymore / Chainsword / Anchorの設定が実際のhit列へどう適用されるかを独立に検証する。

Phase 6.9のモデル比較案は、既に取得できる設定・関数参照・発動契機と未確認の実効値を分ければ進められる。ただし今回の起動処理の追跡を理由に全面再実装へ移る判断はしない。
