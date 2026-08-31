# Artifact model — Phase 2-2A

今回の変更はruntime増加ではなく、既存2種を保った拡張基盤です。Research populationの全体性と実装batchのEvidence gateが残るためPhaseはpartial。Full/Limited/Research-onlyは現在の計算対応、confidenceは根拠の品質、Phase partialは作業計画の完了条件で、それぞれ別軸です。

## Before / after

従来の`ArtifactDefinition`は全種類にduration切片・Power係数を要求し、攻撃速度/DRをoptionalで持っていました。現在は`mechanic`を判別子とするunionを`src/core/artifactMechanics.ts`に分離しています。

- `timed-self-buff`: duration + attack-speed または damage-reduction効果。
- `instant-heal` / `soul-spending-heal`: healing amount modelとtarget policy。durationなしの拡張契約。
- `attack-limited-buff`: event budget + damage amount model。通常uptimeへ変換しない拡張契約。
- それ以外のfamilyはresearch taxonomyで分類し、専用stateの根拠が得られてからruntime unionを拡張する。

拡張契約は実装済み効果ではありません。`ArtifactId`はDeath Cap Mushroom / Iron Hide Amuletだけ。`ARTIFACTS`は`Record<ArtifactId, TimedSelfBuffArtifactDefinition>`でキー集合を型検証し、監査がsupport manifestと照合します。型の拡張だけで未実装効果を選択可能にはしません。

`calculateTimedArtifactUptime`はtimed self buff専用。未対応mechanicやresource/channel useは明示エラーです。`calculateArtifactEffects`も未対応familyを0寄与として通しません。将来は新しいeffect solverをdispatchへ接続した後でcatalogへ登録します。

## Duration

`ArtifactDurationModel`はfixed / linear-power / published-table。テーブルは順序・非負値・有限値・Power境界を検証し、明示された範囲内だけを線形補間します。公開値が非線形なら補間を許可するEvidenceの検討が先に必要です。範囲外は拒否し、外挿しません。

`ArtifactTriggerBudget`はevent-limitedを別型で表し、時間切れまたは最大trigger数で終了します。Powershakerの15秒・5爆発という履歴から15/CDをuptimeにすることはできません。heal・damage・summonへ偽duration=0を加えません。

既存2種のlinear-powerは歴史的なモデル仮定をそのまま保持し、新たなPower制限は付けません。これは今後の曲線流用や外挿を許可する例外ではありません。

## Activation / Artifact Synergy

`calculateArtifactEffectiveCooldown`は有限かつ正のbase CDと`0 <= reduction < 1`を検証し、従来どおり`base × (1 − reduction)`を計算します。Scenario全体の既存上限0.95は維持。

`calculateArtifactActivationOpportunities(build.artifacts, scenario)`は**全装備Artifact**から使用機会を作り、duration/uptimeには依存しません。`calculateArtifactActivationState`はinstance ID・artifact ID・effective CDだけを入力にし、現在のcooldown-onlyモデルで1/CDを合算します。`offensiveSteadyState`はこの経路を使います。重複buffで効果量が飽和しても、使用actionは別々に数えます。

使用回数と効果発生回数を分離します。1 use = 1 activationが今後の基本policy候補で、channel OFF、beam pulse、aura tick、explosionごとにSynergyを追加しません。実ゲームのtrigger例外は効果ごとの採用gateです。

将来の`ArtifactActivationCapacity`はcooldownLimited / resourceLimited / realizedの3rateを分離する契約です。`ArtifactUseModel`はcooldown-only / soul-spending / soul-channelを分け、channelのCD開始をdeactivationと明示。現行capacity helperは後二者を拒否します。将来のSynergyへ渡すのは**成功した実使用rate**であり、Soul不足を無視したCD capacityではありません。単純に各itemへ同じincomeを割り当てず、共有Soul予算を一度だけ配分します。

## Soul hook

現在の開始0・容量300・消費0は変更しません。将来はresourceUnitsの収支へ固定消費/秒消費を接続し、pickup発生数やAnima回復イベントとは分離します。有限戦闘でのwarm-up、枯渇、使用優先順位、channel中の近接停止、incomeとの循環をscheduler側で解きます。共通cooldown係数が適用できても、使える回数が1/CDとは限りません。

