import { ASSESSMENT_FIELDS, AssessmentFieldId } from '../data/assessmentFields';
import { EDUCATION_TOPICS, EducationTopicId } from '../data/educationTopics';
import type { AbnormalFinding } from './aiAnalysis';

// 備註欄＝「無法對應固定欄位的細節」。只要衛教項目、評估、下次加強、異常值任何一項有變動，
// 就重新產生這份內容，並併入個管師已經手寫的文字（不會蓋掉）。

const STATUS_WORD = { high: '偏高', low: '偏低', normal: '正常' } as const;

export function buildAutoRemarks(opts: {
  checked: Set<EducationTopicId>;
  reasons: Map<EducationTopicId, string>;
  assessments: Partial<Record<AssessmentFieldId, string>>;
  nextFocus: string;
  findings: AbnormalFinding[];
}): string {
  const out: string[] = [];

  const topics = EDUCATION_TOPICS.filter((t) => opts.checked.has(t.id));
  if (topics.length) {
    out.push('【衛教項目】');
    topics.forEach((t) => out.push(`• ${t.label}：${opts.reasons.get(t.id) ?? '個管師現場加選'}`));
  }

  const assessed = ASSESSMENT_FIELDS.filter((f) => opts.assessments[f.id]);
  if (assessed.length) {
    out.push('【認知與遵從度評估】');
    assessed.forEach((f) => out.push(`• ${f.label}：${opts.assessments[f.id]}`));
  }

  if (opts.nextFocus.trim()) {
    out.push('【下次需加強】');
    out.push(`• ${opts.nextFocus.trim()}`);
  }

  if (opts.findings.length) {
    out.push('【區間內異常值提醒】');
    opts.findings.forEach((f) =>
      out.push(
        `• ${f.labelZh}：異常 ${f.occurrences.length}/${f.totalCount} 筆，最新 ${f.latest.value} ${f.unit}（${STATUS_WORD[f.latest.status]}）`
      )
    );
  }

  return out.join('\n');
}

// 把新產生的內容併入目前備註：
//  1. 備註還是上一版自動內容（或空白）→ 直接換成新版
//  2. 個管師在前後加了文字、但自動內容完整保留 → 只換掉自動內容那一段
//  3. 個管師改動到自動內容中間 → 不覆蓋，把新出現的行補在最後
export function mergeAuto(current: string, prevAuto: string, nextAuto: string): string {
  if (current.trim() === '' || current === prevAuto) return nextAuto;
  if (prevAuto && current.includes(prevAuto)) return current.replace(prevAuto, () => nextAuto);
  const added = nextAuto
    .split('\n')
    .filter((l) => l.trim() && !current.includes(l.trim()));
  return added.length ? `${current}\n${added.join('\n')}` : current;
}
