/**
 * Error type carrying a Booker-specific error code and optional details.
 */
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

/**
 * Format an unknown error into a human-readable notice message.
 *
 * @param error - Error value to format.
 * @returns Message string for display.
 */
export function formatErrorForNotice(error: unknown): string {
  if (error instanceof BookerError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "Booker: An unexpected error occurred.";
}
