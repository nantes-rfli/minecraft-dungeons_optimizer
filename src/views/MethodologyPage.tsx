import { SCENARIO_PROFILES } from '../data/scenarios'
import { CHARGE_UNVERIFIED_MODIFIERS } from '../data/chargeConsume'
import { ARTIFACT_SYNERGY_SOURCE, RAMPAGING_SOURCE } from '../data/temporalEnchantments'
import auditJson from '../../research/dps-regression-audit.json'
import { summarizeDamageRegression } from '../core/modelError'
import { ARTIFACTS } from '../data/artifacts'
import { ENCHANTMENTS } from '../data/enchantments'
import { DAMAGE_REGRESSION_SAMPLES } from '../data/regressionSamples'
import { ROADMAP_PHASES, ROADMAP_PROGRESS, type RoadmapStatus } from '../data/roadmap'
import { WEAPONS } from '../data/weapons'
import { HEALTH_POTION_SOURCE, REFRESHMENT_SOURCE, SHARPNESS_SOURCE, UNCHANTING_SOURCE, WEAKENING_SOURCE, WEAKENING_STACKING_SOURCE } from '../data/sources'
import {
  summarizeDpsRegressionAudit,
  type DpsRegressionAudit,
} from '../research/dpsRegressionAudit'
import { DpsRegressionPanel } from './DpsRegressionPanel'
import { RuntimeSupportSection } from './RuntimeSupport'
import { ArtifactRuntimeSupportSection } from './ArtifactRuntimeSupport'
import { ARMOR_HEALTH_AUDIT, ARMOR_RUNTIME_SUPPORT, armorRuntimeSupportSummaryText, summarizeArmorAudit } from '../research/armorAudit'
import { summarizeArmorEnchantmentAudit } from '../research/armorEnchantmentAudit'

const Formula = ({ children }: { children: string }) => <code className="formula">{children}</code>
const STATUS_LABELS: Readonly<Record<RoadmapStatus, string>> = {
  done: '完了',
  'in-progress': '進行中',
  planned: '未着手',
}
const DPS_AUDIT = auditJson as unknown as DpsRegressionAudit
const DPS_AUDIT_SUMMARY = summarizeDpsRegressionAudit(DPS_AUDIT)
const DAMAGE_MODEL_ERROR = summarizeDamageRegression(DAMAGE_REGRESSION_SAMPLES)
const ARMOR_AUDIT_SUMMARY = summarizeArmorAudit()
const ARMOR_ENCHANTMENT_SUMMARY = summarizeArmorEnchantmentAudit()
const DPS_AUDIT_SOURCES = [...new Map(
  DPS_AUDIT.entries.map((entry) => [entry.source.id, entry.source]),
).values()]

