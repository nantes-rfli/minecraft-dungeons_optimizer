# Enemy debuff coverage — Phase 2-1C

Weakeningは敵の攻撃ダメージを下げます。heroの被ダメージ軽減であるGuarding Strike / Iron Hideとは別の状態として計算します。

## 公開Mechanicsと出典の相違

2026-08-30に[dungeons.tools Weakening](https://www.dungeons.tools/enchantments/weakening)を再取得し、Tier I / II / IIIの20% / 30% / 40%、攻撃により周囲の敵へ5秒間適用する説明を確認しました。Tierと`WEAKENING_DURATION`、`WEAKENING_APPLICATION`はhigh Evidenceです。正確な半径やtarget switchingは未測定です。

**stackingは資料間で矛盾します。** dungeons.toolsの生表示は`STACKS Yes`、Phase 2-1A auditの解釈は`maxCopies=4 / special`でした。一方、[Minecraft Wiki Weakening](https://minecraft.wiki/w/Dungeons%3AWeakening)のStacking節は通常・金色・固有枠を含め重複不可と明記しています（今回robots制限のため検索インデックス本文で確認）。依頼仕様とこの具体的なslot制約を採用して**maxCopies=1 / non-stackable**へ訂正しました。auditには旧解釈、優先資料の生表示、採用理由、矛盾を残し、runtime stacking Evidenceは**medium**です。source hierarchyの単純一致やraw fieldの独立検証済みとは主張しません。

適用種別にもdungeons.toolsのmeleeのみ、Wikiの1.10.2.0以降rangedにも適用、という差があります。今回のruntimeは近接のみなのでauditの優先データ範囲を維持し、applicability Evidenceに相違を記録します。built-in unique武器は実装しません。

## Scenario assumption

```ts
interface EnemyDebuffAssumptions {
  weakeningAffectedIncomingDamageShare: number
}
// Scenario.enemyDebuffs
```

`weakeningAffectedIncomingDamageShare`は「そのScenarioのincoming damageのうち、**ダメージ発生時点でWeakening中の敵から来る割合**」です。基礎被ダメージ量で重み付けした時間平均で、射程、AoE coverage、5秒duration、攻撃稼働率、敵位置、攻撃対象の切替、遠隔攻撃者をまとめます。敵の頭数割合やhit率そのものではありません。

全6profile共通で**0.5（50%）**を初期値とします。汎用の中間点として感度比較を始めるための値で、spawn-independentな観測値や最適な推定値ではありません。profile別の根拠がないためboss=100%などの差は付けません。UIで0〜100%に変更でき、Evidenceは変更後もlowです。Scenarioは既存仕様どおりセッション内の設定で、inventory JSONのschemaは変更しません。APIでScenarioを作る際は新fieldが必須です。

`validateScenario()`は範囲外・NaN・±Infinity・欠落を拒否します。Weakening未選択Buildへこのlow factorを混ぜません。選択済みで割合0の場合は根拠を表示したうえで寄与0とします。

## 計算pipeline

```text
s = weakeningAffectedIncomingDamageShare
r = TierのenemyDamageReduction
weakeningEnemyDamageMultiplier = (1 − s) + s × (1 − r) = 1 − s × r
damageTakenMultiplier = weakeningEnemyDamageMultiplier
                      × artifactDamageTakenMultiplier
                      × guardingStrikeDamageTakenMultiplier
damageTakenPerSecond = incomingDamagePerSecond × damageTakenMultiplier
effectiveHealth = maxHealth / damageTakenMultiplier
```

Tier III・割合50%なら敵攻撃ダメージ倍率は`1 − 0.5 × 0.4 = 0.80`。この段階でincoming期待値を20%下げます。割合0なら1.00、割合100%ならTier I / II / IIIで0.80 / 0.70 / 0.60です。無条件の常時40%軽減ではありません。

`deriveEnemyDebuffState()`の出力を`DefenseMetrics`へ保持します: `weakeningAffectedIncomingDamageShare`、`weakeningDamageReduction`、`weakeningDurationSeconds`、`weakeningEnemyDamageMultiplier`。ArtifactとGuardingの倍率も別fieldに保持し、UIとreasonで仮定から最終被ダメージまで追跡できます。Tierの5秒はstateに残しますが、割合が時間を含むため**durationやHPSからuptimeを再度算出せず、二重計算しません**。

Guarding / Artifactとの合成は各段階の時間平均を独立に掛けるモデルです。同時稼働・被ダメージ源との相関は未測定で、併用時だけ`WEAKENING_HERO_DR_COMPOSITION`（low）をEvidenceへ追加します。数値上は交換可能でも敵攻撃力とhero防御のsemanticsは別です。

WeakeningはDPS、Radiance、Leeching、直接kill rateを変えません。prevented damageとEHP、defense Utility、スコアとPareto比較には寄与します。正確なevent simulator、CC utility、enemy action model、DamageEvent、Shockwave / Swirling / Thundering / Committedは今回対象外です。
