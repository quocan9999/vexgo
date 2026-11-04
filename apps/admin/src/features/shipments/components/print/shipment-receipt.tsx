import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import type { ShipmentDetail } from '../../types/shipment';
import {
  formatCurrency,
  formatDateTime,
  FREIGHT_PAYER_LABELS,
} from '../shipment-details';

interface ShipmentReceiptProps {
  shipment: ShipmentDetail;
}

export function ShipmentReceipt({ shipment }: ShipmentReceiptProps) {
  const isPreAcceptance = shipment.status === 'MOI_TAO';
  const isReceiverPaying = shipment.feeSummary?.freightPayer === 'NGUOI_NHAN';
  const feeSummary = shipment.feeSummary;
  const items = shipment.cargoItems || [];

  return (
    <div className="print-receipt-container font-sans">
      {isPreAcceptance && (
        <div className="print-watermark">
          CƯỚC DỰ KIẾN – CHƯA TIẾP NHẬN
        </div>
      )}

      {/* Header Nhà xe */}
      <div className="text-center pb-2 border-b-2 border-slate-900">
        <div className="font-black text-sm uppercase tracking-wide text-slate-950">
          {shipment.carrier?.name || 'VEXGO LOGISTICS'}
        </div>
        <div className="text-[10px] text-slate-600">
          Tổng đài hỗ trợ & Tra cứu: 1900 6067
        </div>
        <div className="font-black text-xs uppercase tracking-wider text-slate-900 mt-1.5">
          PHIẾU BIÊN NHẬN GỬI HÀNG
        </div>
      </div>

      {/* Thông tin vận đơn */}
      <div className="py-2 border-b border-dashed border-slate-400 space-y-1 text-[11px]">
        <div className="flex justify-between items-baseline">
          <span className="text-slate-500">Mã vận đơn:</span>
          <strong className="admin-data-mono font-black text-xs text-slate-950">
            {shipment.waybillCode}
          </strong>
        </div>
        <div className="flex justify-between items-baseline">
          <span className="text-slate-500">Ngày gửi:</span>
          <span className="text-slate-700">{formatDateTime(shipment.sentAt)}</span>
        </div>
        {shipment.trip?.code && (
          <div className="flex justify-between items-baseline">
            <span className="text-slate-500">Chuyến xe:</span>
            <span className="admin-data-mono font-bold text-slate-800">
              {shipment.trip.code}
            </span>
          </div>
        )}
      </div>

      {/* Tuyến bưu cục gửi & nhận */}
      <div className="py-2 border-b border-dashed border-slate-400 space-y-1.5 text-[11px]">
        <div>
          <div className="text-[9px] font-bold text-slate-500 uppercase">
            BƯU CỤC GỬI:
          </div>
          <div className="font-bold text-slate-900">
            {shipment.originPoint?.name}
          </div>
          <div className="text-[10px] text-slate-600 line-clamp-1">
            {shipment.originPoint?.address}
          </div>
        </div>

        <div>
          <div className="text-[9px] font-bold text-slate-500 uppercase">
            BƯU CỤC ĐÍCH (NHẬN):
          </div>
          <div className="font-extrabold text-slate-950 text-blue-900">
            {shipment.destinationPoint?.name}
          </div>
          <div className="text-[10px] text-slate-600 line-clamp-1">
            {shipment.destinationPoint?.address}
          </div>
        </div>
      </div>

      {/* Thông tin người gửi / nhận */}
      <div className="py-2 border-b border-dashed border-slate-400 space-y-1 text-[11px]">
        <div className="flex justify-between items-baseline gap-1">
          <span className="text-slate-500 shrink-0">Người gửi:</span>
          <span className="font-bold text-slate-800 text-right truncate">
            {shipment.sender.fullName} ({shipment.sender.phoneNumber})
          </span>
        </div>
        <div className="flex justify-between items-baseline gap-1">
          <span className="text-slate-500 shrink-0 font-bold">Người nhận:</span>
          <strong className="font-extrabold text-slate-950 text-right truncate">
            {shipment.receiver.fullName} ({shipment.receiver.phoneNumber})
          </strong>
        </div>
        {shipment.note && (
          <div className="text-[10px] text-slate-600 italic pt-0.5">
            Ghi chú: {shipment.note}
          </div>
        )}
      </div>

      {/* Danh sách kiện hàng */}
      <div className="py-2 border-b border-dashed border-slate-400">
        <div className="text-[10px] font-bold text-slate-500 uppercase mb-1">
          CHI TIẾT HÀNG HÓA ({items.length} mục)
        </div>
        <div className="space-y-1">
          {items.map((item, idx) => (
            <div
              key={item.cargoId || idx}
              className="flex justify-between items-start text-[10px] gap-2"
            >
              <div className="flex-1 min-w-0">
                <span className="font-bold text-slate-900">{item.name}</span>
                <span className="text-slate-500 ml-1">x{item.quantity}</span>
              </div>
              <div className="text-right shrink-0 font-semibold text-slate-700">
                {item.actualWeightKg ?? item.weightKg ?? '—'} kg
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bảng chi tiết cước phí */}
      <div className="py-2 border-b-2 border-slate-900 space-y-1 text-[11px]">
        <div className="flex justify-between items-baseline text-slate-600">
          <span>Cước chính:</span>
          <span>{formatCurrency(feeSummary?.mainFee ?? 0)}</span>
        </div>
        {(feeSummary?.serviceFee ?? 0) > 0 && (
          <div className="flex justify-between items-baseline text-slate-600">
            <span>Phụ phí dịch vụ:</span>
            <span>+{formatCurrency(feeSummary.serviceFee)}</span>
          </div>
        )}
        {(feeSummary?.discountAmount ?? 0) > 0 && (
          <div className="flex justify-between items-baseline text-emerald-700">
            <span>Giảm trừ khuyến mại:</span>
            <span>-{formatCurrency(feeSummary.discountAmount)}</span>
          </div>
        )}

        <div className="flex justify-between items-baseline font-black text-sm text-slate-950 pt-1 border-t border-slate-200">
          <span>TỔNG CƯỚC:</span>
          <span>{formatCurrency(shipment.totalFee)}</span>
        </div>

        <div className="flex justify-between items-baseline text-[10px] text-slate-600 pt-0.5">
          <span>Người thanh toán:</span>
          <span className="font-bold">
            {FREIGHT_PAYER_LABELS[feeSummary?.freightPayer] || feeSummary?.freightPayer}
          </span>
        </div>

        <div className="flex justify-between items-baseline text-[11px] font-bold text-slate-900">
          <span>Số tiền cần thu:</span>
          <span className="text-sm font-black text-rose-700">
            {isReceiverPaying
              ? formatCurrency(feeSummary?.outstandingAmount ?? shipment.totalFee)
              : feeSummary?.outstandingAmount && feeSummary.outstandingAmount > 0
                ? formatCurrency(feeSummary.outstandingAmount)
                : '0 đ (ĐÃ THU)'}
          </span>
        </div>
      </div>

      {/* QR Code tra cứu & Footer */}
      <div className="pt-3 text-center flex flex-col items-center">
        <div className="p-1 bg-white border border-slate-300 rounded mb-1">
          <QRCodeSVG
            value={shipment.waybillCode}
            size={72}
            level="M"
            role="img"
            aria-label={`Mã QR tra cứu ${shipment.waybillCode}`}
          />
        </div>
        <div className="text-[9px] text-slate-500 font-medium">
          Quét mã QR để tra cứu lộ trình vận chuyển
        </div>
        <div className="text-[8px] text-slate-400 mt-2 border-t border-dotted border-slate-300 pt-1 w-full">
          Quý khách vui lòng giữ biên nhận để đối chiếu khi nhận hàng. Cảm ơn quý khách!
        </div>
      </div>
    </div>
  );
}
