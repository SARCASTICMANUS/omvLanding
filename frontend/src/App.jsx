import React, { Suspense } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
} from "react-router-dom";

import { FullScreenLoader } from "./components/Shared";
import { useAuthExpiryGuard } from "./hooks/useAuthExpiryGuard";
import { appRouteConfig } from "./routes/routeConfig";

// Single source of truth is Vite's `base` (see vite.config.js).
// "/" -> "" (app served at domain root), "/omv/" -> "/omv".
const basename = import.meta.env.BASE_URL.replace(/\/+$/, "");

function App() {
  useAuthExpiryGuard();

  return (
    <Router basename={basename}>
      <Suspense fallback={<FullScreenLoader />}>
        <Routes>
          {appRouteConfig.map((route) => (
            <Route key={route.path} path={route.path} element={route.element} />
          ))}
        </Routes>
      </Suspense>
    </Router>
  );
}

export default App;
