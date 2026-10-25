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

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(input, init);
      if (
        (response.status === 502 || response.status === 503 || response.status === 504) &&
        attempt < retries
      ) {
        await new Promise((resolve) =>
          setTimeout(resolve, delayMs * Math.pow(1.5, attempt)),
        );
        continue;
      }
      return response;
    } catch (err) {
      lastError = err;
      if (attempt < retries) {
        await new Promise((resolve) =>
          setTimeout(resolve, delayMs * Math.pow(1.5, attempt)),
        );
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
