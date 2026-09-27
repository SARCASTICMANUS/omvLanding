import React from "react";

// Replica of the dominant mobile bottom-sheet pattern:
// white sheet, borderTopLeft/RightRadius 32, px-6 pt-3, 40x4 #E5E7EB handle, heavy shadow.

export function SheetHandle({ className = "" }) {
  return (
    <div className={`mx-auto mb-5 h-1 w-10 rounded-full bg-[#E5E7EB] ${className}`} />
  );
}

export default function BottomSheet({
  children,
  className = "",
  showHandle = true,
  scrim = false,
  onScrimClick,
}) {
  return (
    <>
      {scrim && (
        <div
          className="fixed inset-0 z-[1090] bg-black/50"
          onClick={onScrimClick}
          aria-hidden="true"
        />
      )}
      <div
        className={`fixed inset-x-0 bottom-0 z-[1100] mx-auto w-full max-w-[560px] rounded-t-sheet bg-white px-6 pb-6 pt-3 shadow-v-sheet lg:max-w-[720px] ${className}`}
      >
        {showHandle && <SheetHandle />}
        {children}
      </div>
    </>
  );
}
