import { useCallback, useState } from "react";
import type { GenerateCardsCommand, GenerateCardsResponseDto } from "@/types";
import type { GenerateApiErrorVm, GenerateRequestStatus } from "@/lib/viewmodels/generate.vm";
import { postGenerateCards } from "@/lib/services/generate-client.service";

interface GenerateClientError {
  status?: number;
  code?: string;
  message?: string;
  details?: unknown;
}

function mapGenerateError(error: GenerateClientError): GenerateApiErrorVm {
  const status = error.status;
  const code = error.code;

  if (status === 429) {
    return {
      status,
      code,
      message: "Wyczerpano dzienny limit generacji. Spróbuj jutro.",
      debugDetails: import.meta.env.DEV ? error.details : undefined,
    };
  }

  if (status === 401) {
    return {
      status,
      code,
      message: "Zaloguj się, aby kontynuować generowanie.",
      debugDetails: import.meta.env.DEV ? error.details : undefined,
    };
  }

  if (status === 400) {
    return {
      status,
      code,
      message: "Niepoprawne dane formularza. Sprawdź treść wejściową.",
      debugDetails: import.meta.env.DEV ? error.details : undefined,
    };
  }

  if (status && status >= 500) {
    return {
      status,
      code,
      message: "Coś poszło nie tak. Spróbuj ponownie.",
      debugDetails: import.meta.env.DEV ? error.details : undefined,
    };
  }

  return {
    status,
    code,
    message: "Nie udało się wykonać żądania. Sprawdź połączenie.",
    debugDetails: import.meta.env.DEV ? error.details : undefined,
  };
}

export function useGenerateCards() {
  const [status, setStatus] = useState<GenerateRequestStatus>("idle");
  const [data, setData] = useState<GenerateCardsResponseDto | null>(null);
  const [error, setError] = useState<GenerateApiErrorVm | null>(null);

  const mutate = useCallback(async (command: GenerateCardsCommand) => {
    setStatus("loading");
    setError(null);

    try {
      const response = await postGenerateCards(command);
      setData(response);
      setStatus("success");
      return response;
    } catch (err) {
      const apiError = err as GenerateClientError;
      setError(mapGenerateError(apiError));
      setStatus("error");
      return null;
    }
  }, []);

  const reset = useCallback(() => {
    setStatus("idle");
    setError(null);
  }, []);

  return { mutate, status, data, error, reset };
}
