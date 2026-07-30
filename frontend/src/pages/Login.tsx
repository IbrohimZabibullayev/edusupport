import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, setToken } from "../lib/api";

export default function Login() {
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { token } = await api<{ token: string }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ login, password }),
      });
      setToken(token);
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kirishda xatolik yuz berdi");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center justify-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-accent text-lg font-bold text-white">E</div>
          <span className="text-xl font-semibold tracking-tight">EduSupport</span>
        </div>
        <form onSubmit={submit} className="rounded-lg border border-grid bg-surface p-6">
          <h1 className="mb-4 text-lg font-semibold">Admin panelga kirish</h1>
          {error && (
            <div className="mb-4 rounded-lg border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">{error}</div>
          )}
          <label className="mb-1 block text-sm font-medium text-ink-2">Login</label>
          <input
            value={login}
            onChange={(e) => setLogin(e.target.value)}
            autoComplete="username"
            required
            className="mb-4 w-full rounded-md border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
          />
          <label className="mb-1 block text-sm font-medium text-ink-2">Parol</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
            className="mb-5 w-full rounded-md border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-accent py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "Tekshirilmoqda…" : "Kirish"}
          </button>
        </form>
      </div>
    </div>
  );
}
