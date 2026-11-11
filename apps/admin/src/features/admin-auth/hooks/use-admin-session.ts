'use client';

import { useSyncExternalStore } from 'react';
import {
  getAdminAuthServerSnapshot,
  getAdminAuthSnapshot,
  subscribeToAdminAuth,
} from '../services/admin-auth';

export function useAdminSession() {
  return useSyncExternalStore(
    subscribeToAdminAuth,
    getAdminAuthSnapshot,
    getAdminAuthServerSnapshot,
  );
}
