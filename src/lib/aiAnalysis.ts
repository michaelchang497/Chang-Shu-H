// AI 判讀（衛教主題建議 + 異常值提醒）
//
// 分工原則：
//   程式負責「算」：區間內每筆的異常判定、起迄變化、最新一筆狀態（computeFacts）。
//   模型負責「寫」：衛教摘要、每個主題為何勾選、異常值的說明與提醒（ModelOutput）。
//   所有數字都來自程式算出的 facts，不由模型產生；模型回傳的主題 ID 也會被檢查（assemble）。
//
// 目前沒有後端與模型：simulateModel() 以規則模擬模型輸出，介面與真實模型一致。
// 接上真實模型時，只需把 analyze() 內的 simulateModel(facts) 換成：
//   用 buildPrompt(facts) 呼叫模型，依 MODEL_OUTPUT_SCHEMA 取回 JSON → 交給 assemble()。
// 送給模型的 facts 不含姓名、病歷號，只有年齡、性別、BMI、診斷與檢驗值。

import { LabRecord, Patient } from '../types';
import { EDUCATION_TOPICS, EducationTopicId } from '../data/educationTopics';
import { LAB_ITEMS, LabItemDef, LabKey, LabStatus, statusOf } from './labReference';
import { MonthRange } from './trendMeta';

// ---------- 輸入 ----------
export interface AnalysisInput {
  patient: Pick<Patient, 'age' | 'gender' | 'diagnosis' | 'bmi'>;
  range: MonthRange;
  /** 所選區間內的檢驗（時間由舊到新），可能為空 */
  rangeLabs: LabRecord[];
  /** 最新一次檢驗（不受區間限制） */
  latest: LabRecord;
}

// ---------- 程式算出的事實 ----------
export interface Point {
  date: string;
  value: number;
  status: LabStatus;
}

export interface LabFact {
  key: LabKey;
  labelZh: string;
  labelEn: string;
  unit: string;
  reference: string;
  series: Point[]; // 區間內每一筆
  abnormal: Point[]; // 區間內異常的筆
  latest: Point; // 最新一次
  delta: { from: string; to: string; diff: number; pct: number | null } | null; // 區間首筆→末筆
}

export interface Facts {
  patient: AnalysisInput['patient'];
  range: MonthRange;
  rangeCount: number;
  latestDate: string;
  labs: LabFact[];
}

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

export function computeFacts(input: AnalysisInput): Facts {
  const g = input.patient.gender;
  const labs: LabFact[] = LAB_ITEMS.map((item: LabItemDef) => {
    const series: Point[] = input.rangeLabs.map((r) => ({
      date: r.date,
      value: r[item.key],
      status: statusOf(item, r[item.key], g),
    }));
    const first = series[0];
    const last = series[series.length - 1];
    return {
      key: item.key,
      labelZh: item.labelZh,
      labelEn: item.labelEn,
      unit: item.unit,
      reference: item.reference(g),
      series,
      abnormal: series.filter((p) => p.status !== 'normal'),
      latest: {
        date: input.latest.date,
        value: input.latest[item.key],
        status: statusOf(item, input.latest[item.key], g),
      },
      delta:
        series.length >= 2
          ? {
              from: first.date,
              to: last.date,
              diff: round1(last.value - first.value),
              pct: first.value !== 0 ? round1(((last.value - first.value) / first.value) * 100) : null,
            }
          : null,
    };
  });
  return {
    patient: input.patient,
    range: input.range,
    rangeCount: input.rangeLabs.length,
    latestDate: input.latest.date,
    labs,
  };
}

// ---------- 模型輸出（真實模型需回傳這個形狀） ----------
export interface TopicPick {
  id: EducationTopicId;
  reason: string;
}

export interface ModelOutput {
  /** 條列式衛教摘要；每點格式「標題：內容」，內容簡短 */
  summaryPoints: string[];
  topics: TopicPick[];
  /** key = 檢驗項目 key，value = 對個管師的說明與提醒 */
  findingNotes: Partial<Record<LabKey, string>>;
}

export const MODEL_OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    summaryPoints: {
      type: 'array',
      description: '給該病患的衛教摘要，條列 4-6 點；每點格式「標題：內容」，內容一句話、不超過 40 字',
      items: { type: 'string' },
    },
    topics: {
      type: 'array',
      description: '建議勾選的衛教主題；id 必須是提供清單內的值',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', enum: EDUCATION_TOPICS.map((t) => t.id) },
          reason: { type: 'string', description: '一句話說明為何勾選，引用 facts 內的數值' },
        },
        required: ['id', 'reason'],
      },
    },
    findingNotes: {
      type: 'object',
      description: '只針對 abnormal 不為空的檢驗項目，key 為項目 key；內容為說明與提醒',
      additionalProperties: { type: 'string' },
    },
  },
  required: ['summaryPoints', 'topics', 'findingNotes'],
} as const;

