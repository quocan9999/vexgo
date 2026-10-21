export const RESET_PASSWORD_PATH = '/account/profile/password' as const;

export const ACCOUNT_NAVIGATION_ITEMS = [
  { id: 'profile', label: 'Thông tin tài khoản', href: '/account/profile', aliases: ['/profile'] },
  { id: 'history', label: 'Vé của tôi', href: '/account/tickets', aliases: ['/my-posts'] },
  { id: 'security', label: 'Đặt lại mật khẩu', href: RESET_PASSWORD_PATH, aliases: ['/profile/password'] },
] as const;

export type AccountNavigationItem = (typeof ACCOUNT_NAVIGATION_ITEMS)[number];

export function isAccountNavigationItemActive(item: AccountNavigationItem, pathname: string) {
  return item.href === pathname || item.aliases.some((alias) => alias === pathname);
}

export function getMobileMenuLabel(isOpen: boolean) {
  return isOpen ? 'Đóng menu' : 'Mở menu';
}
