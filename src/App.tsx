import { useEffect, useMemo, useRef, useState } from 'react';
import logoFull from './assets/logo-full.png';
import { mockPatients } from './data/patientData';
import { EDUCATION_TOPICS, EducationTopicId } from './data/educationTopics';
import { evaluateLab } from './lib/labReference';
import { analyze, AnalysisResult, computeFacts, AnalysisInput } from './lib/aiAnalysis';
import { TREND_METRICS, MonthRange, defaultRange, describeRange, filterByRange } from './lib/trendMeta';
import { EducationRecord, loadRecords, queryRecords, saveRecord } from './lib/educationHistory';
import { ASSESSMENT_FIELDS, AssessmentFieldId } from './data/assessmentFields';
import TrendChartCard from './components/TrendChartCard';
import SignaturePad from './components/SignaturePad';
import FloatingSearch from './components/FloatingSearch';
import RecordSheet from './components/RecordSheet';
import { buildAutoRemarks, mergeAuto } from './lib/remarks';
import { Patient } from './types';

function statusLabel(status: 'normal' | 'high' | 'low') {
  if (status === 'high') return { text: '偏高', cls: 'status-high' };
  if (status === 'low') return { text: '偏低', cls: 'status-low' };
  return { text: '正常', cls: 'status-normal' };
}

// 營養部（舊版頁面 legacy.html）先隱藏；要恢復時改成 true
const SHOW_NUTRITION_DEPT = false;

type Tab = 'trend' | 'education' | 'signoff';
type View = 'care' | 'history';

// 衛教流程的三個步驟：只顯示進度，不能直接點擊，靠畫面上的按鈕前進／返回
const FLOW_STEPS: { id: Tab; label: string }[] = [
  { id: 'trend', label: 'HIS 檢驗與趨勢分析圖' },
  { id: 'education', label: 'AI 判讀與衛教' },
  { id: 'signoff', label: '電子流程簽名與發放' },
];

const AI_STEP_LABELS = [
  '讀取病患資料',
  '讀取所選區間的檢驗',
  '讀取最新一次檢驗',
  '比對參考區間、找出異常',
  '挑選建議衛教主題',
  '整理衛教摘要',
];

const STATUS_WORD = { high: '偏高', low: '偏低', normal: '正常' } as const;

