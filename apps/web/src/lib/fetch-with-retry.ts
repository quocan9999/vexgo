/**
 * fetchWithRetry wraps fetch with automatic retry and backoff
 * for temporary network connection drops (e.g. local backend restarting)
 * and transient gateway errors (502, 503, 504).
 */
export async function fetchWithRetry(
  input: RequestInfo | URL,
  init?: RequestInit,
  retries = 2,
  delayMs = 800,
): Promise<Response> {
  let lastError: unknown;
  const waitForRetry = (delay: number) =>
    new Promise<void>((resolve, reject) => {
      const signal = init?.signal;
      if (signal?.aborted) {
        reject(signal.reason);
        return;
      }
      const abort = () => {
        clearTimeout(timer);
        signal?.removeEventListener('abort', abort);
        reject(signal?.reason);
      };
      const timer = setTimeout(() => {
        signal?.removeEventListener('abort', abort);
        resolve();
      }, delay);
      signal?.addEventListener('abort', abort, { once: true });
    });

  for (let attempt = 0; attempt <= retries; attempt++) {
    init?.signal?.throwIfAborted();
    try {
      const response = await fetch(input, init);
      if (
        (response.status === 502 ||
          response.status === 503 ||
          response.status === 504) &&
        attempt < retries
      ) {
        await waitForRetry(delayMs * Math.pow(1.5, attempt));
        continue;
      }
      return response;
    } catch (err) {
      if (init?.signal?.aborted) throw init.signal.reason;
      if (err instanceof Error && err.name === 'AbortError') throw err;
      lastError = err;
      if (attempt < retries) {
        await waitForRetry(delayMs * Math.pow(1.5, attempt));
        continue;
      }
    }
  }

  if (lastError instanceof Error) {
    const msg = lastError.message.toLowerCase();
    if (
      lastError.name === 'TypeError' ||
      msg.includes('fetch') ||
      msg.includes('network') ||
      msg.includes('connection')
    ) {
      throw new Error(
        'Không thể kết nối đến máy chủ. Vui lòng kiểm tra lại kết nối hoặc thử lại.',
      );
    }
  }

  throw lastError;
}
