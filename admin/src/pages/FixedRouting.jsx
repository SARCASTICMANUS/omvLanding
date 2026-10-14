import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Building2, Compass, IndianRupee, MapPin, Route } from "lucide-react";
import { PageLoader } from "../components/Loader";

/* These used to be five separate sidebar tabs. They each render their own
   `h-full overflow-y-auto` root and portal their own toolbar into
   `#page-toolbar`, so they are dropped in unchanged - no page was rewritten.

   The sub-nav is a SIBLING of the content, not a wrapper around it. That is
   deliberate: if it wrapped them, its own scroll box would nest around the one
   the pages already create and you would get two stacked scrollbars, with the
   outer one fighting the inner one for the wheel. As a sibling it takes its own
   slice of the height and the page below still owns scrolling. */
const Cities = lazy(() => import("./Cities"));
const RouteExplorerPage = lazy(() => import("./RouteExplorer"));
const RoutesPage = lazy(() => import("./Routes"));
const Stops = lazy(() => import("./Stops"));
const FareConfigurations = lazy(() => import("./FareConfigurations"));

const SUB_TABS = [
  { id: "cities", label: "Cities", icon: Building2 },
  { id: "route-explorer", label: "Route Explorer", icon: Compass },
  { id: "routes", label: "Routes", icon: Route },
  { id: "stops", label: "Stops", icon: MapPin },
  { id: "fare-configurations", label: "Fare Configurations", icon: IndianRupee },
];

export default function FixedRouting() {
  const [tab, setTab] = useState("cities");
  const contentRef = useRef(null);

  // Safety net for the scroll position. Each page remounts on a switch, so this
  // is normally already 0 - but if two sub-tabs ever resolve to the same
  // component instance React will reconcile rather than remount, and the box
  // would keep the previous page's offset. Assigning scrollTop directly instead
  // of scrollTo({behavior:"smooth"}) is deliberate: smooth animates the jump
  // rather than removing it.
  useEffect(() => {
    const box = contentRef.current?.querySelector("[data-scroll]");
    if (box) box.scrollTop = 0;
  }, [tab]);

  return (
    <div className="h-full flex flex-col">
      <div className="shrink-0 px-6 md:px-8 pt-4 md:pt-5 pb-1">
        <div className="flex items-center gap-2">
          {SUB_TABS.map((t) => {
            const Icon = t.icon;
            const active = t.id === tab;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-semibold transition ${
                  active
                    ? "bg-slate-800 text-white shadow-sm"
                    : "glass-card-subtle text-slate-600 hover:bg-white/70"
                }`}
              >
                <Icon size={16} /> {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* flex-1 + min-h-0: the pages' `h-full` needs a DEFINITE height to
          resolve against, and min-h-0 stops flex from inflating it past the
          viewport (which would make the inner scrollbar lie). */}
      <div ref={contentRef} className="flex-1 min-h-0 relative">
        <Suspense fallback={<PageLoader />}>
          {tab === "cities" && <Cities />}
          {tab === "route-explorer" && <RouteExplorerPage />}
          {tab === "routes" && <RoutesPage />}
          {tab === "stops" && <Stops />}
          {tab === "fare-configurations" && <FareConfigurations />}
        </Suspense>
      </div>
    </div>
  );
}