# Artifact stackingモデル

## 方針

現在の時間バフ2種の複数装備は、効果量と稼働時間を分けて扱います。`ArtifactDefinition.stacking`は次の挙動を持ちます。新しいArtifact familyへ時間バフのstackingを一般化しません。[Phase 2-2Aの型・activation・将来のstate設計](artifact-model.md)を参照してください。

- `stack`: 同時発動時に効果量が重なる。
- `refresh`: 効果量は重ならず、後から使うと継続時間を更新する。
- `independent`: 各インスタンスが独立した効果として動く。
- `non-stackable`: 複数装備を入力エラーにする。

現在対応するDeath Cap MushroomとIron Hide Amuletは、どちらも低信頼度の`refresh`です。同種を交互に最適使用すると仮定し、個別の`duration / cooldown`を合計して最大100%で丸めた値をグループ稼働率とします。

```text
combined uptime = min(1, Σ individual duration / effective cooldown)
```

## Death Cap Mushroom

- 攻撃速度増加は有効中+100%で固定する。
- 2個使用しても+200%にはしない。
- 複数個は交互使用によって稼働率だけを高める。

[Minecraft Wiki](https://minecraft.wiki/w/Dungeons:Death_Cap_Mushroom)掲載のPower 37・66・124・145の継続時間をGolden Testに使用します。

## Iron Hide Amulet

- 被ダメージ軽減は有効中50%で固定する。
- 2個使用しても50%軽減を二重適用しない。
- 複数個は交互使用によって稼働率だけを高める。

[Minecraft Wiki](https://minecraft.wiki/w/Dungeons:Iron_Hide_Amulet)掲載のPower 12・15・104の継続時間をGolden Testに使用します。

## 不確実性

同種の一時効果が更新され、効果量は重ならないという挙動はコミュニティ検証に基づきます。ゲーム内フレーム計測が未実施なので`confidence: low`とし、同時押し・発動遅延・入力ロスは現在の平均稼働率に含めません。

将来`CombatState`を導入する際は、Artifact ON/OFFを別々に評価して時間平均できるよう、個別稼働率とstacking groupの両方を`ArtifactEffects`へ保持しています。
