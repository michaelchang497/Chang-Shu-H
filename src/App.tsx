import { useEffect, useMemo, useState } from 'react';
import logoFull from './assets/logo-full.png';
import { mockPatients } from './data/patientData';
import { EDUCATION_TOPICS, EducationTopicId } from './data/educationTopics';
import { evaluateLab } from './lib/labReference';
import { recommendTopics } from './lib/recommendTopics';
import { TREND_METRICS, MonthRange, defaultRange, describeRange, filterByRange, rangeMonths } from './lib/trendMeta';
import { EducationRecord, loadRecords, queryRecords, saveRecord } from './lib/educationHistory';
import { ASSESSMENT_FIELDS, AssessmentFieldId } from './data/assessmentFields';
import TrendChartCard from './components/TrendChartCard';
import SignaturePad from './components/SignaturePad';
import { Patient } from './types';

function statusLabel(status: 'normal' | 'high' | 'low') {
  if (status === 'high') return { text: '偏高', cls: 'status-high' };
  if (status === 'low') return { text: '偏低', cls: 'status-low' };
  return { text: '正常', cls: 'status-normal' };
}

type Tab = 'trend' | 'education' | 'signoff' | 'history';

function buildDefaultRemarks(
  checked: Set<EducationTopicId>,
  reasonById: Map<EducationTopicId, string>,
  labelById: Map<EducationTopicId, string>
): string {
  const lines: string[] = [];
  checked.forEach((id) => {
    const reason = reasonById.get(id);
    if (reason) lines.push(`• ${labelById.get(id)}：${reason}`);
  });
  return lines.join('\n');
}

