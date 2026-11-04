'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft, Printer, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/action-button';
import { ResourceState } from '@/components/admin/resource-ui';
import { getShipmentById } from '../../services/shipment-service';
import type { ShipmentDetail } from '../../types/shipment';
import { ShipmentLabel } from './shipment-label';
import { ShipmentReceipt } from './shipment-receipt';
import './shipment-print.css';

interface ShipmentPrintViewProps {
  shipmentId: number;
}

export function ShipmentPrintView({ shipmentId }: ShipmentPrintViewProps) {
  const searchParams = useSearchParams();
  const initialType =
    searchParams?.get('type') === 'receipt' ? 'receipt' : 'label';
  const [printType, setPrintType] = useState<'label' | 'receipt'>(initialType);
  const [shipment, setShipment] = useState<ShipmentDetail | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    setLoading(true);
    setError(null);

    getShipmentById(shipmentId, controller.signal)
      .then((data) => {
        if (active) {
          setShipment(data);
          setLoading(false);
        }
      })
      .catch((err: any) => {
        if (active && err.name !== 'AbortError') {
          setError(err.message || 'Không thể tải thông tin phiếu gửi hàng.');
          setLoading(false);
        }
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [shipmentId]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <ResourceState loading>Đang tải dữ liệu in ấn...</ResourceState>
      </div>
    );
  }

  if (error || !shipment) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-slate-50 p-6">
        <ResourceState error>
          {error || 'Không tìm thấy thông tin đơn gửi hàng.'}
        </ResourceState>
        <Link href="/shipments">
          <Button variant="outline">
            <ArrowLeft className="mr-2 size-4" />
            Quay lại danh sách gửi hàng
          </Button>
        </Link>
      </div>
    );
  }

  const isCancelled = shipment.status === 'DA_HUY';
  const isPreAcceptance = shipment.status === 'MOI_TAO';

  return (
    <div className="min-h-screen bg-slate-100/70 text-slate-900">
      {/* Thanh điều khiển trên cùng - Ẩn hoàn toàn khi in */}
      <header className="print:hidden sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur px-4 py-3 shadow-xs">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 sm:gap-3">
            <Link href="/shipments">
              <Button variant="ghost" size="sm" aria-label="Quay lại">
                <ArrowLeft className="size-4 mr-1 sm:mr-1.5" />
                <span className="hidden sm:inline">Quay lại</span>
              </Button>
            </Link>
            <div className="h-4 w-px bg-slate-200" />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 font-medium">
                  Vận đơn:
                </span>
                <span className="admin-data-mono font-bold text-sm text-slate-900">
                  {shipment.waybillCode}
                </span>
              </div>
            </div>
          </div>

          {/* Chọn khổ in */}
          <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 p-1">
            <button
              type="button"
              onClick={() => setPrintType('label')}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
                printType === 'label'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Tem dán kiện (100×150)
            </button>
            <button
              type="button"
              onClick={() => setPrintType('receipt')}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
                printType === 'receipt'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Biên nhận (K80)
            </button>
          </div>

          {/* Nút bấm in */}
          <div className="flex items-center gap-2">
            <Button
              variant="default"
              size="sm"
              disabled={isCancelled}
              onClick={() => window.print()}
              className="gap-1.5 font-semibold"
            >
              <Printer className="size-4" />
              In ngay
            </Button>
          </div>
        </div>

        {/* Cảnh báo trạng thái */}
        {isCancelled && (
          <div className="mx-auto mt-2.5 max-w-4xl rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800 flex items-center gap-2">
            <AlertTriangle className="size-4 text-rose-600 shrink-0" />
            <span>
              <strong>Đơn hàng đã bị hủy.</strong> Không hỗ trợ in tem kiện hoặc
              biên nhận đối với đơn đã hủy.
            </span>
          </div>
        )}

        {!isCancelled && isPreAcceptance && (
          <div className="mx-auto mt-2.5 max-w-4xl rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 flex items-center gap-2">
            <AlertTriangle className="size-4 text-amber-600 shrink-0" />
            <span>
              <strong>Lưu ý:</strong> Đơn hàng đang ở trạng thái{' '}
              <em>Mới tạo</em> (chưa được nhân viên tiếp nhận chính thức). Phiếu
              in sẽ hiển thị hình mờ (watermark){' '}
              <em>&quot;CƯỚC DỰ KIẾN – CHƯA TIẾP NHẬN&quot;</em>.
            </span>
          </div>
        )}
      </header>

      {/* Vùng xem trước và in ấn */}
      <main className="py-8 px-4 flex justify-center print:p-0 print:m-0">
        {isCancelled ? (
          <div className="my-16 text-center text-slate-500">
            <p className="font-medium">
              Đơn hàng đã hủy, không thể xuất bản in.
            </p>
          </div>
        ) : printType === 'label' ? (
          <ShipmentLabel shipment={shipment} />
        ) : (
          <ShipmentReceipt shipment={shipment} />
        )}
      </main>
    </div>
  );
}
