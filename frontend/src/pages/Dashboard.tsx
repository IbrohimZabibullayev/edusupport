import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartTooltip } from "../components/ChartTooltip";
import { TrendArea } from "../components/TrendArea";
import { OperatorWorkloadSection } from "../components/OperatorWorkload";
import { Card, ErrorNote, MetricStrip, PageTitle, Section } from "../components/ui";
import { api } from "../lib/api";
import { formatMinutes } from "../lib/labels";
import { CHART, CHART_INK } from "../lib/chartColors";
import { useActiveRequestTypes } from "../lib/requestTypes";
import {
  ModuleCombined,
  Overview,
  SchoolStat,
  SupportLogStats,
  TrendResponse,
} from "../lib/types";
type Period = "week" | "month" | "all";
const PERIOD_LABELS: Record<Period, string> = { week: "Hafta", month: "Oy", all: "Hammasi" };
const TREND_TITLES: Record<Period, string> = {
  week: "So'nggi 7 kun — kunlik",
  month: "So'nggi 30 kun — kunlik",
  all: "So'nggi 12 hafta — haftalik",
};
export default function Dashboard() {
  const [period, setPeriod] = useState<Period>("week");
  const [overview, setOverview] = useState<Overview | null>(null);
  const [trend, setTrend] = useState<TrendResponse | null>(null);
  const [schools, setSchools] = useState<SchoolStat[]>([]);
  const [logStats, setLogStats] = useState<SupportLogStats | null>(null);
  const [modulesCombined, setModulesCombined] = useState<ModuleCombined[]>([]);
  const [error, setError] = useState("");
  const requestTypes = useActiveRequestTypes();
  const query = useMemo(() => {
    if (period === "all") return "";
    const days = period === "week" ? 7 : 30;
    const from = new Date(Date.now() - days * 86400000).toISOString();
    return `?from=${encodeURIComponent(from)}`;
  }, [period]);
  useEffect(() => {
    setError("");
    api<Overview>(`/api/stats/overview${query}`).then(setOverview).catch((e) => setError(e.message));
    api<SchoolStat[]>(`/api/stats/schools${query}`).then(setSchools).catch((e) => setError(e.message));
    api<TrendResponse>(`/api/stats/trend?period=${period}`).then(setTrend).catch((e) => setError(e.message));
    api<SupportLogStats>(`/api/support-logs/stats${query}`).then(setLogStats).catch((e) => setError(e.message));
    api<ModuleCombined[]>(`/api/stats/modules-combined${query}`).then(setModulesCombined).catch((e) => setError(e.message));
  }, [query, period]);
  const typeData = useMemo(
    () =>
      requestTypes.map((t) => ({
        key: t.key,
        name: t.name,
        color: t.color,
        value: overview?.byType[t.key] ?? 0,
      })),
    [overview, requestTypes]
  );
  const moduleData = useMemo(
    () => [...modulesCombined].sort((a, b) => b.requests + b.logs - (a.requests + a.logs)),
    [modulesCombined]
  );
  const total = overview?.total ?? 0;
  return (
    <div>
      <PageTitle
        right={
          <div className="flex rounded-lg border border-grid bg-surface p-0.5">
            {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                  period === p ? "bg-ink text-white" : "text-ink-2 hover:bg-black/5"
                }`}
              >
                {PERIOD_LABELS[p]}
              </button>
            ))}
          </div>
        }
      >
        Boshqaruv paneli
      </PageTitle>
      <ErrorNote message={error} />
      <MetricStrip
        items={[
          {
            label: "Jami so'rov",
            value: total,
            sub: <span className="text-[11px] text-muted">{PERIOD_LABELS[period].toLowerCase()}</span>,
          },
          ...typeData.map((d) => ({
            label: d.name,
            value: d.value,
            dotColor: d.color,
            sub: total > 0 ? <span className="text-[11px] tabular-nums text-muted">{Math.round((d.value / total) * 100)}%</span> : undefined,
          })),
        ]}
      />
      <Section title="Support log" hint="Operator dasturchisiz o'zi hal qilgan muammolar">
        <MetricStrip
          items={[
            { label: "Loglar", value: logStats?.total ?? 0 },
            { label: "Sarflangan vaqt", value: formatMinutes(logStats?.totalMinutes ?? 0) },
            { label: "Takroriy", value: logStats?.recurringCount ?? 0 },
            {
              label: "O'rtacha",
              value:
                logStats && logStats.total > 0
                  ? formatMinutes(Math.round(logStats.totalMinutes / logStats.total))
                  : "—",
            },
          ]}
        />
      </Section>
      <Section title="Trend" hint={`Jami so'rovlar — ${TREND_TITLES[period].toLowerCase()}`}>
      <Card>
        <TrendArea
          data={trend?.points ?? []}
          series={[{ key: "total", name: "So'rovlar", color: CHART.requests }]}
        />
      </Card>
      </Section>
      <Section
        title="Modullar"
        hint="Qancha muammo guruhga yuborilgan va qanchasini operator o'zi hal qilgan"
        right={
          <span className="text-xs text-muted">
            <span className="mr-3 inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: CHART.requests }} /> so'rov
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: CHART.logs }} /> log
            </span>
          </span>
        }
      >
      <Card>
        {moduleData.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted">Hozircha ma'lumot yo'q</p>
        ) : (
          <div style={{ height: Math.max(180, moduleData.length * 30 + 16) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={moduleData} layout="vertical" margin={{ top: 0, right: 28, bottom: 0, left: 0 }} barGap={2}>
                <XAxis type="number" hide />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={148}
                  tick={{ fontSize: 11, fill: CHART_INK.label }}
                  tickFormatter={(v: string) => (v.length > 20 ? v.slice(0, 19) + "…" : v)}
                  interval={0}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(11,11,11,0.04)" }} />
                <Bar name="Guruhga so'rov" dataKey="requests" fill={CHART.requests} radius={[0, 2, 2, 0]} barSize={8} label={{ position: "right", fill: CHART_INK.label, fontSize: 11 }} />
                <Bar name="Support log" dataKey="logs" fill={CHART.logs} radius={[0, 2, 2, 0]} barSize={8} label={{ position: "right", fill: CHART_INK.label, fontSize: 11 }} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>
      </Section>
      <OperatorWorkloadSection />
      <div className="mt-7 grid gap-3 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 text-sm font-semibold">Turi bo'yicha</h2>
          <div className="relative h-40">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={typeData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius="64%"
                  outerRadius="88%"
                  paddingAngle={2}
                  stroke={CHART_INK.surface}
                  strokeWidth={2}
                >
                  {typeData.map((d) => (
                    <Cell key={d.key} fill={d.color} />
                  ))}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-semibold">{total}</span>
              <span className="text-xs text-muted">jami</span>
            </div>
          </div>
          <ul className="mt-3 space-y-1.5">
            {typeData.map((d) => (
              <li key={d.key} className="flex items-center gap-2 text-sm">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                <span className="flex-1 text-ink-2">{d.name}</span>
                <span className="font-medium tabular-nums">{d.value}</span>
                <span className="w-11 text-right text-xs tabular-nums text-muted">
                  {total > 0 ? Math.round((d.value / total) * 100) : 0}%
                </span>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <h2 className="mb-3 text-sm font-semibold">Top-5 maktab</h2>
          {schools.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted">Hozircha ma'lumot yo'q</p>
          ) : (
            <table className="w-full text-sm">
              <tbody>
                {schools.slice(0, 5).map((s, i) => (
                  <tr key={s.id} className="border-b border-grid last:border-0">
                    <td className="py-2 pr-2 text-muted">{i + 1}.</td>
                    <td className="py-2 pr-2">{s.name}</td>
                    <td className="py-2 text-right font-medium tabular-nums">{s.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>
    </div>
  );
}
