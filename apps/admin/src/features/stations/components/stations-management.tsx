'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Building2, Plus, RefreshCw } from 'lucide-react';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { Button } from '@/components/ui/action-button';
import {
  ResourceConfirmation,
  ResourcePagination,
  ResourceTableSkeleton,
} from '@/components/admin/resource-ui';
import {
  FilterToolbar,
  SearchInput,
  SelectFilter,
} from '@/components/data-filters/resource-filters';
import { SuperAdminLayout } from '@/features/super-admin-layout/components/super-admin-layout';
import { getStations, deleteStation } from '../services/station-service';
import type { Station } from '../types/station';
import { StationListTable } from './station-list-table';
import { StationFormDialog } from './station-form-dialog';

const TYPE_FILTER_OPTIONS = [
  { value: '', label: 'Tất cả loại điểm' },
  { value: 'BEN_XE', label: 'Bến xe' },
  { value: 'VAN_PHONG', label: 'Văn phòng' },
  { value: 'DIEM_DON_TRA', label: 'Điểm đón trả' },
];

export function StationsManagement() {
  const [stations, setStations] = useState<Station[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingStation, setEditingStation] = useState<Station | undefined>();
  const [deletingStation, setDeletingStation] = useState<Station | undefined>();

  const loadData = async () => {
    setLoading(true);
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
      toast.error('Không thể tải danh sách điểm đón trả.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [page, search, typeFilter]);

  const handleDeleteConfirm = async () => {
    if (!deletingStation) return;
    try {
      await deleteStation(deletingStation.diemDonTraId);
      toast.success(`Đã xóa điểm đón trả '${deletingStation.tenDiem}'.`);
      setDeletingStation(undefined);
      loadData();
    } catch {
      toast.error('Không thể xóa điểm đón trả.');
    }
  };

  return (
    <SuperAdminLayout activeSection="stations">
      <div className="space-y-6">
        <AdminPageHeader
          eyebrow="QUẢN LÝ VẬN HÀNH"
          title="Điểm đón trả & Bến bãi"
          titleId="stations-title"
          actions={
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={loadData}
                disabled={loading}
              >
                <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} />
                Làm mới
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  setEditingStation(undefined);
                  setDialogOpen(true);
                }}
              >
                <Plus className="size-3.5" />
                Thêm điểm đón trả
              </Button>
            </div>
          }
        />

        <FilterToolbar>
          <div className="flex flex-1 flex-wrap items-center gap-3">
            <SearchInput
              label="Tìm điểm đón trả"
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
          </div>
        </FilterToolbar>

        {loading ? (
          <ResourceTableSkeleton resourceLabel="điểm đón trả" />
        ) : (
          <>
            <StationListTable
              stations={stations}
              onEdit={(st) => {
                setEditingStation(st);
                setDialogOpen(true);
              }}
              onDelete={(st) => setDeletingStation(st)}
            />
            {totalPages > 1 && (
              <ResourcePagination
                currentPage={page}
                pageSize={10}
                totalItems={totalItems}
                totalPages={totalPages}
                summaryLabel="điểm đón trả"
                onPageChange={(p) => setPage(p)}
              />
            )}
          </>
        )}

        {dialogOpen && (
          <StationFormDialog
            station={editingStation}
            onClose={() => {
              setDialogOpen(false);
              setEditingStation(undefined);
            }}
            onSaved={() => {
              loadData();
            }}
          />
        )}

        {deletingStation && (
          <ResourceConfirmation
            title="Xác nhận xóa điểm đón trả"
            description={`Bạn có chắc muốn xóa điểm đón trả "${deletingStation.tenDiem}" (${deletingStation.maDiem})?`}
            onClose={() => setDeletingStation(undefined)}
          >
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setDeletingStation(undefined)}>
                Hủy
              </Button>
              <Button variant="destructive" onClick={handleDeleteConfirm}>
                Xóa điểm
              </Button>
            </div>
          </ResourceConfirmation>
        )}
      </div>
    </SuperAdminLayout>
  );
}