Soul Healerはsoloなら自己target、co-opはmost-injured ally。`scenario.party.soulHealerSelfTargetShare`等の明示入力候補を将来導入します。full HPでの発動可能性と実回復/overhealも分離し、勝手に自己回復100%とはしません。

## Damage / healing / control hooks

現行の数値出力へ未使用の0フィールドを増やさず、以下は設計提案に留めます。

- Damage channel: direct-melee / enchantment-proc / artifact-damage。Artifact damageをdirectWeaponKillsへ加算しない。Harvesterの「Soulを落とさない撃破」にはsourceごとのpickup eligibilityが必要。Fireworks等の武器経由例外は別途Evidence gateとし、一律継承しない。
- Healing: `artifactHealingCapacityPerSecond`をRadiance / Leeching / Anima / potion capacityと分離。amount/use、total/zone、tick healing、自己/party/residence/overhealを明示する。
- Control: artifact由来のstun/root/slow/pushの対象秒数やutilityを専用sourceとして追加。stun→DR、push→DPSという換算をしない。既存免疫割合を無条件継承せずArtifact別の差を調べる。
- Gong: vulnerability倍率とenemy outgoing Weakeningを別state/所有者にし、武器Weakeningと同名という理由だけでscalar合成しない。
- Mobility:移動目的がない効果はneeds-objective。Shadowやrollに副次的damageがあっても経路が完成するまで登録しない。
- Consumable/random:配布確率、ammo、pickup/使用policyが必要。Summonはlifetime・cadence・cap・target AI・kill帰属をBusy Beeと共用可能なsubsystemで扱う。

## Stacking / legality

Buildは最大3slotで既に検証されており、今回テストで再固定しました。手持ちinventory自体は3個に制限しません。同種の別instanceを装備できることと、効果量stack、refresh、独立damage、共有chargeが成立することは別です。

既存Death Cap / Iron Hideは最大3コピー、効果量は重ねず最適に交互使用するlow-confidence refresh-stagger仮定を維持します。未実装Artifactへ継承しません。Updraft Tomeの同target再使用によるdamage cancel、channel占有、pet cap、設置zone overlapなどは専用policyが必要です。researchのduplicateEquipは3slot内の一般的な装備可能性を示す仮定で、44種類すべての同時動作を検証したという意味ではありません。

## Frozen runtime / exact regression

| Artifact | Support | Family | Cooldown | Duration | Effect / stacking |
| --- | --- | --- | --- | --- | --- |
| Death Cap Mushroom | Full | timed-self-buff | 30s | 8 + 0.052 × Power | +100% attack speed、refresh-stagger、最大3 |
| Iron Hide Amulet | Full | timed-self-buff | 25s | 8 + 0.052 × Power | 50% DR、refresh-stagger、最大3 |

式・Evidence source・confidence・説明・計算順序を保持します。高精度化は今回行いません。

`tests/fixtures/artifact-foundation-baseline.json`は`34e9b729ccf8ec947932ec8936541c9ea38c67d7`のgit archiveを実行して採取した出力hashです。current実装から期待値を再生成しません。`node scripts/capture-artifact-baseline.ts`が再現手順です。

10装備組合せ（なし、各単体、各2個、混合、3slotの全組合せ）× 6構成（基本、Synergy、Rampaging、Control、Soul、Pain）× CD reduction 0 / 0.5 / 0.9 = 180ケース。異なるArtifact Power 210/251/263を使用し、evaluateとevaluateCandidateの全top-level field、optimizeの全出力、複数武器での順位・Paretoをexact比較。ArtifactUptime/Effects/Activation、Temporal、damage、healing、defense、control、Soul、objective、寄与度・confidence・理由を含みます。ソフトウェア回帰であり、実機精度測定ではありません。

## Audit / publication gate

`npm run audit:artifacts`で44件のschema・source参照・family・readiness・catalog/manifest・次batch構成を検証し、集計/対応表/計画を再生成。CIにも追加します。`npm test`の破損入力テスト、runtime-only選択確認、exact regression、生成文書のdrift検査、`npx tsc -b`、lint、buildを通します。

監査scriptの成功は「記録の整合性」の成功です。未解決のEvidenceや母集団の網羅性まで解決した意味ではありません。[audit](artifact-audit.md) / [support](artifact-runtime-support.md) / [expansion](artifact-expansion-plan.md)を正本として参照してください。
