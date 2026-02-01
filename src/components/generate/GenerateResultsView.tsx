import { useEffect, useMemo, useState } from "react";
import type { CardDto } from "@/types";
import { getCardsBySourceId } from "@/lib/services/source-cards-client.service";
import { deleteCard, updateCard } from "@/lib/services/cards-client.service";
import { Button } from "@/components/ui/button";

type Status = "idle" | "loading" | "success" | "error";

function getSourceIdFromLocation(): string | null {
  if (typeof window === "undefined") return null;
  const url = new URL(window.location.href);
  return url.searchParams.get("source_id");
}

export function GenerateResultsView() {
  const sourceId = useMemo(() => getSourceIdFromLocation(), []);
  const [status, setStatus] = useState<Status>("idle");
  const [cards, setCards] = useState<CardDto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ question: string; answer: string } | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (!sourceId) {
      setStatus("error");
      setError("Brak parametru source_id w URL.");
      return;
    }

    let isMounted = true;
    const run = async () => {
      setStatus("loading");
      setError(null);
      try {
        const data = await getCardsBySourceId(sourceId);
        if (!isMounted) return;
        setCards(data);
        setStatus("success");
      } catch {
        if (!isMounted) return;
        setStatus("error");
        setError("Nie udało się pobrać wygenerowanych fiszek.");
      }
    };

    run();
    return () => {
      isMounted = false;
    };
  }, [sourceId]);

  const startEdit = (card: CardDto) => {
    setEditingId(card.id);
    setDraft({ question: card.question, answer: card.answer });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraft(null);
  };

  const saveEdit = async (cardId: string) => {
    if (!draft) return;
    setSavingId(cardId);
    try {
      const updated = await updateCard(cardId, {
        question: draft.question,
        answer: draft.answer,
      });
      setCards((prev) => prev.map((c) => (c.id === cardId ? updated : c)));
      cancelEdit();
    } catch {
      setError("Nie udało się zapisać zmian. Spróbuj ponownie.");
    } finally {
      setSavingId(null);
    }
  };

  const removeCard = async (cardId: string) => {
    if (typeof window !== "undefined") {
      const ok = window.confirm("Na pewno usunąć tę fiszkę? Tej operacji nie da się cofnąć.");
      if (!ok) return;
    }
    setDeletingId(cardId);
    try {
      await deleteCard(cardId);
      setCards((prev) => prev.filter((c) => c.id !== cardId));
      if (editingId === cardId) {
        cancelEdit();
      }
    } catch {
      setError("Nie udało się usunąć fiszki. Spróbuj ponownie.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-10">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">Generowanie fiszek</p>
        <h1 className="text-3xl font-semibold text-neutral-900">Wyniki</h1>
        <p className="text-sm text-neutral-600">Twoje fiszki wygenerowane z podanego źródła.</p>
      </header>

      <div className="flex items-center justify-between gap-4">
        <Button asChild variant="outline" size="sm">
          <a href="/generate">← Wróć do generatora</a>
        </Button>
        <p className="text-xs text-neutral-500">
          Źródło: <span className="font-mono">{sourceId ?? "—"}</span>
        </p>
      </div>

      {status === "loading" ? (
        <div className="rounded-xl border border-neutral-200 bg-white p-6 text-sm text-neutral-600">
          Ładuję fiszki...
        </div>
      ) : null}

      {status === "error" ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-800">{error}</div>
      ) : null}

      {status === "success" ? (
        <section className="space-y-4">
          {cards.length === 0 ? (
            <div className="rounded-xl border border-neutral-200 bg-white p-6 text-sm text-neutral-600">
              Brak fiszek dla tego źródła.
            </div>
          ) : (
            <ul className="grid gap-4 md:grid-cols-2">
              {cards.map((card) => (
                <li key={card.id} className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-medium uppercase tracking-[0.2em] text-neutral-500">Front</p>
                      {editingId === card.id && draft ? (
                        <input
                          value={draft.question}
                          onChange={(e) => setDraft({ ...draft, question: e.target.value })}
                          className="mt-1 w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900"
                        />
                      ) : (
                        <p className="mt-1 text-sm font-medium text-neutral-900">{card.question}</p>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-col gap-2">
                      {editingId === card.id ? (
                        <>
                          <Button
                            size="sm"
                            onClick={() => saveEdit(card.id)}
                            disabled={savingId === card.id || deletingId === card.id}
                          >
                            {savingId === card.id ? "Zapisuję..." : "Zapisz"}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={cancelEdit}
                            disabled={savingId === card.id || deletingId === card.id}
                          >
                            Anuluj
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button size="sm" variant="outline" onClick={() => startEdit(card)}>
                            Edytuj
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => removeCard(card.id)}
                            disabled={deletingId === card.id}
                          >
                            {deletingId === card.id ? "Usuwam..." : "Usuń"}
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="my-4 h-px bg-neutral-100" />
                  <p className="text-xs font-medium uppercase tracking-[0.2em] text-neutral-500">Back</p>
                  {editingId === card.id && draft ? (
                    <textarea
                      value={draft.answer}
                      onChange={(e) => setDraft({ ...draft, answer: e.target.value })}
                      rows={5}
                      className="mt-1 w-full resize-y rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900"
                    />
                  ) : (
                    <p className="mt-1 whitespace-pre-wrap text-sm text-neutral-800">{card.answer}</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
    </main>
  );
}
