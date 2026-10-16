import 'reflect-metadata';
import {
  ForbiddenException,
  RequestMethod,
  UnauthorizedException,
  type ExecutionContext,
} from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import { describe, expect, it, vi } from 'vitest';
import { ThrottlerGuard } from '@nestjs/throttler';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { AUTH_MODE_KEY } from '../../../src/auth/decorators/public.decorator.js';
import { REQUIRED_PERMISSIONS_KEY } from '../../../src/auth/decorators/require-permissions.decorator.js';
import { REQUIRED_ROLES_KEY } from '../../../src/auth/decorators/require-roles.decorator.js';
import { TENANT_PERMISSIONS_IF_AUTHENTICATED_KEY } from '../../../src/auth/decorators/require-tenant-permissions-if-authenticated.decorator.js';
import { AuthorizationGuard } from '../../../src/auth/guards/authorization.guard.js';
import { TENANT_PRINCIPAL_ROLES } from '../../../src/auth/principal-scope.js';
import type { AuthPrincipal } from '../../../src/auth/tokens/auth-principal.js';
import { ShipmentsController } from '../../../src/shipments/shipments.controller.js';
import { ShipmentQueryDto } from '../../../src/shipments/dto/shipment-query.dto.js';
import type { ShipmentsService } from '../../../src/shipments/shipments.service.js';

vi.mock('../../../src/shipments/shipments.service.js', () => ({
  ShipmentsService: class ShipmentsService {},
}));

type Handler = (...args: never[]) => unknown;

function controllerHandler(name: string): Handler {
  const descriptor = Object.getOwnPropertyDescriptor(
    ShipmentsController.prototype,
    name,
  );
  if (!descriptor?.value)
    throw new Error(`Missing controller handler: ${name}`);
  return descriptor.value as Handler;
}

function handlerMetadata<T>(key: string, name: string): T | undefined {
  return Reflect.getMetadata(key, controllerHandler(name)) as T | undefined;
}

function principal(overrides: Partial<AuthPrincipal> = {}): AuthPrincipal {
  return {
    taiKhoanId: 10,
    sessionId: 'shipment-controller-test',
    roles: ['NHA_XE_ADMIN'],
    permissions: ['shipment:read'],
    nhanVienId: 20,
    nhaXeId: 7,
    ...overrides,
  };
}

function guardContext(
  handlerName: string,
  user?: AuthPrincipal,
): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
    getHandler: () => controllerHandler(handlerName),
    getClass: () => ShipmentsController,
  } as unknown as ExecutionContext;
}

function expectAuthorizationError(
  guard: AuthorizationGuard,
  context: ExecutionContext,
  exception: typeof ForbiddenException | typeof UnauthorizedException,
  errorCode: string,
) {
  let thrown: unknown;
  try {
    guard.canActivate(context);
  } catch (error) {
    thrown = error;
  }

  expect(thrown).toBeInstanceOf(exception);
  expect((thrown as ForbiddenException).getResponse()).toMatchObject({
    error: errorCode,
  });
}

