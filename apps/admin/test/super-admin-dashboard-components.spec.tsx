// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import type { AnchorHTMLAttributes } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PlatformQuickActions } from '../src/features/super-admin-dashboard/components/platform-quick-actions';

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

describe('Platform Quick Actions Component', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders 4 platform quick action links with correct titles and descriptions', () => {
    render(<PlatformQuickActions />);

    expect(screen.getByText('Lối tắt quản trị sàn')).toBeDefined();

    // 1. Quản lý nhà xe
    expect(screen.getByText('Quản lý nhà xe')).toBeDefined();
    expect(screen.getByText('Thêm & kiểm duyệt đối tác nhà xe')).toBeDefined();

    // 2. Tài khoản quản trị
    expect(screen.getByText('Tài khoản quản trị')).toBeDefined();
    expect(screen.getByText('Cấp tài khoản & quản lý nhân sự')).toBeDefined();

    // 3. Phân quyền nền tảng
    expect(screen.getByText('Phân quyền nền tảng')).toBeDefined();
    expect(screen.getByText('Ma trận vai trò & quyền hạn RBAC')).toBeDefined();

    // 4. Kiểm duyệt đánh giá
    expect(screen.getByText('Kiểm duyệt đánh giá')).toBeDefined();
    expect(screen.getByText('Phản hồi & giải quyết khiếu nại')).toBeDefined();
  });
});
