import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartTooltip } from "../components/ChartTooltip";
import { Card, ErrorNote, PageTitle, StatCard } from "../components/ui";
import { api } from "../lib/api";
import { TYPE_COLORS, TYPE_LABELS } from "../lib/labels";
import { Overview, RequestType, SchoolStat, WeekPoint } from "../lib/types";

type Period = "week" | "month" | "all";

const PERIOD_LABELS: Record<Period, string> = { week: "Hafta", month: "Oy", all: "Hammasi" };

export default function Dashboard() {
  const [period, setPeriod] = useState<Period>("week");
  const [overview, setOverview] = useState<Overview | null>(null);
  const [weekly, setWeekly] = useState<WeekPoint[]>([]);
  const [schools, setSchools] = useState<SchoolStat[]>([]);
  const [error, setError] = useState("");

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
  }, [query]);

  useEffect(() => {
    api<WeekPoint[]>("/api/stats/weekly").then(setWeekly).catch((e) => setError(e.message));
  }, []);

  const typeData = useMemo(
    () =>
      (Object.keys(TYPE_LABELS) as RequestType[]).map((t) => ({
        key: t,
        name: TYPE_LABELS[t],
        value: overview?.byType[t] ?? 0,
      })),
    [overview]
  );

  const moduleData = useMemo(
    () =>
      (overview?.byModule ?? [])
        .map((m) => ({ name: m.name, count: m.count }))
        .sort((a, b) => b.count - a.count),
    [overview]
  );

  const total = overview?.total ?? 0;

  return (
    <div>
      <PageTitle
        right={
          <div className="flex rounded-lg border border-black/10 bg-surface p-0.5">
            {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                  period === p ? "bg-accent text-white" : "text-ink-2 hover:bg-black/5"
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

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Jami so'rovlar" value={total} />
        <StatCard label="Bug" value={overview?.byType.BUG ?? 0} dotColor={TYPE_COLORS.BUG} />
        <StatCard label="Muammo-savol" value={overview?.byType.ISSUE ?? 0} dotColor={TYPE_COLORS.ISSUE} />
        <StatCard label="Taklif" value={overview?.byType.SUGGESTION ?? 0} dotColor={TYPE_COLORS.SUGGESTION} />
      </div>

      <Card className="mt-4">
        <h2 className="mb-4 text-sm font-semibold text-ink-2">Haftalik trend — jami so'rovlar (12 hafta)</h2>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={weekly} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
              <CartesianGrid stroke="#e1e0d9" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: "#898781" }}
                axisLine={{ stroke: "#c3c2b7" }}
                tickLine={false}
              />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#898781" }} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTooltip />} />
              <Line
                name="So'rovlar"
                type="monotone"
                dataKey="total"
                stroke="#2a78d6"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card>
          <h2 className="mb-4 text-sm font-semibold text-ink-2">Modul bo'yicha</h2>
          <div style={{ height: Math.max(220, moduleData.length * 30 + 16) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={moduleData} layout="vertical" margin={{ top: 0, right: 28, bottom: 0, left: 0 }}>
                <XAxis type="number" hide />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={148}
                  tick={{ fontSize: 11, fill: "#52514e" }}
                  tickFormatter={(v: string) => (v.length > 20 ? v.slice(0, 19) + "…" : v)}
                  interval={0}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(11,11,11,0.04)" }} />
                <Bar
                  name="So'rovlar"
                  dataKey="count"
                  fill="#2a78d6"
                  radius={[0, 4, 4, 0]}
                  barSize={16}
                  label={{ position: "right", fill: "#52514e", fontSize: 12 }}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <h2 className="mb-4 text-sm font-semibold text-ink-2">Turi bo'yicha</h2>
          <div className="relative h-44">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={typeData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius="64%"
                  outerRadius="88%"
                  paddingAngle={2}
                  stroke="#fcfcfb"
                  strokeWidth={2}
                >
                  {typeData.map((d) => (
                    <Cell key={d.key} fill={TYPE_COLORS[d.key]} />
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
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: TYPE_COLORS[d.key] }} />
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
          <h2 className="mb-4 text-sm font-semibold text-ink-2">Top-5 maktab</h2>
          {schools.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted">Hozircha ma'lumot yo'q</p>
          ) : (
            <table className="w-full text-sm">
              <tbody>
                {schools.slice(0, 5).map((s, i) => (
                  <tr key={s.id} className="border-b border-black/5 last:border-0">
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
