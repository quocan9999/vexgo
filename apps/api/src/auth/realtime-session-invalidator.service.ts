import { Injectable, Logger } from '@nestjs/common';

export interface RealtimeInvalidationHandler {
  invalidateSession(sessionId: string, reason?: string): Promise<void>;
  invalidateAccount(taiKhoanId: number, reason?: string): Promise<void>;
  revalidateAccount(taiKhoanId: number): Promise<void>;
  revalidateRole(roleName: string): Promise<void>;
  revalidateTenantRole(nhaXeId: number, roleName?: string): Promise<void>;
}

@Injectable()
export class RealtimeSessionInvalidatorService {
  private readonly logger = new Logger(RealtimeSessionInvalidatorService.name);
  private readonly handlers = new Set<RealtimeInvalidationHandler>();

  registerHandler(handler: RealtimeInvalidationHandler): () => void {
    this.handlers.add(handler);
    return () => {
      this.handlers.delete(handler);
    };
  }

  async invalidateSession(sessionId: string, reason = 'SESSION_REVOKED'): Promise<void> {
    for (const handler of this.handlers) {
      try {
        await handler.invalidateSession(sessionId, reason);
      } catch (error) {
        this.logger.error(`Failed to invalidate realtime session ${sessionId}:`, error);
      }
    }
  }

  async invalidateAccount(taiKhoanId: number, reason = 'ACCOUNT_INACTIVE'): Promise<void> {
    for (const handler of this.handlers) {
      try {
        await handler.invalidateAccount(taiKhoanId, reason);
      } catch (error) {
        this.logger.error(`Failed to invalidate realtime account ${taiKhoanId}:`, error);
      }
    }
  }

  async revalidateAccount(taiKhoanId: number): Promise<void> {
    for (const handler of this.handlers) {
      try {
        await handler.revalidateAccount(taiKhoanId);
      } catch (error) {
        this.logger.error(`Failed to revalidate realtime account ${taiKhoanId}:`, error);
      }
    }
  }

  async revalidateRole(roleName: string): Promise<void> {
    for (const handler of this.handlers) {
      try {
        await handler.revalidateRole(roleName);
      } catch (error) {
        this.logger.error(`Failed to revalidate realtime role ${roleName}:`, error);
      }
    }
  }

  async revalidateTenantRole(nhaXeId: number, roleName?: string): Promise<void> {
    for (const handler of this.handlers) {
      try {
        await handler.revalidateTenantRole(nhaXeId, roleName);
      } catch (error) {
        this.logger.error(
          `Failed to revalidate realtime tenant role nhaXeId=${nhaXeId}, role=${roleName ?? '*'}:`,
          error,
        );
      }
    }
  }
}
