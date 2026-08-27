import { useMemo, useState, type ChangeEvent } from 'react'
import { ARTIFACTS } from './data/artifacts'
import { ENCHANTMENTS } from './data/enchantments'
import { DEFAULT_SCENARIO } from './data/scenarios'
import { WEAPONS } from './data/weapons'
import { optimize } from './core'
import type {
  ArtifactId,
  Evaluation,
  Inventory,
  Scenario,
  LocalizedName,
  WeaponId,
  WeaponInventoryItem,
} from './core'
import './styles.css'

const SAMPLE_WEAPONS: readonly WeaponInventoryItem[] = [
  {
    instanceId: 'bindings-1',
    weaponId: 'fighters-bindings',
    enchantmentSlots: [
      ['radiance', 'critical-hit'],
      ['leeching', 'guarding-strike'],
      ['void-strike', 'critical-hit'],
    ],
  },
  {
    instanceId: 'double-axe-1',
    weaponId: 'double-axe',
    enchantmentSlots: [
      ['critical-hit', 'void-strike'],
      ['leeching', 'radiance'],
      ['guarding-strike', 'critical-hit'],
    ],
  },
  {
    instanceId: 'anchor-1',
    weaponId: 'anchor',
    enchantmentSlots: [
      ['void-strike', 'critical-hit'],
      ['leeching', 'guarding-strike'],
      ['radiance', 'critical-hit'],
    ],
  },
]

const OBJECTIVES = {
  damage: { label: '火力', weights: { damage: 0.8, healing: 0.1, defense: 0.1 } },
  balanced: { label: 'バランス', weights: { damage: 0.5, healing: 0.25, defense: 0.25 } },
  survival: { label: '安定攻略', weights: { damage: 0.1, healing: 0.45, defense: 0.45 } },
} as const

type ObjectiveId = keyof typeof OBJECTIVES

const numberFormat = new Intl.NumberFormat('ja-JP', { maximumFractionDigits: 2 })
const percentage = (value: number): string => `${Math.round(value * 100)}%`
const CONFIDENCE_LABELS = { high: '高', medium: '中', low: '低' } as const

function BilingualName({ name }: { name: LocalizedName }) {
  return (
    <>
      <span>{name.ja}</span>
      <small lang="en">{name.en}</small>
    </>
  )
}

function Metric({ label, value, suffix = '' }: { label: string; value: number; suffix?: string }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>
        {numberFormat.format(value)}{suffix}
      </strong>
    </div>
  )
}

function BuildSummary({ evaluation, compact = false }: { evaluation: Evaluation; compact?: boolean }) {
  const weapon = WEAPONS[evaluation.build.weapon.weaponId]
  return (
    <article className={compact ? 'result-card compact' : 'result-card'}>
      <div className="result-heading">
        <div>
          <p className="eyebrow">{compact ? '次点候補' : '推奨ビルド'}</p>
          <h2>
            {weapon.name.ja}
            <small lang="en">{weapon.name.en}</small>
          </h2>
        </div>
        <div className="score">
          <span>目的スコア</span>
          <strong>{numberFormat.format(evaluation.objectiveScore)}</strong>
        </div>
      </div>

      <div className="chips">
        {evaluation.build.enchantments.map((id, index) => (
          <span className="chip" key={`${id}-${index}`}>
            <BilingualName name={ENCHANTMENTS[id].name} />
          </span>
        ))}
        {evaluation.build.artifacts.map((id) => (
          <span className="chip artifact" key={id}>
            <BilingualName name={ARTIFACTS[id].name} />
          </span>
        ))}
      </div>

      {!compact && (
        <>
          <div className="metrics-grid">
            <Metric label="単体DPS（正規化）" value={evaluation.damage.singleTargetDps} />
            <Metric label="AoE DPS（正規化）" value={evaluation.damage.aoeDps} />
            <Metric label="回復 / 秒" value={evaluation.healing.totalPerSecond} />
            <Metric label="実効HP" value={evaluation.defense.effectiveHealth} />
          </div>
          <ul className="reasons">
            {evaluation.reasons.map((reason) => <li key={reason}>{reason}</li>)}
          </ul>
        </>
      )}
    </article>
  )
}

