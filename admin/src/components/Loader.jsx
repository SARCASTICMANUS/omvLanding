export default function Loader({ size = "md" }) {
  const sizes = {
    sm: "w-6 h-6",
    md: "w-10 h-10",
    lg: "w-16 h-16",
  };

  return (
    <div className="flex items-center justify-center py-20">
      <div className="relative">
        {/* Outer square - rotates */}
        <div
          className={`${sizes[size]} border-2 border-memphis-ink bg-memphis-pink animate-memphis-spin`}
          style={{
            clipPath: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)",
          }}
        />
        {/* Inner dot */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-2 h-2 bg-memphis-ink rounded-full" />
        </div>
      </div>
    </div>
  );
}

export function PageLoader() {
  return (
    <div className="flex items-center justify-center h-screen bg-memphis-paper">
      <div className="relative">
        <div
          className="w-16 h-16 border-2 border-memphis-ink bg-memphis-pink animate-memphis-spin"
          style={{
            clipPath: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)",
          }}
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-3 h-3 bg-memphis-ink rounded-full" />
        </div>
      </div>
    </div>
  );
}

export function InlineLoader() {
  return (
    <div className="flex justify-center py-12">
      <div
        className="w-8 h-8 border-2 border-memphis-ink bg-memphis-yellow animate-memphis-spin"
        style={{
          clipPath: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)",
        }}
      />
    </div>
  );
}
