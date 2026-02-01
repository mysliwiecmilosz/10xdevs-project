import { useId } from "react";

interface GenerateTextInputProps {
  value: string;
  minLength: number;
  maxLength: number;
  disabled?: boolean;
  validation?: { state: "idle" | "error"; message?: string };
  onContentChange: (next: string) => void;
  onBlur?: () => void;
  onClear?: () => void;
}

export function GenerateTextInput({
  value,
  minLength,
  maxLength,
  disabled,
  validation,
  onContentChange,
  onBlur,
  onClear,
}: GenerateTextInputProps) {
  const textareaId = useId();
  const helpId = useId();
  const errorId = useId();
  const isError = validation?.state === "error";
  const describedBy = isError ? `${helpId} ${errorId}` : helpId;

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium" htmlFor={textareaId}>
        Tekst źródłowy
      </label>
      <textarea
        id={textareaId}
        className="min-h-[220px] w-full rounded-md border border-neutral-200 bg-white p-3 text-sm shadow-sm outline-none transition focus-visible:ring-2 focus-visible:ring-neutral-400 disabled:cursor-not-allowed disabled:opacity-60"
        placeholder="Wklej materiał do wygenerowania fiszek..."
        value={value}
        onChange={(event) => onContentChange(event.target.value)}
        onBlur={onBlur}
        disabled={disabled}
        aria-invalid={isError || undefined}
        aria-describedby={describedBy}
      />
      <div className="flex items-center justify-between text-xs text-neutral-500">
        <p id={helpId}>
          Min {minLength}, max {maxLength} znaków
        </p>
        <span>
          {value.length} / {maxLength}
        </span>
      </div>
      {isError ? (
        <p id={errorId} className="text-xs text-red-600" role="alert">
          {validation?.message}
        </p>
      ) : null}
      {onClear ? (
        <button
          type="button"
          className="text-xs font-medium text-neutral-600 underline-offset-2 hover:underline"
          onClick={onClear}
          disabled={disabled}
        >
          Wyczyść treść
        </button>
      ) : null}
    </div>
  );
}
