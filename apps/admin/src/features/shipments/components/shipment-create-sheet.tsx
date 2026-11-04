'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Plus, Trash2, PackagePlus, AlertCircle, LoaderCircle } from 'lucide-react';
import { toast } from 'sonner';
import { ResourceSheet } from '@/components/admin/resource-ui';
import { ResourceSheetForm } from '@/components/admin/resource-sheet-form';
import { ResourceNotice } from '@/components/admin/resource-ui';
import { Button } from '@/components/ui/action-button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Field as FieldRoot, FieldLabel, FieldError } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  createAdminShipment,
  getAdminRoutePointsByRoute,
  getAdminShipmentCategories,
  getAdminShipmentRouteOptions,
  quoteAdminShipment,
  type AdminCargoCategory,
  type AdminRoutePointOption,
  type AdminShipmentQuoteResult,
  type AdminShipmentRouteOption,
  type CreateAdminShipmentResult,
} from '../services/shipment-service';
import { formatCurrency } from './shipment-details';

interface CargoItemDraft {
  id: string;
  name: string;
  categoryId: string;
  quantity: string;
  weight: string;
  length: string;
  width: string;
  height: string;
  note: string;
}

export function ShipmentCreateSheet({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (result: CreateAdminShipmentResult) => void;
}) {
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [initialError, setInitialError] = useState<string | null>(null);
  const [routes, setRoutes] = useState<AdminShipmentRouteOption[]>([]);
  const [categories, setCategories] = useState<AdminCargoCategory[]>([]);

  // Selected route and points
  const [routeId, setRouteId] = useState<string>('');
  const [pointsLoading, setPointsLoading] = useState(false);
  const [senderPoints, setSenderPoints] = useState<AdminRoutePointOption[]>([]);
  const [receiverPoints, setReceiverPoints] = useState<AdminRoutePointOption[]>([]);
  const [senderPointId, setSenderPointId] = useState<string>('');
  const [receiverPointId, setReceiverPointId] = useState<string>('');

  // Sender & Receiver
  const [senderName, setSenderName] = useState('');
  const [senderPhone, setSenderPhone] = useState('');
  const [senderEmail, setSenderEmail] = useState('');

  const [receiverName, setReceiverName] = useState('');
  const [receiverPhone, setReceiverPhone] = useState('');
  const [receiverCccd, setReceiverCccd] = useState('');

  // Items
  const [items, setItems] = useState<CargoItemDraft[]>([
    {
      id: 'item-1',
      name: '',
      categoryId: '',
      quantity: '1',
      weight: '',
      length: '',
      width: '',
      height: '',
      note: '',
    },
  ]);

  // Options & pricing
  const [isFragile, setIsFragile] = useState(false);
  const [isValuable, setIsValuable] = useState(false);
  const [freightPayer, setFreightPayer] = useState<'NGUOI_GUI' | 'NGUOI_NHAN'>('NGUOI_GUI');
  const [acceptAtCounter, setAcceptAtCounter] = useState(true);
  const [collectPaymentAtCounter, setCollectPaymentAtCounter] = useState(true);
  const [shipmentNote, setShipmentNote] = useState('');

  // Quoting state
  const [quote, setQuote] = useState<AdminShipmentQuoteResult | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);

  // Form submission
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const errorSummaryRef = useRef<HTMLDivElement>(null);
  const quoteAbortRef = useRef<AbortController | null>(null);

  // Load initial routes and cargo categories
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        setLoadingInitial(true);
        setInitialError(null);
        const [routesData, catsData] = await Promise.all([
          getAdminShipmentRouteOptions(controller.signal),
          getAdminShipmentCategories(controller.signal),
        ]);
        setRoutes(routesData);
        setCategories(catsData);
        if (routesData.length > 0) {
          setRouteId(String(routesData[0].routeId));
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setInitialError(
            err instanceof Error
              ? err.message
              : 'Không thể tải dữ liệu tuyến đường hoặc danh mục hàng.',
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoadingInitial(false);
        }
      }
    }
    load();
    return () => controller.abort();
  }, []);

  // Load route points when route changes
  useEffect(() => {
    if (!routeId) {
      setSenderPoints([]);
      setReceiverPoints([]);
      setSenderPointId('');
      setReceiverPointId('');
      return;
    }
    const controller = new AbortController();
    async function loadPoints() {
      try {
        setPointsLoading(true);
        const res = await getAdminRoutePointsByRoute(Number(routeId), controller.signal);
        setSenderPoints(res.senderPoints);
        setReceiverPoints(res.receiverPoints);
        if (res.senderPoints.length > 0) {
          setSenderPointId(String(res.senderPoints[0].id));
        } else {
          setSenderPointId('');
        }
        if (res.receiverPoints.length > 0) {
          setReceiverPointId(String(res.receiverPoints[0].id));
        } else {
          setReceiverPointId('');
        }
      } catch {
        if (!controller.signal.aborted) {
          setSenderPoints([]);
          setReceiverPoints([]);
          setSenderPointId('');
          setReceiverPointId('');
        }
      } finally {
        if (!controller.signal.aborted) {
          setPointsLoading(false);
        }
      }
    }
    loadPoints();
    return () => controller.abort();
  }, [routeId]);

  // Synchronize collectPaymentAtCounter with acceptAtCounter and freightPayer
  useEffect(() => {
    if (!acceptAtCounter || freightPayer === 'NGUOI_NHAN') {
      setCollectPaymentAtCounter(false);
    } else {
      setCollectPaymentAtCounter(true);
    }
  }, [acceptAtCounter, freightPayer]);

  // Auto-quote debounced calculation
  useEffect(() => {
    if (!routeId || !senderPointId || !receiverPointId) {
      setQuote(null);
      return;
    }
    const validItems = items.filter(
      (i) => i.name.trim() && Number(i.weight) > 0 && Number(i.quantity) > 0,
    );
    if (validItems.length === 0) {
      setQuote(null);
      setQuoteError(null);
      return;
    }

    if (quoteAbortRef.current) {
      quoteAbortRef.current.abort();
    }
    const controller = new AbortController();
    quoteAbortRef.current = controller;

    const timer = setTimeout(async () => {
      try {
        setQuoting(true);
        setQuoteError(null);
        const quoteRes = await quoteAdminShipment(
          {
            routeId: Number(routeId),
            senderPointId: Number(senderPointId),
            receiverPointId: Number(receiverPointId),
            isFragile,
            isValuable,
            items: validItems.map((item) => ({
              name: item.name.trim(),
              quantity: Math.max(1, parseInt(item.quantity, 10) || 1),
              weight: parseFloat(item.weight),
              length: item.length ? parseFloat(item.length) : undefined,
              width: item.width ? parseFloat(item.width) : undefined,
              height: item.height ? parseFloat(item.height) : undefined,
              loaiHangHoaId: item.categoryId ? Number(item.categoryId) : undefined,
            })),
          },
          controller.signal,
        );
        if (!controller.signal.aborted) {
          setQuote(quoteRes);
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setQuote(null);
          setQuoteError(
            err instanceof Error ? err.message : 'Không tính được cước phí.',
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setQuoting(false);
        }
      }
    }, 350);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [
    routeId,
    senderPointId,
    receiverPointId,
    items,
    isFragile,
    isValuable,
  ]);

  function handleAddItem() {
    setItems((curr) => [
      ...curr,
      {
        id: `item-${Date.now()}`,
        name: '',
        categoryId: '',
        quantity: '1',
        weight: '',
        length: '',
        width: '',
        height: '',
        note: '',
      },
    ]);
  }

  function handleRemoveItem(id: string) {
    if (items.length <= 1) return;
    setItems((curr) => curr.filter((i) => i.id !== id));
  }

  function handleItemChange(id: string, field: keyof CargoItemDraft, value: string) {
    setItems((curr) =>
      curr.map((item) => (item.id === id ? { ...item, [field]: value } : item)),
    );
  }

  function validate(): Record<string, string> {
    const errs: Record<string, string> = {};
    if (!routeId) errs.routeId = 'Vui lòng chọn tuyến xe.';
    if (!senderPointId) errs.senderPointId = 'Vui lòng chọn điểm gửi hàng.';
    if (!receiverPointId) errs.receiverPointId = 'Vui lòng chọn điểm nhận hàng.';

    if (!senderName.trim()) errs.senderName = 'Họ tên người gửi không được để trống.';
    if (!senderPhone.trim()) {
      errs.senderPhone = 'Số điện thoại người gửi không được để trống.';
    } else if (!/^(?:0\d{9,10}|\+?84\d{9,10})$/.test(senderPhone.trim())) {
      errs.senderPhone = 'Số điện thoại người gửi không hợp lệ (10-11 số).';
    }

    if (!receiverName.trim()) errs.receiverName = 'Họ tên người nhận không được để trống.';
    if (!receiverPhone.trim()) {
      errs.receiverPhone = 'Số điện thoại người nhận không được để trống.';
    } else if (!/^(?:0\d{9,10}|\+?84\d{9,10})$/.test(receiverPhone.trim())) {
      errs.receiverPhone = 'Số điện thoại người nhận không hợp lệ (10-11 số).';
    }

    if (items.length === 0) {
      errs.items = 'Vui lòng thêm ít nhất một kiện hàng.';
    } else {
      items.forEach((item, index) => {
        if (!item.name.trim()) {
          errs[`item_${index}_name`] = `Tên kiện hàng #${index + 1} không được để trống.`;
        }
        const w = parseFloat(item.weight);
        if (Number.isNaN(w) || w <= 0) {
          errs[`item_${index}_weight`] = `Khối lượng kiện #${index + 1} phải lớn hơn 0 kg.`;
        }
        const q = parseInt(item.quantity, 10);
        if (Number.isNaN(q) || q < 1) {
          errs[`item_${index}_quantity`] = `Số lượng kiện #${index + 1} phải từ 1 trở lên.`;
        }
        // Dimensions check: either all 3 provided or all empty
        const hasAnyDim = Boolean(item.length || item.width || item.height);
        const hasAllDim = Boolean(item.length && item.width && item.height);
        if (hasAnyDim && !hasAllDim) {
          errs[`item_${index}_dimensions`] =
            `Kiện #${index + 1}: Vui lòng nhập đủ cả 3 chiều Dài x Rộng x Cao hoặc để trống cả 3.`;
        }
      });
    }

    return errs;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    setSubmitError(null);
    const validationErrors = validate();
    setErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) {
      setTimeout(() => {
        errorSummaryRef.current?.focus();
      }, 0);
      return;
    }

    setSubmitting(true);
    try {
      const idempotencyKey = `counter-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      const payload = {
        routeId: Number(routeId),
        senderPointId: Number(senderPointId),
        receiverPointId: Number(receiverPointId),
        sender: {
          fullName: senderName.trim(),
          phoneNumber: senderPhone.trim(),
          email: senderEmail.trim() || undefined,
        },
        receiver: {
          fullName: receiverName.trim(),
          phoneNumber: receiverPhone.trim(),
          cccd: receiverCccd.trim() || undefined,
        },
        items: items.map((i) => ({
          name: i.name.trim(),
          quantity: parseInt(i.quantity, 10) || 1,
          weight: parseFloat(i.weight),
          length: i.length ? parseFloat(i.length) : undefined,
          width: i.width ? parseFloat(i.width) : undefined,
          height: i.height ? parseFloat(i.height) : undefined,
          note: i.note.trim() || undefined,
          loaiHangHoaId: i.categoryId ? Number(i.categoryId) : undefined,
        })),
        isFragile,
        isValuable,
        note: shipmentNote.trim() || undefined,
        freightPayer,
        paymentMethod: 'TAI_BEN' as const,
        acceptAtCounter,
        collectPaymentAtCounter,
      };

      const result = await createAdminShipment(payload, idempotencyKey);
      toast.success(
        acceptAtCounter
          ? 'Đã tạo và tiếp nhận phiếu gửi hàng tại quầy thành công.'
          : 'Đã tạo đơn gửi hàng thành công.',
      );
      onCreated(result);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Có lỗi xảy ra khi tạo đơn tại quầy.';
      setSubmitError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ResourceSheet
      busy={submitting}
      description="Tiếp nhận hàng hóa trực tiếp, cân đo thực tế và thu cước tại quầy"
      onClose={onClose}
      preventDismiss={submitting}
      title="Tạo đơn gửi hàng tại quầy"
    >
      {loadingInitial ? (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
          <LoaderCircle className="size-8 animate-spin" />
          <p className="text-sm">Đang tải dữ liệu tuyến xe và bưu cục…</p>
        </div>
      ) : initialError ? (
        <ResourceNotice kind="error">{initialError}</ResourceNotice>
      ) : (
        <ResourceSheetForm
          footer={
            <div className="flex items-center justify-end gap-3 border-t pt-4">
              <Button
                disabled={submitting}
                onClick={onClose}
                type="button"
                variant="outline"
              >
                Hủy bỏ
              </Button>
              <Button
                disabled={submitting || quoting}
                type="submit"
              >
                {submitting ? (
                  <LoaderCircle className="size-4 animate-spin" />
                ) : (
                  <PackagePlus className="size-4" />
                )}
                Tạo phiếu gửi hàng
              </Button>
            </div>
          }
          onSubmit={handleSubmit}
        >
          {submitError && (
            <div ref={errorSummaryRef} tabIndex={-1}>
              <ResourceNotice kind="error">{submitError}</ResourceNotice>
            </div>
          )}

          {Object.keys(errors).length > 0 && !submitError && (
            <div ref={errorSummaryRef} tabIndex={-1}>
              <ResourceNotice kind="error">
                Vui lòng kiểm tra và sửa {Object.keys(errors).length} trường thông tin chưa hợp lệ bên dưới.
              </ResourceNotice>
            </div>
          )}

          {/* Section 1: Tuyến & Bưu cục giao nhận */}
          <section className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">
              1. Tuyến vận chuyển & Điểm giao nhận
            </h3>
            <div className="grid gap-4 sm:grid-cols-3">
              <FieldRoot className="sm:col-span-3">
                <FieldLabel>Tuyến xe hoạt động *</FieldLabel>
                <Select
                  disabled={submitting}
                  onValueChange={(val) => setRouteId(val ?? '')}
                  value={routeId}
                >
                  <SelectTrigger aria-label="Chọn tuyến xe" className="w-full">
                    <SelectValue placeholder="-- Chọn tuyến đường nhận hàng --" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {routes.map((r) => (
                        <SelectItem key={r.routeId} value={String(r.routeId)}>
                          {r.route.origin} → {r.route.destination} ({r.busCompany.name})
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                {errors.routeId && <FieldError>{errors.routeId}</FieldError>}
              </FieldRoot>

              <FieldRoot className="sm:col-span-1">
                <FieldLabel>Điểm gửi hàng tại quầy *</FieldLabel>
                <Select
                  disabled={submitting || pointsLoading}
                  onValueChange={(val) => setSenderPointId(val ?? '')}
                  value={senderPointId}
                >
                  <SelectTrigger aria-label="Điểm gửi hàng" className="w-full">
                    <SelectValue placeholder={pointsLoading ? 'Đang tải…' : '-- Chọn trạm gửi --'} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {senderPoints.map((p) => (
                        <SelectItem key={p.id} value={String(p.id)}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                {errors.senderPointId && <FieldError>{errors.senderPointId}</FieldError>}
              </FieldRoot>

              <FieldRoot className="sm:col-span-2">
                <FieldLabel>Điểm trả hàng cho người nhận *</FieldLabel>
                <Select
                  disabled={submitting || pointsLoading}
                  onValueChange={(val) => setReceiverPointId(val ?? '')}
                  value={receiverPointId}
                >
                  <SelectTrigger aria-label="Điểm nhận hàng" className="w-full">
                    <SelectValue placeholder={pointsLoading ? 'Đang tải…' : '-- Chọn trạm trả hàng --'} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {receiverPoints.map((p) => (
                        <SelectItem key={p.id} value={String(p.id)}>
                          {p.name} ({p.address})
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                {errors.receiverPointId && <FieldError>{errors.receiverPointId}</FieldError>}
              </FieldRoot>
            </div>
          </section>

          <div className="border-t pt-4" />

          {/* Section 2: Người gửi & Người nhận */}
          <section className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">
              2. Thông tin khách hàng
            </h3>
            <div className="grid gap-6 md:grid-cols-2">
              {/* Người gửi */}
              <div className="space-y-3 rounded-lg border bg-muted/20 p-4">
                <h4 className="text-xs font-semibold text-primary uppercase">
                  Người gửi hàng (Khách tại quầy)
                </h4>
                <FieldRoot>
                  <FieldLabel>Họ và tên người gửi *</FieldLabel>
                  <Input
                    disabled={submitting}
                    onChange={(e) => setSenderName(e.target.value)}
                    placeholder="Nguyễn Văn A"
                    value={senderName}
                  />
                  {errors.senderName && <FieldError>{errors.senderName}</FieldError>}
                </FieldRoot>
                <FieldRoot>
                  <FieldLabel>Số điện thoại *</FieldLabel>
                  <Input
                    disabled={submitting}
                    onChange={(e) => setSenderPhone(e.target.value)}
                    placeholder="0901234567"
                    type="tel"
                    value={senderPhone}
                  />
                  {errors.senderPhone && <FieldError>{errors.senderPhone}</FieldError>}
                </FieldRoot>
                <FieldRoot>
                  <FieldLabel>Email (tùy chọn)</FieldLabel>
                  <Input
                    disabled={submitting}
                    onChange={(e) => setSenderEmail(e.target.value)}
                    placeholder="khachhang@gmail.com"
                    type="email"
                    value={senderEmail}
                  />
                </FieldRoot>
              </div>

              {/* Người nhận */}
              <div className="space-y-3 rounded-lg border bg-muted/20 p-4">
                <h4 className="text-xs font-semibold text-primary uppercase">
                  Người nhận hàng
                </h4>
                <FieldRoot>
                  <FieldLabel>Họ và tên người nhận *</FieldLabel>
                  <Input
                    disabled={submitting}
                    onChange={(e) => setReceiverName(e.target.value)}
                    placeholder="Trần Thị B"
                    value={receiverName}
                  />
                  {errors.receiverName && <FieldError>{errors.receiverName}</FieldError>}
                </FieldRoot>
                <FieldRoot>
                  <FieldLabel>Số điện thoại *</FieldLabel>
                  <Input
                    disabled={submitting}
                    onChange={(e) => setReceiverPhone(e.target.value)}
                    placeholder="0987654321"
                    type="tel"
                    value={receiverPhone}
                  />
                  {errors.receiverPhone && <FieldError>{errors.receiverPhone}</FieldError>}
                </FieldRoot>
                <FieldRoot>
                  <FieldLabel>Số CCCD người nhận (tùy chọn)</FieldLabel>
                  <Input
                    disabled={submitting}
                    onChange={(e) => setReceiverCccd(e.target.value)}
                    placeholder="Đối chiếu khi giao hàng"
                    value={receiverCccd}
                  />
                </FieldRoot>
              </div>
            </div>
          </section>

          <div className="border-t pt-4" />

          {/* Section 3: Kiện hàng & Cân đo */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">
                3. Danh sách kiện hàng & Cân đo tại quầy
              </h3>
              <Button
                disabled={submitting}
                onClick={handleAddItem}
                size="sm"
                type="button"
                variant="outline"
              >
                <Plus className="size-4" />
                Thêm kiện hàng
              </Button>
            </div>

            {errors.items && <FieldError>{errors.items}</FieldError>}

            <div className="space-y-4">
              {items.map((item, idx) => (
                <Card className="relative p-4 shadow-none" key={item.id}>
                  <div className="mb-3 flex items-center justify-between border-b pb-2">
                    <span className="text-xs font-semibold uppercase text-muted-foreground">
                      Kiện #{idx + 1}
                    </span>
                    {items.length > 1 && (
                      <Button
                        aria-label={`Xóa kiện hàng ${idx + 1}`}
                        disabled={submitting}
                        onClick={() => handleRemoveItem(item.id)}
                        size="sm"
                        type="button"
                        variant="ghost"
                      >
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    )}
                  </div>

                  <div className="grid gap-3 sm:grid-cols-4">
                    <FieldRoot className="sm:col-span-2">
                      <FieldLabel>Tên hoặc mô tả hàng hóa *</FieldLabel>
                      <Input
                        disabled={submitting}
                        onChange={(e) => handleItemChange(item.id, 'name', e.target.value)}
                        placeholder="Thùng trái cây, Giấy tờ, Quần áo..."
                        value={item.name}
                      />
                      {errors[`item_${idx}_name`] && (
                        <FieldError>{errors[`item_${idx}_name`]}</FieldError>
                      )}
                    </FieldRoot>

                    <FieldRoot className="sm:col-span-1">
                      <FieldLabel>Phân loại hàng</FieldLabel>
                      <Select
                        disabled={submitting}
                        onValueChange={(val) => handleItemChange(item.id, 'categoryId', val ?? '')}
                        value={item.categoryId}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Mặc định" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            {categories.map((c) => (
                              <SelectItem key={c.categoryId} value={String(c.categoryId)}>
                                {c.name}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </FieldRoot>

                    <FieldRoot className="sm:col-span-1">
                      <FieldLabel>Số lượng *</FieldLabel>
                      <Input
                        disabled={submitting}
                        min="1"
                        onChange={(e) => handleItemChange(item.id, 'quantity', e.target.value)}
                        type="number"
                        value={item.quantity}
                      />
                      {errors[`item_${idx}_quantity`] && (
                        <FieldError>{errors[`item_${idx}_quantity`]}</FieldError>
                      )}
                    </FieldRoot>

                    <FieldRoot className="sm:col-span-1">
                      <FieldLabel>Khối lượng (kg) *</FieldLabel>
                      <Input
                        disabled={submitting}
                        min="0.1"
                        onChange={(e) => handleItemChange(item.id, 'weight', e.target.value)}
                        placeholder="5.0"
                        step="0.1"
                        type="number"
                        value={item.weight}
                      />
                      {errors[`item_${idx}_weight`] && (
                        <FieldError>{errors[`item_${idx}_weight`]}</FieldError>
                      )}
                    </FieldRoot>

                    <FieldRoot className="sm:col-span-3">
                      <FieldLabel>Kích thước Dài × Rộng × Cao (cm, tùy chọn)</FieldLabel>
                      <div className="grid grid-cols-3 gap-2">
                        <Input
                          disabled={submitting}
                          min="1"
                          onChange={(e) => handleItemChange(item.id, 'length', e.target.value)}
                          placeholder="Dài"
                          type="number"
                          value={item.length}
                        />
                        <Input
                          disabled={submitting}
                          min="1"
                          onChange={(e) => handleItemChange(item.id, 'width', e.target.value)}
                          placeholder="Rộng"
                          type="number"
                          value={item.width}
                        />
                        <Input
                          disabled={submitting}
                          min="1"
                          onChange={(e) => handleItemChange(item.id, 'height', e.target.value)}
                          placeholder="Cao"
                          type="number"
                          value={item.height}
                        />
                      </div>
                      {errors[`item_${idx}_dimensions`] && (
                        <FieldError>{errors[`item_${idx}_dimensions`]}</FieldError>
                      )}
                    </FieldRoot>
                  </div>
                </Card>
              ))}
            </div>

            {/* Phụ phí tính chất hàng */}
            <div className="flex flex-wrap gap-6 pt-2">
              <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                <Checkbox
                  checked={isFragile}
                  disabled={submitting}
                  onCheckedChange={(checked) => setIsFragile(Boolean(checked))}
                />
                <span>Hàng dễ vỡ (+phụ phí)</span>
              </label>

              <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                <Checkbox
                  checked={isValuable}
                  disabled={submitting}
                  onCheckedChange={(checked) => setIsValuable(Boolean(checked))}
                />
                <span>Hàng có giá trị cao (+phụ phí)</span>
              </label>
            </div>
          </section>

          <div className="border-t pt-4" />

          {/* Section 4: Tính cước & Xác nhận tại quầy */}
          <section className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">
              4. Cước phí & Xác nhận quầy
            </h3>

            {/* Quote Summary Box */}
            <Card className="bg-slate-50 p-4 border-slate-200">
              <div className="flex items-center justify-between border-b pb-2">
                <span className="text-sm font-medium text-slate-700">Tạm tính cước vận chuyển:</span>
                {quoting && (
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <LoaderCircle className="size-3 animate-spin" />
                    Đang tính cước…
                  </span>
                )}
              </div>

              {quoteError ? (
                <div className="py-2 text-xs text-destructive flex items-center gap-1.5">
                  <AlertCircle className="size-4 shrink-0" />
                  {quoteError}
                </div>
              ) : quote ? (
                <div className="pt-2 space-y-1.5 text-sm">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Cước chính:</span>
                    <span>{formatCurrency(quote.baseFee)}</span>
                  </div>
                  {quote.serviceFee > 0 && (
                    <div className="flex justify-between text-muted-foreground">
                      <span>Phụ phí dịch vụ:</span>
                      <span>{formatCurrency(quote.serviceFee)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-semibold text-base text-foreground pt-1 border-t">
                    <span>Tổng cước thanh toán:</span>
                    <span className="text-primary">{formatCurrency(quote.totalFee)}</span>
                  </div>
                </div>
              ) : (
                <div className="py-2 text-xs text-muted-foreground">
                  Điền tuyến đường và thông tin kiện hàng để tự động tính cước.
                </div>
              )}
            </Card>

            <div className="grid gap-4 sm:grid-cols-2">
              <FieldRoot>
                <FieldLabel>Người thanh toán cước *</FieldLabel>
                <Select
                  disabled={submitting}
                  onValueChange={(val) => setFreightPayer(val as 'NGUOI_GUI' | 'NGUOI_NHAN')}
                  value={freightPayer}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="NGUOI_GUI">Người gửi thanh toán tại quầy</SelectItem>
                      <SelectItem value="NGUOI_NHAN">Người nhận thanh toán khi lấy hàng</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </FieldRoot>

              <div className="space-y-3 pt-6">
                <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                  <Checkbox
                    checked={acceptAtCounter}
                    disabled={submitting}
                    onCheckedChange={(checked) => setAcceptAtCounter(Boolean(checked))}
                  />
                  <span>Tiếp nhận & chốt cước thực tế tại quầy</span>
                </label>

                <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                  <Checkbox
                    checked={collectPaymentAtCounter}
                    disabled={submitting || !acceptAtCounter || freightPayer === 'NGUOI_NHAN'}
                    onCheckedChange={(checked) => setCollectPaymentAtCounter(Boolean(checked))}
                  />
                  <span>Đã thu đủ tiền mặt cước gửi tại quầy</span>
                </label>
              </div>
            </div>

            <FieldRoot>
              <FieldLabel>Ghi chú đơn gửi hàng (tùy chọn)</FieldLabel>
              <Textarea
                disabled={submitting}
                onChange={(e) => setShipmentNote(e.target.value)}
                placeholder="Ghi chú thêm về đơn gửi, mã theo dõi nội bộ của bưu cục..."
                rows={2}
                value={shipmentNote}
              />
            </FieldRoot>
          </section>
        </ResourceSheetForm>
      )}
    </ResourceSheet>
  );
}
