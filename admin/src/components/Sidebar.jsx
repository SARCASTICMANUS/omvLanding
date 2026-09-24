import { useState } from "react";
import {
  LayoutDashboard,
  MapPin,
  Route,
  Compass,
  StopCircle,
  CalendarClock,
  Users,
  Layers,
  ShieldCheck,
  BarChart3,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Moon,
  Sun,
  Palette,
} from "lucide-react";
import { applyTheme, getTheme } from "../utils/theme";
import {
  ACCENT_COLORS,
  GLOW_ANIMS,
  GLOW_COLORS,
  applyAccent,
  applyGlow,
  getAccentColor,
  getGlowAnim,
  getGlowColor,
  getGlowSpeed,
  setGlowSpeed,
} from "../utils/glow";

const iconMap = {
  dashboard: LayoutDashboard,
  kpi: BarChart3,
  cities: MapPin,
  "route-explorer": Compass,
  routes: Route,
  stops: StopCircle,
  schedules: CalendarClock,
  drivers: ShieldCheck,
  users: Users,
  zones: Layers,
};

export default function Sidebar({ tabs, activeTab, onTabChange, onLogout }) {
  const [collapsed, setCollapsed] = useState(false);
  const [dark, setDark] = useState(() => getTheme() === "dark");
  const [glowOpen, setGlowOpen] = useState(false);
  const [glowColor, setGlowColor] = useState(() => getGlowColor().id);
  const [glowAnim, setGlowAnim] = useState(() => getGlowAnim().id);
  const [accent, setAccent] = useState(() => getAccentColor().id);
  const [speed, setSpeed] = useState(() => getGlowSpeed());

  const toggleTheme = () => {
    const next = applyTheme(dark ? "light" : "dark");
    setDark(next === "dark");
  };

  const pickGlow = (colorId, animId) => {
    const c = colorId ?? glowColor;
    const a = animId ?? glowAnim;
    if (colorId !== undefined && colorId !== null) setGlowColor(c);
    if (animId !== undefined && animId !== null) setGlowAnim(a);
    applyGlow(c, a);
  };

  const pickAccent = (id) => {
    setAccent(id);
    applyAccent(id);
  };

  return (
    <aside
      className={`flex flex-col shrink-0 relative overflow-hidden transition-all duration-300 ease-in-out ${
        collapsed ? "w-[72px]" : "w-64"
      }`}
    >
      {/* Top controls: collapse + glow + dark mode */}
      <div className="relative z-10 flex items-stretch h-10 shrink-0 border-b border-slate-200/60 dark:border-white/8">
        <button
          onClick={() => setCollapsed(!collapsed)}
          title={collapsed ? "Expand" : "Collapse"}
          className={`flex-1 flex items-center justify-center h-full text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-white/60 dark:hover:bg-white/10 transition-all duration-200 ${
            collapsed ? "px-0" : "px-2"
          }`}
        >
          {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
        </button>
        <div className="w-px bg-slate-200/70 dark:bg-white/8 shrink-0" />
        <button
          onClick={() => setGlowOpen(!glowOpen)}
          title="Background glow settings"
          aria-label="Background glow settings"
          aria-pressed={glowOpen}
          className={`flex-1 flex items-center justify-center h-full transition-all duration-200 ${
            glowOpen
              ? "bg-white/70 dark:bg-white/12 text-slate-700 dark:text-slate-200"
              : "text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-white/60 dark:hover:bg-white/10"
          } ${collapsed ? "px-0" : "px-2 gap-1.5"}`}
        >
          <Palette
            size={16}
            style={
              !collapsed
                ? { color: glowOpen ? `rgb(${(GLOW_COLORS.find((c) => c.id === glowColor) || GLOW_COLORS[0]).rgb})` : undefined }
                : {}
            }
          />
          {!collapsed && <span className="text-[11px] font-semibold uppercase tracking-wider">Glow</span>}
        </button>
        <div className="w-px bg-slate-200/70 dark:bg-white/8 shrink-0" />
        <button
          onClick={toggleTheme}
          title={dark ? "Switch to light mode" : "Switch to dark mode"}
          aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
          aria-pressed={dark}
          className={`flex-1 flex items-center justify-center h-full text-slate-400 hover:text-slate-700 dark:hover:text-amber-300 hover:bg-white/60 dark:hover:bg-white/10 transition-all duration-200 ${
            collapsed ? "px-0" : "px-2 gap-1.5"
          }`}
        >
          {dark ? <Sun size={16} /> : <Moon size={16} />}
          {!collapsed && (
            <span className="text-[11px] font-semibold uppercase tracking-wider">{dark ? "Light" : "Dark"}</span>
          )}
        </button>
      </div>

      {/* Glow settings panel */}
      {glowOpen && (
        <div className="relative z-10 border-b border-slate-200/60 dark:border-white/8 px-3 py-3 space-y-3 bg-white/70 dark:bg-white/4">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">
              Color
            </div>
            <div className={`grid ${collapsed ? "grid-cols-4" : "grid-cols-8"} gap-1.5`}>
              {GLOW_COLORS.map((c) => (
                <button
                  key={c.id}
                  onClick={() => pickGlow(c.id, null)}
                  title={c.label}
                  aria-label={c.label}
                  aria-pressed={glowColor === c.id}
                  className={`aspect-square rounded-full border-2 transition-all duration-150 hover:scale-110 ${
                    glowColor === c.id ? "border-slate-700 dark:border-white scale-110" : "border-transparent"
                  }`}
                  style={{
                    background: `rgb(${c.rgb})`,
                    boxShadow: glowColor === c.id ? `0 0 0 2px rgba(${c.rgb}, 0.35)` : "none",
                    borderColor: glowColor !== c.id && c.id === "white" ? "rgba(15, 23, 42, 0.2)" : undefined,
                  }}
                />
              ))}
            </div>
          </div>
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">
              Motion
            </div>
            <div className={`grid ${collapsed ? "grid-cols-2" : "grid-cols-4"} gap-1.5`}>
              {GLOW_ANIMS.map((a) => (
                <button
                  key={a.id}
                  onClick={() => pickGlow(null, a.id)}
                  aria-pressed={glowAnim === a.id}
                  className={`px-2 py-1.5 rounded-lg text-[10px] font-semibold uppercase tracking-wider border transition-all duration-150 ${
                    glowAnim === a.id
                      ? "bg-accent-primary/15 border-accent-primary/40 text-slate-700 dark:text-slate-200"
                      : "bg-white/60 dark:bg-white/6 border-white/50 dark:border-white/8 text-slate-500 dark:text-slate-400 hover:border-slate-300 dark:hover:border-white/20"
                  }`}
                >
                  {a.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">
              App color
            </div>
            <div className={`grid ${collapsed ? "grid-cols-4" : "grid-cols-8"} gap-1.5`}>
              {ACCENT_COLORS.map((c) => (
                <button
                  key={c.id}
                  onClick={() => pickAccent(c.id)}
                  title={c.label}
                  aria-label={c.label}
                  aria-pressed={accent === c.id}
                  className={`aspect-square rounded-full border-2 transition-all duration-150 hover:scale-110 ${
                    accent === c.id ? "border-slate-700 dark:border-white scale-110" : "border-transparent"
                  }`}
                  style={{
                    background: c.hex,
                    boxShadow: accent === c.id ? `0 0 0 2px ${c.light}55` : "none",
                    borderColor: accent !== c.id && c.id === "white" ? "rgba(15, 23, 42, 0.2)" : undefined,
                  }}
                />
              ))}
            </div>
          </div>
          {!collapsed && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Speed
                </div>
                <div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 tabular-nums">
                  {speed}s
                </div>
              </div>
              <input
                type="range"
                min="1"
                max="30"
                step="1"
                value={speed}
                onChange={(e) => setSpeed(setGlowSpeed(e.target.value))}
                aria-label="Animation duration in seconds"
                className="w-full h-1.5 rounded-full appearance-none cursor-pointer accent-[var(--accent-blue)]"
                style={{
                  background: `linear-gradient(90deg, var(--accent-blue) ${((speed - 1) / 29) * 100}%, rgba(120,120,128,0.25) ${((speed - 1) / 29) * 100}%)`,
                }}
              />
              <div className="flex justify-between mt-1 text-[9px] text-slate-400 dark:text-slate-500">
                <span>Fast</span>
                <span>Slow</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Nav */}
      <nav className="relative z-10 flex-1 py-4 px-2.5 space-y-1 overflow-y-auto no-scrollbar">
        {tabs.map((tab) => {
          const Icon = iconMap[tab.id];
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              title={collapsed ? tab.label : undefined}
              className={`w-full flex items-center gap-3 rounded-xl text-sm transition-all duration-200 ${
                collapsed ? "justify-center px-2 py-3" : "px-3.5 py-2.5"
              } ${
                isActive
                  ? "font-semibold bg-accent-primary/10"
                  : "font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-accent-primary/5 dark:hover:bg-white/6"
              }`}
              style={isActive ? {
                color: "var(--text-heading)",
                boxShadow: "none",
              } : {}}
            >
              {Icon && <Icon size={19} className="shrink-0" style={isActive ? { color: "var(--accent-blue-light)" } : { color: "#8A8A8E" }} />}
              {!collapsed && <span className="truncate">{tab.label}</span>}
              {!collapsed && isActive && (
                <span className="ml-auto w-2 h-2 rounded-full"
                  style={{ background: "var(--accent-blue-light)", boxShadow: "none" }}
                />
              )}
            </button>
          );
        })}
      </nav>

      {/* Logout */}
      <div className="relative z-10 p-2.5">
        <button
          onClick={onLogout}
          title={collapsed ? "Logout" : undefined}
          className={`w-full flex items-center gap-3 rounded-xl text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-all duration-200 ${
            collapsed ? "justify-center px-2 py-3" : "px-3.5 py-2.5"
          }`}
        >
          <LogOut size={19} className="shrink-0" />
          {!collapsed && <span>Logout</span>}
        </button>
      </div>
    </aside>
  );
}