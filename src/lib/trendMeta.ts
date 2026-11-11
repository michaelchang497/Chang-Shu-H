import { LabRecord } from '../types';

export interface TrendMetric {
  key: keyof LabRecord;
  labelZh: string;
  labelEn: string;
  unit: string;
  referenceValue: number;
  referenceLabel: string;
  direction: 'above' | 'below'; // 'above' = 超過門檻視為異常, 'below' = 低於門檻視為異常
  color: string; // 曲線顏色（對齊舊版：各指標不同色）
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
    color: '#4f46e5',
  },
  {
    key: 'hba1c',
    labelZh: '糖化血色素趨勢',
    labelEn: 'HbA1c',
    unit: '%',
    referenceValue: 7,
    referenceLabel: '血糖目標 ≤ 7%',
    direction: 'above',
    color: '#059669',
  },
  {
    key: 'egfr',
    labelZh: '腎絲球過濾率趨勢',
    labelEn: 'eGFR',
    unit: 'mL/min/1.73m²',
    referenceValue: 60,
    referenceLabel: 'CKD 臨界值 60',
    direction: 'below',
    color: '#0f766e',
  },
  {
    key: 'uacr',
    labelZh: '微量白蛋白尿趨勢',
    labelEn: 'UACR',
    unit: 'mg/g',
    referenceValue: 30,
    referenceLabel: '微量白蛋白尿臨界值 30',
    direction: 'above',
    color: '#ea580c',
  },
  {
    key: 'chol',
    labelZh: '總膽固醇趨勢',
    labelEn: 'Cholesterol',
    unit: 'mg/dL',
    referenceValue: 200,
    referenceLabel: '參考上限 200',
    direction: 'above',
    color: '#be123c',
  },
  {
    key: 'tg',
    labelZh: '三酸甘油脂趨勢',
    labelEn: 'Triglyceride',
    unit: 'mg/dL',
    referenceValue: 150,
    referenceLabel: '參考上限 150',
    direction: 'above',
    color: '#b45309',
  },
];

// labHistory 的 date 格式為 "YYYY-MM"
export const DEFAULT_RANGE_MONTHS = 9; // 院方簡報：預設往前 9 個月

function toIndex(ym: string): number {
  const [y, m] = ym.split('-').map(Number);
  return y * 12 + (m - 1);
}
function fromIndex(i: number): string {
  const y = Math.floor(i / 12);
  const m = (i % 12) + 1;
  return `${y}-${String(m).padStart(2, '0')}`;
}

export interface MonthRange {
  from: string; // YYYY-MM
  to: string; // YYYY-MM
}

// 預設區間：以最新一筆檢驗月份為終點，往前 9 個月
export function defaultRange(dates: string[]): MonthRange {
  const to = dates[dates.length - 1];
  return { from: fromIndex(toIndex(to) - DEFAULT_RANGE_MONTHS), to };
}

export function filterByRange<T extends { date: string }>(rows: T[], range: MonthRange): T[] {
  return rows.filter((r) => r.date >= range.from && r.date <= range.to);
}

export function rangeMonths(range: MonthRange): number {
  return toIndex(range.to) - toIndex(range.from);
}

export function describeRange(range: MonthRange, count: number): string {
  return `${range.from} ~ ${range.to}（共 ${count} 筆檢驗）`;
}
