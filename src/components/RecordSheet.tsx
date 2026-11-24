import { useState } from 'react';
import logoFull from '../assets/logo-full.png';
import { EDUCATION_TOPICS } from '../data/educationTopics';
import { ASSESSMENT_FIELDS } from '../data/assessmentFields';
import { EducationRecord } from '../lib/educationHistory';

export interface ShareInfo {
  link: string;
  qrUrl: string;
}

const STATUS = {
  high: { text: '偏高', cls: 'status-high' },
  low: { text: '偏低', cls: 'status-low' },
  normal: { text: '正常', cls: 'status-normal' },
} as const;

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // 沒有剪貼簿權限（例如非 https）時的備援
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  }
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState<'idle' | 'ok' | 'fail'>('idle');
  return (
    <button
      type="button"
      className="big-btn ghost copy-btn"
      onClick={async () => {
        setDone((await copyText(text)) ? 'ok' : 'fail');
        setTimeout(() => setDone('idle'), 2000);
      }}
    >
      {done === 'ok' ? '✓ 已複製' : done === 'fail' ? '複製失敗，請手動選取' : label}
    </button>
  );
}

// 衛教紀錄單：完成衛教後直接顯示的頁面，版型參考衛教單張。
export default function RecordSheet({ record, share }: { record: EducationRecord; share?: ShareInfo }) {
  const s = record.snapshot;
  const topics = EDUCATION_TOPICS.filter((t) => record.topics.includes(t.id));
  const assessed = ASSESSMENT_FIELDS.filter((f) => record.assessments[f.id]);

  return (
    <article className="record-sheet">
      <header className="rs-banner">
        <img src={logoFull} alt="彰化秀傳紀念醫院" className="rs-logo" />
        <div>
          <h1>衛教紀錄單</h1>
          <p>
            {record.date} {record.time}　衛教師：{record.educator}
          </p>
        </div>
        <div className="rs-id">紀錄編號<br />{record.id}</div>
      </header>

      {share && (
        <section className="rs-share">
          <img className="rs-qr" src={share.qrUrl} alt="衛教紀錄 QR 碼" />
          <div className="rs-share-body">
            <div className="rs-share-title">請病患或家屬掃描 QR 碼，在手機查看這份衛教紀錄</div>
            <div className="rs-link-label">臨時網址</div>
            <input className="rs-link" readOnly value={share.link} onFocus={(e) => e.currentTarget.select()} />
            <div className="rs-share-actions">
              <CopyButton text={share.link} label="複製臨時網址" />
            </div>
            <p className="hint">示意：目前紀錄存在這台裝置的瀏覽器，正式環境會由後端提供可跨裝置開啟的臨時網址。</p>
          </div>
        </section>
      )}

      <section className="rs-block">
        <h2>病患資料</h2>
        <div className="rs-info">
          <div><span>姓名</span><b>{record.patientName}</b></div>
          <div><span>病歷號</span><b>{record.patientId}</b></div>
          {s && <div><span>性別／年齡</span><b>{s.gender === 'M' ? '男' : '女'}／{s.age} 歲</b></div>}
          {s && <div><span>身高／體重／BMI</span><b>{s.height} cm／{s.weight} kg／{s.bmi}</b></div>}
        </div>
        {s && <div className="rs-dx"><span>診斷</span>{s.diagnosis}</div>}
      </section>

      {s && s.labs.length > 0 && (
        <section className="rs-block">
          <h2>您的檢驗數據（{s.labDate}）</h2>
          <div className="rs-labs">
            {s.labs.map((l) => (
              <div key={l.labelEn} className={`rs-lab ${l.status}`}>
                <div className="rs-lab-name">{l.labelZh} <small>{l.labelEn}</small></div>
                <div className="rs-lab-value">
                  {l.value}
                  <small> {l.unit}</small>
                </div>
                <div className="rs-lab-ref">
                  參考 {l.reference}
                  <span className={`status-pill ${STATUS[l.status].cls}`}>{STATUS[l.status].text}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {s && s.summaryPoints.length > 0 && (
        <section className="rs-block">
          <h2>本次衛教重點</h2>
          <ul className="ai-points">
            {s.summaryPoints.map((pt) => {
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
        </section>
      )}

      <section className="rs-block">
        <h2>今日衛教項目（{topics.length} 項）</h2>
        {topics.length === 0 ? (
          <p className="placeholder">未勾選衛教項目</p>
        ) : (
          <ul className="rs-topics">
            {topics.map((t) => (
              <li key={t.id}>
                <b>✓ {t.label}</b>
                {s?.topicReasons[t.id] && <small>{s.topicReasons[t.id]}</small>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rs-block">
        <h2>認知與遵從度評估</h2>
        {assessed.length === 0 ? (
          <p className="placeholder">本次未評估</p>
        ) : (
          <div className="topic-chip-row">
            {assessed.map((f) => (
              <span key={f.id} className="topic-chip assessment-chip">
                {f.label}：{record.assessments[f.id]}
              </span>
            ))}
          </div>
        )}
      </section>

      {record.nextFocus && (
        <section className="rs-block">
          <h2>下次需加強的項目</h2>
          <div className="next-focus-preview">{record.nextFocus}</div>
        </section>
      )}

      {record.remarks && (
        <section className="rs-block">
          <h2>備註</h2>
          <pre className="rs-remarks">{record.remarks}</pre>
        </section>
      )}

      <section className="rs-block">
        <h2>簽名</h2>
        {record.educatorSig && record.patientSig ? (
          <div className="rs-sigs">
            <figure><img src={record.educatorSig} alt="衛教師簽名" /><figcaption>衛教師</figcaption></figure>
            <figure><img src={record.patientSig} alt="患者或家屬簽名" /><figcaption>患者／家屬</figcaption></figure>
          </div>
        ) : (
          <p className="hint">衛教師 ✓ ／ 病患或家屬 ✓（示意資料，無簽名圖檔）</p>
        )}
      </section>
    </article>
  );
}