export default function App() {
  const [selectedWeapons, setSelectedWeapons] = useState<readonly WeaponId[]>(
    SAMPLE_WEAPONS.map((weapon) => weapon.weaponId),
  )
  const [selectedArtifacts, setSelectedArtifacts] = useState<readonly ArtifactId[]>([
    'death-cap-mushroom',
    'iron-hide-amulet',
  ])
  const [objective, setObjective] = useState<ObjectiveId>('balanced')
  const [scenario, setScenario] = useState<Scenario>({
    ...DEFAULT_SCENARIO,
    weights: OBJECTIVES.balanced.weights,
  })

  const inventory: Inventory = useMemo(
    () => ({
      weapons: SAMPLE_WEAPONS.filter((weapon) => selectedWeapons.includes(weapon.weaponId)),
      artifacts: selectedArtifacts,
    }),
    [selectedArtifacts, selectedWeapons],
  )

  const optimization = useMemo(() => {
    try {
      return { result: optimize(inventory, scenario), error: null }
    } catch (error) {
      return {
        result: null,
        error: error instanceof Error ? error.message : '計算中に不明なエラーが発生しました。',
      }
    }
  }, [inventory, scenario])

  const toggleWeapon = (weaponId: WeaponId) => {
    setSelectedWeapons((current) =>
      current.includes(weaponId)
        ? current.filter((id) => id !== weaponId)
        : [...current, weaponId],
    )
  }

  const toggleArtifact = (artifactId: ArtifactId) => {
    setSelectedArtifacts((current) =>
      current.includes(artifactId)
        ? current.filter((id) => id !== artifactId)
        : [...current, artifactId],
    )
  }

  const updateNumber =
    (key: keyof Pick<Scenario, 'killsPerSecond' | 'averageTargetsInReach' | 'cooldownReduction'>) =>
    (event: ChangeEvent<HTMLInputElement>) => {
      setScenario((current) => ({ ...current, [key]: Number(event.target.value) }))
    }

  const chooseObjective = (id: ObjectiveId) => {
    setObjective(id)
    setScenario((current) => ({ ...current, weights: OBJECTIVES[id].weights }))
  }

  return (
    <main>
      <header className="hero">
        <div>
          <p className="eyebrow">最適化コア試作版 · v0.1</p>
          <h1>Minecraft Dungeons<br />最適装備ツール</h1>
          <p className="product-name" lang="en">Gear Optimizer</p>
          <p className="lede">
            手持ち候補を全探索し、火力・回復・防御を同じシナリオで比較します。
          </p>
        </div>
        <div className="confidence-note">
          <span>計算モデル</span>
          <strong>検証中</strong>
          <p>ゲーム内実測前の数値は、根拠と信頼度を分離して管理しています。</p>
        </div>
      </header>

      <section className="workspace">
        <aside className="controls">
          <div className="control-section">
            <p className="section-label">01 / 比較する武器</p>
            {SAMPLE_WEAPONS.map((item) => {
              const weapon = WEAPONS[item.weaponId]
              return (
                <label className="selection-row" key={item.instanceId}>
                  <input
                    type="checkbox"
                    checked={selectedWeapons.includes(item.weaponId)}
                    onChange={() => toggleWeapon(item.weaponId)}
                  />
                  <span>
                    <strong>{weapon.name.ja}</strong>
                    <small lang="en">{weapon.name.en}</small>
                    <small>PWR {weapon.power.value} · SPD {weapon.speed.value} · AREA {weapon.area.value}</small>
                  </span>
                </label>
              )
            })}
          </div>

          <div className="control-section">
            <p className="section-label">02 / アーティファクト</p>
            {(Object.keys(ARTIFACTS) as ArtifactId[]).map((id) => (
              <label className="selection-row" key={id}>
                <input
                  type="checkbox"
                  checked={selectedArtifacts.includes(id)}
                  onChange={() => toggleArtifact(id)}
                />
                <span>
                  <strong>{ARTIFACTS[id].name.ja}</strong>
                  <small lang="en">{ARTIFACTS[id].name.en}</small>
                </span>
              </label>
            ))}
          </div>

          <div className="control-section">
            <p className="section-label">03 / 最適化目的</p>
            <div className="segmented">
              {(Object.keys(OBJECTIVES) as ObjectiveId[]).map((id) => (
                <button
                  className={objective === id ? 'active' : ''}
                  key={id}
                  onClick={() => chooseObjective(id)}
                  type="button"
                >
                  {OBJECTIVES[id].label}
                </button>
              ))}
            </div>
          </div>

          <div className="control-section sliders">
            <p className="section-label">04 / シナリオ</p>
            <label>
              <span>撃破 / 秒 <output>{scenario.killsPerSecond.toFixed(1)}</output></span>
              <input type="range" min="0" max="2" step="0.1" value={scenario.killsPerSecond} onChange={updateNumber('killsPerSecond')} />
            </label>
            <label>
              <span>射程内の敵 <output>{scenario.averageTargetsInReach.toFixed(1)}</output></span>
              <input type="range" min="1" max="6" step="0.5" value={scenario.averageTargetsInReach} onChange={updateNumber('averageTargetsInReach')} />
            </label>
            <label>
              <span>クールダウン短縮 <output>{percentage(scenario.cooldownReduction)}</output></span>
              <input type="range" min="0" max="0.75" step="0.05" value={scenario.cooldownReduction} onChange={updateNumber('cooldownReduction')} />
            </label>
          </div>
        </aside>

        <section className="results" aria-live="polite">
          {optimization.error && <div className="error-panel">{optimization.error}</div>}
          {optimization.result && (
            <>
              <div className="result-meta">
                <span>{optimization.result.evaluatedBuildCount}通りを全探索</span>
                <span>
                  信頼度 {percentage(optimization.result.best.confidence.score)}
                  （{CONFIDENCE_LABELS[optimization.result.best.confidence.label]}）
                </span>
              </div>
              <BuildSummary evaluation={optimization.result.best} />
              <h3 className="alternatives-title">次点候補</h3>
              <div className="alternatives">
                {optimization.result.alternatives.map((evaluation) => (
                  <BuildSummary
                    compact
                    evaluation={evaluation}
                    key={`${evaluation.build.weapon.instanceId}-${evaluation.build.enchantments.join('-')}`}
                  />
                ))}
              </div>
              <details className="caveats">
                <summary>計算上の注意</summary>
                <ul>
                  {optimization.result.best.confidence.caveats.map((caveat) => <li key={caveat}>{caveat}</li>)}
                </ul>
              </details>
            </>
          )}
        </section>
      </section>
    </main>
  )
}
