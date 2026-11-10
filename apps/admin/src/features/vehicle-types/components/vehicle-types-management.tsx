'use client';

import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import {
  ResourceState,
  ResourceCreateAction,
  ResourceRefreshAction,
  ResourceDetailAction,
  ResourcePagination,
  ResourceTableSkeleton,
} from '@/components/admin/resource-ui';
import {
  FilterToolbar,
  SearchInput,
  SelectFilter,
} from '@/components/data-filters/resource-filters';
import { Button } from '@/components/ui/action-button';
import { Card } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useAdminPermissions } from '@/features/admin-auth/hooks/use-admin-permissions';
import { SuperAdminLayout } from '@/features/super-admin-layout/components/super-admin-layout';
import { useTranslations } from 'next-intl';
import type { VehicleTypeSortKey } from '../types/vehicle-type';
import { useVehicleTypes } from '../hooks/use-vehicle-types';
import { VehicleTypeFormDialog } from './vehicle-type-form-dialog';

function timestampFormat(value: string) {
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
    .format(new Date(value))
    .replaceAll('/', '-');
}

function sortLabel(
  field: VehicleTypeSortKey,
  currentField: VehicleTypeSortKey,
  direction: 'asc' | 'desc',
) {
  if (field !== currentField)
    return <ArrowUpDown aria-hidden="true" size={14} />;
  return direction === 'asc' ? (
    <ArrowUp aria-hidden="true" size={14} />
  ) : (
    <ArrowDown aria-hidden="true" size={14} />
  );
}

