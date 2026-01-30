import { useCallback, useEffect, useState } from "react";
import type { DeckDto, ListDecksResponseDto } from "@/types";
import { getDecks } from "@/lib/services/decks-client.service";

type DecksStatus = "idle" | "loading" | "success" | "error";

export function useDecks() {
  const [decks, setDecks] = useState<DeckDto[]>([]);
  const [status, setStatus] = useState<DecksStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      setStatus("loading");
      setError(null);
      try {
        const response: ListDecksResponseDto = await getDecks({ page: 1, limit: 50 });
        if (!isMounted) {
          return;
        }
        setDecks(response.data ?? []);
        setStatus("success");
      } catch {
        if (!isMounted) {
          return;
        }
        setStatus("error");
        setError("Nie udało się pobrać listy decków.");
      }
    };

    load();
    return () => {
      isMounted = false;
    };
  }, []);

  const addDeck = useCallback((deck: DeckDto) => {
    setDecks((prev) => [deck, ...prev]);
  }, []);

  return { decks, status, error, addDeck };
}
