'use client';

import { useEffect, useState, useMemo } from 'react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import {
  ArrowDown,
  ArrowUp,
  Clock,
  Plus,
  Trash2,
  AlertTriangle,
  Lock,
  ArrowUpDown,
} from 'lucide-react';
import { ResourceModalDialog } from '@/components/admin/resource-ui';
import { ResourceModalForm } from '@/components/admin/resource-modal-form';
import { Button } from '@/components/ui/action-button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Field, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/status-badge';
import { getStations } from '@/features/stations/services/station-service';
import type { Station } from '@/features/stations/types/station';
import {
  getRouteStops,
  updateRouteStops,
  getTripStops,
  updateTripStops,
  StopApiError,
} from '../services/stop-service';
import type { StopPointRole } from '../types/stop';

interface EditableStopRow {
  key: string;
  diemDonTraId: number;
  loaiDiem: StopPointRole;
  phutLech: number;
  thuTu: number;
  phuPhi: number;
  phutCoMatTruoc: number;
  nhanKhach: boolean;
  ghiChu: string;
  veCount?: number;
  station?: Station;
}

interface StopListEditorProps {
  mode: 'route' | 'trip';
  targetId: number;
  title?: string;
  departureTime?: string;
  onClose: () => void;
  onSaved: () => void;
}

function calculateClockTimePreview(
  departureTime: string = '08:00:00',
  phutLech: number,
  daysLabel: string = 'days',
): string {
  try {
    const [h, m] = departureTime.split(':').map(Number);
    if (isNaN(h) || isNaN(m)) return `${phutLech >= 0 ? '+' : ''}${phutLech}m`;

    const totalMinutes = h * 60 + m + phutLech;
    const normalizedMinutes = ((totalMinutes % 1440) + 1440) % 1440;
    const dayOffset = Math.floor(totalMinutes / 1440);

    const outH = Math.floor(normalizedMinutes / 60);
    const outM = normalizedMinutes % 60;
    const timeStr = `${String(outH).padStart(2, '0')}:${String(outM).padStart(2, '0')}`;

    if (dayOffset > 0) return `${timeStr} (+${dayOffset} ${daysLabel})`;
    if (dayOffset < 0) return `${timeStr} (${dayOffset} ${daysLabel})`;
    return timeStr;
  } catch {
    return `${phutLech >= 0 ? '+' : ''}${phutLech}m`;
  }
}