export function buildPrompt(facts: Facts): string {
  const topicList = EDUCATION_TOPICS.map((t) => `${t.id}：${t.label}`).join('\n');
  return `你是彰秀醫院糖尿病個案管理的輔助工具，協助個管師準備門診衛教。請使用繁體中文（台灣醫療用語）。

規則：
1. 只能使用下方 facts 內提供的數值與日期，不得自行計算、推測或編造任何檢驗值、日期、藥物或病史。
2. 衛教主題只能從清單挑選，回傳 id。每個主題以一句話說明理由，並引用 facts 的數值。
3. facts.labs[].abnormal 不為空的項目，需在 findingNotes 以項目 key 提供「說明與提醒」：說明區間內異常的情形（含目前是否已回到正常），並給個管師提醒。
4. summaryPoints 是給該病患的衛教摘要，條列 4-6 點，每點「標題：內容」，內容一句話、不超過 40 字，語氣溫和、避免專業縮寫堆疊。
5. 你的輸出僅供個管師參考，不做診斷或用藥建議。

衛教主題清單：
${topicList}

facts（JSON）：
${JSON.stringify(facts)}

請依 JSON schema 輸出。`;
}

// ---------- 規則模擬（暫代模型） ----------
const STATUS_TEXT: Record<LabStatus, string> = { normal: '正常', high: '偏高', low: '偏低' };

const REMINDER: Partial<Record<LabKey, { high?: string; low?: string }>> = {
  fastingGlucose: {
    high: '請確認採檢是否空腹，並了解近期用藥與飲食狀況。',
    low: '留意低血糖風險，確認病患是否備有糖果並知道處理方式。',
  },
  hba1c: { high: '反映近三個月血糖控制，請確認用藥遵從度與自我監測紀錄。' },
  egfr: { low: '腎功能下降，提醒避免自行服用止痛藥等可能傷腎的藥物，並持續追蹤 UACR。' },
  uacr: { high: '尿蛋白偏高，提醒持續追蹤並控制血糖與血壓。' },
  chol: { high: '宜減少油脂與酒精攝取，必要時請醫師評估血脂追蹤。' },
  tg: { high: '宜減少含糖飲料、酒精與油炸食物，必要時請醫師評估血脂追蹤。' },
  creatinine: { high: '請搭配 eGFR 一併判讀，並提醒水分與藥物使用。' },
  ua: {
    high: '宜減少高普林食物與酒精、適量喝水，並詢問是否有關節紅腫痛；腎功能不佳者請與醫師討論。',
    low: '請與醫師確認是否需要追蹤。',
  },
};

function labOf(facts: Facts, key: LabKey): LabFact {
  return facts.labs.find((l) => l.key === key)!;
}

function describeAbnormal(l: LabFact): string {
  const total = l.series.length;
  const highs = l.abnormal.filter((p) => p.status === 'high');
  const lows = l.abnormal.filter((p) => p.status === 'low');
  const parts: string[] = [];
  if (highs.length) {
    const peak = highs.reduce((a, b) => (b.value > a.value ? b : a));
    parts.push(`偏高 ${highs.length} 筆（最高 ${peak.value} ${l.unit}，${peak.date}）`);
  }
  if (lows.length) {
    const low = lows.reduce((a, b) => (b.value < a.value ? b : a));
    parts.push(`偏低 ${lows.length} 筆（最低 ${low.value} ${l.unit}，${low.date}）`);
  }
  const now =
    l.latest.status === 'normal'
      ? `最新一筆（${l.latest.date}）${l.latest.value} ${l.unit} 已回到參考區間內，但區間內曾異常，建議持續追蹤。`
      : `最新一筆（${l.latest.date}）${l.latest.value} ${l.unit} 仍${STATUS_TEXT[l.latest.status]}。`;
  return `所選區間 ${total} 筆檢驗中，${parts.join('、')}。${now}`;
}

