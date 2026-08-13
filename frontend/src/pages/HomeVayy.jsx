import React, { useState } from "react";
import { Link } from "react-router-dom";

// ─── SVG Icons ────────────────────────────────────────────────────────────────
const GridIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
    <circle cx="4" cy="4" r="2"/><circle cx="12" cy="4" r="2"/><circle cx="20" cy="4" r="2"/>
    <circle cx="4" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="20" cy="12" r="2"/>
    <circle cx="4" cy="20" r="2"/><circle cx="12" cy="20" r="2"/><circle cx="20" cy="20" r="2"/>
  </svg>
);
const ArrowRightIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>
  </svg>
);
const WebflowIcon = () => (
  <svg width="20" height="20" viewBox="0 0 28 28" fill="none">
    <rect width="28" height="28" rx="4" fill="#146EF5"/>
    <path d="M20 9.5s-2.5 7.8-2.8 9.2c-.1-.8-1.2-9.2-1.2-9.2H13l-2.3 9.2C10.5 17.3 8 9.5 8 9.5H5l4.5 13h3l2.5-9.5 2.5 9.5h3L25 9.5h-5z" fill="white"/>
  </svg>
);
const RelumeIcon = () => (
  <svg width="20" height="20" viewBox="0 0 28 28" fill="none">
    <rect width="28" height="28" rx="4" fill="#1A1A1A"/>
    <rect x="7" y="7" width="6" height="6" rx="1" fill="white"/>
    <rect x="15" y="7" width="6" height="6" rx="1" fill="white"/>
    <rect x="7" y="15" width="6" height="6" rx="1" fill="white"/>
    <rect x="15" y="15" width="6" height="6" rx="1" fill="white"/>
  </svg>
);
const FacebookIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
    <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/>
  </svg>
);
const XIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
  </svg>
);
const InstagramIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="0.5" fill="currentColor"/>
  </svg>
);
const LinkedInIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
    <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/>
  </svg>
);
const LocationPinIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/>
  </svg>
);

// ─── Image Placeholder ────────────────────────────────────────────────────────
const ImgPlaceholder = ({ className = "", style = {} }) => (
  <div
    className={`bg-gray-100 flex items-center justify-center rounded-xl ${className}`}
    style={style}
  >
    <div className="flex flex-col items-center justify-center gap-2 opacity-40">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="1.5">
        <rect x="3" y="3" width="18" height="18" rx="3"/>
        <circle cx="8.5" cy="8.5" r="1.5"/>
        <path d="m21 15-5-5L5 21"/>
      </svg>
    </div>
  </div>
);

