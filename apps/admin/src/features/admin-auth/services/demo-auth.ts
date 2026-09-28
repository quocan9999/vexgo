export const DEMO_SUPER_ADMIN = {
  email: 'superadmin@vexgo.test',
  password: 'VexGo@123456',
  name: 'Super Admin',
  role: 'SUPER_ADMIN',
} as const;

const SESSION_KEY = 'vexgo.super-admin.demo-session';
const TENANT_PREVIEW_KEY = 'vexgo.tenant.demo-preview';
const SESSION_VALUE = 'authenticated';
const SESSION_CHANGE_EVENT = 'vexgo:super-admin-demo-session-change';

export type DemoAdminSessionStatus =
  | 'checking'
  | 'authenticated'
  | 'tenant-preview'
  | 'anonymous';

export function subscribeToDemoAdminSession(onChange: () => void) {
  if (typeof window === 'undefined') return () => {};

  window.addEventListener(SESSION_CHANGE_EVENT, onChange);
  return () => window.removeEventListener(SESSION_CHANGE_EVENT, onChange);
}

export function getDemoAdminSessionSnapshot():
  | 'authenticated'
  | 'tenant-preview'
  | 'anonymous' {
  if (hasDemoAdminSession()) return 'authenticated';
  if (hasTenantDemoPreview()) return 'tenant-preview';
  return 'anonymous';
}

export function getDemoAdminServerSnapshot(): DemoAdminSessionStatus {
  return 'checking';
}

function notifyDemoAdminSessionChange() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(SESSION_CHANGE_EVENT));
  }
}

export function hasDemoAdminSession() {
  return (
    typeof window !== 'undefined' &&
    window.sessionStorage.getItem(SESSION_KEY) === SESSION_VALUE
  );
}

function hasTenantDemoPreview() {
  return (
    typeof window !== 'undefined' &&
    window.sessionStorage.getItem(TENANT_PREVIEW_KEY) === SESSION_VALUE
  );
}

export function signInDemoAdmin(email: string, password: string) {
  const isValid =
    email.trim().toLocaleLowerCase('vi') === DEMO_SUPER_ADMIN.email &&
    password === DEMO_SUPER_ADMIN.password;

  if (isValid && typeof window !== 'undefined') {
    window.sessionStorage.removeItem(TENANT_PREVIEW_KEY);
    window.sessionStorage.setItem(SESSION_KEY, SESSION_VALUE);
    notifyDemoAdminSessionChange();
  }

  return isValid;
}

export function signInTenantPreview() {
  if (typeof window !== 'undefined') {
    window.sessionStorage.removeItem(SESSION_KEY);
    window.sessionStorage.setItem(TENANT_PREVIEW_KEY, SESSION_VALUE);
    notifyDemoAdminSessionChange();
  }
}

export function signOutDemoAdmin() {
  if (typeof window !== 'undefined') {
    window.sessionStorage.removeItem(SESSION_KEY);
    window.sessionStorage.removeItem(TENANT_PREVIEW_KEY);
    notifyDemoAdminSessionChange();
  }
}
