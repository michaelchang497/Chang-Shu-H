import { LabRecord } from '../types';

// 參考區間逐字對齊 reference/1150820I...pptx slide 18-21 的實際檢驗報告截圖
export type LabStatus = 'normal' | 'high' | 'low';

export interface LabItemView {
  key: keyof LabRecord;
  labelZh: string;
  labelEn: string;
  unit: string;
  reference: string;
  value: number;
  status: LabStatus;
}

function statusOf(value: number, low: number | null, high: number | null): LabStatus {
  if (low !== null && value < low) return 'low';
  if (high !== null && value > high) return 'high';
  return 'normal';
}

export function evaluateLab(record: LabRecord): LabItemView[] {
  return [
    {
      key: 'fastingGlucose', labelZh: '飯前血糖', labelEn: 'AC Sugar', unit: 'mg/dL',
      reference: '70-100', value: record.fastingGlucose,
      status: statusOf(record.fastingGlucose, 70, 100),
    },
    {
      key: 'hba1c', labelZh: '糖化血色素', labelEn: 'HbA1c', unit: '%',
      reference: '<5.7 (糖尿病診斷 ≥6.5)', value: record.hba1c,
      status: statusOf(record.hba1c, null, 5.7),
    },
    {
      key: 'egfr', labelZh: '腎絲球過濾率', labelEn: 'eGFR', unit: 'mL/min/1.73m²',
      reference: '>90', value: record.egfr,
      status: statusOf(record.egfr, 90, null),
    },
    {
      key: 'uacr', labelZh: '微量白蛋白尿比', labelEn: 'UACR', unit: 'mg/g',
      reference: '<30', value: record.uacr,
      status: statusOf(record.uacr, null, 30),
    },
    {
      key: 'chol', labelZh: '總膽固醇', labelEn: 'Cholesterol', unit: 'mg/dL',
      reference: '<200', value: record.chol,
      status: statusOf(record.chol, null, 200),
    },
    {
      key: 'tg', labelZh: '三酸甘油脂', labelEn: 'Triglyceride', unit: 'mg/dL',
      reference: '<150', value: record.tg,
      status: statusOf(record.tg, null, 150),
    },
    {
      key: 'creatinine', labelZh: '肌酸酐', labelEn: 'Creatinine', unit: 'mg/dL',
      reference: '0.70-1.20', value: record.creatinine,
      status: statusOf(record.creatinine, 0.7, 1.2),
    },
  ];
}
