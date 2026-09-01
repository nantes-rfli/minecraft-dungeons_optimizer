# Artifact model — Phase 2-2A / 2-2B / 2-2C / 2-2D

Phase 2-2Aでprimary44 / secondary表示45の差分をCorrupted Seedsと確定し、表示定義の正規化和集合45件をproject監査母集団にしました。raw game IDの網羅性は主張しません。Phase 2-2BではShock PowderだけがEvidence gateを通りLimited runtimeとなり、2-2C / 2-2Dの6候補はResearch-onlyです。Full/Limited/Research-only、confidence、historical phase statusは別軸です。

## Before / after

従来の`ArtifactDefinition`は全種類にduration切片・Power係数を要求し、攻撃速度/DRをoptionalで持っていました。現在は`mechanic`を判別子とするunionを`src/core/artifactMechanics.ts`に分離しています。

- `timed-self-buff`: duration + attack-speed または damage-reduction効果。
- `hard-control`: bounded duration + hard-stun。runtimeではShock Powderだけ。
- `instant-heal` / `soul-spending-heal`: healing amount modelとtarget policy。durationなしの拡張契約。
- `attack-limited-buff`: event budget + damage amount model。通常uptimeへ変換しない拡張契約。
- それ以外のfamilyはresearch taxonomyで分類し、専用stateの根拠が得られてからruntime unionを拡張する。

拡張契約は実装済み効果ではありません。`ArtifactId`はDeath Cap Mushroom / Iron Hide Amulet / Shock Powderだけ。`ARTIFACTS`は`Record<ArtifactId, ArtifactDefinition>`としてキー集合を型検証し、監査がsupport manifestと照合します。型の拡張だけで未実装効果を選択可能にはしません。

`calculateTimedArtifactUptime`はtimed self buff専用。`calculateArtifactEffects`はhard-controlをself buffへ偽変換せず、`deriveArtifactControlState`へdispatchします。その他の未対応mechanicやresource/channel useは明示エラーです。将来も専用solverを接続した後でcatalogへ登録します。

## Duration

`ArtifactDurationModel`はfixed / linear-power / published-table。テーブルは順序・非負値・有限値・Power境界を検証し、明示された範囲内だけを線形補間します。公開値が非線形なら補間を許可するEvidenceの検討が先に必要です。範囲外は拒否し、外挿しません。

`ArtifactTriggerBudget`はevent-limitedを別型で表し、時間切れまたは最大trigger数で終了します。Powershakerの15秒・5爆発という履歴から15/CDをuptimeにすることはできません。heal・damage・summonへ偽duration=0を加えません。

Powershakerの将来solverは発動ごとに最大5 eventだけを処理し、attack action / hit target粒度、miss、再発動をEvidenceで固定してから接続します。爆発は`artifact-damage`で、direct weapon killを汚しません。Totemは`placed-healing-zone`としてexact durationとhealing rateが揃ってから、zone uptime × self residenceで名目自己回復capacityを算出します。Wind Hornは`separationCoverage`候補をgroupingから分離し、policy未定のままDPS/DRへ換算しません。これらは[Phase 2-2D監査](artifact-event-healing-control.md)の設計で、runtime unionや0フィールドには未追加です。

既存2種のlinear-powerは歴史的なモデル仮定をそのまま保持し、新たなPower制限は付けません。これは今後の曲線流用や外挿を許可する例外ではありません。

## Activation / Artifact Synergy

`calculateArtifactEffectiveCooldown`は有限かつ正のbase CDと`0 <= reduction < 1`を検証し、従来どおり`base × (1 − reduction)`を計算します。Scenario全体の既存上限0.95は維持。

`calculateArtifactActivationOpportunities(build.artifacts, scenario)`は**全装備Artifact**から使用機会を作り、duration/uptimeには依存しません。`calculateArtifactActivationState`はinstance ID・artifact ID・effective CDだけを入力にし、現在のcooldown-onlyモデルで1/CDを合算します。`offensiveSteadyState`はこの経路を使います。重複buffで効果量が飽和しても、使用actionは別々に数えます。

使用回数と効果発生回数を分離します。1 use = 1 activationが今後の基本policy候補で、channel OFF、beam pulse、aura tick、explosionごとにSynergyを追加しません。実ゲームのtrigger例外は効果ごとの採用gateです。

有限encounterではactivation accountingとeffect creditも分離します。継続effectを`encounterDuration`と同時刻に初めて置いた場合はactive time 0でeffect credit 0。instant effectは発動時刻がencounter内の場合だけeffect credit可能です。

`ArtifactActivationCapacity`はcooldownLimited / resourceLimited / realizedの3rateを分離します。`ArtifactUseModel`はcooldown-only / soul-spending / soul-channelを分け、channelのCD開始をdeactivationと明示。`calculateSoulArtifactActivationOpportunities`は有限schedulerの**成功した実使用rate**だけをSynergy入力へ変換し、Soul不足を無視したCD capacityを使いません。

## Soul hook

`simulateSoulResourceSchedule`は開始Soul（default 0）・容量300・一定resource収入・離散使用をeventで処理します。各区間の線形増加とcapacity plateauを積分し、end / average / spent / overflowを保存。pickup発生数やAnima回復イベントは消費で減らしません。単一consumerはcooldown readyかつaffordableになった最速時刻に使い、t=0も含みます。複数spenderはplayer priorityが必要なため、slot順を捏造せず拒否します。

