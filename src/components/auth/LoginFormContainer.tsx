import { useCallback, useState } from "react";
import { LoginForm } from "@/components/auth/LoginForm";

type ApiError = { code?: string; message?: string } | null;

async function safeReadJson(response: Response): Promise<any | null> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export function LoginFormContainer() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<ApiError>(null);

  const handleSubmit = useCallback(async (payload: { email: string; password: string }) => {
    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        window.location.assign("/");
        return;
      }

      const body = await safeReadJson(res);
      setError(body?.error ?? { code: "auth_error", message: "Nie udało się zalogować. Spróbuj ponownie." });
    } catch {
      setError({ code: "network_error", message: "Brak połączenia. Sprawdź internet i spróbuj ponownie." });
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  return <LoginForm isSubmitting={isSubmitting} error={error} onSubmit={handleSubmit} />;
}

