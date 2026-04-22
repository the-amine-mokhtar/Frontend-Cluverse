import { AfterViewInit, Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Stripe, StripeCardElement, StripeCardElementChangeEvent, StripeElements, loadStripe } from '@stripe/stripe-js';
import { AuthHelperService } from '../../../../core/services/auth-helper.service';
import { FinanceService } from '../../../../core/services/finance.service';

interface PendingSponsorPayment {
  sponsorName: string;
  sponsorEmail: string;
  cardLast4: string;
  sponsorPhone: string;
  amountEur: number;
  conversionRate: number;
  amountTnd: number;
  reference: string;
  paymentIntentId: string;
}

@Component({
  selector: 'app-finance-sponsor-payment',
  templateUrl: './finance-sponsor-payment.component.html',
  styleUrl: './finance-sponsor-payment.component.scss'
})
export class FinanceSponsorPaymentComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('stripeCardElement') private stripeCardElementRef?: ElementRef<HTMLDivElement>;

  sponsorName = '';
  sponsorEmail = '';
  sponsorPhone = '';
  amountEur: number | null = null;
  conversionRate = 3.4;

  isSubmitting = false;
  isStripeReady = false;
  stripeInfoMessage = 'Loading secure Stripe card form...';
  errorMessage = '';
  successMessage = '';
  cardPreviewBrand = 'CARD';
  cardPreviewNumber = '---- ---- ---- ----';
  cardPreviewStatus = 'SECURE FIELD';
  isCardInputActive = false;
  isCardInputComplete = false;

  private stripe: Stripe | null = null;
  private elements: StripeElements | null = null;
  private cardElement: StripeCardElement | null = null;
  private stripePublishableKey = '';

  constructor(
    private readonly financeService: FinanceService,
    private readonly authHelperService: AuthHelperService
  ) {}

  ngOnInit(): void {
    this.loadStripeConfigAndMountCard();
  }

  ngAfterViewInit(): void {
    this.mountStripeCardElementIfReady();
  }

  ngOnDestroy(): void {
    if (this.cardElement) {
      this.cardElement.unmount();
      this.cardElement.destroy();
      this.cardElement = null;
    }
  }

  get amountTndPreview(): number {
    if (this.amountEur === null || this.amountEur <= 0) {
      return 0;
    }

    return this.roundCurrency(this.amountEur * this.conversionRate);
  }

  payWithStripeEmbedded(): void {
    this.errorMessage = '';
    this.successMessage = '';

    const validationError = this.validateFormBeforeStripe();
    if (validationError) {
      this.errorMessage = validationError;
      return;
    }

    if (!this.stripe || !this.cardElement) {
      this.errorMessage = 'Stripe secure card form is not ready yet. Please wait a second and try again.';
      return;
    }

    const amountEur = this.amountEur ?? 0;
    const amountTnd = this.roundCurrency(amountEur * this.conversionRate);
    const reference = `SPN-${Date.now()}`;

    this.isSubmitting = true;

    this.financeService.createStripePaymentIntent({
      amountCents: Math.round(amountEur * 100),
      currency: 'eur',
      sponsorName: this.sponsorName.trim(),
      sponsorEmail: this.sponsorEmail.trim(),
      sponsorPhone: this.sponsorPhone.trim(),
      reference
    }).subscribe({
      next: async (intentResponse) => {
        try {
          const confirmation = await this.stripe!.confirmCardPayment(intentResponse.clientSecret, {
            payment_method: {
              card: this.cardElement!,
              billing_details: {
                name: this.sponsorName.trim(),
                email: this.sponsorEmail.trim(),
                phone: this.sponsorPhone.trim() || undefined
              }
            }
          });

          if (confirmation.error) {
            this.errorMessage = confirmation.error.message ?? 'Payment could not be completed.';
            this.isSubmitting = false;
            return;
          }

          if (!confirmation.paymentIntent || confirmation.paymentIntent.status !== 'succeeded') {
            this.errorMessage = 'Payment is not completed yet. Please try again.';
            this.isSubmitting = false;
            return;
          }

          this.createIncomeTransactionAndExportReceipt({
            sponsorName: this.sponsorName.trim(),
            sponsorEmail: this.sponsorEmail.trim(),
            sponsorPhone: this.sponsorPhone.trim(),
            cardLast4: 'N/A',
            amountEur,
            amountTnd,
            conversionRate: this.conversionRate,
            reference,
            paymentIntentId: confirmation.paymentIntent.id
          });
        } catch {
          this.errorMessage = 'Unexpected Stripe confirmation error.';
          this.isSubmitting = false;
        }
      },
      error: (error: unknown) => {
        this.errorMessage = `Failed to initialize Stripe payment. ${this.formatHttpError(error)}`;
        this.isSubmitting = false;
      }
    });
  }

  formatCurrencyEur(amount: number): string {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  }

  formatCurrencyTnd(amount: number): string {
    return new Intl.NumberFormat('fr-TN', {
      style: 'currency',
      currency: 'TND',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  }

  private createIncomeTransactionAndExportReceipt(payment: {
    sponsorName: string;
    sponsorEmail: string;
    sponsorPhone: string;
    cardLast4: string;
    amountEur: number;
    amountTnd: number;
    conversionRate: number;
    reference: string;
    paymentIntentId: string;
  }): void {

    const clubId = this.authHelperService.getClubId();
    if (!clubId) {
      this.errorMessage = 'Unable to detect your club. Please login again before recording payment.';
      return;
    }

    this.isSubmitting = true;

    this.financeService.createTransaction(clubId, {
      type: 'INCOME',
      amount: payment.amountTnd,
      date: this.getTodayDate(),
      description: this.buildTransactionDescription(payment)
    }).subscribe({
      next: (createdTransaction) => {
        this.exportSponsorReceipt(payment, createdTransaction.id);
        this.successMessage = 'Stripe payment succeeded. INCOME transaction created in TND and receipt exported.';
        this.errorMessage = '';
        this.isSubmitting = false;
      },
      error: (error: unknown) => {
        this.errorMessage = `Failed to create INCOME transaction. ${this.formatHttpError(error)}`;
        this.isSubmitting = false;
      }
    });
  }

  private exportSponsorReceipt(payment: {
    sponsorName: string;
    sponsorEmail: string;
    sponsorPhone: string;
    cardLast4: string;
    amountEur: number;
    amountTnd: number;
    conversionRate: number;
    reference: string;
    paymentIntentId: string;
  }, transactionId: number): void {
    const generatedAt = new Date();
    const safeSponsorName = this.escapeHtml(payment.sponsorName);
    const safeSponsorEmail = this.escapeHtml(payment.sponsorEmail);
    const safeSponsorPhone = this.escapeHtml(payment.sponsorPhone || 'N/A');
    const safeCardLast4 = this.escapeHtml(payment.cardLast4 || 'N/A');
    const safeReference = this.escapeHtml(payment.reference);
    const safePaymentIntentId = this.escapeHtml(payment.paymentIntentId);
    const clubLabel = this.escapeHtml(this.authHelperService.getFullName() || 'Finance Team');

    const receiptHtml = `
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Sponsor Receipt - ${safeReference}</title>
          <style>
            body { font-family: Segoe UI, Arial, sans-serif; color: #111827; margin: 24px; }
            .card { border: 1px solid #d1d5db; border-radius: 12px; padding: 20px; max-width: 760px; }
            .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
            .title { margin: 0; font-size: 22px; }
            .pill { background: #ecfeff; color: #155e75; border: 1px solid #a5f3fc; border-radius: 999px; padding: 4px 10px; font-size: 12px; font-weight: 700; }
            .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 16px; margin-top: 14px; }
            .line { font-size: 14px; }
            .line strong { color: #0f172a; }
            .amount { margin-top: 16px; padding: 12px; border-radius: 10px; background: #f8fafc; border: 1px solid #e2e8f0; }
            .meta { margin-top: 18px; font-size: 12px; color: #475569; }
            .foot { margin-top: 12px; font-size: 12px; color: #64748b; }
          </style>
        </head>
        <body>
          <section class="card">
            <div class="header">
              <h1 class="title">Sponsor Payment Receipt</h1>
              <span class="pill">Paid via Stripe</span>
            </div>

            <div class="grid">
              <div class="line"><strong>Reference:</strong> ${safeReference}</div>
              <div class="line"><strong>Transaction ID:</strong> ${transactionId}</div>
              <div class="line"><strong>Stripe PaymentIntent:</strong> ${safePaymentIntentId}</div>
              <div class="line"><strong>Sponsor Name:</strong> ${safeSponsorName}</div>
              <div class="line"><strong>Sponsor Email:</strong> ${safeSponsorEmail}</div>
              <div class="line"><strong>Sponsor Phone:</strong> ${safeSponsorPhone}</div>
              <div class="line"><strong>Card ending:</strong> **** **** **** ${safeCardLast4}</div>
            </div>

            <div class="amount">
              <div class="line"><strong>Charged in Stripe:</strong> ${this.formatCurrencyEur(payment.amountEur)}</div>
              <div class="line"><strong>Converted Finance Income:</strong> ${this.formatCurrencyTnd(payment.amountTnd)}</div>
              <div class="line"><strong>Conversion Rate:</strong> 1 EUR = ${payment.conversionRate.toFixed(4)} TND</div>
            </div>

            <div class="meta">
              <div><strong>Generated:</strong> ${generatedAt.toLocaleString()}</div>
              <div><strong>Prepared by:</strong> ${clubLabel}</div>
            </div>

            <p class="foot">Stripe can also send a payment receipt email directly to the sponsor email address used at checkout.</p>
          </section>
        </body>
      </html>
    `;

    const blob = new Blob([receiptHtml], { type: 'text/html;charset=utf-8' });
    const downloadLink = document.createElement('a');
    downloadLink.href = URL.createObjectURL(blob);
    downloadLink.download = `sponsor-receipt-${payment.reference}.html`;
    downloadLink.click();
    URL.revokeObjectURL(downloadLink.href);
  }

  private validateFormBeforeStripe(): string {
    if (!this.sponsorName.trim()) {
      return 'Sponsor full name is required.';
    }

    if (!this.sponsorEmail.trim() || !this.isValidEmail(this.sponsorEmail)) {
      return 'Please provide a valid sponsor email address.';
    }

    if (this.amountEur === null || this.amountEur <= 0) {
      return 'Please provide a valid amount in EUR.';
    }

    if (!Number.isFinite(this.conversionRate) || this.conversionRate <= 0) {
      return 'Please provide a valid EUR to TND conversion rate.';
    }

    return '';
  }

  private buildTransactionDescription(pending: PendingSponsorPayment): string {
    return `Sponsor payment ${pending.reference} | ${pending.sponsorName} | ${pending.amountEur.toFixed(2)} EUR via Stripe (${pending.paymentIntentId})`;
  }

  private loadStripeConfigAndMountCard(): void {
    this.financeService.getStripePublicConfig().subscribe({
      next: async (config) => {
        this.stripePublishableKey = config.publishableKey?.trim() ?? '';

        if (!this.stripePublishableKey) {
          this.stripeInfoMessage = 'Stripe publishable key is missing. Configure stripe.publishable-key in backend application.properties.';
          return;
        }

        this.stripe = await loadStripe(this.stripePublishableKey);
        if (!this.stripe) {
          this.stripeInfoMessage = 'Unable to initialize Stripe SDK.';
          return;
        }

        this.elements = this.stripe.elements();
        this.mountStripeCardElementIfReady();
      },
      error: (error: unknown) => {
        this.stripeInfoMessage = `Failed to load Stripe configuration. ${this.formatHttpError(error)}`;
      }
    });
  }

  private mountStripeCardElementIfReady(): void {
    if (!this.elements || !this.stripeCardElementRef || this.cardElement) {
      return;
    }

    this.cardElement = this.elements.create('card', {
      style: {
        base: {
          fontSize: '16px',
          color: '#f8fafc',
          '::placeholder': {
            color: '#94a3b8'
          }
        },
        invalid: {
          color: '#f87171'
        }
      }
    });

    this.cardElement.on('focus', () => {
      this.isCardInputActive = true;
      this.cardPreviewStatus = 'ENTERING SECURE DETAILS';
    });

    this.cardElement.on('blur', () => {
      this.isCardInputActive = false;
      this.cardPreviewStatus = this.isCardInputComplete ? 'VERIFIED BY STRIPE' : 'SECURE FIELD';
    });

    this.cardElement.on('change', (event: StripeCardElementChangeEvent) => {
      this.handleStripeCardChange(event);
    });

    this.cardElement.mount(this.stripeCardElementRef.nativeElement);
    this.isStripeReady = true;
    this.stripeInfoMessage = 'Secure Stripe card form is ready.';
  }

  private handleStripeCardChange(event: StripeCardElementChangeEvent): void {
    this.cardPreviewBrand = (event.brand && event.brand !== 'unknown') ? event.brand.toUpperCase() : 'CARD';
    this.isCardInputComplete = !!event.complete;

    // Stripe does not expose raw PAN digits in the browser; keep a masked preview only.
    if (event.empty) {
      this.cardPreviewNumber = '---- ---- ---- ----';
    } else if (event.complete) {
      this.cardPreviewNumber = '**** **** **** ****';
    } else {
      this.cardPreviewNumber = '**** **** **** ----';
    }

    if (event.error?.message) {
      this.cardPreviewStatus = 'CHECK CARD DETAILS';
      return;
    }

    if (event.complete) {
      this.cardPreviewStatus = 'VERIFIED BY STRIPE';
      return;
    }

    this.cardPreviewStatus = event.empty ? 'SECURE FIELD' : 'ENTERING SECURE DETAILS';
  }

  private roundCurrency(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  private getTodayDate(): string {
    return new Date().toISOString().split('T')[0];
  }

  private isValidEmail(value: string): boolean {
    return /^\S+@\S+\.\S+$/.test(value.trim());
  }

  private formatHttpError(error: unknown): string {
    if (!(error instanceof HttpErrorResponse)) {
      return 'Unexpected client error.';
    }

    const backendMessage =
      typeof error.error === 'string'
        ? error.error
        : (error.error?.message as string | undefined) ?? error.message;

    return `Status ${error.status}: ${backendMessage}`;
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}
