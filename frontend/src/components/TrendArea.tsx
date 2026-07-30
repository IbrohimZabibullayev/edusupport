import { useId } from "react";
import { Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartTooltip } from "./ChartTooltip";
import { CHART_INK } from "../lib/chartColors";

export interface TrendSeries {
  /** Ma'lumotdagi maydon nomi */
  key: string;
  /** Legendada va tooltipda ko'rinadigan nom */
  name: string;
  color: string;
}

/**
 * Vaqt bo'yicha chiziqli grafiklarning yagona ko'rinishi.
 *
 * Dashboarddagi hamma trend grafigi shu komponentdan foydalanadi — aks holda
 * biri gradientli, biri yalang'och bo'lib ketadi. Bitta qator bo'lsa legenda
 * chiqmaydi (sarlavha uni nomlaydi), ikki va undan ko'p bo'lsa doim chiqadi.
 */
export function TrendArea({
  data,
  series,
  height = 176,
}: {
  data: object[];
  series: TrendSeries[];
  height?: number;
}) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -22 }}>
          <defs>
            {series.map((s) => (
              <linearGradient key={s.key} id={`${uid}-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={s.color} stopOpacity={0.16} />
                <stop offset="100%" stopColor={s.color} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid stroke={CHART_INK.grid} vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: CHART_INK.axis }}
            axisLine={{ stroke: CHART_INK.grid }}
            tickLine={false}
            minTickGap={12}
          />
          <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: CHART_INK.axis }} axisLine={false} tickLine={false} />
          <Tooltip content={<ChartTooltip />} cursor={{ stroke: CHART_INK.axis, strokeDasharray: "3 3" }} />
          {series.length > 1 && <Legend wrapperStyle={{ fontSize: 12, paddingTop: 6 }} iconType="plainline" />}
          {series.map((s) => (
            <Area
              key={s.key}
              name={s.name}
              type="monotone"
              dataKey={s.key}
              stroke={s.color}
              strokeWidth={2}
              fill={`url(#${uid}-${s.key})`}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 2, stroke: CHART_INK.surface }}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
