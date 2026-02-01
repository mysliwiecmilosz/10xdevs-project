import { useCallback, useEffect, useMemo, useState } from "react";
import type { CardDto, ListCardsResponseDto } from "@/types";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { deleteCard, listCards, updateCard } from "@/lib/services/cards-client.service";

type Status = "idle" | "loading" | "success" | "error";

export function CardsView() {
  const [status, setStatus] = useState<Status>("idle");
  const [cards, setCards] = useState<CardDto[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const limit = 24;
  const [total, setTotal] = useState(0);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ question: string; answer: string } | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteCandidate, setDeleteCandidate] = useState<{ id: string; question: string } | null>(null);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / limit)), [total, limit]);

  const load = useCallback(async () => {
    setStatus("loading");
    setError(null);
    try {
      const response: ListCardsResponseDto = await listCards({ page, limit, sort: "created_at_desc" });
      setCards(response.data ?? []);
      setTotal(response.meta?.total ?? 0);
      setStatus("success");
    } catch {
      setStatus("error");
      setError("Nie udało się pobrać fiszek.");
    }
  }, [page]);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      if (!isMounted) return;
      await load();
    })();
    return () => {
      isMounted = false;
    };
  }, [load]);

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
    setError(null);
    try {
      const updated = await updateCard(cardId, { question: draft.question, answer: draft.answer });
      setCards((prev) => prev.map((c) => (c.id === cardId ? updated : c)));
      cancelEdit();
    } catch {
      setError("Nie udało się zapisać zmian. Spróbuj ponownie.");
    } finally {
      setSavingId(null);
    }
  };

  const requestDelete = (card: CardDto) => {
    setDeleteCandidate({ id: card.id, question: card.question });
  };

  const confirmDelete = async () => {
    if (!deleteCandidate) return;
    const cardId = deleteCandidate.id;
    setDeletingId(cardId);
    setError(null);
    try {
      await deleteCard(cardId);
      setCards((prev) => prev.filter((c) => c.id !== cardId));
      setTotal((prev) => Math.max(0, prev - 1));
      if (editingId === cardId) {
        cancelEdit();
      }
      setDeleteCandidate(null);
    } catch {
      setError("Nie udało się usunąć fiszki. Spróbuj ponownie.");
    } finally {
      setDeletingId(null);
    }
  };

  const canPrev = page > 1 && status !== "loading";
  const canNext = page < totalPages && status !== "loading";

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-10">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">Biblioteka</p>
        <h1 className="text-3xl font-semibold text-neutral-900">Fiszki</h1>
        <p className="text-sm text-neutral-600">Przeglądaj i edytuj swoje istniejące fiszki.</p>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <a href="/app">← Wybór</a>
          </Button>
          <Button asChild size="sm">
            <a href="/generate">Generuj nowe</a>
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={!canPrev}>
            ← Poprzednia
          </Button>
          <p className="text-xs text-neutral-500" aria-live="polite">
            Strona <span className="font-medium text-neutral-700">{page}</span> z{" "}
            <span className="font-medium text-neutral-700">{totalPages}</span>
          </p>
          <Button variant="outline" size="sm" onClick={() => setPage((p) => p + 1)} disabled={!canNext}>
            Następna →
          </Button>
        </div>
      </div>

      {status === "loading" ? (
        <div className="rounded-xl border border-neutral-200 bg-white p-6 text-sm text-neutral-600">
          Ładuję fiszki...
        </div>
      ) : null}

      {status === "error" && error ? (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      {status === "success" ? (
        <section className="space-y-4">
          {error ? (
            <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
              {error}
            </div>
          ) : null}

          {cards.length === 0 ? (
            <div className="rounded-xl border border-neutral-200 bg-white p-6 text-sm text-neutral-600">
              Nie masz jeszcze żadnych fiszek. Wygeneruj pierwsze w generatorze.
            </div>
          ) : (
            <ul className="grid gap-4 md:grid-cols-2">
              {cards.map((card) => (
                <li key={card.id} className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
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
                      <p className="mt-2 text-xs text-neutral-500">
                        Status: <span className="font-medium text-neutral-700">{card.quality_status}</span>
                        {typeof card.difficulty === "number" ? (
                          <>
                            {" "}
                            · Trudność: <span className="font-medium text-neutral-700">{card.difficulty}</span>
                          </>
                        ) : null}
                      </p>
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
                            onClick={() => requestDelete(card)}
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

      <ConfirmDialog
        open={Boolean(deleteCandidate)}
        title="Usunąć fiszkę?"
        description={
          deleteCandidate ? `Na pewno chcesz usunąć fiszkę: „${deleteCandidate.question}”? Tej operacji nie da się cofnąć.` : ""
        }
        confirmLabel="Usuń"
        cancelLabel="Anuluj"
        confirmVariant="destructive"
        isConfirming={Boolean(deleteCandidate?.id) && deletingId === deleteCandidate?.id}
        onOpenChange={(open) => {
          if (!open) setDeleteCandidate(null);
        }}
        onConfirm={confirmDelete}
      />
    </main>
  );
}
