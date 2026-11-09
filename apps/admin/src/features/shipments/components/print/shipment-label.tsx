import React from 'react';
import { useTranslations } from 'next-intl';
import { QRCodeSVG } from 'qrcode.react';
import type { ShipmentDetail } from '../../types/shipment';
import { formatCurrency, formatDateTime } from '../shipment-details';

interface ShipmentLabelProps {
  shipment: ShipmentDetail;
}

interface PackageUnit {
  cargoName: string;
  weightKg: number;
  packageIndex: number;
  totalPackages: number;
}

export function ShipmentLabel({ shipment }: ShipmentLabelProps) {
  const t = useTranslations('shipments');
  // Separate individual cargo units from cargoItems based on quantity
  const packages: PackageUnit[] = [];
  const items = shipment.cargoItems || [];

  for (const item of items) {
    const qty = Math.max(1, item.quantity || 1);
    const weightPerUnit =
      (item.actualWeightKg ?? item.weightKg ?? 0) / (qty || 1);

    for (let q = 0; q < qty; q++) {
      packages.push({
        cargoName: item.name,
        weightKg: Number(weightPerUnit.toFixed(1)),
        packageIndex: packages.length + 1,
        totalPackages: 1, // Will be assigned after total calculation
      });
    }
  }

  // If no package, create a default one
  if (packages.length === 0) {
    packages.push({
      cargoName: t('cargoNameDefault'),
      weightKg: 1,
      packageIndex: 1,
      totalPackages: 1,
    });
  }

  const totalPackages = packages.length;
  packages.forEach((pkg) => {
    pkg.totalPackages = totalPackages;
  });

  const isPreAcceptance = shipment.status === 'MOI_TAO';
  const isReceiverPaying = shipment.feeSummary?.freightPayer === 'NGUOI_NHAN';
  const amountToCollect =
    shipment.feeSummary?.outstandingAmount ?? shipment.totalFee ?? 0;

  return (
    <div className="flex flex-col items-center">
      {packages.map((pkg) => (
        <div key={`pkg-${pkg.packageIndex}`} className="print-label-item">
          {isPreAcceptance && (
            <div className="print-watermark">
              {t('watermarkEstimated')}
            </div>
          )}

          {/* Header & package index */}
          <div className="border-b-2 border-slate-900 pb-2 flex items-start justify-between gap-2">
            <div>
              <div className="font-black text-sm uppercase tracking-wide">
                {shipment.carrier?.name || 'VEXGO LOGISTICS'}
              </div>
              <div className="text-[10px] text-slate-600">
                {t('hotlineCSKH')}
              </div>
            </div>
            <div className="text-right">
              <span className="inline-block bg-slate-900 text-white text-xs font-black px-2 py-0.5 rounded">
                {t('packageBadge', { current: pkg.packageIndex, total: pkg.totalPackages })}
              </span>
            </div>
          </div>

          {/* Waybill Code & QR Code */}
          <div className="py-2.5 border-b border-dashed border-slate-400 flex items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                {t('waybillLabel')}
              </div>
              <div className="admin-data-mono font-black text-base tracking-tight break-all">
                {shipment.waybillCode}
              </div>
              <div className="text-[10px] text-slate-600 mt-1">
                {t('tripColon')}{' '}
                <strong className="admin-data-mono">
                  {shipment.trip?.code || t('unassignedTrip')}
                </strong>
              </div>
            </div>
            <div className="shrink-0 p-1 bg-white border border-slate-300 rounded">
              <QRCodeSVG
                value={shipment.waybillCode}
                size={96}
                level="M"
                role="img"
                aria-label={t('qrWaybillAria', { code: shipment.waybillCode })}
              />
            </div>
          </div>

          {/* Route origin - destination posts */}
          <div className="py-2 border-b-2 border-slate-900 grid grid-cols-2 gap-2 text-xs">
            <div className="border-r border-dashed border-slate-300 pr-2">
              <div className="text-[9px] font-bold text-slate-500 uppercase">
                {t('originOffice')}
              </div>
              <div className="font-bold text-slate-900 truncate">
                {shipment.originPoint?.name}
              </div>
              <div className="text-[10px] text-slate-600 line-clamp-1">
                {shipment.originPoint?.address}
              </div>
            </div>
            <div className="pl-1">
              <div className="text-[9px] font-bold text-slate-500 uppercase">
                {t('destOffice')}
              </div>
              <div className="font-extrabold text-slate-950 text-sm truncate text-blue-900">
                {shipment.destinationPoint?.name}
              </div>
              <div className="text-[10px] text-slate-600 line-clamp-1">
                {shipment.destinationPoint?.address}
              </div>
            </div>
          </div>

          {/* Sender & Recipient info */}
          <div className="py-2 border-b border-dashed border-slate-400 space-y-1.5 text-xs">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[10px] text-slate-500 uppercase font-semibold">
                {t('senderColon')}
              </span>
              <span className="font-bold text-slate-800 text-right truncate">
                {shipment.sender.fullName} · {shipment.sender.phoneNumber}
              </span>
            </div>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[10px] text-slate-900 uppercase font-bold">
                {t('recipientColon')}
              </span>
              <span className="font-black text-slate-950 text-right text-sm truncate">
                {shipment.receiver.fullName} · {shipment.receiver.phoneNumber}
              </span>
            </div>
            <div className="text-[10px] text-slate-600 pt-0.5">
              {t('goodsColon')} <strong>{pkg.cargoName}</strong> ({t('estimatedWeight', { weight: pkg.weightKg })})
            </div>
          </div>

          {/* Freight & Payment */}
          <div className="pt-2">
            <div
              className={`p-2 rounded border-2 text-center ${
                isReceiverPaying
                  ? 'border-slate-900 bg-slate-50'
                  : 'border-slate-300 bg-slate-100/50'
              }`}
            >
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-600">
                {isReceiverPaying
                  ? t('freightCollectAtDest')
                  : t('freightPaymentMethod')}
              </div>
              <div className="text-base font-black text-slate-950">
                {isReceiverPaying
                  ? formatCurrency(amountToCollect)
                  : t('senderPaid')}
              </div>
            </div>

            <div className="flex justify-between items-center text-[9px] text-slate-400 mt-2 px-1">
              <span>{t('sentDateLabel', { date: formatDateTime(shipment.sentAt) })}</span>
              <span>VexGo Express Logistics</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
