export interface LabRecord {
  date: string;
  fastingGlucose: number; // Glucose(AC), mg/dL, ref 70-100
  hba1c: number; // HbA1C, %, ref <5.7 正常 / 5.7-6.4 糖尿病前期 / >=6.5 糖尿病
  creatinine: number; // Creatinine, mg/dL, ref 0.70-1.20
  egfr: number; // eGFR估算, mL/min/1.73m2, ref >90
  uacr: number; // ACR(MA/Cr), mg/g, ref <30
  chol: number; // Cholesterol(total), mg/dL, ref <200
  tg: number; // Triglyceride, mg/dL, ref <150
}

export interface NutritionRecord {
  id: string;
  date: string;
  nutritionist: string;
  weight: number;
  bmi: number;
  pesDiagnosis: string;
  intervention: string;
  adimeText: string;
}

export interface Patient {
  id: string;
  name: string;
  age: number;
  gender: 'M' | 'F';
  diagnosis: string;
  height: number;
  weight: number;
  bmi: number;
  labHistory: LabRecord[];
  nutritionHistory: NutritionRecord[];
}
