# Void Strike 公開測定auditとruntime model

## 結論

Phase 1-3では、旧`1x → 7x / 3秒` proxyを、公開仕様とcommunity測定を根拠にした**Decision B**へ置換した。

```text
application hit: t = 0, 1.00x
armed:          t > 0, 1.25x minimum
ramp:           1.25x → Tier III 7.00x at 3.6 s (linear best-supported model)
plateau:        3.6 s ≤ t < 5.0 s, 7.00x
expiration:     t ≥ 5.0 s, 1.00x; that hit reapplies Void Strike
```

`frame-measured`ではない。完全なframe seriesは公開されておらず、3.0秒・約3.5秒・3.6秒という報告が競合するため、curve全体のconfidenceは`low`である。公開raw dataとmechanics evidenceはruntimeから独立した[`research/void-strike-audit.json`](../research/void-strike-audit.json)へ保存した。runtime curveからfixtureを生成していない。

## Source hierarchyと監査結果

| Mechanics | 結論 | Coverage | Confidence | 主な根拠 |
|---|---|---:|---:|---|
| Tier maximum | melee Tier I / II / IIIはtotal 3x / 5x / 7x | verified | high | dungeons.tools 1.17 data、Minecraft Wiki |
| Application hit | 最初のhitは通常damageを与え、effectを付与 | probable | medium | Wikiの付与・reset記述、target-dummy testのfirst-hit基準 |
| Minimum | armed後の次frameから約1.25x | probable | medium | 複数community説明と高速武器測定 |
| Ramp duration | 約3.0〜3.6秒。runtimeはfinal-version寄りの3.6秒 | probable | low | 2021 target-dummy test、2023 timing discussion |
| Ramp shape | steady/linearが最有力だが完全frame seriesなし | uncertain | low | game description、community議論（反対報告あり） |
| Expiration | 約5秒で消滅、max後にplateau | probable | medium | 複数community mechanics report |
| Weapon-hit reset | 現在倍率をhitへ適用後、Void武器ならreset/reapply | verified | high | Minecraft Wiki、community test |
| External consume | melee / ranged / pet hitは消費。間接damageとDoTに例外 | partial | medium | Wiki、community test |
| Tier scaling | 1.25x minimumを共通にし、残りをtier maxへscale | uncertain | low | 全tier連続攻撃表から整合するmodel assumption |

主要source:

