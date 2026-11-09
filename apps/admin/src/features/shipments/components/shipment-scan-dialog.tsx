/* eslint-disable react-hooks/set-state-in-effect */
'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
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
  const t = useTranslations('shipments');
  const tCommon = useTranslations('common');
  const [tab, setTab] = useState<'scanner' | 'camera'>('scanner');

  // State for Tab 1: Scanner / Manual input
  const [manualCode, setManualCode] = useState('');
  const [manualLoading, setManualLoading] = useState(false);
  const [manualError, setManualError] = useState<string | null>(null);
  const manualInputRef = useRef<HTMLInputElement>(null);

  // State for Tab 2: Camera QR scanner
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [cameraLoading, setCameraLoading] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);
  const scanLockRef = useRef<boolean>(false);
  const handleLookupCodeRef = useRef<(rawCode: string, source: 'manual' | 'camera') => Promise<void>>(() => Promise.resolve());

  // Auto focus input when dialog opens or switching to scanner tab
  useEffect(() => {
    if (open && tab === 'scanner') {
      const timer = setTimeout(() => {
        manualInputRef.current?.focus();
      }, 80);
      return () => clearTimeout(timer);
    }
  }, [open, tab]);

  // Reset state on close
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

  // Stop camera and cleanup stream
  function stopCamera() {
    if (controlsRef.current) {
      try {
        controlsRef.current.stop();
      } catch {
        // Ignore errors on stopping reader
      }
      controlsRef.current = null;
    }
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
  }

  // Initialize camera when tab is switched to camera
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

        // Enumerate video devices
        const videoInputDevices =
          await BrowserCodeReader.listVideoInputDevices();
        if (!isMounted) return;

        setDevices(videoInputDevices);

        if (videoInputDevices.length === 0) {
          setCameraError(
            t('noCameraFound'),
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
            t('cameraAccessDenied'),
        );
        setCameraLoading(false);
      }
    }

    initCamera();

    return () => {
      isMounted = false;
      stopCamera();
    };
  }, [open, tab, selectedDeviceId, t]);

  handleLookupCodeRef.current = handleLookupCode;

  // Perform waybill lookup
  async function handleLookupCode(rawCode: string, source: 'manual' | 'camera') {
    const normalized = normalizeScannedWaybill(rawCode);

    if (!normalized || !WAYBILL_PATTERN.test(normalized)) {
      if (source === 'manual') {
        setManualError(t('invalidWaybillFormat'));
      } else {
        setCameraError(t('invalidScannedFormat', { rawCode }));
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
        const notFoundMsg = t('shipmentNotInCarrier');
        if (source === 'manual') {
          setManualError(notFoundMsg);
        } else {
          setCameraError(
            t('waybillNotFoundOrForeign', { code: normalized }),
          );
          setTimeout(() => {
            scanLockRef.current = false;
            setCameraError(null);
          }, 2500);
        }
        return;
      }

      // Success
      stopCamera();
      onOpenChange(false);
      toast.success(t('waybillFoundSuccess', { code: match.waybillCode }));
      onSelectShipment(match.shipmentId);
    } catch (err: unknown) {
      const errMsg =
        (err instanceof Error ? err.message : '') ||
        t('errorLookingUpShipment');
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
            <DialogTitle>{t('scanDialogTitle')}</DialogTitle>
          </div>
          <DialogDescription>
            {t('scanDialogDesc')}
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
              {t('tabScanner')}
            </TabsTrigger>
            <TabsTrigger value="camera" className="gap-2">
              <Camera className="size-4" />
              {t('tabCamera')}
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: SCANNER / KEYBOARD */}
          <TabsContent value="scanner" className="pt-4">
            <form onSubmit={handleManualSubmit} className="space-y-4">
              <Field>
                <FieldLabel htmlFor="waybill-scan-input">
                  {t('waybillScanInputLabel')}
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
                    placeholder={t('waybillScanInputPlaceholder')}
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
                  {t('scannerTip')}
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
                  {tCommon('close')}
                </Button>
                <Button
                  type="submit"
                  disabled={!manualCode.trim() || manualLoading}
                  className="gap-1.5 font-semibold"
                >
                  {manualLoading ? (
                    <>
                      <LoaderCircle className="size-4 animate-spin" />
                      {t('searching')}
                    </>
                  ) : (
                    <>
                      <Search className="size-4" />
                      {t('findWaybill')}
                    </>
                  )}
                </Button>
              </div>
            </form>
          </TabsContent>

          {/* TAB 2: CAMERA QR SCANNER */}
          <TabsContent value="camera" className="space-y-4 pt-4">
            {devices.length > 1 && (
              <Field>
                <FieldLabel htmlFor="camera-device-select">
                  {t('selectCameraDevice')}
                </FieldLabel>
                <select
                  id="camera-device-select"
                  value={selectedDeviceId}
                  onChange={(e) => setSelectedDeviceId(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs shadow-xs focus-visible:outline-1 focus-visible:outline-ring"
                >
                  {devices.map((device, index) => (
                    <option key={device.deviceId} value={device.deviceId}>
                      {device.label || t('cameraDefaultLabel', { index: index + 1 })}
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

              {/* QR scanner target viewfinder */}
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="relative size-44 rounded-xl border-2 border-emerald-400/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]">
                  {/* Animated scanning bar */}
                  <div className="absolute inset-x-0 top-1/2 h-0.5 bg-emerald-400 animate-pulse shadow-sm shadow-emerald-400" />
                </div>
              </div>

              {cameraLoading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-950/80 text-white">
                  <LoaderCircle className="size-6 animate-spin text-emerald-400" />
                  <span className="text-xs">{t('openingCamera')}</span>
                </div>
              )}
            </div>

            <p className="text-center text-xs text-muted-foreground">
              {t('cameraAimGuide')}
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
                {tCommon('close')}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
