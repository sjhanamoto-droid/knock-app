"use client";

import { useRef, useState, useCallback } from "react";

interface FileUploadProps {
  accept?: string;
  multiple?: boolean;
  maxFiles?: number;
  label?: string;
  onChange?: (files: File[]) => void;
  className?: string;
}

export function FileUpload({
  accept,
  multiple = false,
  maxFiles = 5,
  label = "ファイルを選択",
  onChange,
  className = "",
}: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [previews, setPreviews] = useState<{ name: string; url?: string }[]>([]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const fileList = e.target.files;
      if (!fileList) return;

      const files = Array.from(fileList).slice(0, maxFiles);
      const newPreviews = files.map((f) => ({
        name: f.name,
        url: f.type.startsWith("image/") ? URL.createObjectURL(f) : undefined,
      }));
      setPreviews(newPreviews);
      onChange?.(files);
    },
    [maxFiles, onChange]
  );

  const handleRemove = useCallback(
    (index: number) => {
      setPreviews((prev) => prev.filter((_, i) => i !== index));
    },
    []
  );

  return (
    <div className={className}>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={handleChange}
        className="hidden"
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="rounded-lg border-2 border-dashed border-gray-300 px-4 py-3 text-[13px] font-medium text-gray-500 transition-colors hover:border-gray-400 hover:text-gray-600"
      >
        {label}
      </button>

      {previews.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {previews.map((p, i) => (
            <div key={i} className="relative">
              {p.url ? (
                <img
                  src={p.url}
                  alt={p.name}
                  className="h-16 w-16 rounded-lg object-cover"
                />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-gray-100 text-[10px] text-gray-500">
                  {p.name.split(".").pop()?.toUpperCase()}
                </div>
              )}
              <button
                type="button"
                onClick={() => handleRemove(i)}
                className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] text-white"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
