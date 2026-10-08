import { useState, type ChangeEvent } from 'react'
import type { Scenario } from '../core/types'
import {
  addScenarioPreset,
  clearScenarioPresets,
  deserializeScenarioPresets,
  loadScenarioPresets,
  mergeScenarioPresets,
  MAX_SCENARIO_PRESETS,
  removeScenarioPreset,
  serializeScenarioPresets,
  saveScenarioPresets,
  updateScenarioPreset,
  type SavedScenarioPreset,
} from '../scenario/presets'

export function ScenarioPresetsPanel({ scenario, onLoad }: { scenario: Scenario; onLoad: (scenario: Scenario) => void }) {
  const [initialLoad] = useState(loadScenarioPresets)
  const [presets, setPresets] = useState<readonly SavedScenarioPreset[]>(initialLoad.presets)
  const [storageError, setStorageError] = useState<string | null>(initialLoad.error)
  const [name, setName] = useState('')
  const [selectedId, setSelectedId] = useState('')
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importing, setImporting] = useState(false)
  const [message, setMessage] = useState('')
  const [messageIsError, setMessageIsError] = useState(false)

  const selectedPreset = presets.find((preset) => preset.id === selectedId)

  const persist = (next: readonly SavedScenarioPreset[], successMessage: string): boolean => {
    try {
      saveScenarioPresets(next)
      setPresets(next)
      setStorageError(null)
      setMessage(successMessage)
      setMessageIsError(false)
      return true
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '条件を保存できませんでした。')
      setMessageIsError(true)
      return false
    }
  }

  const downloadPresets = () => {
    try {
      const json = serializeScenarioPresets(presets)
      const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
      const link = document.createElement('a')
      link.href = url
      link.download = `mcd-scenario-presets-${new Date().toISOString().slice(0, 10)}.json`
      document.body.append(link)
      try { link.click() } finally {
        link.remove()
        window.setTimeout(() => URL.revokeObjectURL(url), 30_000)
      }
      setMessage('保存済み条件JSONのダウンロードを開始しました。')
      setMessageIsError(false)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '保存済み条件を書き出せませんでした。')
      setMessageIsError(true)
    }
  }

  const selectImportFile = (event: ChangeEvent<HTMLInputElement>) => {
    setImportFile(event.target.files?.[0] ?? null)
    event.target.value = ''
  }

  const importSelectedFile = async () => {
    if (!importFile) return
    setImporting(true)
    setMessage('ファイルを検証しています。')
    setMessageIsError(false)
    try {
      if (importFile.size > 1_000_000) throw new Error('JSONファイルは1MB以下にしてください。')
      const imported = deserializeScenarioPresets(await importFile.text())
      const next = mergeScenarioPresets(presets, imported)
      if (persist(next, `${imported.length}件の保存済み条件を追加しました。`)) {
        setImportFile(null)
        setSelectedId(imported[0]?.id ?? selectedId)
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '保存済み条件を読み込めませんでした。')
      setMessageIsError(true)
    } finally {
      setImporting(false)
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
      setMessageIsError(true)
    }
  }

  const loadSelected = () => {
    if (!selectedPreset) return
    onLoad(selectedPreset.scenario)
    setMessage(`「${selectedPreset.name}」を読み込みました。Optimizerの探索はまだ開始していません。`)
    setMessageIsError(false)
  }

  const updateSelected = () => {
    if (!selectedPreset) return
    try {
      const next = updateScenarioPreset(presets, selectedPreset.id, scenario)
      persist(next, `「${selectedPreset.name}」を現在条件で更新しました。`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '保存済み条件を更新できませんでした。')
      setMessageIsError(true)
    }
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
      setMessageIsError(false)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '保存済み条件を初期化できませんでした。')
      setMessageIsError(true)
    }
  }

  return <section className="scenario-presets" aria-labelledby="scenario-presets-title">
    <div className="scenario-presets-heading"><div><p className="section-label">SAVED CONDITIONS</p><h3 id="scenario-presets-title">条件を保存して再利用</h3></div><span>{presets.length} / {MAX_SCENARIO_PRESETS}</span></div>
    <p>詳細条件と評価方針を含む現在の条件を保存します。読み込んだ条件で探索を始めるには、最適化ボタンを押してください。</p>
    <div className="scenario-presets-save">
      <label htmlFor="scenario-preset-name">保存名<input id="scenario-preset-name" type="text" maxLength={40} value={name} onChange={(event) => setName(event.target.value)} placeholder="例: 高難度・近接" /></label>
      <button type="button" onClick={saveCurrent} disabled={Boolean(storageError) || importing || !name.trim() || presets.length >= MAX_SCENARIO_PRESETS}>現在の条件を保存</button>
    </div>
    <div className="scenario-presets-load">
      <label htmlFor="scenario-preset-select">保存済み条件<select id="scenario-preset-select" value={selectedId} onChange={(event) => setSelectedId(event.target.value)} disabled={Boolean(storageError) || importing || presets.length === 0}>
        <option value="">条件を選択</option>
        {presets.map((preset) => <option value={preset.id} key={preset.id}>{preset.name}</option>)}
      </select></label>
      <button type="button" onClick={loadSelected} disabled={!selectedPreset || Boolean(storageError) || importing}>読み込む</button>
      <button type="button" onClick={deleteSelected} disabled={!selectedPreset || Boolean(storageError) || importing}>削除</button>
    </div>
    <div className="scenario-presets-update">
      <button type="button" onClick={updateSelected} disabled={!selectedPreset || Boolean(storageError) || importing}>選択中の条件を現在条件で上書き</button>
    </div>
    <div className="scenario-presets-transfer">
      <button type="button" onClick={downloadPresets} disabled={Boolean(storageError) || importing || presets.length === 0}>JSONを書き出す</button>
      <label htmlFor="scenario-presets-file">JSONファイル<input id="scenario-presets-file" type="file" accept=".json,application/json" disabled={Boolean(storageError) || importing} onChange={selectImportFile} /></label>
      <button type="button" onClick={importSelectedFile} disabled={Boolean(storageError) || importing || !importFile || presets.length >= MAX_SCENARIO_PRESETS}>{importing ? '検証中…' : 'JSONを追加'}</button>
    </div>
    <small>読み込んだ条件は一覧へ追加します。形式・重複名・最大{MAX_SCENARIO_PRESETS}件の制限に合わない場合、現在の保存内容は変わりません。</small>
    <p className="scenario-presets-message" role={storageError || messageIsError ? 'alert' : 'status'}>{message || storageError || `${MAX_SCENARIO_PRESETS}件まで、このブラウザに保存できます。`}</p>
    {storageError && <button className="scenario-presets-reset" type="button" onClick={resetCorruptStorage}>読み込めない保存済み条件を削除して初期化</button>}
    <small>保存済み条件はこのブラウザ内に保存され、Inventory JSONには含まれません。別のブラウザへ移す場合は上のJSONを書き出してください。</small>
  </section>
}
