import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/client";
import MemphisShapes, { Triangle, CircleOutline, PlusSign } from "../components/MemphisShapes";

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
    <div className="min-h-screen bg-memphis-ink flex items-center justify-center p-4 relative overflow-hidden">
      <MemphisShapes variant="scattered" />

      <Triangle className="absolute top-12 left-[15%] rotate-[-20deg] opacity-20" size={48} color="var(--memphis-pink)" />
      <CircleOutline className="absolute bottom-20 right-[20%] opacity-15" size={40} color="var(--memphis-teal)" />
      <PlusSign className="absolute top-1/3 right-[10%] rotate-[30deg] opacity-15" size={32} color="var(--memphis-yellow)" />
      <Triangle className="absolute bottom-1/4 left-[8%] rotate-[45deg] opacity-10" size={36} color="var(--memphis-mint)" />

      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-memphis-pink border-2 border-memphis-ink rounded-xl flex items-center justify-center font-black text-2xl text-memphis-ink mx-auto mb-4 shadow-memphis">
            V
          </div>
          <h1 className="text-3xl font-black text-white" style={{ fontFamily: "Archivo Black, sans-serif", textShadow: "3px 3px 0 var(--memphis-pink)" }}>
            OMV Admin
          </h1>
          <p className="text-white/50 mt-2 font-medium">Sign in to manage your platform</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-memphis-paper border-2 border-memphis-ink rounded-xl p-8 space-y-5 shadow-memphis-lg"
        >
          {error && (
            <div className="bg-memphis-coral/10 border-2 border-memphis-coral text-memphis-coral text-sm font-semibold px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          <div className="space-y-1">
            <label className="memphis-label">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="admin@omv.com"
              className="memphis-input"
            />
          </div>

          <div className="space-y-1">
            <label className="memphis-label">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="Enter your password"
              className="memphis-input"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full memphis-btn-primary py-4 text-sm disabled:opacity-50"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <button
          onClick={() => navigate("/splash-preview")}
          className="mt-4 w-full memphis-btn-secondary py-3 text-sm text-white"
        >
          View Splash Screen
        </button>
      </div>
    </div>
  );
}
