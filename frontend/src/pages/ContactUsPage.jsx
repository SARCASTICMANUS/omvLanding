import React from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Clock, ExternalLink, Linkedin, Mail, MessageSquare, Phone } from "lucide-react";
import { VayyCard } from "../components/vayy";

// Mobile info-screen style: green rounded-b-[32px] header + white content cards.

const CONTACT_ROWS = [
  {
    label: "Email",
    value: "info@onmyvayy.com",
    href: "mailto:info@onmyvayy.com",
    actionLabel: "Email info@onmyvayy.com",
    icon: Mail,
    iconBg: "bg-[#ECFAF1]",
    iconColor: "text-[#009849]",
  },
  {
    label: "Phone",
    value: "+91 1800-123-4567",
    href: "tel:+9118001234567",
    actionLabel: "Call +91 1800-123-4567",
    icon: Phone,
    iconBg: "bg-[#EFF6FF]",
    iconColor: "text-[#2563EB]",
  },
  {
    label: "LinkedIn",
    value: "linkedin.com/company/onmyvayy",
    href: null,
    actionLabel: "",
    icon: Linkedin,
    iconBg: "bg-[#EFF6FF]",
    iconColor: "text-[#2563EB]",
  },
  {
    label: "Live Chat",
    value: "9 AM – 9 PM",
    href: null,
    actionLabel: "",
    icon: MessageSquare,
    iconBg: "bg-[#FFFBEB]",
    iconColor: "text-[#F59E0B]",
  },
];

const HOURS_ROWS = [
  { label: "Mon - Fri", value: "9:00 AM - 6:00 PM" },
  { label: "Sat - Sun", value: "Closed" },
];

export default function ContactUsPage() {
  const navigate = useNavigate();

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate("/");
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAF9] pb-24 font-sans lg:pb-16">
      {/* ── Green header (LandingInfoScreen) ── */}
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
          <h1 className="text-[20px] font-black leading-tight text-white">Support</h1>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-5 pb-10 pt-5">
        <p className="mb-4 text-[14px] font-medium leading-[22px] text-[#374151]">
          Need assistance? Our team is here to help you get the most out of OMV.
        </p>

        <div className="grid gap-4 md:grid-cols-2">
          {/* ── Contact Information ── */}
          <VayyCard className="p-[18px]">
            <div className="mb-2 flex items-center gap-3.5">
              <span className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-[16px] bg-[#ECFAF1]">
                <Mail size={26} className="text-[#009849]" aria-hidden="true" />
              </span>
              <h2 className="text-[16px] font-extrabold text-[#111827]">Contact Information</h2>
            </div>

            {CONTACT_ROWS.map((row, i) => {
              const RowIcon = row.icon;
              return (
                <div key={row.label}>
                  {i > 0 && <div aria-hidden="true" className="ml-[58px] h-px bg-[#E5E7EB]" />}
                  <div className="flex items-center gap-3.5 py-3">
                    <span
                      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] ${row.iconBg}`}
                    >
                      <RowIcon size={20} className={row.iconColor} aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-bold uppercase tracking-[0.5px] text-[#6B7280]">
                        {row.label}
                      </p>
                      <p className="mt-0.5 truncate text-[15px] font-bold text-[#111827]">
                        {row.value}
                      </p>
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
          </VayyCard>

          {/* ── Office Hours ── */}
          <VayyCard className="p-[18px]">
            <div className="mb-3 flex items-center gap-3.5">
              <span className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-[16px] bg-[#FFFBEB]">
                <Clock size={26} className="text-[#F59E0B]" aria-hidden="true" />
              </span>
              <h2 className="text-[16px] font-extrabold text-[#111827]">Office Hours</h2>
            </div>

            <div className="space-y-2">
              {HOURS_ROWS.map((row) => (
                <div
                  key={row.label}
                  className="flex items-center justify-between gap-3 rounded-[14px] bg-[#F8FAF9] px-3.5 py-3"
                >
                  <span className="text-[13px] font-semibold text-[#6B7280]">{row.label}</span>
                  <span className="text-[15px] font-bold text-[#111827]">{row.value}</span>
                </div>
              ))}
            </div>

            <p className="mt-4 text-center text-[12px] font-semibold text-[#6B7280]">
              We typically respond within 24 hours
            </p>
          </VayyCard>
        </div>
      </main>
    </div>
  );
}
