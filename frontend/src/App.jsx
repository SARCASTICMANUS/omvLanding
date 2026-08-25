import React, { Suspense } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
} from "react-router-dom";

import { FullScreenLoader } from "./components/Shared";
import { useAuthExpiryGuard } from "./hooks/useAuthExpiryGuard";
import { appRouteConfig } from "./routes/routeConfig";

function App() {
  useAuthExpiryGuard();

  return (
    <Router>
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
