import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

const PRIVACY_SECTIONS = [
  { title: "Information We Collect", text: "We collect your name, email, phone number, profile info, location data, route preferences, and trip history to provide our ride-sharing services." },
  { title: "How We Use Your Information", text: "To match you with routes and Marshals, provide real-time tracking, process payments, improve services, and ensure platform safety." },
  { title: "Data Sharing", text: "We share data with Marshals for trip coordination and service providers. We never sell your personal information to third parties." },
  { title: "Your Rights", text: "Access, update, or delete your data anytime via account settings. Contact us for a full data copy or account closure." },
];

const FAQS = [
  { q: "How do I book a ride?", a: "Enter your destination, select a route or auto match, then confirm your booking." },
  { q: "How does route matching work?", a: "OMV connects you with Marshals going your way — affordable, efficient, route-based." },
  { q: "What is Hand Raise?", a: "Signal Marshals you're waiting at a nearby stop. They'll see you and pick you up." },
  { q: "How do I track my ride?", a: "See your Marshal's live location on the map with real-time ETA updates." },
  { q: "How do I pay?", a: "Pay via UPI or cash. Fare is calculated by distance and route." },
];

const SUPPORT_CONTACTS = [
  { label: "Email", value: "info@onmyvayy.com", href: "mailto:info@onmyvayy.com",
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg> },
  { label: "LinkedIn", value: "linkedin.com/company/onmyvayy", href: "https://www.linkedin.com/company/onmyvayy",
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg> },
  { label: "Instagram", value: "@onmyvayyy", href: "https://www.instagram.com/onmyvayyy",
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg> },
];

