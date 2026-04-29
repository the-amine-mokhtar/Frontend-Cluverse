import { AfterViewInit, Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { Stripe, StripeCardElement, StripeElements, loadStripe } from '@stripe/stripe-js';
import { FinanceService } from '../../../../core/services/finance.service';

@Component({
  selector: 'app-sponsor-payment-page',
  templateUrl: './sponsor-payment-page.component.html',
  styleUrl: './sponsor-payment-page.component.scss'
})
export class SponsorPaymentPageComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('stripeCardElement') private stripeCardElementRef?: ElementRef<HTMLDivElement>;

  sponsorName = '';
  sponsorEmail = '';
  sponsorPhone = '';
  eventName = '';
  cardDigits = '';

  sponsorshipId: number | null = null;
  token = '';

  amountEur: number | null = null;
  conversionRate = 3.4;

  isSubmitting = false;
  isStripeReady = false;
  isPageReady = false;
  stripeInfoMessage = 'Loading secure Stripe card form...';
  errorMessage = '';
  successMessage = '';

  private stripe: Stripe | null = null;
  private elements: StripeElements | null = null;
  private cardElement: StripeCardElement | null = null;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly financeService: FinanceService
  ) {}

  ngOnInit(): void {
    this.token = this.route.snapshot.queryParamMap.get('token')?.trim() || '';
    if (!this.token) {
      this.errorMessage = 'This sponsor payment link is invalid or incomplete.';
      return;
    }

    this.loadPaymentContext();
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

  get formattedCardNumber(): string {
    const digits = this.onlyDigits(this.cardDigits).slice(0, 16);
    if (!digits) {
      return '•••• •••• •••• ••••';
    }

    const padded = (digits + '•'.repeat(16)).slice(0, 16);
    return (padded.match(/.{1,4}/g) ?? ['••••', '••••', '••••', '••••']).join(' ');
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

          this.financeService.completeSponsorPaymentByToken(this.token, {
            amountEur,
            amountTnd,
            conversionRate: this.conversionRate,
            paymentIntentId: confirmation.paymentIntent.id,
            reference,
            sponsorPhone: this.sponsorPhone.trim()
          }).subscribe({
            next: () => {
              this.successMessage = 'Payment succeeded. Thank you for supporting this event.';
              this.errorMessage = '';
              this.isSubmitting = false;
            },
            error: (error: unknown) => {
              this.errorMessage = `Payment succeeded but final confirmation failed. ${this.formatHttpError(error)}`;
              this.isSubmitting = false;
            }
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

  private loadPaymentContext(): void {
    this.financeService.getSponsorPaymentPageContext(this.token).subscribe({
      next: (context) => {
        this.isPageReady = true;
        this.sponsorshipId = context.sponsorshipId;
        this.sponsorName = context.sponsorName || '';
        this.sponsorEmail = context.sponsorEmail || '';
        this.eventName = context.eventName || 'Sponsorship';

        const remaining = Math.max((context.agreedAmount || 0) - (context.paidAmount || 0), 0);
        this.amountEur = remaining > 0 ? remaining : (context.agreedAmount || null);
      },
      error: (error: unknown) => {
        this.errorMessage = `Unable to open this payment page. ${this.formatHttpError(error)}`;
      }
    });
  }

  private validateFormBeforeStripe(): string {
    if (!this.isPageReady || !this.sponsorshipId) {
      return 'This payment page is not ready yet. Please refresh and try again.';
    }

    if (!this.isPaymentContextLocked()) {
      return 'This payment link must remain unchanged. Please reopen it from the emailed link.';
    }

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

  private loadStripeConfigAndMountCard(): void {
    this.financeService.getStripePublicConfig().subscribe({
      next: async (config) => {
        const stripePublishableKey = config.publishableKey?.trim() ?? '';

        if (!stripePublishableKey) {
          this.stripeInfoMessage = 'Stripe publishable key is missing. Please contact support.';
          return;
        }

        this.stripe = await loadStripe(stripePublishableKey);
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

    this.cardElement.mount(this.stripeCardElementRef.nativeElement);
    this.isStripeReady = true;
    this.stripeInfoMessage = 'Secure Stripe card form is ready.';
  }

  private roundCurrency(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  private isValidEmail(value: string): boolean {
    return /^\S+@\S+\.\S+$/.test(value.trim());
  }

  private onlyDigits(value: string): string {
    return value.replace(/\D/g, '');
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

  private isPaymentContextLocked(): boolean {
    return this.sponsorName.trim().length > 0 && this.sponsorEmail.trim().length > 0 && this.amountEur !== null && this.amountEur > 0;
  }
}