function simulateModel(facts: Facts): ModelOutput {
  const reasons = new Map<EducationTopicId, string[]>();
  const add = (id: EducationTopicId, reason: string) => {
    const list = reasons.get(id) ?? [];
    list.push(reason);
    reasons.set(id, list);
  };
  const fg = labOf(facts, 'fastingGlucose');
  const a1c = labOf(facts, 'hba1c');
  const egfr = labOf(facts, 'egfr');
  const uacr = labOf(facts, 'uacr');
  const chol = labOf(facts, 'chol');
  const tg = labOf(facts, 'tg');
  const ua = labOf(facts, 'ua');
  const { patient } = facts;

  add('dm_awareness', '糖尿病個案照護網常規衛教項目');
  add('diet', '糖尿病個案照護網常規衛教項目');
  add('chronic_prescription', '已收案追蹤之慢箋病人');

  // 高血糖／自我監測
  const sugarHighNow = a1c.latest.value >= 7.0 || fg.latest.value > 130;
  const sugarHighBefore =
    a1c.series.some((p) => p.value >= 7.0) || fg.series.some((p) => p.value > 130);
  if (sugarHighNow) {
    add('hyperglycemia', `最新 HbA1c ${a1c.latest.value}% / 飯前血糖 ${fg.latest.value} mg/dL 高於目標值`);
    add('self_monitoring', '血糖控制未達標，需加強自我監測頻率');
    add('self_glucose_adjustment', '血糖控制未達標，需依監測結果調整用藥/飲食');
  } else if (sugarHighBefore) {
    const peak = a1c.series.reduce((a, b) => (b.value > a.value ? b : a));
    add('hyperglycemia', `所選區間內 HbA1c 曾達 ${peak.value}%（${peak.date}），目前 ${a1c.latest.value}%，需維持控制`);
  }
  if (fg.delta && fg.delta.diff > 0 && (fg.delta.pct ?? 0) >= 10) {
    add('self_monitoring', `區間內飯前血糖由 ${fg.series[0].value} 升至 ${fg.series[fg.series.length - 1].value} mg/dL，建議加強監測`);
  }
  const hypo = fg.series.filter((p) => p.value < 70);
  if (hypo.length) {
    const m = hypo.reduce((a, b) => (b.value < a.value ? b : a));
    add('hypoglycemia_care', `所選區間內飯前血糖曾低至 ${m.value} mg/dL（${m.date}）`);
  }

  // 血脂
  if (chol.latest.value > 200 || tg.latest.value > 150) {
    add('hyperlipidemia', `最新總膽固醇 ${chol.latest.value} mg/dL 或三酸甘油脂 ${tg.latest.value} mg/dL 超出參考值`);
    add('diet', '血脂異常，需衛教油脂與含糖飲料控制');
  } else if (chol.abnormal.length || tg.abnormal.length) {
    add('hyperlipidemia', '所選區間內血脂曾超出參考值，目前已回到範圍內，需維持');
  }

  // 腎臟
  if (egfr.latest.value < 90 || uacr.latest.value >= 30) {
    const trend =
      egfr.delta && egfr.delta.diff < 0
        ? `，區間內 eGFR 由 ${egfr.series[0].value} 降至 ${egfr.series[egfr.series.length - 1].value}`
        : '';
    add('nephropathy', `最新 eGFR ${egfr.latest.value}、UACR ${uacr.latest.value} mg/g 顯示腎功能需追蹤${trend}`);
  } else if (egfr.abnormal.length || uacr.abnormal.length) {
    add('nephropathy', '所選區間內腎功能指標曾異常，目前已回到範圍內，需持續追蹤');
  }

  // 尿酸：固定 23 項裡沒有對應主題，併入飲食衛教
  if (ua.latest.status === 'high' || ua.abnormal.some((p) => p.status === 'high')) {
    add(
      'diet',
      ua.latest.status === 'high'
        ? `最新尿酸 ${ua.latest.value} mg/dL 偏高，飲食衛教併提醒減少高普林食物與酒精`
        : '所選區間內尿酸曾偏高，飲食衛教併提醒高普林食物'
    );
  }

  if (patient.bmi >= 24) add('exercise', `BMI ${patient.bmi} 過重，建議規律運動介入`);

  if (egfr.latest.value < 60 || patient.age >= 65) {
    add(
      'foot_care',
      egfr.latest.value < 60 ? 'eGFR < 60，周邊血管/神經病變風險上升' : '年齡 ≥ 65 歲，跌倒與足部感覺異常風險上升'
    );
  }

  if (/腎病變|腎臟病|CKD|高血壓|脂肪肝|高血脂/.test(patient.diagnosis)) {
    add('complications', '主診斷併有多重慢性共病，需衛教共病管理');
  }

  const topics: TopicPick[] = EDUCATION_TOPICS.filter((t) => reasons.has(t.id)).map((t) => ({
    id: t.id,
    reason: reasons.get(t.id)!.join('；'),
  }));

  // 摘要（條列）
  const sexText = patient.gender === 'M' ? '男' : '女';
  const shortDx = patient.diagnosis.replace(/\s*\([^)]*\)/g, '');
  const abnormalNow = facts.labs.filter((l) => l.latest.status !== 'normal');
  const trendItems = [fg, a1c, egfr, uacr]
    .filter((l) => l.delta && l.delta.diff !== 0)
    .map((l) => `${l.labelZh} ${l.delta!.diff > 0 ? '↑' : '↓'} ${Math.abs(l.delta!.diff)} ${l.unit}`);
  const focus = topics
    .slice(0, 5)
    .map((t) => EDUCATION_TOPICS.find((x) => x.id === t.id)!.label)
    .join('、');
  const onlyBefore = facts.labs.filter((l) => l.abnormal.length > 0 && l.latest.status === 'normal');
  const summaryPoints: string[] = [
    `個案：${patient.age} 歲${sexText}性，${shortDx}`,
    facts.rangeCount > 0
      ? `判讀依據：${facts.range.from} ～ ${facts.range.to}（${facts.rangeCount} 筆）＋ 最新 ${facts.latestDate}`
      : `判讀依據：所選區間無檢驗資料，僅用最新 ${facts.latestDate}`,
    abnormalNow.length
      ? `目前異常：${abnormalNow.map((l) => `${l.labelZh} ${l.latest.value}（${STATUS_TEXT[l.latest.status]}）`).join('、')}`
      : '目前異常：各項檢驗皆在參考區間內',
  ];
  if (trendItems.length) summaryPoints.push(`區間變化：${trendItems.join('、')}`);
  if (onlyBefore.length)
    summaryPoints.push(`曾經異常、目前正常：${onlyBefore.map((l) => l.labelZh).join('、')}（請持續追蹤）`);
  summaryPoints.push(`本次衛教重點：${focus}`);

  const findingNotes: ModelOutput['findingNotes'] = {};
  facts.labs
    .filter((l) => l.abnormal.length > 0)
    .forEach((l) => {
      const rem = REMINDER[l.key];
      const dir = l.abnormal.some((p) => p.status === 'low') && !l.abnormal.some((p) => p.status === 'high') ? 'low' : 'high';
      findingNotes[l.key] = `${describeAbnormal(l)}${rem?.[dir] ? `提醒：${rem[dir]}` : ''}`;
    });

  return { summaryPoints, topics, findingNotes };
}

