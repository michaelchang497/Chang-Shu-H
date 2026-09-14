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

export default function TrendChartCard({ metric, labHistory }: Props) {
  const data = labHistory.map((rec) => ({
    date: rec.date,
    value: rec[metric.key] as number,
  }));
  const current = data[data.length - 1]?.value;
  const isAbnormal =
    current !== undefined &&
    (metric.direction === 'above' ? current > metric.referenceValue : current < metric.referenceValue);

  return (
    <div className="chart-card">
      <div className="chart-card-header">
        <div className="chart-title">
          {metric.labelZh} <span className="en">{metric.labelEn}</span>
        </div>
        <div className={`chart-current ${isAbnormal ? 'abnormal' : ''}`}>
          目前：{current} {metric.unit}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={170}>
        <AreaChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
          <defs>
            <linearGradient id={`fill-${metric.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#14532d" stopOpacity={0.32} />
              <stop offset="100%" stopColor="#14532d" stopOpacity={0} />
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
            stroke="#14532d"
            strokeWidth={2.5}
            fill={`url(#fill-${metric.key})`}
            dot={{ r: 3, fill: '#14532d', strokeWidth: 0 }}
            activeDot={{ r: 5 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
