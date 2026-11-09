import * as nextNavigation from 'next/navigation';
import { createNavigation } from 'next-intl/navigation';
import { routing } from './routing';

if (typeof (nextNavigation as any).redirect !== 'function') {
  (nextNavigation as any).redirect = () => {};
}
if (typeof (nextNavigation as any).permanentRedirect !== 'function') {
  (nextNavigation as any).permanentRedirect = () => {};
}

export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
