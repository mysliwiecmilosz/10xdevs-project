import { useCallback, useState } from "react";
import { ContinueAsDemoButton } from "@/components/auth/ContinueAsDemoButton";
import { AuthErrorBanner } from "@/components/auth/AuthErrorBanner";

async function safeReadJson(response: Response): Promise<any | null> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export function ContinueAsDemoButtonContainer() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<{ code?: string; message?: string } | null>(null);

  const handleClick = useCallback(async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/demo", { method: "POST" });
      if (res.ok) {
        window.location.assign("/");
        return;
      }
      const body = await safeReadJson(res);
      setError(body?.error ?? { code: "auth_error", message: "Nie udało się uruchomić demo." });
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  return (
    <div className="space-y-3">
      <ContinueAsDemoButton isSubmitting={isSubmitting} onClick={handleClick} />
      <AuthErrorBanner error={error} />
    </div>
  );
}

