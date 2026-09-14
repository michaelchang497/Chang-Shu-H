import { useEffect, useMemo, useState } from 'react';
import logo from './assets/logo.png';
import { mockPatients } from './data/patientData';
import { EDUCATION_TOPICS, EducationTopicId } from './data/educationTopics';
import { evaluateLab } from './lib/labReference';
import { recommendTopics } from './lib/recommendTopics';
import { TREND_METRICS, describeDateRange } from './lib/trendMeta';
import { ASSESSMENT_FIELDS, AssessmentFieldId } from './data/assessmentFields';
import TrendChartCard from './components/TrendChartCard';
import SignaturePad from './components/SignaturePad';
import { Patient } from './types';

function statusLabel(status: 'normal' | 'high' | 'low') {
  if (status === 'high') return { text: '偏高', cls: 'status-high' };
  if (status === 'low') return { text: '偏低', cls: 'status-low' };
  return { text: '正常', cls: 'status-normal' };
}

type Tab = 'trend' | 'education' | 'signoff';

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
  const dateRangeLabel = useMemo(
    () => (patient ? describeDateRange(patient.labHistory.map((r) => r.date)) : ''),
    [patient]
  );
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
          <span className="brand-icon" aria-hidden="true">
            <img src={logo} alt="" />
          </span>
          <div>
            <div className="brand">彰秀醫院</div>
            <div className="subbrand">AI 智慧個人化衛教與臨床營養照護平台</div>
          </div>
        </div>
        <div className="topbar-right">
          <div className="user-badge">陳美倫 衛教師</div>
          <div className="topbar-status">
            <span className="status-dot" />
            HIS 系統已連線
          </div>
        </div>
      </header>

      <main className="layout">
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
        </section>

        <section className="panel content-panel">
          <div className="tabs">
            <button className={tab === 'trend' ? 'tab active' : 'tab'} onClick={() => setTab('trend')}>
              <span className="tab-icon">📈</span> HIS 檢驗與趨勢分析圖
            </button>
            <button className={tab === 'education' ? 'tab active' : 'tab'} onClick={() => setTab('education')}>
              <span className="tab-icon">🩺</span> AI 判讀與衛教
            </button>
            <button className={tab === 'signoff' ? 'tab active' : 'tab'} onClick={() => setTab('signoff')}>
              <span className="tab-icon">✍️</span> 電子流程簽名與發放
            </button>
          </div>

          {!patient && <p className="placeholder">請先於左側查詢病患以載入檢驗指標。</p>}

          {patient && tab === 'trend' && (
            <div className="tab-body">
              <div className="section-header">
                <div>
                  <div className="section-title">
                    臨床指標趨勢報告 <span className="range-badge">{dateRangeLabel}</span>
                  </div>
                  <div className="section-sub">
                    模擬讀取自彰秀內部 HIS 各項目檢驗曲線（最新一期為：{current?.date}）
                  </div>
                </div>
                <div className="section-header-right">
                  目前病歷照護
                  <div className="section-header-right-name">{patient.name}</div>
                </div>
              </div>
              <div className="chart-grid">
                {TREND_METRICS.map((metric) => (
                  <TrendChartCard key={metric.key} metric={metric} labHistory={patient.labHistory} />
                ))}
              </div>
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
