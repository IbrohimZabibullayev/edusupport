import { useEffect, useState } from "react";

import { TrendArea } from "./TrendArea";
import { Card } from "./ui";
import { api } from "../lib/api";
import { CHART, TREND_TONE } from "../lib/chartColors";
import { formatMinutes } from "../lib/labels";
import { OperatorWorkload, WorkloadGranularity, WorkloadResponse } from "../lib/types";

/**
 * Sokin, past to'yingan palitra — dataviz validatoridan o'tgan
 * (yorug'lik oralig'i, chroma, CVD ajralishi, kontrast).
 * Ma'nosi butun bo'limda bir xil: ko'k — guruhga so'rov, terrakota — support log.
 */
const C_REQ = CHART.requests;
const C_LOG = CHART.logs;

const PERIODS: { key: WorkloadGranularity; label: string; unit: string }[] = [
  { key: "day", label: "Kunlik", unit: "kun" },
  { key: "week", label: "Haftalik", unit: "hafta" },
  { key: "month", label: "Oylik", unit: "oy" },
];

/** O'zgarish foizi; oldingi davr nol bo'lsa foiz ma'nosiz — null qaytaramiz */
function changePercent(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return Math.round(((current - previous) / previous) * 100);
}

/**
 * O'zgarish ko'rsatkichi. Rang faqat "yaxshi/yomon" ma'lum bo'lganda ishlatiladi
 * va doim strelka + foiz bilan birga keladi — rangning o'zi ma'no tashimaydi.
 */
function Delta({
  current,
  previous,
  goodDirection,
}: {
  current: number;
  previous: number;
  goodDirection?: "up" | "down";
}) {
  const pct = changePercent(current, previous);
  if (pct === null) return <span className="text-xs text-muted">yangi</span>;
  if (pct === 0) return <span className="text-xs text-muted">o'zgarmadi</span>;

  const up = pct > 0;
  // Yo'nalish ma'nosi ma'lum bo'lsagina rang beriladi; strelka baribir bor,
  // ya'ni ma'no faqat rangga tayanmaydi (Tailwind dinamik klass qura olmaydi — inline)
  const good = goodDirection ? (up ? goodDirection === "up" : goodDirection === "down") : null;
  const color = good === null ? undefined : good ? TREND_TONE.good : TREND_TONE.bad;
  return (
    <span className="text-xs tabular-nums text-ink-2" style={color ? { color } : undefined}>
      {up ? "↑" : "↓"} {Math.abs(pct)}%
    </span>
  );
}

/** Bitta ko'rsatkich: katta raqam + oldingi davrga nisbatan o'zgarish */
function Metric({
  label,
  value,
  current,
  previous,
  goodDirection,
  hint,
}: {
  label: string;
  value: string;
  current: number;
  previous: number;
  goodDirection?: "up" | "down";
  hint: string;
}) {
  return (
    <div className="border-b border-grid px-4 py-3.5 last:border-b-0 sm:border-b-0">
      <div className="text-[11px] uppercase tracking-wide text-muted">{label}</div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="text-[22px] font-semibold leading-none tabular-nums tracking-tight">{value}</span>
        <Delta current={current} previous={previous} goodDirection={goodDirection} />
      </div>
      <div className="mt-1.5 text-[11px] text-muted">{hint}</div>
    </div>
  );
}

/** Jadvaldagi kichkina o'zgarish belgisi */
function MiniDelta({ current, previous }: { current: number; previous: number }) {
  const pct = changePercent(current, previous);
  if (pct === null || pct === 0) return <span className="text-[11px] text-muted">—</span>;
  return (
    <span className="text-[11px] tabular-nums text-ink-2">
      {pct > 0 ? "↑" : "↓"}
      {Math.abs(pct)}%
    </span>
  );
}

/** Nisbiy yuklamani ko'rsatuvchi ingichka chiziq (jadval ichida) */
function LoadBar({ requests, logs, max }: { requests: number; logs: number; max: number }) {
  if (max === 0) return null;
  return (
    <span className="flex h-1.5 w-24 overflow-hidden rounded-full bg-black/5">
      <span style={{ width: `${(requests / max) * 100}%`, backgroundColor: C_REQ }} />
      <span style={{ width: `${(logs / max) * 100}%`, backgroundColor: C_LOG }} />
    </span>
  );
}

