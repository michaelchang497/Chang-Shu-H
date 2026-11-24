import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  ReferenceLine,
  CartesianGrid,
} from 'recharts';
import { LabRecord } from '../types';
import { TrendMetric } from '../lib/trendMeta';

interface Props {
  metric: TrendMetric;
  labHistory: LabRecord[];
}

// 四捨五入到最多 1 位小數（HbA1c 等小數指標不被吃掉）
const fmt = (n: number) => String(Math.round(n * 10) / 10);

export default function TrendChartCard({ metric, labHistory }: Props) {
  const data = labHistory.map((rec) => ({
    date: rec.date,
    value: rec[metric.key] as number,
  }));
  const current = data[data.length - 1]?.value;
  if (data.length === 0) {
    return (
      <div className="chart-card">
        <div className="chart-title">
          {metric.labelZh} <span className="en">{metric.labelEn}</span>
        </div>
        <p className="placeholder">此區間內無檢驗資料</p>
      </div>
    );
  }
  // 變化幅度：區間內第一筆 → 最後一筆（區間由使用者選的起迄決定）
  const first = data[0];
  const last = data[data.length - 1];
  const hasDelta = data.length >= 2;
  const diff = last.value - first.value;
  const pct = first.value !== 0 ? (diff / first.value) * 100 : null;
  const flat = Math.round(diff * 10) / 10 === 0;
  const sign = diff > 0 ? '+' : diff < 0 ? '−' : '';

  const isAbnormal =
    current !== undefined &&
    (metric.direction === 'above' ? current > metric.referenceValue : current < metric.referenceValue);

  return (
    <div className="chart-card">
      <div className="chart-card-header">
        <div className="chart-title">
          {metric.labelZh} <span className="en">{metric.labelEn}</span>
        </div>
        <div className={`chart-current ${isAbnormal ? 'abnormal' : ''}`} style={isAbnormal ? undefined : { color: metric.color }}>
          目前：{current} {metric.unit}
        </div>
      </div>
      <div className="chart-delta">
        {hasDelta ? (
          <>
            <span className="delta-range">
              {first.date} → {last.date}
            </span>
            <span className="delta-value">
              {flat ? '— 持平' : `${diff > 0 ? '▲' : '▼'} ${sign}${fmt(Math.abs(diff))} ${metric.unit}`}
              {!flat && pct !== null && `（${sign}${fmt(Math.abs(pct))}%）`}
            </span>
            {!flat && <span className="delta-tag">{diff > 0 ? '上升' : '下降'}</span>}
          </>
        ) : (
          <span className="delta-range">區間內僅 1 筆檢驗，無法計算變化幅度</span>
        )}
      </div>
      <ResponsiveContainer width="100%" height={170}>
        <AreaChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
          <defs>
            <linearGradient id={`fill-${metric.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={metric.color} stopOpacity={0.28} />
              <stop offset="100%" stopColor={metric.color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#eef1f0" vertical={false} />
          <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#9ca3af" />
          <YAxis tick={{ fontSize: 11 }} stroke="#9ca3af" width={44} />
          <Tooltip
            formatter={(value) => [`${value} ${metric.unit}`, metric.labelZh]}
            contentStyle={{ fontSize: 12, borderRadius: 8 }}
          />
          <ReferenceLine
            y={metric.referenceValue}
            stroke="#dc7c8b"
            strokeDasharray="4 4"
            label={{ value: metric.referenceLabel, position: 'insideTopLeft', fontSize: 10, fill: '#b3576a' }}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke={metric.color}
            strokeWidth={2.5}
            fill={`url(#fill-${metric.key})`}
            dot={{ r: 3.5, fill: '#fff', stroke: metric.color, strokeWidth: 2 }}
            activeDot={{ r: 5 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
