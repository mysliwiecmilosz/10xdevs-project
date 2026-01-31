import { useCallback, useState } from "react";
import { RegisterForm } from "@/components/auth/RegisterForm";

type ApiError = { code?: string; message?: string } | null;

async function safeReadJson(response: Response): Promise<any | null> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export function RegisterFormContainer() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<ApiError>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSubmit = useCallback(async (payload: { email: string; password: string }) => {
    setIsSubmitting(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const body = await safeReadJson(res);
        if (body?.requiresEmailConfirmation) {
          setSuccessMessage("Sprawdź pocztę i potwierdź adres email, aby dokończyć rejestrację.");
          return;
        }

        window.location.assign("/");
        return;
      }

      const body = await safeReadJson(res);
      setError(body?.error ?? { code: "auth_error", message: "Nie udało się założyć konta. Spróbuj ponownie." });
    } catch {
      setError({ code: "network_error", message: "Brak połączenia. Sprawdź internet i spróbuj ponownie." });
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  return (
    <RegisterForm isSubmitting={isSubmitting} error={error} successMessage={successMessage} onSubmit={handleSubmit} />
  );
}
