import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

const PRIVACY_SECTIONS = [
  { title: "Information We Collect", text: "We collect your name, email, phone number, profile info, location data, route preferences, and trip history to provide our ride-sharing services." },
  { title: "How We Use Your Information", text: "To match you with routes and Marshals, provide real-time tracking, process payments, improve services, and ensure platform safety." },
  { title: "Data Sharing", text: "We share data with Marshals for trip coordination and service providers. We never sell your personal information to third parties." },
  { title: "Your Rights", text: "Access, update, or delete your data anytime via account settings. Contact us for a full data copy or account closure." },
];

const FAQS = [
  { q: "How do I find a shared journey?", a: "Enter your destination, and OMV will match you with Marshals already travelling along a similar route. You can then join their shared journey." },
  { q: "How does route matching work?", a: "OMV uses route-based matching. We connect you with Marshals going your way — it's shared commuting, not ride-hailing." },
  { q: "What is Hand Raise?", a: "Signal Marshals you're waiting at a nearby stop. They'll see you and pick you up along the route." },
  { q: "How do I track my shared journey?", a: "Once your shared journey starts, see your Marshal's live location on the map with real-time ETA updates." },
  { q: "How does the fuel share work?", a: "The fuel share is a cost-sharing contribution toward shared running expenses. It is calculated based on distance and route — OMV does not charge a commission." },
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
    if (tab && ["privacy", "faq", "contact", "terms"].includes(tab)) {
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
            { id: "terms", label: "Terms" },
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

        {/* Terms */}
        {activeTab === "terms" && (
          <div className="mt-6 space-y-5">
            <p className="text-xs font-medium text-white/40">Last updated: 9 September 2026</p>
            <p className="text-sm leading-relaxed text-white/70">
              These Terms of Service govern your access to and use of the OMV — On My Vayy platform. By creating an account, accessing, or using OMV, you agree to these Terms.
            </p>
            <div className="rounded-xl bg-white/5 p-4 backdrop-blur-sm">
              <h3 className="text-sm font-bold text-white">Important</h3>
              <p className="mt-1 text-sm leading-relaxed text-white/60">
                OMV is designed as a technology platform for coordinating shared journeys between individuals who are already travelling along substantially similar routes. These Terms describe the intended operating model; they do not determine or guarantee the legal classification of the service. Users are responsible for complying with applicable law.
              </p>
            </div>
            {[
              { title: "1. Definitions", text: "Buddy — a verified User seeking to join a shared journey offered by a Marshal. Marshal — a verified User who has declared a personal journey and makes an available seat on their personal vehicle available for a shared journey. Verified User — a User whose account has completed the verification process specified by OMV. Verification may include digital, institutional, corporate, or other checks. Verification does not constitute a police or criminal-background check, character certificate, driving certification, or guarantee of safety. Shared Journey — a journey in which a Marshal is already travelling, or intends to travel, substantially along a declared route and a Buddy joins that journey. Fuel Share Contribution — an estimated contribution toward shared running expenses of a Shared Journey. It is intended as cost sharing and is not a fare, transportation charge, commission, salary, reward, or payment for providing transportation. Pickup/Drop Stop — a designated OMV meeting point along a route." },
              { title: "2. Nature of the Platform", text: "OMV provides technology infrastructure that enables Users to discover and coordinate Shared Journeys. OMV does not itself provide transportation, operate vehicles, employ Marshals, or dispatch vehicles as a transportation operator. OMV does not create an independent transportation trip for every Buddy. The intended model is that a Marshal has already declared a personal journey and a Buddy joins a substantially similar route. OMV may provide route matching, stop suggestions, navigation, tracking, verification, notifications, and other technology features. The legal classification of any activity and the applicability of transportation, motor-vehicle, insurance, tax, data-protection, or other laws shall be determined under applicable law." },
              { title: "3. Eligibility", text: "You must: Provide accurate and current account information. Meet the minimum age requirement displayed by OMV and applicable law. Use the Platform only for lawful purposes. Maintain the confidentiality of your account credentials. Not create an account on behalf of another person without authorization. Not use OMV for commercial passenger transportation unless OMV expressly enables and legally supports such use. OMV may suspend or terminate accounts that provide false information or violate these Terms." },
              { title: "4. Marshal Requirements", text: "A Marshal using a personal vehicle must: Be legally permitted to operate the vehicle. Hold a valid driving licence applicable to the vehicle. Maintain all legally required vehicle documents and insurance. Ensure the vehicle is roadworthy and safely maintained. Follow applicable traffic and motor-vehicle laws. Declare the route and journey information accurately. Not materially change a journey solely to generate trips or obtain compensation from Buddies. Not pressure, discriminate against, or mislead Buddies. A Marshal remains responsible for their vehicle, driving conduct, route decisions, and compliance with applicable law." },
              { title: "5. Buddy Requirements", text: "Buddies must: Provide accurate account information. Follow the designated pickup and drop arrangements. Respect the Marshal and other Users. Follow applicable safety instructions. Not request unsafe driving, illegal stops, route deviations, or other unlawful conduct. Not use OMV to transport prohibited or unlawful items. A Buddy is responsible for their own conduct during the Shared Journey." },
              { title: "6. Shared Journey and Cost Sharing", text: "OMV is intended to facilitate cost sharing between individuals who are travelling along substantially similar routes. Any Fuel Share Contribution shown by the Platform is an estimate of shared running expenses based on factors such as route distance, applicable fuel assumptions, tolls, or other permitted journey costs. The Fuel Share Contribution: is not a transportation fare, is not intended to create a driver-passenger employment relationship, is not intended as a profit or commercial reward for the Marshal, and should not exceed the applicable shared running costs permitted under law. OMV may change or disable contribution calculations where required by law, policy, or operational considerations. During the current version of the Platform, OMV does not charge a commission or transaction fee for facilitating cost-sharing arrangements. Future commercial features, if introduced, will be subject to applicable law and updated terms." },
              { title: "7. Usage Safeguards", text: "OMV may apply safeguards intended to discourage commercial or on-demand transportation activity, including: Limits on the number or frequency of pooling journeys. Restrictions on repeated or suspicious route patterns. Detection of unusual trip or account activity. Restrictions on excessive route deviations. Suspension or review of accounts showing characteristics inconsistent with personal shared journeys. These safeguards are internal platform policies and are not a representation that compliance with a particular threshold alone makes an activity legally permissible." },
              { title: "8. Routes, Stops, and Matching", text: "OMV may use declared routes, designated pickup/drop stops, geolocation, route data, and timing information to match Marshals and Buddies. Route recommendations and estimated arrival times are informational and may change because of traffic, road closures, GPS limitations, weather, or other factors. Users must not rely on OMV route information as a substitute for their own safe driving decisions or legal obligations. OMV may add, remove, modify, or temporarily disable routes and stops." },
              { title: "9. Verification and Safety", text: "OMV may use account verification, Safety Code verification, location tracking, trip information, user feedback, and other technology-based safeguards. A \"Verified Marshal\" or \"Verified Buddy\" means that the account has completed the verification process specified by OMV. It does not mean that OMV has independently guaranteed the person's identity, character, driving ability, or safety. Users should exercise reasonable caution, verify the person and vehicle at pickup, and avoid sharing unnecessary personal information. If a User feels unsafe, they should end or avoid the journey where reasonably possible and contact appropriate emergency or law-enforcement services." },
              { title: "10. Real-Time Tracking and Location Data", text: "When enabled, OMV may collect and process location information during a Shared Journey to provide matching, navigation, tracking, safety, and related functionality. Users are responsible for ensuring that location permissions are enabled when required for the relevant feature. Location accuracy may be affected by device settings, GPS availability, network conditions, buildings, weather, or other technical factors." },
              { title: "11. Prohibited Uses", text: "Users must not: Use OMV for unlawful activities. Misrepresent their identity, vehicle, route, or journey. Attempt to commercially operate passenger transportation through OMV where such activity is not permitted. Create fake bookings, accounts, trips, or locations. Circumvent platform safeguards or verification. Harass, threaten, discriminate against, or abuse another User. Manipulate ratings, reviews, fuel shares, route data, or other Platform information. Use OMV while impaired or in a manner that creates an unreasonable safety risk. Use the Platform to transport prohibited goods or substances." },
              { title: "12. Platform Availability", text: "OMV is provided on an \"as available\" basis. We do not guarantee that: A suitable Marshal or Buddy will always be available. A Shared Journey will always occur as scheduled. GPS, route, tracking, or notification services will always be accurate or uninterrupted. The Platform will be available without errors or downtime. OMV may modify, suspend, or discontinue any Platform feature at any time." },
              { title: "13. User Conduct and Disputes", text: "Users are responsible for resolving ordinary interpersonal issues respectfully. OMV may assist with reports, complaints, safety incidents, or disputes at its discretion, but OMV is not a party to the transportation arrangement between Users. OMV may review relevant Platform information where reasonably necessary to investigate safety, fraud, abuse, policy violations, or legal requests." },
              { title: "14. Safety Incidents", text: "If an emergency occurs, Users should first contact the appropriate emergency service or local authority. OMV may provide safety features such as trip tracking, emergency contacts, reporting, or incident assistance where available. OMV does not guarantee that any safety feature will prevent an accident, crime, injury, loss, or other incident." },
              { title: "15. Insurance and Vehicle Responsibility", text: "The Marshal is responsible for maintaining all legally required vehicle insurance and ensuring that the intended use of the vehicle is covered as required by applicable law. OMV does not provide vehicle insurance or personal accident insurance unless expressly stated for a particular product or feature. Users should independently understand the scope and limitations of their own insurance coverage." },
              { title: "16. Intellectual Property", text: "All Platform software, branding, logos, designs, content, interfaces, and related intellectual property belong to OMV or its licensors unless otherwise stated. You may not copy, reproduce, modify, distribute, reverse engineer, or commercially exploit OMV's intellectual property without written permission." },
              { title: "17. Privacy and Personal Data", text: "OMV may collect and process information necessary to provide the Platform, including account details, verification information, route information, location data, device information, trip information, and communications or reports submitted through the Platform. OMV processes personal data in accordance with applicable privacy and data-protection laws, including the Digital Personal Data Protection Act, 2023, to the extent applicable. Please refer to OMV's Privacy Policy for details regarding collection, use, retention, sharing, and deletion of personal data." },
              { title: "18. Limitation of Liability", text: "To the maximum extent permitted by applicable law, OMV shall not be responsible for: Accidents, injuries, death, or property damage arising from a Shared Journey. The conduct, negligence, or unlawful acts of Users. Vehicle condition or driving decisions. Route deviations, traffic delays, or missed pickups. Losses resulting from inaccurate information provided by Users. Technical failures, GPS inaccuracies, network failures, or third-party service interruptions. Nothing in these Terms excludes or limits liability that cannot legally be excluded or limited under applicable law." },
              { title: "19. Indemnification", text: "To the extent permitted by law, you agree to indemnify and hold harmless OMV, its officers, employees, contractors, and affiliates from claims, losses, liabilities, damages, costs, and expenses arising from: Your breach of these Terms. Your unlawful or negligent conduct. Your use of the Platform or participation in a Shared Journey. Your violation of another person's rights or applicable law." },
              { title: "20. Suspension and Termination", text: "OMV may suspend, restrict, or terminate access where it reasonably believes that a User: Violated these Terms. Created a safety, fraud, or legal risk. Provided false or misleading information. Attempted to commercially misuse the Platform. Circumvented verification or other safeguards. Users may stop using OMV and request account closure subject to applicable law and OMV's retention obligations." },
              { title: "21. Changes to These Terms", text: "OMV may update these Terms from time to time. Material changes may be communicated through the Platform or other appropriate channels. Continued use of OMV after updated Terms become effective constitutes acceptance of the revised Terms, to the extent permitted by law." },
              { title: "22. Governing Law and Jurisdiction", text: "These Terms shall be governed by the laws of India, subject to applicable law. Subject to mandatory legal requirements, disputes shall be subject to the jurisdiction of the courts having appropriate jurisdiction over OMV's registered office." },
              { title: "23. Contact", text: "For questions, complaints, safety concerns, or legal notices, contact: OMV — On My Vayy. Email: info@onmyvayy.com" },
            ].map((s, i) => (
              <div key={i} className="rounded-xl bg-white/5 p-4 backdrop-blur-sm">
                <h3 className="text-sm font-bold text-white">{s.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-white/60">{s.text}</p>
              </div>
            ))}
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
