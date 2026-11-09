/* eslint-disable react-hooks/set-state-in-effect */
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Bike,
  ShieldCheck,
  RotateCcw,
  Save,
  CheckCircle2,
  Layers,
} from 'lucide-react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/action-button';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  getBusCompanyLuggageRates,
  updateBusCompanyLuggageRates,
  DEFAULT_VEXGO_LUGGAGE_RATES,
  type LuggagePackagePricing,
  type RouteLuggageRateOverride,
  type BusCompanyLuggageRatesData,
} from '../services/luggage-rate-service';

interface LuggagePackagesManagementProps {
  canUpdate?: boolean;
}

function parseCurrencyInput(text: string): number {
  const digits = text.replace(/\D/g, '');
  return digits ? parseInt(digits, 10) : 0;
}

export function LuggagePackagesManagement({ canUpdate = true }: LuggagePackagesManagementProps) {
  const t = useTranslations('shipments');
  const [data, setData] = useState<BusCompanyLuggageRatesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedScope, setSelectedScope] = useState<string>('default'); // 'default' or routeId string

  // Local state form
  const [defaultPricing, setDefaultPricing] = useState<LuggagePackagePricing>(
    DEFAULT_VEXGO_LUGGAGE_RATES,
  );
  const [routeOverrides, setRouteOverrides] = useState<
    Record<string, RouteLuggageRateOverride>
  >({});

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getBusCompanyLuggageRates();
      setData(res);
      setDefaultPricing(res.default || DEFAULT_VEXGO_LUGGAGE_RATES);
      setRouteOverrides(res.routes || {});
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : t('luggageLoadError'),
      );
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Current scope state
  const isDefaultScope = selectedScope === 'default';
  const currentRouteOverride = routeOverrides[selectedScope];
  const isInheriting = isDefaultScope ? false : currentRouteOverride?.inherit ?? true;

  // Active pricing for the current scope
  const activePricing: LuggagePackagePricing = isDefaultScope
    ? defaultPricing
    : {
        ...defaultPricing,
        ...(isInheriting ? {} : currentRouteOverride || {}),
      };

  const handlePriceChange = (field: keyof LuggagePackagePricing, valueStr: string) => {
    const num = parseCurrencyInput(valueStr);
    if (isDefaultScope) {
      setDefaultPricing((prev) => ({ ...prev, [field]: num }));
    } else {
      setRouteOverrides((prev) => {
        const cur = prev[selectedScope] || { inherit: false };
        return {
          ...prev,
          [selectedScope]: {
            ...cur,
            inherit: false,
            [field]: num,
          },
        };
      });
    }
  };

  const handleNumberChange = (field: keyof LuggagePackagePricing, valueStr: string) => {
    const digits = valueStr.replace(/\D/g, '');
    const num = digits ? parseInt(digits, 10) : 0;
    if (isDefaultScope) {
      setDefaultPricing((prev) => ({ ...prev, [field]: num }));
    } else {
      setRouteOverrides((prev) => {
        const cur = prev[selectedScope] || { inherit: false };
        return {
          ...prev,
          [selectedScope]: {
            ...cur,
            inherit: false,
            [field]: num,
          },
        };
      });
    }
  };

  const handleToggleInherit = (checked: boolean) => {
    setRouteOverrides((prev) => {
      const cur = prev[selectedScope] || {};
      if (checked) {
        return {
          ...prev,
          [selectedScope]: {
            ...cur,
            inherit: true,
          },
        };
      } else {
        return {
          ...prev,
          [selectedScope]: {
            ...defaultPricing,
            inherit: false,
          },
        };
      }
    });
  };

  const handleResetToDefaultVexGo = () => {
    if (isDefaultScope) {
      setDefaultPricing(DEFAULT_VEXGO_LUGGAGE_RATES);
      toast.info(t('luggageResetDefaultInfo'));
    } else {
      setRouteOverrides((prev) => {
        const copy = { ...prev };
        delete copy[selectedScope];
        return copy;
      });
      toast.info(t('luggageRemoveOverrideInfo'));
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await updateBusCompanyLuggageRates({
        default: defaultPricing,
        routes: routeOverrides,
      });
      setData(res);
      setDefaultPricing(res.default);
      setRouteOverrides(res.routes || {});
      toast.success(t('luggageSaveSuccess'));
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : t('luggageSaveError'),
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-xl border bg-card p-6 text-muted-foreground shadow-sm">
        <div className="size-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <span className="text-sm font-medium">{t('luggageLoading')}</span>
      </div>
    );
  }

  const selectedRouteObj = data?.availableRoutes.find(
    (r) => String(r.routeId) === selectedScope,
  );

  return (
    <div className="space-y-6">
      {/* Top Banner / Scope Selector */}
      <Card className="border-border/80 shadow-xs">
        <CardContent className="p-4 sm:p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Layers className="size-4" />
                </span>
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t('luggageScopeCardTitle')}
                </span>
              </div>
              <p className="text-sm text-foreground">
                {isDefaultScope
                  ? t('luggageScopeDefaultActive')
                  : t('luggageScopeRouteActive', {
                      origin: selectedRouteObj?.origin ?? '',
                      destination: selectedRouteObj?.destination ?? '',
                    })}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <label htmlFor="scope-select" className="sr-only">
                {t('luggageSelectScopeLabel')}
              </label>
              <select
                id="scope-select"
                value={selectedScope}
                onChange={(e) => setSelectedScope(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm font-medium text-foreground shadow-xs transition-colors hover:bg-muted/50 focus-visible:border-ring focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="default">{t('luggageOptionDefault')}</option>
                {data?.availableRoutes.map((route) => (
                  <option key={route.routeId} value={String(route.routeId)}>
                    {route.hasOverride ? '🏷️ ' : ''}
                    {t('luggageOptionRoute', {
                      origin: route.origin,
                      destination: route.destination,
                      code: route.code,
                    })}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {!isDefaultScope && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm">
              <div className="flex items-center gap-2.5">
                <Checkbox
                  id="inherit-toggle"
                  checked={isInheriting}
                  onCheckedChange={(checked) => handleToggleInherit(Boolean(checked))}
                />
                <label
                  htmlFor="inherit-toggle"
                  className="cursor-pointer font-medium text-foreground select-none"
                >
                  {t('luggageInheritSwitch')}
                </label>
              </div>
              <span className="text-xs text-muted-foreground">
                {isInheriting
                  ? t('luggageInheritOnDesc')
                  : t('luggageInheritOffDesc')}
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 4 Standard Packages */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-foreground">
              {t('luggagePackagesSectionTitle')}
            </h3>
            <p className="text-xs text-muted-foreground">
              {t('luggagePackagesSectionDesc')}
            </p>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
            <CheckCircle2 className="size-3.5" />
            {t('luggageVexGoStandard')}
          </span>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Size S */}
          <Card className={`relative transition-all ${isInheriting ? 'opacity-85' : 'hover:border-primary/50'}`}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <span className="flex size-8 items-center justify-center rounded-lg bg-blue-500/10 font-bold text-blue-600">
                  S
                </span>
                <span className="text-xs font-semibold text-muted-foreground">
                  ≤ {activePricing.packageSMaxKg ?? 5}kg
                </span>
              </div>
              <CardTitle className="mt-2 text-sm font-bold">{t('packageSizeSTitle')}</CardTitle>
              <CardDescription className="text-xs">
                {t('packageSizeSDesc', { kg: activePricing.packageSMaxKg ?? 5 })}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-[11px] text-muted-foreground italic">
                {t('packageSizeSTip')}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[12px] font-semibold text-foreground">{t('packageKgLimit')}</label>
                  <div className="relative mt-1">
                    <Input
                      type="number"
                      min={1}
                      max={100}
                      disabled={isInheriting || !canUpdate}
                      value={activePricing.packageSMaxKg ?? 5}
                      onChange={(e) => handleNumberChange('packageSMaxKg', e.target.value)}
                      className="font-mono pr-8 font-semibold text-foreground h-9"
                    />
                    <span className="pointer-events-none absolute right-2.5 top-2 text-xs font-medium text-muted-foreground">
                      kg
                    </span>
                  </div>
                </div>
                <div>
                  <label className="text-[12px] font-semibold text-foreground">{t('packageFee')}</label>
                  <div className="relative mt-1">
                    <Input
                      type="text"
                      disabled={isInheriting || !canUpdate}
                      value={(activePricing.packageS || 0).toLocaleString('vi-VN')}
                      onChange={(e) => handlePriceChange('packageS', e.target.value)}
                      className="font-mono pr-7 font-semibold text-foreground h-9"
                    />
                    <span className="pointer-events-none absolute right-2.5 top-2 text-xs font-medium text-muted-foreground">
                      ₫
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Size M */}
          <Card className={`relative transition-all ${isInheriting ? 'opacity-85' : 'hover:border-primary/50'}`}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <span className="flex size-8 items-center justify-center rounded-lg bg-emerald-500/10 font-bold text-emerald-600">
                  M
                </span>
                <span className="text-xs font-semibold text-muted-foreground">
                  ≤ {activePricing.packageMMaxKg ?? 10}kg
                </span>
              </div>
              <CardTitle className="mt-2 text-sm font-bold">{t('packageSizeMTitle')}</CardTitle>
              <CardDescription className="text-xs">
                {t('packageSizeMDesc', { kg: activePricing.packageMMaxKg ?? 10 })}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-[11px] text-muted-foreground italic">
                {t('packageSizeMTip')}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[12px] font-semibold text-foreground">{t('packageKgLimit')}</label>
                  <div className="relative mt-1">
                    <Input
                      type="number"
                      min={1}
                      max={100}
                      disabled={isInheriting || !canUpdate}
                      value={activePricing.packageMMaxKg ?? 10}
                      onChange={(e) => handleNumberChange('packageMMaxKg', e.target.value)}
                      className="font-mono pr-8 font-semibold text-foreground h-9"
                    />
                    <span className="pointer-events-none absolute right-2.5 top-2 text-xs font-medium text-muted-foreground">
                      kg
                    </span>
                  </div>
                </div>
                <div>
                  <label className="text-[12px] font-semibold text-foreground">{t('packageFee')}</label>
                  <div className="relative mt-1">
                    <Input
                      type="text"
                      disabled={isInheriting || !canUpdate}
                      value={(activePricing.packageM || 0).toLocaleString('vi-VN')}
                      onChange={(e) => handlePriceChange('packageM', e.target.value)}
                      className="font-mono pr-7 font-semibold text-foreground h-9"
                    />
                    <span className="pointer-events-none absolute right-2.5 top-2 text-xs font-medium text-muted-foreground">
                      ₫
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Size L */}
          <Card className={`relative transition-all ${isInheriting ? 'opacity-85' : 'hover:border-primary/50'}`}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <span className="flex size-8 items-center justify-center rounded-lg bg-amber-500/10 font-bold text-amber-600">
                  L
                </span>
                <span className="text-xs font-semibold text-muted-foreground">
                  ≤ {activePricing.packageLMaxKg ?? 20}kg
                </span>
              </div>
              <CardTitle className="mt-2 text-sm font-bold">{t('packageSizeLTitle')}</CardTitle>
              <CardDescription className="text-xs">
                {t('packageSizeLDesc', { kg: activePricing.packageLMaxKg ?? 20 })}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-[11px] text-muted-foreground italic">
                {t('packageSizeLTip')}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[12px] font-semibold text-foreground">{t('packageKgLimit')}</label>
                  <div className="relative mt-1">
                    <Input
                      type="number"
                      min={1}
                      max={100}
                      disabled={isInheriting || !canUpdate}
                      value={activePricing.packageLMaxKg ?? 20}
                      onChange={(e) => handleNumberChange('packageLMaxKg', e.target.value)}
                      className="font-mono pr-8 font-semibold text-foreground h-9"
                    />
                    <span className="pointer-events-none absolute right-2.5 top-2 text-xs font-medium text-muted-foreground">
                      kg
                    </span>
                  </div>
                </div>
                <div>
                  <label className="text-[12px] font-semibold text-foreground">{t('packageFee')}</label>
                  <div className="relative mt-1">
                    <Input
                      type="text"
                      disabled={isInheriting || !canUpdate}
                      value={(activePricing.packageL || 0).toLocaleString('vi-VN')}
                      onChange={(e) => handlePriceChange('packageL', e.target.value)}
                      className="font-mono pr-7 font-semibold text-foreground h-9"
                    />
                    <span className="pointer-events-none absolute right-2.5 top-2 text-xs font-medium text-muted-foreground">
                      ₫
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Size XL */}
          <Card className={`relative transition-all ${isInheriting ? 'opacity-85' : 'hover:border-primary/50'}`}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <span className="flex size-8 items-center justify-center rounded-lg bg-red-500/10 font-bold text-red-600">
                  XL
                </span>
                <span className="text-xs font-semibold text-muted-foreground">
                  ≤ {activePricing.packageXLMaxKg ?? 35}kg
                </span>
              </div>
              <CardTitle className="mt-2 text-sm font-bold">{t('packageSizeXLTitle')}</CardTitle>
              <CardDescription className="text-xs">
                {t('packageSizeXLDesc', { kg: activePricing.packageXLMaxKg ?? 35 })}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-[11px] text-muted-foreground italic">
                {t('packageSizeXLTip')}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[12px] font-semibold text-foreground">{t('packageKgLimit')}</label>
                  <div className="relative mt-1">
                    <Input
                      type="number"
                      min={1}
                      max={100}
                      disabled={isInheriting || !canUpdate}
                      value={activePricing.packageXLMaxKg ?? 35}
                      onChange={(e) => handleNumberChange('packageXLMaxKg', e.target.value)}
                      className="font-mono pr-8 font-semibold text-foreground h-9"
                    />
                    <span className="pointer-events-none absolute right-2.5 top-2 text-xs font-medium text-muted-foreground">
                      kg
                    </span>
                  </div>
                </div>
                <div>
                  <label className="text-[12px] font-semibold text-foreground">{t('packageFee')}</label>
                  <div className="relative mt-1">
                    <Input
                      type="text"
                      disabled={isInheriting || !canUpdate}
                      value={(activePricing.packageXL || 0).toLocaleString('vi-VN')}
                      onChange={(e) => handlePriceChange('packageXL', e.target.value)}
                      className="font-mono pr-7 font-semibold text-foreground h-9"
                    />
                    <span className="pointer-events-none absolute right-2.5 top-2 text-xs font-medium text-muted-foreground">
                      ₫
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Vehicles & Surcharges Section */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Accompanying Vehicles */}
        <Card className={isInheriting ? 'opacity-85' : ''}>
          <CardHeader>
            <div className="flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Bike className="size-4" />
              </span>
              <CardTitle className="text-sm font-bold">
                {t('vehicleSectionTitle')}
              </CardTitle>
            </div>
            <CardDescription className="text-xs">
              {t('vehicleSectionDesc')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3.5">
            <div className="grid grid-cols-2 items-center gap-3">
              <span className="text-xs font-medium text-foreground">{t('vehicleManualBike')}</span>
              <div className="relative">
                <Input
                  type="text"
                  disabled={isInheriting || !canUpdate}
                  value={(activePricing.motorcycleWave || 180_000).toLocaleString('vi-VN')}
                  onChange={(e) => handlePriceChange('motorcycleWave', e.target.value)}
                  className="font-mono pr-8 text-right font-medium text-xs h-8"
                />
                <span className="pointer-events-none absolute right-2.5 top-2 text-xs text-muted-foreground">
                  ₫
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 items-center gap-3">
              <span className="text-xs font-medium text-foreground">{t('vehicleScooter')}</span>
              <div className="relative">
                <Input
                  type="text"
                  disabled={isInheriting || !canUpdate}
                  value={(activePricing.motorcycleScooter || 220_000).toLocaleString('vi-VN')}
                  onChange={(e) => handlePriceChange('motorcycleScooter', e.target.value)}
                  className="font-mono pr-8 text-right font-medium text-xs h-8"
                />
                <span className="pointer-events-none absolute right-2.5 top-2 text-xs text-muted-foreground">
                  ₫
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 items-center gap-3">
              <span className="text-xs font-medium text-foreground">{t('vehicleBigScooter')}</span>
              <div className="relative">
                <Input
                  type="text"
                  disabled={isInheriting || !canUpdate}
                  value={(activePricing.motorcycleBig || 250_000).toLocaleString('vi-VN')}
                  onChange={(e) => handlePriceChange('motorcycleBig', e.target.value)}
                  className="font-mono pr-8 text-right font-medium text-xs h-8"
                />
                <span className="pointer-events-none absolute right-2.5 top-2 text-xs text-muted-foreground">
                  ₫
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 items-center gap-3">
              <span className="text-xs font-medium text-foreground">{t('vehicleBicycle')}</span>
              <div className="relative">
                <Input
                  type="text"
                  disabled={isInheriting || !canUpdate}
                  value={(activePricing.bicycle || 80_000).toLocaleString('vi-VN')}
                  onChange={(e) => handlePriceChange('bicycle', e.target.value)}
                  className="font-mono pr-8 text-right font-medium text-xs h-8"
                />
                <span className="pointer-events-none absolute right-2.5 top-2 text-xs text-muted-foreground">
                  ₫
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Surcharges & Free Carry-On Allowance */}
        <Card className={isInheriting ? 'opacity-85' : ''}>
          <CardHeader>
            <div className="flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <ShieldCheck className="size-4" />
              </span>
              <CardTitle className="text-sm font-bold">
                {t('surchargeSectionTitle')}
              </CardTitle>
            </div>
            <CardDescription className="text-xs">
              {t('surchargeSectionDesc')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3.5">
            <div className="grid grid-cols-2 items-center gap-3">
              <span className="text-xs font-medium text-foreground">{t('surchargeFragile')}</span>
              <div className="relative">
                <Input
                  type="text"
                  disabled={isInheriting || !canUpdate}
                  value={(activePricing.fragileSurcharge || 20_000).toLocaleString('vi-VN')}
                  onChange={(e) => handlePriceChange('fragileSurcharge', e.target.value)}
                  className="font-mono pr-8 text-right font-medium text-xs h-8"
                />
                <span className="pointer-events-none absolute right-2.5 top-2 text-xs text-muted-foreground">
                  ₫
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 items-center gap-3">
              <span className="text-xs font-medium text-foreground">{t('surchargeHighValue')}</span>
              <div className="relative">
                <Input
                  type="text"
                  disabled={isInheriting || !canUpdate}
                  value={(activePricing.valuableSurcharge || 50_000).toLocaleString('vi-VN')}
                  onChange={(e) => handlePriceChange('valuableSurcharge', e.target.value)}
                  className="font-mono pr-8 text-right font-medium text-xs h-8"
                />
                <span className="pointer-events-none absolute right-2.5 top-2 text-xs text-muted-foreground">
                  ₫
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 items-center gap-3">
              <span className="text-xs font-medium text-foreground">{t('freeCarryOnLimit')}</span>
              <div className="relative">
                <Input
                  type="number"
                  disabled={isInheriting || !canUpdate}
                  value={activePricing.maxFreeWeightKg ?? 7}
                  onChange={(e) => handleNumberChange('maxFreeWeightKg', e.target.value)}
                  className="font-mono pr-8 text-right font-medium text-xs h-8"
                />
                <span className="pointer-events-none absolute right-2.5 top-2 text-xs text-muted-foreground">
                  kg
                </span>
              </div>
            </div>

            <div className="rounded-md bg-muted/50 p-2.5 text-[11px] text-muted-foreground">
              {t.rich('freeCarryOnNotice', {
                strong: (chunks) => <strong>{chunks}</strong>,
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Action Footer */}
      {canUpdate && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleResetToDefaultVexGo}
              className="text-xs"
            >
              <RotateCcw className="mr-1.5 size-3.5" />
              {isDefaultScope ? t('btnResetDefault') : t('btnCancelRouteOverride')}
            </Button>
          </div>

          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="default"
              size="sm"
              disabled={saving}
              onClick={handleSave}
              className="text-xs font-semibold"
            >
              {saving ? (
                <>
                  <div className="mr-1.5 size-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  {t('btnSubmitting')}
                </>
              ) : (
                <>
                  <Save className="mr-1.5 size-3.5" />
                  {isDefaultScope ? t('btnSaveDefaultScope') : t('btnSaveRouteScope')}
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
