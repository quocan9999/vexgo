'use client';

import { useEffect, useState, useMemo } from 'react';
import { toast } from 'sonner';
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
import { ResourceSheet } from '@/components/admin/resource-ui';
import { ResourceSheetForm } from '@/components/admin/resource-sheet-form';
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
import type { RouteStopItem, TripPassengerPointItem, StopPointRole } from '../types/stop';

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
  departureTime?: string; // Giờ khởi hành để tính preview, VD: "08:00:00"
  onClose: () => void;
  onSaved: () => void;
}

function calculateClockTimePreview(departureTime: string = '08:00:00', phutLech: number): string {
  try {
    const [h, m] = departureTime.split(':').map(Number);
    if (isNaN(h) || isNaN(m)) return `${phutLech >= 0 ? '+' : ''}${phutLech}p`;

    const totalMinutes = h * 60 + m + phutLech;
    const normalizedMinutes = ((totalMinutes % 1440) + 1440) % 1440;
    const dayOffset = Math.floor(totalMinutes / 1440);

    const outH = Math.floor(normalizedMinutes / 60);
    const outM = normalizedMinutes % 60;
    const timeStr = `${String(outH).padStart(2, '0')}:${String(outM).padStart(2, '0')}`;

    if (dayOffset > 0) return `${timeStr} (+${dayOffset} ngày)`;
    if (dayOffset < 0) return `${timeStr} (${dayOffset} ngày)`;
    return timeStr;
  } catch {
    return `${phutLech >= 0 ? '+' : ''}${phutLech}p`;
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
  const [rows, setRows] = useState<EditableStopRow[]>([]);
  const [availableStations, setAvailableStations] = useState<Station[]>([]);
  const [selectedStationToAdd, setSelectedStationToAdd] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);

  // 1. Tải danh mục bến bãi của nhà xe
  useEffect(() => {
    getStations({ pageSize: 200 })
      .then((res) => {
        setAvailableStations(res.data.filter((s) => s.trangThai === 'HOAT_DONG'));
      })
      .catch(() => {
        toast.error('Không thể tải danh sách bến bãi.');
      });
  }, []);

  // 2. Tải danh sách điểm dừng hiện tại của Tuyến hoặc Chuyến
  useEffect(() => {
    setLoading(true);
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
          toast.error(err instanceof Error ? err.message : 'Không thể tải lộ trình mẫu.');
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
          toast.error(err instanceof Error ? err.message : 'Không thể tải điểm đón trả của chuyến.');
        })
        .finally(() => setLoading(false));
    }
  }, [mode, targetId]);

  // Map station details vào rows nếu thiếu
  const enrichedRows = useMemo(() => {
    const stationMap = new Map<number, Station>(availableStations.map((s) => [s.diemDonTraId, s]));
    return rows.map((r) => ({
      ...r,
      station: r.station ?? stationMap.get(r.diemDonTraId),
    }));
  }, [rows, availableStations]);

  // Validation realtime
  const validationErrors = useMemo(() => {
    const errors: string[] = [];
    const pickupStops = enrichedRows.filter((r) => r.loaiDiem === 'DON');
    const dropoffStops = enrichedRows.filter((r) => r.loaiDiem === 'TRA');

    if (enrichedRows.length > 0) {
      if (pickupStops.length === 0) {
        errors.push('Lộ trình phải có ít nhất 1 điểm ĐÓN.');
      }
      if (dropoffStops.length === 0) {
        errors.push('Lộ trình phải có ít nhất 1 điểm TRẢ.');
      }
      if (pickupStops.length > 0 && dropoffStops.length > 0) {
        const firstPickup = pickupStops.reduce((min, p) => (p.phutLech < min.phutLech ? p : min), pickupStops[0]);
        const lastDropoff = dropoffStops.reduce((max, p) => (p.phutLech > max.phutLech ? p : max), dropoffStops[0]);
        if (lastDropoff.phutLech <= firstPickup.phutLech) {
          errors.push(
            `Điểm trả cuối cùng (${lastDropoff.phutLech}p) phải sau điểm đón đầu tiên (${firstPickup.phutLech}p).`,
          );
        }
      }

      // Trùng lặp
      const seen = new Set<string>();
      for (const r of enrichedRows) {
        const pair = `${r.diemDonTraId}-${r.loaiDiem}`;
        if (seen.has(pair)) {
          const name = r.station?.tenDiem ?? `Điểm #${r.diemDonTraId}`;
          errors.push(`Trùng lặp điểm dừng: "${name}" với cùng vai trò ${r.loaiDiem}.`);
        }
        seen.add(pair);
      }

      // Kiểm tra trung chuyển
      for (const r of enrichedRows) {
        if (r.station?.loaiDiem === 'TRUNG_CHUYEN' && r.station.benTrungChuyenId) {
          const targetStationId = r.station.benTrungChuyenId;
          const targetInList = enrichedRows.find(
            (other) => other.diemDonTraId === targetStationId && other.loaiDiem === r.loaiDiem,
          );
          if (targetInList) {
            if (r.loaiDiem === 'DON' && r.phutLech >= targetInList.phutLech) {
              errors.push(
                `Điểm đón trung chuyển "${r.station.tenDiem}" (${r.phutLech}p) phải xuất phát TRƯỚC bến đích "${targetInList.station?.tenDiem}" (${targetInList.phutLech}p).`,
              );
            }
            if (r.loaiDiem === 'TRA' && r.phutLech <= targetInList.phutLech) {
              errors.push(
                `Điểm trả trung chuyển "${r.station.tenDiem}" (${r.phutLech}p) phải đến SAU bến đích "${targetInList.station?.tenDiem}" (${targetInList.phutLech}p).`,
              );
            }
          }
        }
      }
    }
    return errors;
  }, [enrichedRows]);

  // Thêm điểm dừng
  const handleAddStop = () => {
    if (!selectedStationToAdd) return;
    const stationId = Number(selectedStationToAdd);
    const station = availableStations.find((s) => s.diemDonTraId === stationId);
    if (!station) return;

    // Vai trò mặc định: nếu trạm nghỉ -> NGHI; nếu chưa có điểm đón -> DON; nếu đã có điểm đón -> TRA
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

  // Cập nhật giá trị ô
  const handleUpdateRow = (index: number, patch: Partial<EditableStopRow>) => {
    const updated = [...rows];
    updated[index] = { ...updated[index], ...patch };
    setRows(updated);
  };

  // Xóa dòng
  const handleDeleteRow = (index: number) => {
    const row = rows[index];
    if (mode === 'trip' && row.veCount && row.veCount > 0) {
      toast.error(`Điểm dừng này đã có ${row.veCount} vé đặt. Không thể xóa.`);
      return;
    }
    const updated = rows.filter((_, i) => i !== index);
    updated.forEach((r, idx) => {
      r.thuTu = idx + 1;
    });
    setRows(updated);
  };

  // Di chuyển dòng lên/xuống
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

  // Sắp xếp tự động theo phutLech asc
  const handleSortByTime = () => {
    const updated = [...rows];
    updated.sort((a, b) => a.phutLech - b.phutLech);
    updated.forEach((r, idx) => {
      r.thuTu = idx + 1;
    });
    setRows(updated);
    toast.info('Đã sắp xếp điểm dừng theo thứ tự thời gian.');
  };

  // Lưu lộ trình
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
        toast.success('Cập nhật khuôn lộ trình tuyến xe thành công.');
      } else {
        await updateTripStops(targetId, payload);
        toast.success('Cập nhật điểm đón trả chuyến xe thành công.');
      }
      onSaved();
      onClose();
    } catch (err) {
      if (err instanceof StopApiError) {
        toast.error(err.message);
      } else {
        toast.error('Có lỗi xảy ra khi lưu lộ trình.');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <ResourceSheet
      title={title ?? (mode === 'route' ? 'Cấu hình khuôn lộ trình mẫu' : 'Điều chỉnh điểm đón / trả chuyến xe')}
      description={
        mode === 'route'
          ? 'Khuôn mẫu điểm dừng sẽ được tự động sao chép sang các chuyến xe khi tạo mới.'
          : `Giờ khởi hành mốc: ${departureTime.slice(0, 5)}. Giờ đón trả thực tế được cộng trừ theo số phút lệch.`
      }
      busy={loading || saving}
      onClose={onClose}
    >
      <ResourceSheetForm
        onSubmit={handleSave}
        footer={
          <div className="-mx-4 flex justify-between items-center gap-3 border-t bg-popover px-4 py-4 sm:-mx-6 sm:px-6 shrink-0">
            <Button
              variant="outline"
              type="button"
              onClick={handleSortByTime}
              disabled={rows.length < 2 || saving}
            >
              <ArrowUpDown className="size-4 mr-1.5" />
              Sắp xếp theo giờ
            </Button>
            <div className="flex gap-3">
              <Button variant="outline" type="button" onClick={onClose} disabled={saving}>
                Đóng
              </Button>
              <Button type="submit" disabled={saving || validationErrors.length > 0}>
                {saving ? 'Đang lưu…' : 'Lưu lộ trình'}
              </Button>
            </div>
          </div>
        }
      >
        <div className="space-y-4">
          {/* Vùng thêm điểm dừng mới */}
          <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center bg-muted/30 p-3 rounded-[var(--admin-radius-panel)] border border-border">
            <div className="flex-1">
              <Select
                value={selectedStationToAdd}
                onValueChange={(val) => setSelectedStationToAdd(val ?? '')}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Chọn bến bãi, văn phòng hoặc điểm đón để thêm vào lộ trình" />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {availableStations.map((s) => (
                    <SelectItem key={s.diemDonTraId} value={String(s.diemDonTraId)}>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{s.tenDiem}</span>
                        <span className="font-mono text-xs text-muted-foreground">({s.maDiem})</span>
                        <Badge variant="secondary" className="text-[10px]">
                          {s.loaiDiem === 'BEN_XE'
                            ? 'Bến xe'
                            : s.loaiDiem === 'VAN_PHONG'
                              ? 'Văn phòng'
                              : s.loaiDiem === 'TRUNG_CHUYEN'
                                ? 'Trung chuyển'
                                : s.loaiDiem === 'TRAM_NGHI'
                                  ? 'Trạm nghỉ'
                                  : 'Dọc đường'}
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
              Thêm điểm dừng
            </Button>
          </div>

          {/* Cảnh báo validation nếu có */}
          {validationErrors.length > 0 && (
            <Alert variant="destructive">
              <AlertTriangle className="size-4" />
              <AlertTitle>Cần điều chỉnh trước khi lưu</AlertTitle>
              <AlertDescription>
                <ul className="list-disc list-inside space-y-1 text-xs">
                  {validationErrors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {/* Danh sách các điểm dừng */}
          {rows.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground border rounded-[var(--admin-radius-panel)] border-dashed border-border">
              <Clock className="size-8 mx-auto mb-2 text-muted-foreground/60" />
              <p className="text-sm font-medium">Chưa có điểm dừng nào trong lộ trình.</p>
              <p className="text-xs mt-1">Chọn điểm ở ô phía trên và nhấn "Thêm điểm dừng".</p>
            </div>
          ) : (
            <div className="space-y-3">
              {rows.map((row, index) => {
                const station = enrichedRows[index].station;
                const isStationRestStop = station?.loaiDiem === 'TRAM_NGHI';
                const hasTickets = mode === 'trip' && (row.veCount ?? 0) > 0;
                const clockPreview = calculateClockTimePreview(departureTime, row.phutLech);

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
                          {station?.tenDiem ?? `Điểm #${row.diemDonTraId}`}
                        </span>
                        <span className="font-mono text-xs text-muted-foreground shrink-0">
                          ({station?.maDiem ?? '—'})
                        </span>
                        {station?.loaiDiem === 'TRUNG_CHUYEN' && (
                          <Badge variant="secondary" className="text-[10px]">
                            Trung chuyển
                          </Badge>
                        )}
                        {hasTickets && (
                          <Badge variant="warning" className="text-[10px] gap-1">
                            <Lock className="size-3" />
                            {row.veCount} vé đã chọn
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
                          aria-label="Di chuyển lên"
                        >
                          <ArrowUp className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          type="button"
                          onClick={() => handleMoveRow(index, 'down')}
                          disabled={index === rows.length - 1}
                          aria-label="Di chuyển xuống"
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
                          aria-label={hasTickets ? 'Không thể xóa điểm đã có vé đặt' : 'Xóa điểm này'}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                      {/* Cột 1: Vai trò */}
                      <Field>
                        <FieldLabel className="text-xs text-muted-foreground font-medium">Vai trò</FieldLabel>
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
                            <SelectItem value="DON">Đón khách</SelectItem>
                            <SelectItem value="TRA">Trả khách</SelectItem>
                            <SelectItem value="NGHI">Trạm nghỉ</SelectItem>
                          </SelectContent>
                        </Select>
                      </Field>

                      {/* Cột 2: Phút lệch & Giờ thực tế */}
                      <Field>
                        <div className="flex justify-between items-center">
                          <FieldLabel className="text-xs text-muted-foreground font-medium">Lệch (phút)</FieldLabel>
                          <span className="font-semibold text-primary font-mono">{clockPreview}</span>
                        </div>
                        <Input
                          type="number"
                          className="h-8 text-xs font-mono"
                          value={row.phutLech}
                          onChange={(e) => handleUpdateRow(index, { phutLech: Number(e.target.value) })}
                          disabled={hasTickets}
                          placeholder="Số phút"
                        />
                      </Field>

                      {/* Cột 3: Phụ phí (VNĐ) */}
                      <Field>
                        <FieldLabel className="text-xs text-muted-foreground font-medium">Phụ phí (đ)</FieldLabel>
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

                      {/* Cột 4: Có mặt trước (phút) */}
                      <Field>
                        <FieldLabel className="text-xs text-muted-foreground font-medium">Có mặt trước (phút)</FieldLabel>
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

                    {/* Dòng ghi chú & nhận khách */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-1">
                      <div className="flex-1">
                        <Input
                          type="text"
                          className="h-8 text-xs"
                          placeholder="Ghi chú đón trả (VD: Cột B1 ga quốc tế, cổng bến xe...)"
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
                          Mở nhận khách
                        </label>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </ResourceSheetForm>
    </ResourceSheet>
  );
}