// ---------- 組裝給畫面用的結果 ----------
export interface AbnormalFinding {
  key: LabKey;
  labelZh: string;
  labelEn: string;
  unit: string;
  reference: string;
  occurrences: Point[]; // 區間內異常的每一筆
  totalCount: number; // 區間內總筆數
  latest: Point;
  note: string;
}

export interface AnalysisResult {
  summaryPoints: string[];
  topics: TopicPick[];
  abnormalFindings: AbnormalFinding[];
}

export function assemble(facts: Facts, out: ModelOutput): AnalysisResult {
  const valid = new Set<string>(EDUCATION_TOPICS.map((t) => t.id));
  const seen = new Set<string>();
  const topics = out.topics.filter((t) => valid.has(t.id) && !seen.has(t.id) && seen.add(t.id));
  const abnormalFindings: AbnormalFinding[] = facts.labs
    .filter((l) => l.abnormal.length > 0)
    .map((l) => ({
      key: l.key,
      labelZh: l.labelZh,
      labelEn: l.labelEn,
      unit: l.unit,
      reference: l.reference,
      occurrences: l.abnormal,
      totalCount: l.series.length,
      latest: l.latest,
      note: out.findingNotes[l.key] ?? '區間內曾出現異常值，請個管師留意。',
    }))
    // 目前仍異常的排前面，其次依異常筆數
    .sort(
      (a, b) =>
        Number(b.latest.status !== 'normal') - Number(a.latest.status !== 'normal') ||
        b.occurrences.length - a.occurrences.length
    );
  return { summaryPoints: out.summaryPoints, topics, abnormalFindings };
}

export async function analyze(input: AnalysisInput): Promise<AnalysisResult> {
  const facts = computeFacts(input);
  // TODO 接真實模型：const out = await callModel(buildPrompt(facts), MODEL_OUTPUT_SCHEMA);
  const out = simulateModel(facts);
  return assemble(facts, out);
}
