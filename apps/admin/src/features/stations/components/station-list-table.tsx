'use client';

import { Building2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge, LegacyBadge } from '@/components/ui/status-badge';
import { useTranslations } from 'next-intl';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableCaption,
} from '@/components/ui/table';
import {
  ResourceDetailAction,
  ResourceStatusBadge,
} from '@/components/admin/resource-ui';
import type { Station } from '../types/station';

interface StationListTableProps {
  stations: Station[];
  onSelectStation?: (station: Station) => void;
}

export function StationListTable({
  stations,
  onSelectStation,
}: StationListTableProps) {
  const tStations = useTranslations('stations');
  const tCommon = useTranslations('common');

  const typeLabels: Record<string, string> = {
    BEN_XE: tStations('typeTerminal'),
    VAN_PHONG: tStations('typeOffice'),
    DIEM_DON_TRA: tStations('typeStop'),
    TRUNG_CHUYEN: tStations('typeTransit'),
    TRAM_NGHI: tStations('typeRest'),
  };

  if (stations.length === 0) {
    return (
      <div className="flex min-h-60 flex-col items-center justify-center p-8 text-center text-muted-foreground">
        <Building2 className="mb-2 size-8 text-muted-foreground/60" />
        <p className="text-sm font-medium">{tStations('emptyList')}</p>
        <p className="mt-1 text-xs text-muted-foreground/80">
          {tStations('emptyListSubtitle')}
        </p>
      </div>
    );
  }

  return (
    <>
      {/* Desktop Table */}
      <div className="hidden md:block">
        <Table className="min-w-[960px]">
          <TableCaption className="sr-only">
            {tStations('tableCaption')}
          </TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead scope="col">{tStations('colCode')}</TableHead>
              <TableHead scope="col">{tStations('colName')}</TableHead>
              <TableHead scope="col">{tStations('colType')}</TableHead>
              <TableHead scope="col">{tStations('colRegion')}</TableHead>
              <TableHead scope="col">{tStations('colAddress')}</TableHead>
              <TableHead scope="col">{tStations('colHotline')}</TableHead>
              <TableHead scope="col">
                <span className="sr-only">{tCommon('actions')}</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {stations.map((st) => (
              <TableRow key={st.diemDonTraId}>
                <th
                  className="admin-data-mono whitespace-nowrap px-4 py-3 text-left font-semibold"
                  scope="row"
                >
                  {st.maDiem}
                </th>
                <TableCell className="font-medium text-foreground">
                  {st.tenDiem}
                </TableCell>
                <TableCell>
                  <ResourceStatusBadge
                    tone={st.loaiDiem === 'BEN_XE' ? 'active' : 'muted'}
                  >
                    {typeLabels[st.loaiDiem] ?? st.loaiDiem}
                  </ResourceStatusBadge>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-1.5 font-medium text-foreground">
                      <span>{st.diaDiemCu?.tenDiaDiem ?? '—'}</span>
                      <LegacyBadge />
                    </div>
                    {st.diaDiemMoi && (
                      <span className="text-xs text-muted-foreground">
                        ➔ {st.diaDiemMoi.tenDiaDiem}
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="max-w-[280px] text-xs text-muted-foreground">
                  <span className="line-clamp-2">{st.diaChi}</span>
                </TableCell>
                <TableCell className="admin-data-mono text-xs text-muted-foreground">
                  {st.soDienThoai || '—'}
                </TableCell>
                <TableCell>
                  <ResourceDetailAction
                    href={`/stations/${st.diemDonTraId}`}
                    onClick={onSelectStation ? () => onSelectStation(st) : undefined}
                    label={tCommon('viewDetails')}
                    resourceName={tStations('resourceNameWithName', { name: st.tenDiem })}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Mobile Cards */}
      <div className="grid gap-4 bg-background p-4 md:hidden">
        {stations.map((st) => (
          <Card className="gap-3 p-4 ring-0" key={st.diemDonTraId}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="admin-data-mono text-base font-semibold">
                  {st.maDiem}
                </h2>
                <p className="mt-0.5 text-sm font-medium">{st.tenDiem}</p>
              </div>
              <ResourceStatusBadge
                tone={st.loaiDiem === 'BEN_XE' ? 'active' : 'muted'}
              >
                {typeLabels[st.loaiDiem] ?? st.loaiDiem}
              </ResourceStatusBadge>
            </div>
            <div className="space-y-1 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5 flex-wrap">
                <strong className="text-foreground">{tStations('colRegion')}:</strong>{' '}
                <span>{st.diaDiemCu?.tenDiaDiem ?? '—'}</span>
                <LegacyBadge />
                {st.diaDiemMoi && <span>➔ {st.diaDiemMoi.tenDiaDiem}</span>}
              </div>
              <p className="line-clamp-2">
                <strong className="text-foreground">{tStations('address')}:</strong> {st.diaChi}
              </p>
              {st.soDienThoai && (
                <p className="admin-data-mono">
                  <strong className="text-foreground">{tStations('colHotline')}:</strong> {st.soDienThoai}
                </p>
              )}
            </div>
            <div className="flex justify-end border-t pt-2">
              <ResourceDetailAction
                href={`/stations/${st.diemDonTraId}`}
                onClick={onSelectStation ? () => onSelectStation(st) : undefined}
                label={tCommon('viewDetails')}
                resourceName={tStations('resourceNameWithName', { name: st.tenDiem })}
              />
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}
