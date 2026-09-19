import type { CoverageBlocker } from './model'

export interface MeasurementProtocol {
  readonly id: string
  readonly title?: string
  readonly resolutionClass?: 'observe' | 'measure' | 'experiment'
  readonly taskFamilyIds?: readonly string[]
  readonly legacyProtocolIds?: readonly string[]
  readonly subsystem: string
  readonly targetMechanic: string
  readonly appliesTo?: { readonly categories: readonly string[]; readonly properties: readonly string[] }
  readonly estimatedMinutes?: { readonly min: number; readonly max: number }
  readonly prerequisites?: readonly string[]
  readonly setup?: readonly string[]
  readonly steps?: readonly string[]
  readonly purpose: string
  readonly requiredGameVersion: string
  readonly equipment: readonly string[]
  readonly scenario: readonly string[]
  readonly observations: readonly string[]
  readonly recordFields?: readonly string[]
  readonly repetition: { readonly minimumIndependentRuns: number | null; readonly rule: string }
  readonly controls?: readonly string[]
  readonly variants?: readonly string[]
  readonly hypothesis?: readonly string[]
  readonly closeCondition?: readonly string[]
  readonly failureModes?: readonly string[]
  readonly acceptance: readonly string[]
  readonly submissionMetadata: readonly string[]
  readonly invalidatingConditions: readonly string[]
  readonly blockerIds: readonly string[]
  readonly sourceRefs: readonly string[]
}

export function markdownSection(markdown: string, heading: string): string {
  const start = markdown.indexOf(`## ${heading}\n`)
  if (start < 0) throw new Error(`Missing protocol source section: ${heading}`)
  const bodyStart = start + `## ${heading}\n`.length
  const next = markdown.indexOf('\n## ', bodyStart)
  return markdown.slice(bodyStart, next < 0 ? undefined : next).trim()
}
const bullets = (text: string) => text.split('\n').filter((line) => line.startsWith('- ')).map((line) => line.slice(2))
const metadata = ['game versionと確度、platform、difficulty、記録日時', '全装備のID・Power・表示値・全EnchantのTier/copy/slot/Gilded・全Artifact', '公開source URL、未編集raw記録、frame rate/timestamps、観測の導出手順、run ID', '対象とarmor/DR、scenario、発動順、除外runと理由、計測分解能']

