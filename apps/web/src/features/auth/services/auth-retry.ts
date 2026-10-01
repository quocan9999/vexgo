export type TokenPair = {
  accessToken: string;
  refreshToken: string;
};

export type AuthRetryOptions = {
  getTokens: () => { accessToken: string | null; refreshToken: string | null };
  onRefresh: (newTokens: TokenPair) => void;
  onAuthFailed: () => void;
  refreshFn: (refreshToken: string) => Promise<{ data: TokenPair }>;
};

function is401Error(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    (error as { status: number }).status === 401
  );
}

export async function runWithAuthRetry<T>(
  action: (token: string) => Promise<T>,
  options: AuthRetryOptions,
): Promise<T> {
  const { accessToken, refreshToken } = options.getTokens();
  if (!accessToken) {
    options.onAuthFailed();
    throw new Error('Chưa đăng nhập');
  }

  // Phase 1: Initial call
  try {
    return await action(accessToken);
  } catch (error: unknown) {
    if (!is401Error(error)) {
      throw error;
    }

    if (!refreshToken) {
      options.onAuthFailed();
      throw error;
    }

    // Phase 2: Refresh token
    let newTokens: TokenPair;
    try {
      const res = await options.refreshFn(refreshToken);
      newTokens = res.data;
      options.onRefresh(newTokens);
    } catch (refreshErr) {
      options.onAuthFailed();
      throw refreshErr;
    }

    // Phase 3: Retry with new access token
    try {
      return await action(newTokens.accessToken);
    } catch (retryErr: unknown) {
      if (is401Error(retryErr)) {
        options.onAuthFailed();
      }
      throw retryErr;
    }
  }
}

