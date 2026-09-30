const AUTH_TRANSPORT_LOCK_NAME = 'vexgo-admin-auth-transport';

export async function withAdminAuthTransportLock<T>(
  operation: () => Promise<T>,
): Promise<T> {
  if (typeof navigator === 'undefined' || !navigator.locks) {
    return operation();
  }

  return navigator.locks.request(
    AUTH_TRANSPORT_LOCK_NAME,
    { mode: 'exclusive' },
    operation,
  );
}
