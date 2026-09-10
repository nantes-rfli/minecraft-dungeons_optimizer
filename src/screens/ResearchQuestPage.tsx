"use client"

import { useMemo, useState } from 'react'
import type { Inventory } from '../core'
import {
  buildPhase7Submission,
  captureResearchQuestRun,
  defaultResearchQuestState,
  LIMITED_DR_CONDITION_LABELS,
  loadResearchQuestState,
  PHASE7_GAP_IDS,
  resolveResearchQuestReadiness,
  saveResearchQuestState,
  type ResearchQuestMode,
  type ResearchQuestRunDraft,
  type ResearchQuestState,
} from '../research/researchQuest'
import { LIMITED_DR_ACCEPTANCE_PLAN, type LimitedDrConditionId } from '../research/limitedDrValidation'

const MODES: readonly { id: ResearchQuestMode; label: string; description: string }[] = [
  { id: 'observe', label: 'Observe', description: '表示・発動・状態を記録する課題' },
  { id: 'measure', label: 'Measure', description: '時間や数値を反復測定する課題' },
  { id: 'experiment', label: 'Experiment', description: '単独・組合せを比較する課題' },
]

const newDraft = (): ResearchQuestRunDraft => ({
  id: '', condition: 'baseline', originGroup: '', incomingHitId: '', originKind: 'self-observation',
  rawTraceUrl: '', rawTraceSha256: '', rawTraceRecord: null,
  activationFrameLocators: [], baselineDamage: 0, observedDamage: [], platform: '', difficulty: '',
  capturedAt: new Date().toISOString(), reviewed: false,
  equipment: [],
})

const parseDamage = (value: string) => value.split(/[\s,]+/).filter(Boolean).map(Number)