describe('ShipmentsController route and authorization contract', () => {
  it('registers each Customer and Admin shipment method/path once', () => {
    const handlers = Object.getOwnPropertyNames(ShipmentsController.prototype)
      .map((name) => ({ name, handler: controllerHandler(name) }))
      .filter(({ handler }) => Reflect.hasMetadata(METHOD_METADATA, handler))
      .flatMap(({ handler }) => {
        const method = Reflect.getMetadata(
          METHOD_METADATA,
          handler,
        ) as RequestMethod;
        const metadataPath = Reflect.getMetadata(PATH_METADATA, handler) as
          string | string[];
        const paths = Array.isArray(metadataPath)
          ? metadataPath
          : [metadataPath];
        return paths.map((path) => {
          const normalizedPath =
            path === '/' || path === '' ? '(root)' : path.replace(/^\/+/, '');
          return `${method}|${normalizedPath}`;
        });
      });

    expect(Reflect.getMetadata(PATH_METADATA, ShipmentsController)).toBe(
      'shipments',
    );
    expect(handlers.sort()).toEqual(
      [
        `${RequestMethod.POST}|(root)`,
        `${RequestMethod.POST}|lookup`,
        `${RequestMethod.GET}|categories`,
        `${RequestMethod.GET}|trips/:tripId/route-points`,
        `${RequestMethod.GET}|(root)`,
        `${RequestMethod.GET}|:id`,
        `${RequestMethod.PATCH}|:id/status`,
      ].sort(),
    );
    expect(new Set(handlers).size).toBe(handlers.length);
  });

  it.each(['listShipments', 'getShipmentDetail'])(
    'allows tenant-scoped staff and customers to reach the owner-checking %s contract',
    (handlerName) => {
      expect(
        handlerMetadata<string[]>(REQUIRED_ROLES_KEY, handlerName),
      ).toEqual([...TENANT_PRINCIPAL_ROLES, 'KHACH_HANG']);
      expect(
        handlerMetadata<string[]>(
          TENANT_PERMISSIONS_IF_AUTHENTICATED_KEY,
          handlerName,
        ),
      ).toEqual(['shipment:read']);
      expect(
        handlerMetadata<string[]>(REQUIRED_PERMISSIONS_KEY, handlerName),
      ).toBeUndefined();
      expect(
        handlerMetadata<string>(AUTH_MODE_KEY, handlerName),
      ).toBeUndefined();
    },
  );

  it('authorizes an owner-capable customer and a permitted tenant, but rejects unscoped roles', () => {
    const guard = new AuthorizationGuard(new Reflector());

    expect(
      guard.canActivate(
        guardContext(
          'listShipments',
          principal({
            roles: ['KHACH_HANG'],
            permissions: [],
            nhanVienId: null,
            nhaXeId: null,
          }),
        ),
      ),
    ).toBe(true);
    expect(
      guard.canActivate(
        guardContext(
          'listShipments',
          principal({ permissions: ['shipment:read'] }),
        ),
      ),
    ).toBe(true);
    expect(
      guard.canActivate(
        guardContext(
          'listShipments',
          principal({
            roles: ['NHAN_VIEN_BAN_VE'],
            permissions: ['shipment:read'],
          }),
        ),
      ),
    ).toBe(true);

    expectAuthorizationError(
      guard,
      guardContext('listShipments', principal({ permissions: [] })),
      ForbiddenException,
      'PERMISSION_FORBIDDEN',
    );
    expectAuthorizationError(
      guard,
      guardContext(
        'listShipments',
        principal({
          roles: ['SUPER_ADMIN'],
          permissions: [],
          nhanVienId: null,
          nhaXeId: null,
        }),
      ),
      ForbiddenException,
      'ROLE_FORBIDDEN',
    );
    expectAuthorizationError(
      guard,
      guardContext('listShipments'),
      UnauthorizedException,
      'ACCESS_TOKEN_INVALID',
    );
  });

  it('restricts status updates to tenant staff with shipment:update', () => {
    expect(
      handlerMetadata<string[]>(REQUIRED_ROLES_KEY, 'updateStatus'),
    ).toEqual([...TENANT_PRINCIPAL_ROLES]);
    expect(
      handlerMetadata<string[]>(REQUIRED_PERMISSIONS_KEY, 'updateStatus'),
    ).toEqual(['shipment:update']);

    const guard = new AuthorizationGuard(new Reflector());
    expect(
      guard.canActivate(
        guardContext(
          'updateStatus',
          principal({ permissions: ['shipment:update'] }),
        ),
      ),
    ).toBe(true);
    expectAuthorizationError(
      guard,
      guardContext(
        'updateStatus',
        principal({
          roles: ['KHACH_HANG'],
          permissions: ['shipment:update'],
          nhanVienId: null,
          nhaXeId: null,
        }),
      ),
      ForbiddenException,
      'ROLE_FORBIDDEN',
    );
    expectAuthorizationError(
      guard,
      guardContext(
        'updateStatus',
        principal({ permissions: ['shipment:read'] }),
      ),
      ForbiddenException,
      'PERMISSION_FORBIDDEN',
    );
  });

  it('keeps create, lookup, category and route-point endpoints optional-auth', () => {
    for (const name of [
      'createShipment',
      'lookupShipment',
      'getCargoCategories',
      'getRoutePoints',
    ]) {
      expect(handlerMetadata<string>(AUTH_MODE_KEY, name)).toBe('optional');
    }

    const lookupGuards = handlerMetadata<Function[]>(
      GUARDS_METADATA,
      'lookupShipment',
    );
    expect(lookupGuards).toContain(ThrottlerGuard);
  });

  it('preserves Admin and Customer response envelopes through their scoped service methods', async () => {
    const adminList = {
      data: [{ shipmentId: 101, status: 'MOI_TAO' }],
      meta: { page: 1, pageSize: 10, totalItems: 1, totalPages: 1 },
    };
    const customerList = {
      data: [{ waybillCode: 'VG-OWNER-101', status: 'MOI_TAO' }],
      meta: { page: 1, pageSize: 10, totalItems: 1, totalPages: 1 },
    };
    const adminDetail = { data: { shipmentId: 101, cargoItems: [] } };
    const customerDetail = { waybillCode: 'VG-OWNER-101', items: [] };
    const service = {
      findAll: vi.fn().mockResolvedValue(adminList),
      findOne: vi.fn().mockResolvedValue(adminDetail),
      listShipments: vi.fn().mockResolvedValue(customerList),
      getShipmentDetail: vi.fn().mockResolvedValue(customerDetail),
    };
    const controller = new ShipmentsController(
      service as unknown as ShipmentsService,
    );
    const query = new ShipmentQueryDto();
    const tenant = principal();
    const customer = principal({
      roles: ['KHACH_HANG'],
      permissions: [],
      nhanVienId: null,
      nhaXeId: null,
    });

    await expect(controller.listShipments(query, tenant)).resolves.toBe(
      adminList,
    );
    await expect(controller.listShipments(query, customer)).resolves.toBe(
      customerList,
    );
    await expect(controller.getShipmentDetail(101, tenant)).resolves.toBe(
      adminDetail,
    );
    await expect(controller.getShipmentDetail(101, customer)).resolves.toEqual({
      data: customerDetail,
    });

    expect(service.findAll).toHaveBeenCalledWith(query, tenant);
    expect(service.listShipments).toHaveBeenCalledWith(query, customer);
    expect(service.findOne).toHaveBeenCalledWith(101, tenant);
    expect(service.getShipmentDetail).toHaveBeenCalledWith(101, customer);
  });
});
