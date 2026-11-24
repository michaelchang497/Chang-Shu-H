import { ASSESSMENT_FIELDS } from '../data/assessmentFields';
import { EducationRecord } from './educationHistory';

// 衛教紀錄單上的「本次衛教重點」。
// 給病患看的簡短重點，只用紀錄裡已有的資料、依固定範本組出來，不經過模型判讀。
// 之後要改由 .py 產出格式時，換掉這個函式即可（輸入：EducationRecord，輸出：「標題：內容」字串陣列）。

const STATUS_WORD = { high: '偏高', low: '偏低', normal: '正常' } as const;
const NEED_MORE = new Set(['加強', '需加強', '不了解', '不佳']);

export function buildKeyPoints(rec: EducationRecord): string[] {
  const points: string[] = [];

  const labs = rec.snapshot?.labs;
  if (labs && labs.length) {
    const abnormal = labs.filter((l) => l.status !== 'normal');
    points.push(
      abnormal.length
        ? `需要注意的檢驗：${abnormal.map((l) => `${l.labelZh} ${l.value}（${STATUS_WORD[l.status]}）`).join('、')}`
        : '檢驗結果：各項都在參考範圍內'
    );
  }

  const needMore = ASSESSMENT_FIELDS.filter((f) => NEED_MORE.has(rec.assessments[f.id] ?? ''));
  if (needMore.length) {
    points.push(`需要再加強：${needMore.map((f) => f.label).join('、')}`);
  }

  if (rec.nextFocus.trim()) {
    points.push(`下次回診重點：${rec.nextFocus.trim()}`);
  }

  return points;
}
