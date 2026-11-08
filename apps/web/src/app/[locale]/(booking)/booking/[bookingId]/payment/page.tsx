'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Check, CreditCard, QrCode, WalletCards } from 'lucide-react';
import { useTranslations, useLocale } from 'next-intl';
import { Button } from '@/components/ui/button';
import { formatCompactCurrency } from '@/lib/format';

const methods = [
  { id: 'momo', label: 'MoMo', icon: WalletCards },
  { id: 'vnpay', label: 'VNPAY', icon: QrCode },
  { id: 'card', label: 'Card / Bank', icon: CreditCard },
];

export default function BookingPaymentPage() {
  const t = useTranslations('booking');
  const tPayments = useTranslations('payments');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const [method, setMethod] = useState('momo');
  const [paid, setPaid] = useState(false);

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-8 flex items-center justify-center gap-2 text-xs font-black sm:gap-8">
        <span className="text-emerald-600">✓ {t('stepPassengerInfo')}</span>
        <span className="rounded-full bg-primary px-3 py-2 text-primary-foreground">
          2 · {t('stepPayment')}
        </span>
        <span className="text-muted-foreground">3 · {t('security')}</span>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="rounded-3xl border border-border bg-background p-5 shadow-sm sm:p-8">
          <h1 className="text-2xl font-black">{tPayments('paymentTitle')}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {tPayments('vietQrInstructions')}
          </p>

          <div className="mt-7 grid gap-3">
            {methods.map(({ id, label, icon: Icon }) => (
              <button
                type="button"
                key={id}
                onClick={() => setMethod(id)}
                className={`flex items-center justify-between rounded-2xl border p-4 text-left transition ${
                  method === id
                    ? 'border-primary bg-primary/5 ring-2 ring-primary/10'
                    : 'border-border hover:border-primary/50'
                }`}
              >
                <span className="flex items-center gap-3">
                  <span className="grid size-11 place-items-center rounded-xl bg-muted text-primary">
                    <Icon size={21} />
                  </span>
                  <span>
                    <span className="block font-black">{label}</span>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {tPayments('paymentPending')}
                    </span>
                  </span>
                </span>
                {method === id ? (
                  <span className="grid size-6 place-items-center rounded-full bg-primary text-primary-foreground">
                    <Check size={14} />
                  </span>
                ) : null}
              </button>
            ))}
          </div>

          {paid ? (
            <div className="mt-6 rounded-2xl bg-emerald-50 p-4 text-sm font-bold text-emerald-700">
              {tPayments('paymentSuccess')}
            </div>
          ) : null}

          <Button
            type="button"
            variant="accent"
            className="mt-7 w-full"
            onClick={() => setPaid(true)}
          >
            {t('payNow')} ({formatCompactCurrency(600000, locale)})
          </Button>
        </div>

        <aside className="h-fit rounded-3xl border border-border bg-background p-5 shadow-sm">
          <h2 className="font-black">{t('bookingSummary')}</h2>
          <div className="mt-5 space-y-4 border-b border-border pb-5 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">{t('stepPickupDropoff')}</span>
              <b>TP. Hồ Chí Minh → Đà Lạt</b>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Date</span>
              <b>17/09/2026</b>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">{t('seat')}</span>
              <b>A01, A02</b>
            </div>
          </div>
          <div className="flex justify-between pt-5">
            <span className="font-bold text-muted-foreground">
              {t('totalPayable')}
            </span>
            <b className="text-lg text-primary">
              {formatCompactCurrency(600000, locale)}
            </b>
          </div>
          <Link
            href="/trips"
            className="mt-5 block text-center text-xs font-bold text-muted-foreground hover:text-primary"
          >
            {tCommon('back')}
          </Link>
        </aside>
      </div>
    </div>
  );
}
