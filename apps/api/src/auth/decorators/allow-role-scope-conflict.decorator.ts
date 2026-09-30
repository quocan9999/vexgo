import { SetMetadata } from '@nestjs/common';

export const ALLOW_ROLE_SCOPE_CONFLICT_KEY = 'auth:allow-role-scope-conflict';

/**
 * Allows a narrowly scoped identity endpoint to return a conflicted principal
 * so the client can show recovery actions such as logout.
 */
export const AllowRoleScopeConflict = () =>
  SetMetadata(ALLOW_ROLE_SCOPE_CONFLICT_KEY, true);
