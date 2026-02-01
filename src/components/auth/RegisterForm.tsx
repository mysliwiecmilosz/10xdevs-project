import { useId, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { AuthErrorBanner } from "@/components/auth/AuthErrorBanner";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;
const inputClassName =
  "min-h-[40px] w-full rounded-md border border-neutral-200 bg-white px-3 text-sm text-neutral-900 shadow-sm outline-none transition focus-visible:ring-2 focus-visible:ring-neutral-400";

type RegisterFormProps = {
  isSubmitting?: boolean;
  error?: { code?: string; message?: string } | null;
  successMessage?: string | null;
  onSubmit?: (payload: { email: string; password: string }) => void;
};

export function RegisterForm({ isSubmitting = false, error, successMessage, onSubmit }: RegisterFormProps) {
  const emailId = useId();
  const passwordId = useId();
  const confirmId = useId();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [touched, setTouched] = useState(false);

  const normalizedEmail = email.trim().toLowerCase();
  const emailError =
    touched && !normalizedEmail
      ? "Email jest wymagany."
      : touched && !emailPattern.test(normalizedEmail)
        ? "Podaj poprawny adres email."
        : null;
  const passwordError =
    touched && !password
      ? "Hasło jest wymagane."
      : touched && password.length < MIN_PASSWORD_LENGTH
        ? `Hasło musi mieć co najmniej ${MIN_PASSWORD_LENGTH} znaków.`
        : null;
  const confirmError =
    touched && !confirm ? "Powtórz hasło." : touched && confirm !== password ? "Hasła muszą być takie same." : null;
  const hasErrors = Boolean(emailError || passwordError || confirmError);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setTouched(true);

    const submitEmailError = !normalizedEmail
      ? "Email jest wymagany."
      : !emailPattern.test(normalizedEmail)
        ? "Podaj poprawny adres email."
        : null;
    const submitPasswordError = !password
      ? "Hasło jest wymagane."
      : password.length < MIN_PASSWORD_LENGTH
        ? `Hasło musi mieć co najmniej ${MIN_PASSWORD_LENGTH} znaków.`
        : null;
    const submitConfirmError = !confirm
      ? "Powtórz hasło."
      : confirm !== password
        ? "Hasła muszą być takie same."
        : null;
    if (submitEmailError || submitPasswordError || submitConfirmError) {
      return;
    }

    onSubmit?.({ email: normalizedEmail, password });
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor={emailId}>
          Email
        </label>
        <input
          id={emailId}
          type="email"
          autoComplete="email"
          className={inputClassName}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          onBlur={() => setTouched(true)}
          aria-invalid={emailError ? true : undefined}
        />
        {emailError ? (
          <p className="text-xs text-red-600" role="alert">
            {emailError}
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor={passwordId}>
          Hasło
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
          Powtórz hasło
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

      <p className="text-xs text-neutral-500">Po rejestracji wyślemy link potwierdzający. Sprawdź skrzynkę email.</p>

      {successMessage ? (
        <div
          className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800"
          role="status"
        >
          {successMessage}
        </div>
      ) : null}

      <AuthErrorBanner error={error} />

      <Button type="submit" className="w-full" disabled={isSubmitting || hasErrors}>
        {isSubmitting ? "Tworzę konto..." : "Załóż konto"}
      </Button>
    </form>
  );
}
