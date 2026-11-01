'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { LoaderCircle, Trash2 } from 'lucide-react';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { Button } from '@/components/ui/action-button';
import { Card } from '@/components/ui/card';
import {
  ResourceConfirmation,
  ResourceCreateAction,
  ResourcePagination,
  ResourceRefreshAction,
  ResourceState,
  ResourceTableSkeleton,
} from '@/components/admin/resource-ui';
import {
  FilterToolbar,
  SearchInput,
  SelectFilter,
  type FilterOption,
} from '@/components/data-filters/resource-filters';
import { useAdminPermissions } from '@/features/admin-auth/hooks/use-admin-permissions';
import { SuperAdminLayout } from '@/features/super-admin-layout/components/super-admin-layout';
import { getStations, deleteStation } from '../services/station-service';
import type { Station } from '../types/station';
import { StationDetailSheet } from './station-detail-sheet';
import { StationFormDialog } from './station-form-dialog';
import { StationListTable } from './station-list-table';

const TYPE_FILTER_OPTIONS: FilterOption[] = [
  { value: 'BEN_XE', label: 'Bến xe' },
  { value: 'VAN_PHONG', label: 'Văn phòng' },
  { value: 'DIEM_DON_TRA', label: 'Điểm đón trả' },
  { value: 'TRUNG_CHUYEN', label: 'Điểm trung chuyển' },
  { value: 'TRAM_NGHI', label: 'Trạm nghỉ' },
];

