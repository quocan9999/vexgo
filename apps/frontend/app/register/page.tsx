import RegisterClientPage from '@/modules/auth/pages/RegisterClientPage';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Đăng ký tài khoản — BusWay',
  description: 'Đăng ký tài khoản miễn phí để kết nối nhu cầu vé xe online uy tín, chất lượng',
};

export default function RegisterPage() {
  return <RegisterClientPage />;
}
