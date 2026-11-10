'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { ResourceModalForm } from '@/components/admin/resource-modal-form';
import { ResourceModalDialog } from '@/components/admin/resource-ui';
import { Field, FieldLabel, FieldError, FieldDescription } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { LegacyBadge } from '@/components/ui/status-badge';
import { Button } from '@/components/ui/action-button';
import { getLocations, type LocationOption } from '@/features/locations/services/location-service';
import { createStation, updateStation, getStations, StationApiError } from '../services/station-service';
import type { Station, StationType } from '../types/station';

interface StationFormDialogProps {
  station?: Station;
  onClose: () => void;
  onSaved: (station: Station) => void;
}

export function StationFormDialog({
  station,
  onClose,
  onSaved,
}: StationFormDialogProps) {
  const tStations = useTranslations('stations');
  const tCommon = useTranslations('common');
  const isEditing = Boolean(station);
  const [tenDiem, setTenDiem] = useState(station?.tenDiem ?? '');
  const [loaiDiem, setLoaiDiem] = useState<StationType>(station?.loaiDiem ?? 'BEN_XE');
  const [diaChi, setDiaChi] = useState(station?.diaChi ?? '');
  const [diaDiemCuId, setDiaDiemCuId] = useState<number | undefined>(station?.diaDiemCuId);
  const [benTrungChuyenId, setBenTrungChuyenId] = useState<number | undefined>(
    station?.benTrungChuyenId ?? undefined,
  );
  const [targetStationOptions, setTargetStationOptions] = useState<Station[]>([]);
  const [soDienThoai, setSoDienThoai] = useState(station?.soDienThoai ?? '');
  const [legacyLocations, setLegacyLocations] = useState<LocationOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const stationTypeLabels: Record<StationType, string> = {
    BEN_XE: tStations('typeTerminal'),
    VAN_PHONG: tStations('typeOffice'),
    DIEM_DON_TRA: tStations('typeStop'),
    TRUNG_CHUYEN: tStations('typeTransit'),
    TRAM_NGHI: tStations('typeRest'),
  };

  useEffect(() => {
    getLocations()
      .then((items) => {
        const legacyOnly = items.filter((item) => item.isLegacy);
        setLegacyLocations(legacyOnly);
      })
      .catch(() => {
        toast.error(tStations('errors.loadLocationsFailed'));
      });
  }, [tStations]);

  useEffect(() => {
    getStations({ pageSize: 100 })
      .then((res) => {
        const validTargets = res.data.filter(
          (s) =>
            s.trangThai === 'HOAT_DONG' &&
            (s.loaiDiem === 'BEN_XE' || s.loaiDiem === 'VAN_PHONG') &&
            (!station || s.diemDonTraId !== station.diemDonTraId),
        );
        setTargetStationOptions(validTargets);
      })
      .catch(() => {});
  }, [station]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    if (!tenDiem.trim()) newErrors.tenDiem = tStations('errors.nameRequired');
    if (!diaChi.trim()) newErrors.diaChi = tStations('errors.addressRequired');
    if (!diaDiemCuId) newErrors.diaDiemCuId = tStations('errors.provinceRequired');
    if (loaiDiem === 'TRUNG_CHUYEN' && !benTrungChuyenId) {
      newErrors.benTrungChuyenId = tStations('errors.transitTargetRequired');
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setLoading(true);
    try {
      if (isEditing && station) {
        const updated = await updateStation(station.diemDonTraId, {
          tenDiem: tenDiem.trim(),
          loaiDiem,
          diaChi: diaChi.trim(),
          diaDiemCuId,
          benTrungChuyenId: loaiDiem === 'TRUNG_CHUYEN' ? benTrungChuyenId : null,
          soDienThoai: soDienThoai.trim() || undefined,
        });
        toast.success(tStations('updateSuccess'));
        onSaved(updated);
      } else {
        const created = await createStation({
          tenDiem: tenDiem.trim(),
          loaiDiem,
          diaChi: diaChi.trim(),
          diaDiemCuId: diaDiemCuId!,
          benTrungChuyenId: loaiDiem === 'TRUNG_CHUYEN' ? benTrungChuyenId : null,
          soDienThoai: soDienThoai.trim() || undefined,
        });
        toast.success(tStations('createSuccess'));
        onSaved(created);
      }
      onClose();
    } catch (err) {
      if (err instanceof StationApiError) {
        toast.error(err.message);
      } else {
        toast.error(tStations('errors.saveFailed'));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <ResourceModalDialog
      title={isEditing ? tStations('editStation') : tStations('createStation')}
      description={tStations('formDescription')}
      busy={loading}
      preventDismiss={loading}
      onClose={onClose}
      size="xl"
    >
      <ResourceModalForm
        onSubmit={handleSubmit}
        footer={
          <div className="-mx-5 -mb-5 flex justify-end gap-3 border-t bg-slate-50/80 dark:bg-slate-900/60 px-5 py-3.5 sm:-mx-6 sm:-mb-6 sm:px-6 shrink-0">
            <Button variant="outline" type="button" onClick={onClose} disabled={loading}>
              {tCommon('cancel')}
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? tCommon('saving') : isEditing ? tCommon('update') : tCommon('add')}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          {isEditing && station && (
            <div className="space-y-1 rounded-[var(--admin-radius-panel)] border bg-muted/40 p-4">
              <strong className="admin-data-mono text-[13px]">{station.maDiem}</strong>
              <p className="text-xs text-muted-foreground">
                {stationTypeLabels[station.loaiDiem] ?? station.loaiDiem} ·{' '}
                {station.trangThai === 'HOAT_DONG' ? tStations('active') : tStations('inactive')}
              </p>
            </div>
          )}

          <Field data-invalid={Boolean(errors.tenDiem)}>
            <FieldLabel htmlFor="station-name">
              {tStations('stationName')} <span aria-hidden>*</span>
            </FieldLabel>
            <Input
              id="station-name"
              className="text-[13px]"
              value={tenDiem}
              onChange={(e) => setTenDiem(e.target.value)}
              placeholder={tStations('stationNamePlaceholder')}
              disabled={loading}
            />
            {errors.tenDiem && <FieldError>{errors.tenDiem}</FieldError>}
          </Field>

          <Field>
            <FieldLabel htmlFor="station-type">
              {tStations('stationType')} <span aria-hidden>*</span>
            </FieldLabel>
            <Select
              value={loaiDiem}
              onValueChange={(val) => setLoaiDiem(val as StationType)}
              disabled={loading}
            >
              <SelectTrigger id="station-type" className="text-[13px]">
                <SelectValue placeholder={tStations('selectType')}>
                  {stationTypeLabels[loaiDiem] ?? tStations('selectType')}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="BEN_XE">{tStations('typeTerminal')}</SelectItem>
                <SelectItem value="VAN_PHONG">{tStations('typeOffice')}</SelectItem>
                <SelectItem value="DIEM_DON_TRA">{tStations('typeStop')}</SelectItem>
                <SelectItem value="TRUNG_CHUYEN">{tStations('typeTransit')}</SelectItem>
                <SelectItem value="TRAM_NGHI">{tStations('typeRest')}</SelectItem>
              </SelectContent>
            </Select>
          </Field>

          {loaiDiem === 'TRUNG_CHUYEN' && (
            <Field data-invalid={Boolean(errors.benTrungChuyenId)}>
              <FieldLabel htmlFor="station-target">
                {tStations('transitDestinationLabel')} <span aria-hidden>*</span>
              </FieldLabel>
              <Select
                value={benTrungChuyenId ? String(benTrungChuyenId) : ''}
                onValueChange={(val) => setBenTrungChuyenId(Number(val))}
                disabled={loading}
              >
                <SelectTrigger id="station-target" className="text-[13px]">
                  <SelectValue placeholder={tStations('selectTransitTarget')}>
                    {(() => {
                      const matched = targetStationOptions.find(
                        (t) => t.diemDonTraId === benTrungChuyenId,
                      );
                      return matched ? `${matched.tenDiem} (${matched.maDiem})` : tStations('selectTransitTarget');
                    })()}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {targetStationOptions.map((st) => (
                    <SelectItem key={st.diemDonTraId} value={String(st.diemDonTraId)}>
                      {st.tenDiem} ({st.maDiem}) - {st.loaiDiem === 'BEN_XE' ? tStations('typeTerminal') : tStations('typeOffice')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldDescription className="text-xs">
                {tStations('transitTargetDesc')}
              </FieldDescription>
              {errors.benTrungChuyenId && <FieldError>{errors.benTrungChuyenId}</FieldError>}
            </Field>
          )}

          <Field data-invalid={Boolean(errors.diaDiemCuId)}>
            <FieldLabel htmlFor="station-location">
              {tStations('provinceLegacyLabel')} <span aria-hidden>*</span>
            </FieldLabel>
            <Select
              value={diaDiemCuId ? String(diaDiemCuId) : ''}
              onValueChange={(val) => setDiaDiemCuId(Number(val))}
              disabled={loading}
            >
              <SelectTrigger id="station-location" className="text-[13px]">
                <SelectValue placeholder={tStations('selectProvinceLegacy')}>
                  {(() => {
                    const matchedName =
                      legacyLocations.find((loc) => loc.diaDiemId === diaDiemCuId)?.name ??
                      station?.diaDiemCu?.tenDiaDiem;
                    if (!matchedName) return tStations('selectProvinceLegacy');
                    return (
                      <span className="flex items-center gap-1.5">
                        <span>{matchedName}</span>
                        <LegacyBadge />
                      </span>
                    );
                  })()}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="max-h-60">
                {legacyLocations.map((loc) => (
                  <SelectItem key={loc.id} value={String(loc.diaDiemId)}>
                    <span className="flex items-center gap-1.5">
                      <span>{loc.name}</span>
                      <LegacyBadge />
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldDescription className="text-xs">
              {tStations('provinceMergeDesc')}
            </FieldDescription>
            {errors.diaDiemCuId && <FieldError>{errors.diaDiemCuId}</FieldError>}
          </Field>

          <Field data-invalid={Boolean(errors.diaChi)}>
            <FieldLabel htmlFor="station-address">
              {tStations('address')} <span aria-hidden>*</span>
            </FieldLabel>
            <Input
              id="station-address"
              className="text-[13px]"
              value={diaChi}
              onChange={(e) => setDiaChi(e.target.value)}
              placeholder={tStations('addressPlaceholder')}
              disabled={loading}
            />
            {errors.diaChi && <FieldError>{errors.diaChi}</FieldError>}
          </Field>

          <Field>
            <FieldLabel htmlFor="station-phone">{tStations('phone')}</FieldLabel>
            <Input
              id="station-phone"
              className="font-mono text-[13px]"
              value={soDienThoai}
              onChange={(e) => setSoDienThoai(e.target.value)}
              placeholder={tStations('phonePlaceholder')}
              disabled={loading}
            />
          </Field>
        </div>
      </ResourceModalForm>
    </ResourceModalDialog>
  );
}
