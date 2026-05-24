"use client";

export default function MainError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-4">
      <p className="text-[14px] text-red-600 text-center">
        エラーが発生しました
      </p>
      <p className="mt-2 text-[12px] text-gray-500 text-center">
        {error.message || "予期しないエラーが発生しました"}
      </p>
      <button
        onClick={reset}
        className="mt-4 rounded-lg bg-gray-100 px-4 py-2 text-[13px] font-medium text-gray-700"
      >
        再試行
      </button>
    </div>
  );
}
