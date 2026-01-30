export const prerender = false;

// Backwards-compatible alias.
// The implementation plan uses POST /api/ai/generate, but some clients call /api/generate.
export { POST } from "./ai/generate.ts";