// ─── Section 2: Hero ──────────────────────────────────────────────────────────
function HeroSection() {
  return (
    <section className="bg-white">
      <div className="max-w-7xl mx-auto px-6 py-20 grid grid-cols-1 md:grid-cols-2 gap-12 items-center min-h-[85vh]">
        {/* Left */}
        <div className="space-y-6">
          <h1
            className="text-6xl font-extrabold text-brand-ink leading-[1.05] tracking-tight"
          >
            Track your<br />bus live.
          </h1>
          <p className="text-base text-brand-muted max-w-sm leading-relaxed">
            Smarter city commute starts here. Real-time bus tracking, smart route discovery, live ETA, and driver-connected commuting built for modern urban travel.
          </p>
          <div className="flex items-center gap-4 pt-2">
            <Link to="/tracking" className="bg-brand-primary hover:bg-brand-primaryHover text-white text-sm font-semibold px-6 py-3 rounded-vayy transition-colors">
              Start tracking
            </Link>
            <Link to="/routes" className="text-sm text-brand-ink hover:text-brand-primary transition-colors font-medium">
              Explore routes
            </Link>
          </div>
        </div>

        {/* Right – image placeholders */}
        <div className="relative flex justify-end items-start gap-4">
          {/* Left placeholder (slightly smaller, offset down) */}
          <div className="mt-10 flex-shrink-0">
            <ImgPlaceholder className="w-48 h-64 rounded-vayy" />
          </div>
          {/* Right placeholder (taller, overlapping) */}
          <div className="-ml-10 flex-shrink-0">
            <ImgPlaceholder className="w-56 h-80 rounded-vayy" />
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Section 3: Live Tracking Feature ─────────────────────────────────────────
function LiveTrackingSection() {
  const partners = [
    { label: "Webflow", Icon: WebflowIcon },
    { label: "Relume", Icon: RelumeIcon },
    { label: "Webflow", Icon: WebflowIcon },
    { label: "Relume", Icon: RelumeIcon },
  ];

  return (
    <section className="bg-white border-t border-gray-100">
      <div className="max-w-7xl mx-auto px-6 py-20 grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
        {/* Left */}
        <div className="space-y-6">
          <p className="text-xs font-semibold text-brand-primary tracking-widest uppercase">
            Live tracking
          </p>
          <h2
            className="text-5xl font-extrabold text-brand-ink leading-[1.08] tracking-tight"
          >
            See your bus move<br />in real time.
          </h2>
          <p className="text-base text-brand-muted leading-relaxed max-w-sm">
            Watch your bus approach with live position updates, accurate arrival times, and stop-by-stop progress on an interactive map.
          </p>

          {/* Partner logos row */}
          <div className="flex items-center gap-6 flex-wrap pt-2">
            {partners.map(({ label, Icon }, i) => (
              <div key={i} className="flex items-center gap-2">
                <Icon />
                <span className="text-sm font-semibold text-brand-ink">{label}</span>
              </div>
            ))}
          </div>

          {/* CTA */}
          <div className="flex items-center gap-4 pt-2">
            <button className="border border-brand-ink text-sm font-medium px-5 py-2.5 rounded-vayy hover:bg-brand-canvas transition-colors">
              Learn more
            </button>
            <button className="flex items-center gap-2 text-sm font-medium text-brand-ink hover:gap-3 transition-all">
              Arrow <ArrowRightIcon />
            </button>
          </div>
        </div>

        {/* Right – image placeholder */}
        <div>
          <ImgPlaceholder className="w-full h-80 rounded-vayy" />
        </div>
      </div>
    </section>
  );
}

// ─── Section 4: Three Ways ────────────────────────────────────────────────────
function ThreeWaysSection() {
  const features = [
    {
      title: "Real-time\npositioning",
      desc: "Watch your bus move across the city with live GPS updates every few seconds.",
    },
    {
      title: "Predictive arrival\ntimes",
      desc: "Low-latency algorithms calculate exact ETAs based on traffic, stops, and route patterns.",
    },
    {
      title: "Next bus discovery",
      desc: "Missed your bus? Find the next one instantly with alternative routes and wait times.",
    },
  ];

  return (
    <section className="bg-white border-t border-gray-100">
      <div className="max-w-7xl mx-auto px-6 py-20">
        {/* Header */}
        <div className="text-center space-y-5 mb-14">
          <p className="text-xs font-semibold text-brand-primary tracking-widest uppercase">
            Intelligence
          </p>
          <h2
            className="text-5xl font-extrabold text-brand-ink leading-[1.08] tracking-tight"
          >
            Three ways VAYY powers<br />your commute
          </h2>
          <p className="text-base text-brand-muted max-w-lg mx-auto leading-relaxed">
            From live bus positions to arrival predictions, VAYY gives you the transit intelligence you need. No guessing. No surprises.
          </p>
        </div>

        {/* Three cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
          {features.map(({ title, desc }, i) => (
            <div key={i} className="space-y-4">
              <ImgPlaceholder className="w-full h-52 rounded-vayy" />
              <h3
                className="text-2xl font-bold text-brand-ink leading-snug"
                style={{ whiteSpace: "pre-line" }}
              >
                {title}
              </h3>
              <p className="text-sm text-brand-muted leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="flex items-center gap-4 justify-center">
          <button className="border border-brand-ink text-sm font-medium px-5 py-2.5 rounded-vayy hover:bg-brand-canvas transition-colors">
            Explore
          </button>
          <button className="flex items-center gap-2 text-sm font-medium text-brand-ink hover:gap-3 transition-all">
            Arrow <ArrowRightIcon />
          </button>
        </div>
      </div>
    </section>
  );
}

// ─── Section 5: One Platform Two Experiences ─────────────────────────────────
function PlatformSection() {
  return (
    <section className="bg-white border-t border-gray-100">
      <div className="max-w-7xl mx-auto px-6 py-20 grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
        {/* Left */}
        <div className="space-y-6">
          <p className="text-xs font-semibold text-brand-primary tracking-widest uppercase">
            Platform
          </p>
          <h2
            className="text-5xl font-extrabold text-brand-ink leading-[1.08] tracking-tight"
          >
            One platform. Two<br />experiences.
          </h2>
          <p className="text-base text-brand-muted leading-relaxed max-w-sm">
            Passengers track buses in real-time. Drivers navigate routes with precision. Both connected on the same intelligent system.
          </p>

          {/* Two sub-features */}
          <div className="grid grid-cols-2 gap-8 pt-4">
            {/* Passenger */}
            <div className="space-y-2">
              <div className="text-brand-ink">
                <GridIcon />
              </div>
              <h4 className="text-base font-bold text-brand-ink">Passenger app</h4>
              <p className="text-sm text-brand-muted leading-relaxed">
                Live tracking, stop alerts, route search, occupancy, and accurate ETA.
              </p>
            </div>
            {/* Driver */}
            <div className="space-y-2">
              <div className="text-brand-ink">
                <LocationPinIcon />
              </div>
              <h4 className="text-base font-bold text-brand-ink">Driver console</h4>
              <p className="text-sm text-brand-muted leading-relaxed">
                Navigation, route guidance, announcements, and live route monitoring.
              </p>
            </div>
          </div>

          {/* CTA */}
          <div className="flex items-center gap-4 pt-2">
            <button className="border border-brand-ink text-sm font-medium px-5 py-2.5 rounded-vayy hover:bg-brand-canvas transition-colors">
              Explore
            </button>
            <button className="flex items-center gap-2 text-sm font-medium text-brand-ink hover:gap-3 transition-all">
              Arrow <ArrowRightIcon />
            </button>
          </div>
        </div>

        {/* Right – image placeholder */}
        <div>
          <ImgPlaceholder className="w-full h-96 rounded-vayy" />
        </div>
      </div>
    </section>
  );
}

// ─── Section 6: Impact / Stats ────────────────────────────────────────────────
function ImpactSection() {
  const stats = [
    { value: "45%", label: "Less waiting uncertainty" },
    { value: "Real-\ntime", label: "Live bus visibility" },
    { value: "Smart\nETA", label: "Low latency prediction" },
    { value: "Urban\nready", label: "Built for Indian cities" },
  ];

  return (
    <section className="bg-white border-t border-gray-100">
      <div className="max-w-7xl mx-auto px-6 py-20 grid grid-cols-1 md:grid-cols-2 gap-16 items-start">
        {/* Left */}
        <div className="space-y-6">
          <p className="text-xs font-semibold text-brand-primary tracking-widest uppercase">
            Impact
          </p>
          <h2
            className="text-4xl font-extrabold text-brand-ink leading-[1.1] tracking-tight"
          >
            What VAYY delivers<br />to your commute
          </h2>
          <p className="text-sm text-brand-muted leading-relaxed max-w-xs">
            Real numbers from real riders across Indian cities. VAYY transforms how millions move through urban spaces every single day.
          </p>
          <div className="flex items-center gap-4 pt-2">
            <button className="border border-brand-ink text-sm font-medium px-5 py-2.5 rounded-vayy hover:bg-brand-canvas transition-colors">
              Discover
            </button>
            <button className="flex items-center gap-2 text-sm font-medium text-brand-ink hover:gap-3 transition-all">
              Arrow <ArrowRightIcon />
            </button>
          </div>
        </div>

        {/* Right – 2×2 stats grid */}
        <div className="grid grid-cols-2 gap-0 border border-gray-200 rounded-vayy overflow-hidden">
          {stats.map(({ value, label }, i) => (
            <div
              key={i}
              className={`p-8 space-y-2 ${
                i % 2 === 0 ? "border-r border-gray-200" : ""
              } ${i < 2 ? "border-b border-gray-200" : ""}`}
            >
              <p
                className="text-4xl font-black text-brand-ink leading-tight"
                style={{
                  whiteSpace: "pre-line",
                }}
              >
                {value}
              </p>
              <p className="text-sm text-brand-muted">{label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Section 7: Final CTA ─────────────────────────────────────────────────────
function FinalCTASection() {
  return (
    <section
      className="relative overflow-hidden"
      style={{
        background: "linear-gradient(135deg, #009849 0%, #007b44 100%)",
      }}
    >
      <div className="relative max-w-4xl mx-auto px-6 py-32 text-center space-y-6">
        <h2
          className="text-5xl font-extrabold text-white leading-[1.08] tracking-tight"
        >
          Your entire commute in<br />one platform
        </h2>
        <p className="text-base text-white/90 max-w-md mx-auto leading-relaxed">
          Track, plan, and travel smarter with VAYY. Download now or start tracking on the web.
        </p>
        <div className="flex items-center justify-center gap-4 pt-4">
          <button className="bg-white text-brand-primary text-sm font-semibold px-8 py-3 rounded-vayy hover:bg-gray-100 transition-colors">
            Download
          </button>
          <Link to="/login" className="border border-white text-white text-sm font-semibold px-8 py-3 rounded-vayy hover:bg-white/10 transition-colors">
            Open web
          </Link>
        </div>
      </div>
    </section>
  );
}

// ─── Section 8: Footer ────────────────────────────────────────────────────────
function Footer() {
  const [email, setEmail] = useState("");

  const platformLinks = [
    { name: "Live tracking", path: "/tracking" },
    { name: "Routes", path: "/routes" },
    { name: "Support", path: "/contact" },
  ];

  return (
    <footer className="bg-white border-t border-gray-200">
      <div className="max-w-7xl mx-auto px-6 py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
          {/* Brand + Newsletter */}
          <div className="space-y-4">
            <span
              className="text-2xl font-bold text-brand-primary"
            >
              VAYY
            </span>
            <p className="text-sm text-brand-muted leading-relaxed max-w-xs">
              Get transit updates and new features delivered to your inbox.
            </p>
            <div className="flex gap-0 mt-2 border border-gray-300 rounded-vayy overflow-hidden">
              <input
                type="email"
                placeholder="Your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="flex-1 px-4 py-2.5 text-sm text-brand-ink outline-none bg-white"
              />
              <button className="bg-white border-l border-gray-300 px-4 py-2.5 text-sm font-medium text-brand-ink hover:bg-brand-canvas transition-colors whitespace-nowrap">
                Subscribe
              </button>
            </div>
          </div>

          {/* Platform */}
          <div className="space-y-4">
            <h4 className="text-sm font-bold text-brand-ink">Platform</h4>
            <ul className="space-y-3">
              {platformLinks.map((link) => (
                <li key={link.name}>
                  <Link to={link.path} className="text-sm text-brand-muted hover:text-brand-ink transition-colors">
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* About us */}
          <div className="space-y-4">
            <h4 className="text-sm font-bold text-brand-ink">About us</h4>
            <ul className="space-y-3">
              <li><Link to="/about" className="text-sm text-brand-muted hover:text-brand-ink transition-colors">About Us</Link></li>
              <li><Link to="/contact" className="text-sm text-brand-muted hover:text-brand-ink transition-colors">Contact</Link></li>
            </ul>
          </div>

          {/* Social */}
          <div className="space-y-4">
            <h4 className="text-sm font-bold text-brand-ink">Social</h4>
            <ul className="space-y-3">
              {[
                { label: "X", Icon: XIcon },
                { label: "LinkedIn", Icon: LinkedInIcon },
                { label: "Instagram", Icon: InstagramIcon },
              ].map(({ label, Icon }, i) => (
                <li key={i}>
                  <a href="#" className="flex items-center gap-2 text-sm text-brand-muted hover:text-brand-ink transition-colors">
                    <Icon />
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-12 pt-6 border-t border-gray-200 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs text-brand-muted">© 2026 VAYY. All rights reserved.</p>
          <div className="flex items-center gap-6">
            <a href="#" className="text-xs text-brand-muted hover:text-brand-ink transition-colors">
              Privacy policy
            </a>
            <a href="#" className="text-xs text-brand-muted hover:text-brand-ink transition-colors">
              Terms of service
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}

// ─── Root App ─────────────────────────────────────────────────────────────────
export default function HomeVayy() {
  return (
    <div className="min-h-screen bg-brand-canvas font-sans text-brand-ink">
      <HeroSection />
      <LiveTrackingSection />
      <ThreeWaysSection />
      <PlatformSection />
      <ImpactSection />
      <FinalCTASection />
      <Footer />
    </div>
  );
}
