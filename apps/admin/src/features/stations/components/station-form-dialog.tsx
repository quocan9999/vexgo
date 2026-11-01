'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { ResourceSheetForm } from '@/components/admin/resource-sheet-form';
import { ResourceSheet } from '@/components/admin/resource-ui';
import { Field as FieldRoot, FieldLabel, FieldError } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/action-button';
import { getLocations, type LocationOption } from '@/features/locations/services/location-service';
import { createStation, updateStation, getStations, StationApiError } from '../services/station-service';
import type { Station, StationType } from '../types/station';

interface StationFormDialogProps {
  station?: Station;
  onClose: () => void;
  onSaved: (station: Station) => void;
}

const STATION_TYPE_LABELS: Record<StationType, string> = {
  BEN_XE: 'Bến xe',
  VAN_PHONG: 'Văn phòng đón/trả',
  DIEM_DON_TRA: 'Điểm đón trả dọc đường',
  TRUNG_CHUYEN: 'Điểm trung chuyển',
  TRAM_NGHI: 'Trạm nghỉ',
};

export function StationFormDialog({
  station,
  onClose,
  onSaved,
}: StationFormDialogProps) {
  const isEditing = Boolean(station);
  const [maDiem, setMaDiem] = useState(station?.maDiem ?? '');
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

  useEffect(() => {
    getLocations()
      .then((items) => {
        // Chỉ lấy các địa danh cũ để Admin chọn theo đúng chỉ đạo
        const legacyOnly = items.filter((item) => item.isLegacy);
        setLegacyLocations(legacyOnly);
      })
      .catch(() => {
        toast.error('Không thể tải danh mục địa phương.');
      });
  }, []);

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

    if (!maDiem.trim()) newErrors.maDiem = 'Vui lòng nhập mã điểm.';
    if (!tenDiem.trim()) newErrors.tenDiem = 'Vui lòng nhập tên điểm.';
    if (!diaChi.trim()) newErrors.diaChi = 'Vui lòng nhập địa chỉ.';
    if (!diaDiemCuId) newErrors.diaDiemCuId = 'Vui lòng chọn địa phương (cũ).';
    if (loaiDiem === 'TRUNG_CHUYEN' && !benTrungChuyenId) {
      newErrors.benTrungChuyenId = 'Vui lòng chọn bến đích trung chuyển.';
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
        toast.success('Cập nhật điểm đón trả thành công.');
        onSaved(updated);
      } else {
        const created = await createStation({
          maDiem: maDiem.trim().toUpperCase(),
          tenDiem: tenDiem.trim(),
          loaiDiem,
          diaChi: diaChi.trim(),
          diaDiemCuId: diaDiemCuId!,
          benTrungChuyenId: loaiDiem === 'TRUNG_CHUYEN' ? benTrungChuyenId : null,
          soDienThoai: soDienThoai.trim() || undefined,
        });
        toast.success('Thêm mới điểm đón trả thành công.');
        onSaved(created);
      }
      onClose();
    } catch (err) {
      if (err instanceof StationApiError) {
        toast.error(err.message);
      } else {
        toast.error('Có lỗi xảy ra khi lưu thông tin.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <ResourceSheet
      title={isEditing ? 'Chỉnh sửa điểm đón trả' : 'Thêm điểm đón trả mới'}
      description="Quản lý bến bãi, văn phòng và các điểm trung chuyển của nhà xe."
      busy={loading}
      preventDismiss={loading}
      onClose={onClose}
    >
      <ResourceSheetForm
        onSubmit={handleSubmit}
        footer={
          <div className="-mx-4 flex justify-end gap-3 border-t bg-popover px-4 py-4 sm:-mx-6 sm:px-6 shrink-0">
            <Button variant="outline" type="button" onClick={onClose} disabled={loading}>
              Hủy
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Đang lưu…' : isEditing ? 'Cập nhật' : 'Thêm mới'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <FieldRoot data-invalid={Boolean(errors.maDiem)}>
            <FieldLabel htmlFor="station-code">
              Mã điểm <span aria-hidden>*</span>
            </FieldLabel>
            <Input
              id="station-code"
              value={maDiem}
              onChange={(e) => setMaDiem(e.target.value)}
              placeholder="VD: BX-MD, VP-Q1..."
              disabled={isEditing || loading}
            />
            {errors.maDiem && <FieldError>{errors.maDiem}</FieldError>}
          </FieldRoot>

          <FieldRoot data-invalid={Boolean(errors.tenDiem)}>
            <FieldLabel htmlFor="station-name">
              Tên điểm đón / trả <span aria-hidden>*</span>
            </FieldLabel>
            <Input
              id="station-name"
              value={tenDiem}
              onChange={(e) => setTenDiem(e.target.value)}
              placeholder="VD: Bến xe Miền Đông mới, Văn phòng Quận 1..."
              disabled={loading}
            />
            {errors.tenDiem && <FieldError>{errors.tenDiem}</FieldError>}
          </FieldRoot>

          <FieldRoot>
            <FieldLabel htmlFor="station-type">
              Loại điểm <span aria-hidden>*</span>
            </FieldLabel>
            <Select
              value={loaiDiem}
              onValueChange={(val) => setLoaiDiem(val as StationType)}
              disabled={loading}
            >
              <SelectTrigger id="station-type">
                <SelectValue placeholder="Chọn loại điểm">
                  {STATION_TYPE_LABELS[loaiDiem] ?? 'Chọn loại điểm'}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="BEN_XE">Bến xe</SelectItem>
                <SelectItem value="VAN_PHONG">Văn phòng đón/trả</SelectItem>
                <SelectItem value="DIEM_DON_TRA">Điểm đón trả dọc đường</SelectItem>
                <SelectItem value="TRUNG_CHUYEN">Điểm trung chuyển</SelectItem>
                <SelectItem value="TRAM_NGHI">Trạm nghỉ</SelectItem>
              </SelectContent>
            </Select>
          </FieldRoot>

          {loaiDiem === 'TRUNG_CHUYEN' && (
            <FieldRoot data-invalid={Boolean(errors.benTrungChuyenId)}>
              <FieldLabel htmlFor="station-target">
                Bến đích trung chuyển <span aria-hidden>*</span>
              </FieldLabel>
              <Select
                value={benTrungChuyenId ? String(benTrungChuyenId) : ''}
                onValueChange={(val) => setBenTrungChuyenId(Number(val))}
                disabled={loading}
              >
                <SelectTrigger id="station-target">
                  <SelectValue placeholder="Chọn bến xe hoặc văn phòng đích">
                    {(() => {
                      const matched = targetStationOptions.find(
                        (t) => t.diemDonTraId === benTrungChuyenId,
                      );
                      return matched ? `${matched.tenDiem} (${matched.maDiem})` : 'Chọn bến xe hoặc văn phòng đích';
                    })()}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {targetStationOptions.map((st) => (
                    <SelectItem key={st.diemDonTraId} value={String(st.diemDonTraId)}>
                      {st.tenDiem} ({st.maDiem}) - {st.loaiDiem === 'BEN_XE' ? 'Bến xe' : 'Văn phòng'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="mt-1 text-[12px] text-muted-foreground">
                * Xe trung chuyển sẽ đưa đón hành khách kết nối giữa điểm này và bến đích đã chọn.
              </p>
              {errors.benTrungChuyenId && <FieldError>{errors.benTrungChuyenId}</FieldError>}
            </FieldRoot>
          )}

          <FieldRoot data-invalid={Boolean(errors.diaDiemCuId)}>
            <FieldLabel htmlFor="station-location">
              Khu vực / Tỉnh thành (trước sáp nhập) <span aria-hidden>*</span>
            </FieldLabel>
            <Select
              value={diaDiemCuId ? String(diaDiemCuId) : ''}
              onValueChange={(val) => setDiaDiemCuId(Number(val))}
              disabled={loading}
            >
              <SelectTrigger id="station-location">
                <SelectValue placeholder="Chọn tỉnh thành (trước sáp nhập)">
                  {(() => {
                    const matchedName =
                      legacyLocations.find((loc) => loc.diaDiemId === diaDiemCuId)?.name ??
                      station?.diaDiemCu?.tenDiaDiem;
                    if (!matchedName) return 'Chọn tỉnh thành (trước sáp nhập)';
                    return (
                      <span className="flex items-center gap-1.5">
                        <span>{matchedName}</span>
                        <span className="inline-flex items-center rounded bg-slate-600 px-1 py-0.2 text-[10px] font-bold uppercase text-white">
                          CŨ
                        </span>
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
                      <span className="inline-flex items-center rounded bg-slate-600 px-1 py-0.2 text-[10px] font-bold uppercase text-white">
                        CŨ
                      </span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="mt-1 text-[12px] text-muted-foreground">
              * Hệ thống sẽ tự động liên kết tỉnh thành sáp nhập tương ứng từ bảng master sáp nhập.
            </p>
            {errors.diaDiemCuId && <FieldError>{errors.diaDiemCuId}</FieldError>}
          </FieldRoot>

          <FieldRoot data-invalid={Boolean(errors.diaChi)}>
            <FieldLabel htmlFor="station-address">
              Địa chỉ chi tiết <span aria-hidden>*</span>
            </FieldLabel>
            <Input
              id="station-address"
              value={diaChi}
              onChange={(e) => setDiaChi(e.target.value)}
              placeholder="Số nhà, tên đường, phường/xã..."
              disabled={loading}
            />
            {errors.diaChi && <FieldError>{errors.diaChi}</FieldError>}
          </FieldRoot>

          <FieldRoot>
            <FieldLabel htmlFor="station-phone">Số điện thoại liên hệ</FieldLabel>
            <Input
              id="station-phone"
              value={soDienThoai}
              onChange={(e) => setSoDienThoai(e.target.value)}
              placeholder="VD: 19006067 hoặc 028..."
              disabled={loading}
            />
          </FieldRoot>
        </div>
      </ResourceSheetForm>
    </ResourceSheet>
  );
}
