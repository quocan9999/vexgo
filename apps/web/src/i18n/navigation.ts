import * as nextNavigation from 'next/navigation';
import { createNavigation } from 'next-intl/navigation';
import { routing } from './routing';

const navRecord = nextNavigation as Record<string, unknown>;
if (typeof navRecord.redirect !== 'function') {
  navRecord.redirect = () => {};
}
if (typeof navRecord.permanentRedirect !== 'function') {
  navRecord.permanentRedirect = () => {};
}

export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
