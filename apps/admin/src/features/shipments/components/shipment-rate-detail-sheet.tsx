'use client';

import { useEffect, useState } from 'react';
import { LoaderCircle, Package, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import {
  ResourceConfirmation,
  ResourceSheet,
  ResourceState,
  ResourceStatusBadge,
} from '@/components/admin/resource-ui';
import { Button } from '@/components/ui/action-button';
import {
  getShipmentRateById,
  ShipmentRateApiError,
  updateShipmentRateStatus,
} from '../services/shipment-rate-service';
import type {
  ShipmentRate,
  ShipmentRateEffectiveState,
  ShipmentRateStatus,
} from '../types/shipment-rate';

const STATUS_LABELS: Record<ShipmentRateStatus, string> = {
  HOAT_DONG: 'Đang hoạt động',
  TAM_NGUNG: 'Tạm ngưng',
};

const EFFECTIVE_LABELS: Record<ShipmentRateEffectiveState, string> = {
  CHUA_DEN_NGAY: 'Chưa đến ngày',
  DANG_HIEU_LUC: 'Đang hiệu lực',
  HET_HIEU_LUC: 'Hết hiệu lực',
};

export function formatWeightBand(
  weightFrom: number,
  weightTo: number | null,
): string {
  if (weightTo === null) {
    return `Trên ${weightFrom} kg`;
  }
  return `${weightFrom} → ${weightTo} kg`;
}

export function ShipmentRateDetailSheet({
  rate,
  open,
  canEdit,
  onClose,
  onEdit,
  onChanged,
  onMissing,
}: {
  rate: ShipmentRate | null;
  open: boolean;
  canEdit: boolean;
  onClose: () => void;
  onEdit: (rate: ShipmentRate) => void;
  onChanged: (rate: ShipmentRate, message?: string) => void;
  onMissing: (message: string) => void;
}) {
  const [detail, setDetail] = useState<ShipmentRate | null>(rate);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    setDetail(rate);
    setError(null);
    setConfirmOpen(false);
    setStatusLoading(false);
  }, [rate]);

  useEffect(() => {
    if (!canEdit) {
      setConfirmOpen(false);
      setStatusLoading(false);
    }
  }, [canEdit]);

  const rateId = rate?.rateId ?? null;

  useEffect(() => {
    if (!open || !rateId) return;
    const targetRateId = rateId;
    const controller = new AbortController();

    async function loadDetail() {
      setLoading(true);
      setError(null);

      try {
        const latest = await getShipmentRateById(
          targetRateId,
          controller.signal,
        );
        setDetail(latest);
        onChanged(latest);
        setLoading(false);
      } catch (loadError) {
        if (
          loadError instanceof DOMException &&
          loadError.name === 'AbortError'
        ) {
          return;
        }
        if (
          loadError instanceof ShipmentRateApiError &&
          loadError.statusCode === 404
        ) {
          onMissing('Mức cước gửi hàng không còn tồn tại.');
          return;
        }
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Không thể tải chi tiết mức cước gửi hàng.',
        );
        setLoading(false);
      }
    }

    void loadDetail();

    return () => controller.abort();
  }, [onChanged, onMissing, open, rateId, reloadTick]);

  if (!open || !detail) return null;

  const currentDetail = detail;
  const nextStatus: ShipmentRateStatus =
    currentDetail.status === 'HOAT_DONG' ? 'TAM_NGUNG' : 'HOAT_DONG';
  const nextStatusLabel =
    nextStatus === 'TAM_NGUNG' ? 'Tạm ngưng' : 'Kích hoạt lại';

  async function handleConfirmStatus() {
    setStatusLoading(true);
    setError(null);

    try {
      const updated = await updateShipmentRateStatus(currentDetail.rateId, {
        status: nextStatus,
      });
      setDetail(updated);
      setConfirmOpen(false);
      setStatusLoading(false);
      onChanged(
        updated,
        nextStatus === 'TAM_NGUNG'
          ? 'Đã tạm ngưng mức cước gửi hàng.'
          : 'Đã kích hoạt lại mức cước gửi hàng.',
      );
    } catch (statusError) {
      setConfirmOpen(false);
      setStatusLoading(false);
      if (
        statusError instanceof ShipmentRateApiError &&
        statusError.statusCode === 404
      ) {
        onMissing('Mức cước gửi hàng không còn tồn tại.');
        return;
      }
      const message =
        statusError instanceof Error
          ? statusError.message
          : 'Không thể cập nhật trạng thái mức cước gửi hàng.';
      setError(message);
      toast.error(message);
    }
  }

  return (
    <ResourceSheet
      busy={loading}
      title="Chi tiết mức cước gửi hàng"
      description={`${currentDetail.route.origin} → ${currentDetail.route.destination} · ${currentDetail.cargoType.name}`}
      onClose={onClose}
    >
      {error && (
        <ResourceState error>
          <p>{error}</p>
          <Button
            type="button"
            variant="outline"
            onClick={() => setReloadTick((value) => value + 1)}
          >
            Thử lại
          </Button>
        </ResourceState>
      )}

      <div className="space-y-6">
        <div className="flex items-center gap-4 border-b pb-6">
          <span
            aria-hidden
            className="grid size-12 shrink-0 place-items-center rounded-[var(--admin-radius-panel)] bg-accent text-primary"
          >
            <Package size={24} />
          </span>
          <div className="min-w-0">
            <h3 className="break-words text-base font-semibold">
              {currentDetail.route.origin} → {currentDetail.route.destination}
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              <span className="admin-data-mono">{currentDetail.route.code}</span>{' '}
              · {currentDetail.cargoType.name}
            </p>
          </div>
        </div>

        <div className="rounded-[var(--admin-radius-panel)] border bg-muted/40 p-4">
          <p className="text-xs text-muted-foreground">Mức cước cơ bản</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums">
            {formatVnd(currentDetail.fee)}
          </p>
        </div>

        <dl className="grid grid-cols-2 gap-4 text-[13px] [&_dt]:mb-1 [&_dt]:text-xs [&_dt]:text-muted-foreground [&_dd]:break-words">
          <div>
            <dt>Mã tuyến</dt>
            <dd className="admin-data-mono">{currentDetail.route.code}</dd>
          </div>
          <div>
            <dt>Hành trình</dt>
            <dd>
              {currentDetail.route.origin} → {currentDetail.route.destination}
            </dd>
          </div>
          <div>
            <dt>Loại hàng hóa</dt>
            <dd>{currentDetail.cargoType.name}</dd>
          </div>
          <div>
            <dt>Nấc khối lượng</dt>
            <dd>
              {formatWeightBand(
                currentDetail.weightFrom,
                currentDetail.weightTo,
              )}
            </dd>
          </div>
          <div>
            <dt>Hiệu lực từ ngày</dt>
            <dd>{formatDateOnly(currentDetail.validFrom)}</dd>
          </div>
          <div>
            <dt>Hiệu lực đến ngày</dt>
            <dd>
              {currentDetail.validTo
                ? formatDateOnly(currentDetail.validTo)
                : 'Không giới hạn'}
            </dd>
          </div>
          <div>
            <dt>Trạng thái</dt>
            <dd>
              <ResourceStatusBadge
                tone={
                  currentDetail.status === 'HOAT_DONG' ? 'active' : 'muted'
                }
              >
                {STATUS_LABELS[currentDetail.status]}
              </ResourceStatusBadge>
            </dd>
          </div>
          <div>
            <dt>Tình trạng hiệu lực</dt>
            <dd>
              <ResourceStatusBadge
                tone={
                  currentDetail.effectiveState === 'DANG_HIEU_LUC'
                    ? 'active'
                    : 'muted'
                }
              >
                {EFFECTIVE_LABELS[currentDetail.effectiveState]}
              </ResourceStatusBadge>
            </dd>
          </div>
        </dl>

        <div className="flex flex-wrap justify-end gap-3 border-t pt-4">
          <Button type="button" variant="outline" onClick={onClose}>
            Đóng
          </Button>
          {canEdit && (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => setConfirmOpen(true)}
                disabled={statusLoading}
              >
                {nextStatusLabel}
              </Button>
              <Button type="button" onClick={() => onEdit(currentDetail)}>
                <Pencil aria-hidden />
                Chỉnh sửa
              </Button>
            </>
          )}
        </div>
      </div>

      {confirmOpen && canEdit && (
        <ResourceConfirmation
          busy={statusLoading}
          onClose={() => {
            if (!statusLoading) setConfirmOpen(false);
          }}
          title={
            nextStatus === 'TAM_NGUNG'
              ? 'Tạm ngưng mức cước?'
              : 'Kích hoạt lại mức cước?'
          }
          description={
            nextStatus === 'TAM_NGUNG'
              ? `Mức cước tuyến ${currentDetail.route.code} (${currentDetail.cargoType.name}, ${formatWeightBand(currentDetail.weightFrom, currentDetail.weightTo)}) sẽ chuyển sang trạng thái tạm ngưng.`
              : `Mức cước tuyến ${currentDetail.route.code} (${currentDetail.cargoType.name}, ${formatWeightBand(currentDetail.weightFrom, currentDetail.weightTo)}) sẽ hoạt động trở lại nếu khoảng ngày không trùng lặp.`
          }
        >
          <Button
            disabled={statusLoading}
            aria-busy={statusLoading}
            onClick={handleConfirmStatus}
          >
            {statusLoading && (
              <LoaderCircle aria-hidden className="motion-safe:animate-spin" />
            )}
            {statusLoading
              ? 'Đang cập nhật…'
              : nextStatus === 'TAM_NGUNG'
                ? 'Xác nhận tạm ngưng'
                : 'Xác nhận kích hoạt'}
          </Button>
        </ResourceConfirmation>
      )}
    </ResourceSheet>
  );
}

function formatVnd(amount: number): string {
  return `${new Intl.NumberFormat('vi-VN').format(amount)} ₫`;
}

function formatDateOnly(value: string): string {
  const [year, month, day] = value.split('-');
  if (!year || !month || !day) return value;
  return `${day}-${month}-${year}`;
}
