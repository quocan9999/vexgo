/* eslint-disable react-hooks/set-state-in-effect */
'use client';

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  ArrowRightLeft,
  Bus,
  MapPin,
  Plus,
  Trash2,
  PackagePlus,
  AlertCircle,
  LoaderCircle,
  CheckCircle2,
  Printer,
  FileText,
  Copy,
  Check,
} from 'lucide-react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { Button, buttonVariants } from '@/components/ui/action-button';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';
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
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/status-badge';
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
import { SearchableCombobox, type SearchableOption } from '@/components/ui/searchable-combobox';
import { LocationPicker } from '@/features/locations/components/location-picker';

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

const initialCargoItem: CargoItemDraft = {
  id: 'item-1',
  name: '',
  categoryId: '',
  quantity: '1',
  weight: '',
  length: '',
  width: '',
  height: '',
  note: '',
};

export function ShipmentCreateView() {
  const router = useRouter();
  const t = useTranslations('shipments');
  const tCommon = useTranslations('common');

  // Initial loading
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [initialError, setInitialError] = useState<string | null>(null);
  const [routes, setRoutes] = useState<AdminShipmentRouteOption[]>([]);
  const [categories, setCategories] = useState<AdminCargoCategory[]>([]);

  // Selected route and points
  const [origin, setOrigin] = useState<string>('');
  const [destination, setDestination] = useState<string>('');
  const [matchingRoute, setMatchingRoute] = useState<AdminShipmentRouteOption | null>(null);
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
  const [items, setItems] = useState<CargoItemDraft[]>([initialCargoItem]);

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

  // Success dialog
  const [createdShipment, setCreatedShipment] = useState<CreateAdminShipmentResult | null>(null);
  const [successDialogOpen, setSuccessDialogOpen] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  // Searchable options for Stations
  const senderPointOptions: SearchableOption[] = useMemo(() => {
    return senderPoints.map((p) => ({
      id: String(p.id),
      value: String(p.id),
      label: p.name,
      description: p.address,
      group: 'station',
      icon: <MapPin className="size-4" />,
    }));
  }, [senderPoints]);

  const receiverPointOptions: SearchableOption[] = useMemo(() => {
    return receiverPoints.map((p) => ({
      id: String(p.id),
      value: String(p.id),
      label: p.name,
      description: p.address,
      group: 'station',
      icon: <MapPin className="size-4" />,
    }));
  }, [receiverPoints]);

  // Swap route directions
  const handleSwapLocations = () => {
    const tempOrigin = origin;
    setOrigin(destination);
    setDestination(tempOrigin);
  };

  // Load initial routes and cargo categories
  const loadInitialData = async () => {
    try {
      setLoadingInitial(true);
      setInitialError(null);
      const [routesData, catsData] = await Promise.all([
        getAdminShipmentRouteOptions(),
        getAdminShipmentCategories(),
      ]);
      setRoutes(routesData);
      setCategories(catsData);

      if (routesData.length > 0) {
        const firstRoute = routesData[0];
        setOrigin(firstRoute.route.origin);
        setDestination(firstRoute.route.destination);
        setRouteId(String(firstRoute.routeId));
        setMatchingRoute(firstRoute);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t('createInitialError');
      setInitialError(msg);
    } finally {
      setLoadingInitial(false);
    }
  };

  useEffect(() => {
    void loadInitialData();
  }, []);

  // Automatically find and match route when origin or destination changes
  useEffect(() => {
    if (!origin || !destination) {
      setMatchingRoute(null);
      setRouteId('');
      return;
    }

    const normOrigin = origin.trim().toLowerCase();
    const normDest = destination.trim().toLowerCase();

    // 1. Check in cached route list
    const found = routes.find(
      (r) =>
        r.route.origin.trim().toLowerCase() === normOrigin &&
        r.route.destination.trim().toLowerCase() === normDest,
    );

    if (found) {
      setMatchingRoute(found);
      setRouteId(String(found.routeId));
      if (errors.routeId) {
        setErrors((prev) => {
          const next = { ...prev };
          delete next.routeId;
          return next;
        });
      }
      return;
    }

    // 2. Query API if not found in local cache
    let active = true;
    getAdminShipmentRouteOptions({ from: origin, to: destination })
      .then((results) => {
        if (!active) return;
        if (results.length > 0) {
          const matched = results[0];
          setMatchingRoute(matched);
          setRouteId(String(matched.routeId));
          setRoutes((prev) => {
            if (prev.some((r) => r.routeId === matched.routeId)) return prev;
            return [...prev, matched];
          });
          if (errors.routeId) {
            setErrors((prev) => {
              const next = { ...prev };
              delete next.routeId;
              return next;
            });
          }
        } else {
          setMatchingRoute(null);
          setRouteId('');
        }
      })
      .catch(() => {
        if (active) {
          setMatchingRoute(null);
          setRouteId('');
        }
      });

    return () => {
      active = false;
    };
  }, [origin, destination, routes, errors.routeId]);

  // When route changes, fetch pickup/dropoff points
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
        const pointsRes = await getAdminRoutePointsByRoute(Number(routeId), controller.signal);
        setSenderPoints(pointsRes.senderPoints);
        setReceiverPoints(pointsRes.receiverPoints);

        if (pointsRes.senderPoints.length > 0) {
          setSenderPointId(String(pointsRes.senderPoints[0].id));
        } else {
          setSenderPointId('');
        }

        if (pointsRes.receiverPoints.length > 0) {
          const defaultReceiver =
            pointsRes.receiverPoints.length > 1 && pointsRes.senderPoints.length > 0
              ? pointsRes.receiverPoints.find((p) => p.id !== pointsRes.senderPoints[0].id) ?? pointsRes.receiverPoints[0]
              : pointsRes.receiverPoints[0];
          setReceiverPointId(String(defaultReceiver.id));
        } else {
          setReceiverPointId('');
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') return;
        setSenderPoints([]);
        setReceiverPoints([]);
      } finally {
        setPointsLoading(false);
      }
    }

    void loadPoints();

    return () => {
      controller.abort();
    };
  }, [routeId]);

  // Debounced quote calculation
  useEffect(() => {
    if (quoteAbortRef.current) {
      quoteAbortRef.current.abort();
      quoteAbortRef.current = null;
    }

    if (!routeId || !senderPointId || !receiverPointId) {
      setQuote(null);
      setQuoteError(null);
      return;
    }

    const validItems = items.filter((it) => {
      const w = parseFloat(it.weight);
      return !Number.isNaN(w) && w > 0;
    });

    if (validItems.length === 0) {
      setQuote(null);
      setQuoteError(null);
      return;
    }

    const timer = setTimeout(async () => {
      const abort = new AbortController();
      quoteAbortRef.current = abort;

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
            items: validItems.map((it) => ({
              name: it.name.trim() || t('cargoNameDefault'),
              loaiHangHoaId: it.categoryId ? Number(it.categoryId) : undefined,
              weight: parseFloat(it.weight),
              quantity: parseInt(it.quantity || '1', 10) || 1,
              length: it.length ? parseFloat(it.length) : undefined,
              width: it.width ? parseFloat(it.width) : undefined,
              height: it.height ? parseFloat(it.height) : undefined,
            })),
          },
          abort.signal,
        );

        setQuote(quoteRes);
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') return;
        const msg = err instanceof Error ? err.message : t('createQuoteError');
        setQuoteError(msg);
        setQuote(null);
      } finally {
        setQuoting(false);
      }
    }, 400);

    return () => {
      clearTimeout(timer);
      if (quoteAbortRef.current) {
        quoteAbortRef.current.abort();
        quoteAbortRef.current = null;
      }
    };
  }, [routeId, senderPointId, receiverPointId, items, isFragile, isValuable]);

  // Items manipulation
  const handleAddItem = () => {
    setItems((prev) => [
      ...prev,
      {
        id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
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
  };

  const handleRemoveItem = (id: string) => {
    setItems((prev) => (prev.length > 1 ? prev.filter((it) => it.id !== id) : prev));
  };

  const handleItemChange = (id: string, field: keyof CargoItemDraft, value: string) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, [field]: value } : it)));
    if (errors[`item_${id}_${field}`] || errors[`item_${id}_dimensions`]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[`item_${id}_${field}`];
        delete next[`item_${id}_dimensions`];
        return next;
      });
    }
  };

  // Client-side Validation
  const validateForm = (): boolean => {
    const errs: Record<string, string> = {};

    if (!origin.trim()) errs.origin = t('errOriginRequired');
    if (!destination.trim()) errs.destination = t('errDestRequired');
    if (origin.trim() && destination.trim() && origin.trim().toLowerCase() === destination.trim().toLowerCase()) {
      errs.destination = t('errDestDifferent');
    }
    if (!routeId) errs.routeId = t('errNoRouteBetween');
    if (!senderPointId) errs.senderPointId = t('errSenderPointRequired');
    if (!receiverPointId) errs.receiverPointId = t('errReceiverPointRequired');
    if (senderPointId && receiverPointId && senderPointId === receiverPointId) {
      errs.receiverPointId = t('errReceiverPointDifferent');
    }

    // Sender
    if (!senderName.trim()) errs.senderName = t('errSenderNameRequired');
    if (!senderPhone.trim()) {
      errs.senderPhone = t('errSenderPhoneRequired');
    } else if (!/^0\d{9}$/.test(senderPhone.trim())) {
      errs.senderPhone = t('errSenderPhoneFormat');
    }

    // Receiver
    if (!receiverName.trim()) errs.receiverName = t('errReceiverNameRequired');
    if (!receiverPhone.trim()) {
      errs.receiverPhone = t('errReceiverPhoneRequired');
    } else if (!/^0\d{9}$/.test(receiverPhone.trim())) {
      errs.receiverPhone = t('errReceiverPhoneFormat');
    }

    // Items
    if (items.length === 0) {
      errs.items = t('errMinOneCargoItem');
    } else {
      items.forEach((it, idx) => {
        if (!it.name.trim()) {
          errs[`item_${idx}_name`] = t('errCargoItemNameRequired', { index: idx + 1 });
        }
        const q = parseInt(it.quantity, 10);
        if (Number.isNaN(q) || q < 1) {
          errs[`item_${idx}_quantity`] = t('errCargoItemQtyGte1', { index: idx + 1 });
        }
        const w = parseFloat(it.weight);
        if (Number.isNaN(w) || w <= 0) {
          errs[`item_${idx}_weight`] = t('errCargoItemWeightGt0', { index: idx + 1 });
        }

        const l = it.length.trim() ? parseFloat(it.length) : null;
        const widthVal = it.width.trim() ? parseFloat(it.width) : null;
        const h = it.height.trim() ? parseFloat(it.height) : null;
        const hasAnyDim = l !== null || widthVal !== null || h !== null;
        const hasAllDim = l !== null && widthVal !== null && h !== null;
        if (hasAnyDim && !hasAllDim) {
          errs[`item_${idx}_dimensions`] = t('errCargoItemDimensionsRequired', { index: idx + 1 });
        } else if (hasAllDim && (l! <= 0 || widthVal! <= 0 || h! <= 0)) {
          errs[`item_${idx}_dimensions`] = t('errCargoItemDimensionsGt0', { index: idx + 1 });
        }
      });
    }

    // Counter constraints
    if (collectPaymentAtCounter && !acceptAtCounter) {
      errs.payment = t('errCashCounterPayment');
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // Reset form to create next shipment
  const handleResetForm = () => {
    if (routes.length > 0) {
      const firstRoute = routes[0];
      setOrigin(firstRoute.route.origin);
      setDestination(firstRoute.route.destination);
      setRouteId(String(firstRoute.routeId));
      setMatchingRoute(firstRoute);
    } else {
      setOrigin('');
      setDestination('');
      setRouteId('');
      setMatchingRoute(null);
    }
    setSenderName('');
    setSenderPhone('');
    setSenderEmail('');
    setReceiverName('');
    setReceiverPhone('');
    setReceiverCccd('');
    setItems([
      {
        ...initialCargoItem,
        id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      },
    ]);
    setIsFragile(false);
    setIsValuable(false);
    setFreightPayer('NGUOI_GUI');
    setAcceptAtCounter(true);
    setCollectPaymentAtCounter(true);
    setShipmentNote('');
    setQuote(null);
    setQuoteError(null);
    setErrors({});
    setSubmitError(null);
    setCreatedShipment(null);
    setSuccessDialogOpen(false);
    setCopiedCode(false);
  };

  // Copy waybill code to clipboard
  const handleCopyWaybillCode = (code: string) => {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(code).then(() => {
        setCopiedCode(true);
        toast.success(t('copiedWaybill'));
        setTimeout(() => setCopiedCode(false), 2000);
      });
    }
  };

  // Print helper
  const handleOpenPrint = (shipmentId: number, type: 'label' | 'receipt') => {
    window.open(`/shipments/${shipmentId}/print?type=${type}`, '_blank');
  };

  // Form submit
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (!validateForm()) {
      if (errorSummaryRef.current) {
        errorSummaryRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }

    try {
      setSubmitting(true);
      const idempotencyKey = `counter-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      const payload = {
        routeId: Number(routeId),
        senderPointId: Number(senderPointId),
        receiverPointId: Number(receiverPointId),
        acceptAtCounter,
        collectPaymentAtCounter: acceptAtCounter && freightPayer === 'NGUOI_GUI' ? collectPaymentAtCounter : false,
        paymentMethod: freightPayer === 'NGUOI_GUI' && collectPaymentAtCounter ? ('TAI_BEN' as const) : undefined,
        freightPayer,
        isFragile,
        isValuable,
        notes: shipmentNote.trim() || undefined,
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
        items: items.map((it) => ({
          name: it.name.trim(),
          loaiHangHoaId: it.categoryId ? Number(it.categoryId) : undefined,
          quantity: parseInt(it.quantity, 10),
          weight: parseFloat(it.weight),
          length: it.length.trim() ? parseFloat(it.length) : undefined,
          width: it.width.trim() ? parseFloat(it.width) : undefined,
          height: it.height.trim() ? parseFloat(it.height) : undefined,
          note: it.note.trim() || undefined,
        })),
      };

      const result = await createAdminShipment(payload, idempotencyKey);
      setCreatedShipment(result);
      setSuccessDialogOpen(true);
      toast.success(t('createSubmitSuccess'));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t('createSubmitError');
      setSubmitError(msg);
      if (errorSummaryRef.current) {
        errorSummaryRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const errorCount = Object.keys(errors).length;

  return (
    <div className="admin-page-content admin-ui space-y-6">
      {/* Top Breadcrumb & Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Link
            href="/shipments"
            className={buttonVariants({ variant: 'outline', size: 'sm' })}
          >
            <ArrowLeft className="size-4" />
            {t('createBackToList')}
          </Link>
        </div>
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <div>
            <p className="eyebrow text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              {t('createEyebrow')}
            </p>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {t('createTitle')}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {t('createSubtitle')}
            </p>
          </div>
        </div>
      </div>

      {loadingInitial ? (
        <Card className="p-12 text-center text-muted-foreground">
          <div className="flex flex-col items-center justify-center gap-3">
            <LoaderCircle className="size-8 animate-spin text-primary" />
            <p className="text-sm font-medium">{t('createLoadingData')}</p>
          </div>
        </Card>
      ) : initialError ? (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertTitle>{tCommon('error')}</AlertTitle>
          <AlertDescription className="flex items-center justify-between">
            <span>{initialError}</span>
            <Button onClick={loadInitialData} size="sm" variant="outline">
              {tCommon('retry')}
            </Button>
          </AlertDescription>
        </Alert>
      ) : (
        <form onSubmit={handleSubmit} noValidate>
          {/* Main 12-column layout */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
            {/* Left 8 columns: Form cards */}
            <div className="xl:col-span-8 space-y-6">
              {/* Card 1: Route & Stations */}
              <Card>
                <CardHeader>
                  <CardTitle>{t('createRouteCardTitle')}</CardTitle>
                  <CardDescription>
                    {t('createRouteCardDesc')}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Origin & Destination pickers with swap button */}
                  <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr] items-end">
                    <FieldRoot>
                      <FieldLabel htmlFor="shipment-origin" className="flex items-center gap-1.5 font-semibold">
                        <MapPin className="size-4 text-primary" />
                        {t('senderOriginLabel')} *
                      </FieldLabel>
                      <LocationPicker
                        id="shipment-origin"
                        value={origin}
                        onChange={(val) => {
                          setOrigin(val);
                          if (errors.origin) {
                            setErrors((prev) => {
                              const next = { ...prev };
                              delete next.origin;
                              return next;
                            });
                          }
                        }}
                        placeholder={t('createOriginPlaceholder')}
                        disabled={submitting}
                        invalid={Boolean(errors.origin)}
                      />
                      {errors.origin && <FieldError>{errors.origin}</FieldError>}
                    </FieldRoot>

                    <div className="pb-2 flex justify-center">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={handleSwapLocations}
                        title={t('swapOriginDest')}
                        aria-label={t('swapOriginDest')}
                        className="size-10 shrink-0"
                        disabled={submitting || (!origin && !destination)}
                      >
                        <ArrowRightLeft className="size-4 text-primary" />
                      </Button>
                    </div>

                    <FieldRoot>
                      <FieldLabel htmlFor="shipment-destination" className="flex items-center gap-1.5 font-semibold">
                        <MapPin className="size-4 text-destructive" />
                        {t('receiverDestLabel')} *
                      </FieldLabel>
                      <LocationPicker
                        id="shipment-destination"
                        value={destination}
                        excludeValue={origin}
                        onChange={(val) => {
                          setDestination(val);
                          if (errors.destination) {
                            setErrors((prev) => {
                              const next = { ...prev };
                              delete next.destination;
                              return next;
                            });
                          }
                        }}
                        placeholder={t('createDestPlaceholder')}
                        disabled={submitting}
                        invalid={Boolean(errors.destination)}
                      />
                      {errors.destination && <FieldError>{errors.destination}</FieldError>}
                    </FieldRoot>
                  </div>

                  {/* Matched route info or alert */}
                  {origin && destination && (
                    matchingRoute ? (
                      <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-primary/5 border border-primary/20 rounded-lg text-sm">
                        <div className="flex items-center gap-2">
                          <Bus className="size-4 text-primary shrink-0" />
                          <span>
                            {t('matchedRouteNotice', {
                              origin: matchingRoute.route.origin,
                              destination: matchingRoute.route.destination,
                              carrier: matchingRoute.busCompany.name,
                            })}
                          </span>
                        </div>
                        <Badge variant="outline" className="bg-background text-xs font-semibold">
                          {t('createMinEstimatedFee', { fee: formatCurrency(matchingRoute.minimumEstimatedFee) })}
                        </Badge>
                      </div>
                    ) : (
                      <Alert variant="destructive">
                        <AlertCircle className="size-4" />
                        <AlertTitle>{t('createNoRouteTitle')}</AlertTitle>
                        <AlertDescription>
                          {t.rich('createNoRouteDesc', {
                            origin,
                            destination,
                            strong: (chunks) => <strong>{chunks}</strong>,
                          })}
                        </AlertDescription>
                      </Alert>
                    )
                  )}

                  {/* Counter pickup and delivery stations combobox */}
                  <div className="grid gap-4 sm:grid-cols-2 pt-1">
                    <FieldRoot className="sm:col-span-1">
                      <FieldLabel htmlFor="sender-point-combobox">{t('senderPointLabel')} *</FieldLabel>
                      <SearchableCombobox
                        id="sender-point-combobox"
                        value={senderPointId}
                        options={senderPointOptions}
                        onChange={(val) => {
                          setSenderPointId(val);
                          if (errors.senderPointId) {
                            setErrors((prev) => {
                              const next = { ...prev };
                              delete next.senderPointId;
                              return next;
                            });
                          }
                        }}
                        disabled={submitting || pointsLoading || !routeId}
                        loading={pointsLoading}
                        placeholder={pointsLoading ? tCommon('loading') : t('createStationSelectSender')}
                        icon={<MapPin className="size-4" />}
                        allowCustom={false}
                        aria-invalid={Boolean(errors.senderPointId)}
                      />
                      {errors.senderPointId && <FieldError>{errors.senderPointId}</FieldError>}
                    </FieldRoot>

                    <FieldRoot className="sm:col-span-1">
                      <FieldLabel htmlFor="receiver-point-combobox">{t('receiverPointLabel')} *</FieldLabel>
                      <SearchableCombobox
                        id="receiver-point-combobox"
                        value={receiverPointId}
                        options={receiverPointOptions}
                        onChange={(val) => {
                          setReceiverPointId(val);
                          if (errors.receiverPointId) {
                            setErrors((prev) => {
                              const next = { ...prev };
                              delete next.receiverPointId;
                              return next;
                            });
                          }
                        }}
                        disabled={submitting || pointsLoading || !routeId}
                        loading={pointsLoading}
                        placeholder={pointsLoading ? tCommon('loading') : t('createStationSelectReceiver')}
                        icon={<MapPin className="size-4" />}
                        excludeValue={senderPointId}
                        allowCustom={false}
                        aria-invalid={Boolean(errors.receiverPointId)}
                      />
                      {errors.receiverPointId && <FieldError>{errors.receiverPointId}</FieldError>}
                    </FieldRoot>
                  </div>
                </CardContent>
              </Card>

              {/* Card 2: Customers Info */}
              <Card>
                <CardHeader>
                  <CardTitle>{t('createCustomerCardTitle')}</CardTitle>
                  <CardDescription>
                    {t('createCustomerCardDesc')}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-6 md:grid-cols-2">
                    {/* Sender */}
                    <div className="space-y-3 rounded-lg border bg-muted/20 p-4">
                      <div className="flex items-center justify-between border-b pb-2">
                        <span className="text-xs font-semibold text-primary uppercase tracking-wide">
                          {t('createSenderCounterBadge')}
                        </span>
                        <Badge variant="secondary">{t('senderHeading')}</Badge>
                      </div>
                      <FieldRoot>
                        <FieldLabel>{t('senderNameLabel')} *</FieldLabel>
                        <Input
                          disabled={submitting}
                          onChange={(e) => setSenderName(e.target.value)}
                          placeholder={t('createSenderNamePlaceholder')}
                          value={senderName}
                        />
                        {errors.senderName && <FieldError>{errors.senderName}</FieldError>}
                      </FieldRoot>
                      <FieldRoot>
                        <FieldLabel>{t('senderPhoneLabel')} *</FieldLabel>
                        <Input
                          disabled={submitting}
                          onChange={(e) => setSenderPhone(e.target.value)}
                          placeholder={t('createSenderPhonePlaceholder')}
                          type="tel"
                          value={senderPhone}
                        />
                        {errors.senderPhone && <FieldError>{errors.senderPhone}</FieldError>}
                      </FieldRoot>
                      <FieldRoot>
                        <FieldLabel>{t('senderEmailLabel')}</FieldLabel>
                        <Input
                          disabled={submitting}
                          onChange={(e) => setSenderEmail(e.target.value)}
                          placeholder={t('createSenderEmailPlaceholder')}
                          type="email"
                          value={senderEmail}
                        />
                      </FieldRoot>
                    </div>

                    {/* Receiver */}
                    <div className="space-y-3 rounded-lg border bg-muted/20 p-4">
                      <div className="flex items-center justify-between border-b pb-2">
                        <span className="text-xs font-semibold text-primary uppercase tracking-wide">
                          {t('createReceiverBadge')}
                        </span>
                        <Badge variant="secondary">{t('receiverHeading')}</Badge>
                      </div>
                      <FieldRoot>
                        <FieldLabel>{t('receiverNameLabel')} *</FieldLabel>
                        <Input
                          disabled={submitting}
                          onChange={(e) => setReceiverName(e.target.value)}
                          placeholder={t('createReceiverNamePlaceholder')}
                          value={receiverName}
                        />
                        {errors.receiverName && <FieldError>{errors.receiverName}</FieldError>}
                      </FieldRoot>
                      <FieldRoot>
                        <FieldLabel>{t('receiverPhoneLabel')} *</FieldLabel>
                        <Input
                          disabled={submitting}
                          onChange={(e) => setReceiverPhone(e.target.value)}
                          placeholder={t('createReceiverPhonePlaceholder')}
                          type="tel"
                          value={receiverPhone}
                        />
                        {errors.receiverPhone && <FieldError>{errors.receiverPhone}</FieldError>}
                      </FieldRoot>
                      <FieldRoot>
                        <FieldLabel>{t('receiverCccdLabel')}</FieldLabel>
                        <Input
                          disabled={submitting}
                          onChange={(e) => setReceiverCccd(e.target.value)}
                          placeholder={t('createReceiverCccdPlaceholder')}
                          value={receiverCccd}
                        />
                      </FieldRoot>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Card 3: Cargo Items */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>{t('createCargoCardTitle')}</CardTitle>
                    <CardDescription>
                      {t('createCargoCardDesc')}
                    </CardDescription>
                  </div>
                  <Button
                    disabled={submitting}
                    onClick={handleAddItem}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    <Plus className="size-4" />
                    {t('btnAddCargoItem')}
                  </Button>
                </CardHeader>
                <CardContent className="space-y-4">
                  {errors.items && <FieldError>{errors.items}</FieldError>}

                  <div className="space-y-4">
                    {items.map((item, idx) => (
                      <Card className="relative p-4 border bg-muted/10 shadow-none" key={item.id}>
                        <div className="mb-3 flex items-center justify-between border-b pb-2">
                          <span className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
                            {t('cargoItemHeader', { index: idx + 1 })}
                          </span>
                          {items.length > 1 && (
                            <Button
                              aria-label={`${t('createBtnRemoveItem')} ${idx + 1}`}
                              disabled={submitting}
                              onClick={() => handleRemoveItem(item.id)}
                              size="sm"
                              type="button"
                              variant="ghost"
                              className="text-destructive hover:bg-destructive/10"
                            >
                              <Trash2 className="size-4" />
                              <span className="text-xs">{t('createBtnRemoveItem')}</span>
                            </Button>
                          )}
                        </div>

                        <div className="grid gap-3 sm:grid-cols-4">
                          <FieldRoot className="sm:col-span-2">
                            <FieldLabel>{t('cargoItemNameLabel')} *</FieldLabel>
                            <Input
                              disabled={submitting}
                              onChange={(e) => handleItemChange(item.id, 'name', e.target.value)}
                              placeholder={t('createItemNamePlaceholder')}
                              value={item.name}
                            />
                            {errors[`item_${idx}_name`] && (
                              <FieldError>{errors[`item_${idx}_name`]}</FieldError>
                            )}
                          </FieldRoot>

                          <FieldRoot className="sm:col-span-1">
                            <FieldLabel>{t('cargoItemCategoryLabel')}</FieldLabel>
                            <Select
                              disabled={submitting}
                              onValueChange={(val) => handleItemChange(item.id, 'categoryId', val ?? '')}
                              value={item.categoryId}
                            >
                              <SelectTrigger className="w-full">
                                <SelectValue placeholder={t('createDefaultCategory')}>
                                  {categories.find((c) => String(c.categoryId) === item.categoryId)?.name ?? t('createDefaultCategory')}
                                </SelectValue>
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
                            <FieldLabel>{t('cargoItemQuantityLabel')} *</FieldLabel>
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
                            <FieldLabel>{t('cargoItemWeightLabel')} *</FieldLabel>
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
                            <FieldLabel>{t('cargoItemDimensionsLabel')}</FieldLabel>
                            <div className="grid grid-cols-3 gap-2">
                              <Input
                                disabled={submitting}
                                min="1"
                                onChange={(e) => handleItemChange(item.id, 'length', e.target.value)}
                                placeholder={t('dimLengthPlaceholder')}
                                type="number"
                                value={item.length}
                              />
                              <Input
                                disabled={submitting}
                                min="1"
                                onChange={(e) => handleItemChange(item.id, 'width', e.target.value)}
                                placeholder={t('dimWidthPlaceholder')}
                                type="number"
                                value={item.width}
                              />
                              <Input
                                disabled={submitting}
                                min="1"
                                onChange={(e) => handleItemChange(item.id, 'height', e.target.value)}
                                placeholder={t('dimHeightPlaceholder')}
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

                  {/* Special handling surcharges */}
                  <div className="flex flex-wrap gap-6 pt-3 border-t">
                    <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                      <Checkbox
                        checked={isFragile}
                        disabled={submitting}
                        onCheckedChange={(checked) => setIsFragile(Boolean(checked))}
                      />
                      <span>{t('createFragileOption')}</span>
                    </label>

                    <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                      <Checkbox
                        checked={isValuable}
                        disabled={submitting}
                        onCheckedChange={(checked) => setIsValuable(Boolean(checked))}
                      />
                      <span>{t('createValuableOption')}</span>
                    </label>
                  </div>
                </CardContent>
              </Card>

              {/* Card 4: Notes */}
              <Card>
                <CardHeader>
                  <CardTitle>{t('createNotesCardTitle')}</CardTitle>
                  <CardDescription>
                    {t('createNotesCardDesc')}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <FieldRoot>
                    <FieldLabel>{t('cargoItemNoteLabel')}</FieldLabel>
                    <Textarea
                      disabled={submitting}
                      onChange={(e) => setShipmentNote(e.target.value)}
                      placeholder={t('createNotesPlaceholder')}
                      rows={3}
                      value={shipmentNote}
                    />
                  </FieldRoot>
                </CardContent>
              </Card>
            </div>

            {/* Right 4 columns: Sticky Pricing & Action Summary */}
            <div className="xl:col-span-4 xl:sticky xl:top-6 space-y-4">
              {/* Sticky Card: Summary & Payment */}
              <Card className="border-primary/20 shadow-sm">
                <CardHeader className="bg-muted/30 border-b pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-semibold">{t('createSummaryCardTitle')}</CardTitle>
                    {quoting && (
                      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <LoaderCircle className="size-3 animate-spin text-primary" />
                        {t('createCalculating')}
                      </span>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 pt-4">
                  {/* Quote Display */}
                  <div className="rounded-lg bg-slate-50 p-3 border border-slate-200 dark:bg-slate-900/50 dark:border-slate-800">
                    {quoteError ? (
                      <div className="py-2 text-xs text-destructive flex items-center gap-1.5">
                        <AlertCircle className="size-4 shrink-0" />
                        {quoteError}
                      </div>
                    ) : quote ? (
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between text-muted-foreground">
                          <span>{t('quoteMainFee')}:</span>
                          <span>{formatCurrency(quote.baseFee)}</span>
                        </div>
                        {quote.serviceFee > 0 && (
                          <div className="flex justify-between text-muted-foreground">
                            <span>{t('quoteServiceFee')}:</span>
                            <span>{formatCurrency(quote.serviceFee)}</span>
                          </div>
                        )}
                        <div className="flex items-baseline justify-between pt-2 border-t">
                          <span className="font-semibold text-foreground">{t('quoteTotal')}:</span>
                          <span className="text-xl font-bold text-primary">
                            {formatCurrency(quote.totalFee)}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="py-3 text-center text-xs text-muted-foreground">
                        {t('createQuoteHelp')}
                      </div>
                    )}
                  </div>

                  {/* Payment and Counter Toggles */}
                  <div className="space-y-3 pt-2">
                    <FieldRoot>
                      <FieldLabel>{t('payerLabel')} *</FieldLabel>
                      <Select
                        disabled={submitting}
                        onValueChange={(val) => setFreightPayer(val as 'NGUOI_GUI' | 'NGUOI_NHAN')}
                        value={freightPayer}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue>
                            {freightPayer === 'NGUOI_GUI'
                              ? t('payerRadioSender')
                              : t('payerRadioReceiver')}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            <SelectItem value="NGUOI_GUI">{t('payerRadioSender')}</SelectItem>
                            <SelectItem value="NGUOI_NHAN">{t('payerRadioReceiver')}</SelectItem>
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </FieldRoot>

                    <div className="space-y-3 pt-2 border-t">
                      <label className="flex items-start gap-2.5 text-sm font-medium cursor-pointer">
                        <Checkbox
                          checked={acceptAtCounter}
                          disabled={submitting}
                          onCheckedChange={(checked) => setAcceptAtCounter(Boolean(checked))}
                          className="mt-0.5"
                        />
                        <div>
                          <span>{t('createAcceptAtCounterTitle')}</span>
                          <p className="text-xs text-muted-foreground font-normal">
                            {t('createAcceptAtCounterDesc')}
                          </p>
                        </div>
                      </label>

                      <label className="flex items-start gap-2.5 text-sm font-medium cursor-pointer">
                        <Checkbox
                          checked={collectPaymentAtCounter}
                          disabled={submitting || !acceptAtCounter || freightPayer === 'NGUOI_NHAN'}
                          onCheckedChange={(checked) => setCollectPaymentAtCounter(Boolean(checked))}
                          className="mt-0.5"
                        />
                        <div>
                          <span>{t('createCollectCashAtCounterTitle')}</span>
                          <p className="text-xs text-muted-foreground font-normal">
                            {t('createCollectCashAtCounterDesc')}
                          </p>
                        </div>
                      </label>
                    </div>
                  </div>

                  {/* Error summary if submitted with invalid form */}
                  {errorCount > 0 && (
                    <div ref={errorSummaryRef} className="pt-2">
                      <Alert variant="destructive">
                        <AlertCircle className="size-4" />
                        <AlertTitle>{t('createFormInvalidTitle')}</AlertTitle>
                        <AlertDescription className="text-xs">
                          {t('createFormInvalidDesc', { count: errorCount })}
                        </AlertDescription>
                      </Alert>
                    </div>
                  )}

                  {submitError && (
                    <Alert variant="destructive">
                      <AlertCircle className="size-4" />
                      <AlertTitle>{t('createSubmitFailedTitle')}</AlertTitle>
                      <AlertDescription className="text-xs">{submitError}</AlertDescription>
                    </Alert>
                  )}

                  {/* Actions */}
                  <div className="space-y-2 pt-2">
                    <Button
                      disabled={submitting}
                      size="comfortable"
                      className="w-full text-base font-semibold"
                      type="submit"
                    >
                      {submitting ? (
                        <>
                          <LoaderCircle className="size-4 animate-spin" />
                          {t('createBtnSubmitting')}
                        </>
                      ) : (
                        t('createBtnSubmit')
                      )}
                    </Button>

                    <Link
                      href="/shipments"
                      className={buttonVariants({
                        variant: 'outline',
                        className: 'w-full text-center',
                      })}
                    >
                      {t('createBtnCancel')}
                    </Link>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </form>
      )}

      {/* Post-Creation Success Dialog */}
      <Dialog open={successDialogOpen} onOpenChange={setSuccessDialogOpen}>
        <DialogContent className="sm:max-w-md text-center p-6" showCloseButton={false}>
          <div className="flex flex-col items-center">
            <div className="size-12 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 mb-3 dark:bg-emerald-950 dark:text-emerald-400">
              <CheckCircle2 className="size-8" />
            </div>
            <DialogHeader className="text-center">
              <DialogTitle className="text-xl font-bold text-center">
                {t('createSuccessTitle')}
              </DialogTitle>
              <DialogDescription className="text-center text-sm">
                {t('createSuccessDesc')}
              </DialogDescription>
            </DialogHeader>
          </div>

          {createdShipment && (
            <div className="space-y-4 my-2 text-left">
              {/* Waybill Code Banner */}
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-3.5 text-center space-y-1.5">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {t('createWaybillBanner')}
                </p>
                <p className="admin-data-mono text-base font-bold text-primary break-all select-all">
                  {createdShipment.waybillCode}
                </p>
                <div className="flex justify-center pt-1">
                  <Button
                    onClick={() => handleCopyWaybillCode(createdShipment.waybillCode)}
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs gap-1.5"
                  >
                    {copiedCode ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
                    {copiedCode ? t('createBtnCopied') : t('createBtnCopyCode')}
                  </Button>
                </div>
              </div>

              {/* Summary Details */}
              <div className="rounded-lg border bg-muted/20 p-3 text-xs space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('senderColon')}</span>
                  <span className="font-medium text-foreground">{senderName} ({senderPhone})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('receiver')}:</span>
                  <span className="font-medium text-foreground">{receiverName} ({receiverPhone})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('quoteTotal')}:</span>
                  <span className="font-semibold text-primary">
                    {formatCurrency(createdShipment.pricing.totalFee)}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-1 border-t">
                  <span className="text-muted-foreground">{t('tableHeaderStatus')}:</span>
                  <div className="flex gap-1.5">
                    <Badge variant="success">{t('createStatusReceived')}</Badge>
                    {createdShipment.paymentStatus === 'DA_THANH_TOAN' && (
                      <Badge variant="success">{t('createStatusPaid')}</Badge>
                    )}
                  </div>
                </div>
              </div>

              {/* Print Tools */}
              <div className="space-y-2 pt-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  {t('createPrintToolsTitle')}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    onClick={() => handleOpenPrint(createdShipment.shipmentId, 'label')}
                    variant="default"
                    className="gap-2 text-xs"
                  >
                    <Printer className="size-4" />
                    {t('createBtnPrintLabel')}
                  </Button>
                  <Button
                    onClick={() => handleOpenPrint(createdShipment.shipmentId, 'receipt')}
                    variant="outline"
                    className="gap-2 text-xs"
                  >
                    <FileText className="size-4" />
                    {t('createBtnPrintReceipt')}
                  </Button>
                </div>
              </div>

              {/* Next Actions */}
              <div className="flex flex-col gap-2 pt-2 border-t">
                <Button
                  onClick={handleResetForm}
                  variant="secondary"
                  className="w-full gap-2"
                >
                  <PackagePlus className="size-4" />
                  {t('createBtnCreateNext')}
                </Button>
                <Button
                  onClick={() => router.push('/shipments')}
                  variant="ghost"
                  className="w-full text-muted-foreground"
                >
                  {t('createBtnBackToList')}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
