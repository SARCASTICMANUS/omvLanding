import React from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { PRIVACY_POLICY } from "../data/landingPageData";

export default function PrivacyPolicyPage() {
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
      {/* ── Green header (PrivacyPolicyScreen) ── */}
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
          <h1 className="text-[20px] font-black leading-tight text-white">Privacy Policy</h1>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-6 pb-10 pt-6">
        <p className="mb-5 text-[13px] font-semibold text-[#6B7280]">
          Last updated: {PRIVACY_POLICY.lastUpdated}
        </p>

        <p className="mb-3 text-[14px] font-medium leading-[22px] text-[#374151]">
          {PRIVACY_POLICY.intro}
        </p>

        {PRIVACY_POLICY.sections.map((section) => (
          <section key={section.title}>
            <h2 className="mb-2 mt-6 text-[17px] font-extrabold text-[#111827]">{section.title}</h2>
            {section.paragraphs.map((para, j) => (
              <p key={j} className="mb-3 text-[14px] font-medium leading-[22px] text-[#374151]">
                {para}
              </p>
            ))}
            {section.bullets && (
              <ul className="mb-3 ml-2">
                {section.bullets.map((bullet, j) => (
                  <li key={j} className="mb-1 text-[14px] font-medium leading-[22px] text-[#374151]">
                    • {bullet}
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </main>
    </div>
  );
}
