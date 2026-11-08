export const RESET_PASSWORD_PATH = '/account/profile/password' as const;

export const ACCOUNT_NAVIGATION_ITEMS = [
  { id: 'profile', label: 'Thông tin tài khoản', href: '/account/profile', aliases: ['/profile'] },
  { id: 'history', label: 'Vé của tôi', href: '/account/tickets', aliases: ['/my-posts'] },
  { id: 'shipments', label: 'Đơn gửi hàng', href: '/account/shipments', aliases: [] },
  { id: 'security', label: 'Đặt lại mật khẩu', href: RESET_PASSWORD_PATH, aliases: ['/profile/password'] },
] as const;

export type AccountNavigationItem = (typeof ACCOUNT_NAVIGATION_ITEMS)[number];

function stripLocale(pathname: string | null | undefined): string {
  if (!pathname) return '/';
  const match = pathname.match(/^\/(vi|en)(\/.*|$)/);
  if (match) return match[2] || '/';
  return pathname;
}

export function isAccountNavigationItemActive(item: AccountNavigationItem, pathname: string) {
  const normalized = stripLocale(pathname);
  return item.href === normalized || item.aliases.some((alias) => alias === normalized);
}

export function getMobileMenuLabel(isOpen: boolean, locale: string = 'vi') {
  if (locale === 'en') {
    return isOpen ? 'Close menu' : 'Open menu';
  }
  return isOpen ? 'Đóng menu' : 'Mở menu';
}
