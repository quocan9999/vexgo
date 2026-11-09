import * as nextNavigation from 'next/navigation';
import { createNavigation } from 'next-intl/navigation';
import { routing } from './routing';

const nav = nextNavigation as Record<string, unknown>;
if (typeof nav.redirect !== 'function') {
  nav.redirect = () => {};
}
if (typeof nav.permanentRedirect !== 'function') {
  nav.permanentRedirect = () => {};
}

export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
