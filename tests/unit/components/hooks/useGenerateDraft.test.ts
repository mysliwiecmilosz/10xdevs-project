import { describe, expect, it, afterEach, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useGenerateDraft } from "@/components/hooks/useGenerateDraft";

describe("useGenerateDraft", () => {
  const storageKey = "generate:draft:test";

  afterEach(() => {
    window.localStorage.clear();
    vi.useRealTimers();
  });

  it("prefers stored value over initial value", async () => {
    window.localStorage.setItem(storageKey, "stored");

    const { result } = renderHook(() => useGenerateDraft(storageKey, "initial"));

    await waitFor(() => {
      expect(result.current.value).toBe("stored");
    });
  });

  it("persists value after debounce", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useGenerateDraft(storageKey, ""));

    act(() => {
      result.current.setValue("hello");
    });

    act(() => {
      vi.advanceTimersByTime(400);
    });

    expect(window.localStorage.getItem(storageKey)).toBe("hello");
  });

  it("clears stored value and state", async () => {
    window.localStorage.setItem(storageKey, "draft");
    const { result } = renderHook(() => useGenerateDraft(storageKey, ""));

    await waitFor(() => {
      expect(result.current.value).toBe("draft");
    });

    act(() => {
      result.current.clear();
    });

    expect(window.localStorage.getItem(storageKey)).toBeNull();
    expect(result.current.value).toBe("");
  });
});
