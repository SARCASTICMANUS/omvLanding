import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronDown, ChevronLeft, ExternalLink, Mail, MessageSquare, Phone } from "lucide-react";
import { VayyCard } from "../components/vayy";
import { FAQS, SUPPORT_INFO } from "../data/landingPageData";

export default function HelpSupportPage() {
  const navigate = useNavigate();
  const [expandedIndex, setExpandedIndex] = useState(null);

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate("/");
    }
  };

  const contactRows = [
    {
      label: "Email",
      value: SUPPORT_INFO.email,
      href: `mailto:${SUPPORT_INFO.email}`,
      actionLabel: `Email ${SUPPORT_INFO.email}`,
      icon: Mail,
    },
    {
      label: "Phone",
      value: SUPPORT_INFO.phone,
      href: `tel:${SUPPORT_INFO.phone.replace(/[^+\d]/g, "")}`,
      actionLabel: `Call ${SUPPORT_INFO.phone}`,
      icon: Phone,
    },
    {
      label: "Live Chat",
      value: SUPPORT_INFO.liveChat,
      href: null,
      actionLabel: "",
      icon: MessageSquare,
    },
  ];

  return (
    <div className="min-h-screen bg-[#F8FAF9] pb-24 font-sans lg:pb-16">
      {/* ── Green header (HelpSupportScreen) ── */}
      <header className="relative overflow-hidden rounded-b-[32px] bg-[#009849] px-5 pb-4 pt-5">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          <span className="absolute -right-10 -top-16 h-[90%] w-[70%] rotate-[25deg] rounded-[120px] bg-[#00B857] opacity-25" />
          <span className="absolute -right-5 -top-20 h-[70%] w-[50%] rotate-[35deg] rounded-[100px] bg-white/10" />
        </div>
        <div className="relative z-10 mx-auto flex w-full max-w-3xl items-center gap-3">
          <button
            type="button"
            onClick={handleBack}
            aria-label="Go back"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-[#111827] shadow-[0_2px_8px_rgba(0,0,0,0.18)] transition-colors hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
          >
            <ChevronLeft size={22} strokeWidth={2.5} />
          </button>
          <h1 className="text-[20px] font-black leading-tight text-white">Help &amp; Support</h1>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-5 pb-10 pt-5">
        {/* ── Contact card ── */}
        <VayyCard className="mb-7">
          <section aria-label="Contact options">
            {contactRows.map((row, i) => {
              const RowIcon = row.icon;
              return (
                <div key={row.label}>
                  {i > 0 && <div aria-hidden="true" className="ml-[58px] h-px bg-[#E5E7EB]" />}
                  <div className="flex items-center gap-3.5 py-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-[#ECFAF1]">
                      <RowIcon size={20} className="text-[#009849]" aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-bold uppercase tracking-[0.5px] text-[#6B7280]">
                        {row.label}
                      </p>
                      <p className="mt-0.5 truncate text-[15px] font-bold text-[#111827]">{row.value}</p>
                    </div>
                    {row.href && (
                      <a
                        href={row.href}
                        aria-label={row.actionLabel}
                        className="rounded-lg p-2 text-[#009849] transition-colors hover:bg-[#ECFAF1] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#009849]"
                      >
                        <ExternalLink size={18} aria-hidden="true" />
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </section>
        </VayyCard>

        {/* ── FAQ accordion ── */}
        <h2 className="mb-3.5 text-[16px] font-extrabold text-[#111827]">
          Frequently Asked Questions
        </h2>

        <div className="space-y-2.5">
          {FAQS.map((faq, i) => {
            const open = expandedIndex === i;
            const panelId = `faq-panel-${i}`;
            return (
              <div
                key={panelId}
                className={`rounded-2xl bg-white shadow-[0_1px_6px_rgba(0,0,0,0.03)] transition-shadow ${
                  open ? "shadow-[0_1px_10px_rgba(0,0,0,0.06)]" : ""
                }`}
              >
                <button
                  type="button"
                  onClick={() => setExpandedIndex(open ? null : i)}
                  aria-expanded={open}
                  aria-controls={panelId}
                  className="flex w-full items-center justify-between gap-3 rounded-2xl p-4 text-left transition-colors hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#009849]"
                >
                  <span className="text-[14px] font-bold text-[#111827]">{faq.q}</span>
                  <ChevronDown
                    size={18}
                    aria-hidden="true"
                    className={`shrink-0 text-[#6B7280] transition-transform duration-300 ${open ? "rotate-180" : ""}`}
                  />
                </button>
                <div
                  id={panelId}
                  aria-hidden={!open}
                  className={`grid transition-all duration-300 ease-out ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
                >
                  <div className="overflow-hidden">
                    <p className="px-4 pb-4 text-[13px] font-medium leading-5 text-[#374151]">
                      {faq.a}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <p className="mt-5 text-center text-[12px] font-semibold text-[#6B7280]">
          {SUPPORT_INFO.responseTime}
        </p>
      </main>
    </div>
  );
}
