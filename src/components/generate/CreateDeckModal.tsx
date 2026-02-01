import { useEffect, useId, useState, type FormEvent } from "react";
import type { DeckCreateCommand } from "@/types";
import { Button } from "@/components/ui/button";

type CreateDeckModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (command: DeckCreateCommand) => void;
  isSubmitting?: boolean;
  errorMessage?: string | null;
};

const MAX_NAME_LENGTH = 100;

export function CreateDeckModal({ open, onOpenChange, onSubmit, isSubmitting, errorMessage }: CreateDeckModalProps) {
  const nameId = useId();
  const descriptionId = useId();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (open) {
      return;
    }

    setName("");
    setDescription("");
    setTouched(false);
  }, [open]);

  if (!open) {
    return null;
  }

  const trimmedName = name.trim();
  const isNameTooLong = trimmedName.length > MAX_NAME_LENGTH;
  const isNameMissing = trimmedName.length === 0;
  const isInvalid = isNameMissing || isNameTooLong;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setTouched(true);

    if (isInvalid) {
      return;
    }

    onSubmit({
      name: trimmedName,
      description: description.trim() ? description.trim() : undefined,
    });
  };

  const handleClose = () => {
    onOpenChange(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div role="dialog" aria-modal="true" className="w-full max-w-lg rounded-lg bg-white p-6 shadow-lg">
        <header className="space-y-1">
          <h2 className="text-lg font-semibold">Utwórz nowy deck</h2>
          <p className="text-sm text-neutral-500">Dodaj nazwę i opcjonalny opis, aby od razu przypisać fiszki.</p>
        </header>
        <form className="mt-4 space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor={nameId}>
              Nazwa decka
            </label>
            <input
              id={nameId}
              className="min-h-[40px] w-full rounded-md border border-neutral-200 px-3 text-sm shadow-sm outline-none transition focus-visible:ring-2 focus-visible:ring-neutral-400"
              value={name}
              onChange={(event) => setName(event.target.value)}
              onBlur={() => setTouched(true)}
              maxLength={MAX_NAME_LENGTH}
              aria-invalid={touched && isInvalid ? true : undefined}
            />
            {touched && isNameMissing ? (
              <p className="text-xs text-red-600" role="alert">
                Nazwa decka jest wymagana.
              </p>
            ) : null}
            {touched && isNameTooLong ? (
              <p className="text-xs text-red-600" role="alert">
                Maksymalnie {MAX_NAME_LENGTH} znaków.
              </p>
            ) : null}
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor={descriptionId}>
              Opis (opcjonalnie)
            </label>
            <textarea
              id={descriptionId}
              className="min-h-[100px] w-full rounded-md border border-neutral-200 p-3 text-sm shadow-sm outline-none transition focus-visible:ring-2 focus-visible:ring-neutral-400"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>
          {errorMessage ? (
            <p className="text-xs text-red-600" role="alert">
              {errorMessage}
            </p>
          ) : null}
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="ghost" onClick={handleClose}>
              Anuluj
            </Button>
            <Button type="submit" disabled={isSubmitting || isInvalid}>
              {isSubmitting ? "Tworzę..." : "Utwórz"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
