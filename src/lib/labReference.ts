import { LabRecord } from '../types';

// 參考區間逐字對齊 reference/1150820I...pptx slide 18-21 的實際檢驗報告截圖。
// UA（尿酸）報告截圖中沒有，區間採一般臨床常用值（男 3.5-7.2 / 女 2.6-6.0），標示示意，待院方確認。
export type LabStatus = 'normal' | 'high' | 'low';
export type Gender = 'M' | 'F';

export type LabKey = Exclude<keyof LabRecord, 'date'>;

export interface LabItemDef {
  key: LabKey;
  labelZh: string;
  labelEn: string;
  unit: string;
  /** 判定用的下限／上限（null = 不設） */
  range: (g: Gender) => { low: number | null; high: number | null };
  /** 畫面上顯示的參考區間文字 */
  reference: (g: Gender) => string;
}

export const LAB_ITEMS: LabItemDef[] = [
  {
    key: 'fastingGlucose', labelZh: '飯前血糖', labelEn: 'AC Sugar', unit: 'mg/dL',
    range: () => ({ low: 70, high: 100 }), reference: () => '70-100',
  },
  {
    key: 'hba1c', labelZh: '糖化血色素', labelEn: 'HbA1c', unit: '%',
    range: () => ({ low: null, high: 5.7 }), reference: () => '<5.7 (糖尿病診斷 ≥6.5)',
  },
  {
    key: 'egfr', labelZh: '腎絲球過濾率', labelEn: 'eGFR', unit: 'mL/min/1.73m²',
    range: () => ({ low: 90, high: null }), reference: () => '>90',
  },
  {
    key: 'uacr', labelZh: '微量白蛋白尿比', labelEn: 'UACR', unit: 'mg/g',
    range: () => ({ low: null, high: 30 }), reference: () => '<30',
  },
  {
    key: 'chol', labelZh: '總膽固醇', labelEn: 'Cholesterol', unit: 'mg/dL',
    range: () => ({ low: null, high: 200 }), reference: () => '<200',
  },
  {
    key: 'tg', labelZh: '三酸甘油脂', labelEn: 'Triglyceride', unit: 'mg/dL',
    range: () => ({ low: null, high: 150 }), reference: () => '<150',
  },
  {
    key: 'creatinine', labelZh: '肌酸酐', labelEn: 'Creatinine', unit: 'mg/dL',
    range: () => ({ low: 0.7, high: 1.2 }), reference: () => '0.70-1.20',
  },
  {
    key: 'ua', labelZh: '尿酸', labelEn: 'UA', unit: 'mg/dL',
    range: (g) => (g === 'M' ? { low: 3.5, high: 7.2 } : { low: 2.6, high: 6.0 }),
    reference: (g) => (g === 'M' ? '3.5-7.2（男）' : '2.6-6.0（女）'),
  },
];

export function statusOf(item: LabItemDef, value: number, gender: Gender): LabStatus {
  const { low, high } = item.range(gender);
  if (low !== null && value < low) return 'low';
  if (high !== null && value > high) return 'high';
  return 'normal';
}

export interface LabItemView {
  key: LabKey;
  labelZh: string;
  labelEn: string;
  unit: string;
  reference: string;
  value: number;
  status: LabStatus;
}

export function evaluateLab(record: LabRecord, gender: Gender): LabItemView[] {
  return LAB_ITEMS.map((item) => ({
    key: item.key,
    labelZh: item.labelZh,
    labelEn: item.labelEn,
    unit: item.unit,
    reference: item.reference(gender),
    value: record[item.key],
    status: statusOf(item, record[item.key], gender),
  }));
}
