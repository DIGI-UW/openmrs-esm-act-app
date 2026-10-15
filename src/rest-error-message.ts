interface Message {
  message?: string;
}

interface FailedRequest extends Message {
  responseBody?: {
    error?: Message & { globalErrors?: Array<Message>; fieldErrors?: Record<string, Array<Message>> };
  };
}

/**
 * The server's reason for a failed request: a validation error, global before field, else the exception's message,
 * else the fetch error's own.
 */
export function restErrorMessage(e: FailedRequest) {
  const error = e?.responseBody?.error;
  const fieldError = Object.values(error?.fieldErrors ?? {}).flat()[0];
  return error?.globalErrors?.[0]?.message ?? fieldError?.message ?? error?.message ?? e?.message ?? String(e);
}
