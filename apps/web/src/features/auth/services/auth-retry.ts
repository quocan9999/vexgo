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

export async function runWithAuthRetry<T>(
  action: (token: string) => Promise<T>,
  options: AuthRetryOptions,
): Promise<T> {
  const { accessToken, refreshToken } = options.getTokens();
  if (!accessToken) {
    options.onAuthFailed();
    throw new Error('Chưa đăng nhập');
  }

  try {
    return await action(accessToken);
  } catch (error: unknown) {
    const isUnauthorized =
      typeof error === 'object' &&
      error !== null &&
      'status' in error &&
      (error as { status: number }).status === 401;

    if (isUnauthorized && refreshToken) {
      try {
        const res = await options.refreshFn(refreshToken);
        const newTokens = res.data;
        options.onRefresh(newTokens);
        return await action(newTokens.accessToken);
      } catch (refreshErr) {
        options.onAuthFailed();
        throw refreshErr;
      }
    }

    if (isUnauthorized) {
      options.onAuthFailed();
    }
    throw error;
  }
}
