// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { AnchorHTMLAttributes } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AdminAuthError } from '@/features/admin-auth/services/admin-auth';
import { AdminLoginForm } from '@/features/admin-auth/components/admin-login-form';
import { setAdminTestSession } from './admin-auth-test-session';

const { mockReplace, mockSignIn } = vi.hoisted(() => ({
  mockReplace: vi.fn(),
  mockSignIn: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

vi.mock('@/features/admin-auth/services/admin-auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/admin-auth/services/admin-auth')>();
  return {
    ...actual,
    initializeAdminSession: vi.fn(async () => null),
    signInAdmin: mockSignIn,
  };
});

function setAnonymousSession() {
  setAdminTestSession({ status: 'anonymous' });
}

describe('Admin login form', () => {
  afterEach(() => {
    cleanup();
    mockReplace.mockReset();
    mockSignIn.mockReset();
  });

  it('does not show demo credentials or preview controls', () => {
    setAnonymousSession();
    render(<AdminLoginForm />);

    expect(screen.getByLabelText('Email hoặc số điện thoại')).toBeTruthy();
    expect(screen.getByLabelText('Mật khẩu')).toBeTruthy();
    expect(screen.queryByText(/demo|xem trước/i)).toBeNull();
    expect(screen.queryByRole('button', { name: /dùng thử/i })).toBeNull();
  });

  it('sends a valid tenant login to the operation area', async () => {
    setAnonymousSession();
    mockSignIn.mockResolvedValueOnce({
      accountId: 2,
      fullName: 'Quản lý FUTA',
      phoneNumber: '+84900000002',
      email: 'futa@vexgo.test',
      roles: ['NHA_XE_ADMIN'],
      permissions: ['vehicle-type:read'],
      employee: {
        employeeId: 1,
        busCompanyId: 10,
        busCompanyCode: 'FUTA',
        busCompanyName: 'FUTA',
      },
      busCompanyId: 10,
    });
    render(<AdminLoginForm />);

    fireEvent.change(screen.getByLabelText('Email hoặc số điện thoại'), {
      target: { value: 'futa@vexgo.test' },
    });
    fireEvent.change(screen.getByLabelText('Mật khẩu'), {
      target: { value: 'password-123' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }));

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/vehicle-types'));
    expect(mockSignIn).toHaveBeenCalledWith('futa@vexgo.test', 'password-123');
  });

  it('routes an employee-only account to its first page with read permission', async () => {
    setAnonymousSession();
    mockSignIn.mockResolvedValueOnce({
      accountId: 3,
      fullName: 'Nhân viên CSKH',
      phoneNumber: '+84900000003',
      email: 'cskh@vexgo.test',
      roles: ['NHAN_VIEN_CSKH'],
      permissions: ['fare-price:read'],
      employee: {
        employeeId: 3,
        busCompanyId: 12,
        busCompanyCode: 'THANHBUOI',
        busCompanyName: 'Thành Bưởi',
      },
      busCompanyId: 12,
    });
    render(<AdminLoginForm />);

    fireEvent.change(screen.getByLabelText('Email hoặc số điện thoại'), {
      target: { value: 'cskh@vexgo.test' },
    });
    fireEvent.change(screen.getByLabelText('Mật khẩu'), {
      target: { value: 'password-123' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }));

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/fare-prices'));
  });

  it('announces API validation errors on the matching fields', async () => {
    setAnonymousSession();
    mockSignIn.mockRejectedValueOnce(new AdminAuthError(
      'Dữ liệu không hợp lệ.',
      400,
      'VALIDATION_ERROR',
      [{ field: 'identifier', message: 'Email hoặc số điện thoại không hợp lệ.' }],
    ));
    render(<AdminLoginForm />);

    fireEvent.change(screen.getByLabelText('Email hoặc số điện thoại'), {
      target: { value: 'invalid' },
    });
    fireEvent.change(screen.getByLabelText('Mật khẩu'), {
      target: { value: 'password-123' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }));

    const identifier = await screen.findByLabelText('Email hoặc số điện thoại');
    expect(identifier.getAttribute('aria-invalid')).toBe('true');
    expect(identifier.getAttribute('aria-describedby')).toBe('admin-login-error');
    expect(screen.getByRole('alert').textContent).toContain('không hợp lệ');
  });

  it('routes a successful Super Admin login to platform overview', async () => {
    setAnonymousSession();
    mockSignIn.mockResolvedValueOnce({
      accountId: 1,
      fullName: 'Super Admin',
      phoneNumber: '+84900000001',
      email: 'root@vexgo.test',
      roles: ['SUPER_ADMIN'],
      permissions: [],
      employee: null,
      busCompanyId: null,
    });
    render(<AdminLoginForm />);
    fireEvent.change(screen.getByLabelText('Email hoặc số điện thoại'), {
      target: { value: 'root@vexgo.test' },
    });
    fireEvent.change(screen.getByLabelText('Mật khẩu'), {
      target: { value: 'password-123' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }));

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/'));
  });
});
