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
import { useTranslations } from 'next-intl';
import { getStations, deleteStation } from '../services/station-service';
import type { Station } from '../types/station';
import { StationFormDialog } from './station-form-dialog';
import { StationListTable } from './station-list-table';

export function StationsManagement() {
  const tStations = useTranslations('stations');
  const tCommon = useTranslations('common');
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

  const [formOpen, setFormOpen] = useState(false);
  const [editingStation, setEditingStation] = useState<Station | undefined>();
  const [deletingStation, setDeletingStation] = useState<Station | undefined>();
  const [deleting, setDeleting] = useState(false);

  const typeFilterOptions: FilterOption[] = [
    { value: 'BEN_XE', label: tStations('typeTerminal') },
    { value: 'VAN_PHONG', label: tStations('typeOffice') },
    { value: 'DIEM_DON_TRA', label: tStations('typeStop') },
    { value: 'TRUNG_CHUYEN', label: tStations('typeTransit') },
    { value: 'TRAM_NGHI', label: tStations('typeRest') },
  ];

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
      setError(tStations('errors.loadListFailed'));
      toast.error(tStations('errors.loadListFailed'));
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
      toast.success(tStations('deleteSuccess', { name: deletingStation.tenDiem }));
      setDeletingStation(undefined);
      loadData();
    } catch {
      toast.error(tStations('errors.deleteFailed'));
    } finally {
      setDeleting(false);
    }
  };

  const hasActiveFilters = Boolean(search.trim() || typeFilter);

  return (
    <SuperAdminLayout activeSection="stations">
      <div className="admin-ui admin-page-content grid gap-[var(--admin-space-section-gap)]">
        <AdminPageHeader
          eyebrow={tStations('eyebrow')}
          title={tStations('stationsTitle')}
          titleId="stations-title"
          actions={
            <div className="flex flex-wrap items-center gap-2">
              {canCreate && (
                <ResourceCreateAction
                  label={tStations('addStop')}
                  onClick={() => {
                    setEditingStation(undefined);
                    setFormOpen(true);
                  }}
                />
              )}
              <ResourceRefreshAction
                loading={loading}
                onClick={loadData}
                label={tCommon('refresh')}
              />
            </div>
          }
        />

        <section aria-busy={loading} aria-labelledby="stations-title">
          <Card className="gap-0 py-0 ring-0">
            <FilterToolbar>
              <SearchInput
                label={tStations('stationsTitle')}
                value={search}
                onChange={(val) => {
                  setSearch(val);
                  setPage(1);
                }}
                placeholder={tStations('searchPlaceholder')}
                clearLabel={tCommon('clearSearch')}
              />
              <SelectFilter
                label={tStations('stationType')}
                allLabel={tStations('allTypes')}
                value={typeFilter}
                onChange={(val) => {
                  setTypeFilter(val);
                  setPage(1);
                }}
                options={typeFilterOptions}
              />
            </FilterToolbar>

            {loading && !stations.length && (
              <ResourceTableSkeleton resourceLabel={tStations('resourceLabel')} />
            )}

            {error && (
              <ResourceState error>
                <p>{error}</p>
                <Button onClick={loadData} variant="outline">
                  {tCommon('retry')}
                </Button>
              </ResourceState>
            )}

            {!error && !loading && stations.length === 0 && (
              <ResourceState>
                <p>
                  {hasActiveFilters
                    ? tStations('noMatch')
                    : tStations('emptyList')}
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
                    {tCommon('clearFilters')}
                  </Button>
                )}
              </ResourceState>
            )}

            {!error && stations.length > 0 && (
              <>
                <StationListTable stations={stations} />

                {/* Pagination */}
                <ResourcePagination
                  currentPage={page}
                  pageSize={15}
                  totalItems={totalItems}
                  totalPages={totalPages}
                  summaryLabel={tStations('resourceLabel')}
                  onPageChange={setPage}
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

        {/* Create / Edit Form Dialog */}
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
            title={tStations('deleteTitle', { name: deletingStation.tenDiem })}
            description={tStations('deleteDescription', {
              name: deletingStation.tenDiem,
              code: deletingStation.maDiem,
            })}
            busy={deleting}
            cancelLabel={tCommon('cancel')}
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
              {deleting ? tCommon('deleting') : tStations('deleteButton')}
            </Button>
          </ResourceConfirmation>
        )}
      </div>
    </SuperAdminLayout>
  );
}
