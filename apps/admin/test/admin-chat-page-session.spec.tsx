// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import SupportChatPage from '../src/app/support-chat/page';
import * as adminAuth from '../src/features/admin-auth/services/admin-auth';
import { setAdminTestSession, setEmployeeAdminTestSession } from './admin-auth-test-session';

const navigation = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => navigation, usePathname: () => '/support-chat' }));
vi.mock('../src/features/super-admin-layout/components/super-admin-layout', () => ({
  SuperAdminLayout: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock('../src/features/support-chat/components/admin-chat-messenger', () => ({
  AdminChatMessenger: () => <div>QA chat inbox</div>,
}));

afterEach(() => { cleanup(); vi.restoreAllMocks(); navigation.replace.mockReset(); });

describe('Direct support-chat route session recovery', () => {
  it('initializes a checking session and renders the inbox once restored', async () => {
    setAdminTestSession({ status: 'checking' });
    const initialize = vi.spyOn(adminAuth, 'initializeAdminSession').mockResolvedValue(null);
    render(<SupportChatPage />);
    await waitFor(() => expect(initialize).toHaveBeenCalled());
    expect(screen.getByText('Đang kiểm tra phiên quản trị…')).toBeTruthy();
    expect(screen.queryByText('QA chat inbox')).toBeNull();
    act(() => setEmployeeAdminTestSession(['chat:manage']));
    expect(await screen.findByText('QA chat inbox')).toBeTruthy();
  });

  it('redirects an anonymous direct load to login without mounting the inbox', async () => {
    setAdminTestSession({ status: 'anonymous' });
    vi.spyOn(adminAuth, 'initializeAdminSession').mockResolvedValue(null);
    render(<SupportChatPage />);
    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith('/login'));
    expect(screen.queryByText('QA chat inbox')).toBeNull();
  });
});