Soul Healerはsoloなら自己target、co-opはmost-injured ally。`scenario.party.soulHealerSelfTargetShare`等の明示入力候補を将来導入します。full HPでの発動可能性と実回復/overhealも分離し、勝手に自己回復100%とはしません。

## Damage / healing / control hooks

現行の数値出力へ未使用の0フィールドを増やさず、以下は設計提案に留めます。

- Damage channel: direct-melee / enchantment-proc / artifact-damage。Artifact damageをdirectWeaponKillsへ加算しない。Harvesterの「Soulを落とさない撃破」にはsourceごとのpickup eligibilityが必要。Fireworks等の武器経由例外は別途Evidence gateとし、一律継承しない。
- Healing: `artifactHealingCapacityPerSecond`をRadiance / Leeching / Anima / potion capacityと分離。amount/use、total/zone、tick healing、自己/party/residence/overhealを明示する。
- Control: Shock Powderはsource Artifact ID、Power、duration、effective CD、raw coverage、eligibility、affected-target shareを保持します。stun→DR/DPSへ換算せず、別hard stunとの合成だけを飽和union近似します。
- Gong: vulnerability倍率とenemy outgoing Weakeningを別state/所有者にし、武器Weakeningと同名という理由だけでscalar合成しない。
- Mobility:移動目的がない効果はneeds-objective。Shadowやrollに副次的damageがあっても経路が完成するまで登録しない。
- Consumable/random:配布確率、ammo、pickup/使用policyが必要。Summonはlifetime・cadence・cap・target AI・kill帰属をBusy Beeと共用可能なsubsystemで扱う。

## Stacking / legality

Buildは最大3slotで既に検証されており、今回テストで再固定しました。手持ちinventory自体は3個に制限しません。同種の別instanceを装備できることと、効果量stack、refresh、独立damage、共有chargeが成立することは別です。

既存Death Cap / Iron Hideは最大3コピー、効果量は重ねず最適に交互使用するlow-confidence refresh-stagger仮定を維持します。Shock Powderへ継承せず、duplicate refresh/overlapが未解決なためruntimeは1copyです。Updraft Tomeの同target再使用によるdamage cancel、channel占有、pet cap、設置zone overlapなどは専用policyが必要です。researchのduplicateEquipは3slot内の一般的な装備可能性を示す仮定で、45種類すべての同時動作を検証したという意味ではありません。

## Frozen runtime / exact regression

| Artifact | Support | Family | Cooldown | Duration | Effect / stacking |
| --- | --- | --- | --- | --- | --- |
| Death Cap Mushroom | Full | timed-self-buff | 30s | 8 + 0.052 × Power | +100% attack speed、refresh-stagger、最大3 |
| Iron Hide Amulet | Full | timed-self-buff | 25s | 8 + 0.052 × Power | 50% DR、refresh-stagger、最大3 |
| Shock Powder | Limited | hard-control | 15s | Power 12–262の公開4点間を区分線形補間 | eligibility × affected share、1copy、DPS/DR変換なし |

既存2種の式・Evidence source・confidence・説明・計算順序を保持します。Shock Powderを使わない既存180ケースはbaselineとexact一致します。

`tests/fixtures/artifact-foundation-baseline.json`は`34e9b729ccf8ec947932ec8936541c9ea38c67d7`のgit archiveを実行して採取した出力hashです。current実装から期待値を再生成しません。`node scripts/capture-artifact-baseline.ts`が再現手順です。

10装備組合せ（なし、各単体、各2個、混合、3slotの全組合せ）× 6構成（基本、Synergy、Rampaging、Control、Soul、Pain）× CD reduction 0 / 0.5 / 0.9 = 180ケース。異なるArtifact Power 210/251/263を使用し、evaluateとevaluateCandidateの全top-level field、optimizeの全出力、複数武器での順位・Paretoをexact比較。ArtifactUptime/Effects/Activation、Temporal、damage、healing、defense、control、Soul、objective、寄与度・confidence・理由を含みます。ソフトウェア回帰であり、実機精度測定ではありません。

## Audit / publication gate

`npm run audit:artifacts`でprimary44 / union45のreconciliation、schema・source参照・family・readiness・catalog/manifest・計画を検証し、集計/対応表/計画を再生成します。`npm run audit:artifact-control`は2-2B、`npm run audit:artifact-soul`は2-2C、`npm run audit:artifact-event`は2-2Dを検証します。`npm run audit:artifact-evidence`は2-2Eのsource provenance、version/unit、fit/hold-out、誤差統計、範囲、conflict、生成文書drift、promotion/次Phase gateをネットワークなしで検証します。`npm test`の破損入力、runtime-only選択、exact regression、`npx tsc -b`、lint、buildを通します。

監査scriptの成功は「記録の整合性」の成功です。未解決のEvidenceやraw game IDの網羅性まで解決した意味ではありません。[audit](artifact-audit.md) / [control/debuff](artifact-control-debuff.md) / [support](artifact-runtime-support.md) / [expansion](artifact-expansion-plan.md)を正本として参照してください。