export function StopListEditor({
  mode,
  targetId,
  title,
  departureTime = '08:00:00',
  onClose,
  onSaved,
}: StopListEditorProps) {
  const tStops = useTranslations('stops');
  const tCommon = useTranslations('common');
  const [rows, setRows] = useState<EditableStopRow[]>([]);
  const [availableStations, setAvailableStations] = useState<Station[]>([]);
  const [selectedStationToAdd, setSelectedStationToAdd] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);

  useEffect(() => {
    getStations({ pageSize: 200 })
      .then((res) => {
        setAvailableStations(res.data.filter((s) => s.trangThai === 'HOAT_DONG'));
      })
      .catch(() => {
        toast.error(tStops('errors.loadStationsFailed'));
      });
  }, [tStops]);

  useEffect(() => {
    void Promise.resolve().then(() => setLoading(true));
    if (mode === 'route') {
      getRouteStops(targetId)
        .then((data) => {
          setRows(
            data.map((item, idx) => ({
              key: `stop-${item.diemDonTraId}-${item.loaiDiem}-${idx}-${Date.now()}`,
              diemDonTraId: item.diemDonTraId,
              loaiDiem: item.loaiDiem,
              phutLech: item.phutLech ?? 0,
              thuTu: item.thuTu ?? idx + 1,
              phuPhi: Number(item.phuPhi ?? 0),
              phutCoMatTruoc: item.phutCoMatTruoc ?? 15,
              nhanKhach: item.nhanKhach ?? true,
              ghiChu: item.ghiChu ?? '',
              station: item.diemDonTra,
            })),
          );
        })
        .catch((err) => {
          toast.error(err instanceof Error ? err.message : tStops('errors.loadRouteStopsFailed'));
        })
        .finally(() => setLoading(false));
    } else {
      getTripStops(targetId)
        .then((data) => {
          setRows(
            data.map((item, idx) => ({
              key: `stop-${item.diemDonTraId}-${item.loaiDiem}-${idx}-${Date.now()}`,
              diemDonTraId: item.diemDonTraId,
              loaiDiem: item.loaiDiem,
              phutLech: item.phutLech ?? 0,
              thuTu: item.thuTu ?? idx + 1,
              phuPhi: Number(item.phuPhi ?? 0),
              phutCoMatTruoc: item.phutCoMatTruoc ?? 15,
              nhanKhach: item.nhanKhach ?? true,
              ghiChu: item.ghiChu ?? '',
              veCount: item.veCount ?? 0,
              station: item.diemDonTra,
            })),
          );
        })
        .catch((err) => {
          toast.error(err instanceof Error ? err.message : tStops('errors.loadTripStopsFailed'));
        })
        .finally(() => setLoading(false));
    }
  }, [mode, targetId, tStops]);

  const enrichedRows = useMemo(() => {
    const stationMap = new Map<number, Station>(availableStations.map((s) => [s.diemDonTraId, s]));
    return rows.map((r) => ({
      ...r,
      station: r.station ?? stationMap.get(r.diemDonTraId),
    }));
  }, [rows, availableStations]);

  const validationErrors = useMemo(() => {
    const errors: string[] = [];
    const pickupStops = enrichedRows.filter((r) => r.loaiDiem === 'DON');
    const dropoffStops = enrichedRows.filter((r) => r.loaiDiem === 'TRA');

    if (enrichedRows.length > 0) {
      if (pickupStops.length === 0) {
        errors.push(tStops('errors.atLeastOnePickup'));
      }
      if (dropoffStops.length === 0) {
        errors.push(tStops('errors.atLeastOneDropoff'));
      }
      if (pickupStops.length > 0 && dropoffStops.length > 0) {
        const firstPickup = pickupStops.reduce((min, p) => (p.phutLech < min.phutLech ? p : min), pickupStops[0]);
        const lastDropoff = dropoffStops.reduce((max, p) => (p.phutLech > max.phutLech ? p : max), dropoffStops[0]);
        if (lastDropoff.phutLech <= firstPickup.phutLech) {
          errors.push(
            tStops('errors.dropoffAfterPickup', {
              last: lastDropoff.phutLech,
              first: firstPickup.phutLech,
            }),
          );
        }
      }

      const seen = new Set<string>();
      for (const r of enrichedRows) {
        const pair = `${r.diemDonTraId}-${r.loaiDiem}`;
        if (seen.has(pair)) {
          const name = r.station?.tenDiem ?? `#${r.diemDonTraId}`;
          const roleLabel =
            r.loaiDiem === 'DON'
              ? tStops('rolePickup')
              : r.loaiDiem === 'TRA'
                ? tStops('roleDropoff')
                : tStops('roleRest');
          errors.push(tStops('errors.duplicateStop', { name, role: roleLabel }));
        }
        seen.add(pair);
      }

      for (const r of enrichedRows) {
        if (r.station?.loaiDiem === 'TRUNG_CHUYEN' && r.station.benTrungChuyenId) {
          const targetStationId = r.station.benTrungChuyenId;
          const targetInList = enrichedRows.find(
            (other) => other.diemDonTraId === targetStationId && other.loaiDiem === r.loaiDiem,
          );
          if (targetInList) {
            if (r.loaiDiem === 'DON' && r.phutLech >= targetInList.phutLech) {
              errors.push(
                tStops('errors.transitPickupBefore', {
                  name: r.station.tenDiem,
                  stopOffset: r.phutLech,
                  targetName: targetInList.station?.tenDiem ?? '',
                  targetOffset: targetInList.phutLech,
                }),
              );
            }
            if (r.loaiDiem === 'TRA' && r.phutLech <= targetInList.phutLech) {
              errors.push(
                tStops('errors.transitDropoffAfter', {
                  name: r.station.tenDiem,
                  stopOffset: r.phutLech,
                  targetName: targetInList.station?.tenDiem ?? '',
                  targetOffset: targetInList.phutLech,
                }),
              );
            }
          }
        }
      }
    }
    return errors;
  }, [enrichedRows, tStops]);

  const handleAddStop = () => {
    if (!selectedStationToAdd) return;
    const stationId = Number(selectedStationToAdd);
    const station = availableStations.find((s) => s.diemDonTraId === stationId);
    if (!station) return;

    let defaultRole: StopPointRole = 'DON';
    if (station.loaiDiem === 'TRAM_NGHI') {
      defaultRole = 'NGHI';
    } else if (rows.some((r) => r.loaiDiem === 'DON')) {
      defaultRole = 'TRA';
    }

    const defaultPhutLech = rows.length > 0 ? rows[rows.length - 1].phutLech + 30 : 0;

    const newRow: EditableStopRow = {
      key: `stop-${stationId}-${defaultRole}-${Date.now()}`,
      diemDonTraId: stationId,
      loaiDiem: defaultRole,
      phutLech: defaultPhutLech,
      thuTu: rows.length + 1,
      phuPhi: 0,
      phutCoMatTruoc: 15,
      nhanKhach: defaultRole !== 'NGHI',
      ghiChu: '',
      station,
    };

    setRows([...rows, newRow]);
    setSelectedStationToAdd('');
  };

  const handleUpdateRow = (index: number, patch: Partial<EditableStopRow>) => {
    const updated = [...rows];
    updated[index] = { ...updated[index], ...patch };
    setRows(updated);
  };

  const handleDeleteRow = (index: number) => {
    const row = rows[index];
    if (mode === 'trip' && row.veCount && row.veCount > 0) {
      toast.error(tStops('errors.cannotDeleteWithTickets', { count: row.veCount }));
      return;
    }
    const updated = rows.filter((_, i) => i !== index);
    updated.forEach((r, idx) => {
      r.thuTu = idx + 1;
    });
    setRows(updated);
  };

  const handleMoveRow = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === rows.length - 1) return;

    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    const updated = [...rows];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;

    updated.forEach((r, idx) => {
      r.thuTu = idx + 1;
    });
    setRows(updated);
  };

  const handleSortByTime = () => {
    const updated = [...rows];
    updated.sort((a, b) => a.phutLech - b.phutLech);
    updated.forEach((r, idx) => {
      r.thuTu = idx + 1;
    });
    setRows(updated);
    toast.info(tStops('sortedByTime'));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (validationErrors.length > 0) {
      toast.error(validationErrors[0]);
      return;
    }

    setSaving(true);
    try {
      const payload = rows.map((r, idx) => ({
        diemDonTraId: r.diemDonTraId,
        loaiDiem: r.loaiDiem,
        phutLech: Number(r.phutLech) || 0,
        thuTu: idx + 1,
        phuPhi: r.loaiDiem === 'NGHI' ? 0 : Number(r.phuPhi) || 0,
        phutCoMatTruoc: Number(r.phutCoMatTruoc) || 15,
        nhanKhach: r.loaiDiem === 'NGHI' ? false : Boolean(r.nhanKhach),
        ghiChu: r.ghiChu?.trim() || null,
      }));

      if (mode === 'route') {
        await updateRouteStops(targetId, payload);
        toast.success(tStops('saveRouteStopsSuccess'));
      } else {
        await updateTripStops(targetId, payload);
        toast.success(tStops('saveTripStopsSuccess'));
      }
      onSaved();
      onClose();
    } catch (err) {
      if (err instanceof StopApiError) {
        toast.error(err.message);
      } else {
        toast.error(tStops('errors.saveStopsFailed'));
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <ResourceModalDialog
      title={title ?? (mode === 'route' ? tStops('defaultRouteTitle') : tStops('defaultTripTitle'))}
      description={
        mode === 'route'
          ? tStops('routeModalDesc')
          : tStops('tripModalDesc', { time: departureTime.slice(0, 5) })
      }
      busy={loading || saving}
      onClose={onClose}
      size="3xl"
    >
      <ResourceModalForm
        onSubmit={handleSave}
        footer={
          <div className="-mx-5 -mb-5 flex justify-between items-center gap-3 border-t bg-slate-50/80 dark:bg-slate-900/60 px-5 py-3.5 sm:-mx-6 sm:-mb-6 sm:px-6 shrink-0">
            <Button
              variant="outline"
              type="button"
              onClick={handleSortByTime}
              disabled={rows.length < 2 || saving}
            >
              <ArrowUpDown className="size-4 mr-1.5" />
              {tStops('sortByTimeBtn')}
            </Button>
            <div className="flex gap-3">
              <Button variant="outline" type="button" onClick={onClose} disabled={saving}>
                {tCommon('close')}
              </Button>
              <Button type="submit" disabled={saving || validationErrors.length > 0}>
                {saving ? tCommon('saving') : tStops('saveRouteBtn')}
              </Button>
            </div>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center bg-muted/30 p-3 rounded-[var(--admin-radius-panel)] border border-border">
            <div className="flex-1">
              <Select
                value={selectedStationToAdd}
                onValueChange={(val) => setSelectedStationToAdd(val ?? '')}
              >
                <SelectTrigger>
                  <SelectValue placeholder={tStops('addStopSelectPlaceholder')} />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {availableStations.map((s) => (
                    <SelectItem key={s.diemDonTraId} value={String(s.diemDonTraId)}>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{s.tenDiem}</span>
                        <span className="font-mono text-xs text-muted-foreground">({s.maDiem})</span>
                        <Badge variant="secondary" className="text-[10px]">
                          {s.loaiDiem === 'BEN_XE'
                            ? tStops('typeTerminal')
                            : s.loaiDiem === 'VAN_PHONG'
                              ? tStops('typeOffice')
                              : s.loaiDiem === 'TRUNG_CHUYEN'
                                ? tStops('typeTransit')
                                : s.loaiDiem === 'TRAM_NGHI'
                                  ? tStops('typeRest')
                                  : tStops('typeEnRoute')}
                        </Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              type="button"
              onClick={handleAddStop}
              disabled={!selectedStationToAdd}
              className="shrink-0"
            >
              <Plus className="size-4 mr-1.5" />
              {tStops('addStopBtn')}
            </Button>
          </div>

          {validationErrors.length > 0 && (
            <Alert variant="destructive">
              <AlertTriangle className="size-4" />
              <AlertTitle>{tStops('validationAlertTitle')}</AlertTitle>
              <AlertDescription>
                <ul className="list-disc list-inside space-y-1 text-xs">
                  {validationErrors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {rows.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground border rounded-[var(--admin-radius-panel)] border-dashed border-border">
              <Clock className="size-8 mx-auto mb-2 text-muted-foreground/60" />
              <p className="text-sm font-medium">{tStops('emptyStopsTitle')}</p>
              <p className="text-xs mt-1">{tStops('emptyStopsDesc')}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {rows.map((row, index) => {
                const station = enrichedRows[index].station;
                const isStationRestStop = station?.loaiDiem === 'TRAM_NGHI';
                const hasTickets = mode === 'trip' && (row.veCount ?? 0) > 0;
                const clockPreview = calculateClockTimePreview(departureTime, row.phutLech, tStops('days'));

                return (
                  <Card
                    key={row.key}
                    size="sm"
                    className="space-y-3 p-3.5 transition-colors hover:border-primary/40"
                  >
                    <div className="flex items-center justify-between gap-2 border-b border-border pb-2.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="grid size-6 place-items-center rounded-full bg-muted text-xs font-semibold text-muted-foreground shrink-0">
                          {index + 1}
                        </span>
                        <span className="font-semibold text-[13px] truncate">
                          {station?.tenDiem ?? `#${row.diemDonTraId}`}
                        </span>
                        <span className="font-mono text-xs text-muted-foreground shrink-0">
                          ({station?.maDiem ?? '—'})
                        </span>
                        {station?.loaiDiem === 'TRUNG_CHUYEN' && (
                          <Badge variant="secondary" className="text-[10px]">
                            {tStops('transitBadge')}
                          </Badge>
                        )}
                        {hasTickets && (
                          <Badge variant="warning" className="text-[10px] gap-1">
                            <Lock className="size-3" />
                            {tStops('ticketsSelectedBadge', { count: row.veCount ?? 0 })}
                          </Badge>
                        )}
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          type="button"
                          onClick={() => handleMoveRow(index, 'up')}
                          disabled={index === 0}
                          aria-label={tStops('moveUpAria')}
                        >
                          <ArrowUp className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          type="button"
                          onClick={() => handleMoveRow(index, 'down')}
                          disabled={index === rows.length - 1}
                          aria-label={tStops('moveDownAria')}
                        >
                          <ArrowDown className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          type="button"
                          className="text-destructive hover:bg-destructive/10"
                          onClick={() => handleDeleteRow(index)}
                          disabled={hasTickets}
                          aria-label={hasTickets ? tStops('cannotDeleteAria') : tStops('deleteStopAria')}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                      {/* Col 1: Role */}
                      <Field>
                        <FieldLabel className="text-xs text-muted-foreground font-medium">{tStops('roleCol')}</FieldLabel>
                        <Select
                          value={row.loaiDiem}
                          onValueChange={(val) =>
                            handleUpdateRow(index, {
                              loaiDiem: val as StopPointRole,
                              nhanKhach: val !== 'NGHI',
                              phuPhi: val === 'NGHI' ? 0 : row.phuPhi,
                            })
                          }
                          disabled={isStationRestStop || hasTickets}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="DON">{tStops('rolePickup')}</SelectItem>
                            <SelectItem value="TRA">{tStops('roleDropoff')}</SelectItem>
                            <SelectItem value="NGHI">{tStops('roleRest')}</SelectItem>
                          </SelectContent>
                        </Select>
                      </Field>

                      {/* Col 2: Offset */}
                      <Field>
                        <div className="flex justify-between items-center">
                          <FieldLabel className="text-xs text-muted-foreground font-medium">{tStops('offsetCol')}</FieldLabel>
                          <span className="font-semibold text-primary font-mono">{clockPreview}</span>
                        </div>
                        <Input
                          type="number"
                          className="h-8 text-xs font-mono"
                          value={row.phutLech}
                          onChange={(e) => handleUpdateRow(index, { phutLech: Number(e.target.value) })}
                          disabled={hasTickets}
                          placeholder={tStops('offsetPlaceholder')}
                        />
                      </Field>

                      {/* Col 3: Surcharge */}
                      <Field>
                        <FieldLabel className="text-xs text-muted-foreground font-medium">{tStops('surchargeCol')}</FieldLabel>
                        <Input
                          type="number"
                          min="0"
                          step="1000"
                          className="h-8 text-xs font-mono"
                          value={row.phuPhi}
                          onChange={(e) => handleUpdateRow(index, { phuPhi: Math.max(0, Number(e.target.value)) })}
                          disabled={row.loaiDiem === 'NGHI'}
                          placeholder="0"
                        />
                      </Field>

                      {/* Col 4: Presence */}
                      <Field>
                        <FieldLabel className="text-xs text-muted-foreground font-medium">{tStops('presenceCol')}</FieldLabel>
                        <Input
                          type="number"
                          min="0"
                          className="h-8 text-xs font-mono"
                          value={row.phutCoMatTruoc}
                          onChange={(e) =>
                            handleUpdateRow(index, { phutCoMatTruoc: Math.max(0, Number(e.target.value)) })
                          }
                          placeholder="15"
                        />
                      </Field>
                    </div>

                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-1">
                      <div className="flex-1">
                        <Input
                          type="text"
                          className="h-8 text-xs"
                          placeholder={tStops('notePlaceholder')}
                          value={row.ghiChu}
                          onChange={(e) => handleUpdateRow(index, { ghiChu: e.target.value })}
                        />
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Checkbox
                          id={`nhan-khach-${row.key}`}
                          checked={row.nhanKhach}
                          disabled={row.loaiDiem === 'NGHI'}
                          onCheckedChange={(checked) => handleUpdateRow(index, { nhanKhach: Boolean(checked) })}
                        />
                        <label
                          htmlFor={`nhan-khach-${row.key}`}
                          className="text-xs text-muted-foreground cursor-pointer select-none font-medium"
                        >
                          {tStops('enableBoarding')}
                        </label>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </ResourceModalForm>
    </ResourceModalDialog>
  );
}
