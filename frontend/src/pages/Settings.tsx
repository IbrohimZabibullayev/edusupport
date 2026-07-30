import { useState } from "react";
import Modules from "./Modules";
import Priorities from "./Priorities";
import RequestTypes from "./RequestTypes";
import Systems from "./Systems";
import TopicKeywords from "./TopicKeywords";

const TABS = [
  { key: "systems", label: "Tizimlar", Comp: Systems },
  { key: "modules", label: "Modullar", Comp: Modules },
  { key: "request-types", label: "So'rov turlari", Comp: RequestTypes },
  { key: "priorities", label: "Prioritetlar", Comp: Priorities },
  { key: "topic-keywords", label: "Bo'lim kalit so'zlari", Comp: TopicKeywords },
] as const;

export default function Settings() {
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>(TABS[0].key);
  const Active = TABS.find((t) => t.key === tab)!.Comp;

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold tracking-tight">Sozlamalar</h1>
      <div className="mb-6 flex flex-wrap gap-1 overflow-x-auto border-b border-grid">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
              tab === t.key ? "border-accent text-accent" : "border-transparent text-ink-2 hover:text-ink"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <Active />
    </div>
  );
}