export default function App() {
  const [patientId, setPatientId] = useState('10010882');
  const [patient, setPatient] = useState<Patient | null>(null);
  const [error, setError] = useState('');
  const [checkedTopics, setCheckedTopics] = useState<Set<EducationTopicId>>(new Set());
  const [tab, setTab] = useState<Tab>('trend');
  const [view, setView] = useState<View>('care');
  const [importedFromHis, setImportedFromHis] = useState(false);
  const [educatorSig, setEducatorSig] = useState<string | null>(null);
  const [patientSig, setPatientSig] = useState<string | null>(null);
  const [remarks, setRemarks] = useState('');
  const lastAutoRef = useRef('');
  const [doneRecord, setDoneRecord] = useState<EducationRecord | null>(null);
  const [completed, setCompleted] = useState(false);
  const [sessionId, setSessionId] = useState('');
  const [assessments, setAssessments] = useState<Partial<Record<AssessmentFieldId, string>>>({});
  const [nextFocus, setNextFocus] = useState('');
  const [range, setRange] = useState<MonthRange | null>(null); // 已查詢(圖表採用)的區間
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [analysisKey, setAnalysisKey] = useState('');
  const [aiRunning, setAiRunning] = useState(false);
  const [aiIdx, setAiIdx] = useState(0); // 已完成的步驟數
  const [aiDetails, setAiDetails] = useState<string[]>([]);
  const [aiError, setAiError] = useState('');
  const runIdRef = useRef(0);
  const skipRef = useRef(false);
  const [draft, setDraft] = useState<MonthRange | null>(null); // 輸入框中尚未查詢的區間
  const [allRecords, setAllRecords] = useState<EducationRecord[]>(() => loadRecords());
  const [hq, setHq] = useState({ patientId: '', from: '', to: '' });
  const [hResults, setHResults] = useState<EducationRecord[] | null>(null);
  const [hSelected, setHSelected] = useState<EducationRecord | null>(null);
  const [saveWarn, setSaveWarn] = useState(false);
  // 病患掃 QR 碼開啟的唯讀衛教紀錄（?view-summary=紀錄編號）
  const viewSummaryId = useMemo(() => new URLSearchParams(window.location.search).get('view-summary'), []);

  function runSearch(id: string): boolean {
    const found = mockPatients.find((p) => p.id === id.trim());
    if (!found) {
      setError('查無此病歷號碼。可測試的病歷號碼：10010881、10010882、10010883。');
      setPatient(null);
      return false;
    }
    setError('');
    setPatient(found);
    setTab('trend');
    const dr = defaultRange(found.labHistory.map((r) => r.date));
    setRange(dr);
    setDraft(dr);
    runIdRef.current += 1; // 取消進行中的判讀
    setAnalysis(null);
    setAnalysisKey('');
    setAiRunning(false);
    setAiError('');
    setCheckedTopics(new Set());
    // 換病患時，簽名與回寫狀態一併重置，避免誤帶上一位病患的簽核紀錄
    setEducatorSig(null);
    setPatientSig(null);
    setCompleted(false);
    setDoneRecord(null);
    lastAutoRef.current = '';
    setRemarks('');
    setSessionId('');
    setAssessments({});
    setNextFocus('');
    return true;
  }

  // 模擬個管系統「拋轉」到本系統的交接：HIS 端會帶著病歷號開啟本頁，
  // 對應 reference 簡報 slide 12 的院方要求「病歷自動 key in，直接啟動查詢」。
  useEffect(() => {
    const incoming = new URLSearchParams(window.location.search).get('patientId');
    if (incoming) {
      setPatientId(incoming);
      runSearch(incoming);
      setImportedFromHis(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleSearch(): boolean {
    setImportedFromHis(false);
    return runSearch(patientId);
  }

  const current = patient ? patient.labHistory[patient.labHistory.length - 1] : null;
  const labRows = useMemo(() => (current && patient ? evaluateLab(current, patient.gender) : []), [current, patient]);
  const reasonById = useMemo(() => {
    const m = new Map<EducationTopicId, string>();
    analysis?.topics.forEach((r) => m.set(r.id, r.reason));
    return m;
  }, [analysis]);
  const shownHistory = useMemo(
    () => (patient && range ? filterByRange(patient.labHistory, range) : []),
    [patient, range]
  );
  const dateRangeLabel = range ? describeRange(range, shownHistory.length) : '';
  const draftInvalid = !draft || !draft.from || !draft.to || draft.from > draft.to;
  const draftDirty = Boolean(draft && range && (draft.from !== range.from || draft.to !== range.to));

  // 按下「智慧判讀」：依「所選區間的檢驗」＋「最新一次檢驗」判讀，並預先勾選建議的衛教主題。
  // 同一病患、同一區間已判讀過就直接帶出結果，不重跑。
  async function startAnalysis() {
    if (!patient || !range || !current) return;
    const key = `${patient.id}|${range.from}|${range.to}`;
    setTab('education');
    if (analysis && analysisKey === key) return;

    const runId = ++runIdRef.current;
    skipRef.current = false;
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, skipRef.current ? 0 : ms));
    const input: AnalysisInput = {
      patient: { age: patient.age, gender: patient.gender, diagnosis: patient.diagnosis, bmi: patient.bmi },
      range,
      rangeLabs: shownHistory,
      latest: current,
    };
    const facts = computeFacts(input);
    const resultP = analyze(input);
    resultP.catch(() => undefined); // 錯誤在下方統一處理

    const details: string[] = ['', '', '', '', '', ''];
    const abnormalNames = facts.labs.filter((l) => l.abnormal.length > 0).map((l) => l.labelZh);
    const g = (k: string) => facts.labs.find((l) => l.key === k)!.latest.value;
    details[0] = `${patient.age} 歲${patient.gender === 'M' ? '男' : '女'} · BMI ${patient.bmi}`;
    details[1] = `${range.from} ～ ${range.to}，共 ${facts.rangeCount} 筆`;
    details[2] = `${facts.latestDate} · HbA1c ${g('hba1c')}% · eGFR ${g('egfr')} · UA ${g('ua')}`;
    details[3] = abnormalNames.length ? `${abnormalNames.length} 項曾異常：${abnormalNames.join('、')}` : '區間內無異常項目';

    setAnalysis(null);
    setAiError('');
    setAiDetails(['', '', '', '', '', '']);
    setAiIdx(0);
    setAiRunning(true);
    try {
      let res: AnalysisResult | null = null;
      for (let i = 0; i < AI_STEP_LABELS.length; i++) {
        await sleep(500 + Math.random() * 350);
        if (runIdRef.current !== runId) return;
        if (i >= 4) {
          res = await resultP;
          if (runIdRef.current !== runId) return;
          details[4] = `${res.topics.length} 項建議勾選`;
          details[5] = `${res.summaryPoints.length} 點重點、${res.abnormalFindings.length} 項異常提醒`;
        }
        setAiDetails([...details]);
        setAiIdx(i + 1);
      }
      await sleep(400);
      if (runIdRef.current !== runId || !res) return;
      setAnalysis(res);
      setAnalysisKey(key);
      if (!completed) setCheckedTopics(new Set(res.topics.map((x) => x.id)));
    } catch (e) {
      if (runIdRef.current === runId) setAiError(e instanceof Error ? e.message : '判讀失敗，請重試');
    } finally {
      if (runIdRef.current === runId) setAiRunning(false);
    }
  }

  function runHistorySearch(next = hq) {
    setHSelected(null);
    setHResults(queryRecords(allRecords, next));
  }
  const labelById = useMemo(() => {
    const m = new Map<EducationTopicId, string>();
    EDUCATION_TOPICS.forEach((t) => m.set(t.id, t.label));
    return m;
  }, []);
  const checkedTopicList = useMemo(
    () => EDUCATION_TOPICS.filter((t) => checkedTopics.has(t.id)),
    [checkedTopics]
  );

  function toggleTopic(id: EducationTopicId) {
    setCheckedTopics((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // 備註欄自動帶入「勾選主題的判斷依據」——這些細節在固定 23 項 checkbox
  // 結構裡沒有對應欄位，依 slide 2 的要求回寫至備註。個管師仍可手動編輯。
  // 只要衛教項目、評估、下次加強、異常值任何一項有變動，備註就自動補上對應內容（保留個管師手寫的文字）
  useEffect(() => {
    if (completed) return;
    const next = buildAutoRemarks({
      checked: checkedTopics,
      reasons: reasonById,
      assessments,
      nextFocus,
      findings: analysis?.abnormalFindings ?? [],
    });
    const prev = lastAutoRef.current;
    lastAutoRef.current = next;
    setRemarks((cur) => mergeAuto(cur, prev, next));
  }, [checkedTopics, reasonById, assessments, nextFocus, analysis, completed]);

  // 切換流程步驟時回到頁面頂端（平板上才看得到新步驟的開頭）
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [tab]);

  const canComplete = Boolean(educatorSig && patientSig);

  function handleComplete() {
    if (!canComplete || !patient) return;
    const newId = `sess_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const rec: EducationRecord = {
      id: newId,
      patientId: patient.id,
      patientName: patient.name,
      date: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
      time: `${pad(now.getHours())}:${pad(now.getMinutes())}`,
      educator: '陳美倫 衛教師',
      topics: checkedTopicList.map((t) => t.id),
      assessments,
      nextFocus,
      remarks,
      educatorSig: educatorSig ?? undefined,
      patientSig: patientSig ?? undefined,
      snapshot: {
        age: patient.age,
        gender: patient.gender,
        height: patient.height,
        weight: patient.weight,
        bmi: patient.bmi,
        diagnosis: patient.diagnosis,
        labDate: current?.date ?? '',
        labs: labRows.map((r) => ({
          labelZh: r.labelZh,
          labelEn: r.labelEn,
          value: r.value,
          unit: r.unit,
          reference: r.reference,
          status: r.status,
        })),
        summaryPoints: analysis?.summaryPoints ?? [],
        topicReasons: Object.fromEntries(reasonById),
      },
    };
    setSaveWarn(!saveRecord(rec));
    setAllRecords((prev) => [rec, ...prev]);
    setSessionId(newId);
    setDoneRecord(rec);
    setCompleted(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // 完成後開始下一位：回到查詢畫面
  function startNext() {
    runIdRef.current += 1;
    setPatient(null);
    setPatientId('');
    setAnalysis(null);
    setAnalysisKey('');
    setAiRunning(false);
    setCheckedTopics(new Set());
    setEducatorSig(null);
    setPatientSig(null);
    setCompleted(false);
    setDoneRecord(null);
    setSessionId('');
    setAssessments({});
    setNextFocus('');
    setRemarks('');
    lastAutoRef.current = '';
    setTab('trend');
  }

  const viewerLink = sessionId
    ? `${window.location.origin}${window.location.pathname}?view-summary=${sessionId}`
    : '';
  const qrUrl = viewerLink
    ? `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(viewerLink)}`
    : '';

  if (viewSummaryId) {
    const rec = allRecords.find((r) => r.id === viewSummaryId);
    return (
      <div className="page">
        <header className="topbar">
          <div className="brand-block">
            <span className="brand-logo-badge">
              <img src={logoFull} alt="彰化秀傳紀念醫院" />
            </span>
            <div className="subbrand">AI 智慧個人化衛教與臨床營養照護平台</div>
          </div>
        </header>
        <main className="viewer-page">
          {rec ? (
            <RecordSheet record={rec} />
          ) : (
            <p className="placeholder">
              找不到這份衛教紀錄。示意版本的紀錄只存在製作它的那台裝置，正式環境會由後端提供可跨裝置開啟的臨時網址。
            </p>
          )}
        </main>
      </div>
    );
  }

  return (
    <div className="page">
      <header className="topbar">
        <div className="brand-block">
          <span className="brand-logo-badge">
            <img src={logoFull} alt="彰化秀傳紀念醫院" />
          </span>
          <div className="subbrand">AI 智慧個人化衛教與臨床營養照護平台</div>
        </div>
        <nav className="seg" aria-label="主要功能">
          <span className="seg-item on">
            <svg viewBox="0 0 24 24" className="seg-ic"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
            衛教中心
          </span>
          {SHOW_NUTRITION_DEPT && (
            <a className="seg-item" href="legacy.html#nutritionist">
              <svg viewBox="0 0 24 24" className="seg-ic"><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>
              營養部
            </a>
          )}
          <a className="seg-item" href="nutrition.html">
            <svg viewBox="0 0 24 24" className="seg-ic"><rect x="8" y="2" width="8" height="4" rx="1" /><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /><path d="m9 14 2 2 4-4" /></svg>
            營養照護紀錄
            <span className="seg-new">NEW</span>
          </a>
        </nav>
        <div className="topbar-right">
          <div className="user-badge">陳美倫 衛教師</div>
          <div className="topbar-status">
            <span className="status-dot" />
            HIS SIMULATED
          </div>
        </div>
      </header>

      <div className="subtabs">
        <div className="subtabs-in">
          <button className={view === 'care' ? 'on' : ''} onClick={() => setView('care')}>
            衛教作業
          </button>
          <button
            className={view === 'history' ? 'on' : ''}
            onClick={() => {
              setView('history');
              setHSelected(null);
              setHResults(queryRecords(allRecords, hq));
            }}
          >
            歷史紀錄查詢
          </button>
        </div>
      </div>

      {view === 'history' ? (
        <main className="hist-page">
          <section className="panel hist-panel">
            <div className="tab-body hist-body">
                <h2>衛教紀錄查詢</h2>
                <div className="hist-filters">
                  <label>
                    病歷號碼
                    <input
                      value={hq.patientId}
                      onChange={(e) => setHq({ ...hq, patientId: e.target.value })}
                      onKeyDown={(e) => e.key === 'Enter' && runHistorySearch()}
                      placeholder="不填＝全部病歷"
                    />
                  </label>
                  <label>
                    衛教日期 起
                    <input type="date" value={hq.from} onChange={(e) => setHq({ ...hq, from: e.target.value })} />
                  </label>
                  <label>
                    迄
                    <input type="date" value={hq.to} onChange={(e) => setHq({ ...hq, to: e.target.value })} />
                  </label>
                  <button className="primary-btn" onClick={() => runHistorySearch()}>查詢</button>
                  <button
                    className="link-btn"
                    onClick={() => {
                      const cleared = { patientId: '', from: '', to: '' };
                      setHq(cleared);
                      runHistorySearch(cleared);
                    }}
                  >
                    清除條件
                  </button>
                </div>
  
                {hResults && hResults.length === 0 && <p className="placeholder">查無符合條件的衛教紀錄。</p>}
                {hResults && hResults.length > 0 && (
                  <>
                    <p className="hint">共 {hResults.length} 筆（同一病歷號可有多筆，依日期由新到舊）</p>
                    <table className="lab-table hist-table">
                      <thead>
                        <tr>
                          <th>衛教日期</th>
                          <th>病歷號碼</th>
                          <th>姓名</th>
                          <th>衛教師</th>
                          <th>衛教主題</th>
                          <th>簽名</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {hResults.map((r) => (
                          <tr key={r.id} className={hSelected?.id === r.id ? 'row-selected' : ''}>
                            <td>{r.date} {r.time}</td>
                            <td>{r.patientId}</td>
                            <td>{r.patientName}</td>
                            <td>{r.educator}</td>
                            <td>{r.topics.length} 項</td>
                            <td>{r.id.startsWith('sess_seed') || (r.educatorSig && r.patientSig) ? '✓ 雙方已簽' : '—'}</td>
                            <td>
                              <button className="link-btn" onClick={() => setHSelected(r)}>查看</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </>
                )}
  
                {hSelected && (
                  <div className="writeback-preview hist-detail">
                    <div className="completion-title">
                      {hSelected.patientName}（{hSelected.patientId}）　{hSelected.date} {hSelected.time}
                    </div>
                    <div className="writeback-label">衛教項目（{hSelected.topics.length} 項）</div>
                    <div className="topic-chip-row">
                      {hSelected.topics.map((id) => (
                        <span key={id} className="topic-chip">{labelById.get(id) ?? id}</span>
                      ))}
                    </div>
                    <div className="writeback-label">個案認知與遵從度評估</div>
                    <div className="topic-chip-row">
                      {ASSESSMENT_FIELDS.filter((f) => hSelected.assessments[f.id]).map((f) => (
                        <span key={f.id} className="topic-chip assessment-chip">
                          {f.label}：{hSelected.assessments[f.id]}
                        </span>
                      ))}
                      {ASSESSMENT_FIELDS.every((f) => !hSelected.assessments[f.id]) && (
                        <span className="placeholder">未評估</span>
                      )}
                    </div>
                    {hSelected.nextFocus && (
                      <>
                        <div className="writeback-label">下次需加強的項目</div>
                        <div className="next-focus-preview">{hSelected.nextFocus}</div>
                      </>
                    )}
                    {hSelected.remarks && (
                      <>
                        <div className="writeback-label">備註</div>
                        <pre className="hist-remarks">{hSelected.remarks}</pre>
                      </>
                    )}
                    <div className="writeback-label">簽名檔</div>
                    {hSelected.educatorSig && hSelected.patientSig ? (
                      <div className="signature-row">
                        <div><img className="hist-sig" src={hSelected.educatorSig} alt="衛教師簽名" /><div className="hint">衛教師</div></div>
                        <div><img className="hist-sig" src={hSelected.patientSig} alt="患者簽名" /><div className="hint">患者／家屬</div></div>
                      </div>
                    ) : (
                      <p className="hint">衛教師 ✓ ／ 病患或家屬 ✓（示意資料，無簽名圖檔）</p>
                    )}
                  </div>
                )}
              </div>
          </section>
        </main>
      ) : (
      <main className="layout">
        <div className="left-col">
        {!patient && (
        <section className="panel search-panel">
          <h2>病歷號碼檢索系統 (HIS)</h2>
          <div className="search-row">
            <input
              value={patientId}
              onChange={(e) => {
                setPatientId(e.target.value);
                setImportedFromHis(false);
              }}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="輸入病歷號碼"
              inputMode="numeric"
            />
            <button onClick={() => handleSearch()}>查詢病患</button>
          </div>
          <p className="hint">
            系統提示：可供測試的病歷號碼為 10010881（林彰美）、10010882（陳彰秀）與 10010883（王彰和）。
          </p>
          {error && <p className="error">{error}</p>}
        </section>
        )}
        {importedFromHis && patient && (
          <p className="imported-banner">
            ✓ 已由個管系統帶入病歷號 {patient.id}，檢驗資料已自動查詢完成
          </p>
        )}
        {patient && (
            <div className="patient-card">
              <div className="patient-card-bar">
                <span className="status-dot" />
                HIS ACTIVE PATIENT
                <span className="patient-card-bar-right">彰秀醫院病歷庫</span>
              </div>
              <div className="patient-card-body">
                <div className="patient-identity">
                  <div className="patient-avatar">{patient.name.charAt(0)}</div>
                  <div>
                    <div className="patient-name">
                      {patient.name}
                      <span className="patient-meta-pill">
                        {patient.gender === 'M' ? '男' : '女'} · {patient.age} 歲
                      </span>
                    </div>
                    <div className="patient-id">病歷編碼：{patient.id}</div>
                  </div>
                </div>
                <div className="patient-vitals">
                  <div>
                    <div className="vital-label">身高</div>
                    <div className="vital-value">{patient.height} cm</div>
                  </div>
                  <div>
                    <div className="vital-label">體重</div>
                    <div className="vital-value">{patient.weight} kg</div>
                  </div>
                  <div>
                    <div className="vital-label">BMI</div>
                    <div className="vital-value">{patient.bmi}</div>
                  </div>
                </div>
                <div className="patient-diagnosis">
                  <div className="patient-diagnosis-label">個案臨床初診斷</div>
                  {patient.diagnosis}
                </div>
              </div>
            </div>
        )}
        </div>

        <section className="panel content-panel">
          <ol className="stepper" aria-label="衛教流程">
            {FLOW_STEPS.map((s, i) => {
              const cur = FLOW_STEPS.findIndex((x) => x.id === tab);
              return (
                <li key={s.id} className={i === cur ? 'step active' : i < cur ? 'step done' : 'step'}>
                  <span className="step-no">{i < cur ? '✓' : i + 1}</span>
                  <span className="step-label">{s.label}</span>
                </li>
              );
            })}
          </ol>

          {!patient && <p className="placeholder">請先於左側查詢病患以載入檢驗指標。</p>}

          {patient && tab === 'trend' && (
            <div className="tab-body">
              <div className="section-header">
                <div>
                  <div className="section-title">
                    臨床指標趨勢報告 <span className="range-badge">{dateRangeLabel}</span>
                  </div>
                  <div className="section-sub">
                    讀取自彰秀內部 HIS 各項目檢驗曲線（最新一期為：{current?.date}）
                  </div>
                </div>
                <div className="section-header-right">
                  目前病歷照護
                  <div className="section-header-right-name">{patient.name}</div>
                </div>
              </div>
              {draft && (
                <div className="range-controls">
                  <label>
                    檢驗區間 起
                    <input
                      type="month"
                      value={draft.from}
                      onChange={(e) => setDraft({ ...draft, from: e.target.value })}
                    />
                  </label>
                  <label>
                    迄
                    <input
                      type="month"
                      value={draft.to}
                      onChange={(e) => setDraft({ ...draft, to: e.target.value })}
                    />
                  </label>
                  <button
                    className="primary-btn range-query-btn"
                    disabled={draftInvalid}
                    onClick={() => draft && setRange(draft)}
                  >
                    查詢
                  </button>
                  <button
                    className="link-btn"
                    onClick={() => {
                      const dr = defaultRange(patient.labHistory.map((r) => r.date));
                      setDraft(dr);
                      setRange(dr);
                    }}
                  >
                    重設為預設（往前 9 個月）
                  </button>
                  {draft.from && draft.to && draft.from > draft.to && (
                    <span className="error">起始月份不可晚於結束月份</span>
                  )}
                  {!draftInvalid && draftDirty && <span className="hint">區間已變更，請按「查詢」更新圖表</span>}
                </div>
              )}
              {range && (
                <div className="chart-grid">
                  {TREND_METRICS.map((metric) => (
                    <TrendChartCard key={metric.key} metric={metric} labHistory={shownHistory} />
                  ))}
                </div>
              )}
              <div className="step-actions">
                <span className="step-hint">
                  {draftDirty ? '區間已變更，請先按「查詢」更新圖表' : '確認檢驗趨勢後，按「智慧判讀」產生本次衛教建議'}
                </span>
                <button className="big-btn primary" disabled={!range || draftInvalid || draftDirty} onClick={startAnalysis}>
                  <svg viewBox="0 0 24 24" className="btn-ic"><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" /><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z" /></svg> 智慧判讀
                </button>
              </div>
            </div>
          )}

          {patient && tab === 'education' && (
            <div className="tab-body">

              <div className="ai-basis">
                AI 判讀依據：所選區間 {range ? `${range.from} ～ ${range.to}` : '-'}（{shownHistory.length} 筆檢驗）＋ 最新一筆（
                {current?.date ?? '-'}）
                <span className="ai-sim">示意：目前由規則模擬模型輸出，僅供個管師參考</span>
              </div>

              {aiRunning && (
                <div className="aiwork" role="status">
                  <div className="aw-h">
                    <span className="aw-orb"><svg viewBox="0 0 24 24" className="btn-ic"><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" /><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z" /></svg></span>
                    <div>
                      <b>AI 判讀中</b>
                      <small className="aw-t">依所選區間與最新檢驗，準備本次衛教建議…</small>
                    </div>
                    <button className="big-btn ghost aw-skip" onClick={() => (skipRef.current = true)}>略過動畫</button>
                  </div>
                  <div className="aw-bar"><i style={{ width: `${(aiIdx / AI_STEP_LABELS.length) * 100}%` }} /></div>
                  <ol className="aw-steps">
                    {AI_STEP_LABELS.map((label, i) => (
                      <li key={label} className={i < aiIdx ? 'ok' : i === aiIdx ? 'run' : ''}>
                        <span className="aw-s" />
                        <div>
                          <b>{label}</b>
                          {i < aiIdx && aiDetails[i] && <small>{aiDetails[i]}</small>}
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
              {aiError && <p className="error">{aiError}</p>}

              {analysis && !aiRunning && (
                <>
                  <h2 className="topics-heading">① 衛教主題與摘要</h2>
                  <ul className="ai-points">
                    {analysis.summaryPoints.map((pt) => {
                      const i = pt.indexOf('：');
                      return (
                        <li key={pt}>
                          {i > 0 ? (
                            <>
                              <b>{pt.slice(0, i)}</b>
                              <span>{pt.slice(i + 1)}</span>
                            </>
                          ) : (
                            <span>{pt}</span>
                          )}
                        </li>
                      );
                    })}
                  </ul>

                  <h2 className="topics-heading">② 衛教主題勾選（固定 23 項，與個管系統一致）</h2>
                  <ul className="topic-list">
                    {EDUCATION_TOPICS.map((topic) => {
                      const checked = checkedTopics.has(topic.id);
                      const reason = reasonById.get(topic.id);
                      return (
                        <li key={topic.id} className={checked ? 'topic-checked' : ''}>
                          <label>
                            <input type="checkbox" checked={checked} onChange={() => toggleTopic(topic.id)} />
                            {topic.label}
                          </label>
                          {reason && <div className="topic-reason">AI 建議原因：{reason}</div>}
                        </li>
                      );
                    })}
                  </ul>

                  <h2 className="topics-heading">③ 異常值標示（所選區間內曾出現異常）</h2>
                  {analysis.abnormalFindings.length === 0 ? (
                    <p className="placeholder">所選區間內各項檢驗皆在參考區間內。</p>
                  ) : (
                    <div className="finding-list">
                      {analysis.abnormalFindings.map((f) => {
                        const s = statusLabel(f.latest.status);
                        return (
                          <div key={f.key} className="finding-card">
                            <div className="finding-head">
                              <span className="finding-name">
                                {f.labelZh} <span className="en">{f.labelEn}</span>
                              </span>
                              <span className="finding-ref">參考 {f.reference} {f.unit}</span>
                              <span className={`status-pill ${s.cls}`}>目前{s.text}</span>
                            </div>
                            <div className="finding-points">
                              {f.occurrences.map((p) => (
                                <span key={p.date} className={`finding-point ${p.status}`}>
                                  {p.date}：{p.value}
                                </span>
                              ))}
                              <span className="finding-count">
                                共 {f.occurrences.length} / {f.totalCount} 筆異常
                              </span>
                            </div>
                            <div className="finding-note">{f.note}</div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
              <h2 className="topics-heading">臨床檢驗指標（最新一筆：{current?.date ?? '-'}）</h2>
              <table className="lab-table">
                <thead>
                  <tr>
                    <th>項目</th>
                    <th>數值</th>
                    <th>參考區間</th>
                    <th>狀態</th>
                  </tr>
                </thead>
                <tbody>
                  {labRows.map((row) => {
                    const s = statusLabel(row.status);
                    return (
                      <tr key={row.key}>
                        <td>
                          {row.labelZh} <span className="en">{row.labelEn}</span>
                        </td>
                        <td>
                          {row.value} {row.unit}
                        </td>
                        <td>{row.reference}</td>
                        <td>
                          <span className={`status-pill ${s.cls}`}>{s.text}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <div className="step-actions">
                <button className="big-btn ghost" disabled={aiRunning} onClick={() => setTab('trend')}>← 返回檢驗趨勢</button>
                <span className="step-hint">{analysis && !aiRunning ? `已預先勾選 ${checkedTopics.size} 項衛教主題，可依現場情況調整` : ''}</span>
                <button className="big-btn primary" disabled={aiRunning || !analysis} onClick={() => setTab('signoff')}>
                  下一步：簽名與發放 →
                </button>
              </div>
            </div>
          )}

          {patient && tab === 'signoff' && doneRecord && (
            <div className="tab-body">
              <div className="done-banner">✓ 已回寫個管系統，本次衛教紀錄已存檔</div>
              {saveWarn && <p className="error">瀏覽器儲存空間不足，本次紀錄不會出現在「衛教紀錄查詢」。</p>}
              <RecordSheet record={doneRecord} share={{ link: viewerLink, qrUrl }} />
              <div className="step-actions">
                <span className="step-hint">可請病患掃描 QR 碼，或複製臨時網址傳給病患</span>
                <button className="big-btn primary" onClick={startNext}>完成，開始下一位病患</button>
              </div>
            </div>
          )}

          {patient && tab === 'signoff' && !doneRecord && (
            <div className="tab-body">
              <h2>個案認知與遵從度評估</h2>
              <p className="hint">由個管師依本次對談內容評估勾選，非系統依檢驗值自動判斷，未勾選則視為未評估。</p>
              <div className="assessment-grid">
                {ASSESSMENT_FIELDS.map((field) => (
                  <div key={field.id} className="assessment-field">
                    <div className="assessment-label">{field.label}</div>
                    <div className="assessment-options">
                      {field.options.map((opt) => (
                        <label key={opt} className="radio-option">
                          <input
                            type="radio"
                            name={field.id}
                            checked={assessments[field.id] === opt}
                            onChange={() =>
                              setAssessments((prev) => ({ ...prev, [field.id]: opt }))
                            }
                          />
                          {opt}
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div className="next-focus-row">
                <label htmlFor="next-focus">下次需加強的項目</label>
                <input
                  id="next-focus"
                  type="text"
                  value={nextFocus}
                  onChange={(e) => setNextFocus(e.target.value)}
                  placeholder="例如：注射胰島素技巧、低血糖處理流程"
                />
              </div>

              <h2 className="topics-heading">雙重電子簽名完成衛教流程</h2>
              <div className="signature-row">
                <SignaturePad label="彰秀衛教師簽名板" value={educatorSig} onChange={setEducatorSig} />
                <SignaturePad label="患者本人／家屬授權簽名板" value={patientSig} onChange={setPatientSig} />
              </div>

              <h2 className="topics-heading">回寫個管系統預覽（個管師審視用）</h2>
              <div className="writeback-preview">
                <div className="writeback-label">將勾選回寫之衛教項目（{checkedTopicList.length} 項）</div>
                {checkedTopicList.length === 0 && (
                  <p className="placeholder">尚未勾選任何衛教主題，請先於「AI 判讀與衛教」分頁勾選。</p>
                )}
                <div className="topic-chip-row">
                  {checkedTopicList.map((t) => (
                    <span key={t.id} className="topic-chip">
                      {t.label}
                    </span>
                  ))}
                </div>

                <div className="writeback-label">個案認知與遵從度評估</div>
                <div className="topic-chip-row">
                  {ASSESSMENT_FIELDS.filter((f) => assessments[f.id]).map((f) => (
                    <span key={f.id} className="topic-chip assessment-chip">
                      {f.label}：{assessments[f.id]}
                    </span>
                  ))}
                  {ASSESSMENT_FIELDS.every((f) => !assessments[f.id]) && (
                    <span className="placeholder">尚未評估</span>
                  )}
                </div>
                {nextFocus && (
                  <>
                    <div className="writeback-label">下次需加強的項目</div>
                    <div className="next-focus-preview">{nextFocus}</div>
                  </>
                )}

                <label className="writeback-label" htmlFor="remarks-box">
                  備註欄（有變動會自動補上內容；無法對應固定欄位之判讀細節將一併回寫，可編輯）
                </label>
                <textarea
                  id="remarks-box"
                  className="remarks-box"
                  rows={6}
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                />
              </div>

              <button className="primary-btn" disabled={!canComplete} onClick={handleComplete}>
                確認資料正確，完成衛教並回寫個管系統
              </button>
              {!canComplete && <p className="hint">雙方簽名皆完成後才能發放本次衛教紀錄。</p>}

              <div className="step-actions">
                <button className="big-btn ghost" onClick={() => setTab('education')}>← 返回 AI 判讀</button>
              </div>
            </div>
          )}
        </section>
      </main>
      )}
      {view === 'care' && patient && (
        <FloatingSearch
          patientName={patient.name}
          patientId={patient.id}
          inputValue={patientId}
          onInputChange={(v) => {
            setPatientId(v);
            setImportedFromHis(false);
          }}
          onSearch={handleSearch}
          error={error}
        />
      )}
    </div>
  );
}
