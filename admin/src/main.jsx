import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { initTheme } from "./utils/theme";
import { initGlow } from "./utils/glow";
import "./index.css";

initTheme();
initGlow();

// Mirror the frontend's basename derivation (frontend/src/App.jsx): Vite's `base`
// becomes the router's mount point. Without this, a hard refresh or deep link on
// /zxcv/anything matches no route inside <App> and renders a blank shell.
const basename = import.meta.env.BASE_URL.replace(/\/+$/, "");

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter basename={basename}>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
