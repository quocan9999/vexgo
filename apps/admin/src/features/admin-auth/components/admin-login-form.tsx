'use client';

import { ArrowRight, BusFront, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import {
  DEMO_SUPER_ADMIN,
  signInDemoAdmin,
} from '../services/demo-auth';
import { useDemoAdminSession } from '../hooks/use-demo-admin-session';

export function AdminLoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState<string>(DEMO_SUPER_ADMIN.email);
  const [password, setPassword] = useState<string>(DEMO_SUPER_ADMIN.password);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sessionStatus = useDemoAdminSession();

  useEffect(() => {
    if (sessionStatus === 'authenticated') {
      router.replace('/');
    }
  }, [router, sessionStatus]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (signInDemoAdmin(email, password)) {
      router.replace('/');
      return;
    }

    setError('Email hoặc mật khẩu chưa chính xác. Vui lòng thử lại.');
  }

  if (sessionStatus !== 'anonymous') {
    return (
      <div className="auth-loading" role="status">
        <span className="auth-loading-mark" aria-hidden="true">
          V
        </span>
        <span>Đang mở cổng quản trị…</span>
      </div>
    );
  }

  return (
    <main className="login-layout">
      <section className="login-showcase" aria-label="VexGo Super Admin">
        <Link aria-label="VexGo Super Admin" className="login-brand" href="/login">
          <span className="login-brand-mark" aria-hidden="true">
            V
          </span>
          <span>
            <strong>VexGo</strong>
            <small>SUPER ADMIN</small>
          </span>
        </Link>

        <div className="login-showcase-copy">
          <span className="login-kicker">
            <ShieldCheck size={15} aria-hidden="true" /> QUẢN TRỊ NỀN TẢNG
          </span>
          <h1>Một điểm đến cho toàn hệ thống nhà xe.</h1>
          <p>
            Đăng nhập để theo dõi quy mô và quản lý các đối tác trên nền tảng
            VexGo.
          </p>
        </div>

        <div className="login-route-visual" aria-hidden="true">
          <div className="route-line" />
          <span className="route-stop route-stop-start" />
          <span className="route-stop route-stop-end" />
          <span className="route-bus-icon">
            <BusFront size={31} strokeWidth={1.6} />
          </span>
          <span className="route-label route-label-start">NHÀ XE</span>
          <span className="route-label route-label-end">VEXGO</span>
        </div>

        <div className="login-showcase-footer">
          <span>Quản trị thống nhất</span>
          <span className="showcase-footer-dot" />
          <span>Toàn nền tảng</span>
        </div>
      </section>

      <section className="login-panel" aria-labelledby="login-title">
        <div className="login-panel-inner">
          <div className="login-heading">
            <p className="login-eyebrow">CHÀO MỪNG TRỞ LẠI</p>
            <h2 id="login-title">Đăng nhập quản trị</h2>
            <p>Nhập thông tin tài khoản Super Admin để tiếp tục.</p>
          </div>

          <form className="login-form" onSubmit={handleSubmit}>
            <label className="login-field">
              <span>Email quản trị</span>
              <input
                autoComplete="username"
                autoCapitalize="none"
                id="admin-email"
                name="email"
                onChange={(event) => {
                  setEmail(event.target.value);
                  setError(null);
                }}
                placeholder="admin@vexgo.vn"
                required
                type="email"
                value={email}
              />
            </label>

            <label className="login-field">
              <span>Mật khẩu</span>
              <span className="password-input-wrap">
                <input
                  autoComplete="current-password"
                  id="admin-password"
                  name="password"
                  onChange={(event) => {
                    setPassword(event.target.value);
                    setError(null);
                  }}
                  required
                  type={passwordVisible ? 'text' : 'password'}
                  value={password}
                />
                <button
                  aria-label={passwordVisible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  className="password-visibility-button"
                  onClick={() => setPasswordVisible((visible) => !visible)}
                  type="button"
                >
                  {passwordVisible ? (
                    <EyeOff aria-hidden="true" size={17} />
                  ) : (
                    <Eye aria-hidden="true" size={17} />
                  )}
                </button>
              </span>
            </label>

            {error && (
              <p className="login-error" role="alert">
                {error}
              </p>
            )}

            <button className="login-submit-button" type="submit">
              <span>Vào trang quản trị</span>
              <ArrowRight aria-hidden="true" size={17} />
            </button>
          </form>

          <aside className="demo-account-card" aria-label="Tài khoản demo">
            <div className="demo-account-heading">
              <span className="demo-account-icon" aria-hidden="true">
                <ShieldCheck size={16} />
              </span>
              <div>
                <strong>Tài khoản dùng thử</strong>
                <span>Thông tin mẫu đã được điền sẵn</span>
              </div>
            </div>
            <dl>
              <div>
                <dt>Email</dt>
                <dd>{DEMO_SUPER_ADMIN.email}</dd>
              </div>
              <div>
                <dt>Mật khẩu</dt>
                <dd>{DEMO_SUPER_ADMIN.password}</dd>
              </div>
            </dl>
          </aside>

          <p className="login-demo-note">
            Đây là phiên trình diễn, chỉ lưu trong tab trình duyệt hiện tại.
          </p>
        </div>
      </section>
    </main>
  );
}
