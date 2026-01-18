export class BookerError extends Error {
  code: string;
  details?: string;

  constructor(code: string, message: string, details?: string) {
    super(message);
    this.name = "BookerError";
    this.code = code;
    this.details = details;
  }
}

export function formatErrorForNotice(error: unknown): string {
  if (error instanceof BookerError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "Booker: An unexpected error occurred.";
}
