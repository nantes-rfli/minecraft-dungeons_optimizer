# Phase 8A / 8B — Evidence Intake and Limited DR Reassessment

調査日: 2026-09-10。Phase 8Aの受入・保存・検証基盤を実装し、Phase 8Bの最初の単位として35% Armor + Iron Hide + Guarding Strike（direct mob attack）を再評価した。runtime昇格・Gap closeは0。

## 8A

受入契約はSourceRevision、claim、game version、装備ID/Power、条件、単位、反復、raw observation、画像/動画/本文locator、external/self origin、calibration/holdout区分を保持する。構造不正は拒否し、不足・競合・転載・訂正・同一originのcalibration/holdout混用を理由コード付きで判定する。revisionは追記のみで、旧revisionとchanged fieldsを残す。JSON保存後の再読込では全判定を再計算してdriftを検出する。

今回の2件は完全な検証票ではないためquarantineとして保存した。これはEvidenceを捨てず、不足を既知値に変換しないためである。

## 8B acquisition

- [2026年のDR説明](https://www.reddit.com/r/MinecraftDungeons/comments/1w4c05n/damage_reduction/)は、Iron Hide/Potion Barrierを加算EHP群、Guarding Strikeを別乗算とする。Phase 6.9のShin由来とは別originだが、game versionとraw hit列がない。
- [Iron Hide Amulet](https://minecraft.wiki/w/Dungeons:Iron_Hide_Amulet)は8→4と36,000→18,000の単独testを掲載する。編集・test origin、version、Power、frame列が不明で独立holdoutには使わない。

第二originの式説明と単独値は追加できたが、選択した三効果組合せの独立raw traceは得られなかった。出口は**保留**。Ghost + Guarding競合とDynamo配置は対象外のまま解決していない。

## Queue reassessment

Phase 6.6のhandoff 1307件（Observe 303 / Measure 498 / Experiment 506）を元IDのまま照合し、現在のremaining 2088件を完全にpartitionした。

| Disposition | Count | Meaning |
|---|---:|---|
| external-resolved | 0 | 外部Evidenceだけで元のclose条件を満たす |
| limited-measurement | 5 | 外部資料で範囲は狭まったが限定実測が必要 |
| implementation-missing | 271 | Evidenceでは代替できない実装不足 |
| hold | 1812 | 今回の単位外、または元protocol/公開調査/目的判断を維持 |

外部解消0件を明示し、新EvidenceだけでGapをcloseしない。次はdamage-reduction-composition protocolで版1.17.0.0、同一攻撃、単独・pair・三効果、3独立run×各10 hit以上を取得して8Cへ渡す。