export function StationsManagement() {
  const { can } = useAdminPermissions();
  const canCreate = can('route:create');
  const canUpdate = can('route:update');
  const canDelete = can('route:update');

  const [stations, setStations] = useState<Station[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  const [selectedStation, setSelectedStation] = useState<Station | undefined>();
  const [formOpen, setFormOpen] = useState(false);
  const [editingStation, setEditingStation] = useState<Station | undefined>();
  const [deletingStation, setDeletingStation] = useState<Station | undefined>();
  const [deleting, setDeleting] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getStations({
        page,
        pageSize: 15,
        search: search.trim() || undefined,
        loaiDiem: typeFilter || undefined,
      });
      setStations(res.data);
      setTotalPages(res.meta.totalPages);
      setTotalItems(res.meta.totalItems);
    } catch {
      setError('Không thể tải danh sách điểm đón trả. Vui lòng thử lại.');
      toast.error('Không thể tải danh sách điểm đón trả.');
    } finally {
      setLoading(false);
    }
  }, [page, search, typeFilter]);

  useEffect(() => {
    void Promise.resolve().then(() => loadData());
  }, [loadData]);

  const handleDeleteConfirm = async () => {
    if (!deletingStation) return;
    setDeleting(true);
    try {
      await deleteStation(deletingStation.diemDonTraId);
      toast.success(`Đã xóa điểm đón trả "${deletingStation.tenDiem}".`);
      setDeletingStation(undefined);
      loadData();
    } catch {
      toast.error('Không thể xóa điểm đón trả.');
    } finally {
      setDeleting(false);
    }
  };

  const hasActiveFilters = Boolean(search.trim() || typeFilter);

  return (
    <SuperAdminLayout activeSection="stations">
      <div className="admin-ui admin-page-content grid gap-[var(--admin-space-section-gap)]">
        <AdminPageHeader
          eyebrow="QUẢN LÝ VẬN HÀNH"
          title="Bến bãi & Điểm đón trả"
          titleId="stations-title"
          actions={
            <div className="flex flex-wrap items-center gap-2">
              {canCreate && (
                <ResourceCreateAction
                  label="Thêm điểm đón trả"
                  onClick={() => {
                    setEditingStation(undefined);
                    setFormOpen(true);
                  }}
                />
              )}
              <ResourceRefreshAction loading={loading} onClick={loadData} />
            </div>
          }
        />

        <section aria-busy={loading} aria-labelledby="stations-title">
          <Card className="gap-0 py-0 ring-0">
            <FilterToolbar>
              <SearchInput
                label="Tìm kiếm điểm đón trả"
                value={search}
                onChange={(val) => {
                  setSearch(val);
                  setPage(1);
                }}
                placeholder="Tìm theo tên điểm, mã điểm, địa chỉ…"
              />
              <SelectFilter
                label="Loại điểm"
                allLabel="Tất cả loại điểm"
                value={typeFilter}
                onChange={(val) => {
                  setTypeFilter(val);
                  setPage(1);
                }}
                options={TYPE_FILTER_OPTIONS}
              />
            </FilterToolbar>

            {loading && !stations.length && (
              <ResourceTableSkeleton resourceLabel="điểm đón trả" />
            )}

            {error && (
              <ResourceState error>
                <p>{error}</p>
                <Button onClick={loadData} variant="outline">
                  Thử lại
                </Button>
              </ResourceState>
            )}

            {!error && !loading && stations.length === 0 && (
              <ResourceState>
                <p>
                  {hasActiveFilters
                    ? 'Không tìm thấy điểm đón trả phù hợp với bộ lọc.'
                    : 'Chưa có điểm đón trả nào trong hệ thống.'}
                </p>
                {hasActiveFilters && (
                  <Button
                    onClick={() => {
                      setSearch('');
                      setTypeFilter('');
                      setPage(1);
                    }}
                    variant="outline"
                  >
                    Xóa bộ lọc
                  </Button>
                )}
              </ResourceState>
            )}

            {!error && stations.length > 0 && (
              <>
                <StationListTable
                  stations={stations}
                  onSelectStation={(st) => setSelectedStation(st)}
                />

                {/* Pagination */}
                <ResourcePagination
                  currentPage={page}
                  pageSize={15}
                  totalItems={totalItems}
                  totalPages={totalPages}
                  summaryLabel="điểm đón trả"
                  onPageChange={setPage}
                />
              </>
            )}
          </Card>
        </section>

        {/* Detail Sheet */}
        {selectedStation && (
          <StationDetailSheet
            station={selectedStation}
            canUpdate={canUpdate}
            canDelete={canDelete}
            onClose={() => setSelectedStation(undefined)}
            onEdit={() => {
              const current = selectedStation;
              setSelectedStation(undefined);
              setEditingStation(current);
              setFormOpen(true);
            }}
            onDelete={() => {
              const current = selectedStation;
              setSelectedStation(undefined);
              setDeletingStation(current);
            }}
          />
        )}

        {/* Create / Edit Form Sheet */}
        {formOpen && (
          <StationFormDialog
            station={editingStation}
            onClose={() => {
              setFormOpen(false);
              setEditingStation(undefined);
            }}
            onSaved={() => {
              setFormOpen(false);
              setEditingStation(undefined);
              loadData();
            }}
          />
        )}

        {/* Confirmation Delete Dialog */}
        {deletingStation && (
          <ResourceConfirmation
            title={`Xóa điểm đón trả ${deletingStation.tenDiem}?`}
            description={`Điểm đón trả "${deletingStation.tenDiem}" (${deletingStation.maDiem}) sẽ bị xóa vĩnh viễn khỏi hệ thống. Thao tác này không thể hoàn tác.`}
            busy={deleting}
            onClose={() => setDeletingStation(undefined)}
          >
            <Button
              aria-busy={deleting}
              disabled={deleting}
              onClick={handleDeleteConfirm}
              variant="destructive"
            >
              {deleting ? (
                <LoaderCircle aria-hidden className="motion-safe:animate-spin" />
              ) : (
                <Trash2 aria-hidden />
              )}
              {deleting ? 'Đang xóa…' : 'Xóa điểm'}
            </Button>
          </ResourceConfirmation>
        )}
      </div>
    </SuperAdminLayout>
  );
}
