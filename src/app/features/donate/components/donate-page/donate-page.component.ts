import { AfterViewInit, Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Stripe, StripeCardElement, StripeCardElementChangeEvent, StripeElements, loadStripe } from '@stripe/stripe-js';
import { ClubSummary, DonateReceiptPayload, DonateService } from '../../donate.service';
import { FraudDetectionService } from '../../../finance/services/fraud-detection.service';
import { environment } from '../../../../../environments/environment.development';

@Component({
  selector: 'app-donate-page',
  templateUrl: './donate-page.component.html',
  styleUrl: './donate-page.component.scss'
})
export class DonatePageComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('stripeCardElement') private stripeCardElementRef?: ElementRef<HTMLDivElement>;

  clubs: ClubSummary[] = [];
  selectedClubId: number | null = null;
  clubsLoading = true;
  clubsError = '';

  donorName = '';
  donorEmail = '';
  donorPhone = '';
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

  constructor(
    private readonly donateService: DonateService,
    private readonly fraudService: FraudDetectionService,
  ) {}

  ngOnInit(): void {
    this.loadClubs();
    this.initStripe();
  }

  ngAfterViewInit(): void {
    this.mountCardIfReady();
  }

  ngOnDestroy(): void {
    this.destroyCard();
  }

  get cardBrandKey(): 'visa' | 'mastercard' | 'other' {
    const b = this.cardPreviewBrand.toLowerCase();
    if (b === 'visa') return 'visa';
    if (b === 'mastercard') return 'mastercard';
    return 'other';
  }

  get amountTndPreview(): number {
    if (!this.amountEur || this.amountEur <= 0) return 0;
    return this.round(this.amountEur * this.conversionRate);
  }

  get selectedClub(): ClubSummary | null {
    return this.clubs.find(c => c.id === this.selectedClubId) ?? null;
  }

  onClubSelected(): void {
    // Re-mount the card after Angular renders the payment section
    setTimeout(() => this.mountCardIfReady(), 0);
  }

  formatEur(v: number): string {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 }).format(v);
  }

  formatTnd(v: number): string {
    return new Intl.NumberFormat('fr-TN', { style: 'currency', currency: 'TND', minimumFractionDigits: 2 }).format(v);
  }

  donate(): void {
    this.errorMessage = '';
    this.successMessage = '';

    const err = this.validate();
    if (err) { this.errorMessage = err; return; }
    if (!this.stripe || !this.cardElement) {
      this.errorMessage = 'Stripe secure card form is not ready yet.';
      return;
    }

    const amountEur = this.amountEur!;
    const amountTnd = this.round(amountEur * this.conversionRate);
    const reference = `DON-${Date.now()}`;

    this.isSubmitting = true;

    this.donateService.createPaymentIntent({
      amountCents: Math.round(amountEur * 100),
      currency: 'eur',
      sponsorName: this.donorName.trim(),
      sponsorEmail: this.donorEmail.trim(),
      sponsorPhone: this.donorPhone.trim(),
      reference
    }).subscribe({
      next: async (intent) => {
        try {
          const result = await this.stripe!.confirmCardPayment(intent.clientSecret, {
            payment_method: {
              card: this.cardElement!,
              billing_details: {
                name: this.donorName.trim(),
                email: this.donorEmail.trim(),
                phone: this.donorPhone.trim() || undefined
              }
            }
          });

          if (result.error) {
            this.errorMessage = result.error.message ?? 'Payment could not be completed.';
            this.isSubmitting = false;
            return;
          }

          if (result.paymentIntent?.status !== 'succeeded') {
            this.errorMessage = 'Payment not completed. Please try again.';
            this.isSubmitting = false;
            return;
          }

          this.recordTransaction(amountTnd, reference, result.paymentIntent.id, amountEur);
        } catch {
          this.errorMessage = 'Unexpected error during payment confirmation.';
          this.isSubmitting = false;
        }
      },
      error: (e: unknown) => {
        this.errorMessage = `Failed to initialize payment. ${this.httpError(e)}`;
        this.isSubmitting = false;
      }
    });
  }

  private recordTransaction(amountTnd: number, reference: string, paymentIntentId: string, amountEur: number): void {
    const description = `Donation ${reference} | ${this.donorName.trim()} | ${amountEur.toFixed(2)} EUR via Stripe (${paymentIntentId})`;
    const date = new Date().toISOString().split('T')[0];

    this.donateService.createTransaction(this.selectedClubId!, {
      type: 'INCOME',
      amount: amountTnd,
      date,
      description
    }).subscribe({
      next: () => {
        this.successMessage = `Thank you, ${this.donorName.trim()}! Your donation of ${this.formatEur(amountEur)} to ${this.selectedClub?.name} was successful. A receipt has been sent to ${this.donorEmail.trim()}.`;
        this.isSubmitting = false;
        this.sendReceipt(amountEur, amountTnd, reference, paymentIntentId, date);
        this.reportToFraudService(amountEur, paymentIntentId, reference);
      },
      error: (e: unknown) => {
        this.errorMessage = `Payment succeeded but failed to record transaction. ${this.httpError(e)}`;
        this.isSubmitting = false;
      }
    });
  }

  private sendReceipt(amountEur: number, amountTnd: number, reference: string, paymentIntentId: string, date: string): void {
    const receipt: DonateReceiptPayload = {
      sponsorName: this.donorName.trim(),
      sponsorEmail: this.donorEmail.trim(),
      sponsorPhone: this.donorPhone.trim(),
      clubName: this.selectedClub?.name ?? '',
      amountEur,
      amountTnd,
      reference,
      paymentIntentId,
      date
    };
    this.donateService.sendDonationReceipt(receipt).subscribe({ error: () => {} });
  }

  private reportToFraudService(amountEur: number, paymentIntentId: string, reference: string): void {
    this.fraudService.simulateTransaction({
      amount:      Math.round(amountEur * 100),
      currency:    'eur',
      status:      'succeeded',
      customer:    this.donorEmail.trim() || undefined,
      description: `Donation ${reference} | ${this.donorName.trim()} | ${amountEur.toFixed(2)} EUR (${paymentIntentId})`,
    }).subscribe({ error: () => {} });
  }

  private loadClubs(): void {
    this.donateService.getAllClubs().subscribe({
      next: (clubs) => { this.clubs = clubs; this.clubsLoading = false; },
      error: () => { this.clubsError = 'Failed to load clubs. Please refresh.'; this.clubsLoading = false; }
    });
  }

  private async initStripe(): Promise<void> {
    const envKey = environment.stripePublishableKey?.trim();

    if (envKey && !envKey.includes('YOUR_KEY_HERE')) {
      await this.setupStripeWithKey(envKey);
      return;
    }

    // Fallback: try backend config endpoint
    this.donateService.getStripePublicConfig().subscribe({
      next: async (config) => {
        const key = config.publishableKey?.trim();
        if (!key) {
          this.stripeInfoMessage = 'Stripe key is not configured. Set stripePublishableKey in environment.development.ts.';
          return;
        }
        await this.setupStripeWithKey(key);
      },
      error: (e: unknown) => {
        this.stripeInfoMessage = `Stripe not configured. Set stripePublishableKey in environment.development.ts. (${this.httpError(e)})`;
      }
    });
  }

  private async setupStripeWithKey(key: string): Promise<void> {
    this.stripe = await loadStripe(key);
    if (!this.stripe) {
      this.stripeInfoMessage = 'Unable to initialize Stripe.';
      return;
    }
    this.elements = this.stripe.elements();
    this.mountCardIfReady();
  }

  private mountCardIfReady(): void {
    if (!this.elements || !this.stripeCardElementRef?.nativeElement || this.cardElement) return;

    this.cardElement = this.elements.create('card', {
      style: {
        base: { fontSize: '16px', color: '#f8fafc', '::placeholder': { color: '#94a3b8' } },
        invalid: { color: '#f87171' }
      }
    });

    this.cardElement.on('focus', () => { this.isCardInputActive = true; this.cardPreviewStatus = 'ENTERING SECURE DETAILS'; });
    this.cardElement.on('blur', () => { this.isCardInputActive = false; this.cardPreviewStatus = this.isCardInputComplete ? 'VERIFIED BY STRIPE' : 'SECURE FIELD'; });
    this.cardElement.on('change', (event: StripeCardElementChangeEvent) => {
      this.cardPreviewBrand = (event.brand && event.brand !== 'unknown') ? event.brand.toUpperCase() : 'CARD';
      this.isCardInputComplete = !!event.complete;
      this.cardPreviewNumber = event.empty ? '---- ---- ---- ----' : event.complete ? '**** **** **** ****' : '**** **** **** ----';
      if (event.error?.message) { this.cardPreviewStatus = 'CHECK CARD DETAILS'; return; }
      if (event.complete) { this.cardPreviewStatus = 'VERIFIED BY STRIPE'; return; }
      this.cardPreviewStatus = event.empty ? 'SECURE FIELD' : 'ENTERING SECURE DETAILS';
    });

    this.cardElement.mount(this.stripeCardElementRef.nativeElement);
    this.isStripeReady = true;
    this.stripeInfoMessage = 'Secure Stripe card form is ready.';
  }

  private destroyCard(): void {
    if (this.cardElement) {
      this.cardElement.unmount();
      this.cardElement.destroy();
      this.cardElement = null;
    }
  }

  private validate(): string {
    if (!this.selectedClubId) return 'Please select a club to donate to.';
    if (!this.donorName.trim()) return 'Your full name is required.';
    if (!this.donorEmail.trim() || !/^\S+@\S+\.\S+$/.test(this.donorEmail)) return 'Please provide a valid email address.';
    if (!this.amountEur || this.amountEur <= 0) return 'Please enter a valid donation amount.';
    if (!Number.isFinite(this.conversionRate) || this.conversionRate <= 0) return 'Invalid EUR to TND conversion rate.';
    return '';
  }

  private round(v: number): number {
    return Math.round((v + Number.EPSILON) * 100) / 100;
  }

  private httpError(e: unknown): string {
    if (!(e instanceof HttpErrorResponse)) return 'Unexpected error.';
    const msg = typeof e.error === 'string' ? e.error : (e.error?.message as string | undefined) ?? e.message;
    return `Status ${e.status}: ${msg}`;
  }
}
