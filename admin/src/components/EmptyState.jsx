export default function EmptyState({ icon: Icon, title, description, action, className = "" }) {
  return (
    <div className={`glass-empty relative overflow-hidden ${className}`}>
      <div className="relative z-10">
        {Icon && (
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center"
            style={{
              background: "rgba(46,92,255,0.08)",
              border: "1px solid rgba(46,92,255,0.15)",
              boxShadow: "0 4px 16px rgba(46,92,255,0.08)",
            }}>
            <Icon size={32} style={{ color: "#2E5CFF" }} />
          </div>
        )}
        <h3 className="text-lg font-semibold text-slate-800 mb-1">{title}</h3>
        {description && (
          <p className="text-sm font-medium text-slate-500 mb-4">{description}</p>
        )}
        {action}
      </div>
    </div>
  );
}