export default function App() {
  const [patientId, setPatientId] = useState('10010882');
  const [patient, setPatient] = useState<Patient | null>(null);
  const [error, setError] = useState('');
  const [checkedTopics, setCheckedTopics] = useState<Set<EducationTopicId>>(new Set());
  const [tab, setTab] = useState<Tab>('trend');
  const [importedFromHis, setImportedFromHis] = useState(false);
  const [educatorSig, setEducatorSig] = useState<string | null>(null);
  const [patientSig, setPatientSig] = useState<string | null>(null);
  const [remarks, setRemarks] = useState('');
  const [remarksTouched, setRemarksTouched] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [sessionId, setSessionId] = useState('');
  const [assessments, setAssessments] = useState<Partial<Record<AssessmentFieldId, string>>>({});
  const [nextFocus, setNextFocus] = useState('');
  const [range, setRange] = useState<MonthRange | null>(null);
  const [allRecords, setAllRecords] = useState<EducationRecord[]>(() => loadRecords());
  const [hq, setHq] = useState({ patientId: '', from: '', to: '' });
  const [hResults, setHResults] = useState<EducationRecord[] | null>(null);
  const [hSelected, setHSelected] = useState<EducationRecord | null>(null);
  const [saveWarn, setSaveWarn] = useState(false);

  function runSearch(id: string) {
    const found = mockPatients.find((p) => p.id === id.trim());
    if (!found) {
      setError('查無此病歷號碼。可測試的病歷號碼：10010881、10010882、10010883。');
      setPatient(null);
      return;
    }
    setError('');
    setPatient(found);
    setTab('trend');
    setRange(defaultRange(found.labHistory.map((r) => r.date)));
    const current = found.labHistory[found.labHistory.length - 1];
    const recs = recommendTopics(found, current);
    setCheckedTopics(new Set(recs.map((r) => r.id)));
    // 換病患時，簽名與回寫狀態一併重置，避免誤帶上一位病患的簽核紀錄
    setEducatorSig(null);
    setPatientSig(null);
    setRemarksTouched(false);
    setCompleted(false);
    setSessionId('');
    setAssessments({});
    setNextFocus('');
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

  function handleSearch() {
    setImportedFromHis(false);
    runSearch(patientId);
  }

  const current = patient ? patient.labHistory[patient.labHistory.length - 1] : null;
  const labRows = useMemo(() => (current ? evaluateLab(current) : []), [current]);
  const recommendations = useMemo(
    () => (patient && current ? recommendTopics(patient, current) : []),
    [patient, current]
  );
  const reasonById = useMemo(() => {
    const m = new Map<EducationTopicId, string>();
    recommendations.forEach((r) => m.set(r.id, r.reason));
    return m;
  }, [recommendations]);
  const shownHistory = useMemo(
    () => (patient && range ? filterByRange(patient.labHistory, range) : []),
    [patient, range]
  );
  const rangeInvalid = Boolean(range && range.from && range.to && range.from > range.to);
  const dateRangeLabel = range && !rangeInvalid ? describeRange(range, shownHistory.length) : '';

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
  useEffect(() => {
    if (remarksTouched) return;
    setRemarks(buildDefaultRemarks(checkedTopics, reasonById, labelById));
  }, [checkedTopics, reasonById, labelById, remarksTouched]);

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
    };
    setSaveWarn(!saveRecord(rec));
    setAllRecords((prev) => [rec, ...prev]);
    setSessionId(newId);
    setCompleted(true);
  }

  const viewerLink = sessionId
    ? `${window.location.origin}${window.location.pathname}?view-summary=${sessionId}`
    : '';
  const qrUrl = viewerLink
    ? `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(viewerLink)}`
    : '';

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
          <a className="seg-item" href="legacy.html#nutritionist">
            <svg viewBox="0 0 24 24" className="seg-ic"><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>
            營養部
          </a>
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

      <main className="layout">
        <div className="left-col">
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
            />
            <button onClick={handleSearch}>智慧判讀</button>
          </div>
          {importedFromHis && patient && (
            <p className="imported-banner">
              ✓ 已由個管系統帶入病歷號 {patient.id}，檢驗資料已自動查詢完成
            </p>
          )}
          <p className="hint">
            系統提示：可供測試的病歷號碼為 10010881（林彰美）、10010882（陳彰秀）與 10010883（王彰和）。
          </p>
          {error && <p className="error">{error}</p>}

        </section>
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
          <div className="tabs">
            <button className={tab === 'trend' ? 'tab active' : 'tab'} onClick={() => setTab('trend')}>
              <svg viewBox="0 0 24 24" className="tab-ic"><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg> HIS 檢驗與趨勢分析圖
            </button>
            <button className={tab === 'education' ? 'tab active' : 'tab'} onClick={() => setTab('education')}>
              <svg viewBox="0 0 24 24" className="tab-ic"><path d="M14 2v4a2 2 0 0 0 2 2h4" /><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z" /><path d="M10 13h4M10 17h4" /></svg> AI 判讀與衛教
            </button>
            <button className={tab === 'signoff' ? 'tab active' : 'tab'} onClick={() => setTab('signoff')}>
              <svg viewBox="0 0 24 24" className="tab-ic"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></svg> 電子流程簽名與發放
            </button>
            <button
              className={tab === 'history' ? 'tab active' : 'tab'}
              onClick={() => {
                setTab('history');
                const next = { ...hq, patientId: hq.patientId || patient?.id || '' };
                setHq(next);
                setHResults(queryRecords(allRecords, next));
                setHSelected(null);
              }}
            >
              <svg viewBox="0 0 24 24" className="tab-ic"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg> 衛教紀錄查詢
            </button>
          </div>

          {!patient && tab !== 'history' && <p className="placeholder">請先於左側查詢病患以載入檢驗指標。</p>}

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
              {range && (
                <div className="range-controls">
                  <label>
                    檢驗區間 起
                    <input
                      type="month"
                      value={range.from}
                      onChange={(e) => setRange({ ...range, from: e.target.value })}
                    />
                  </label>
                  <label>
                    迄
                    <input
                      type="month"
                      value={range.to}
                      onChange={(e) => setRange({ ...range, to: e.target.value })}
                    />
                  </label>
                  <button
                    className="link-btn"
                    onClick={() => setRange(defaultRange(patient.labHistory.map((r) => r.date)))}
                  >
                    重設為預設（往前 9 個月）
                  </button>
                  {rangeInvalid && <span className="error">起始月份不可晚於結束月份</span>}
                  {!rangeInvalid && rangeMonths(range) > 9 && (
                    <span className="hint">已超過預設的 9 個月</span>
                  )}
                </div>
              )}
              {!rangeInvalid && (
                <div className="chart-grid">
                  {TREND_METRICS.map((metric) => (
                    <TrendChartCard key={metric.key} metric={metric} labHistory={shownHistory} />
                  ))}
                </div>
              )}
            </div>
          )}

          {patient && tab === 'education' && (
            <div className="tab-body">
              <h2>臨床檢驗指標（最新一筆：{current?.date ?? '-'}）</h2>
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

              <h2 className="topics-heading">今日衛教主題（固定 23 項，與個管系統一致）</h2>
              <ul className="topic-list">
                {EDUCATION_TOPICS.map((topic) => {
                  const checked = checkedTopics.has(topic.id);
                  const reason = reasonById.get(topic.id);
                  return (
                    <li key={topic.id} className={checked ? 'topic-checked' : ''}>
                      <label>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleTopic(topic.id)}
                        />
                        {topic.label}
                      </label>
                      {reason && <div className="topic-reason">建議依據：{reason}</div>}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {tab === 'history' && (
            <div className="tab-body">
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
          )}

          {patient && tab === 'signoff' && (
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
                <SignaturePad label="彰秀衛教師簽名板" onChange={setEducatorSig} />
                <SignaturePad label="患者本人／家屬授權簽名板" onChange={setPatientSig} />
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
                  備註欄（無法對應固定欄位之判讀細節，將一併回寫，可編輯）
                </label>
                <textarea
                  id="remarks-box"
                  className="remarks-box"
                  rows={6}
                  value={remarks}
                  onChange={(e) => {
                    setRemarks(e.target.value);
                    setRemarksTouched(true);
                  }}
                />
              </div>

              {!completed && (
                <button className="primary-btn" disabled={!canComplete} onClick={handleComplete}>
                  確認資料正確，完成衛教並回寫個管系統
                </button>
              )}
              {!canComplete && !completed && (
                <p className="hint">雙方簽名皆完成後才能發放本次衛教紀錄。</p>
              )}

              {completed && (
                <div className="completion-panel">
                  <div className="completion-title">✓ 已回寫個管系統，本次衛教紀錄已存檔</div>
                  {saveWarn && <p className="error">瀏覽器儲存空間不足，本次紀錄不會出現在「衛教紀錄查詢」。</p>}
                  <div className="completion-grid">
                    <img className="qr-image" src={qrUrl} alt="衛教紀錄 QR 碼" />
                    <div className="completion-meta">
                      <div>紀錄編號：{sessionId}</div>
                      <div>回寫衛教項目：{checkedTopicList.length} 項</div>
                      <div>
                        認知與遵從度評估：
                        {ASSESSMENT_FIELDS.filter((f) => assessments[f.id]).length} / {ASSESSMENT_FIELDS.length} 項
                      </div>
                      <div>簽名檔：衛教師 ✓ ／ 病患或家屬 ✓</div>
                      <div className="hint">此 QR 碼將顯示於個管系統衛教作業畫面，供病患／家屬掃碼查閱。</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
