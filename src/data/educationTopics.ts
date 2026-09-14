// 固定衛教主題清單 — 逐字對齊個管系統「衛教作業」頁籤的 23 個既有 checkbox 項目
// (見 reference/1150820I知了衛教室個管畫面資料提供(更新).pptx, slide 15 / 17 截圖)
// 這裡不再由 AI／規則引擎自由生成標題，只能從這份固定清單中挑選，
// 確保產生的衛教紀錄能對應勾選回個管系統既有欄位。

export type EducationTopicId =
  | 'dm_awareness'
  | 'diet'
  | 'hypoglycemia_care'
  | 'hyperglycemia'
  | 'hyperlipidemia'
  | 'exercise'
  | 'foot_care'
  | 'self_monitoring'
  | 'self_glucose_adjustment'
  | 'retinopathy'
  | 'oral_med_caution'
  | 'insulin_injection'
  | 'chronic_prescription'
  | 'nephropathy'
  | 'sick_day'
  | 'uti'
  | 'oral_care'
  | 'complications'
  | 'travel'
  | 'psychosocial_support'
  | 'smoking_cessation'
  | 'alcohol_cessation'
  | 'betel_nut_cessation';

export interface EducationTopic {
  id: EducationTopicId;
  label: string;
}

export const EDUCATION_TOPICS: EducationTopic[] = [
  { id: 'dm_awareness', label: '認識糖尿病' },
  { id: 'diet', label: '飲食衛教' },
  { id: 'hypoglycemia_care', label: '低血糖護理衛教' },
  { id: 'hyperglycemia', label: '高血糖衛教' },
  { id: 'hyperlipidemia', label: '高血脂' },
  { id: 'exercise', label: '運動衛教' },
  { id: 'foot_care', label: '足部護理衛教' },
  { id: 'self_monitoring', label: '自我監測' },
  { id: 'self_glucose_adjustment', label: '自我依血糖監測調整衛教' },
  { id: 'retinopathy', label: '視網膜病變衛教' },
  { id: 'oral_med_caution', label: '口服降血糖藥注意事項' },
  { id: 'insulin_injection', label: '胰島素注射衛教' },
  { id: 'chronic_prescription', label: '慢箋回院衛教' },
  { id: 'nephropathy', label: '腎病變衛教' },
  { id: 'sick_day', label: '生病日衛教' },
  { id: 'uti', label: '泌尿道感染衛教' },
  { id: 'oral_care', label: '口腔照護衛教' },
  { id: 'complications', label: '合併症衛教' },
  { id: 'travel', label: '旅行注意事項衛教' },
  { id: 'psychosocial_support', label: '社會及心理支持' },
  { id: 'smoking_cessation', label: '戒菸衛教' },
  { id: 'alcohol_cessation', label: '戒酒衛教' },
  { id: 'betel_nut_cessation', label: '戒檳衛教' },
];
