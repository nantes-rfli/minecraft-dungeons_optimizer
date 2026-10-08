import { useState } from 'react'
import type { Scenario } from '../core/types'
import {
  addScenarioPreset,
  clearScenarioPresets,
  loadScenarioPresets,
  MAX_SCENARIO_PRESETS,
  removeScenarioPreset,
  saveScenarioPresets,
  type SavedScenarioPreset,
} from '../scenario/presets'

export function ScenarioPresetsPanel({ scenario, onLoad }: { scenario: Scenario; onLoad: (scenario: Scenario) => void }) {
  const [initialLoad] = useState(loadScenarioPresets)
  const [presets, setPresets] = useState<readonly SavedScenarioPreset[]>(initialLoad.presets)
  const [storageError, setStorageError] = useState<string | null>(initialLoad.error)
  const [name, setName] = useState('')
  const [selectedId, setSelectedId] = useState('')
  const [message, setMessage] = useState('')

  const selectedPreset = presets.find((preset) => preset.id === selectedId)

  const persist = (next: readonly SavedScenarioPreset[], successMessage: string): boolean => {
    try {
      saveScenarioPresets(next)
      setPresets(next)
      setStorageError(null)
      setMessage(successMessage)
      return true
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '条件を保存できませんでした。')
      return false
    }
  }

  const saveCurrent = () => {
    try {
      const next = addScenarioPreset(presets, {
        id: `scenario-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name,
        scenario,
      })
      if (!persist(next, `「${name.trim()}」を保存しました。`)) return
      setSelectedId(next[next.length - 1]?.id ?? '')
      setName('')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '条件を保存できませんでした。')
    }
  }

  const loadSelected = () => {
    if (!selectedPreset) return
    onLoad(selectedPreset.scenario)
    setMessage(`「${selectedPreset.name}」を読み込みました。Optimizerの探索はまだ開始していません。`)
  }

  const deleteSelected = () => {
    if (!selectedPreset || !window.confirm(`保存済み条件「${selectedPreset.name}」を削除しますか？`)) return
    const next = removeScenarioPreset(presets, selectedPreset.id)
    if (persist(next, `「${selectedPreset.name}」を削除しました。`)) setSelectedId('')
  }

  const resetCorruptStorage = () => {
    if (!window.confirm('読み込めない保存済み条件をすべて削除して初期化しますか？')) return
    try {
      clearScenarioPresets()
      setPresets([])
      setStorageError(null)
      setSelectedId('')
      setMessage('保存済み条件を初期化しました。')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '保存済み条件を初期化できませんでした。')
    }
  }

  return <section className="scenario-presets" aria-labelledby="scenario-presets-title">
    <div className="scenario-presets-heading"><div><p className="section-label">SAVED CONDITIONS</p><h3 id="scenario-presets-title">条件を保存して再利用</h3></div><span>{presets.length} / {MAX_SCENARIO_PRESETS}</span></div>
    <p>詳細条件と評価方針を含む現在の条件を保存します。読み込んだ条件で探索を始めるには、最適化ボタンを押してください。</p>
    <div className="scenario-presets-save">
      <label htmlFor="scenario-preset-name">保存名<input id="scenario-preset-name" type="text" maxLength={40} value={name} onChange={(event) => setName(event.target.value)} placeholder="例: 高難度・近接" /></label>
      <button type="button" onClick={saveCurrent} disabled={Boolean(storageError) || !name.trim() || presets.length >= MAX_SCENARIO_PRESETS}>現在の条件を保存</button>
    </div>
    <div className="scenario-presets-load">
      <label htmlFor="scenario-preset-select">保存済み条件<select id="scenario-preset-select" value={selectedId} onChange={(event) => setSelectedId(event.target.value)} disabled={Boolean(storageError) || presets.length === 0}>
        <option value="">条件を選択</option>
        {presets.map((preset) => <option value={preset.id} key={preset.id}>{preset.name}</option>)}
      </select></label>
      <button type="button" onClick={loadSelected} disabled={!selectedPreset || Boolean(storageError)}>読み込む</button>
      <button type="button" onClick={deleteSelected} disabled={!selectedPreset || Boolean(storageError)}>削除</button>
    </div>
    <p className="scenario-presets-message" role={storageError ? 'alert' : 'status'}>{message || storageError || `${MAX_SCENARIO_PRESETS}件まで、このブラウザに保存できます。`}</p>
    {storageError && <button className="scenario-presets-reset" type="button" onClick={resetCorruptStorage}>読み込めない保存済み条件を削除して初期化</button>}
    <small>保存済み条件はこのブラウザ内だけに保存され、Inventory JSONには含まれません。</small>
  </section>
}
