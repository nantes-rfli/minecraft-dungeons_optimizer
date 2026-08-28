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

通常スロットは現在Tier III固定です。金色エンチャントは手持ちデータのtierをそのままBuildへ渡すため、Tier IをTier IIIとして評価することはありません。`built-in` は将来の固有武器効果を同じ計算経路へ載せるため予約しています。

## 対応5種のstacking

| Enchantment | 最大コピー | モデル |
| --- | ---: | --- |
| Critical Hit | 1 | non-stackable |
| Radiance | 4 | special（追加コピーを暫定25%ずつ減衰） |
| Leeching | 4 | special（追加コピーを約25%ずつ減衰） |
| Void Strike | 1 | non-stackable |
| Guarding Strike | 1 | non-stackable |

[Minecraft WikiのEnchant概要](https://minecraft.wiki/w/Dungeons:Enchantment)ではstackableな効果は通常3個、Enchantsmithで金色枠を含めると最大4個まで存在し得るとされています。個別ページでは[Void Strike](https://minecraft.wiki/w/Dungeons:Void_Strike)と[Guarding Strike](https://minecraft.wiki/w/Dungeons:Guarding_Strike)がnon-stackable、[Radiance](https://minecraft.wiki/w/Dungeons:Radiance)と[Leeching](https://minecraft.wiki/w/Dungeons:Leeching)がstackableとされています。

Leechingの追加コピーは約25%ずつ効果が下がるという公開検証値を使用します。Radianceはstack可能であることは確認できますが厳密な期待回復式に不確実性が残るため、同じ減衰率を低信頼度のmodel assumptionとして隔離しています。

## 計算とvalidation

- optimizerはmaxCopiesを超える候補を生成しない。
- 全候補がstacking違反になる武器は、黙って除外せず入力エラーにする。
- `evaluate`を直接使った場合も同じ制約を検証する。
- stack可能な回復Enchantは、各コピーのtier値を高い順に並べ、追加コピー係数を適用する。
- tier別の発動率、回復率、継続時間、最大倍率は`src/data/enchantments.ts`だけを信頼できるデータ境界とする。
