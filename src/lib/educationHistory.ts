import { AssessmentFieldId } from '../data/assessmentFields';
import { EducationTopicId } from '../data/educationTopics';

export interface EducationRecord {
  id: string;
  patientId: string;
  patientName: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  educator: string;
  topics: EducationTopicId[];
  assessments: Partial<Record<AssessmentFieldId, string>>;
  nextFocus: string;
  remarks: string;
  educatorSig?: string; // 簽名圖檔 data URL（示意資料沒有）
  patientSig?: string;
}

const STORAGE_KEY = 'csh-education-records-v1';

// 示意資料：讓歷史查詢在沒有實際操作紀錄時也能看到「同一病歷多筆」的樣子
const SEED: EducationRecord[] = [
  {
    id: 'sess_seed_881_1', patientId: '10010881', patientName: '林彰美',
    date: '2026-03-25', time: '10:20', educator: '陳美倫 衛教師',
    topics: ['dm_awareness', 'diet', 'nephropathy', 'self_monitoring'],
    assessments: { dm_awareness: '了解', hyperglycemia_knowledge: '需加強', oral_med_adherence: '良好' },
    nextFocus: '飲食代換份量', remarks: '• 腎病變衛教：eGFR 持續下降，說明蛋白質與鈉攝取控制。',
  },
  {
    id: 'sess_seed_881_2', patientId: '10010881', patientName: '林彰美',
    date: '2025-12-20', time: '14:05', educator: '陳美倫 衛教師',
    topics: ['dm_awareness', 'diet', 'exercise'],
    assessments: { dm_awareness: '加強', hypoglycemia_knowledge: '需加強' },
    nextFocus: '', remarks: '',
  },
  {
    id: 'sess_seed_882_1', patientId: '10010882', patientName: '陳彰秀',
    date: '2026-03-12', time: '09:40', educator: '陳美倫 衛教師',
    topics: ['dm_awareness', 'diet', 'hyperlipidemia', 'exercise', 'self_monitoring'],
    assessments: { dm_awareness: '了解', family_social_support: '良好' },
    nextFocus: '運動頻率', remarks: '• 高血脂：總膽固醇、三酸甘油酯超出參考值。',
  },
  {
    id: 'sess_seed_883_1', patientId: '10010883', patientName: '王彰和',
    date: '2026-03-18', time: '11:30', educator: '陳美倫 衛教師',
    topics: ['dm_awareness', 'foot_care', 'oral_med_caution'],
    assessments: { foot_care_status: '尚可', oral_med_adherence: '良好' },
    nextFocus: '足部檢查', remarks: '',
  },
  {
    id: 'sess_seed_883_2', patientId: '10010883', patientName: '王彰和',
    date: '2025-11-05', time: '15:10', educator: '陳美倫 衛教師',
    topics: ['dm_awareness', 'diet'],
    assessments: {},
    nextFocus: '', remarks: '',
  },
];

function loadSaved(): EducationRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as EducationRecord[]) : [];
  } catch {
    return [];
  }
}

export function loadRecords(): EducationRecord[] {
  return [...loadSaved(), ...SEED];
}

// 回傳 false 代表瀏覽器儲存空間不足，紀錄只存在這次畫面
export function saveRecord(rec: EducationRecord): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([rec, ...loadSaved()]));
    return true;
  } catch {
    return false;
  }
}

export function queryRecords(
  all: EducationRecord[],
  q: { patientId: string; from: string; to: string }
): EducationRecord[] {
  return all
    .filter((r) => (!q.patientId.trim() || r.patientId === q.patientId.trim()))
    .filter((r) => (!q.from || r.date >= q.from) && (!q.to || r.date <= q.to))
    .sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
}
