'use client';

import {
  ArrowLeft,
  Clock,
  Compass,
  LoaderCircle,
  AlertCircle,
  Route as RouteIcon,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { ResourceNotice } from '@/components/admin/resource-ui';
import { Button } from '@/components/ui/action-button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/status-badge';
import { getRouteStops } from '@/features/stops/services/stop-service';
import type { RouteStopItem } from '@/features/stops/types/stop';
import { useTripLookupOptions } from '../hooks/use-trip-lookup-options';
import { createTrip, TripApiError } from '../services/trip-service';

type FormValues = {
  routeId: string;
  vehicleId: string;
  departureDate: string;
  departureTime: string;
  acceptsShipments: boolean;
  copyRouteStops: boolean;
};

type FormField = keyof FormValues;
type FieldErrors = Partial<Record<FormField, string>>;

function addMinutesToTime(timeStr: string, minutesToAdd: number): string {
  if (!timeStr || !/^([01]\d|2[0-3]):[0-5]\d/.test(timeStr)) return '--:--';
  const [hStr, mStr] = timeStr.split(':');
  const totalMinutes = (parseInt(hStr ?? '0', 10) * 60 + parseInt(mStr ?? '0', 10) + minutesToAdd) % 1440;
  const normalizedMinutes = totalMinutes < 0 ? totalMinutes + 1440 : totalMinutes;
  const hours = Math.floor(normalizedMinutes / 60);
  const minutes = normalizedMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

export function TripCreateWorkspace() {
  const router = useRouter();
  const { routeOptions, vehicleOptions } = useTripLookupOptions();
  const formRef = useRef<HTMLFormElement>(null);
  const submittingRef = useRef(false);

  const [values, setValues] = useState<FormValues>({
    routeId: '',
    vehicleId: '',
    departureDate: '',
    departureTime: '',
    acceptsShipments: true,
    copyRouteStops: true,
  });

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Lộ trình mẫu preview khi chọn tuyến
  const [stops, setStops] = useState<RouteStopItem[]>([]);
  const [loadingStops, setLoadingStops] = useState(false);

  useEffect(() => {
    const routeIdNum = Number(values.routeId);
    if (!Number.isSafeInteger(routeIdNum) || routeIdNum < 1) {
      return;
    }

    let active = true;
    getRouteStops(routeIdNum)
      .then((data) => {
        if (active) {
          setStops(data);
        }
      })
      .catch(() => {
        if (active) {
          setStops([]);
        }
      })
      .finally(() => {
        if (active) {
          setLoadingStops(false);
        }
      });

    return () => {
      active = false;
    };
  }, [values.routeId]);

  function updateField<F extends FormField>(field: F, value: FormValues[F]) {
    setValues((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
    setFormError(null);
    if (field === 'routeId') {
      if (!value) {
        setStops([]);
      } else {
        setLoadingStops(true);
      }
    }
  }

  function validate(): FieldErrors {
    const errors: FieldErrors = {};
    const routeId = Number(values.routeId);
    const vehicleId = Number(values.vehicleId);

    if (!Number.isSafeInteger(routeId) || routeId < 1) {
      errors.routeId = 'Vui lòng chọn tuyến xe.';
    }

    if (!Number.isSafeInteger(vehicleId) || vehicleId < 1) {
      errors.vehicleId = 'Vui lòng chọn xe phục vụ.';
    }

    if (!values.departureDate.trim()) {
      errors.departureDate = 'Vui lòng chọn ngày khởi hành.';
    }

    if (!values.departureTime.trim()) {
      errors.departureTime = 'Vui lòng chọn giờ khởi hành.';
    }

    return errors;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submittingRef.current) return;

    setFormError(null);
    const errors = validate();
    setFieldErrors(errors);

    if (Object.keys(errors).length > 0) {
      requestAnimationFrame(() =>
        formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(),
      );
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);

    try {
      const departureTimeFormatted =
        values.departureTime.length === 5 ? `${values.departureTime}:00` : values.departureTime;

      const savedTrip = await createTrip({
        routeId: Number(values.routeId),
        vehicleId: Number(values.vehicleId),
        departureDate: values.departureDate.trim(),
        departureTime: departureTimeFormatted,
        acceptsShipments: values.acceptsShipments,
        copyRouteStops: values.copyRouteStops,
      });

      toast.success(`Đã tạo chuyến xe ${savedTrip.code} thành công!`);
      router.push(`/trips/${savedTrip.tripId}`);
    } catch (requestError: unknown) {
      if (requestError instanceof TripApiError) {
        setFormError(requestError.message);
        toast.error(requestError.message);
      } else if (requestError instanceof TypeError) {
        toast.error('Không thể kết nối đến máy chủ API. Vui lòng thử lại.');
      } else {
        const message =
          requestError instanceof Error ? requestError.message : 'Không thể tạo chuyến xe. Vui lòng thử lại.';
        setFormError(message);
        toast.error(message);
      }
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  const donCount = stops.filter((s) => s.loaiDiem === 'DON').length;
  const traCount = stops.filter((s) => s.loaiDiem === 'TRA').length;
  const nghiCount = stops.filter((s) => s.loaiDiem === 'NGHI').length;

  return (
    <div className="admin-page-content admin-ui space-y-6">
      <AdminPageHeader
        actions={
          <div className="flex items-center gap-2">
            <Button disabled={submitting} render={<Link href="/trips" />} variant="outline">
              <ArrowLeft aria-hidden="true" className="size-4" />
              Quay lại danh sách
            </Button>
          </div>
        }
        eyebrow="QUẢN LÝ CHUYẾN XE"
        title="Thêm chuyến xe mới"
        titleId="create-trip-title"
      />

      <form className="space-y-6" noValidate onSubmit={handleSubmit} ref={formRef}>
        {formError && <ResourceNotice kind="error">{formError}</ResourceNotice>}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Cột trái: Thông tin chuyến xe */}
          <div className="space-y-6 lg:col-span-5 xl:col-span-4">
            <Card className="gap-0 py-0 shadow-sm">
              <CardHeader className="border-b p-5">
                <CardTitle className="text-base flex items-center gap-2">
                  <Compass className="size-5 text-primary" />
                  Thông tin chuyến xe
                </CardTitle>
                <CardDescription>
                  Chọn tuyến đường, phương tiện phục vụ và thời gian khởi hành.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 p-5">
                {/* Tuyến xe */}
                <Field data-invalid={Boolean(fieldErrors.routeId)}>
                  <FieldLabel htmlFor="create-trip-route">
                    Tuyến xe <span aria-hidden="true">*</span>
                  </FieldLabel>
                  <Select
                    disabled={submitting || routeOptions.status !== 'success'}
                    onValueChange={(val) => updateField('routeId', val ?? '')}
                    value={values.routeId}
                  >
                    <SelectTrigger
                      aria-describedby={fieldErrors.routeId ? 'create-trip-route-error' : undefined}
                      aria-invalid={Boolean(fieldErrors.routeId)}
                      id="create-trip-route"
                    >
                      <SelectValue placeholder="Chọn tuyến xe">
                        {routeOptions.status === 'success'
                          ? routeOptions.options.find((opt) => String(opt.id) === values.routeId)?.label
                          : 'Đang tải tuyến xe…'}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent className="max-h-64">
                      {routeOptions.status === 'success' &&
                        routeOptions.options.map((option) => (
                          <SelectItem key={option.id} value={String(option.id)}>
                            {option.label}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <FieldError id="create-trip-route-error">{fieldErrors.routeId}</FieldError>
                </Field>

                {/* Xe phục vụ */}
                <Field data-invalid={Boolean(fieldErrors.vehicleId)}>
                  <FieldLabel htmlFor="create-trip-vehicle">
                    Xe phục vụ <span aria-hidden="true">*</span>
                  </FieldLabel>
                  <Select
                    disabled={submitting || vehicleOptions.status !== 'success'}
                    onValueChange={(val) => updateField('vehicleId', val ?? '')}
                    value={values.vehicleId}
                  >
                    <SelectTrigger
                      aria-describedby={fieldErrors.vehicleId ? 'create-trip-vehicle-error' : undefined}
                      aria-invalid={Boolean(fieldErrors.vehicleId)}
                      id="create-trip-vehicle"
                    >
                      <SelectValue placeholder="Chọn xe phục vụ">
                        {vehicleOptions.status === 'success'
                          ? vehicleOptions.options.find((opt) => String(opt.id) === values.vehicleId)?.label
                          : 'Đang tải xe…'}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent className="max-h-64">
                      {vehicleOptions.status === 'success' &&
                        vehicleOptions.options.map((option) => (
                          <SelectItem key={option.id} value={String(option.id)}>
                            {option.label}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <FieldError id="create-trip-vehicle-error">{fieldErrors.vehicleId}</FieldError>
                </Field>

                {/* Lịch khởi hành */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field data-invalid={Boolean(fieldErrors.departureDate)}>
                    <FieldLabel htmlFor="create-trip-date">
                      Ngày khởi hành <span aria-hidden="true">*</span>
                    </FieldLabel>
                    <Input
                      aria-describedby={fieldErrors.departureDate ? 'create-trip-date-error' : undefined}
                      aria-invalid={Boolean(fieldErrors.departureDate)}
                      disabled={submitting}
                      id="create-trip-date"
                      onChange={(e) => updateField('departureDate', e.target.value)}
                      type="date"
                      value={values.departureDate}
                    />
                    <FieldError id="create-trip-date-error">{fieldErrors.departureDate}</FieldError>
                  </Field>

                  <Field data-invalid={Boolean(fieldErrors.departureTime)}>
                    <FieldLabel htmlFor="create-trip-time">
                      Giờ khởi hành <span aria-hidden="true">*</span>
                    </FieldLabel>
                    <Input
                      aria-describedby={fieldErrors.departureTime ? 'create-trip-time-error' : undefined}
                      aria-invalid={Boolean(fieldErrors.departureTime)}
                      disabled={submitting}
                      id="create-trip-time"
                      onChange={(e) => updateField('departureTime', e.target.value)}
                      type="time"
                      value={values.departureTime}
                    />
                    <FieldError id="create-trip-time-error">{fieldErrors.departureTime}</FieldError>
                  </Field>
                </div>

                {/* Tùy chọn mở rộng */}
                <div className="space-y-3 pt-2 border-t">
                  <label className="flex items-center gap-2.5 cursor-pointer text-sm font-medium select-none">
                    <Checkbox
                      checked={values.copyRouteStops}
                      disabled={submitting}
                      onCheckedChange={(checked) => updateField('copyRouteStops', Boolean(checked))}
                    />
                    <span>Tự động sao chép lộ trình từ khuôn mẫu tuyến</span>
                  </label>

                  <label className="flex items-center gap-2.5 cursor-pointer text-sm font-medium select-none">
                    <Checkbox
                      checked={values.acceptsShipments}
                      disabled={submitting}
                      onCheckedChange={(checked) => updateField('acceptsShipments', Boolean(checked))}
                    />
                    <span>Mở nhận vận chuyển hàng hóa trên chuyến này</span>
                  </label>
                </div>
              </CardContent>
            </Card>

            {/* Action buttons */}
            <Card className="gap-0 py-0 shadow-sm border-primary/20 bg-primary/5">
              <CardContent className="p-5 flex flex-col gap-3">
                <Button
                  aria-busy={submitting}
                  className="w-full"
                  disabled={submitting}
                  size="default"
                  type="submit"
                >
                  {submitting && (
                    <LoaderCircle aria-hidden="true" className="size-4 motion-safe:animate-spin" />
                  )}
                  {submitting ? 'Đang tạo chuyến…' : 'Hoàn tất & Tạo chuyến'}
                </Button>
                <Button
                  className="w-full"
                  disabled={submitting}
                  render={<Link href="/trips" />}
                  variant="outline"
                >
                  Hủy thao tác
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Cột phải: Xem và cấu hình lộ trình điểm đón / trả */}
          <div className="space-y-6 lg:col-span-7 xl:col-span-8">
            <Card className="gap-0 py-0 shadow-sm">
              <CardHeader className="border-b p-5">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      <RouteIcon className="size-5 text-primary" />
                      Lộ trình điểm đón / trả dự kiến
                    </CardTitle>
                    <CardDescription>
                      {values.departureTime
                        ? `Giờ mốc xuất bến: ${values.departureTime}. Giờ dự kiến đón/trả được tự động tính theo phút lệch.`
                        : 'Giờ đón trả dự kiến sẽ hiển thị khi bạn nhập giờ khởi hành.'}
                    </CardDescription>
                  </div>
                  {stops.length > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Badge variant="outline" className="text-xs">
                        {donCount} đón
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {traCount} trả
                      </Badge>
                      {nghiCount > 0 && (
                        <Badge variant="outline" className="text-xs">
                          {nghiCount} nghỉ
                        </Badge>
                      )}
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-5">
                {!values.routeId ? (
                  <div className="flex flex-col items-center justify-center p-12 text-center border border-dashed rounded-lg bg-muted/10">
                    <Compass className="size-10 text-muted-foreground/50 mb-3" />
                    <p className="text-sm font-semibold text-foreground">Chưa chọn tuyến xe</p>
                    <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                      Vui lòng chọn tuyến xe ở cột bên trái để tải và xem trước toàn bộ danh sách điểm đón, điểm trả và trạm dừng.
                    </p>
                  </div>
                ) : loadingStops ? (
                  <div className="flex items-center justify-center p-12 gap-3 text-muted-foreground">
                    <LoaderCircle className="size-5 motion-safe:animate-spin" />
                    <span className="text-sm">Đang tải lộ trình trạm dừng của tuyến…</span>
                  </div>
                ) : stops.length === 0 ? (
                  <div className="flex flex-col items-center justify-center p-10 text-center border border-dashed rounded-lg bg-amber-500/5 border-amber-500/30">
                    <AlertCircle className="size-8 text-amber-600 mb-2" />
                    <p className="text-sm font-semibold text-amber-800 dark:text-amber-400">
                      Tuyến xe này chưa cấu hình lộ trình mẫu
                    </p>
                    <p className="text-xs text-muted-foreground mt-1 max-w-md">
                      Chuyến xe vẫn có thể tạo bình thường. Bạn có thể bổ sung các điểm đón trả cho chuyến xe bất kỳ lúc nào tại trang chi tiết chuyến sau khi tạo.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Danh sách trạm dừng theo thứ tự hành trình ({stops.length} điểm)
                    </p>
                    <div className="divide-y rounded-lg border bg-card">
                      {stops.map((stop, index) => {
                        const estimatedTime = addMinutesToTime(values.departureTime, stop.phutLech);
                        return (
                          <div
                            key={stop.diemDonTraId || index}
                            className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 gap-3 hover:bg-muted/30 transition-colors"
                          >
                            <div className="flex items-start gap-3 min-w-0">
                              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold text-muted-foreground mt-0.5">
                                {index + 1}
                              </span>
                              <div className="min-w-0 space-y-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-semibold text-sm">
                                    {stop.diemDonTra?.tenDiem ?? `Trạm #${stop.diemDonTraId}`}
                                  </span>
                                  <Badge
                                    variant={
                                      stop.loaiDiem === 'DON'
                                        ? 'default'
                                        : stop.loaiDiem === 'TRA'
                                          ? 'secondary'
                                          : 'outline'
                                    }
                                    className="text-[11px]"
                                  >
                                    {stop.loaiDiem === 'DON'
                                      ? 'Đón khách'
                                      : stop.loaiDiem === 'TRA'
                                        ? 'Trả khách'
                                        : 'Trạm nghỉ'}
                                  </Badge>
                                  {stop.phuPhi > 0 && (
                                    <Badge variant="warning" className="text-[11px]">
                                      +{stop.phuPhi.toLocaleString('vi-VN')} đ
                                    </Badge>
                                  )}
                                </div>
                                {stop.diemDonTra?.diaChi && (
                                  <p className="text-xs text-muted-foreground truncate max-w-md">
                                    {stop.diemDonTra.diaChi}
                                  </p>
                                )}
                                {stop.ghiChu && (
                                  <p className="text-xs text-muted-foreground/80 italic">
                                    Ghi chú: {stop.ghiChu}
                                  </p>
                                )}
                              </div>
                            </div>

                            <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center shrink-0 pl-9 sm:pl-0 border-t sm:border-t-0 pt-2 sm:pt-0">
                              <div className="flex items-center gap-1.5 font-mono text-sm font-bold text-primary">
                                <Clock className="size-3.5" />
                                <span>{estimatedTime}</span>
                              </div>
                              <span className="text-[11px] text-muted-foreground">
                                {stop.phutLech >= 0 ? `+${stop.phutLech} phút` : `${stop.phutLech} phút`}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </form>
    </div>
  );
}