export function buildMeasurementProtocols(modelRegressionMarkdown: string, targetGameVersion: string): readonly MeasurementProtocol[] {
  const eligibility = markdownSection(modelRegressionMarkdown, 'Eligibility')
  const forbiddenMarker = '次はfull DPS sampleとして禁止します。'
  if (!eligibility.includes(forbiddenMarker)) throw new Error('DPS Eligibility prohibition boundary changed')
  const [required, forbidden] = eligibility.split(forbiddenMarker)
  const rules = bullets(required!)
  if (rules.length === 0) throw new Error('DPS Eligibility has no required observations')
  const rangedProtocols = ([
      { id: 'ranged-cadence', targetMechanic: 'shot / charge / recovery and direct DPS', equipment: ['BowとCrossbowを別runにする。全Power・neutral projectile card/observed damage・Enchantなし・通常矢。'],
        observations: ['charge開始/発射/recovery終了frame、damage/矢消費、全shot間隔、total durationとtotal damage、観測値と予測値の差'],
        acceptance: ['neutral damageと完全周期からの有限shot予測を独立hold-out runで比較。charge/recoveryを混ぜない。'], blocker: 'ranged-cadence' },
      { id: 'ranged-projectiles', targetMechanic: 'projectile distribution / ammo', equipment: ['Scatter・Burst・Exploding familyを別実験にする。baseとuniqueはpaired run。Enchantなし。'],
        observations: ['1入力ごとのprojectile数、各targetへのdamage列、burst各射timestamp、消費ammo、直撃/爆発/跳弾を識別した映像'],
        acceptance: ['card値が1矢/全矢/chargeのどれかを識別。各projectileとtargetの帰属が追えるまでDPSへ昇格しない。'], blocker: 'ranged-projectiles' },
      { id: 'ranged-interactions', targetMechanic: 'proc attribution / ranged Armor modifiers', equipment: ['同一Bow/Crossbow、Power/Critical/Unchanting単独とpair、別runでranged Armor/aura/Cowardiceを比較。'],
        observations: ['neutral baseline、単独/pairのdamage列、proc発動/非発動、直接/間接の最終撃破、HP状態、Tier/Gilded、敵種類'],
        acceptance: ['meleeとrangedの同名Enchant値を別に記録。単独→pairのstackingとkill帰属が独立再現するまで共有しない。'], blocker: 'ranged-interactions' },
    ]).map((item): MeasurementProtocol => ({
      id: item.id, subsystem: 'ranged', targetMechanic: item.targetMechanic, purpose: '現行版の不足Evidenceを実測で解決する。測定済み結果は含まない。', requiredGameVersion: targetGameVersion,
      equipment: item.equipment, scenario: ['固定難易度・同じ敵・既知のarmor/DR・固定距離・単体baseline。外部buff/特殊矢/partyなし。'], observations: item.observations,
      repetition: { minimumIndependentRuns: 3, rule: '各条件で3独立run以上、各run最低20射。proc確率は全trial数と分散を報告し、20射だけで確定しない。' },
      acceptance: item.acceptance, submissionMetadata: metadata,
      invalidatingConditions: ['版/装備/全Enchant/targetが不明', 'Strengthや特殊矢が混入、shotとprojectileの混同、未知DR', '予測値を観測値として投稿、連続frameを独立runへ水増し'],
      blockerIds: [`backlog:${item.blocker}`], sourceRefs: ['docs/ranged-runtime.md', 'research/ranged-weapon-audit.json', 'research/ranged-enchantment-audit.json'],
    }))
  return [
    {
      id: 'phase-1-dps-regression', subsystem: 'dps-regression', targetMechanic: 'end-to-end single-target DPS', purpose: 'observed card damageを固定し、Power curve誤差を混ぜず独立DPSと比較する。', requiredGameVersion: targetGameVersion,
      equipment: ['runtime対応武器、observedDamagePerHit、attack speed modifier', '関連する全Enchant/Artifact。なしの場合も空配列を記録する。'],
      scenario: ['single-target固定、target armor/DR既知、難易度・位置・バフ状態を固定'], observations: rules,
      repetition: { minimumIndependentRuns: null, rule: '1 run = 1 observation。同一動画の連続frameや再掲は独立sampleではない。必要総数はCoverageのDPS minimumSamplesを参照。' },
      acceptance: rules, submissionMetadata: metadata, invalidatingConditions: bullets(forbidden!), blockerIds: ['backlog:dps-regression'], sourceRefs: ['docs/model-regression.md#eligibility', 'research/dps-regression-audit.json#/eligibilityPolicy', 'src/research/dpsRegressionAudit.ts'],
    },
    {
      id: 'cooldown-composition', subsystem: 'armor / armor-enchantment / artifact', targetMechanic: 'intrinsic・Cool Down・external cooldown合成', purpose: 'source別の単独値と組合せtraceを取得し、合成式・起点・丸めを識別する。', requiredGameVersion: targetGameVersion,
      equipment: ['同一Artifact ID・Power・表示cooldownを固定。即時使用型と持続型を別実験にする。', 'Armorなし / Battle Robe単独 / Cool Down各Tier単独 / Battle Robe + Cool Downを対にする。', 'Cool Down 1〜4 copyはTierとslot/Gildedを個別記録。external sourceは名称・強度・持続を記録し、単独・pair・複合条件を別runにする。'],
      scenario: ['敵・kill・Soul消費・他cooldown効果を除外または一定にする。', '各runの開始時に全cooldownを回復。発動順とeffect endを固定・記録する。'],
      observations: ['入力受付、発動、effect end、再使用可能、次回入力受付のframe/timestamp', '各条件の全interval、使用回数とtotal duration、失敗入力・遅延・FPS'],
      repetition: { minimumIndependentRuns: 3, rule: '各単独/pair条件で独立3 run以上、各runで10 cooldown周期以上。protocol設計上の最低条件であり測定済み件数ではない。' },
      acceptance: ['同条件baselineと全source単独を併記し、pair・複合で再現する。', 'frame分解能・分布・開始点差を明示し、候補式は全anchorを説明するまで採用しない。', '37% / 38%表示差とhistorical anchorを別に保持し、現在版の答えへ混ぜない。'], submissionMetadata: metadata,
      invalidatingConditions: ['未知のexternal cooldown・Refreshment等が混入', '入力遅延をcooldownとして計測', '版・Tier・Power混在、連続区間を独立runとして分割'], blockerIds: ['backlog:armor-cooldown'], sourceRefs: ['research/runtime/armor-core-runtime-audit.json#/decisions/artifactCooldownComposition', 'research/armor-expansion-state-enchant-audit.json#/cooldownStacking'],
    },
    {
      id: 'damage-reduction-composition', subsystem: 'armor / armor-enchantment / melee-enchantment / artifact', targetMechanic: 'Armor DR・Protection・Potion Barrier・Iron Hide・Guarding・Weakening合成', purpose: '一定のincoming hitを使い、被ダメージ軽減のfamily・順序・重複を識別する。', requiredGameVersion: targetGameVersion,
      equipment: ['Armor DRなしbaselineと35% Armor、Protection各Tier、Potion Barrier各Tier、Iron Hide、Guarding Strike、Weakeningを個別記録。', '単独、各pair、主要複合を別runにし、装着slot/Gilded、copy、発動順を記録。'],
      scenario: ['同じ敵種・難易度・attack channel・距離を固定。敵の装備やbuffも記録。', 'HPをhit前後に読める状態とし、回復・吸収・回避・Chilling・無敵等を除外。', 'Weakeningは攻撃した敵へのdebuff、Guardingはkill trigger、Potion Barrierはpotion後のactive windowを確認。'],
      observations: ['各hitのHP前後、raw incoming damage baseline、発動/失効frame、敵debuff状態', '非発動・単独・pair・複合のdamage sequenceと同時active window', '表示丸め、damage channel、proc/無効hitとその理由'],
      repetition: { minimumIndependentRuns: 3, rule: '条件ごと独立3 run以上、各runのactive window内で10有効hit以上を確保。windowを跨ぐ場合は再発動を明示する。' },
      acceptance: ['全source単独baselineからpairの差を再現し、順序を入れ替えて比較。', '瞬間DRと時間平均uptimeを分離。rounding・分散を説明できるまで一般式を確定しない。', '対象・版・Tier・damage channelが一致するraw traceだけを検証へ採用。'], submissionMetadata: metadata,
      invalidatingConditions: ['HP回復やabsorptionをDRに含める', 'active window外、攻撃者のWeakening状態不明、違うdamage channelを混ぜる', '既存モデル出力や過去版の率だけを観測結果として使用'], blockerIds: ['backlog:armor-dr'], sourceRefs: ['research/runtime/armor-core-runtime-audit.json#/decisions/damageReductionComposition', 'research/armor-expansion-state-enchant-audit.json#/armorEnchantments', 'docs/armor-runtime-batch.md'],
    },
    ...rangedProtocols,
  ]
}

export function resolveProtocolCloseConditions(protocol: MeasurementProtocol, blockers: readonly CoverageBlocker[]) {
  return protocol.blockerIds.map((id) => {
    const blocker = blockers.find((entry) => entry.id === id)
    if (!blocker) throw new Error(`${protocol.id}: missing blocker ${id}`)
    return { blockerId: id, closeCondition: blocker.closeCondition }
  })
}
