import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/client";


export default function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await api.post("/accounts/login/", { email, password });
      const body = res.data;
      const { user, tokens } = body.data || body;
      if (user.role !== "admin" && !user.is_staff) {
        setError("Access denied. Admin credentials required.");
        setLoading(false);
        return;
      }
      localStorage.setItem("admin_token", tokens.access);
      localStorage.setItem("admin_refresh", tokens.refresh);
      onLogin(user);
    } catch (err) {
      const msg =
        err.response?.data?.message ||
        err.response?.data?.detail ||
        err.response?.data?.non_field_errors?.[0] ||
        Object.values(err.response?.data || {}).flat().join(" ") ||
        "Login failed. Check credentials.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 relative overflow-hidden">
      <div className="gradient-blob blob-primary w-96 h-96 -top-48 -left-48" />
      <div className="gradient-blob blob-sky w-80 h-80 bottom-0 right-0" />
      <div className="gradient-blob blob-primary-light w-64 h-64 top-1/3 left-1/4" />

      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-8">
          <div className="w-16 h-16 glass-icon-tile bg-rose-500 text-white flex items-center justify-center font-black text-2xl mx-auto mb-4 shadow-md rounded-2xl">
            V
          </div>
          <h1 className="glass-title text-white" style={{ fontFamily: "Geom, sans-serif", textShadow: "3px 3px 0 var(--memphis-pink)" }}>
            OMV Admin
          </h1>
          <p className="text-white/50 mt-2 font-medium">Sign in to manage your platform</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="glass-card p-8 space-y-5"
        >
          {error && (
            <div className="bg-red-50 border-2 border-red-400 text-red-500 text-sm font-semibold px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          <div className="space-y-1">
            <label className="glass-label">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="admin@omv.com"
              className="glass-input"
            />
          </div>

          <div className="space-y-1">
            <label className="glass-label">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="Enter your password"
              className="glass-input"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full glass-btn-primary py-4 text-sm disabled:opacity-50"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <button
          onClick={() => navigate("/splash-preview")}
          className="mt-4 w-full glass-btn-secondary py-3 text-sm text-white"
        >
          View Splash Screen
        </button>
      </div>
    </div>
  );
}
