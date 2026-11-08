'use client';

import { useTranslations } from 'next-intl';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Download,
  Printer,
  Users,
  MapPin,
  Clock,
  Bus,
  Search,
  X,
  AlertCircle,
} from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/action-button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/status-badge';
import { ResourceStatusBadge, ResourceState } from '@/components/admin/resource-ui';
import { tripStatusLabel } from './trip-workspace';
import { getTripManifest } from '../services/trip-service';
import type {
  TripManifestData,
  ManifestPassenger,
} from '../types/trip';

interface TripManifestViewProps {
  tripId: number;
}

export function TripManifestView({ tripId }: TripManifestViewProps) {
  const tTrips = useTranslations('trips');
  const tCommon = useTranslations('common');
  const [data, setData] = useState<TripManifestData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'pickup' | 'dropoff' | 'all'>('pickup');
  const [search, setSearch] = useState('');

  useEffect(() => {
    void Promise.resolve().then(() => setLoading(true));
    getTripManifest(tripId)
      .then((res) => {
        setData(res);
        setError(null);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : tTrips('cannotLoadManifest'));
      })
      .finally(() => setLoading(false));
  }, [tripId]);

  // Toàn bộ hành khách phẳng
  const allPassengers = useMemo(() => {
    if (!data) return [];
    const list: ManifestPassenger[] = [];
    const seen = new Set<number>();

    for (const g of data.pickupGroups) {
      for (const p of g.passengers) {
        if (!seen.has(p.veId)) {
          seen.add(p.veId);
          list.push(p);
        }
      }
    }
    for (const g of data.dropoffGroups) {
      for (const p of g.passengers) {
        if (!seen.has(p.veId)) {
          seen.add(p.veId);
          list.push(p);
        }
      }
    }
    for (const p of data.unassignedPassengers) {
      if (!seen.has(p.veId)) {
        seen.add(p.veId);
        list.push(p);
      }
    }

    list.sort((a, b) => a.soGhe.localeCompare(b.soGhe, undefined, { numeric: true }));
    return list;
  }, [data]);

  // Lọc tìm kiếm
  const filterPass = (pass: ManifestPassenger) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      pass.hoTen.toLowerCase().includes(q) ||
      pass.soDienThoai.toLowerCase().includes(q) ||
      pass.soGhe.toLowerCase().includes(q) ||
      pass.maVe.toLowerCase().includes(q) ||
      pass.diemDonTen.toLowerCase().includes(q) ||
      pass.diemTraTen.toLowerCase().includes(q)
    );
  };

  // In danh sách
  const handlePrint = () => {
    window.print();
  };

  // Xuất file CSV UTF-8 BOM
  const handleExportCsv = () => {
    if (!data || allPassengers.length === 0) return;

    const headers = [
      'STT',
      tTrips('seatCol'),
      tTrips('passengerNameCol'),
      tTrips('phoneCol'),
      tTrips('expectedPickupCol'),
      tTrips('expectedDropoffCol'),
      tTrips('ticketPriceCol'),
      tTrips('ticketCodeCol'),
      tTrips('ticketStatusCol'),
    ];

    const rows = allPassengers.map((p, idx) => [
      idx + 1,
      `"${p.soGhe}"`,
      `"${p.hoTen.replace(/"/g, '""')}"`,
      `"${p.soDienThoai}"`,
      `"${p.diemDonTen.replace(/"/g, '""')}"`,
      `"${p.diemTraTen.replace(/"/g, '""')}"`,
      p.giaThucTe,
      `"${p.maVe}"`,
      `"${p.trangThai}"`,
    ]);

    const csvContent =
      '\uFEFF' +
      [
        `"${tTrips('csvTitle', { code: data.trip.maChuyenXe })}"`,
        `"${tTrips('csvRoute', { origin: data.trip.tuyenXe.diemDi, destination: data.trip.tuyenXe.diemDen })}"`,
        `"${tTrips('csvDeparture', { time: data.trip.gioKhoiHanh, date: data.trip.ngayKhoiHanh, plate: data.trip.xe.bienSoXe, type: data.trip.xe.tenLoaiXe })}"`,
        `"${tTrips('csvTotalPassengers', { count: allPassengers.length })}"`,
        '',
        headers.join(','),
        ...rows.map((r) => r.join(',')),
      ].join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `danh-sach-hanh-khach-${data.trip.maChuyenXe}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return <ResourceState loading>{tTrips('loadingManifest')}</ResourceState>;
  }

  if (error || !data) {
    return (
      <ResourceState error>
        <p>{error ?? tTrips('cannotLoadManifest')}</p>
        <Link className={buttonVariants({ variant: 'outline' })} href="/trips">
          {tTrips('backToTripManifest')}
        </Link>
      </ResourceState>
    );
  }

  const { trip, pickupGroups, dropoffGroups, unassignedPassengers } = data;
  const pickupTotalCount = pickupGroups.reduce((acc, g) => acc + g.passengers.length, 0);
  const dropoffTotalCount = dropoffGroups.reduce((acc, g) => acc + g.passengers.length, 0);

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 sm:p-6 print:p-0 print:max-w-none print:m-0">
      {/* Header chỉ hiển thị trên màn hình, ẩn khi in */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4 print:hidden">
        <div className="flex items-center gap-3">
          <Link
            className={buttonVariants({ variant: 'outline', size: 'sm' })}
            href="/trips"
          >
            <ArrowLeft className="size-4 mr-1.5" />
            {tTrips('backToTrips')}
          </Link>
          <div>
            <h1 className="text-xl font-bold tracking-tight">
              {tTrips('manifestTitle')}
            </h1>
            <p className="text-xs text-muted-foreground">
              {tTrips('manifestCode', { code: trip.maChuyenXe })}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExportCsv}>
            <Download className="size-4 mr-1.5" />
            {tTrips('exportCsv')}
          </Button>
          <Button size="sm" onClick={handlePrint}>
            <Printer className="size-4 mr-1.5" />
            {tTrips('printManifest')}
          </Button>
        </div>
      </div>

      {/* Card tóm tắt chuyến xe */}
      <Card className="p-4 sm:p-5 border border-border bg-card print:border-none print:shadow-none print:p-0">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold font-mono text-primary">
                {trip.maChuyenXe}
              </span>
              <ResourceStatusBadge
                tone={trip.trangThai === 'DANG_CHAY' ? 'active' : 'muted'}
              >
                {tripStatusLabel(trip.trangThai as any, tTrips)}
              </ResourceStatusBadge>
            </div>
            <p className="text-sm font-semibold mt-1">
              {trip.tuyenXe.diemDi} → {trip.tuyenXe.diemDen} ({trip.tuyenXe.maTuyenXe})
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4 sm:gap-6 text-xs text-muted-foreground print:text-black">
            <div className="flex items-center gap-1.5">
              <Clock className="size-4 text-primary" />
              <span>
                {tTrips('departureLabel')}: <strong className="text-foreground">{trip.gioKhoiHanh}</strong> ({trip.ngayKhoiHanh})
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Bus className="size-4 text-primary" />
              <span>
                {tTrips('colVehicle')}: <strong className="text-foreground">{trip.xe.bienSoXe}</strong> ({trip.xe.tenLoaiXe})
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Users className="size-4 text-primary" />
              <span>
                {tTrips('passengersSummary', { count: allPassengers.length })}
              </span>
            </div>
          </div>
        </div>

        {/* Tabs và Thanh tìm kiếm */}
        <Tabs
          value={activeTab}
          onValueChange={(val) => setActiveTab(val as 'pickup' | 'dropoff' | 'all')}
          className="mt-4 print:hidden"
        >
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <TabsList>
              <TabsTrigger value="pickup">
                {tTrips('pickupTab', { count: pickupTotalCount })}
              </TabsTrigger>
              <TabsTrigger value="dropoff">
                {tTrips('dropoffTab', { count: dropoffTotalCount })}
              </TabsTrigger>
              <TabsTrigger value="all">
                {tTrips('allPassengersTab', { count: allPassengers.length })}
              </TabsTrigger>
            </TabsList>

            <div className="relative w-full sm:w-72">
              <Search
                aria-hidden
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                type="search"
                placeholder={tTrips('searchManifestPlaceholder')}
                className="pl-9 pr-9 text-xs h-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <Button
                  aria-label={tTrips('clearSearch')}
                  className="absolute right-1 top-1/2 -translate-y-1/2 size-7 p-0"
                  onClick={() => setSearch('')}
                  size="icon-sm"
                  variant="ghost"
                >
                  <X className="size-3.5" />
                </Button>
              )}
            </div>
          </div>

          {/* 1. Tab Chiều Đón */}
          <TabsContent value="pickup" className="mt-6 space-y-6">
            <h2 className="text-sm font-semibold flex items-center gap-2 border-l-2 border-primary pl-2.5">
              <span>{tTrips('pickupHeading')}</span>
              <span className="text-xs font-normal text-muted-foreground">
                {tTrips('pickupSubheading')}
              </span>
            </h2>

            {pickupGroups.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">{tTrips('noPickupStops')}</p>
            ) : (
              pickupGroups.map((group) => {
                const filteredList = group.passengers.filter(filterPass);
                if (filteredList.length === 0 && search) return null;

                return (
                  <Card
                    key={group.diemDonTraChuyenXeId}
                    size="sm"
                    className="overflow-hidden border border-border"
                  >
                    <div className="bg-muted/30 p-3.5 flex flex-wrap items-center justify-between gap-2 border-b border-border">
                      <div className="flex items-center gap-2">
                        <MapPin className="size-4 text-primary" />
                        <span className="font-semibold text-sm">{group.tenDiem}</span>
                        <span className="text-xs text-muted-foreground">
                          ({group.diaChi})
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs">
                        <span className="font-mono font-semibold text-primary">
                          {tTrips('pickupTimeLabel', { time: group.gioThucTe })}
                        </span>
                        <Badge variant="secondary" className="text-xs font-semibold">
                          {tTrips('passengersCountBadge', { count: group.passengers.length })}
                        </Badge>
                      </div>
                    </div>

                    {filteredList.length === 0 ? (
                      <div className="p-4 text-center text-xs text-muted-foreground">
                        {tTrips('noPassengersAtStop')}
                      </div>
                    ) : (
                      <Table className="text-[13px]">
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-20">{tTrips('seatCol')}</TableHead>
                            <TableHead>{tTrips('passengerNameCol')}</TableHead>
                            <TableHead>{tTrips('phoneCol')}</TableHead>
                            <TableHead>{tTrips('expectedDropoffCol')}</TableHead>
                            <TableHead className="w-32 text-right">{tTrips('ticketPriceCol')}</TableHead>
                            <TableHead className="w-28 text-center">{tTrips('ticketStatusCol')}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredList.map((pass) => (
                            <TableRow key={pass.veId}>
                              <TableCell className="font-semibold font-mono text-primary">
                                {pass.soGhe}
                              </TableCell>
                              <TableCell className="font-medium">{pass.hoTen}</TableCell>
                              <TableCell className="font-mono text-xs">{pass.soDienThoai}</TableCell>
                              <TableCell>{pass.diemTraTen}</TableCell>
                              <TableCell className="text-right font-mono text-xs">
                                {pass.giaThucTe.toLocaleString('vi-VN')} ₫
                              </TableCell>
                              <TableCell className="text-center">
                                <Badge variant="secondary" className="text-[10px] font-mono">
                                  {pass.trangThai}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </Card>
                );
              })
            )}

            {/* Khách chưa chọn điểm đón cụ thể */}
            {unassignedPassengers.length > 0 && (
              <Card size="sm" className="overflow-hidden border border-border">
                <div className="bg-muted/50 p-3.5 flex items-center justify-between border-b border-border">
                  <span className="font-semibold text-sm flex items-center gap-2">
                    <AlertCircle className="size-4 text-amber-600" />
                    {tTrips('unassignedPassengersTitle', { count: unassignedPassengers.length })}
                  </span>
                </div>
                <Table className="text-[13px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-20">{tTrips('seatCol')}</TableHead>
                      <TableHead>{tTrips('passengerNameCol')}</TableHead>
                      <TableHead>{tTrips('phoneCol')}</TableHead>
                      <TableHead>{tTrips('pickupNoteCol')}</TableHead>
                      <TableHead>{tTrips('expectedDropoffCol')}</TableHead>
                      <TableHead className="w-32 text-right">{tTrips('ticketPriceCol')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {unassignedPassengers.filter(filterPass).map((pass) => (
                      <TableRow key={pass.veId}>
                        <TableCell className="font-semibold font-mono">{pass.soGhe}</TableCell>
                        <TableCell className="font-medium">{pass.hoTen}</TableCell>
                        <TableCell className="font-mono text-xs">{pass.soDienThoai}</TableCell>
                        <TableCell className="text-muted-foreground">{pass.diemDonTen}</TableCell>
                        <TableCell>{pass.diemTraTen}</TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          {pass.giaThucTe.toLocaleString('vi-VN')} ₫
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            )}
          </TabsContent>

          {/* 2. Tab Chiều Trả */}
          <TabsContent value="dropoff" className="mt-6 space-y-6">
            <h2 className="text-sm font-semibold flex items-center gap-2 border-l-2 border-primary pl-2.5">
              <span>{tTrips('dropoffHeading')}</span>
              <span className="text-xs font-normal text-muted-foreground">
                {tTrips('dropoffSubheading')}
              </span>
            </h2>

            {dropoffGroups.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">{tTrips('noDropoffStops')}</p>
            ) : (
              dropoffGroups.map((group) => {
                const filteredList = group.passengers.filter(filterPass);
                if (filteredList.length === 0 && search) return null;

                return (
                  <Card
                    key={group.diemDonTraChuyenXeId}
                    size="sm"
                    className="overflow-hidden border border-border"
                  >
                    <div className="bg-muted/30 p-3.5 flex flex-wrap items-center justify-between gap-2 border-b border-border">
                      <div className="flex items-center gap-2">
                        <MapPin className="size-4 text-primary" />
                        <span className="font-semibold text-sm">{group.tenDiem}</span>
                        <span className="text-xs text-muted-foreground">({group.diaChi})</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs">
                        <span className="font-mono font-semibold text-primary">
                          {tTrips('dropoffTimeLabel', { time: group.gioThucTe })}
                        </span>
                        <Badge variant="secondary" className="text-xs font-semibold">
                          {tTrips('passengersCountBadge', { count: group.passengers.length })}
                        </Badge>
                      </div>
                    </div>

                    {filteredList.length === 0 ? (
                      <div className="p-4 text-center text-xs text-muted-foreground">
                        {tTrips('noDropoffPassengersAtStop')}
                      </div>
                    ) : (
                      <Table className="text-[13px]">
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-20">{tTrips('seatCol')}</TableHead>
                            <TableHead>{tTrips('passengerNameCol')}</TableHead>
                            <TableHead>{tTrips('phoneCol')}</TableHead>
                            <TableHead>{tTrips('expectedPickupCol')}</TableHead>
                            <TableHead className="w-32 text-right">{tTrips('ticketPriceCol')}</TableHead>
                            <TableHead className="w-28 text-center">{tTrips('ticketStatusCol')}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredList.map((pass) => (
                            <TableRow key={pass.veId}>
                              <TableCell className="font-semibold font-mono text-primary">
                                {pass.soGhe}
                              </TableCell>
                              <TableCell className="font-medium">{pass.hoTen}</TableCell>
                              <TableCell className="font-mono text-xs">{pass.soDienThoai}</TableCell>
                              <TableCell>{pass.diemDonTen}</TableCell>
                              <TableCell className="text-right font-mono text-xs">
                                {pass.giaThucTe.toLocaleString('vi-VN')} ₫
                              </TableCell>
                              <TableCell className="text-center">
                                <Badge variant="secondary" className="text-[10px] font-mono">
                                  {pass.trangThai}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </Card>
                );
              })
            )}
          </TabsContent>

          {/* 3. Tab Tất cả hành khách */}
          <TabsContent value="all" className="mt-6 space-y-4">
            <Card size="sm" className="overflow-hidden border border-border">
              <Table className="text-[13px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">STT</TableHead>
                    <TableHead className="w-20">{tTrips('seatCol')}</TableHead>
                    <TableHead>{tTrips('passengerNameCol')}</TableHead>
                    <TableHead>{tTrips('phoneCol')}</TableHead>
                    <TableHead>{tTrips('expectedPickupCol')}</TableHead>
                    <TableHead>{tTrips('expectedDropoffCol')}</TableHead>
                    <TableHead className="w-32 text-right">{tTrips('ticketPriceCol')}</TableHead>
                    <TableHead className="w-32">{tTrips('ticketCodeCol')}</TableHead>
                    <TableHead className="w-28 text-center">{tTrips('ticketStatusCol')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allPassengers.filter(filterPass).map((pass, idx) => (
                    <TableRow key={pass.veId}>
                      <TableCell className="text-muted-foreground text-xs">{idx + 1}</TableCell>
                      <TableCell className="font-semibold font-mono text-primary">
                        {pass.soGhe}
                      </TableCell>
                      <TableCell className="font-medium">{pass.hoTen}</TableCell>
                      <TableCell className="font-mono text-xs">{pass.soDienThoai}</TableCell>
                      <TableCell>{pass.diemDonTen}</TableCell>
                      <TableCell>{pass.diemTraTen}</TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {pass.giaThucTe.toLocaleString('vi-VN')} ₫
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {pass.maVe}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary" className="text-[10px] font-mono">
                          {pass.trangThai}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  );
}
