type BackoffOptions = {
  maxAttempts?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  factor?: number;
  jitter?: boolean;
  onRetry?: (error: unknown, attempt: number, delayMs: number) => void;
  shouldRetry?: (error: unknown, attempt: number) => boolean;
};

const wait = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

export const exponentialBackoff = async <T>(
  action: (attempt: number) => Promise<T>,
  options: BackoffOptions = {},
): Promise<T> => {
  const {
    maxAttempts = 5,
    initialDelayMs = 500,
    maxDelayMs = 30_000,
    factor = 2,
    jitter = true,
    onRetry,
    shouldRetry,
  } = options;

  let attempt = 0;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    attempt += 1;

    try {
      return await action(attempt);
    } catch (error) {
      if (attempt >= maxAttempts) {
        throw error;
      }

      if (typeof shouldRetry === 'function' && !shouldRetry(error, attempt)) {
        throw error;
      }

      const exponentialDelay = initialDelayMs * factor ** (attempt - 1);
      const cappedDelay = Math.min(exponentialDelay, maxDelayMs);
      const delay = jitter
        ? Math.round(cappedDelay / 2 + Math.random() * (cappedDelay / 2))
        : Math.round(cappedDelay);

      if (typeof onRetry === 'function') {
        try {
          onRetry(error, attempt, delay);
        } catch (hookError) {
          console.warn('Retry hook threw an error.', hookError);
        }
      }

      await wait(delay);
    }
  }
};

export type { BackoffOptions };