export function VehicleTypesManagement() {
  const tVehicleTypes = useTranslations('vehicleTypes');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const { can } = useAdminPermissions();
  const canCreate = can('vehicle-type:create');
  const {
    vehicleTypePage,
    error,
    loading,
    page,
    searchInput,
    sortBy,
    sortDirection,
    changePage,
    refresh,
    retry,
    sortVehicleTypes,
    updateSearch,
  } = useVehicleTypes();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const items = vehicleTypePage?.data ?? [];
  function sortButton(label: string, field: VehicleTypeSortKey) {
    return (
      <Button
        aria-label={`${tCommon('sortBy')} ${label}`}
        className="-ml-3"
        variant="ghost"
        size="sm"
        onClick={() => sortVehicleTypes(field)}
      >
        {label}
        {sortLabel(field, sortBy, sortDirection)}
      </Button>
    );
  }
  return (
    <SuperAdminLayout activeSection="vehicle-types">
      <div className="admin-ui admin-page-content grid gap-[var(--admin-space-section-gap)]">
        <AdminPageHeader
          eyebrow={tVehicleTypes('eyebrow')}
          title={tVehicleTypes('vehicleTypesTitle')}
          titleId="vehicle-types-title"
          actions={
            <div className="flex flex-wrap items-center gap-2">
              {canCreate && (
                <ResourceCreateAction
                  label={tVehicleTypes('createVehicleType')}
                  onClick={() => setCreateDialogOpen(true)}
                />
              )}
              <ResourceRefreshAction
                loading={loading}
                onClick={refresh}
                label={tCommon('refresh')}
              />
            </div>
          }
        />
        <section aria-labelledby="vehicle-types-title" aria-busy={loading}>
          <Card className="gap-0 py-0 ring-0">
            <FilterToolbar>
              <SearchInput
                label={tVehicleTypes('searchLabel')}
                placeholder={tVehicleTypes('searchPlaceholder')}
                value={searchInput}
                onChange={updateSearch}
                clearLabel={tCommon('clearSearch')}
              />
            </FilterToolbar>
            {loading && !vehicleTypePage && (
              <ResourceTableSkeleton resourceLabel={tVehicleTypes('resourceLabel')} />
            )}
            {error && (
              <ResourceState error>
                <p>{error}</p>
                <Button variant="outline" onClick={retry}>
                  {tCommon('retry')}
                </Button>
              </ResourceState>
            )}
            {!error && vehicleTypePage && items.length === 0 && !loading && (
              <ResourceState>
                <p>
                  {searchInput.trim()
                    ? tVehicleTypes('noMatch')
                    : tVehicleTypes('emptyList')}
                </p>
                {searchInput.trim() && (
                  <Button variant="outline" onClick={() => updateSearch('')}>
                    {tCommon('clearSearch')}
                  </Button>
                )}
              </ResourceState>
            )}
            {!error && vehicleTypePage && (
              <>
                {items.length > 0 && (
                  <>
                    <div className="hidden md:block">
                      <Table className="min-w-[820px]">
                        <TableCaption className="sr-only">
                          {tVehicleTypes('tableCaption')}
                        </TableCaption>
                        <TableHeader>
                          <TableRow>
                            {(
                              [
                                { key: 'name', label: tVehicleTypes('colName') },
                                { key: null, label: tVehicleTypes('colDescription') },
                                { key: 'createdAt', label: tVehicleTypes('colCreatedAt') },
                                { key: 'updatedAt', label: tVehicleTypes('colUpdatedAt') },
                              ] as const
                            ).map((column) => (
                              <TableHead
                                key={column.label}
                                scope="col"
                                aria-sort={
                                  column.key
                                    ? sortBy === column.key
                                      ? sortDirection === 'asc'
                                        ? 'ascending'
                                        : 'descending'
                                      : 'none'
                                    : undefined
                                }
                              >
                                {column.key
                                  ? sortButton(column.label, column.key)
                                  : column.label}
                              </TableHead>
                            ))}
                            <TableHead scope="col">
                              <span className="sr-only">{tCommon('actions')}</span>
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {items.map((item) => (
                            <TableRow key={item.vehicleTypeId}>
                              <TableHead
                                scope="row"
                                className="max-w-60 whitespace-normal break-words bg-transparent text-[13px]"
                              >
                                {item.name}
                              </TableHead>
                              <TableCell className="max-w-80 whitespace-normal break-words text-muted-foreground">
                                {item.description || tCommon('noDescription')}
                              </TableCell>
                              <TableCell className="whitespace-nowrap text-muted-foreground">
                                {timestampFormat(item.createdAt)}
                              </TableCell>
                              <TableCell className="whitespace-nowrap text-muted-foreground">
                                {timestampFormat(item.updatedAt)}
                              </TableCell>
                              <TableCell>
                                <ResourceDetailAction
                                  href={`/vehicle-types/${item.vehicleTypeId}`}
                                  onClick={() =>
                                    router.push(
                                      `/vehicle-types/${item.vehicleTypeId}`,
                                    )
                                  }
                                  label={tCommon('viewDetails')}
                                  resourceName={`loại xe ${item.name}`}
                                />
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    <div className="border-b p-4 md:hidden">
                      <div className="flex items-end gap-3">
                        <SelectFilter
                          label={tCommon('sortBy')}
                          value={sortBy === 'name' ? '' : sortBy}
                          allLabel={tVehicleTypes('colName')}
                          options={[
                            { value: 'createdAt', label: tVehicleTypes('colCreatedAt') },
                            { value: 'updatedAt', label: tVehicleTypes('colUpdatedAt') },
                          ]}
                          onChange={(value) => {
                            const field = (value ||
                              'name') as VehicleTypeSortKey;
                            if (field !== sortBy) sortVehicleTypes(field);
                          }}
                        />
                        <Button
                          variant="outline"
                          onClick={() => sortVehicleTypes(sortBy)}
                          aria-label={tCommon('toggleSortOrder', {
                            order: sortDirection === 'asc' ? tCommon('ascending') : tCommon('descending'),
                          })}
                        >
                          {sortDirection === 'asc' ? (
                            <ArrowUp aria-hidden />
                          ) : (
                            <ArrowDown aria-hidden />
                          )}
                          {sortDirection === 'asc'
                            ? tCommon('sortAscending')
                            : tCommon('sortDescending')}
                        </Button>
                      </div>
                    </div>
                    <div className="grid gap-4 p-4 md:hidden">
                      {items.map((item) => (
                        <Card
                          key={item.vehicleTypeId}
                          className="gap-4 p-4 ring-0"
                        >
                          <div>
                            <h2 className="break-words text-base font-semibold">
                              {item.name}
                            </h2>
                            <p className="admin-data-mono mt-1 text-xs text-muted-foreground">
                              #{item.vehicleTypeId}
                            </p>
                          </div>
                          <p className="whitespace-pre-wrap break-words text-[13px] text-muted-foreground">
                            {item.description || tCommon('noDescription')}
                          </p>
                          <dl className="grid grid-cols-2 gap-3 text-[13px]">
                            <div>
                              <dt className="mb-1 text-xs text-muted-foreground">
                                {tVehicleTypes('colCreatedAt')}
                              </dt>
                              <dd>{timestampFormat(item.createdAt)}</dd>
                            </div>
                            <div>
                              <dt className="mb-1 text-xs text-muted-foreground">
                                {tVehicleTypes('colUpdatedAt')}
                              </dt>
                              <dd>{timestampFormat(item.updatedAt)}</dd>
                            </div>
                          </dl>
                          <div className="flex justify-end border-t pt-3">
                            <ResourceDetailAction
                              href={`/vehicle-types/${item.vehicleTypeId}`}
                              onClick={() =>
                                router.push(
                                  `/vehicle-types/${item.vehicleTypeId}`,
                                )
                              }
                              label={tCommon('viewDetails')}
                              resourceName={`loại xe ${item.name}`}
                            />
                          </div>
                        </Card>
                      ))}
                    </div>
                  </>
                )}
                <ResourcePagination
                  currentPage={page}
                  disabled={loading}
                  onPageChange={changePage}
                  pageSize={vehicleTypePage.meta.pageSize}
                  summaryLabel={tVehicleTypes('resourceLabel')}
                  totalItems={vehicleTypePage.meta.totalItems}
                  totalPages={vehicleTypePage.meta.totalPages}
                  showingLabel={tCommon('showing')}
                  ofLabel={tCommon('of')}
                  pageLabel={tCommon('page')}
                  prevPageLabel={tCommon('prevPage')}
                  nextPageLabel={tCommon('nextPage')}
                />
              </>
            )}
          </Card>
        </section>
      </div>
      {createDialogOpen && canCreate && (
        <VehicleTypeFormDialog
          onClose={() => setCreateDialogOpen(false)}
          onSaved={(item) => {
            setCreateDialogOpen(false);
            toast.success(tVehicleTypes('createdSuccess', { name: item.name }));
            refresh();
          }}
        />
      )}
    </SuperAdminLayout>
  );
}
