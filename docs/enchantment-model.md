# Enchantment選択・tier・stackingモデル

## Build内の表現

`Build.enchantments` はID配列ではなく、次の情報を持つ選択結果です。

```ts
interface SelectedEnchantment {
  enchantmentId: EnchantmentId
  tier: 1 | 2 | 3
  source: 'slot' | 'gilded' | 'built-in'
}
```

通常スロットは現在Tier III固定です。金色エンチャントはUIでTier I / II / IIIを選択でき、Enchant種類を変更しても選択中のtierを維持します。localStorage・JSON・Optimizerへ手持ちデータのtierをそのまま渡すため、Tier IをTier IIIとして評価することはありません。`built-in` は将来の固有武器効果を同じ計算経路へ載せるため予約しています。

## 対応12種のstacking（3種はPower範囲限定）

| Enchantment | 最大コピー | モデル |
| --- | ---: | --- |
| Critical Hit | 1 | non-stackable |
| Radiance | 4 | special（コピー別の回復量係数`100% / 75% / 50% / 25%`） |
| Leeching | 4 | special（追加コピーを約25%ずつ減衰） |
| Void Strike | 1 | non-stackable |
| Guarding Strike | 1 | non-stackable |
| Sharpness | 4 | multiplicative（Tier bonusの`Π(1 + b)`） |
| Unchanting | 1 | non-stackable（enchanted対象のみ） |
| Refreshment | 1 | non-stackable（直接撃破でPotion CD短縮） |
| Weakening | 1 | non-stackable（Wikiと依頼仕様、game-dataのstacking flagと矛盾あり） |
| Shockwave | 1 | non-stackable（Power 210–252） |
| Swirling | 1 | non-stackable（Power 210–263） |
| Thundering | 1 | non-stackable（Power 248–263） |

[Minecraft WikiのEnchant概要](https://minecraft.wiki/w/Dungeons:Enchantment)ではstackableな効果は通常3個、Enchantsmithで金色枠を含めると最大4個まで存在し得るとされています。個別ページでは[Void Strike](https://minecraft.wiki/w/Dungeons:Void_Strike)と[Guarding Strike](https://minecraft.wiki/w/Dungeons:Guarding_Strike)がnon-stackable、[Radiance](https://minecraft.wiki/w/Dungeons:Radiance)と[Leeching](https://minecraft.wiki/w/Dungeons:Leeching)がstackableとされています。

Leechingの追加コピーは約25%ずつ効果が下がるという既存モデルを維持します。Radianceは同じ幾何減衰を流用しません。[Minecraft Wiki](https://minecraft.wiki/w/Dungeons:Radiance)は発動率ではなく回復量側がstackすることを示し、[コピー別のコミュニティ実測](https://www.reddit.com/r/MinecraftDungeons/comments/he5bsy/some_weaponarmour_enchantment_stacking_numbers/)と[4コピーまでの報告](https://www.reddit.com/r/MinecraftDungeons/comments/udl2gv/would_this_be_60_radiance_chance/)では、累積回復量が1 / 1.75 / 2.25 / 2.5倍と報告されています。

Radianceの期待回復は次の式です。`tierHealMultiplier`は高い順に並べるため、Tier III + Gilded Tier IではTier IIIへ100%、Tier Iへ75%を適用します。

```text
Radiance HPS = hits/s × 20% × healPerProc
             × Σ（tierHealMultiplier[i] × [1, 0.75, 0.5, 0.25][i]）
```

発動率固定と回復量stackの方向は複数ソースで一致していますが、コピー別係数とTier混在時の優先順はゲームデータから確認できていません。このためstacking Evidenceは`confidence: low`を維持し、実測ソースと不確実性をnoteへ記録します。

## 計算とvalidation

- optimizerはmaxCopiesを超える候補を生成しない。
- 全候補がstacking違反になる武器は、黙って除外せず入力エラーにする。
- `evaluate`を直接使った場合も同じ制約を検証する。
- stack可能な回復Enchantは、各コピーのtier値を高い順に並べ、追加コピー係数を適用する。
- tier別の発動率、回復率、継続時間、最大倍率は`src/data/enchantments.ts`だけを信頼できるデータ境界とする。

Sharpness / UnchantingとPhase 2-1CのRefreshment / Weakeningは各tier内のtyped `effect: EnchantmentEffect` unionへ保持します。direct weapon bonus、potion cooldown on direct kill、enemy damage debuffを識別し、効果の欠落を黙って0にしません。既存5種のschemaは維持し、巨大なDamageEventへ移行せず段階拡張します。Sharpnessの通常Tier III＋金色Tier Iは`1.33 × 1.1`です。共通helperのsortは既存special stacking向けで、Sharpnessの乗算順序には影響しません。Unchantingは敵割合を参照し、詳しくは[直接近接modifier](./damage-modifiers.md)を参照してください。

RefreshmentのPotionStateは[potion-state.md](./potion-state.md)、Weakening coverageとstacking訂正理由は[enemy-debuffs.md](./enemy-debuffs.md)に記載しています。両方とも通常・金色枠を跨いだ2個選択はvalidationとOptimizerが拒否します。

Phase 2-1Dでtyped effectへcombo-finisher-damage / on-hit-proc-damageを追加しました。Shockwave / Swirling / Thunderingはnon-stackable（maxCopies=1）、Tier倍率とPower曲線を分離し、公開Power範囲外は0点にせず明示unsupportedです。[DamageEvent仕様](./damage-events.md)。
