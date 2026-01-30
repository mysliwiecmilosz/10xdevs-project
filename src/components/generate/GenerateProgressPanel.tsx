import type {
  GenerateApiErrorVm,
  GenerateRequestStateVm,
} from "@/lib/viewmodels/generate.vm";
import { Button } from "@/components/ui/button";

type GenerateProgressPanelProps = {
  state: GenerateRequestStateVm;
  error?: GenerateApiErrorVm | null;
  onRetry?: () => void;
};

export function GenerateProgressPanel({
  state,
  error,
  onRetry,
}: GenerateProgressPanelProps) {
  if (state.status === "idle") {
    return (
      <div className="rounded-md border border-neutral-200 bg-white p-4 text-sm text-neutral-600">
        Wypełnij formularz, aby rozpocząć generowanie fiszek.
      </div>
    );
  }

  if (state.status === "loading") {
    return (
      <div className="rounded-md border border-neutral-200 bg-white p-4 text-sm text-neutral-600">
        Generuję fiszki. To może potrwać chwilę...
      </div>
    );
  }

  if (state.status === "success") {
    return (
      <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
        Gotowe! Przekierowuję do wyników generacji.
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
      <p>{error?.message ?? "Coś poszło nie tak. Spróbuj ponownie."}</p>
      {onRetry ? (
        <Button type="button" variant="outline" onClick={onRetry}>
          Spróbuj ponownie
        </Button>
      ) : null}
    </div>
  );
}