export function MethodologyPage() {
  return (
    <main>
      <header className="page-header">
        <p className="eyebrow">MODEL & IMPLEMENTATION / v0.1</p>
        <h1>計算ロジックと<br />実装状況</h1>
        <p className="lede">
          このツールが何を入力にし、どの式で比較し、どこからが推定なのかを公開します。
          数値だけでなく「なぜその装備なのか」を検証できる設計です。
        </p>
      </header>

      <RuntimeSupportSection />
      <ArtifactRuntimeSupportSection />

      <section className="panel">
        <p className="section-label">PHASE 2-3B / ARMOR CORE RUNTIME BATCH — COMPLETE</p>
        <h2>Owned ArmorをHealth・固有效果・actual rollsごと接続</h2>
        <p>dungeons.toolsの1.17.0.0母集団71件とWikiのknown 73 / obtainable 71を正規化照合しました。common 71、primary-only 0、secondary-onlyはEnder ArmorとVanguard Armorです。Soul Mage Robeは別のunused file-remnantとして記録し、73件の表示母集団へ混ぜていません。raw game ID全体の網羅性は主張しません。</p>
        <Formula>{armorRuntimeSupportSummaryText()}</Formula>
        <p>Battle Robe / Renegade Armor / Wither Armorの3 / {ARMOR_AUDIT_SUMMARY.population}をLimited runtimeへ追加しました。Healthだけ・主要property 0の防具は登録しません。通常slot、built-in、金色を別sourceにし、free slotへ未対応候補が混ざる場合はArmor候補を除外、supported rollのlock時だけ評価します。</p>
        <div className="regression-audit-grid">
          <div><span>Armor population</span><strong>{ARMOR_AUDIT_SUMMARY.population}</strong></div>
          <div><span>Obtainable</span><strong>{ARMOR_AUDIT_SUMMARY.obtainable}</strong></div>
          <div><span>Armor enchants</span><strong>{ARMOR_ENCHANTMENT_SUMMARY.population}</strong></div>
          <div><span>Utility-only</span><strong>{ARMOR_ENCHANTMENT_SUMMARY.utilityOnly}</strong></div>
        </div>
        <h3>Healthはカード表示値を主経路にする</h3>
        <p>Hero基礎HPは{ARMOR_HEALTH_AUDIT.baseHeroHealth.value}。4 familyの公開tableはPower 1〜108で一致しますが、endgameのexact観測はPower251の3件だけです。同じ251でも+{ARMOR_HEALTH_AUDIT.samePowerVariance.minObservedHealthBonus.toLocaleString()}〜+{ARMOR_HEALTH_AUDIT.samePowerVariance.maxObservedHealthBonus.toLocaleString()}（差{ARMOR_HEALTH_AUDIT.samePowerVariance.spread.toLocaleString()}）なので、Powerからexact Healthを一意に埋めません。</p>
        <Formula>observedHealthBonus → validated model range → unsupported</Formula>
        <p>ArmorありBuildは<code>100 + observedHealthBonus</code>をPotion / Anima / Pain Cycle / EHPへ共通利用し、<code>scenario.maxHealth</code>を加算しません。35% DRとIron Hide / Potion Barrier / Guarding Strike / Weakening / Protection、外部 / intrinsic / Cool Downの未検証合成は明示rejectします。</p>
        <h3>3 Armor / 3 Enchant</h3>
        <p>Armorは{ARMOR_RUNTIME_SUPPORT.nextBatch.armorIds.join(', ')}、Enchantは{ARMOR_RUNTIME_SUPPORT.nextBatch.armorEnchantmentIds.join(', ')}。Cool Downは18/29/37%・1copy、Potion BarrierはPotionState由来coverage、ChillingはControl-onlyの周期モデルです。</p>
      </section>

      <section className="panel">
        <p className="section-label">PHASE 2-2E / ARTIFACT EVIDENCE — COMPLETE</p>
        <h2>公開curveを検証し、作れない式も再現可能な結果へ</h2>
        <p>公開Evidence 85件をversion・unit・field・source付きで固定し、damage / healing / duration / distanceを分離してfitとhold-outを検証しました。Artifact共通damage/healing curveはEvidence不足でinconclusive、weapon curve流用と全Artifact共通duration式はhold-out誤差でrejectedです。</p>
        <p>Harvester 4/8秒、Lightning Rod 2/4秒、Totemのtotal/per-second/per-tick、Wind Hornの境界・Power109+・slowはいずれも未解決です。6候補はpublic-evidence-exhaustedかつResearch-only、runtime 3 / 45を維持します。</p>
        <p>endgame Limited以上のready候補が0件のためArtifact promotionを保留し、次はArmor / Armor Enchantmentsを優先します。Artifact batchは2候補以上でcurrent 1.17・endgame Power・主要unit/interactionが揃った時だけ再開します。</p>
      </section>

      <section className="panel">
        <p className="section-label">PHASE 2-2D / EVENT・HEALING ZONE・POSITIONAL CONTROL — COMPLETE</p>
        <h2>有限爆発、設置回復、敵を離すControlを別familyへ</h2>
        <p>PowershakerはCD10秒、最大15秒または5爆発の早い方で終了します。係数259はabsolute damage curveではなく、multi-target budget、miss、再発動、AoE/kill/modifier境界も未解決のためResearch-onlyです。15/CDのtimed buffにはしていません。</p>
        <p>Totem of RegenerationはCD25秒、半径4 blocksのplaced healing zoneです。約5〜10秒、Power 31/111/114の表示値、1.7.2.0の20→40/s履歴はありますが、exact duration、表示heal単位、現行curve、self residence/party、zone overlapを確定できずResearch-onlyです。activation時のinstant healにはしていません。</p>
        <p>Wind HornはCD10秒で、Power 1〜108の4〜8 blocks push表があります。band境界が重複し、Power109+、slow分類/値、密着cutoff、boss適格性が未解決です。pushはGravity groupingでなくseparationで、DPS/DRへ換算せずResearch-onlyです。</p>
        <p>1 use = 1 Artifact Synergy activation。爆発、回復tick、対象数はactivationへ数えません。継続effectをencounter終了時点に初めて置いた場合はeffect credit 0です。3種とも未登録でruntimeは3 / 45のままです。</p>
        <p>詳細は<a href="https://www.dungeons.tools/artifacts/powershaker" target="_blank" rel="noreferrer">Powershaker</a> / <a href="https://www.dungeons.tools/artifacts/totem-of-regeneration" target="_blank" rel="noreferrer">Totem</a> / <a href="https://www.dungeons.tools/artifacts/wind-horn" target="_blank" rel="noreferrer">Wind Horn</a>の1.17.0.0 databaseと監査文書へ記録しています。</p>
      </section>

      <section className="panel">
        <p className="section-label">PHASE 2-2C / FINITE SOUL — COMPLETE</p>
        <h2>Soulを有限・蓄積・overflow・離散消費するresourceへ</h2>
        <p>開始Soulは0〜300で編集可能。pickup回数とGathering後のresource量を分離したまま、一定収入の区間とArtifact使用eventを処理します。平均Soulは各区間と満タンplateauの時間積分で、開始・終了の単純平均ではありません。</p>
        <Formula>initial + income = end + spent + overflow</Formula>
        <p>単一spenderはcooldown readyかつSoulを払える最速時刻に使用し、t=0も含みます。cooldown上限、resource上限、実使用、Soul不足を分離。複数spenderは共有poolのplayer priorityが必要なためslot順では処理せず拒否します。Animaはpickup回数のまま、Artifact Synergyは実使用だけを数えます。</p>
        <p>Soul Healerは5秒・50 Soul・+1 Gatheringを確認しましたが、現行heal曲線と乱数意味が未解決。Harvesterは4/8秒競合・高Power曲線・非Soul撃破feedback、Lightning Rodは2/4秒競合・高Power曲線・strike delay/target/kill適格性が未解決です。3種ともResearch-onlyで、runtimeは3 / 45のままです。</p>
        <p>出典: <a href="https://www.dungeons.tools/artifacts/soul-healer" target="_blank" rel="noreferrer">Soul Healer</a> / <a href="https://minecraft.wiki/w/Dungeons:Harvester" target="_blank" rel="noreferrer">Harvester</a> / <a href="https://www.dungeons.tools/artifacts/lightning-rod" target="_blank" rel="noreferrer">Lightning Rod</a> / <a href="https://minecraft.wiki/w/Dungeons:1.3.2.0" target="_blank" rel="noreferrer">1.3.2.0履歴</a>。</p>
      </section>

      <section className="panel">
        <p className="section-label">PHASE 2-2A / 2-2B — COMPLETE</p>
        <h2>Artifact母集団の照合とShock Powderの限定Control</h2>
        <p>primary 44件とsecondaryの表示定義45件を照合し、差分はCorrupted Seedsと確定しました。project監査母集団は正規化和集合45件です。これは表示定義の範囲であり、raw game ID全体の網羅性は主張しません。</p>
        <p>Shock PowderはPower 12〜262の公開4点だけをlog-linear補間し、範囲外へ外挿しません。cooldownは15秒、1copy限定。使用可能になり次第使う定常近似で、公開持続時間をそのままhard disableとして扱います。</p>
        <Formula>artifact hard disable = min(1, duration / 15) × eligible share × affected share</Formula>
        <Formula>combined hard disable = 1 − (1 − weapon hard disable) × (1 − artifact hard disable)</Formula>
        <p>eligible shareとaffected shareはAdvancedで編集できる仮定です。refresh前提の飽和近似で、敵数・半径・耐性・使用タイミング・boss免疫を実測した値ではありません。boss presetはeligible shareを0にし、未対応効果を0点のArtifactとしてOptimizerへ登録しません。</p>
        <p>Artifact SynergyはShock Powderの使用も1回のactivationとして数えますが、Shock Powder自体はDPS・Healing・Defenseへ直接加算しません。既存Artifactなし／Death Cap Mushroom／Iron Hide Amuletの全出力はexact regressionを維持します。</p>
        <p>Fishing Rodは現行版のpull/stun対象・範囲・再使用挙動、Gong of Weakeningは被ダメージ倍率の加算先・範囲・boss挙動が未確定のためResearch-onlyです。出典: <a href="https://minecraft.wiki/w/Dungeons%3AShock_Powder">Shock Powder</a> / <a href="https://minecraft.wiki/w/Dungeons%3A1.16.2.0">1.16.2.0変更履歴</a> / <a href="https://minecraft.wiki/w/Dungeons%3ACorrupted_Seeds">Corrupted Seeds</a>。</p>
      </section>

      <section className="panel">
        <p className="section-label">PHASE 2-1J / CHARGE・CONSUME — PARTIAL</p>
        <h2>蓄積した次の攻撃・自己ダメージ・ロール入力</h2>
        <p>Pain Cycleは5回chargingした次、通常6回目の攻撃がTier I/II/IIIで3/4/5倍。充填ごと最大HP3%を消費します。6回目はHP消費なし・0stackへresetの低信頼度限定解釈で、独立実測は残課題です。5回で戦闘終了なら強化0・残stack5・HP100で自己damage15です。</p>
        <Formula>N=有限攻撃数、E=floor(N/6)、C=N−E、unused=N mod6、bonus=E×B×(M−1)</Formula>
        <p>4武器でprofile hit≒1attack、初撃t=0・終了時刻を除外・全命中・均一baseを仮定します。有限base+bonus合計と従来平均base DPSは別です。主DPSには有限bonus/戦闘秒数だけを加算し、Painなしのbase経路を維持します。</p>
        <Formula>net sustain = gross healing capacity − (C × maxHP × 0.03 / T)</Formula>
        <p>Gross healing / Pain Cycle self damage / Net sustainを分離し、負のnetも符号付き飽和utilityで減点。Paretoはnetを比較します。Iron Hide・Guarding Strike・Weakeningを自己damageへ適用せず、死亡・最低HP・overhealは未再現です。B100・6攻撃ならTier合計800/900/1000、自己damage15。</p>
        <p>Dynamoはroll+1、cap20、次攻撃で全消費。Power210–263の10点×3Tierの独立log補間でexact knotを再現し、外挿しません。表示+X/+1.25X/+1.5Xと数値表は矛盾し、P251は191087/305739/420391です。武器の表示damageから逆算しません。</p>
        <p>AdvancedのrollsPerSecondとdynamoInitialStacksは全profile初期0。初期は整数0〜20。P251/TierIII/初期20/roll0なら最初の攻撃だけ+8,407,820（P263は+13,203,960）。攻撃間の連続roll期待収入を20でcapし全消費、戦闘末尾は未使用で保持します。</p>
        <Formula>等間隔長期consume/s=min(rolls/s,20×attacks/s)；finiteは初撃/各gap/末尾を分離</Formula>
        <p>roll1/s・attack2/s・1000秒なら999.5stack消費、平均0.49975/attack。roll5/s・attack0.1/sなら容量2stack/s・overflow3/s。小数stackの連続近似で、roll animationの攻撃機会損失は省略し上限寄り。Dynamoは直接武器damageへ加算し各近接対象へ適用しますが、公開記述/community報告からの限定解釈でkill/AoEの独立traceは残ります。</p>
        <div className="control-policy-table"><table><thead><tr><th>相手</th><th>Pain Cycle</th><th>Dynamo</th></tr></thead><tbody>
          {CHARGE_UNVERIFIED_MODIFIERS.map((id) => <tr key={id}><th>{ENCHANTMENTS[id].name.en}</th><td>uncertain / 未対応</td><td>uncertain / 未対応</td></tr>)}
          <tr><th>Pain Cycle + Dynamo</th><td colSpan={2}>加算/乗算順・同時consumeのEvidence不足で未対応</td></tr>
          <tr><th>proc / DoT / Exploding</th><td colSpan={2}>formula独立、増幅なし。Explodingは直接撃破sourceのみ連動</td></tr>
        </tbody></table></div>
        <p>平均Pain×平均Voidやcommunityの一般式を採用せず、未確定pairを共通境界で理由付き除外します。Death Cap/Rampagingの速度増加はPainのcycle/自己damageとDynamoのstack消費へ反映。charge自体はControlを直接変更しません。低信頼度factorは選択buildだけへ追加します。</p>
        <p>旧c24f377との回帰を維持。現在のsupport分類は冒頭の台帳表示を参照してください。近接拡張は一旦freezeし、次領域はArtifact拡張を第一候補とします。</p>
        <p>出典: <a href="https://www.dungeons.tools/enchantments/pain-cycle">Pain Cycle</a> / <a href="https://minecraft.wiki/w/Dungeons:Pain_Cycle">3% cost</a> / <a href="https://www.dungeons.tools/enchantments/dynamo">Dynamo consume</a> / <a href="https://minecraft.wiki/w/Dungeons:Dynamo">Tier別数値表</a>。Sawblade・Light Feather・roll armor・Jungle Poisonは対象外です。</p>
      </section>

      <section className="panel">
        <p className="section-label">PHASE 2-1I / CC UTILITY — PARTIAL</p>
        <h2>Controlは行動阻害・集敵の独立した評価</h2>
        <p>Hard disable（移動・攻撃不能）、Attack slow（敵攻撃速度低下）、Root（移動束縛）、Grouping（集敵）を0〜1のraw metricとして保持します。Control utilityは好みの順位付けで、被ダメージ削減の測定値ではありません。DPS・回復・Defense・撃破速度へ換算しません。</p>
        <Formula>active coverage = (1/T) ∫[0,T] (1 − (1−p)^n(t)) dt</Formula>
        <p>n(t)は直前の効果持続時間内のprofile hit数。初撃t=0、戦闘終了で打ち切り、同じ対象へrefreshする限定モデル。初期周期は等比級数、以降は周期積分で計算し、full event simulatorは使いません。AoE敵数をHPSへ掛けず、Death Capと収束後のRampaging速度を使います。</p>
        <p>Chainsは30%、1/2/3秒のrootで、近くの敵は攻撃可能です。game最大4copyですが同時proc・mixed tier・3/4copy・再発動の持続式が未確定のためruntime1copy限定。Stunningは5/10/15%・基準2秒の移動/攻撃不能で、2秒は2022/2023のcommunity計算由来low-confidence（著者重複、実測version未確認）です。</p>
        <p>Freezingは3秒の敵攻撃速度低下30/40/50%で、移動速度は下げません。Gravityは1/1.5/2秒の集敵。Chains/Gravityの対象数は初期1体、射程内敵数との比率をcoverageへ掛けます。Stunning/Freezing/Gravityは各1copy。Gravity+Stunningでもproc確率やDPSにbonusを加えません。</p>
        <p>適用対象割合は編集可能な共通50%の仮定。bossのStunningだけ免疫報告に従って初期0%。powerful mobとApocalypse+の耐性は未確定で、stagger耐性を自動流用せずStunning持続補正0〜1を別入力します。初期補正1は耐性なしの証明ではありません。</p>
        <Formula>Control utility = Σ(subweight × raw coverage) / Σ(subweight)</Formula>
        <Formula>総合Score = 100 × Σ(4軸weight × utility) / Σ(4軸weight)</Formula>
        <p>subweightは4つとも初期1、0の軸は無視し、全て0ならutility0。Scenario weights are ranking choices, not measured game mechanics. これらの好みはEvidence confidenceに混ぜません。重なるCCを敵行動150%抑制などと解釈しないでください。</p>
        <div className="control-policy-table"><table><thead><tr><th>Preset</th><th>Damage</th><th>Healing</th><th>Defense</th><th>Control</th></tr></thead><tbody>{Object.values(SCENARIO_PROFILES).map((s) => <tr key={s.profileId}><th>{s.profileId}</th><td>{s.weights.damage}</td><td>{s.weights.healing}</td><td>{s.weights.defense}</td><td>{s.weights.control}</td></tr>)}</tbody></table></div>
        <p>ParetoはAoE DPS・回復・EHP・Control utilityの4軸。寄与度にはcontrolUtilityDeltaを追加。Control重み0なら旧スコアに一致します。CCなしbuildのDamage/Healing/Defenseとtemporal/soul/DoT状態は変更前commitの4buildと比較しています（software回帰でありゲーム実測ではありません）。</p>
        <p>ChainsのstackとCCのroll/refresh/免疫/半径の不確実性によりPhase 2-1Iはpartialです。CC未選択buildへCCの低信頼度factorを追加しません。</p>
        <p>出典: <a href="https://www.dungeons.tools/enchantments/chains">Chains</a> / <a href="https://www.dungeons.tools/enchantments/stunning">Stunning</a> / <a href="https://www.dungeons.tools/enchantments/freezing">Freezing</a> / <a href="https://www.dungeons.tools/enchantments/gravity">Gravity</a> / <a href="https://minecraft.wiki/w/Dungeons%3AFreezing">Freezing mechanics</a> / <a href="https://www.reddit.com/r/MinecraftDungeons/comments/10chuqi/">Stunning定量説明</a> / <a href="https://www.reddit.com/r/MinecraftDungeons/comments/z369zy/">免疫報告</a>。</p>
      </section>

      <section className="panel">
        <p className="section-label">PHASE 2-1H / DOT & EXPLOSION — PARTIAL</p>
        <h2>燃焼・地面の毒雲・撃破時爆発を別計算</h2>
        <p>Fire Aspectは3秒burn、Tier1/1.25/1.5。Power70–251の11行中、Power250 Tier I=126649を異常値としてrawに残し、runtimeは残り10点のlog補間。全域外挿なし、重複式未確定のため1copy限定です。</p>
        <Formula>Fire DPS = 公開DPS × finite burn coverage（初撃t=0、hit後min(間隔,3秒)、遭遇終了で打切り）</Formula>
        <p>同じ対象への再命中はrefreshし、無限stackしません。AoEは同じ対象へ継続命中する仮定（low）。Power251 IIIは339664.5 DPS、通常速度の4武器はcoverage100%。tick位相・初撃待ちは未再現です。</p>
        <p>Poison Cloudはhit時30%、3秒cloud、Tier1/2/3、最大1copy。7点のPower184–251をlog補間。単体滞在rとAoE target-seconds Tを編集でき、初期値は両方1.5（実測ではない）。</p>
        <Formula>λ=HPS×0.3、単体DPS=listedDps×(1-exp(-λr))、AoE DPS=listedDps×N×(1-exp(-λT/N))</Formula>
        <p>Nは射程内敵数。雲overlapを独立加算しないPoisson定常飽和仮定（low）です。実ゲームの重複・移動・開始時transientは未検証。例えばλ1、DPS100、N2、T3で155.374 AoE DPS、単純加算300にはしません。</p>
        <Formula>Exploding AoE DPS = 直接撃破/s × 平均敵HP × Tier20/40/60% × min(1,max(0,射程内敵数-1))</Formula>
        <p>爆発はPower非依存。死亡sourceへは加算せず単体DPS0、pure bossではAoEも0。直接撃破のみをsourceにし、爆発killから連鎖させません。平均HPと二次対象数はlow仮定、source条件はcommunity根拠（medium）。</p>
        <p>内側のsource撃破率固定点と外側Rampaging uptime固定点を組み合わせ、同じ最終CombatStateでLeeching・Guarding・Refreshment・Soulも再計算。例: Double Axe、表示hit100、敵HP100、供給1/s、射程2、Exploding/Rampaging/Refreshment III、Artifactなしでは初回爆発60→53.47561 DPS、direct share/kill率0.89126016、Rampaging73.73388%、外側6回・内側累計159回、残差はそれぞれ3.36e-10・1.91e-9です。</p>
        <p><strong>3種とVoid Strikeの併用は増幅・消費・reset/reapply未確定のため拒否。</strong>Fireの複数copyも候補から理由付き除外。DoTのfinal blowはdamage-share近似（low）でtick/残HPを再現しません。Fire Focus・Poison Focus・防具は対象外です。</p>
        <p>全Power／stack／Void／overlapが残り2-1Hはpartialです。出典: <a href="https://www.dungeons.tools/enchantments/fire-aspect">Fire</a> / <a href="https://minecraft.wiki/w/Dungeons:Poison_Cloud">Poison表</a> / <a href="https://www.dungeons.tools/enchantments/exploding">Exploding</a>。</p>
      </section>

      <section className="panel">
        <p className="section-label">PHASE 2-1G / SOUL SUBSYSTEM — PARTIAL</p>
        <h2>Soulの吸収回数と資源量を分離</h2>
        <p>Soul Scytheを1種追加。監査済み0.48/0.56秒の2 hit（medium confidence）、内部Power 6.915、基礎Gathering +1、内蔵Enchantなし。Anima / SiphonはSoul gear限定で、既存3武器への装着をcore・Optimizer・通常/金色・保存・JSONでも拒否します。</p>
        <Formula>Gathering = 武器 + 選択Soul enchant各+1、resource/s = pickup/s × Gathering</Formula>
        <p>通常pickupは推定総撃破/sを使用。Siphonはprofile hitごと20%、Tier 1/3/5 pickupsを追加します。AoE target別抽選は現行測定不足のため掛けません。開始0・容量300のno-spending closed formは互換維持し、2-2Cの有限schedulerが開始Soulと離散消費を担当します。</p>
        <Formula>fillTime=C/g、fillTime≧T: 終了=gT/C・平均=gT/(2C)、fillTime&lt;T: 終了1・平均1-fillTime/(2T)</Formula>
        <p>g=0なら平均・終了とも0。一定収入の連続近似（low confidence）で、吸収遅延や離散killsは省略。満タン後もpickupは継続し、resource収入は超過分を含む潜在量です。</p>
        <Formula>Anima回復容量/s = pickup/s × 最大HP × 近接Tier 2/4/6%</Formula>
        <p>Siphon IIIの5 pickupsでAnima IIIは30% maxHP容量。Gathering 5で25 resourcesになっても150%回復にはしません。満タンSoul barでの実回復は未確認のため、満タン後も名目容量を計上する楽観的な仮定です。吸収遅延・overheal・HPが満タンに近い場合の低下を再現せず、healing utilityを過大評価し得ます。遠距離4/6/8%は混ぜません。</p>
        <p>Enigma Resonatorは最大15/20/25%・3xを確認済みですが、途中ゲージの測定がなく線形mappingは未確認。旧100 souls capとBag of Soulsの報告矛盾も残るためresearch-onlyです。固定12.5%や0点候補は作りません。</p>
        <p>Rampagingの同じ解からHPS→Siphon/総撃破→Soul income→ゲージ→Animaを再計算。Enigma未対応なのでSoul→DPSへの逆依存はありません。Rampaging・Explodingなしは反復なし、Soulなしは追加Soul状態なし。効果除去時も全再計算します。</p>
        <p>例: 表示damage26、敵HP100、1体、30秒、Anima/Siphon/Rampaging III、Artifactなし。初期50 DPS → 初回63.190836 → 11回収束65.663588 DPS（残差1.80e-9）。速度1.313272、Soul 9.546476 units/s、平均47.7324%、終了95.4648%。実測ではありません。</p>
        <p>2-1D / 2-1Fもpartialを維持。出典: <a href="https://www.dungeons.tools/damage-calculator">武器係数</a> / <a href="https://minecraft.wiki/w/Dungeons:Utility_Bar">Soul meter</a> / <a href="https://minecraft.wiki/w/Dungeons:Anima_Conduit">Anima履歴</a> / <a href="https://minecraft.wiki/w/Dungeons:Soul_Siphon">Siphon履歴</a>。</p>
      </section>

      <section className="panel">
        <p className="section-label">PHASE 2-1F / TEMPORAL STATE — PARTIAL</p>
        <h2>Artifact Synergy・Rampagingと未対応のEcho</h2>
        <p>Artifact Synergyは使用時の次攻撃だけを+40/60/80%強化。使用頻度は各Artifactの1/推定CDを合算し、持続uptimeとは分離します。pending 1個、profile hit=1攻撃、別攻撃への最適な分散使用をlow confidenceで仮定します。</p>
        <Formula>A=Σ(1/CDᵢ)、C=min(A,H)、direct期待倍率=1+(H&gt;0 ? C/H : 0)×bonus</Formula>
        <p>倍率はCommitted前のdirectだけへ適用し、proc damage/eventを増幅しません。Artifactなしなら発動源がなく寄与0。action/sub-hit粒度と厳密なmodifier合成は未確認です。</p>
        <p>Rampagingは直接撃破の10%で+50%速度、Tier持続5/10/15秒。コピーは秒数だけ加算（最大4）、共通10%発動を採用。間接proc撃破を加算しません。再発動refresh・Poisson近似はlow confidenceです。</p>
        <Formula>u=1-exp(-0.1×直接撃破/s×合計秒数)、速度=Artifact速度倍率+0.5×u</Formula>
        <p>速度→Void/Synergy/proc/Committed→DPS→直接撃破→uを固定点で解きます（許容誤差1e-8、最大100回、非収束はエラー）。例: 初期50 DPS、敵HP100、直接撃破率100%、供給100/秒、Rampaging III → 初回u=52.763%、11回でu=62.654%、速度1.31327倍、65.6636 DPS。数式の整合性であり実測ではありません。</p>
        <p>Death Cap常時なら2→2.5倍で相対+25%。Void倍率は間隔短縮で低下し得ます。平均速度の線形近似はon/off分布やFighter’s Bindingsのframe上限を再現せず、寄与を過大評価し得ます。新しいScenarioスライダーはありません。</p>
        <p>EchoはCD 5/4/3秒・non-stackableを確認済みですが、repeat対象hit、animation/cadence、combo進行、Void、on-hit、直接撃破資格が未解決。無料のdamagePerHit/3を足さず、needs-state-modelのまま候補・JSONから拒否します。</p>
        <p>Echoは未登録、Artifact Synergy / Rampagingは現scope内のFullです。Phase 2-1Fのfull completion gateは未達のためpartialを維持します。</p>
        <p>出典: <a href={ARTIFACT_SYNERGY_SOURCE.url} target="_blank" rel="noreferrer">Artifact Synergy</a> / <a href={RAMPAGING_SOURCE.url} target="_blank" rel="noreferrer">Rampaging</a>。Tier metadataとモデル仮定はconfidenceを分け、使用buildだけへ反映します。</p>
      </section>

      <section className="method-grid">
        <article className="method-card">
          <p className="section-label">01 / 探索</p>
          <h2>手持ち候補を全組み合わせ</h2>
          <p>各武器の3スロットから候補を1つずつ選び、最大3個のアーティファクトと組み合わせます。tierと通常・金色の出所を保持し、non-stackableな重複は候補から除外します。現在は近似探索ではなく全探索です。</p>
          <Formula>候補数 = Σ（各スロット候補数の積 × アーティファクト構成数）</Formula>
        </article>
        <article className="method-card">
          <p className="section-label">02 / 火力</p>
          <h2>単体DPSとAoEを分離</h2>
          <p>表示ダメージまたはPower換算値とAttack Profileからbase DPSを求め、Sharpness、Critical、Void、条件に依存するUnchanting・Smiting・Ambushを直接近接hitだけへ合成します。Voidは最初のhitを1倍、以後は各hit間隔の倍率を使い、毎hit再適用します。平均命中数からAoEを別指標にし、Committedはその後procのHP低下を含む解析積分を適用します。</p>
          <Formula>Crit期待倍率 = 1 + 0.20 × (3.0 − 1) = 1.4</Formula>
          <Formula>Committed前の直接DPS = baseDps × Sharpness × Crit × Void × Unchanting期待値 × Smiting期待値 × Ambush期待値 × Artifact Synergy期待値</Formula>
        </article>
        <article className="method-card">
          <p className="section-label">03 / 回復</p>
          <h2>回復と追加容量を分離</h2>
          <p>輝きは攻撃回数に比例し、複数コピーは発動率を増やさず回復量へ100%・75%・50%・25%の係数を適用します。吸血は武器本体の直接撃破数に比例します。Refreshmentは同じ直接撃破rateからポーション再使用頻度を求め、基礎回復を除いた追加回復容量だけを加点します。実回復ではないlow-confidence proxyを含みます。</p>
          <Formula>直接撃破/s = min（敵供給/s, 総AoE DPS ÷ 平均敵HP）× 直接撃破率 × 直接AoE/総AoE</Formula>
        </article>
        <article className="method-card">
          <p className="section-label">04 / 防御</p>
          <h2>稼働率から実効HPへ</h2>
          <p>Weakeningは対象割合に基づく敵攻撃力低下です。武器本体の直接撃破数から算出したガードストライクの稼働率、アイアンハイドによるhero防御とは別の段階で掛け合わせます。同種Artifactは効果量を重ねず、交互使用による継続時間の更新として扱います。</p>
          <Formula>EHP = 最大HP ÷ 被ダメ倍率</Formula>
        </article>
        <article className="method-card">
          <p className="section-label">05 / スコア</p>
          <h2>過剰回復を飽和させる</h2>
          <p>火力・回復は目標値を超えるほど追加価値を小さくします。回復はPain自己damageを引いたnet sustainを使用し、負のnetも減点します。通常は0〜100、自己damageが上回る場合は総合スコアも負になり得ます。</p>
          <Formula>HealingUtility(net) = sign(net) × (1 − exp(−abs(net) ÷ target))</Formula>
        </article>
        <article className="method-card">
          <p className="section-label">06 / 説明可能性</p>
          <h2>効果を1つずつ外して再計算</h2>
          <p>選ばれたエンチャントとアーティファクトを1つずつ除外し、スコア・DPS・回復・実効HP・Control utilityの差分を表示します。</p>
          <Formula>寄与度 = 完成ビルド − その効果を外したビルド</Formula>
        </article>
      </section>

      <section className="method-section">
        <p className="section-label">PHASE 2-1E / ENEMY-STATE DAMAGE</p>
        <h2>敵の種類・targeting・HP推移を分離</h2>
        <p>Ambushは+20/+40/+60%、攻撃時に対象が自分を狙っていない場合だけ有効で重複不可。Smitingは+25/+35/+45%、Undead限定です。Enchantsmithで通常3枠＋金色1枠まで乗算でき、mixed tiersも同じ条件を共有します。</p>
        <Formula>Ambush期待倍率 = 1 + a × b（Tier III・有効攻撃25% → 1.15倍）</Formula>
        <Formula>Smiting期待倍率 = 1 + u × (Π(1 + bᵢ) − 1)（Tier III×2・Undead50% → 1.55125倍）</Formula>
        <p>Smitingの1.225²は誤りです。active倍率1.45²を先に求め、敵割合を一度だけ適用します。アンデッド50%は中間点、Ambush25%は部分的な機会の例示として置く全profile共通の編集可能なlow-confidence仮定で、実測割合ではありません。enchantedShareは従来の25%を維持します。</p>
        <p>Unchanting・Smiting・Ambushは条件exposureを独立として期待倍率を乗算するMVP近似です。enchanted・undead・targetingの相関を無視し、joint distributionの厳密計算とは呼びません。割合Evidenceは対応効果使用時だけ、factorization Evidenceは複数条件使用時だけ追加します。</p>
        <h3>CommittedはHPを積分する</h3>
        <p>最大bonus bはTier I/II/IIIで0.5/0.75/1、重複不可。残HP比hで瞬間倍率1 + b × (1 − h)。full HPから撃破まで継続攻撃する連続rateモデルです。HPが減るほど短時間で通過するため、Tier IIIの単純平均1.5倍は使いません。</p>
        <Formula>direct-only倍率 = b / log1p(b) → Tier I 1.2332 / II 1.3402 / III 1.4427倍</Formula>
        <Formula>総DPS = D × b / log1p(D × b / (P + D))、直接DPS = 総DPS − P</Formula>
        <p>DはCommitted前の直接DPS、Pは増幅しないproc DPSです。D=100、P=100、Tier IIIなら直接146.6303 + proc100 = 総246.6303。procがHPを減らす効果だけを反映し、procのdamage/eventやcadenceは変えません。単体/AoEは別々のD/Pで積分します。</p>
        <p>数学的な積分検証はhigh、fresh-target→撃破とAoEの同一HP推移仮定はlow。敵ごとの残HP/coverage、target switching、overkill、burst、倒し切れない有限遭遇を再現せず、負傷済み敵やco-op集中攻撃では過小評価し得ます。全modifier間のinteractionも独立実機検証済みではありません。</p>
        <Formula>base direct × Sharpness × Crit × Void × U × S × A → preCommitted direct → proc文脈を含むCommitted積分 → final direct + 元のproc = total</Formula>
        <p>結果の非エンチャント敵/エンチャント敵DPSはCommitted前、直接単体/AoE DPSは適用後です。効果を外すと撃破率・Leeching・Guarding Strike・Refreshmentまで再計算します。Phase 2-1Dはpartialです。</p>
        <p>出典: <a href="https://www.dungeons.tools/enchantments/ambush" target="_blank" rel="noreferrer">Ambush</a> / <a href="https://www.dungeons.tools/enchantments/smiting" target="_blank" rel="noreferrer">Smiting</a> / <a href="https://www.dungeons.tools/enchantments/committed" target="_blank" rel="noreferrer">Committed</a>（1.17.0.0）。<a href="https://minecraft.wiki/w/Dungeons:Smiting" target="_blank" rel="noreferrer">Wiki stacking</a> / <a href="https://minecraft.wiki/w/Dungeons:Committed" target="_blank" rel="noreferrer">Wiki HP mechanics</a>。Ambush・Smitingは1.16.2.0 buff後の値です。</p>
      </section>

      <section className="method-section">
        <p className="section-label">PHASE 2-1B / DIRECT MELEE MODIFIERS</p>
        <h2>敵の割合を含めた期待値</h2>
        <p>切れ味（Sharpness）はTier I / II / IIIで+10% / +21% / +33%。最大4コピーを乗算し、通常Tier III＋金色Tier Iなら1.33 × 1.1です。エンチャント解除（Unchanting）は+50% / +75% / +100%をエンチャント敵だけへ適用し、重複不可です。</p>
        <Formula>Unchanting期待倍率 = (1 − e) × 1 + e × (1 + b) = 1 + e × b</Formula>
        <p>eは直接武器ダメージの対象に占めるエンチャント敵の期待割合、bはTier bonusです。両群を同じbaseline damageで重み付けし、敵ごとのHP・エンチャント敵のHP偏り・優先target・遭遇順序を無視します。Tier IIIで割合0%なら1倍、25%なら1.25倍、100%なら2倍です。</p>
        <p>全6profile（ボスを含む）の初期値25%はMVP model assumption / confidence lowで、実測値ではありません。「エンチャントされた敵の割合」で0〜100%に変更できます。Unchanting選択時だけ敵割合と期待値モデルをEvidenceへ追加し、割合0の寄与0も正常な結果として表示します。</p>
        <p>倍率はこのモデルの直接hit上では数値上交換可能です。ただしCritical判定・Voidの攻撃間隔・敵状態の独立性と全interactionの実機確認は未完了のため、合成Evidenceはlowです。proc/DoT、Shockwave、Swirling、Thundering、Strengthや防具の加算bonusへ一般化しません。</p>
        <p>Tier・stacking・対象条件の根拠はhighで、合成や敵割合の仮定と分けています。出典: <a href={SHARPNESS_SOURCE.url} target="_blank" rel="noreferrer">Sharpness</a> / <a href={UNCHANTING_SOURCE.url} target="_blank" rel="noreferrer">Unchanting</a>（1.17.0.0由来公開データ）。未対応種は候補に登録しません。現在の件数は冒頭のsummaryを参照してください。</p>
      </section>

      <section className="method-section">
        <p className="section-label">PHASE 2-1C / POTION & ENEMY DEBUFF STATE</p>
        <h2>Refreshment — 再使用時間から追加回復容量へ</h2>
        <p>Tier I / II / IIIは、その武器による直接撃破1回につきポーションCDを1 / 2 / 3秒短縮します。最大1個で、近接hit・遠距離projectileが公開仕様上の対象です。runtimeは近接のみ。Shockwave・Swirling・Fire Aspect・Thundering等のproc/DoTやArtifactの撃破は含めません。</p>
        <Formula>ポーション推定CD = 45 ÷ (1 + 直接撃破/s × Tier短縮秒数)</Formula>
        <Formula>追加回復容量/s = 最大HP × 約0.75 × (1 ÷ 推定CD − 1 ÷ 45)</Formula>
        <p>基礎CD45秒はhigh、回復量「最大HPの約75%」はmediumとしてTierとは別Evidenceです。例: 最大HP100、直接撃破1/秒、Tier IIIならCD11.25秒、追加容量5/秒。直接撃破0ならCD45秒で追加容量0。Refreshment未選択時も0で、全Buildへの基礎ポーション回復の加点はしません。</p>
        <p>一定の撃破rateがCD中も継続し、ready時に即再使用するsteady-state近似（low）です。実回復・離散kill timing・ready中の短縮破棄・飲むまでの待機・HP deficit・overheal・戦闘開始終了を再現しません。回復Utility・寄与度・Paretoには追加capacity proxyだけを含めます。Artifactのクールダウン短縮を流用しません。</p>
        <p>PotionStateは基礎CD、直接撃破rate、CD進行速度、推定CD、基礎/推定使用頻度、1回の回復容量、追加容量を保持します。将来のPotion Barrierや防具固有CDから再利用可能ですが、今回は未実装です。DPS増加→kill rate→追加容量の依存だけで、Refreshment自身はDPSを増やしません。</p>
        <p>出典: <a href={REFRESHMENT_SOURCE.url} target="_blank" rel="noreferrer">Refreshment</a> / <a href={HEALTH_POTION_SOURCE.url} target="_blank" rel="noreferrer">Health Potion</a>。直接kill条件はhigh、網羅的な間接kill除外はcommunity由来low、directKillShareと連続rateモデルもlowです。</p>

        <h2>Weakening — 弱体化中の敵からの被ダメージ割合</h2>
        <p>Tier I / II / IIIは周囲の敵の攻撃ダメージを20% / 30% / 40%低下させ、攻撃で5秒間適用します。対象割合sは「被ダメージ発生時点でWeakening中だった敵から来る、基礎被ダメージ量の割合」です。射程・位置・効果時間・攻撃稼働率・target switchingを含む時間平均の仮定です。</p>
        <Formula>敵攻撃ダメージ倍率 = (1 − s) + s × (1 − r) = 1 − s × r</Formula>
        <Formula>最終被ダメージ倍率 = 敵攻撃倍率 × Artifact倍率 × Guarding Strike倍率</Formula>
        <p>全profileの初期値50%は比較開始用の中間点（MVP仮定 / low）です。実測根拠がないためボス等で細分化せず、0〜100%で編集できます。Tier III・割合50%なら0.80倍、割合0なら効果0で、常時40%軽減ではありません。5秒はTier mechanicsとして保持し、割合に含まれるため再度掛けません。</p>
        <p>敵の攻撃力低下とhero防御は別段階です。併用時の時間平均の独立性はlow Evidenceで、DPS・Radiance・Leechingは変更しません。選択していないBuildにはWeakening割合のlow Evidenceを加えません。</p>
        <p>Tier・5秒・周囲への適用は<a href={WEAKENING_SOURCE.url} target="_blank" rel="noreferrer">dungeons.tools</a>由来high。stackingは同サイトのSTACKS Yesと<a href={WEAKENING_STACKING_SOURCE.url} target="_blank" rel="noreferrer">Wikiの重複不可</a>が矛盾します。今回のモデルは通常・金色枠を含め最大1個を採用し、stackingはmedium、相違をauditへ記録しています。このPhase 2-1CではDamageEventを追加していません。後続の範囲限定実装は下記です。防具・Potion Barrier・敵行動simulatorは引き続き未対応です。</p>
      </section>

      <section className="method-section">
        <p className="section-label">PHASE 2-1D PARTIAL / DAMAGE EVENTS</p>
        <h2>武器hitと追加ダメージ、撃破帰属を分離</h2>
        <p>DamageEventContributionは発生源・Tier・trigger・機会/秒・確率・event/秒・damage/event・平均命中数・単体/AoE DPS・直接撃破資格を保持します。離散event simulatorではなくsteady-state期待値です。</p>
        <Formula>総DPS = directWeaponDps + indirectDps</Formula>
        <Formula>Shockwave / Swirling: event/s = attackSpeedMultiplier ÷ combo時間</Formula>
        <Formula>Thundering: event/s = direct HPS × 30%</Formula>
        <p>公開comboから、速度1でBindings 1.73913/s、Double Axe 0.83333/s、Anchor 0.4/s。Swirlingはfinisherのmob命中が必須で、継続命中100%を仮定。Speed proxyだけからcomboは捏造しません。</p>
        <p>公開表38 Power点・114 Tier値を収集。Shockwave 210–252（14点）、Swirling 210–263（18点）、Thundering 248–263（6点）の範囲内だけでTier I表をlog-linear補間し、Tier比1/1.5/2、1/1.5/2、1/2/3を掛けます。Power 251はTier IIIで454392 / 599476 / 282516です（Shockwave公開値454391との差1は丸め）。表示ダメージは武器hit専用でprocへ流用しません。</p>
        <p>歴史的base係数30/40で正規化した共有Power点には最大3.60%の相違。共通curveを裏付ける低Power表がなく、共通化・外挿を採用しません。Phase 2-1Dはpartial、catalog件数は全Power対応を意味しません。範囲外の自由候補は理由付き除外、確定・金色指定はエラーです。</p>
        <p>公開Tier表との最大再構成誤差はShockwave 0.001129%、Swirling 0.225955%、Thundering 0.000603%。Swirling Power 243のTier III値は比率と1000異なるため原表のままauditへ保持。これは入力表のcomponent検証で、独立した実測精度ではありません。表の測定version・個体差・補間の絶対精度は未確定です。</p>
        <p>平均命中数は全種・全profileで初期値1体（low）。定量的な範囲の根拠がないため共通の単体baselineとし、詳細設定で1〜射程内平均敵数へ変更できます。武器Areaは使いません。</p>
        <Formula>directDamageShare = directWeaponAoeDps ÷ totalAoeDps</Formula>
        <p>この割合を既存の直接撃破率へ掛け、吸血・ガードストライク・Refreshmentを計算します。damage share ≈ final-blow shareというlow-confidence proxyで、残HP・overkill・発動順序・対象分布は未再現。procなしならshare=1で従来どおりです。Radianceは直接hit頻度だけを使います。</p>
        <p>Sharpness・Critical・Unchanting・Voidの直接hit倍率はprocへ適用しません。Voidの増幅・消費は別々にuncertainで、runtimeは増幅なし・状態変更なしという限定モデルです。Shockwaveの通常壁とGeomancer構造物の差、空振り・knockback・target switching、Lightning Focus、防具、unique built-inも未実装です。これらのlow Evidenceはprocを使うBuildだけへ追加します。</p>
        <p>公開表: <a href="https://minecraft.wiki/w/Dungeons:Shockwave">Shockwave</a> / <a href="https://minecraft.wiki/w/Dungeons:Swirling">Swirling</a> / <a href="https://minecraft.wiki/w/Dungeons:Thundering">Thundering</a>。
          <a href="https://www.dungeons.tools/enchantments">1.17.0.0 metadata</a>とはPower精度の根拠を分離しています。</p>
      </section>

      <section className="method-section regression-methodology">
        <p className="section-label">DPS実測回帰 / EMPIRICAL MODEL ERROR</p>
        <h2>公開観測値だけでend-to-end誤差を測る</h2>
        <DpsRegressionPanel summary={DAMAGE_MODEL_ERROR} />
        <div className="regression-audit-grid">
          <div><span>公開候補</span><strong>{DPS_AUDIT_SUMMARY.candidateCount}</strong></div>
          <div><span>eligible</span><strong>{DPS_AUDIT_SUMMARY.eligibleCount}</strong></div>
          <div><span>rejected</span><strong>{DPS_AUDIT_SUMMARY.rejectedCount}</strong></div>
          <div><span>1.17.0.0 verified</span><strong>{DPS_AUDIT_SUMMARY.versionConfidenceCounts.verified}</strong></div>
        </div>
        <p>対象は同一targetへの連続hitを再現するsingle-target controlled measurementです。表示ダメージ、attack speed、Enchant / Artifact、計測時間またはDPS、target条件が揃う公開runだけを採用します。Power Curve、Wiki理論表、dungeons.tools計算値、runtime Attack Profile、既存Void Strike curveから作った値は回帰sampleへ入れません。</p>
        <p>今回の監査では条件を再現できる公開sampleは0件でした。武器別coverageは Fighter&apos;s Bindings {DPS_AUDIT_SUMMARY.eligibleByWeapon['fighters-bindings']}件、Double Axe {DPS_AUDIT_SUMMARY.eligibleByWeapon['double-axe']}件、Anchor {DPS_AUDIT_SUMMARY.eligibleByWeapon.anchor}件です。主な除外理由はrun-level raw total / duration不足、observedDamagePerHit不足、完全な速度・build・target条件不足、旧版またはversion不明、計算表の再掲、component validationのみ、です。</p>
        <p>Power scaling・Attack timing・Void Strike timingのcomponent validationは別に存在しますが、full DPS sample数には加算しません。5件に達するまでMAPE / P90 / biasと予測参考範囲はavailable扱いにしません。</p>
        <details className="audit-sources"><summary>監査した公開source（{DPS_AUDIT_SOURCES.length}件）</summary><ul>{DPS_AUDIT_SOURCES.map((source) => <li key={source.id}>{source.url ? <a href={source.url} target="_blank" rel="noreferrer">{source.label}</a> : source.label}</li>)}</ul></details>
      </section>

      <section className="method-section">
        <p className="section-label">対応データ / SUPPORTED DATA</p>
        <div className="support-columns">
          <div><h3>武器（{Object.keys(WEAPONS).length}）</h3>{Object.values(WEAPONS).map((item) => <p key={item.id}>{item.name.ja}<small>{item.name.en}</small></p>)}</div>
          <div><h3>エンチャント（{Object.keys(ENCHANTMENTS).length}）</h3>{Object.values(ENCHANTMENTS).map((item) => <p key={item.id}>{item.name.ja}<small>{item.name.en}</small></p>)}</div>
          <div><h3>アーティファクト（{Object.keys(ARTIFACTS).length}）</h3>{Object.values(ARTIFACTS).map((item) => <p key={item.id}>{item.name.ja}<small>{item.name.en}</small></p>)}</div>
        </div>
      </section>

      <section className="status-section">
        <p className="section-label">仕様書に対する現在地</p>
        <div className="progress-heading"><div><h2>v1.0 Roadmap</h2><p>Phase 2-1K、Artifact 2-2A〜2-2E、Armor foundation 2-3Aは完了。次はArmor Core Runtime Batchです。全33近接・全45 Artifact・全73 Armorの完全再現ではなく、既存partialは元のcompletion gateを維持します。</p></div><strong>{ROADMAP_PROGRESS.percentage}%<small>{ROADMAP_PROGRESS.completed} / {ROADMAP_PROGRESS.total} 項目</small></strong></div>
        <div className="progress-track" aria-label={`ロードマップ進捗${ROADMAP_PROGRESS.percentage}%`}><span style={{ width: `${ROADMAP_PROGRESS.percentage}%` }} /></div>
        <div className="roadmap-grid">
          {ROADMAP_PHASES.map((phase) => {
            const completed = phase.items.filter((item) => item.status === 'done').length
            return <article className="roadmap-phase" key={phase.id}><div><p>{completed} / {phase.items.length}</p><h3>{phase.title}</h3></div><p>{phase.goal}</p><ul>{phase.items.map((item) => <li key={item.label}><span className={`status ${item.status}`}>{STATUS_LABELS[item.status]}</span>{item.label}</li>)}</ul></article>
          })}
        </div>
      </section>

      <section className="warning-panel">
        <h2>精度上の重要な制約</h2>
        <p>Power換算は公開Anchor表をlog補間し、1.17.0.0の内部Power rating比を適用するmedium-confidence値です。Void Strikeは公開community測定に基づくlow-confidenceのDecision Bモデル（付与hit 1倍、armed後1.25倍、3.6秒でTier III 7倍、5秒で消滅）で、frame実測済みではありません。厳密なcurve、tier別minimum、外部damage消費は未確定です。同じtargetへの連続hitを前提とするため、target switchingがあるmobbingではVoid Strike DPSを過大評価し得ます。version不明のWiki damage表29件とは最大45.06%ずれます。Evidence coverageとDPS実測回帰は別指標で、前者は正解確率ではありません。</p>
      </section>
    </main>
  )
}
