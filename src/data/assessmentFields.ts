// 個案認知與遵從度評估——對應個管系統「衛教作業」表單下半部的單選欄位群
// (見 reference 簡報 slide 15/17 截圖)。這一組跟上方 23 項衛教主題勾選不同：
// 主題勾選是「今天教了什麼」，可依檢驗值判斷；這裡是「病患聽懂/做得到多少」，
// 只能由個管師跟病患對談後主觀填寫，沒有預設值、也不該由系統自動判斷。

export type AssessmentFieldId =
  | 'dm_awareness'
  | 'oral_med_adherence'
  | 'hyperglycemia_knowledge'
  | 'hypoglycemia_knowledge'
  | 'chronic_complication_knowledge'
  | 'sick_day_management'
  | 'travel_precaution_knowledge'
  | 'family_social_support'
  | 'insulin_injection_status'
  | 'foot_care_status';

export interface AssessmentField {
  id: AssessmentFieldId;
  label: string;
  options: string[];
}

export const ASSESSMENT_FIELDS: AssessmentField[] = [
  { id: 'dm_awareness', label: '認識糖尿病', options: ['了解', '加強', '不了解'] },
  { id: 'oral_med_adherence', label: '口服藥遵從性（種類/劑量/用法）', options: ['良好', '尚可', '不佳', '未用藥'] },
  { id: 'hyperglycemia_knowledge', label: '高血糖知識', options: ['了解', '需加強'] },
  { id: 'hypoglycemia_knowledge', label: '低血糖知識', options: ['了解', '需加強'] },
  { id: 'chronic_complication_knowledge', label: '慢性合併症', options: ['了解', '需加強'] },
  { id: 'sick_day_management', label: '生病日處理', options: ['了解', '需加強'] },
  { id: 'travel_precaution_knowledge', label: '旅行注意事項', options: ['了解', '需加強'] },
  { id: 'family_social_support', label: '家庭/社會支持系統', options: ['良好', '尚可', '不佳'] },
  { id: 'insulin_injection_status', label: '注射胰島素', options: ['良好', '尚可', '不佳', '無施打'] },
  { id: 'foot_care_status', label: '足部照護（穿著鞋襪）', options: ['良好', '尚可', '不佳'] },
];
