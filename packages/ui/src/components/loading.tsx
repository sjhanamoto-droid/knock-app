interface LoadingProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizes = {
  sm: "h-4 w-4 border-2",
  md: "h-6 w-6 border-2",
  lg: "h-10 w-10 border-3",
};

export function Loading({ size = "md", className = "" }: LoadingProps) {
  return (
    <div className={`flex items-center justify-center ${className}`}>
      <div
        className={`animate-spin rounded-full border-gray-300 border-t-gray-800 ${sizes[size]}`}
      />
    </div>
  );
}

export function PageLoading() {
  return (
    <div className="flex min-h-[200px] items-center justify-center">
      <Loading size="lg" />
    </div>
  );
}
