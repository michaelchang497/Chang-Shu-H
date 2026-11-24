import { mockPatients } from '../data/patientData';
import { evaluateLab } from './labReference';
import { EducationRecord } from './educationHistory';

// 示範用的舊紀錄沒有「完成當下的快照」。顯示衛教紀錄單前，依病歷號與紀錄日期
// 補上病患資料與當時最近一筆檢驗，讓每一筆紀錄都能以同一種版型呈現。
export function ensureSnapshot(rec: EducationRecord): EducationRecord {
  if (rec.snapshot) return rec;
  const p = mockPatients.find((x) => x.id === rec.patientId);
  if (!p || p.labHistory.length === 0) return rec;
  const ym = rec.date.slice(0, 7);
  const upTo = p.labHistory.filter((l) => l.date <= ym);
  const lab = upTo[upTo.length - 1] ?? p.labHistory[0];
  return {
    ...rec,
    snapshot: {
      age: p.age,
      gender: p.gender,
      height: p.height,
      weight: p.weight,
      bmi: p.bmi,
      diagnosis: p.diagnosis,
      labDate: lab.date,
      labs: evaluateLab(lab, p.gender).map((r) => ({
        labelZh: r.labelZh,
        labelEn: r.labelEn,
        value: r.value,
        unit: r.unit,
        reference: r.reference,
        status: r.status,
      })),
    },
  };
}
