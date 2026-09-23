import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

// Renders the page's header toolbar (search / actions) into the fixed header
// band, aligned to the right of the page's title subtitle.
export default function PageToolbar({ children }) {
  const [target, setTarget] = useState(null);

  useEffect(() => {
    setTarget(document.getElementById("page-toolbar"));
  }, []);

  if (!target) return null;
  return createPortal(children, target);
}