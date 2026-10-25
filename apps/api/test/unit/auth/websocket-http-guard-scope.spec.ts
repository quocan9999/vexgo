import { describe, expect, it, vi } from 'vitest';
import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthorizationGuard } from '../../../src/auth/guards/authorization.guard.js';

describe('HTTP authorization guard transport scope', () => {
  it('does not dereference an HTTP request for a Socket.IO command', () => {
    const switchToHttp = vi.fn(() => {
      throw new Error('Not an HTTP context');
    });
    const context = {
      getType: () => 'ws',
      switchToHttp,
    } as unknown as ExecutionContext;
    expect(new AuthorizationGuard(new Reflector()).canActivate(context)).toBe(
      true,
    );
    expect(switchToHttp).not.toHaveBeenCalled();
  });
});