- [dungeons.tools enchantments](https://www.dungeons.tools/enchantments): 1.17.0.0由来のtier値と「rises steadily」というゲーム内説明。
- [Minecraft Wiki: Void Strike](https://minecraft.wiki/w/Dungeons%3AVoid_Strike): melee / ranged tier、weapon-hit reset、other meansによる消費。
- [2021 target-dummy damage table](https://www.reddit.com/r/MinecraftDungeons/comments/phyg2p/): Fighter's Bindings / Whirlwind、全tier、複数attack speedの数値。3秒max・さらに1秒という報告。
- [2023 numeric timing discussion](https://www.reddit.com/r/MinecraftDungeons/comments/16o226x/): 1.25x minimum、0.057秒のBindings、0.86秒のAnchor、3.6秒max。linear / nonlinearの見解が競合。
- [2023 mechanics test](https://www.reddit.com/r/MinecraftDungeons/comments/15xk3z1/): 約3.5秒max、5秒消滅、melee / ranged / pet消費とindirect damageの例外。

game implementation由来の正確なcurve parameterや、再現可能な公開frame-by-frame datasetは発見できなかった。一般的な「slow weaponに有効」という説明はmeasurementとして採用していない。

## Raw/public measurements

JSONには、時間が公開されていない連続攻撃のdamage表も`elapsedSeconds: null`で保持する。Attack Speed ratingから時刻を逆算せず、未知値を捏造しない。

| Sample | Tier | Public timing | Observed total multiplier | Runtime pointへの使用 |
|---|---:|---:|---:|---:|
| Bindings base speed (2021) | I | unreported | 約1.325x | no |
| Bindings base speed (2021) | II | unreported | 約1.421x | no |
| Bindings base speed (2021) | III | unreported | 約1.475x | no |
| Bindings +125% speed (2023) | III | 0.057 s | 約1.25x | no; independent validation |
| Anchor +125% speed (2023) | III | 0.86 s | 約2.75x | no; independent validation |
| Tier III maximum (2023) | III | 3.6 s | 7x | yes; endpoint |

2021 tableは3秒でmaximumとも報告しており、2023の3.5〜3.6秒と競合する。ゲームversionが全postで明示されていないため、これを平均して架空の3.35秒sampleにはしていない。

## Curve decision

選択は**B: steady/linear rampは最も支持されるが正確な時刻はrange**である。

- 1.25xの不連続minimumを型に追加し、`t=0`から線形補間してminimumを薄めない。
- 3.6秒はfinal release期の数値付き報告を優先したbest-supported endpoint。
- 5秒は複数報告の概数で、正確なexpiration frameではない。
- 完全な公開frame samplesがないため`published-measurements`とし、`frame-measured`へ昇格しない。
- 0.057秒と0.86秒の独立sampleに対する相対誤差はそれぞれ約7.28%と4.60%。median 5.94%、P90 / max 7.28%。sampleが2件だけなので精度保証ではない。

## Tier scaling

tier最大値は確定しているが、minimumのtier依存formulaは未確認である。runtimeは次のassumptionを明示的に分離する。

```text
armedMinimum = 1.25x (all melee tiers)
tierMultiplier(t)
  = 1.25 + (referenceTierIIIMultiplier(t) - 1.25)
           × (tierMaximum - 1.25) / (7.00 - 1.25)
```

これにより、旧実装のように`1x`からbonus全体を比率scaleしてTier I / IIのminimumを1.083x / 1.167xへ下げない。2021の全tier tableとは方向・概数が整合するが、各tierのfirst armed frameを直接測った証拠ではないため`low` confidenceを維持する。

## Runtime algorithm

`published-hit-timings` profileでは、`hitDurationsSeconds`を順に循環させる。戦闘開始を新targetへの最初のhit (`t=0`) とし、各follow-upで以下を行う。

1. `effectiveInterval = rawHitInterval / artifactEffects.attackSpeedMultiplier`。
2. 直前のVoidから`effectiveInterval`経過した倍率をhitへ適用する。
3. 5秒以上なら倍率は1x。このhitが新しいVoidを付与する。
4. 5秒未満なら現在倍率を消費し、同じVoid Strike武器hitが直ちにeffectを再適用する。
5. 次のraw intervalへ進み、`encounterDurationSeconds`未満に発生するhitだけを平均する。

Fighter's Bindingsは`0.15 / 0.15 / 0.15 / 0.125`、Double Axeは`0.6 / 0.6`、Anchorは`2.5`を使用する。aggregate profileしかない将来の武器は、明示的fallbackとして`1 / HPS`を使う。attack speedが全intervalを完全に線形短縮する保証はなく、既存Artifact modelとの整合のためのassumptionである。

## Reset state transition

```text
unarmed target
  └─ weapon hit A: 1x damage, apply Void
       └─ wait interval A
            └─ weapon hit B: curve(interval A), consume, reapply Void
                 └─ wait interval B
                      └─ weapon hit C: curve(interval B), consume, reapply Void
```

前hitからの累積時間ではなく、reset後の各intervalを使う。expirationした場合も、そのfollow-up hit自体は1xで新しいstateを開始する。

## External damage boundary

現在のruntimeには統一`DamageEvent` streamがないため、external consumeは計算へ入れていない。公開情報ではmelee / ranged / pet attackが消費し、Shock Wave / Swirling / Thunderingは本体hitと同frameならreset後のため増幅されず、直接hitを外して間接部分だけ当てる場合や一部artifact / DoTには非消費・継続増幅の報告がある。将来は少なくとも次のevent属性が必要になる。

```text
timestamp
sourceType: weapon | ranged | pet | artifact | enchantment | dot
isDirectHit
consumesVoidStrike
appliesVoidStrikeTier
```

分類が未完成のままShock Wave等を推測実装しない。

## Golden tests

- application hit = 1x、armed直後 > 1x。
- max前はnon-decreasing、tier maxを超えず、5秒で1x。
- same-weapon follow-upが各intervalでconsume / reapply。
- expiration後のhitが1xでreapply。
- invalid points、samples、duration、intervalをreject。
- 3武器をraw interval sequenceで固定。
- attack speed multiplier増加でintervalとVoid bonusが低下。
- 独立公開sampleのmedian / P90 / max relative errorをruntime endpointとは別に集計。

## 旧proxyとの3武器比較

標準30秒scenario、attack speed modifierなし、Void Strike IIIで比較する。旧値は`1 / average HPS`と`1x → 7x / 3秒`を使い、最初の1hitだけ1xにした実装。新値は公開curveとraw interval sequenceを使う。

| Weapon | 旧average-HPS proxy | 新per-hit model | 差 | 相対変化 |
|---|---:|---:|---:|---:|
| Fighter's Bindings | 1.2861x | 1.4773x | +0.1912x | +14.87% |
| Double Axe | 2.1760x | 2.1842x | +0.0082x | +0.38% |
| Anchor | 5.5833x | 4.8895x | -0.6939x | -12.43% |

Bindingsは1.25xの不連続minimumを追加した影響が大きい。Anchorはramp endpointを3.0秒から3.6秒へ変更したため下がる。Double Axeのraw intervalは均一なので、first-hit countとcurve変更がほぼ相殺する。この表はcurveとinterval algorithmを同時に変更したimpactであり、per-hit化だけの効果とは解釈しない。

## Remaining uncertainty

- exact ramp functionとframe量子化。
- maximumが3.0 / 3.5 / 3.6秒のどれか、またはversion差か。
- exact expiration frame。
- armed minimum 1.25xが全tier共通か。
- melee / ranged / pet / artifact / indirect enchantment / DoTごとのconsume matrix。
- Death Cap等が各combo intervalを完全に線形scaleするか。

Phase 1-3は、旧proxyを公開Evidenceで正当化できるDecision Bへ置換し、未確定部分をlow confidenceとして分離したため完了とする。Phase 1-4の独立DPS回帰へ進めるが、frame-level精密化は継続課題である。
