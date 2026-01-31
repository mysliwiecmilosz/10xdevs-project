import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useGenerateCards } from "@/components/hooks/useGenerateCards";
import { postGenerateCards } from "@/lib/services/generate-client.service";

vi.mock("@/lib/services/generate-client.service", () => ({
  postGenerateCards: vi.fn(),
}));

describe("useGenerateCards", () => {
  beforeEach(() => {
    vi.mocked(postGenerateCards).mockReset();
  });

  it("sets success state with response data", async () => {
    vi.mocked(postGenerateCards).mockResolvedValue({
      source_id: "source-1",
      remaining_generations: 3,
      cards: [],
    });

    const { result } = renderHook(() => useGenerateCards());

    await act(async () => {
      await result.current.mutate({ content: "x".repeat(50) });
    });

    await waitFor(() => {
      expect(result.current.status).toBe("success");
    });
    expect(result.current.data?.source_id).toBe("source-1");
  });

  it("maps 429 errors to limit message", async () => {
    vi.mocked(postGenerateCards).mockRejectedValue({
      status: 429,
      code: "daily_limit_exceeded",
      details: { limit: 1 },
    });

    const { result } = renderHook(() => useGenerateCards());

    await act(async () => {
      await result.current.mutate({ content: "x".repeat(50) });
    });

    await waitFor(() => {
      expect(result.current.status).toBe("error");
    });
    expect(result.current.error?.status).toBe(429);
    expect(result.current.error?.message).toBe("Wyczerpano dzienny limit generacji. Spróbuj jutro.");
  });

  it("resets state to idle", async () => {
    vi.mocked(postGenerateCards).mockRejectedValue({ status: 500 });
    const { result } = renderHook(() => useGenerateCards());

    await act(async () => {
      await result.current.mutate({ content: "x".repeat(50) });
    });

    await waitFor(() => {
      expect(result.current.status).toBe("error");
    });

    act(() => {
      result.current.reset();
    });

    expect(result.current.status).toBe("idle");
    expect(result.current.error).toBeNull();
  });
});
