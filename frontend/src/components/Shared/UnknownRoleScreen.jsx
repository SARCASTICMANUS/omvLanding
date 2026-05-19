import React from "react";
import { APP_ROUTES } from "../../constants/routes";

export default function UnknownRoleScreen({ role }) {
  const handleBackToLogin = () => {
    localStorage.clear();
    sessionStorage.clear();
    window.location.replace(APP_ROUTES.login);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-xl">
        <h1 className="mb-2 text-2xl font-bold text-slate-900">Unknown Role</h1>
        <p className="mb-6 text-sm text-slate-600">
          Invalid account role detected.
        </p>

        <div className="mb-6 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
          Role: <span className="font-semibold">{role || "N/A"}</span>
        </div>

        <button
          onClick={handleBackToLogin}
          className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white"
        >
          Back to Login
        </button>
      </div>
    </div>
  );
}
