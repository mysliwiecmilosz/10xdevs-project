import { useId, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { AuthErrorBanner } from "@/components/auth/AuthErrorBanner";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const inputClassName =
  "min-h-[40px] w-full rounded-md border border-neutral-200 bg-white px-3 text-sm text-neutral-900 shadow-sm outline-none transition focus-visible:ring-2 focus-visible:ring-neutral-400";

type ForgotPasswordFormProps = {
  isSubmitting?: boolean;
  error?: { code?: string; message?: string } | null;
  onSubmit?: (payload: { email: string }) => void;
};

export function ForgotPasswordForm({
  isSubmitting = false,
  error,
  onSubmit,
}: ForgotPasswordFormProps) {
  const emailId = useId();
  const [email, setEmail] = useState("");
  const [touched, setTouched] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const emailError =
    touched && !email
      ? "Email jest wymagany."
      : touched && !emailPattern.test(email)
        ? "Podaj poprawny adres email."
        : null;
  const hasErrors = Boolean(emailError);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setTouched(true);

    if (hasErrors) {
      return;
    }

    setSubmitted(true);
    onSubmit?.({ email: email.trim().toLowerCase() });
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

      {submitted ? (
        <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs text-neutral-600">
          Jeśli konto istnieje, wyślemy link resetujący hasło.
        </div>
      ) : null}

      <AuthErrorBanner error={error} />

      <Button type="submit" className="w-full" disabled={isSubmitting || hasErrors}>
        {isSubmitting ? "Wysyłam link..." : "Wyślij link resetujący"}
      </Button>
    </form>
  );
}
