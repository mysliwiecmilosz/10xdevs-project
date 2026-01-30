import { useCallback, useEffect, useRef, useState } from "react";

const DEFAULT_DEBOUNCE_MS = 400;

export function useGenerateDraft(storageKey: string, initialValue = "") {
  const [value, setValue] = useState(initialValue);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const stored = window.localStorage.getItem(storageKey);
    if (stored !== null) {
      setValue(stored);
      return;
    }

    if (initialValue) {
      setValue(initialValue);
    }
  }, [storageKey, initialValue]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = window.setTimeout(() => {
      window.localStorage.setItem(storageKey, value);
    }, DEFAULT_DEBOUNCE_MS);

    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, [storageKey, value]);

  const clear = useCallback(() => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(storageKey);
    }
    setValue("");
  }, [storageKey]);

  return { value, setValue, clear };
}
