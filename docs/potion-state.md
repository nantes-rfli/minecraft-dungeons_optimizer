# PotionState — Phase 2-1C

RefreshmentはHealth Potionの再使用時間を短縮します。汎用の回復倍率や直接DPS倍率としては扱いません。

## MechanicsとEvidence

2026-08-30に[dungeons.tools Refreshment](https://www.dungeons.tools/enchantments/refreshment)の1.17.0.0由来公開データを再確認しました。Tier I / II / IIIは直接撃破1回につき1 / 2 / 3秒短縮、STACKS No（最大1個）です。Tier・stackingはhigh confidenceです。

発動条件はRefreshment付き武器自体による直接撃破です。近接hitと遠距離projectileが該当し、今回のruntimeは近接だけです。公開mechanics proseは武器自体のkill、Shockwave・Swirling・Fireworks Arrowの除外を説明します。直接撃破条件はhighの独立Evidenceですが、すべてのproc/DoT（Fire Aspect・Thundering等）の除外リストは[既存community report](https://www.reddit.com/r/MinecraftDungeons/comments/1dml95h/enchantments_interfering/)由来のlow Evidenceを維持します。published proseをraw game-file field確認済みとは扱いません。

[Minecraft Wiki Health Potion](https://minecraft.wiki/w/Dungeons%3AHealth_Potion)は基礎CDを45秒、回復を最大HPの**約75%**としています。本文の直接取得はrobots制限があり、検索インデックスに収録されたUsage本文で再確認しました。`HEALTH_POTION_BASE_COOLDOWN`はhigh、近似量の`HEALTH_POTION_HEAL_FRACTION`はmediumとして、それぞれRefreshment Tierとは別のEvidenceを保存します。version固定の実機回復量を測定したものではありません。

## 計算と構造

```text
k = CombatState.directWeaponKillsPerSecond
  = min(enemySupplyPerSecond, aoeDps / averageEnemyHealth) × directKillShare × directDamageShare
r = RefreshmentのTier別CD短縮秒数（未選択なら0）
C = 45秒
H = maxHealth × 0.75
cooldownProgressRate = 1 + k × r
effectiveCooldownSeconds = C / (1 + k × r)
baseUsesPerSecond = 1 / C
estimatedUsesPerSecond = 1 / effectiveCooldownSeconds
incrementalHealingCapacityPerSecond = H × (estimatedUsesPerSecond − baseUsesPerSecond)
```

`derivePotionState()`は次の情報を`Evaluation.potionState`へ返します。

| Field | 意味 |
| --- | --- |
| baseCooldownSeconds | Health Potion固有の基礎CD |
| refreshmentReductionPerDirectKillSeconds | 選択Tierの撃破ごとの短縮 |
| directWeaponKillsPerSecond | 共通CombatStateからの直接撃破rate |
| cooldownProgressRate | 実時間1秒あたりのCD進行 |
| effectiveCooldownSeconds | 連続rate近似による推定CD |
| baseUsesPerSecond | Refreshmentなしの基礎使用頻度 |
| estimatedUsesPerSecond | Refreshment込みの使用可能頻度 |
| healPerUse | 1回あたりの概算回復容量 |
| incrementalHealingCapacityPerSecond | Refreshmentによる追加回復容量だけ |

例えば直接撃破1/秒・Tier III・最大HP100なら、進行速度4、CD11.25秒、使用頻度4/45回/秒、1回75、追加容量は**5 HP/秒**です。直接撃破0ならCD45秒、追加容量0。総撃破が存在してもdirectKillShare=0なら効果はありません。

`HealingMetrics.refreshmentPotionCapacityPerSecond`へこの差分だけを入れ、`totalPerSecond`、飽和healing Utility、スコア、Pareto比較、効果を外したcontributionへ接続します。基礎ポーション回復はすべてのBuildで加点しません。Refreshment未選択の既存スコアbaselineは維持します。画面の「回復・容量 / 秒」と内訳は**実回復ではないcapacity proxy**を含むことを明記します。

Sharpness / Unchanting / Critical / VoidによるDPS増加がkill rateを増やし、capacityへ伝わることはあります。RefreshmentからDPSへのfeedbackはありません。敵供給に達すれば追加DPSがkill rateを増やさない場合もあります。

## 仮定と将来の接続点

`REFRESHMENT_COOLDOWN_RATE_MODEL`は**low confidenceのcontinuous expected-rate approximation**です。一定rateの直接撃破がCD中も続き、再使用可能になるとすぐ使う定常状態を仮定します。ゲームのexact event simulationや保証された実回復量ではありません。

- 撃破時刻は本来離散的で、ready中の撃破短縮は蓄積されません。この近似は短縮の保存や持ち越しを実装しません。
- 飲まずに待つ時間、HP deficit、overheal、操作・アニメーション上限、遭遇開始時にreadyであること、戦闘終了を計算しません。高いkill rateや短い戦闘では容量を過大評価し得ます。
- directKillShare、敵HP、敵供給は既存low Evidenceです。Refreshment選択時も必ず集計します。
- Scenario.cooldownReductionはArtifact専用で、このstateには使いません。Mushroom等によるkill rate変化が間接的に伝わることはあります。
- `estimatedUsesPerSecond`と独立した基礎CD境界を、将来のPotion Barrier uptimeやHero's/Champion's Armor等から再利用できます。Food Reserves・Surprise Giftも将来候補ですが、今回はいずれも実装しません。

新規effectは`EnchantmentTierValues.effect`のdiscriminated unionに登録します。既存5種のscalar schemaは変更せず、Phase 2-1Bの直接modifierも同じtyped effect境界へ移しました。

Phase 2-1D以降は[damage channelの帰属proxy](./damage-events.md)を使います。proc追加で総killが増えても直接撃破へ加算せず、供給capではRefreshmentの容量が下がり得ます。procなしはdirectDamageShare=1で既存結果を維持します。
