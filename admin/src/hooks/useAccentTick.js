import { useEffect, useState } from "react";
import { ACCENT_CHANGE_EVENT } from "../utils/glow";

export default function useAccentTick() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const onChange = () => setTick((t) => t + 1);
    window.addEventListener(ACCENT_CHANGE_EVENT, onChange);
    return () => window.removeEventListener(ACCENT_CHANGE_EVENT, onChange);
  }, []);
  return tick;
}
