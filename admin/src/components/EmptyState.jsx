import MemphisShapes from "./MemphisShapes";

export default function EmptyState({ icon: Icon, title, description, action, className = "" }) {
  return (
    <div className={`memphis-empty relative overflow-hidden ${className}`}>
      <MemphisShapes variant="empty" />
      <div className="relative z-10">
        {Icon && (
          <div className="w-16 h-16 mx-auto mb-4 rounded-xl border-2 border-memphis-ink bg-memphis-teal/20 flex items-center justify-center">
            <Icon size={32} className="text-memphis-teal" />
          </div>
        )}
        <h3 className="text-lg font-bold text-memphis-ink mb-1">{title}</h3>
        {description && (
          <p className="text-sm font-medium text-memphis-purple mb-4">{description}</p>
        )}
        {action}
      </div>
    </div>
  );
}
