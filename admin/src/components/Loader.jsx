export default function Loader({ size = "md" }) {
  const sizes = {
    sm: "w-6 h-6",
    md: "w-10 h-10",
    lg: "w-16 h-16",
  };

  return (
    <div className="flex items-center justify-center py-20">
      <div className="relative">
        {/* Outer ring */}
        <div
          className={`${sizes[size]} rounded-full border-[3px] border-transparent animate-spin`}
          style={{
            borderTopColor: "#2E5CFF",
            borderRightColor: "rgba(46,92,255,0.2)",
            background: "rgba(46,92,255,0.05)",
            boxShadow: "0 0 20px rgba(46,92,255,0.1)",
          }}
        />
        {/* Inner dot */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-2 h-2 rounded-full" style={{ background: "linear-gradient(135deg, #2E5CFF, #5B8AFF)" }} />
        </div>
      </div>
    </div>
  );
}

export function PageLoader() {
  return (
    <div className="flex items-center justify-center h-screen" style={{ background: "linear-gradient(135deg, #F0F4FF 0%, #E8EEFF 50%, #F5F0FF 100%)" }}>
      <div className="relative">
        <div
          className="w-16 h-16 rounded-full border-[3px] border-transparent animate-spin"
          style={{
            borderTopColor: "#2E5CFF",
            borderRightColor: "rgba(46,92,255,0.2)",
            background: "rgba(46,92,255,0.05)",
            boxShadow: "0 0 30px rgba(46,92,255,0.15)",
          }}
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-3 h-3 rounded-full" style={{ background: "linear-gradient(135deg, #2E5CFF, #5B8AFF)" }} />
        </div>
      </div>
    </div>
  );
}

export function InlineLoader() {
  return (
    <div className="flex justify-center py-12">
      <div
        className="w-8 h-8 rounded-full border-[3px] border-transparent animate-spin"
        style={{
          borderTopColor: "#2E5CFF",
          borderRightColor: "rgba(46,92,255,0.2)",
          background: "rgba(46,92,255,0.05)",
          boxShadow: "0 0 16px rgba(46,92,255,0.1)",
        }}
      />
    </div>
  );
}