export function ResearchQuestPage({ inventory }: { inventory: Inventory }) {
  const [state, setState] = useState<ResearchQuestState>(() => {
    try { return loadResearchQuestState() } catch { return defaultResearchQuestState() }
  })
  const [draft, setDraft] = useState<ResearchQuestRunDraft>(() => state.draft ?? newDraft())
  const [damageText, setDamageText] = useState(() => state.draft?.observedDamage.join('\n') ?? '')
  const [activationText, setActivationText] = useState(() => state.draft?.activationFrameLocators.join('\n') ?? '')
  const [message, setMessage] = useState('この記録は装備JSONとは別に、このブラウザへ保存されます。')
  const [exportText, setExportText] = useState('')
  const readiness = useMemo(() => resolveResearchQuestReadiness(inventory), [inventory])
  const eligibleRuns = state.runs.filter((run) => run.observedDamage.length >= LIMITED_DR_ACCEPTANCE_PLAN.minimumHitsPerRun)
  const progress = Object.fromEntries(LIMITED_DR_ACCEPTANCE_PLAN.requiredConditions.map((condition) => [condition, eligibleRuns.filter((run) => run.condition === condition).length])) as Record<LimitedDrConditionId, number>
  const completedConditions = LIMITED_DR_ACCEPTANCE_PLAN.requiredConditions.filter((condition) => progress[condition] >= LIMITED_DR_ACCEPTANCE_PLAN.minimumIndependentRunsPerCondition).length

  const updateState = (patch: Partial<ResearchQuestState>) => setState((current) => {
    const next = { ...current, ...patch, updatedAt: new Date().toISOString() }
    try { saveResearchQuestState(next) }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Research Questを保存できませんでした。') }
    return next
  })
  const recordRun = async () => {
    try {
      const nextDraft = await captureResearchQuestRun({ ...draft, observedDamage: parseDamage(damageText), activationFrameLocators: activationText.split(/[,\n]+/).map((value) => value.trim()).filter(Boolean) }, inventory)
      const submission = buildPhase7Submission({ ...state, status: 'active', runs: [...state.runs, nextDraft], updatedAt: new Date().toISOString() })
      updateState({ status: 'active', runs: [...state.runs, nextDraft], draft: null })
      setDraft(newDraft())
      setDamageText('')
      setActivationText('')
      setExportText('')
      setMessage(`runを保存しました。8C対象 ${submission.validation.evidenceBoundary.eligibleIndependentHoldoutRuns} / 24 run。`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'runを保存できませんでした。')
    }
  }
  const exportSubmission = () => {
    try {
      const submission = buildPhase7Submission(state)
      setExportText(`${JSON.stringify(submission, null, 2)}\n`)
      setMessage(`8A/8C受け渡しJSONを生成しました。判定は ${submission.validation.adoptionDecision.decision} です。`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '受け渡しJSONを生成できませんでした。')
    }
  }
  const pauseWithDraft = () => {
    updateState({ status: 'paused', draft: { ...draft, observedDamage: parseDamage(damageText), activationFrameLocators: activationText.split(/[,\n]+/).map((value) => value.trim()).filter(Boolean) } })
    setMessage('入力途中の内容を保存して中断しました。')
  }

  return <main id="main-content" tabIndex={-1} className="page-main research-page">
    <header className="page-intro page-intro-row">
      <div><p className="eyebrow">PERSONAL RESEARCH / PHASE 7</p><h1>調査クエスト</h1><p>所持装備で実施できる不足Evidenceだけを選び、途中保存しながら8A/8Cへ渡せるraw traceを作ります。</p></div>
      <div className="research-progress"><strong>{eligibleRuns.length}<small>/ 24 RUN</small></strong><span>{completedConditions} / 8 条件完了</span></div>
    </header>

    <section className="research-mode-tabs" aria-label="調査方法">
      {MODES.map((mode) => <button key={mode.id} type="button" aria-pressed={state.mode === mode.id} onClick={() => updateState({ mode: mode.id })}><strong>{mode.label}</strong><span>{mode.description}</span></button>)}
    </section>

    {state.mode !== 'experiment' ? <section className="empty-state research-empty"><span aria-hidden="true">○</span><h2>現在の残余queueには{state.mode === 'observe' ? 'Observe' : 'Measure'}課題がありません</h2><p>8Bで選定した最初の単位はExperimentです。外部取得済み・所持外の課題を必須にはしません。</p></section> : <>
      <section className={`quest-card ${readiness.ready ? 'ready' : 'unavailable'}`}>
        <div className="quest-heading"><div><p className="section-label">EXPERIMENT · P0 UNIT</p><h2>限定DRの組合せ</h2><p>35% Armor・Iron Hide・Guarding Strikeを、同じincoming hitで全8条件比較します。</p></div><span className="quest-status">{readiness.ready ? '実施可能' : readiness.selectionRequired.length > 0 && readiness.missing.length === 0 ? '選択が必要' : '装備不足'}</span></div>
        <div className="quest-facts"><div><span>所要時間</span><strong>未算定</strong></div><div><span>最低記録量</span><strong>24 runs · 240 hits</strong></div><div><span>解決候補</span><strong>{PHASE7_GAP_IDS.length} gaps</strong></div><div><span>出口</span><strong>8C AdoptionDecision</strong></div></div>
        {!readiness.ready && <div className="quest-missing"><strong>この課題は必須queueへ追加しません</strong><p>{readiness.missing.length > 0 && <>不足: {readiness.missing.join('、')}。 </>}{readiness.selectionRequired.length > 0 && <>選択が必要: {readiness.selectionRequired.join('、')}。 </>}装備画面の現在の選択内容から再判定します。</p></div>}
        <div className="quest-actions">
          <button className="primary-button" type="button" disabled={!readiness.ready} onClick={() => updateState({ status: 'active' })}>{state.status === 'paused' ? '調査を再開' : 'この調査を開始'}</button>
          <button type="button" onClick={() => updateState({ status: 'skipped' })}>今はスキップ</button>
          {state.status === 'active' && <button type="button" onClick={pauseWithDraft}>中断して保存</button>}
        </div>
      </section>

      {readiness.ready && state.status === 'active' && <section className="quest-workspace">
        <div className="condition-progress"><div className="section-heading"><div><p className="section-label">PROTOCOL PROGRESS</p><h2>全8条件の独立run</h2></div><span>各3 run × 10 hit以上</span></div>
          <div className="condition-grid">{LIMITED_DR_ACCEPTANCE_PLAN.requiredConditions.map((condition) => <article className={progress[condition] >= 3 ? 'complete' : ''} key={condition}><span>{LIMITED_DR_CONDITION_LABELS[condition]}</span><strong>{progress[condition]} / 3</strong></article>)}</div>
        </div>

        <form className="run-form" onSubmit={(event) => { event.preventDefault(); void recordRun() }}>
          <div className="section-heading"><div><p className="section-label">RAW TRACE INTAKE</p><h2>1 runを記録</h2></div><span>Game 1.17.0.0 · direct mob attack</span></div>
          <div className="run-fields">
            <label>条件<select value={draft.condition} onChange={(event) => setDraft({ ...draft, condition: event.target.value as LimitedDrConditionId })}>{LIMITED_DR_ACCEPTANCE_PLAN.requiredConditions.map((condition) => <option key={condition} value={condition}>{LIMITED_DR_CONDITION_LABELS[condition]}</option>)}</select></label>
            <label>run ID<input value={draft.id} placeholder="例: dr-20260910-01" onChange={(event) => setDraft({ ...draft, id: event.target.value })} /></label>
            <label>独立origin ID<input value={draft.originGroup} placeholder="測定者・収録単位" onChange={(event) => setDraft({ ...draft, originGroup: event.target.value })} /></label>
            <label>incoming hit ID<input value={draft.incomingHitId} placeholder="全runで同じID" onChange={(event) => setDraft({ ...draft, incomingHitId: event.target.value })} /></label>
            <label>Platform<input value={draft.platform} placeholder="例: Windows" onChange={(event) => setDraft({ ...draft, platform: event.target.value })} /></label>
            <label>Difficulty<input value={draft.difficulty} placeholder="難易度・ミッション" onChange={(event) => setDraft({ ...draft, difficulty: event.target.value })} /></label>
            <label>Evidence種別<select value={draft.originKind} onChange={(event) => setDraft({ ...draft, originKind: event.target.value as ResearchQuestRunDraft['originKind'], rawTraceUrl: '', rawTraceSha256: '', rawTraceRecord: null })}><option value="self-observation">自前測定</option><option value="external">外部Evidence</option></select></label>
            <label>Baseline damage<input type="number" min="0.01" step="any" value={draft.baselineDamage || ''} onChange={(event) => setDraft({ ...draft, baselineDamage: Number(event.target.value) })} /></label>
            <label>記録日時<input type="datetime-local" value={draft.capturedAt.slice(0, 16)} onChange={(event) => setDraft({ ...draft, capturedAt: new Date(event.target.value).toISOString() })} /></label>
            {draft.originKind === 'external' && <><label className="wide">Raw trace URL<input type="url" value={draft.rawTraceUrl} placeholder="https://…（未編集の表・画像・動画）" onChange={(event) => setDraft({ ...draft, rawTraceUrl: event.target.value })} /></label>
            <label className="wide">Raw trace SHA-256<input className="mono-input" value={draft.rawTraceSha256} placeholder="64桁の小文字16進数" onChange={(event) => setDraft({ ...draft, rawTraceSha256: event.target.value.trim().toLowerCase() })} /></label></>}
            {draft.originKind === 'self-observation' && <p className="wide">自前測定では被ダメージ列と条件情報からraw recordとSHA-256を自動生成します。</p>}
            <label className="wide">被ダメージ列<textarea value={damageText} placeholder="10 hit以上をカンマ・空白・改行で区切る" onChange={(event) => setDamageText(event.target.value)} /></label>
            <label className="wide">Activation frame locator<textarea value={activationText} placeholder="baseline以外で必須。例: video 00:12.400–00:16.200" onChange={(event) => setActivationText(event.target.value)} /></label>
          </div>
          <label className="review-check"><input type="checkbox" checked={draft.reviewed} onChange={(event) => setDraft({ ...draft, reviewed: event.target.checked })} />版・装備・発動window・hit列を確認しました</label>
          <div className="quest-actions"><button className="primary-button" type="submit">runを保存</button><button type="button" onClick={pauseWithDraft}>入力途中で中断</button></div>
        </form>
      </section>}
    </>}

    <section className="handoff-card">
      <div><p className="section-label">8A → 8C HANDOFF</p><h2>観測記録を書き出す</h2><p>保存済みrunをEvidence Repositoryと8C入力へ変換し、固定gateで判定を再計算します。未達でも保留理由を含むJSONとして残せます。</p></div>
      <button type="button" disabled={state.runs.length === 0} onClick={exportSubmission}>受け渡しJSONを生成</button>
      {exportText && <textarea aria-label="8Aと8Cへの受け渡しJSON" readOnly value={exportText} />}
      <p role="status">{message}</p>
    </section>
  </main>
}
