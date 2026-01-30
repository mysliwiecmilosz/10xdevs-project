import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import type { DeckCreateCommand, GenerateCardsCommand } from "@/types";
import type {
  DeckOptionVm,
  GenerateLimitsVm,
  GenerateRequestStateVm,
  GenerateValidationVm,
} from "@/lib/viewmodels/generate.vm";
import { useGenerateCards } from "@/components/hooks/useGenerateCards";
import { useGenerateDraft } from "@/components/hooks/useGenerateDraft";
import { useDecks } from "@/components/hooks/useDecks";
import { createDeck } from "@/lib/services/decks-client.service";
import { CreateDeckModal } from "@/components/generate/CreateDeckModal";
import { DeckPicker } from "@/components/generate/DeckPicker";
import { GenerateProgressPanel } from "@/components/generate/GenerateProgressPanel";
import { GenerateSubmitButton } from "@/components/generate/GenerateSubmitButton";
import { GenerateTextInput } from "@/components/generate/GenerateTextInput";
import { LimitBanner } from "@/components/generate/LimitBanner";

type GenerateViewProps = {
  initialContent?: string;
  initialDeckId?: string | null;
};

const MIN_CONTENT_LENGTH = 50;
const MAX_CONTENT_LENGTH = 100000;
const DRAFT_STORAGE_KEY = "generate:draft";
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function GenerateView({
  initialContent = "",
  initialDeckId = null,
}: GenerateViewProps) {
  const { value: content, setValue: setContent, clear: clearDraft } =
    useGenerateDraft(DRAFT_STORAGE_KEY, initialContent);
  const [deckId, setDeckId] = useState<string | null>(initialDeckId);
  const [touchedContent, setTouchedContent] = useState(false);
  const [limits, setLimits] = useState<GenerateLimitsVm>({
    isGenerationBlocked: false,
  });
  const { decks, status: decksStatus, error: decksError, addDeck } = useDecks();
  const [isCreateDeckOpen, setIsCreateDeckOpen] = useState(false);
  const [createDeckError, setCreateDeckError] = useState<string | null>(null);
  const [isCreatingDeck, setIsCreatingDeck] = useState(false);
  const [isDeckLimitReached, setIsDeckLimitReached] = useState(false);
  const { mutate, status, data, error, reset } = useGenerateCards();

  const requestState = useMemo<GenerateRequestStateVm>(() => {
    if (data) {
      return {
        status,
        lastResponse: {
          sourceId: data.source_id,
          remainingGenerations: data.remaining_generations,
        },
      };
    }

    return { status };
  }, [data, status]);

  const validation = useMemo<GenerateValidationVm>(() => {
    if (content.length < MIN_CONTENT_LENGTH) {
      return {
        content: {
          code: "too_short",
          message: "Za krótki tekst. Dodaj więcej treści.",
        },
      };
    }

    if (content.length > MAX_CONTENT_LENGTH) {
      return {
        content: {
          code: "too_long",
          message: "Za długi tekst. Skróć treść wejściową.",
        },
      };
    }

    return { content: null };
  }, [content]);

  const deckOptions = useMemo<DeckOptionVm[]>(() => {
    const baseOption: DeckOptionVm = {
      value: null,
      label: "Bez decka (Oczekujące)",
    };

    return [
      baseOption,
      ...decks.map((deck) => ({
        value: deck.id,
        label: deck.name,
        description: deck.description ?? undefined,
      })),
    ];
  }, [decks]);

  const deckHelperText = useMemo(() => {
    if (decksStatus === "loading") {
      return "Ładuję decki...";
    }
    if (decksStatus === "error") {
      return decksError ?? "Nie udało się pobrać decków.";
    }
    if (isDeckLimitReached) {
      return "Osiągnięto limit decków. Usuń istniejący, aby dodać nowy.";
    }
    if (decks.length === 0) {
      return "Brak decków. Możesz utworzyć pierwszy.";
    }
    return undefined;
  }, [decks, decksError, decksStatus, isDeckLimitReached]);

  const isContentInvalid =
    content.length < MIN_CONTENT_LENGTH || content.length > MAX_CONTENT_LENGTH;
  const isSubmitDisabled =
    status === "loading" ||
    isContentInvalid ||
    limits.isGenerationBlocked;

  const handleContentChange = useCallback((next: string) => {
    setContent(next);
  }, []);

  const handleContentBlur = useCallback(() => {
    setTouchedContent(true);
  }, []);

  const handleClearContent = useCallback(() => {
    clearDraft();
    setTouchedContent(false);
  }, [clearDraft]);

  const handleDeckChange = useCallback((nextDeckId: string | null) => {
    setDeckId(nextDeckId);
  }, []);

  const handleCreateDeckClick = useCallback(() => {
    setIsCreateDeckOpen(true);
  }, []);

  const handleCreateDeckSubmit = useCallback(
    async (command: DeckCreateCommand) => {
      setIsCreatingDeck(true);
      setCreateDeckError(null);
      try {
        const deck = await createDeck(command);
        addDeck(deck);
        setDeckId(deck.id);
        setIsCreateDeckOpen(false);
        setIsDeckLimitReached(false);
      } catch (err) {
        const apiError = err as { status?: number };
        if (apiError.status === 429) {
          setCreateDeckError("Osiągnięto limit decków. Usuń istniejący lub spróbuj później.");
          setIsDeckLimitReached(true);
        } else {
          setCreateDeckError("Nie udało się utworzyć decka. Spróbuj ponownie.");
        }
      } finally {
        setIsCreatingDeck(false);
      }
    },
    [addDeck],
  );

  const handleCreateDeckOpenChange = useCallback((open: boolean) => {
    setIsCreateDeckOpen(open);
    if (!open) {
      setCreateDeckError(null);
    }
  }, []);

  const handleSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setTouchedContent(true);

      if (isSubmitDisabled) {
        return;
      }

      const command: GenerateCardsCommand = {
        content,
      };

      if (deckId && uuidPattern.test(deckId)) {
        command.deck_id = deckId;
      }

      mutate(command);
    },
    [content, deckId, isSubmitDisabled, mutate],
  );

  const handleRetry = useCallback(() => {
    reset();
  }, [reset]);

  useEffect(() => {
    if (!data) {
      return;
    }

    setLimits({
      remainingGenerations: data.remaining_generations,
      isGenerationBlocked: data.remaining_generations <= 0,
      reason: data.remaining_generations <= 0 ? "limit_reached" : undefined,
    });
  }, [data]);

  useEffect(() => {
    if (!error?.status || error.status !== 429) {
      return;
    }

    setLimits({
      remainingGenerations: 0,
      isGenerationBlocked: true,
      reason: "limit_reached",
    });
  }, [error]);

  useEffect(() => {
    if (!data || typeof window === "undefined") {
      return;
    }

    window.location.assign(`/generate/results?source_id=${data.source_id}`);
  }, [data]);

  const showValidationError = touchedContent && Boolean(validation.content);
  const limitError = error?.status === 429 ? error : null;
  const canRetry = error?.status !== 429;

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-10">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">
          Generowanie fiszek
        </p>
        <h1 className="text-3xl font-semibold text-neutral-900">
          Generuj fiszki
        </h1>
        <p className="text-sm text-neutral-600">
          Wklej tekst źródłowy, wybierz deck i uruchom generację.
        </p>
      </header>

      <LimitBanner limits={limits} error={limitError} />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <form className="space-y-6" onSubmit={handleSubmit}>
          <GenerateTextInput
            value={content}
            minLength={MIN_CONTENT_LENGTH}
            maxLength={MAX_CONTENT_LENGTH}
            onContentChange={handleContentChange}
            onClear={handleClearContent}
            onBlur={handleContentBlur}
            disabled={status === "loading"}
            validation={
              showValidationError
                ? { state: "error", message: validation.content?.message }
                : { state: "idle" }
            }
          />
          <DeckPicker
            value={deckId}
            options={deckOptions}
            disabled={status === "loading" || decksStatus === "loading"}
            helperText={deckHelperText}
            createDisabled={isDeckLimitReached}
            onChange={handleDeckChange}
            onCreateDeck={handleCreateDeckClick}
          />
          <GenerateSubmitButton
            disabled={isSubmitDisabled}
            loading={status === "loading"}
          />
        </form>

        <GenerateProgressPanel
          state={requestState}
          error={error}
          onRetry={canRetry ? handleRetry : undefined}
        />
      </div>

      <CreateDeckModal
        open={isCreateDeckOpen}
        onOpenChange={handleCreateDeckOpenChange}
        onSubmit={handleCreateDeckSubmit}
        isSubmitting={isCreatingDeck}
        errorMessage={createDeckError}
      />
    </main>
  );
}