export function OperatorWorkloadSection() {
  const [granularity, setGranularity] = useState<WorkloadGranularity>("day");
  const [data, setData] = useState<WorkloadResponse | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<WorkloadResponse>(`/api/stats/workload?granularity=${granularity}`)
      .then(setData)
      .catch((e) => setError(e.message));
  }, [granularity]);

  const period = PERIODS.find((p) => p.key === granularity)!;
  const cur = data?.current;
  const prev = data?.previous;
  const rows: OperatorWorkload[] = data?.operators ?? [];
  const active = rows.filter((r) => r.requests + r.logs > 0);
  const maxLoad = Math.max(1, ...active.map((r) => r.requests + r.logs));
  const avgPerDay = cur && cur.activeDays > 0 ? Math.round(cur.minutes / cur.activeDays) : 0;
  const prevAvg = prev && prev.activeDays > 0 ? Math.round(prev.minutes / prev.activeDays) : 0;

  return (
    <section className="mt-7">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2 border-b border-grid pb-2">
        <div>
          <h2 className="text-sm font-semibold tracking-tight">Operatorlar yuklamasi</h2>
          <p className="mt-0.5 text-xs text-muted">
            Joriy {period.unit} — oldingi {period.unit} bilan solishtirilgan
            {data?.currentLabel ? ` (${data.currentLabel})` : ""}
          </p>
        </div>
        <div className="flex rounded-lg border border-grid bg-surface p-0.5">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              onClick={() => setGranularity(p.key)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                granularity === p.key ? "bg-ink text-white" : "text-ink-2 hover:bg-black/5"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="mb-3 text-sm text-danger">{error}</p>}

      <div className="grid grid-cols-1 divide-grid overflow-hidden rounded-lg border border-grid bg-surface sm:grid-cols-2 sm:divide-x lg:grid-cols-4">
        <Metric
          label="Guruhga so'rov"
          value={String(cur?.requests ?? 0)}
          current={cur?.requests ?? 0}
          previous={prev?.requests ?? 0}
          goodDirection="down"
          hint={`oldingi ${period.unit}: ${prev?.requests ?? 0}`}
        />
        <Metric
          label="Support log"
          value={String(cur?.logs ?? 0)}
          current={cur?.logs ?? 0}
          previous={prev?.logs ?? 0}
          goodDirection="up"
          hint={`oldingi ${period.unit}: ${prev?.logs ?? 0}`}
        />
        <Metric
          label="Sarflangan vaqt"
          value={cur?.minutes ? formatMinutes(cur.minutes) : "—"}
          current={cur?.minutes ?? 0}
          previous={prev?.minutes ?? 0}
          hint={`oldingi ${period.unit}: ${prev?.minutes ? formatMinutes(prev.minutes) : "—"}`}
        />
        <Metric
          label="Kuniga o'rtacha"
          value={avgPerDay ? formatMinutes(avgPerDay) : "—"}
          current={avgPerDay}
          previous={prevAvg}
          hint={cur?.activeDays ? `${cur.activeDays} ta ishlagan kun` : "ma'lumot yo'q"}
        />
      </div>

      <Card className="mt-3">
        <div className="mb-4 flex items-baseline justify-between">
          <h3 className="text-sm font-medium">Dinamika</h3>
          <span className="text-xs text-muted">
            oxirgi {data?.series.length ?? 0} {period.unit}
          </span>
        </div>
        <TrendArea
          height={224}
          data={data?.series ?? []}
          series={[
            { key: "requests", name: "Guruhga so'rov", color: C_REQ },
            { key: "logs", name: "Support log", color: C_LOG },
          ]}
        />
      </Card>

      <Card className="mt-3">
        <div className="mb-4 flex items-baseline justify-between">
          <h3 className="text-sm font-medium">Operatorlar kesimida</h3>
          <span className="text-xs text-muted">
            <span className="mr-3 inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: C_REQ }} /> so'rov
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: C_LOG }} /> log
            </span>
          </span>
        </div>

        {active.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted">Bu {period.unit}da hali harakat yo'q</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-grid text-left text-[11px] uppercase tracking-wide text-muted">
                  <th className="pb-2 pr-3 font-medium">Operator</th>
                  <th className="pb-2 pr-3 font-medium">Yuklama</th>
                  <th className="pb-2 pr-3 text-right font-medium">So'rov</th>
                  <th className="pb-2 pr-3 text-right font-medium">Log</th>
                  <th className="pb-2 pr-3 text-right font-medium">Vaqt</th>
                  <th className="pb-2 pr-3 text-right font-medium">Kun</th>
                  <th className="pb-2 text-right font-medium">Kuniga</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const idle = r.requests + r.logs === 0;
                  return (
                    <tr
                      key={r.id}
                      className={`border-b border-grid last:border-0 ${idle ? "text-muted" : "hover:bg-black/[0.015]"}`}
                    >
                      <td className="py-2.5 pr-3">
                        <div className={idle ? "" : "font-medium"}>{r.fullName}</div>
                        {r.username && <div className="text-[11px] text-muted">@{r.username}</div>}
                      </td>
                      <td className="py-2.5 pr-3">
                        <LoadBar requests={r.requests} logs={r.logs} max={maxLoad} />
                      </td>
                      <td className="py-2.5 pr-3 text-right">
                        <div className="tabular-nums">{r.requests}</div>
                        <MiniDelta current={r.requests} previous={r.prevRequests} />
                      </td>
                      <td className="py-2.5 pr-3 text-right">
                        <div className="tabular-nums">{r.logs}</div>
                        <MiniDelta current={r.logs} previous={r.prevLogs} />
                      </td>
                      <td className="py-2.5 pr-3 text-right">
                        <div className="tabular-nums">{r.minutes ? formatMinutes(r.minutes) : "—"}</div>
                        <MiniDelta current={r.minutes} previous={r.prevMinutes} />
                      </td>
                      <td className="py-2.5 pr-3 text-right tabular-nums">{r.activeDays || "—"}</td>
                      <td className="py-2.5 text-right tabular-nums">
                        {r.avgMinutesPerDay ? formatMinutes(r.avgMinutesPerDay) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-3 text-[11px] text-muted">
          «Kun» — operator hech bo'lmasa bitta yozuv kiritgan kunlar; «Kuniga» shunga bo'linadi. Foizlar oldingi{" "}
          {period.unit}ga nisbatan.
        </p>
      </Card>
    </section>
  );
}
