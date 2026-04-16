import { type ReactNode } from "react";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className = "" }: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center gap-3 rounded-2xl bg-white py-12 shadow-[0_1px_8px_rgba(0,0,0,0.06)] ${className}`}>
      {icon && <div className="text-gray-300">{icon}</div>}
      <span className="text-[14px] font-medium text-gray-400">{title}</span>
      {description && (
        <span className="max-w-[240px] text-center text-[12px] text-gray-400">
          {description}
        </span>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
