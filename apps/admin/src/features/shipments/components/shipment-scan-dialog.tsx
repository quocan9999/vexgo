/* eslint-disable react-hooks/set-state-in-effect */
'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  Camera,
  Keyboard,
  LoaderCircle,
  ScanLine,
  Search,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Field, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/action-button';
import {
  normalizeScannedWaybill,
  WAYBILL_PATTERN,
} from '../utils/waybill-code';
import { findShipmentByWaybill } from '../services/shipment-lookup';

interface ShipmentScanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectShipment: (shipmentId: number) => void;
}

export function ShipmentScanDialog({
  open,
  onOpenChange,
  onSelectShipment,
}: ShipmentScanDialogProps) {
  const [tab, setTab] = useState<'scanner' | 'camera'>('scanner');

  // State cho Tab 1: Máy quét / Nhập mã
  const [manualCode, setManualCode] = useState('');
  const [manualLoading, setManualLoading] = useState(false);
  const [manualError, setManualError] = useState<string | null>(null);
  const manualInputRef = useRef<HTMLInputElement>(null);

  // State cho Tab 2: Camera quét QR
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [cameraLoading, setCameraLoading] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);
  const scanLockRef = useRef<boolean>(false);
  const handleLookupCodeRef = useRef<(rawCode: string, source: 'manual' | 'camera') => Promise<void>>(() => Promise.resolve());

  // Tự động focus input khi mở dialog hoặc chuyển về tab máy quét
  useEffect(() => {
    if (open && tab === 'scanner') {
      const timer = setTimeout(() => {
        manualInputRef.current?.focus();
      }, 80);
      return () => clearTimeout(timer);
    }
  }, [open, tab]);

  // Reset state khi dialog đóng
  useEffect(() => {
    if (!open) {
      setManualCode('');
      setManualError(null);
      setManualLoading(false);
      setCameraError(null);
      scanLockRef.current = false;
      stopCamera();
    }
  }, [open]);

  // Dừng camera và dọn dẹp stream
  function stopCamera() {
    if (controlsRef.current) {
      try {
        controlsRef.current.stop();
      } catch {
        // Bỏ qua lỗi khi dừng reader
      }
      controlsRef.current = null;
    }
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
  }

  // Khởi động camera khi chuyển sang tab camera
  useEffect(() => {
    if (!open || tab !== 'camera') {
      stopCamera();
      return;
    }

    let isMounted = true;
    setCameraLoading(true);
    setCameraError(null);

    async function initCamera() {
      try {
        const { BrowserCodeReader, BrowserMultiFormatReader } = await import(
          '@zxing/browser'
        );

        // Liệt kê các camera khả dụng
        const videoInputDevices =
          await BrowserCodeReader.listVideoInputDevices();
        if (!isMounted) return;

        setDevices(videoInputDevices);

        if (videoInputDevices.length === 0) {
          setCameraError(
            'Không tìm thấy thiết bị camera trên máy tính / thiết bị này.',
          );
          setCameraLoading(false);
          return;
        }

        const deviceIdToUse =
          selectedDeviceId || videoInputDevices[0]?.deviceId || undefined;
        if (!selectedDeviceId && deviceIdToUse) {
          setSelectedDeviceId(deviceIdToUse);
        }

        if (!videoRef.current) return;

        const reader = new BrowserMultiFormatReader();
        const controls = await reader.decodeFromVideoDevice(
          deviceIdToUse,
          videoRef.current,
          (result) => {
            if (!result || scanLockRef.current) return;

            const text = result.getText();
            if (!text) return;

            scanLockRef.current = true;
            handleLookupCodeRef.current(text, 'camera');
          },
        );

        if (!isMounted) {
          controls.stop();
          return;
        }

        controlsRef.current = controls;
        setCameraLoading(false);
      } catch (err: unknown) {
        if (!isMounted) return;
        setCameraError(
          (err instanceof Error ? err.message : '') ||
            'Không thể truy cập camera. Vui lòng cấp quyền máy ảnh trên trình duyệt.',
        );
        setCameraLoading(false);
      }
    }

    initCamera();

    return () => {
      isMounted = false;
      stopCamera();
    };
  }, [open, tab, selectedDeviceId]);

  handleLookupCodeRef.current = handleLookupCode;

  // Thực hiện tra cứu mã vận đơn
  async function handleLookupCode(rawCode: string, source: 'manual' | 'camera') {
    const normalized = normalizeScannedWaybill(rawCode);

    if (!normalized || !WAYBILL_PATTERN.test(normalized)) {
      if (source === 'manual') {
        setManualError('Mã vận đơn không đúng định dạng chuẩn.');
      } else {
        setCameraError(`Mã quét "${rawCode}" không đúng định dạng vận đơn.`);
        setTimeout(() => {
          scanLockRef.current = false;
          setCameraError(null);
        }, 2000);
      }
      return;
    }

    if (source === 'manual') {
      setManualLoading(true);
      setManualError(null);
    }

    try {
      const match = await findShipmentByWaybill(normalized);
      if (!match) {
        const notFoundMsg =
          'Không tìm thấy phiếu gửi hàng trong nhà xe của bạn.';
        if (source === 'manual') {
          setManualError(notFoundMsg);
        } else {
          setCameraError(
            `Vận đơn "${normalized}" không thuộc nhà xe hoặc không tồn tại.`,
          );
          setTimeout(() => {
            scanLockRef.current = false;
            setCameraError(null);
          }, 2500);
        }
        return;
      }

      // Tìm thấy thành công!
      stopCamera();
      onOpenChange(false);
      toast.success(`Đã tìm thấy vận đơn: ${match.waybillCode}`);
      onSelectShipment(match.shipmentId);
    } catch (err: unknown) {
      const errMsg =
        (err instanceof Error ? err.message : '') ||
        'Lỗi khi tra cứu phiếu gửi hàng.';
      if (source === 'manual') {
        setManualError(errMsg);
      } else {
        setCameraError(errMsg);
        setTimeout(() => {
          scanLockRef.current = false;
          setCameraError(null);
        }, 2000);
      }
    } finally {
      if (source === 'manual') {
        setManualLoading(false);
      }
    }
  }

  function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!manualCode.trim() || manualLoading) return;
    handleLookupCode(manualCode, 'manual');
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <ScanLine className="size-5 text-primary" />
            <DialogTitle>Quét mã & Tìm phiếu gửi hàng</DialogTitle>
          </div>
          <DialogDescription>
            Sử dụng súng quét mã vạch USB, camera máy tính hoặc nhập trực tiếp mã
            vận đơn để mở nhanh chi tiết.
          </DialogDescription>
        </DialogHeader>

        <Tabs
          value={tab}
          onValueChange={(v) => setTab(v as 'scanner' | 'camera')}
          className="mt-2"
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="scanner" className="gap-2">
              <Keyboard className="size-4" />
              Máy quét / Nhập mã
            </TabsTrigger>
            <TabsTrigger value="camera" className="gap-2">
              <Camera className="size-4" />
              Camera quét QR
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: MÁY QUÉT / BÀN PHÍM */}
          <TabsContent value="scanner" className="pt-4">
            <form onSubmit={handleManualSubmit} className="space-y-4">
              <Field>
                <FieldLabel htmlFor="waybill-scan-input">
                  Mã vận đơn / Quét mã barcode
                </FieldLabel>
                <div className="relative flex items-center">
                  <Input
                    id="waybill-scan-input"
                    ref={manualInputRef}
                    value={manualCode}
                    onChange={(e) => {
                      setManualCode(e.target.value);
                      if (manualError) setManualError(null);
                    }}
                    placeholder="VD: GH-HN-SG-001 hoặc quét barcode"
                    autoComplete="off"
                    autoFocus
                    className="admin-data-mono pr-10 uppercase font-medium"
                    disabled={manualLoading}
                  />
                  <div className="absolute right-3 text-muted-foreground pointer-events-none">
                    {manualLoading ? (
                      <LoaderCircle className="size-4 animate-spin text-primary" />
                    ) : (
                      <Search className="size-4" />
                    )}
                  </div>
                </div>
                <p className="text-[12px] text-muted-foreground mt-1.5">
                  Mẹo: Máy quét mã vạch USB sẽ tự động nhập mã và nhấn Enter.
                </p>
              </Field>

              {manualError && (
                <div className="flex items-center gap-2 rounded-md border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-800">
                  <AlertCircle className="size-4 shrink-0 text-rose-600" />
                  <span>{manualError}</span>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={manualLoading}
                >
                  Đóng
                </Button>
                <Button
                  type="submit"
                  disabled={!manualCode.trim() || manualLoading}
                  className="gap-1.5 font-semibold"
                >
                  {manualLoading ? (
                    <>
                      <LoaderCircle className="size-4 animate-spin" />
                      Đang tìm...
                    </>
                  ) : (
                    <>
                      <Search className="size-4" />
                      Tìm vận đơn
                    </>
                  )}
                </Button>
              </div>
            </form>
          </TabsContent>

          {/* TAB 2: CAMERA QUÉT QR */}
          <TabsContent value="camera" className="space-y-4 pt-4">
            {devices.length > 1 && (
              <Field>
                <FieldLabel htmlFor="camera-device-select">
                  Chọn thiết bị camera
                </FieldLabel>
                <select
                  id="camera-device-select"
                  value={selectedDeviceId}
                  onChange={(e) => setSelectedDeviceId(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs shadow-xs focus-visible:outline-1 focus-visible:outline-ring"
                >
                  {devices.map((device, index) => (
                    <option key={device.deviceId} value={device.deviceId}>
                      {device.label || `Camera ${index + 1}`}
                    </option>
                  ))}
                </select>
              </Field>
            )}

            <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-slate-950 flex items-center justify-center border border-slate-800">
              <video
                ref={videoRef}
                className="h-full w-full object-cover"
                muted
                playsInline
              />

              {/* Khung ngắm quét mã QR */}
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="relative size-44 rounded-xl border-2 border-emerald-400/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]">
                  {/* Đường kẻ quét chuyển động */}
                  <div className="absolute inset-x-0 top-1/2 h-0.5 bg-emerald-400 animate-pulse shadow-sm shadow-emerald-400" />
                </div>
              </div>

              {cameraLoading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-950/80 text-white">
                  <LoaderCircle className="size-6 animate-spin text-emerald-400" />
                  <span className="text-xs">Đang mở máy ảnh...</span>
                </div>
              )}
            </div>

            <p className="text-center text-xs text-muted-foreground">
              Hướng camera về phía mã QR trên tem kiện hoặc phiếu gửi hàng.
            </p>

            {cameraError && (
              <div className="flex items-center gap-2 rounded-md border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-800">
                <AlertCircle className="size-4 shrink-0 text-rose-600" />
                <span>{cameraError}</span>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Đóng
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
