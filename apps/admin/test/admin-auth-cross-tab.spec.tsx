// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

type MessageListener = (event: MessageEvent<unknown>) => void;

const broadcastChannels = new Map<string, Set<FakeBroadcastChannel>>();
let originalBroadcastChannelDescriptor: PropertyDescriptor | undefined;
let originalLockDescriptor: PropertyDescriptor | undefined;

class FakeBroadcastChannel {
  private readonly listeners = new Set<MessageListener>();

  constructor(private readonly name: string) {
    const peers = broadcastChannels.get(name) ?? new Set();
    peers.add(this);
    broadcastChannels.set(name, peers);
  }

  addEventListener(_type: 'message', listener: MessageListener) {
    this.listeners.add(listener);
  }

  removeEventListener(_type: 'message', listener: MessageListener) {
    this.listeners.delete(listener);
  }

  postMessage(data: unknown) {
    for (const peer of broadcastChannels.get(this.name) ?? []) {
      if (peer === this) continue;
      queueMicrotask(() => {
        peer.listeners.forEach((listener) =>
          listener({ data } as MessageEvent<unknown>),
        );
      });
    }
  }

  close() {
    broadcastChannels.get(this.name)?.delete(this);
    this.listeners.clear();
  }
}

function createSharedLockManager() {
  let tail = Promise.resolve();
  return {
    request: vi.fn(
      async (
        _name: string,
        _options: { mode: 'exclusive' },
        callback: () => Promise<unknown>,
      ) => {
        const previous = tail;
        let release!: () => void;
        tail = new Promise<void>((resolve) => {
          release = resolve;
        });
        await previous;
        try {
          return await callback();
        } finally {
          release();
        }
      },
    ),
  };
}

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function authResponse(accessToken: string) {
  return jsonResponse({ data: { accessToken } });
}

const tenantSession = {
  accountId: 20,
  fullName: 'Quản lý FUTA',
  phoneNumber: '+84900000020',
  email: 'admin@futa.test',
  roles: ['NHA_XE_ADMIN'],
  permissions: [],
  employee: {
    employeeId: 7,
    busCompanyId: 10,
    busCompanyCode: 'FUTA',
    busCompanyName: 'FUTA',
  },
  busCompanyId: 10,
};

describe('Admin authentication across browser tabs', () => {
  afterEach(() => {
    broadcastChannels.clear();
    if (originalBroadcastChannelDescriptor) {
      Object.defineProperty(
        window,
        'BroadcastChannel',
        originalBroadcastChannelDescriptor,
      );
    } else {
      Reflect.deleteProperty(window, 'BroadcastChannel');
    }
    if (originalLockDescriptor) {
      Object.defineProperty(navigator, 'locks', originalLockDescriptor);
    } else {
      Reflect.deleteProperty(navigator, 'locks');
    }
    originalBroadcastChannelDescriptor = undefined;
    originalLockDescriptor = undefined;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('rotates refresh once for simultaneous tab requests and propagates logout', async () => {
    vi.resetModules();
    process.env.NEXT_PUBLIC_API_URL = 'http://localhost:4000';
    vi.stubGlobal('BroadcastChannel', FakeBroadcastChannel);
    originalBroadcastChannelDescriptor = Object.getOwnPropertyDescriptor(
      window,
      'BroadcastChannel',
    );
    Object.defineProperty(window, 'BroadcastChannel', {
      configurable: true,
      value: FakeBroadcastChannel,
    });
    const lockManager = createSharedLockManager();
    originalLockDescriptor = Object.getOwnPropertyDescriptor(
      navigator,
      'locks',
    );
    Object.defineProperty(navigator, 'locks', {
      configurable: true,
      value: lockManager,
    });

    let refreshCount = 0;
    const routeTokens: Array<string | null> = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = new URL(
          typeof input === 'string'
            ? input
            : input instanceof URL
              ? input.href
              : input.url,
        );
        if (url.pathname.endsWith('/auth/login'))
          return authResponse('access-1');
        if (url.pathname.endsWith('/auth/session')) {
          return jsonResponse({ data: tenantSession });
        }
        if (url.pathname.endsWith('/auth/refresh')) {
          refreshCount += 1;
          await new Promise((resolve) => setTimeout(resolve, 5));
          return authResponse(`access-${refreshCount + 1}`);
        }
        if (url.pathname.endsWith('/auth/logout')) {
          return new Response(null, { status: 204 });
        }
        if (url.pathname.endsWith('/routes')) {
          const token = new Headers(init?.headers).get('Authorization');
          routeTokens.push(token);
          return token === 'Bearer access-1'
            ? new Response(null, { status: 401 })
            : jsonResponse({ data: [] });
        }
        return new Response(null, { status: 404 });
      }),
    );

    const firstAuth = await import('@/features/admin-auth/services/admin-auth');
    const firstApi = await import('@/lib/admin-api-client');
    vi.resetModules();
    const secondAuth =
      await import('@/features/admin-auth/services/admin-auth');
    const secondApi = await import('@/lib/admin-api-client');
    secondAuth.subscribeToAdminAuth(() => undefined);

    await firstAuth.signInAdmin('admin@futa.test', 'password-123');
    await new Promise((resolve) => setTimeout(resolve, 0));

    const [firstResponse, secondResponse] = await Promise.all([
      firstApi.adminApiFetch('http://localhost:4000/api/v1/routes'),
      secondApi.adminApiFetch('http://localhost:4000/api/v1/routes'),
    ]);

    expect({
      firstStatus: firstResponse.status,
      secondStatus: secondResponse.status,
      refreshCount,
      routeTokens,
      firstToken: firstAuth.getAdminAccessToken(),
      secondToken: secondAuth.getAdminAccessToken(),
    }).toEqual({
      firstStatus: 200,
      secondStatus: 200,
      refreshCount: 1,
      routeTokens: [
        'Bearer access-1',
        'Bearer access-1',
        'Bearer access-2',
        'Bearer access-2',
      ],
      firstToken: 'access-2',
      secondToken: 'access-2',
    });
    expect(firstResponse.status).toBe(200);
    expect(secondResponse.status).toBe(200);
    expect(refreshCount).toBe(1);
    expect(firstAuth.getAdminAccessToken()).toBe('access-2');
    expect(secondAuth.getAdminAccessToken()).toBe('access-2');

    await secondAuth.signOutAdmin();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(firstAuth.getAdminAuthSnapshot().status).toBe('anonymous');
    expect(firstAuth.getAdminAccessToken()).toBeNull();
    expect(secondAuth.getAdminAccessToken()).toBeNull();
    expect(lockManager.request).toHaveBeenCalled();
  });
});
