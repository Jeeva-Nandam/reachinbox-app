import { useRef, useState } from "react";
import { parseCsvPreview, CsvParsePreview } from "../../utils/csv";

interface CsvUploaderProps {
  onFileSelected: (file: File | null, preview: CsvParsePreview | null) => void;
}

export function CsvUploader({ onFileSelected }: CsvUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [preview, setPreview] = useState<CsvParsePreview | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFile = async (file: File) => {
    setFileName(file.name);
    const text = await file.text();
    const result = parseCsvPreview(text);
    setPreview(result);
    onFileSelected(file, result);
  };

  const clear = () => {
    setFileName(null);
    setPreview(null);
    onFileSelected(null, null);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-700">Recipients (CSV)</label>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          const file = e.dataTransfer.files?.[0];
          if (file) void handleFile(file);
        }}
        className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-8 text-center transition-colors
          ${isDragging ? "border-brand-500 bg-brand-50" : "border-gray-300 bg-gray-50"}`}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="mb-2 text-gray-400" aria-hidden="true">
          <path d="M12 16V4M12 4l-4 4M12 4l4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M4 16v3a1 1 0 001 1h14a1 1 0 001-1v-3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
        <p className="text-sm text-gray-600">
          Drag & drop a CSV file, or{" "}
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="font-medium text-brand-600 hover:underline"
          >
            browse
          </button>
        </p>
        <p className="mt-1 text-xs text-gray-400">A column named "email" is auto-detected.</p>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv,text/plain"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFile(file);
          }}
        />
      </div>

      {fileName && preview && (
        <div className="mt-3 rounded-lg border border-gray-200 bg-white p-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="truncate font-medium text-gray-800">{fileName}</span>
            <button type="button" onClick={clear} className="text-xs text-gray-400 hover:text-gray-600">
              Remove
            </button>
          </div>
          <p className="mt-1 font-medium text-brand-700">
            ✓ {preview.valid.length} email address{preview.valid.length === 1 ? "" : "es"} detected
          </p>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-gray-500">
            <span>{preview.valid.length} valid</span>
            {preview.invalid.length > 0 && <span className="text-red-500">{preview.invalid.length} invalid</span>}
            {preview.duplicatesRemoved > 0 && <span>{preview.duplicatesRemoved} duplicate(s) removed</span>}
          </div>
        </div>
      )}
    </div>
  );
}
