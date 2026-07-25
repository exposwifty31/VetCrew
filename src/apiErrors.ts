import type { MessageKey } from "./i18n/index.js";

export class HttpError extends Error {
  readonly status: number;

  constructor(status: number, context: string) {
    super(`${context}: ${status}`);
    this.name = "HttpError";
    this.status = status;
  }
}

export function fetchErrorMessageKey(status: number | null): MessageKey {
  if (status === 401) return "auth.required";
  if (status === 403) return "auth.forbidden";
  return "shell.networkError";
}

export function errorMessageKeyFromUnknown(err: unknown): MessageKey {
  if (err instanceof HttpError) {
    return fetchErrorMessageKey(err.status);
  }
  return "shell.networkError";
}
