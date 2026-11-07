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
        aria-label={`Sắp xếp theo ${label}`}
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
          eyebrow="DANH MỤC PHƯƠNG TIỆN"
          title="Quản lý loại xe"
          titleId="vehicle-types-title"
          actions={
            <div className="flex flex-wrap items-center gap-2">
              {canCreate && (
                <ResourceCreateAction
                  label="Thêm loại xe"
                  onClick={() => setCreateDialogOpen(true)}
                />
              )}
              <ResourceRefreshAction loading={loading} onClick={refresh} />
            </div>
          }
        />
        <section aria-labelledby="vehicle-types-title" aria-busy={loading}>
          <Card className="gap-0 py-0 ring-0">
            <FilterToolbar>
              <SearchInput
                label="Tìm kiếm loại xe"
                placeholder="Tìm tên loại xe, mô tả…"
                value={searchInput}
                onChange={updateSearch}
              />
            </FilterToolbar>
            {loading && !vehicleTypePage && (
              <ResourceTableSkeleton resourceLabel="loại xe" />
            )}
            {error && (
              <ResourceState error>
                <p>{error}</p>
                <Button variant="outline" onClick={retry}>
                  Thử lại
                </Button>
              </ResourceState>
            )}
            {!error && vehicleTypePage && items.length === 0 && !loading && (
              <ResourceState>
                <p>
                  {searchInput.trim()
                    ? 'Không tìm thấy loại xe phù hợp.'
                    : 'Chưa có loại xe trong danh mục.'}
                </p>
                {searchInput.trim() && (
                  <Button variant="outline" onClick={() => updateSearch('')}>
                    Xóa tìm kiếm
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
                          Danh sách loại xe
                        </TableCaption>
                        <TableHeader>
                          <TableRow>
                            {(
                              [
                                { key: 'name', label: 'Tên loại xe' },
                                { key: null, label: 'Mô tả' },
                                { key: 'createdAt', label: 'Ngày tạo' },
                                { key: 'updatedAt', label: 'Cập nhật' },
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
                              <span className="sr-only">Thao tác</span>
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
                                {item.description || 'Chưa có mô tả'}
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
                          label="Sắp xếp theo"
                          value={sortBy === 'name' ? '' : sortBy}
                          allLabel="Tên loại xe"
                          options={[
                            { value: 'createdAt', label: 'Ngày tạo' },
                            { value: 'updatedAt', label: 'Cập nhật' },
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
                          aria-label={`Đổi thứ tự sắp xếp, hiện tại ${sortDirection === 'asc' ? 'tăng dần' : 'giảm dần'}`}
                        >
                          {sortDirection === 'asc' ? (
                            <ArrowUp aria-hidden />
                          ) : (
                            <ArrowDown aria-hidden />
                          )}
                          {sortDirection === 'asc' ? 'Tăng dần' : 'Giảm dần'}
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
                            {item.description || 'Chưa có mô tả'}
                          </p>
                          <dl className="grid grid-cols-2 gap-3 text-[13px]">
                            <div>
                              <dt className="mb-1 text-xs text-muted-foreground">
                                Ngày tạo
                              </dt>
                              <dd>{timestampFormat(item.createdAt)}</dd>
                            </div>
                            <div>
                              <dt className="mb-1 text-xs text-muted-foreground">
                                Cập nhật
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
                  summaryLabel="loại xe"
                  totalItems={vehicleTypePage.meta.totalItems}
                  totalPages={vehicleTypePage.meta.totalPages}
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
            toast.success(`Đã tạo loại xe ${item.name}.`);
            refresh();
          }}
        />
      )}
    </SuperAdminLayout>
  );
}
