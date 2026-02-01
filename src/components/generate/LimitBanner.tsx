import type { GenerateApiErrorVm, GenerateLimitsVm } from "@/lib/viewmodels/generate.vm";

type LimitBannerProps = {
  limits: GenerateLimitsVm;
  error?: GenerateApiErrorVm | null;
  onDismiss?: () => void;
};

export function LimitBanner({ limits, error, onDismiss }: LimitBannerProps) {
  const showBanner = limits.isGenerationBlocked || Boolean(error);

  if (!showBanner) {
    return null;
  }

  const title = limits.isGenerationBlocked ? "Limit generacji został wykorzystany" : "Nie można teraz generować";

  const description =
    error?.message ??
    (limits.remainingGenerations === 0
      ? "Wróć później lub poczekaj na odnowienie limitu."
      : "Spróbuj ponownie za jakiś czas.");

  return (
    <section className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800" role="alert">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="font-medium">{title}</p>
          <p className="text-xs text-amber-700">{description}</p>
        </div>
        {onDismiss ? (
          <button
            type="button"
            className="text-xs font-medium text-amber-800 underline-offset-2 hover:underline"
            onClick={onDismiss}
          >
            Zamknij
          </button>
        ) : null}
      </div>
    </section>
  );
}
