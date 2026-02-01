import { describe, expect, it } from "vitest";
import { cn } from "@/lib/utils";

describe("cn", () => {
  it("merges conditional classnames", () => {
    expect(cn("a", undefined, "c")).toBe("a c");
  });

  it("merges tailwind classes deterministically", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
  });
});
