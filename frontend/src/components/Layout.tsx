import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { setToken } from "../lib/api";

const NAV_ITEMS = [
  { to: "/", label: "Boshqaruv paneli", icon: "M3 13h4v8H3zM10 8h4v13h-4zM17 3h4v18h-4z" },
  { to: "/requests", label: "So'rovlar", icon: "M4 5h16v3H4zM4 10h16v3H4zM4 15h16v3H4z" },
  { to: "/operators", label: "Operatorlar", icon: "M12 12a4 4 0 100-8 4 4 0 000 8zm-8 8a8 8 0 0116 0z" },
  { to: "/schools", label: "Maktablar", icon: "M12 3l9 5-9 5-9-5zM5 12v5l7 4 7-4v-5" },
  { to: "/modules", label: "Modullar", icon: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" },
  { to: "/systems", label: "Tizimlar", icon: "M3 5h18v11H3zM8 20h8M12 16v4" },
  { to: "/request-types", label: "So'rov turlari", icon: "M4 6h16M4 12h16M4 18h16M8 3v18" },
  { to: "/topic-keywords", label: "Bo'lim kalit so'zlari", icon: "M4 7h16M4 12h16M4 17h10" },
] as const;

function NavIcon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

function Nav({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-1">
      {NAV_ITEMS.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === "/"}
          onClick={onNavigate}
          className={({ isActive }) =>
            `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              isActive ? "bg-accent-soft/60 text-accent" : "text-ink-2 hover:bg-black/5"
            }`
          }
        >
          <NavIcon d={item.icon} />
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}

export default function Layout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();

  const logout = () => {
    setToken(null);
    navigate("/login");
  };

  const brand = (
    <div className="flex items-center gap-2 px-3">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-sm font-bold text-white">E</div>
      <span className="text-base font-semibold tracking-tight">EduSupport</span>
    </div>
  );

  return (
    <div className="min-h-screen md:flex">
      {/* Sidebar — desktop */}
      <aside className="fixed inset-y-0 z-20 hidden w-60 flex-col gap-6 border-r border-black/10 bg-surface py-5 md:flex">
        {brand}
        <div className="flex-1 px-2">
          <Nav />
        </div>
        <div className="px-2">
          <button onClick={logout} className="w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-ink-2 hover:bg-black/5">
            ← Chiqish
          </button>
        </div>
      </aside>

      {/* Top bar — mobile */}
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-black/10 bg-surface px-4 py-3 md:hidden">
        {brand}
        <button
          onClick={() => setMenuOpen((v) => !v)}
          aria-label="Menyu"
          className="rounded-lg border border-black/10 px-3 py-1.5 text-sm font-medium"
        >
          {menuOpen ? "Yopish" : "Menyu"}
        </button>
      </header>

      {menuOpen && (
        <div className="fixed inset-x-0 top-[57px] z-10 border-b border-black/10 bg-surface p-3 shadow-lg md:hidden">
          <Nav onNavigate={() => setMenuOpen(false)} />
          <button onClick={logout} className="mt-2 w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-ink-2 hover:bg-black/5">
            ← Chiqish
          </button>
        </div>
      )}

      <main className="flex-1 px-4 py-6 md:ml-60 md:px-8">
        <div className="mx-auto max-w-6xl">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
