import { describe, expect, it, beforeEach, vi } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useDecks } from "@/components/hooks/useDecks";
import { getDecks } from "@/lib/services/decks-client.service";

vi.mock("@/lib/services/decks-client.service", () => ({
  getDecks: vi.fn(),
}));

describe("useDecks", () => {
  beforeEach(() => {
    vi.mocked(getDecks).mockReset();
  });

  it("loads decks successfully", async () => {
    vi.mocked(getDecks).mockResolvedValue({
      data: [{ id: "deck-1", name: "My deck", description: null, created_at: "2026-01-31T00:00:00.000Z" }],
      meta: { total: 1, page: 1, limit: 50 },
    });

    const { result } = renderHook(() => useDecks());

    await waitFor(() => {
      expect(result.current.status).toBe("success");
    });
    expect(result.current.decks).toHaveLength(1);
  });

  it("sets error state on failure", async () => {
    vi.mocked(getDecks).mockRejectedValue(new Error("boom"));

    const { result } = renderHook(() => useDecks());

    await waitFor(() => {
      expect(result.current.status).toBe("error");
    });
    expect(result.current.error).toBe("Nie udało się pobrać listy decków.");
  });

  it("adds a new deck to the list", async () => {
    vi.mocked(getDecks).mockResolvedValue({
      data: [],
      meta: { total: 0, page: 1, limit: 50 },
    });

    const { result } = renderHook(() => useDecks());

    await waitFor(() => {
      expect(result.current.status).toBe("success");
    });

    act(() => {
      result.current.addDeck({ id: "deck-2", name: "New", description: null, created_at: "2026-01-31T00:00:00.000Z" });
    });

    expect(result.current.decks[0]?.id).toBe("deck-2");
  });
});
