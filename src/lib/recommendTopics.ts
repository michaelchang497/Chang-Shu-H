import { Patient, LabRecord } from '../types';
import { EducationTopicId } from '../data/educationTopics';

// 純前端規則式判斷（不再呼叫 AI／後端 local fallback）。
// 只依實際檢驗數值與診斷文字挑選「有明確數據依據」的固定衛教項目；
// 沒有對應資料可判斷的項目（如視網膜病變、胰島素注射、生病日、口腔照護、
// 旅行注意事項、社會心理支持、戒菸/戒酒/戒檳）刻意留白，交由個管師現場評估勾選，
// 避免在沒有真實依據時做出臨床判斷。

export interface TopicRecommendation {
  id: EducationTopicId;
  reason: string;
}

export function recommendTopics(patient: Patient, current: LabRecord): TopicRecommendation[] {
  const recs: TopicRecommendation[] = [];
  const diagnosis = patient.diagnosis;

  // 基礎衛教：每位糖尿病個案回診都會涵蓋
  recs.push({ id: 'dm_awareness', reason: '糖尿病個案照護網常規衛教項目' });
  recs.push({ id: 'diet', reason: '糖尿病個案照護網常規衛教項目' });
  recs.push({ id: 'chronic_prescription', reason: '已收案追蹤之慢箋病人' });

  if (current.hba1c >= 7.0 || current.fastingGlucose > 130) {
    recs.push({ id: 'hyperglycemia', reason: `HbA1c ${current.hba1c}% / 飯前血糖 ${current.fastingGlucose} mg/dL 高於目標值` });
    recs.push({ id: 'self_monitoring', reason: '血糖控制未達標，需加強自我監測頻率' });
    recs.push({ id: 'self_glucose_adjustment', reason: '血糖控制未達標，需依監測結果調整用藥/飲食' });
  }

  if (current.chol > 200 || current.tg > 150) {
    recs.push({ id: 'hyperlipidemia', reason: `總膽固醇 ${current.chol} mg/dL 或三酸甘油脂 ${current.tg} mg/dL 超出參考值` });
  }

  if (current.egfr < 90 || current.uacr >= 30) {
    recs.push({ id: 'nephropathy', reason: `eGFR ${current.egfr} 或 UACR ${current.uacr} mg/g 顯示腎功能需追蹤` });
  }

  if (patient.bmi >= 24) {
    recs.push({ id: 'exercise', reason: `BMI ${patient.bmi} 過重，建議規律運動介入` });
  }

  if (current.egfr < 60 || patient.age >= 65) {
    recs.push({ id: 'foot_care', reason: current.egfr < 60 ? 'eGFR < 60，周邊血管/神經病變風險上升' : '年齡 ≥ 65 歲，跌倒與足部感覺異常風險上升' });
  }

  if (/腎病變|腎臟病|CKD|高血壓|脂肪肝|高血脂/.test(diagnosis)) {
    recs.push({ id: 'complications', reason: '主診斷併有多重慢性共病，需衛教共病管理' });
  }

  return recs;
}
