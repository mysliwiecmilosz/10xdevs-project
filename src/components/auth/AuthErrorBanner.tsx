interface AuthError {
  code?: string;
  message?: string;
}

const errorMessages: Record<string, string> = {
  invalid_credentials: "Nieprawidłowy email lub hasło.",
  email_not_confirmed: "Potwierdź adres email w wiadomości, którą wysłaliśmy.",
  rate_limited: "Zbyt wiele prób. Spróbuj ponownie za chwilę.",
  user_already_exists: "Konto dla tego emaila już istnieje.",
  weak_password: "Hasło jest zbyt słabe. Użyj co najmniej 8 znaków.",
  signup_requires_confirmation: "Sprawdź pocztę i potwierdź adres email.",
  recovery_link_expired: "Link wygasł. Poproś o nowy.",
  demo_disabled: "Tryb demo jest wyłączony. Włącz Anonymous sign-ins w Supabase Auth.",
};

interface AuthErrorBannerProps {
  error?: AuthError | null;
}

export function AuthErrorBanner({ error }: AuthErrorBannerProps) {
  if (!error) {
    return null;
  }

  const message = error.message ?? errorMessages[error.code ?? ""] ?? "Coś poszło nie tak. Spróbuj ponownie.";

  return (
    <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
      {message}
    </div>
  );
}
