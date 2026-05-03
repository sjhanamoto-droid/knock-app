"use client";

export default function MypageError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 p-8">
      <h2 className="text-lg font-bold text-red-600">エラーが発生しました</h2>
      <pre className="max-w-full overflow-auto rounded bg-gray-100 p-4 text-xs text-gray-800">
        {error.message}
      </pre>
      {error.digest && (
        <p className="text-xs text-gray-500">Digest: {error.digest}</p>
      )}
      <button
        onClick={reset}
        className="rounded-xl bg-knock-orange px-6 py-2 text-sm font-bold text-white"
      >
        再試行
      </button>
    </div>
  );
}
