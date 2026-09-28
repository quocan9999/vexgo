import LoginClientPage from '@/modules/auth/pages/LoginClientPage';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Đăng nhập — BusWay',
  description: 'Đăng nhập vào hệ thống vé xe online uy tín, chất lượng',
};

export default function LoginPage() {
  return <LoginClientPage />;
}
