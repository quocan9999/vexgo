'use client';

import { useSyncExternalStore } from 'react';
import {
  getDemoAdminServerSnapshot,
  getDemoAdminSessionSnapshot,
  subscribeToDemoAdminSession,
  type DemoAdminSessionStatus,
} from '../services/demo-auth';

export function useDemoAdminSession() {
  return useSyncExternalStore<DemoAdminSessionStatus>(
    subscribeToDemoAdminSession,
    getDemoAdminSessionSnapshot,
    getDemoAdminServerSnapshot,
  );
}
