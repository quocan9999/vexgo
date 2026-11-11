'use client';

import { ArrowRight, BusFront, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useAdminSession } from '../hooks/use-admin-session';
import {
  AdminAuthError,
  getAdminAuthErrorMessage,
  initializeAdminSession,
  signInAdmin,
} from '../services/admin-auth';
import { getFirstAccessibleAdminPath } from '../services/admin-access';
import { Button } from '@/components/ui/action-button';
import { Input } from '@/components/ui/input';
import { Field, FieldLabel } from '@/components/ui/field';
import { AdminLanguageSwitcher } from '@/components/admin/admin-language-switcher';
import { useTranslations } from 'next-intl';

export function AdminLoginForm() {
  const router = useRouter();
  const authState = useAdminSession();
  const tAuth = useTranslations('auth');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const [validationDetails, setValidationDetails] = useState<
    Array<{ field: string; message: string }>
  >([]);
  const hasFieldError = (field: string) =>
    validationDetails.some((detail) => detail.field === field);

  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  useEffect(() => {
    void initializeAdminSession().catch(() => undefined);
  }, []);

  useEffect(() => {
    if (authState.status !== 'authenticated') return;
    router.replace(getFirstAccessibleAdminPath(authState.session) ?? '/');
  }, [authState, router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setValidationDetails([]);

    const normalizedIdentifier = identifier.trim();
    if (!normalizedIdentifier || !password) {
      setError(tAuth('loginRequired'));
      return;
    }

    setSubmitting(true);
    try {
      const session = await signInAdmin(normalizedIdentifier, password);
      router.replace(getFirstAccessibleAdminPath(session) ?? '/');
    } catch (caught) {
      setError(getAdminAuthErrorMessage(caught));
      if (caught instanceof AdminAuthError) {
        setValidationDetails(caught.details);
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (authState.status === 'checking') {
    return (
      <div className="auth-loading" role="status" aria-live="polite">
        <span className="auth-loading-mark" aria-hidden="true">V</span>
        <span>{tAuth('checkingSession')}</span>
      </div>
    );
  }

  return (
    <main className="admin-ui login-layout">
      <section className="login-showcase" aria-label="VexGo Admin">
        <Link aria-label="VexGo Admin" className="login-brand" href="/login">
          <span className="login-brand-mark" aria-hidden="true">V</span>
          <span>
            <strong>VexGo</strong>
            <small>ADMIN</small>
          </span>
        </Link>

        <div className="login-showcase-copy">
          <span className="login-kicker">
            <ShieldCheck size={15} aria-hidden="true" /> QUẢN TRỊ VEXGO
          </span>
          <h1>{tAuth('loginShowcaseTitle')}</h1>
          <p>{tAuth('loginShowcaseSubtitle')}</p>
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
          <span>{tAuth('secureLogin')}</span>
          <span className="showcase-footer-dot" />
          <span>{tAuth('scopeByRole')}</span>
        </div>
      </section>

      <section className="login-panel" aria-labelledby="login-title">
        <div className="login-panel-inner">
          <div className="flex justify-end mb-2">
            <AdminLanguageSwitcher />
          </div>

          <div className="login-heading">
            <p className="login-eyebrow">{tAuth('welcomeBack')}</p>
            <h2 id="login-title">{tAuth('loginTitle')}</h2>
            <p>{tAuth('loginSubtitle')}</p>
          </div>

          <form
            aria-busy={submitting}
            className="login-form"
            onSubmit={handleSubmit}
          >
            {authState.status === 'error' && (
              <p className="login-error" role="status">
                {tAuth('sessionCheckError')}
              </p>
            )}
            <Field>
              <FieldLabel htmlFor="admin-identifier">{tAuth('emailOrPhone')}</FieldLabel>
              <Input
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                id="admin-identifier"
                aria-describedby={hasFieldError('identifier') ? 'admin-login-error' : undefined}
                aria-invalid={hasFieldError('identifier') || undefined}
                maxLength={150}
                name="identifier"
                onChange={(event) => {
                  setIdentifier(event.target.value);
                  setError(null);
                  setValidationDetails([]);
                }}
                placeholder={tAuth('emailOrPhonePlaceholder')}
                required
                type="text"
                value={identifier}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="admin-password">{tAuth('password')}</FieldLabel>
              <div className="relative">
                <Input
                  className="pr-12"
                  autoComplete="current-password"
                  id="admin-password"
                  aria-describedby={hasFieldError('password') ? 'admin-login-error' : undefined}
                  aria-invalid={hasFieldError('password') || undefined}
                  maxLength={72}
                  name="password"
                  onChange={(event) => {
                    setPassword(event.target.value);
                    setError(null);
                    setValidationDetails([]);
                  }}
                  placeholder={tAuth('passwordPlaceholder')}
                  required
                  type={passwordVisible ? 'text' : 'password'}
                  value={password}
                />
                <Button
                  aria-label={passwordVisible ? tAuth('hidePassword') : tAuth('showPassword')}
                  aria-pressed={passwordVisible}
                  className="absolute right-0 top-0 text-muted-foreground"
                  variant="ghost"
                  size="icon"
                  onClick={() => setPasswordVisible((visible) => !visible)}
                  type="button"
                >
                  {passwordVisible ? (
                    <EyeOff aria-hidden="true" size={17} />
                  ) : (
                    <Eye aria-hidden="true" size={17} />
                  )}
                </Button>
              </div>
            </Field>

            {error && (
              <div
                className="login-error rounded-md focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-4"
                id="admin-login-error"
                role="alert"
                ref={errorRef}
                tabIndex={-1}
              >
                <p>{error}</p>
                {validationDetails.length > 0 && (
                  <ul>
                    {validationDetails.map((detail, index) => (
                      <li key={`${detail.field}-${index}`}>
                        {detail.field}: {detail.message}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <Button
              className="w-full justify-between"
              disabled={submitting}
              type="submit"
            >
              <span>{submitting ? tAuth('loggingIn') : tAuth('signIn')}</span>
              <ArrowRight aria-hidden="true" size={17} />
            </Button>
          </form>
        </div>
      </section>
    </main>
  );
}
