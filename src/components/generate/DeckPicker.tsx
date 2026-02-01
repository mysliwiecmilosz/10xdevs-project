import { useId } from "react";
import type { DeckOptionVm } from "@/lib/viewmodels/generate.vm";
import { Button } from "@/components/ui/button";

interface DeckPickerProps {
  value: string | null;
  options: DeckOptionVm[];
  disabled?: boolean;
  helperText?: string;
  createDisabled?: boolean;
  onChange: (deckId: string | null) => void;
  onCreateDeck: () => void;
}

export function DeckPicker({
  value,
  options,
  disabled,
  helperText,
  createDisabled,
  onChange,
  onCreateDeck,
}: DeckPickerProps) {
  const selectId = useId();

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium" htmlFor={selectId}>
        Deck docelowy
      </label>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <select
          id={selectId}
          className="min-h-[40px] w-full rounded-md border border-neutral-200 bg-white px-3 text-sm shadow-sm outline-none transition focus-visible:ring-2 focus-visible:ring-neutral-400 disabled:cursor-not-allowed disabled:opacity-60"
          value={value ?? ""}
          onChange={(event) => {
            const nextValue = event.target.value;
            onChange(nextValue === "" ? null : nextValue);
          }}
          disabled={disabled}
        >
          {options.map((option) => (
            <option key={option.value ?? "none"} value={option.value ?? ""}>
              {option.label}
            </option>
          ))}
        </select>
        <Button type="button" variant="outline" onClick={onCreateDeck} disabled={disabled || createDisabled}>
          Utwórz deck
        </Button>
      </div>
      {helperText ? <p className="text-xs text-neutral-500">{helperText}</p> : null}
    </div>
  );
}
