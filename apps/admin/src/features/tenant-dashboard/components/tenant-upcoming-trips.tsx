'use client';

import Link from 'next/link';
import { Clock, Eye, ArrowUpRight, Bus } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/status-badge';
import { buttonVariants } from '@/components/ui/action-button';
import { useTranslations } from 'next-intl';
import type { UpcomingTripItem } from '../types/tenant-dashboard';

interface TenantUpcomingTripsProps {
  trips: UpcomingTripItem[];
}

function getTripStatusBadge(status: string, t: (key: any) => string) {
  switch (status) {
    case 'CHUA_KHOI_HANH':
      return (
        <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-blue-200">
          {t('statusNotDeparted')}
        </Badge>
      );
    case 'DANG_CHAY':
      return <Badge variant="warning">{t('statusInTransit')}</Badge>;
    case 'HOAN_THANH':
      return <Badge variant="success">{t('statusCompleted')}</Badge>;
    case 'DA_HUY':
      return <Badge variant="destructive">{t('statusCancelled')}</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

export function TenantUpcomingTrips({ trips }: TenantUpcomingTripsProps) {
  const t = useTranslations('dashboard');
  const getProgressColor = (percent: number) => {
    if (percent >= 80) return 'bg-emerald-500';
    if (percent >= 50) return 'bg-blue-500';
    return 'bg-amber-500';
  };

  return (
    <Card className="shadow-xs border border-border h-full flex flex-col justify-between">
      <div>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border/80 pb-3.5">
          <div>
            <div className="flex items-center gap-2">
              <CardTitle className="text-base font-semibold text-foreground">
                {t('upcomingTripsTitle')}
              </CardTitle>
              <span className="inline-flex items-center justify-center size-5 text-xs font-semibold rounded-full bg-primary/10 text-primary">
                {trips.length}
              </span>
            </div>
            <CardDescription className="text-xs text-muted-foreground mt-0.5">
              {t('upcomingTripsSubtitle')}
            </CardDescription>
          </div>
          <Link
            href="/trips"
            className={
              buttonVariants({ variant: 'outline', size: 'sm' }) +
              ' text-xs h-7.5 px-2.5 gap-1 self-start sm:self-auto shrink-0'
            }
          >
            <span>{t('allTrips')}</span>
            <ArrowUpRight className="size-3.5" />
          </Link>
        </CardHeader>

        <CardContent className="p-0">
          {trips.length === 0 ? (
            <div className="py-12 px-4 text-center">
              <div className="mx-auto size-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
                <Bus className="size-6" />
              </div>
              <p className="text-sm font-medium text-foreground">
                {t('noUpcomingTrips')}
              </p>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                {t('noUpcomingTripsDesc')}
              </p>
              <Link
                href="/trips"
                className={buttonVariants({ variant: 'outline', size: 'sm' }) + ' mt-4 text-xs'}
              >
                {t('viewTripsList')}
              </Link>
            </div>
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="hidden sm:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[100px]">{t('colDepartureTime')}</TableHead>
                      <TableHead>{t('colRoute')}</TableHead>
                      <TableHead>{t('colVehicle')}</TableHead>
                      <TableHead className="min-w-[150px]">{t('colSeatLoad')}</TableHead>
                      <TableHead>{t('colTripStatus')}</TableHead>
                      <TableHead className="text-right">{t('colActions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {trips.map((trip) => (
                      <TableRow key={trip.tripId} className="hover:bg-slate-50/70">
                        {/* Departure time */}
                        <TableCell className="font-semibold text-slate-900">
                          <div className="flex items-center gap-1.5 font-mono text-sm">
                            <Clock className="size-3.5 text-primary shrink-0" />
                            <span>{trip.departureTime}</span>
                          </div>
                          <span className="text-[11px] text-muted-foreground font-sans">
                            {trip.departureDate}
                          </span>
                        </TableCell>

                        {/* Route */}
                        <TableCell>
                          <div className="font-medium text-foreground">
                            {trip.routeName}
                          </div>
                          <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                            <span>{trip.departureLocation}</span>
                            <span>→</span>
                            <span>{trip.arrivalLocation}</span>
                          </div>
                        </TableCell>

                        {/* Vehicle */}
                        <TableCell>
                          <span className="font-mono text-xs font-semibold px-1.5 py-0.5 bg-slate-100 rounded text-slate-800">
                            {trip.licensePlate}
                          </span>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {trip.vehicleTypeName}
                          </div>
                        </TableCell>

                        {/* Occupancy progress */}
                        <TableCell>
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-semibold tabular-nums text-foreground">
                                {trip.loadFactorPercent}%
                              </span>
                              <span className="text-muted-foreground tabular-nums text-[11px]">
                                {t('bookedSeatsRatio', { booked: trip.bookedSeats, total: trip.totalSeats })}
                              </span>
                            </div>
                            <div
                              role="progressbar"
                              aria-valuenow={trip.loadFactorPercent}
                              aria-valuemin={0}
                              aria-valuemax={100}
                              aria-label={t('occupancyProgressAria', { code: trip.tripCode, percent: trip.loadFactorPercent })}
                              className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden"
                            >
                              <div
                                className={`h-full rounded-full transition-all duration-300 ${getProgressColor(
                                  trip.loadFactorPercent,
                                )}`}
                                style={{
                                  width: `${Math.min(100, Math.max(0, trip.loadFactorPercent))}%`,
                                }}
                              />
                            </div>
                          </div>
                        </TableCell>

                        {/* Status */}
                        <TableCell>{getTripStatusBadge(trip.status, t)}</TableCell>

                        {/* Actions */}
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Link
                              href={`/trips/${trip.tripId}/seats`}
                              title={t('viewSeatMap')}
                              className={
                                buttonVariants({ variant: 'outline', size: 'sm' }) +
                                ' h-7 px-2 text-xs gap-1 text-primary hover:text-primary'
                              }
                            >
                              <Eye className="size-3.5" />
                              <span>{t('seatMap')}</span>
                            </Link>
                            <Link
                              href={`/trips/${trip.tripId}`}
                              title={t('tripDetails')}
                              className={
                                buttonVariants({ variant: 'ghost', size: 'sm' }) +
                                ' h-7 px-2 text-xs'
                              }
                            >
                              {t('tripDetails')}
                            </Link>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile Card Fallback View */}
              <div className="block sm:hidden divide-y divide-border/70">
                {trips.map((trip) => (
                  <div key={trip.tripId} className="p-3.5 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 font-mono text-sm font-bold text-slate-900">
                        <Clock className="size-3.5 text-primary" />
                        <span>{trip.departureTime}</span>
                        <span className="text-xs font-normal text-muted-foreground font-sans ml-1">
                          ({trip.departureDate})
                        </span>
                      </div>
                      {getTripStatusBadge(trip.status, t)}
                    </div>

                    <div>
                      <div className="font-semibold text-sm text-foreground">
                        {trip.routeName}
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <span>{trip.departureLocation}</span>
                        <span>→</span>
                        <span>{trip.arrivalLocation}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono px-1.5 py-0.5 bg-slate-100 rounded font-semibold text-slate-800">
                        {trip.licensePlate}
                      </span>
                      <span className="text-muted-foreground">{trip.vehicleTypeName}</span>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-foreground">
                          {t('occupancyPercentLabel', { percent: trip.loadFactorPercent })}
                        </span>
                        <span className="text-muted-foreground">
                          {t('bookedSeatsRatio', { booked: trip.bookedSeats, total: trip.totalSeats })}
                        </span>
                      </div>
                      <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${getProgressColor(
                            trip.loadFactorPercent,
                          )}`}
                          style={{
                            width: `${Math.min(100, Math.max(0, trip.loadFactorPercent))}%`,
                          }}
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <Link
                        href={`/trips/${trip.tripId}/seats`}
                        className={
                          buttonVariants({ variant: 'outline', size: 'sm' }) +
                          ' flex-1 h-8 text-xs gap-1 text-primary justify-center'
                        }
                      >
                        <Eye className="size-3.5" />
                        <span>{t('seatMapFull')}</span>
                      </Link>
                      <Link
                        href={`/trips/${trip.tripId}`}
                        className={
                          buttonVariants({ variant: 'ghost', size: 'sm' }) +
                          ' h-8 text-xs px-3'
                        }
                      >
                        {t('tripDetails')}
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </div>
    </Card>
  );
}
