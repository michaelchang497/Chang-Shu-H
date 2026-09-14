import { LabRecord } from '../types';

export interface TrendMetric {
  key: keyof LabRecord;
  labelZh: string;
  labelEn: string;
  unit: string;
  referenceValue: number;
  referenceLabel: string;
  direction: 'above' | 'below'; // 'above' = 超過門檻視為異常, 'below' = 低於門檻視為異常
}

export const TREND_METRICS: TrendMetric[] = [
  {
    key: 'fastingGlucose',
    labelZh: '血糖波動趨勢（空腹血糖）',
    labelEn: 'AC Sugar',
    unit: 'mg/dL',
    referenceValue: 100,
    referenceLabel: 'ADA 控糖門檻 100',
    direction: 'above',
  },
  {
    key: 'hba1c',
    labelZh: '糖化血色素趨勢',
    labelEn: 'HbA1c',
    unit: '%',
    referenceValue: 7,
    referenceLabel: '血糖目標 ≤ 7%',
    direction: 'above',
  },
  {
    key: 'egfr',
    labelZh: '腎絲球過濾率趨勢',
    labelEn: 'eGFR',
    unit: 'mL/min/1.73m²',
    referenceValue: 60,
    referenceLabel: 'CKD 臨界值 60',
    direction: 'below',
  },
  {
    key: 'uacr',
    labelZh: '微量白蛋白尿趨勢',
    labelEn: 'UACR',
    unit: 'mg/g',
    referenceValue: 30,
    referenceLabel: '微量白蛋白尿臨界值 30',
    direction: 'above',
  },
  {
    key: 'chol',
    labelZh: '總膽固醇趨勢',
    labelEn: 'Cholesterol',
    unit: 'mg/dL',
    referenceValue: 200,
    referenceLabel: '參考上限 200',
    direction: 'above',
  },
  {
    key: 'tg',
    labelZh: '三酸甘油脂趨勢',
    labelEn: 'Triglyceride',
    unit: 'mg/dL',
    referenceValue: 150,
    referenceLabel: '參考上限 150',
    direction: 'above',
  },
];

// labHistory 的 date 格式為 "YYYY-MM"，計算實際涵蓋月數（含頭尾月份）
export function describeDateRange(dates: string[]): string {
  if (dates.length === 0) return '';
  const first = dates[0];
  const last = dates[dates.length - 1];
  const [fy, fm] = first.split('-').map(Number);
  const [ly, lm] = last.split('-').map(Number);
  const months = (ly - fy) * 12 + (lm - fm) + 1;
  return `${months} 個月追蹤歷史脈絡（${first} ~ ${last}）`;
}
