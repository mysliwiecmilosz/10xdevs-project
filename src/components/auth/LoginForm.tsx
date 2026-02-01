import { useId, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { AuthErrorBanner } from "@/components/auth/AuthErrorBanner";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;
const inputClassName =
  "min-h-[40px] w-full rounded-md border border-neutral-200 bg-white px-3 text-sm text-neutral-900 shadow-sm outline-none transition focus-visible:ring-2 focus-visible:ring-neutral-400";

interface LoginFormProps {
  isSubmitting?: boolean;
  error?: { code?: string; message?: string } | null;
  onSubmit?: (payload: { email: string; password: string }) => void;
}

export function LoginForm({ isSubmitting = false, error, onSubmit }: LoginFormProps) {
  const emailId = useId();
  const passwordId = useId();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
  const hasErrors = Boolean(emailError || passwordError);

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
    if (submitEmailError || submitPasswordError) {
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
          autoComplete="current-password"
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

      <div className="flex items-center justify-between">
        <a className="text-sm font-medium text-primary hover:underline" href="/auth/forgot-password">
          Nie pamiętasz hasła?
        </a>
        <a className="text-sm text-neutral-600 hover:text-neutral-900" href="/auth/register">
          Załóż konto
        </a>
      </div>

      <AuthErrorBanner error={error} />

      <Button type="submit" className="w-full" disabled={isSubmitting || hasErrors}>
        {isSubmitting ? "Loguję..." : "Zaloguj się"}
      </Button>
    </form>
  );
}
