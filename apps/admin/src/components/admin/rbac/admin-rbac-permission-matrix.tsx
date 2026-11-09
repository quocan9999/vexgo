'use client';

import { useTranslations } from 'next-intl';

import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { ResourceNotice, ResourceState } from '@/components/admin/resource-ui';
import type { ReactNode } from 'react';

export type AdminRbacPermissionOption = {
  key: string;
  scope: 'platform' | 'tenant';
  description: string;
};

type AdminRbacPermissionMatrixProps = {
  appearance?: 'resource';
  actions?: ReactNode;
  disabled: boolean;
  isProtected: boolean;
  onPermissionChange: (permissionKey: string, checked: boolean) => void;
  permissions: readonly AdminRbacPermissionOption[];
  roleName: string;
  scope: 'platform' | 'tenant';
  selectedKeys: readonly string[];
};

const RESOURCE_KEYS: Record<string, string> = {
  'admin-account': 'resourceAdminAccount',
  'bus-company': 'resourceBusCompany',
  'fare-price': 'resourceFarePrice',
  permission: 'resourcePermission',
  role: 'resourceRole',
  route: 'resourceRoute',
  seat: 'resourceSeat',
  vehicle: 'resourceVehicle',
  'vehicle-type': 'resourceVehicleType',
  trip: 'resourceTrip',
  customer: 'resourceCustomer',
  booking: 'resourceBooking',
  revenue: 'resourceRevenue',
  promotion: 'resourcePromotion',
  shipment: 'resourceShipment',
  chat: 'resourceChat',
};

const ACTION_KEYS: Record<string, string> = {
  assign: 'actionAssign',
  create: 'actionCreate',
  delete: 'actionDelete',
  read: 'actionRead',
  update: 'actionUpdate',
  cancel: 'actionCancel',
  manage: 'actionManage',
};

function getPermissionGroups(
  permissions: readonly AdminRbacPermissionOption[],
  tRbac: (k: any) => string,
) {
  const groups = new Map<string, AdminRbacPermissionOption[]>();
  for (const permission of permissions) {
    const [resource] = permission.key.split(':');
    const group = groups.get(resource) ?? [];
    group.push(permission);
    groups.set(resource, group);
  }

  return [...groups].map(([resource, items]) => ({
    resource,
    label: RESOURCE_KEYS[resource] ? tRbac(RESOURCE_KEYS[resource] as any) : resource,
    permissions: items,
  }));
}

function getPermissionActionLabel(permissionKey: string, tRbac: (k: any) => string): string {
  const action = permissionKey.split(':')[1];
  return ACTION_KEYS[action] ? tRbac(ACTION_KEYS[action] as any) : action ?? permissionKey;
}

export function AdminRbacPermissionMatrix({
  actions,
  disabled,
  isProtected,
  onPermissionChange,
  permissions,
  roleName,
  scope,
  selectedKeys,
}: AdminRbacPermissionMatrixProps) {
  const tRbac = useTranslations('rbac');
  const permissionGroups = getPermissionGroups(
    permissions.filter((permission) => permission.scope === scope),
    tRbac,
  );

  return (
    <Card
      role="region"
      aria-labelledby="rbac-permissions-title"
      className="min-w-0 gap-5 p-4 sm:p-5"
    >
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 space-y-2">
          <p className="text-xs font-medium text-muted-foreground">
            {scope === 'platform' ? tRbac('scopePlatformBanner') : tRbac('scopeTenantBanner')}
          </p>
          <h2
            id="rbac-permissions-title"
            className="text-base font-semibold break-words"
          >
            {tRbac('permissionsFor', { role: roleName })}
          </h2>
        </div>
        {isProtected && (
          <ResourceNotice kind="info">
            {tRbac('protectedRoleNotice')}
          </ResourceNotice>
        )}
      </div>
      {isProtected && (
        <ResourceNotice kind="info">
          {tRbac('protectedRoleCannotEditNotice')}
        </ResourceNotice>
      )}
      {permissionGroups.length === 0 ? (
        <ResourceState>{tRbac('noPermissionsInScope')}</ResourceState>
      ) : (
        <div className="grid min-w-0 items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
          {permissionGroups.map((group) => (
            <section
              key={group.resource}
              aria-labelledby={`rbac-group-${group.resource}`}
              className="min-w-0 rounded-lg border"
            >
              <h3
                id={`rbac-group-${group.resource}`}
                className="border-b bg-muted/30 px-4 py-3 text-[13px] font-semibold"
              >
                {group.label}
              </h3>
              <div className="divide-y">
                {group.permissions.map((permission) => (
                  <label
                    key={permission.key}
                    className="flex min-h-11 min-w-0 cursor-pointer items-start gap-3 p-4 hover:bg-muted/30 has-data-disabled:cursor-not-allowed has-data-disabled:opacity-60"
                  >
                    <Checkbox
                      className="mt-0.5"
                      aria-label={tRbac('assignPermissionAriaLabel', {
                        key: permission.key,
                        role: roleName,
                      })}
                      checked={selectedKeys.includes(permission.key)}
                      disabled={disabled || isProtected}
                      onCheckedChange={(checked) =>
                        onPermissionChange(permission.key, checked)
                      }
                    />
                    <span className="grid min-w-0 gap-1 text-[13px]">
                      <strong className="font-medium">
                        {getPermissionActionLabel(permission.key, tRbac)}
                      </strong>
                      <code className="admin-data-mono break-all text-xs text-muted-foreground">
                        {permission.key}
                      </code>
                      <span className="text-xs text-muted-foreground">
                        {permission.description}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
      {actions}
    </Card>
  );
}
