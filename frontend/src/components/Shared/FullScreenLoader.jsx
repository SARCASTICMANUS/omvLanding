import React from "react";

export default function FullScreenLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#171717] px-4">
      <div className="rounded-2xl bg-white px-6 py-4 shadow-xl">
        <p className="text-sm font-semibold text-slate-700">Loading...</p>
      </div>
    </div>
  );
}