export default function SupportPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(searchParams.get("tab") || "privacy");
  const [openFaq, setOpenFaq] = useState(null);

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab && ["privacy", "faq", "contact"].includes(tab)) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-b from-[#003923] via-[#00653a] to-[#009849] font-manrope">
      {/* Abstract background patterns */}
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        {/* Large soft glows */}
        <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-[#22C55E]/30 blur-3xl" />
        <div className="absolute -bottom-48 -right-48 h-[500px] w-[500px] rounded-full bg-[#003923]/60 blur-3xl" />
        <div className="absolute left-1/2 top-1/4 h-72 w-72 -translate-x-1/2 rounded-full bg-[#22C55E]/20 blur-3xl" />

        {/* Geometric shapes */}
        <svg className="absolute right-12 top-20 h-40 w-40 text-white/10" viewBox="0 0 200 200" fill="none">
          <circle cx="100" cy="100" r="80" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="100" cy="100" r="55" stroke="currentColor" strokeWidth="1" />
          <circle cx="100" cy="100" r="30" stroke="currentColor" strokeWidth="0.5" />
        </svg>

        <svg className="absolute -left-10 bottom-40 h-56 w-56 text-white/8" viewBox="0 0 200 200" fill="none">
          <rect x="30" y="30" width="140" height="140" rx="8" stroke="currentColor" strokeWidth="1.5" transform="rotate(15 100 100)" />
          <rect x="50" y="50" width="100" height="100" rx="6" stroke="currentColor" strokeWidth="1" transform="rotate(30 100 100)" />
        </svg>

        <svg className="absolute right-1/4 bottom-16 h-32 w-32 text-white/10" viewBox="0 0 200 200" fill="none">
          <polygon points="100,10 190,150 10,150" stroke="currentColor" strokeWidth="1.5" />
        </svg>

        <svg className="absolute left-1/3 top-1/3 h-48 w-48 text-[#22C55E]/15" viewBox="0 0 200 200" fill="none">
          <path d="M100 20 L180 100 L100 180 L20 100 Z" stroke="currentColor" strokeWidth="1.5" />
          <path d="M100 50 L150 100 L100 150 L50 100 Z" stroke="currentColor" strokeWidth="1" />
        </svg>

        {/* Wavy lines */}
        <svg className="absolute bottom-0 left-0 h-48 w-full text-white/8" viewBox="0 0 1440 200" fill="none" preserveAspectRatio="none">
          <path d="M0 100 Q360 20 720 100 T1440 100" stroke="currentColor" strokeWidth="2" />
          <path d="M0 130 Q360 50 720 130 T1440 130" stroke="currentColor" strokeWidth="1.5" />
          <path d="M0 160 Q360 80 720 160 T1440 160" stroke="currentColor" strokeWidth="1" />
        </svg>

        <svg className="absolute top-0 left-0 h-40 w-full text-white/6" viewBox="0 0 1440 200" fill="none" preserveAspectRatio="none">
          <path d="M0 60 Q360 140 720 60 T1440 60" stroke="currentColor" strokeWidth="1.5" />
          <path d="M0 30 Q360 110 720 30 T1440 30" stroke="currentColor" strokeWidth="1" />
        </svg>

        {/* Dot grid */}
        <svg className="absolute inset-0 h-full w-full text-white/8" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="dots" width="24" height="24" patternUnits="userSpaceOnUse">
              <circle cx="2" cy="2" r="1.5" fill="currentColor" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#dots)" />
        </svg>
      </div>
      {/* Header */}
      <div className="sticky top-0 z-20 border-b border-white/10 bg-[#003923]/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-center gap-4 px-5 py-4">
          <button
            onClick={() => navigate(-1)}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
          >
            ←
          </button>
          <h1 className="text-lg font-bold text-white">Support</h1>
        </div>
      </div>

      <div className="relative z-10 mx-auto max-w-3xl px-5 py-6">
        {/* Tabs */}
        <div className="flex gap-1 rounded-xl bg-white/10 p-1 backdrop-blur-sm">
          {[
            { id: "privacy", label: "Privacy" },
            { id: "faq", label: "FAQ" },
            { id: "contact", label: "Contact" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); setOpenFaq(null); }}
              className={`flex-1 rounded-lg py-2.5 text-sm font-semibold transition-all ${
                activeTab === tab.id
                  ? "bg-white text-[#003923] shadow-sm"
                  : "text-white/60 hover:text-white"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Privacy */}
        {activeTab === "privacy" && (
          <div className="mt-6 space-y-5">
            <p className="text-xs font-medium text-white/40">Last updated: July 2026</p>
            <p className="text-sm leading-relaxed text-white/70">
              OMV is committed to protecting your privacy. This policy explains how we collect, use, and safeguard your information.
            </p>
            {PRIVACY_SECTIONS.map((s, i) => (
              <div key={i} className="rounded-xl bg-white/5 p-4 backdrop-blur-sm">
                <h3 className="text-sm font-bold text-white">{s.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-white/60">{s.text}</p>
              </div>
            ))}
            <p className="text-xs text-white/40">
              Contact: <span className="font-semibold text-white/70">info@onmyvayy.com</span> — OMV, onmyvayy, Lucknow, UP, India
            </p>
          </div>
        )}

        {/* FAQ */}
        {activeTab === "faq" && (
          <div className="mt-6 space-y-2">
            {FAQS.map((f, i) => (
              <div key={i} className="overflow-hidden rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="flex w-full items-center justify-between p-4 text-left"
                >
                  <span className="text-sm font-bold text-white">{f.q}</span>
                  <svg
                    width="16" height="16" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                    className={`flex-shrink-0 text-white/40 transition-transform ${openFaq === i ? "rotate-180" : ""}`}
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>
                {openFaq === i && (
                  <div className="px-4 pb-4">
                    <p className="text-sm leading-relaxed text-white/60">{f.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Contact */}
        {activeTab === "contact" && (
          <div className="mt-6 space-y-3">
            {SUPPORT_CONTACTS.map((s, i) => (
              <div key={i} className="flex items-center gap-4 rounded-xl bg-white/5 p-4 backdrop-blur-sm">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white">{s.icon}</span>
                <div className="flex-1">
                  <p className="text-xs font-bold uppercase tracking-wider text-white/40">{s.label}</p>
                  <p className="text-sm font-bold text-white">{s.value}</p>
                </div>
                {s.href && (
                  <a
                    href={s.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-full bg-white/10 px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-white/20"
                  >
                    Visit
                  </a>
                )}
              </div>
            ))}
            <p className="text-center text-xs text-white/40">We typically respond within 24 hours</p>
          </div>
        )}
      </div>
    </div>
  );
}
