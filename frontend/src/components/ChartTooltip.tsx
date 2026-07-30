interface TooltipEntry {
  name?: string;
  value?: number | string;
  color?: string;
  payload?: { fill?: string };
}

export function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-grid bg-surface px-3 py-2 text-sm shadow-md">
      {label && <div className="mb-1 text-xs text-muted">{label}</div>}
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center gap-2">
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: entry.color ?? entry.payload?.fill ?? "#2a78d6" }}
          />
          <span className="text-ink-2">{entry.name}:</span>
          <span className="font-medium tabular-nums">{entry.value}</span>
        </div>
      ))}
    </div>
  );
}
