import type { ErrorKind } from "@airport/shared";

/** A provider failure classified for the client. `message` keeps the raw detail for server logs only. */
export class LlmError extends Error {
  constructor(message: string, readonly kind: ErrorKind, readonly retryAfterSeconds: number | null = null) {
    super(message);
  }
}
