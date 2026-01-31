import "@testing-library/jest-dom/vitest";
import { afterAll, afterEach, beforeAll } from "vitest";
import { cleanup } from "@testing-library/react";
import { server } from "@/test/msw/server";

afterEach(() => {
  cleanup();
  server.resetHandlers();
});

beforeAll(() => {
  server.listen({ onUnhandledRequest: "error" });
});

afterAll(() => {
  server.close();
});

