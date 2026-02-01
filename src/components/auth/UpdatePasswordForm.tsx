import { useId, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { AuthErrorBanner } from "@/components/auth/AuthErrorBanner";

const MIN_PASSWORD_LENGTH = 8;
const inputClassName =
  "min-h-[40px] w-full rounded-md border border-neutral-200 bg-white px-3 text-sm text-neutral-900 shadow-sm outline-none transition focus-visible:ring-2 focus-visible:ring-neutral-400";

interface UpdatePasswordFormProps {
  isSubmitting?: boolean;
  error?: { code?: string; message?: string } | null;
  onSubmit?: (payload: { password: string }) => void;
}

export function UpdatePasswordForm({ isSubmitting = false, error, onSubmit }: UpdatePasswordFormProps) {
  const passwordId = useId();
  const confirmId = useId();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [touched, setTouched] = useState(false);

  const passwordError =
    touched && !password
      ? "Hasło jest wymagane."
      : touched && password.length < MIN_PASSWORD_LENGTH
        ? `Hasło musi mieć co najmniej ${MIN_PASSWORD_LENGTH} znaków.`
        : null;
  const confirmError =
    touched && !confirm ? "Powtórz hasło." : touched && confirm !== password ? "Hasła muszą być takie same." : null;
  const hasErrors = Boolean(passwordError || confirmError);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setTouched(true);

    if (hasErrors) {
      return;
    }

    onSubmit?.({ password });
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor={passwordId}>
          Nowe hasło
        </label>
        <input
          id={passwordId}
          type="password"
          autoComplete="new-password"
          className={inputClassName}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          onBlur={() => setTouched(true)}
          aria-invalid={passwordError ? true : undefined}
        />
        {passwordError ? (
          <p className="text-xs text-red-600" role="alert">
            {passwordError}
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor={confirmId}>
          Powtórz nowe hasło
        </label>
        <input
          id={confirmId}
          type="password"
          autoComplete="new-password"
          className={inputClassName}
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
          onBlur={() => setTouched(true)}
          aria-invalid={confirmError ? true : undefined}
        />
        {confirmError ? (
          <p className="text-xs text-red-600" role="alert">
            {confirmError}
          </p>
        ) : null}
      </div>

      <p className="text-xs text-neutral-500">Po zapisaniu nowego hasła wrócisz do aplikacji.</p>

      <AuthErrorBanner error={error} />

      <Button type="submit" className="w-full" disabled={isSubmitting || hasErrors}>
        {isSubmitting ? "Zapisuję..." : "Ustaw nowe hasło"}
      </Button>
    </form>
  );
}
