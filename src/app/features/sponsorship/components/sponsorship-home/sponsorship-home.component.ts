import { Component, OnDestroy, OnInit } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { CdkDragDrop } from '@angular/cdk/drag-drop';
import { ActivatedRoute } from '@angular/router';
import {
  SponsorService,
  Sponsor,
  CreateSponsorRequest,
  UpdateSponsorRequest,
  SponsorEmail,
  SendSponsorEmailRequest,
  SponsorEmailAttachment
} from '../../../../core/services/sponsor.service';
import { SponsorFileUtilsService } from '../../../../core/services/sponsor-file-utils.service';
import { SponsorshipPdfService } from '../../../../core/services/sponsorship-pdf.service';
import {
  SponsorshipService,
  Sponsorship,
  SponsorshipStatus,
  CreateSponsorshipRequest,
  UpdateSponsorshipRequest
} from '../../../../core/services/sponsorship.service';
import { environment } from '../../../../../environments/environment.development';

interface CountryCodeOption {
  code: string;
  flag: string;
  label: string;
}

interface SponsorshipColumn {
  status: SponsorshipStatus;
  label: string;
}

interface SponsorshipMoveRequirement {
  label: string;
  met: boolean;
}

interface SponsorshipMoveGuide {
  from: string;
  to: string;
  requirements: SponsorshipMoveRequirement[];
  canMove: boolean;
  note: string;
}

interface CurvePoint {
  x: number;
  y: number;
  value: number;
  label: string;
}

interface SponsorCurveSeries {
  sponsorId: number;
  sponsorName: string;
  color: string;
  points: CurvePoint[];
  path: string;
}

interface SponsorCurveXAxisLabel {
  x: number;
  label: string;
  show: boolean;
}

interface SponsorCurveModel {
  series: SponsorCurveSeries[];
  yTicks: number[];
  xLabels: SponsorCurveXAxisLabel[];
  maxValue: number;
}

interface LifecyclePieSlice {
  label: string;
  value: number;
  percent: number;
  color: string;
  path: string;
  labelX: number;
  labelY: number;
  textColor: string;
}

@Component({
  selector: 'app-sponsorship-home',
  templateUrl: './sponsorship-home.component.html',
  styleUrls: ['./sponsorship-home.component.scss']
})
export class SponsorshipHomeComponent implements OnInit, OnDestroy {
  sectionTab: 'SPONSORS' | 'SPONSORSHIPS' = 'SPONSORS';
  showSponsorsCurve = false;
  selectedCurveSponsorId: number | 'ALL' = 'ALL';
  selectedCurveMonthKey: string | 'ALL' = 'ALL';
  readonly curveViewBoxWidth = 860;
  readonly curveViewBoxHeight = 460;
  readonly curvePadding = { top: 24, right: 16, bottom: 56, left: 44 };
  readonly curvePalette = ['#f7b91c', '#60a5fa', '#34d399', '#fb7185', '#a78bfa', '#22d3ee', '#f97316', '#84cc16'];
  lifecyclePieHoverLabel = '';

  readonly sponsorshipColumns: SponsorshipColumn[] = [
    { status: 'PROSPECTING', label: 'Prospecting' },
    { status: 'OUTREACH_SENT', label: 'Outreach Sent' },
    { status: 'CONTRACT_SENT', label: 'Contract Sent' },
    { status: 'SIGNED', label: 'Signed' },
    { status: 'PAID', label: 'Paid' }
  ];

  sponsorships: Sponsorship[] = [];
  sponsorshipsLoading = false;
  sponsorshipsError = '';
  sponsorshipSaving = false;
  generatingSponsorshipSummary = false;
  sponsorshipSearchQuery = '';
  showAddSponsorshipForm = false;
  showEditSponsorshipForm = false;
  showSponsorshipDetails = false;
  sponsorshipEditStatus: SponsorshipStatus = 'PROSPECTING';
  private sponsorshipRefreshTimer?: ReturnType<typeof setInterval>;

  sponsorshipForm: CreateSponsorshipRequest = {
    sponsorId: 0,
    eventName: '',
    expectedAmount: null,
    proposalSummary: '',
    notes: ''
  };

  sponsorshipEditId: number | null = null;
  selectedSponsorshipDetails: Sponsorship | null = null;
  showSponsorHistoryModal = false;
  selectedHistorySponsor: Sponsor | null = null;
  selectedHistorySponsorship: Sponsorship | null = null;
  historyEmailsLoading = false;
  historyEmailsError = '';
  historyEmails: SponsorEmail[] = [];
  historyCurrentPage = 1;
  readonly historyPageSize = 6;
  sponsorshipEditForm: UpdateSponsorshipRequest = {
    eventName: '',
    expectedAmount: null,
    agreedAmount: null,
    paidAmount: null,
    proposalSummary: '',
    proposalDocumentName: '',
    contractDocumentName: '',
    signedDocumentName: '',
    contractReference: '',
    notes: ''
  };

  readonly countryCodeOptions: CountryCodeOption[] = [
    { code: '+216', flag: '🇹🇳', label: 'Tunisia' },
    { code: '+33', flag: '🇫🇷', label: 'France' },
    { code: '+1', flag: '🇺🇸', label: 'United States' },
    { code: '+44', flag: '🇬🇧', label: 'United Kingdom' },
    { code: '+49', flag: '🇩🇪', label: 'Germany' },
    { code: '+39', flag: '🇮🇹', label: 'Italy' },
    { code: '+34', flag: '🇪🇸', label: 'Spain' },
    { code: '+971', flag: '🇦🇪', label: 'UAE' }
  ];

  sponsors: Sponsor[] = [];
  isLoading = false;
  loadError = '';

  showAddForm = false;
  showEditForm = false;
  showDeleteConfirm = false;
  isSubmitting = false;
  isUpdating = false;
  isDeleting = false;
  submitError = '';
  submitSuccess = '';
  editError = '';

  showFilterMenu = false;
  filterStatus: 'ALL' | 'PENDING' | 'CONFIRMED' | 'DENIED' = 'ALL';
  filterCountryCode = 'ALL';
  filterQuery = '';
  filterSort: 'NEWEST' | 'OLDEST' | 'NAME_ASC' | 'NAME_DESC' = 'NEWEST';

  toastMessage = '';
  toastType: 'success' | 'error' | 'info' = 'success';
  toastVisible = false;
  private toastTimer?: ReturnType<typeof setTimeout>;

  activeActionMenuSponsorId: number | null = null;

  showEmailsModal = false;
  emailsLoading = false;
  emailsSyncing = false;
  emailsSubmitting = false;
  emailsError = '';
  selectedEmailSponsor: Sponsor | null = null;
  sponsorEmails: SponsorEmail[] = [];
  selectedEmail: SponsorEmail | null = null;
  showReplyBox = false;
  replyBody = '';
  replyFiles: File[] = [];
  emailTab: 'LIST' | 'COMPOSE' = 'LIST';
  composeForm: SendSponsorEmailRequest = {
    subject: '',
    body: ''
  };
  composeFiles: File[] = [];

  showAttachmentViewer = false;
  viewerAttachments: SponsorEmailAttachment[] = [];
  viewerIndex = 0;
  viewerZoom = 1;
  viewerTextContent = '';
  viewerTextLoading = false;

  addCountryCode = '+216';
  addPhoneDigits = '';

  editCountryCode = '+216';
  editPhoneDigits = '';
  editForm: UpdateSponsorRequest = {
    id: 0,
    name: '',
    contactEmail: '',
    phone: ''
  };

  pendingDelete: Sponsor | null = null;
  deleteReason = 'Strategic realignment of partnership priorities';
  readonly deleteReasonOptions: string[] = [
    'Strategic realignment of partnership priorities',
    'Budget constraints and sponsorship restructuring',
    'End of agreed sponsorship period',
    'Operational scope no longer aligned',
    'Compliance or policy requirements'
  ];

  selectedAddLogoFile: File | null = null;
  selectedEditLogoFile: File | null = null;
  addLogoPreview = '';
  editLogoPreview = '';

  currentPage = 1;
  readonly pageSize = 7;

  form: CreateSponsorRequest = {
    name: '',
    contactEmail: '',
    phone: ''
  };

  constructor(
    private sponsorService: SponsorService,
    private sponsorFileUtils: SponsorFileUtilsService,
    private sanitizer: DomSanitizer,
    private sponsorshipPdfService: SponsorshipPdfService,
    private sponsorshipService: SponsorshipService,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.loadSponsors();
    this.route.data.subscribe((data) => {
      const section = (data['section'] as 'SPONSORS' | 'SPONSORSHIPS' | undefined) || 'SPONSORS';
      this.sectionTab = section;

      if (section === 'SPONSORSHIPS') {
        this.showFilterMenu = false;
        this.activeActionMenuSponsorId = null;
        this.loadSponsorships();
        this.startSponsorshipAutoRefresh();
      } else {
        this.stopSponsorshipAutoRefresh();
        if (this.sponsorships.length === 0) {
          this.loadSponsorships();
        }
      }
    });
  }

  ngOnDestroy(): void {
    this.stopSponsorshipAutoRefresh();
  }

  loadSponsors(): void {
    this.isLoading = true;
    this.loadError = '';

    this.sponsorService.getAll().subscribe({
      next: (data) => {
        this.sponsors = [...data].sort((a, b) => (b.id ?? 0) - (a.id ?? 0));
        this.currentPage = 1;
        this.ensureCurveMonthSelection();
        this.isLoading = false;
      },
      error: () => {
        this.loadError = 'Failed to load sponsors. Please refresh the page.';
        this.isLoading = false;
        this.showToast(this.loadError, 'error');
      }
    });
  }

  openAddForm(): void {
    this.showAddForm = true;
    this.submitError = '';
    this.submitSuccess = '';
    this.addCountryCode = '+216';
    this.addPhoneDigits = '';
    this.selectedAddLogoFile = null;
    this.addLogoPreview = '';
  }

  closeAddForm(): void {
    this.showAddForm = false;
    this.submitError = '';
    this.submitSuccess = '';
    this.form = { name: '', contactEmail: '', phone: '' };
    this.addCountryCode = '+216';
    this.addPhoneDigits = '';
    this.selectedAddLogoFile = null;
    this.addLogoPreview = '';
  }

  onConfirmAdd(): void {
    if (!this.isFormValid()) return;

    this.isSubmitting = true;
    this.submitError = '';
    this.submitSuccess = '';
    const payload: CreateSponsorRequest = {
      name: this.form.name.trim(),
      contactEmail: this.form.contactEmail.trim(),
      phone: this.buildFullPhone(this.addCountryCode, this.addPhoneDigits)
    };

    this.sponsorService.create(payload).subscribe({
      next: (created) => {
        if (this.selectedAddLogoFile && created.id) {
          this.sponsorService.uploadLogo(created.id, this.selectedAddLogoFile).subscribe({
            next: (updatedWithLogo) => {
              this.sponsors = [updatedWithLogo, ...this.sponsors];
              this.finishAddFlow();
            },
            error: () => {
              this.sponsors = [created, ...this.sponsors];
              this.finishAddFlow('Sponsor created, but logo upload failed.');
            }
          });
        } else {
          this.sponsors = [created, ...this.sponsors];
          this.finishAddFlow();
        }
      },
      error: (err: unknown) => {
        this.isSubmitting = false;
        if (err instanceof HttpErrorResponse) {
          const msg = typeof err.error === 'string'
            ? err.error
            : (err.error?.message ?? err.message ?? 'Failed to add sponsor.');
          this.submitError = msg;
        } else {
          this.submitError = 'Failed to add sponsor.';
        }
        this.showToast(this.submitError, 'error');
      }
    });
  }

  private finishAddFlow(message = 'Sponsor invitation sent successfully.'): void {
    this.currentPage = 1;
    this.isSubmitting = false;
    this.submitSuccess = 'Sponsor invitation sent and saved as Pending.';
    this.form = { name: '', contactEmail: '', phone: '' };
    this.addCountryCode = '+216';
    this.addPhoneDigits = '';
    this.selectedAddLogoFile = null;
    this.addLogoPreview = '';
    setTimeout(() => this.closeAddForm(), 700);
    this.showToast(message, 'success');
  }

  isFormValid(): boolean {
    return this.form.name.trim().length >= 2
      && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.form.contactEmail)
      && this.addPhoneDigits.length === 8;
  }

  isEditFormValid(): boolean {
    return this.editForm.name.trim().length >= 2
      && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.editForm.contactEmail)
      && this.editPhoneDigits.length === 8
      && this.editForm.id > 0;
  }

  get pagedSponsors(): Sponsor[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.filteredSponsors.slice(start, start + this.pageSize);
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.filteredSponsors.length / this.pageSize));
  }

  get totalSponsorsCount(): number {
    return this.sponsors.length;
  }

  get pendingSponsorsCount(): number {
    return this.sponsors.filter(s => (s.status || 'PENDING').toUpperCase() === 'PENDING').length;
  }

  get confirmedSponsorsCount(): number {
    return this.sponsors.filter(s => (s.status || '').toUpperCase() === 'CONFIRMED').length;
  }

  get deniedSponsorsCount(): number {
    return this.sponsors.filter(s => (s.status || '').toUpperCase() === 'DENIED').length;
  }

  get sponsorConfirmationRate(): number {
    if (this.totalSponsorsCount === 0) {
      return 0;
    }
    return Math.round((this.confirmedSponsorsCount / this.totalSponsorsCount) * 100);
  }

  get prospectingSponsorshipPercent(): number {
    return this.sponsorshipStatusShare('PROSPECTING');
  }

  get outreachSponsorshipPercent(): number {
    return this.sponsorshipStatusShare('OUTREACH_SENT');
  }

  get contractSponsorshipPercent(): number {
    return this.sponsorshipStatusShare('CONTRACT_SENT');
  }

  get signedSponsorshipPercent(): number {
    return this.sponsorshipStatusShare('SIGNED');
  }

  get paidSponsorshipPercent(): number {
    return this.sponsorshipStatusShare('PAID');
  }

  get sponsorshipStagePieStyle(): Record<string, string> {
    const total = this.totalSponsorshipCount;
    if (total <= 0) {
      return {
        background: 'conic-gradient(#334155 0deg 360deg)'
      };
    }

    const slices = [
      { value: this.sponsorshipStatusCount('PROSPECTING'), color: '#64748b' },
      { value: this.sponsorshipStatusCount('OUTREACH_SENT'), color: '#38bdf8' },
      { value: this.sponsorshipStatusCount('CONTRACT_SENT'), color: '#f7b91c' },
      { value: this.sponsorshipStatusCount('SIGNED'), color: '#22c55e' },
      { value: this.sponsorshipStatusCount('PAID'), color: '#e05c5c' }
    ];

    let currentDeg = 0;
    const segments = slices.map((slice) => {
      const start = currentDeg;
      const sweep = (slice.value / total) * 360;
      currentDeg += sweep;
      const end = Math.min(360, currentDeg);
      return `${slice.color} ${start}deg ${end}deg`;
    });

    return {
      background: `conic-gradient(${segments.join(', ')})`
    };
  }

  get sponsorsCurveFilterOptions(): Array<{ sponsorId: number; sponsorName: string }> {
    const grouped = new Map<number, string>();
    for (const sponsor of this.sponsors) {
      if (!sponsor.id) {
        continue;
      }
      grouped.set(sponsor.id, sponsor.name || `Sponsor #${sponsor.id}`);
    }
    for (const item of this.sponsorships) {
      if (item.sponsorId && !grouped.has(item.sponsorId)) {
        grouped.set(item.sponsorId, item.sponsorName || `Sponsor #${item.sponsorId}`);
      }
    }
    return Array.from(grouped.entries())
      .map(([sponsorId, sponsorName]) => ({ sponsorId, sponsorName }))
      .sort((a, b) => a.sponsorName.localeCompare(b.sponsorName));
  }

  get curveMonthOptions(): Array<{ key: string; label: string }> {
    const monthKeys = new Set<string>();

    for (const sponsor of this.sponsors) {
      const key = this.toMonthKey(sponsor.joinDate);
      if (key) {
        monthKeys.add(key);
      }
    }

    for (const item of this.sponsorships) {
      const key = this.toMonthKey(item.createdAt);
      if (key) {
        monthKeys.add(key);
      }
    }

    return Array.from(monthKeys)
      .sort((a, b) => b.localeCompare(a))
      .map(key => ({ key, label: this.monthKeyToLongLabel(key) }));
  }

  get sponsorsCurveModel(): SponsorCurveModel {
    const sourceSeries = this.buildCurveSourceSeries();
    if (sourceSeries.length === 0) {
      return {
        series: [],
        yTicks: [1, 0],
        xLabels: [],
        maxValue: 1
      };
    }

    const window = this.resolveCurveWindow(sourceSeries);
    if (!window) {
      return {
        series: [],
        yTicks: [1, 0],
        xLabels: [],
        maxValue: 1
      };
    }

    const plotWidth = this.curveViewBoxWidth - this.curvePadding.left - this.curvePadding.right;
    const plotHeight = this.curveViewBoxHeight - this.curvePadding.top - this.curvePadding.bottom;
    const startTs = window.start.getTime();
    const endTs = window.end.getTime();
    const span = Math.max(1, endTs - startTs);

    const chartSeries: SponsorCurveSeries[] = [];
    let maxValue = 1;

    for (const row of sourceSeries) {
      const dailyCounts = new Map<string, { date: Date; count: number }>();
      for (const date of row.sponsorshipDates) {
        const dateKey = this.toIsoDate(date);
        const existing = dailyCounts.get(dateKey);
        if (existing) {
          existing.count += 1;
          continue;
        }
        dailyCounts.set(dateKey, { date, count: 1 });
      }

      const points: CurvePoint[] = Array.from(dailyCounts.values())
        .sort((a, b) => a.date.getTime() - b.date.getTime())
        .map((entry) => ({
          x: this.curvePadding.left + ((entry.date.getTime() - startTs) / span) * plotWidth,
          y: 0,
          value: entry.count,
          label: entry.date.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })
        }));

      if (points.length === 0) {
        continue;
      }

      maxValue = Math.max(maxValue, ...points.map(point => point.value));

      chartSeries.push({
        sponsorId: row.sponsorId,
        sponsorName: row.sponsorName,
        color: this.curveColorForSponsor(row.sponsorId),
        points,
        path: ''
      });
    }

    if (chartSeries.length === 0) {
      return {
        series: [],
        yTicks: [1, 0],
        xLabels: [],
        maxValue: 1
      };
    }

    for (const series of chartSeries) {
      const normalized = series.points.map(point => ({
        ...point,
        y: this.curvePadding.top + ((maxValue - point.value) / maxValue) * plotHeight
      }));
      series.points = normalized;
      series.path = this.buildLinearPath(normalized);
    }

    const yTicks = this.buildCurveTicks(maxValue);
    const xLabels = this.buildCurveXLabels(window.start, window.end, 7);

    chartSeries.sort((a, b) => a.sponsorName.localeCompare(b.sponsorName));

    return {
      series: chartSeries,
      yTicks,
      xLabels,
      maxValue
    };
  }

  get sponsorsCurveEmptyState(): boolean {
    return this.sponsorsCurveModel.series.length === 0;
  }

  get curveLegendSeries(): SponsorCurveSeries[] {
    return this.sponsorsCurveModel.series;
  }

  toggleSponsorsCurveView(): void {
    this.showSponsorsCurve = !this.showSponsorsCurve;
  }

  curveY(value: number, maxValue: number): number {
    const normalizedMax = Math.max(1, maxValue);
    const plotHeight = this.curveViewBoxHeight - this.curvePadding.top - this.curvePadding.bottom;
    return this.curvePadding.top + ((normalizedMax - value) / normalizedMax) * plotHeight;
  }

  private buildCurveSourceSeries(): Array<{ sponsorId: number; sponsorName: string; sponsorshipDates: Date[] }> {
    const sponsorshipBySponsor = new Map<number, Date[]>();
    for (const item of this.sponsorships) {
      if (!item.sponsorId) {
        continue;
      }
      const created = this.toDateOnly(item.createdAt);
      if (!created) {
        continue;
      }
      const bucket = sponsorshipBySponsor.get(item.sponsorId) || [];
      bucket.push(created);
      sponsorshipBySponsor.set(item.sponsorId, bucket);
    }

    const result: Array<{ sponsorId: number; sponsorName: string; sponsorshipDates: Date[] }> = [];
    for (const option of this.sponsorsCurveFilterOptions) {
      if (this.selectedCurveSponsorId !== 'ALL' && option.sponsorId !== this.selectedCurveSponsorId) {
        continue;
      }

      const sponsorshipDates = (sponsorshipBySponsor.get(option.sponsorId) || [])
        .filter(date => this.selectedCurveMonthKey === 'ALL' || this.toMonthKey(this.toIsoDate(date)) === this.selectedCurveMonthKey)
        .sort((a, b) => a.getTime() - b.getTime());
      if (sponsorshipDates.length === 0) {
        continue;
      }

      result.push({
        sponsorId: option.sponsorId,
        sponsorName: option.sponsorName,
        sponsorshipDates
      });
    }

    return result;
  }

  private resolveCurveWindow(sourceSeries: Array<{ sponsorshipDates: Date[] }>): { start: Date; end: Date } | null {
    if (sourceSeries.length === 0) {
      return null;
    }

    const allDates: Date[] = [];
    for (const row of sourceSeries) {
      allDates.push(...row.sponsorshipDates);
    }
    if (allDates.length === 0) {
      return null;
    }

    const minDate = allDates.reduce((min, date) => date < min ? date : min, allDates[0]);
    const maxDate = allDates.reduce((max, date) => date > max ? date : max, allDates[0]);

    return { start: minDate, end: maxDate };
  }

  private toMonthKey(value?: string | null): string | null {
    const date = this.toDateOnly(value);
    if (!date) {
      return null;
    }
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  }

  private monthKeyToLongLabel(key: string): string {
    const [year, month] = key.split('-').map(value => Number(value));
    if (!Number.isFinite(year) || !Number.isFinite(month)) {
      return key;
    }
    const date = new Date(year, month - 1, 1);
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }

  private toDateOnly(value?: string | null): Date | null {
    if (!value) {
      return null;
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return null;
    }
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  private toIsoDate(value: Date): string {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
  }

  private curveColorForSponsor(sponsorId: number): string {
    const index = Math.abs(sponsorId) % this.curvePalette.length;
    return this.curvePalette[index];
  }

  private buildCurveTicks(maxValue: number): number[] {
    const safeMax = Math.max(1, Math.ceil(maxValue));
    if (safeMax <= 4) {
      return Array.from({ length: safeMax + 1 }, (_, index) => safeMax - index);
    }
    const step = Math.ceil(safeMax / 4);
    const top = step * 4;
    return [top, top - step, top - 2 * step, top - 3 * step, 0];
  }

  private buildLinearPath(points: CurvePoint[]): string {
    if (points.length === 0) {
      return '';
    }

    let path = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i += 1) {
      path += ` L ${points[i].x} ${points[i].y}`;
    }
    return path;
  }

  private buildSlightlySmoothedPoints(points: CurvePoint[]): CurvePoint[] {
    if (points.length < 3) {
      return points;
    }

    return points.map((point, index) => {
      if (index === 0 || index === points.length - 1) {
        return point;
      }
      const prev = points[index - 1];
      const next = points[index + 1];
      // Low-intensity smoothing to soften sharp angles without overshooting axes.
      const y = (prev.y + (point.y * 6) + next.y) / 8;
      return { ...point, y };
    });
  }

  private buildCurveXLabels(start: Date, end: Date, slots: number): SponsorCurveXAxisLabel[] {
    const startTs = start.getTime();
    const endTs = end.getTime();
    const span = Math.max(1, endTs - startTs);
    const plotWidth = this.curveViewBoxWidth - this.curvePadding.left - this.curvePadding.right;

    if (span === 1) {
      return [{
        x: this.curvePadding.left,
        label: start.toLocaleDateString('en-US', { day: '2-digit', month: 'short' }),
        show: true
      }];
    }

    const count = Math.max(2, slots);
    const labels: SponsorCurveXAxisLabel[] = [];
    for (let i = 0; i < count; i += 1) {
      const ratio = i / (count - 1);
      const ts = startTs + span * ratio;
      const date = new Date(ts);
      labels.push({
        x: this.curvePadding.left + plotWidth * ratio,
        label: date.toLocaleDateString('en-US', { day: '2-digit', month: 'short' }),
        show: true
      });
    }
    return labels;
  }

  private ensureCurveMonthSelection(): void {
    const options = this.curveMonthOptions;
    if (options.length === 0) {
      this.selectedCurveMonthKey = 'ALL';
      return;
    }

    if (this.selectedCurveMonthKey === 'ALL') {
      this.selectedCurveMonthKey = options[0].key;
      return;
    }

    const exists = options.some(option => option.key === this.selectedCurveMonthKey);
    if (!exists) {
      this.selectedCurveMonthKey = options[0].key;
    }
  }

  get sponsorshipLifecycleSlices(): LifecyclePieSlice[] {
    const total = this.totalSponsorshipCount;
    if (total <= 0) {
      return [];
    }

    const entries = [
      { label: 'Prospecting', value: this.sponsorshipStatusCount('PROSPECTING'), color: '#64748b' },
      { label: 'Outreach Sent', value: this.sponsorshipStatusCount('OUTREACH_SENT'), color: '#38bdf8' },
      { label: 'Contract Sent', value: this.sponsorshipStatusCount('CONTRACT_SENT'), color: '#f7b91c' },
      { label: 'Signed', value: this.sponsorshipStatusCount('SIGNED'), color: '#22c55e' },
      { label: 'Paid', value: this.sponsorshipStatusCount('PAID'), color: '#e05c5c' }
    ];

    const slices: LifecyclePieSlice[] = [];
    let startPct = 0;
    for (const entry of entries) {
      if (entry.value <= 0) {
        continue;
      }

      const percent = Math.round((entry.value / total) * 100);
      const endPct = startPct + (entry.value / total) * 100;
      const middleAngle = this.pctToAngle((startPct + endPct) / 2);
      const labelPoint = this.polarToCartesian(80, 80, 43, middleAngle);
      slices.push({
        label: entry.label,
        value: entry.value,
        percent,
        color: entry.color,
        path: this.describePieSlice(startPct, endPct, 80, 80, 68),
        labelX: labelPoint.x,
        labelY: labelPoint.y,
        textColor: '#0f172a'
      });
      startPct = endPct;
    }

    return slices;
  }

  setLifecyclePieHover(label: string): void {
    this.lifecyclePieHoverLabel = label;
  }

  clearLifecyclePieHover(): void {
    this.lifecyclePieHoverLabel = '';
  }

  private describePieSlice(startPct: number, endPct: number, cx: number, cy: number, radius: number): string {
    const startAngle = this.pctToAngle(startPct);
    const endAngle = this.pctToAngle(endPct);
    const largeArc = endPct - startPct > 50 ? 1 : 0;

    const pieStart = this.polarToCartesian(cx, cy, radius, startAngle);
    const pieEnd = this.polarToCartesian(cx, cy, radius, endAngle);

    return [
      `M ${cx} ${cy}`,
      `L ${pieStart.x} ${pieStart.y}`,
      `A ${radius} ${radius} 0 ${largeArc} 1 ${pieEnd.x} ${pieEnd.y}`,
      'Z'
    ].join(' ');
  }

  private pctToAngle(percent: number): number {
    return -90 + (percent / 100) * 360;
  }

  private polarToCartesian(cx: number, cy: number, radius: number, angleDeg: number): { x: number; y: number } {
    const angleRad = (Math.PI / 180) * angleDeg;
    return {
      x: cx + radius * Math.cos(angleRad),
      y: cy + radius * Math.sin(angleRad)
    };
  }

  get totalSponsorshipCount(): number {
    return this.sponsorships.length;
  }

  get activeSponsorshipCount(): number {
    return this.sponsorships.filter(item => !this.isSponsorshipFinished(item)).length;
  }

  get finishedSponsorshipCount(): number {
    return this.sponsorships.filter(item => this.isSponsorshipFinished(item)).length;
  }

  get totalExpectedAmount(): number {
    return this.sponsorships.reduce((sum, item) => sum + Number(item.expectedAmount || 0), 0);
  }

  get totalAgreedAmount(): number {
    return this.sponsorships.reduce((sum, item) => sum + Number(item.agreedAmount || 0), 0);
  }

  get totalPaidAmount(): number {
    return this.sponsorships.reduce((sum, item) => sum + Number(item.paidAmount || 0), 0);
  }

  get paidCollectionRate(): number {
    const agreed = this.totalAgreedAmount;
    if (agreed <= 0) {
      return 0;
    }
    return Math.min(100, Math.round((this.totalPaidAmount / agreed) * 100));
  }

  get topPaidSponsors(): Array<{ sponsorId: number; sponsorName: string; sponsorLogoUrl?: string | null; paidAmount: number; sponsorshipCount: number }> {
    const map = new Map<number, { sponsorName: string; sponsorLogoUrl?: string | null; paidAmount: number; sponsorshipCount: number }>();
    for (const item of this.sponsorships) {
      const id = item.sponsorId || 0;
      const current = map.get(id) || {
        sponsorName: item.sponsorName || 'Unknown Sponsor',
        sponsorLogoUrl: item.sponsorLogoUrl || null,
        paidAmount: 0,
        sponsorshipCount: 0
      };
      if (!current.sponsorLogoUrl && item.sponsorLogoUrl) {
        current.sponsorLogoUrl = item.sponsorLogoUrl;
      }
      current.paidAmount += Number(item.paidAmount || 0);
      current.sponsorshipCount += 1;
      map.set(id, current);
    }

    return Array.from(map.entries())
      .map(([sponsorId, value]) => ({ sponsorId, ...value }))
      .sort((a, b) => b.paidAmount - a.paidAmount)
      .slice(0, 3);
  }

  topRankMedal(index: number): string {
    if (index === 0) {
      return '/assets/logos/gold-medal.png';
    }
    if (index === 1) {
      return '/assets/logos/silver-medal.png';
    }
    return '/assets/logos/bronze-medal.png';
  }

  rankLabel(index: number): string {
    if (index === 0) {
      return 'Gold';
    }
    if (index === 1) {
      return 'Silver';
    }
    return 'Bronze';
  }

  sponsorshipStatusCount(status: SponsorshipStatus): number {
    return this.sponsorships.filter(item => item.status === status).length;
  }

  sponsorshipStatusShare(status: SponsorshipStatus): number {
    if (this.totalSponsorshipCount === 0) {
      return 0;
    }
    return Math.round((this.sponsorshipStatusCount(status) / this.totalSponsorshipCount) * 100);
  }

  formatAmount(value: number): string {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(Number(value || 0));
  }

  get pinnedEmails(): SponsorEmail[] {
    return this.sponsorEmails.filter(email => !!email.pinned);
  }

  get unpinnedEmails(): SponsorEmail[] {
    return this.sponsorEmails.filter(email => !email.pinned);
  }

  get filteredSponsors(): Sponsor[] {
    const q = this.filterQuery.trim().toLowerCase();

    const filtered = this.sponsors.filter((sponsor) => {
      const statusMatches = this.filterStatus === 'ALL' || (sponsor.status || 'PENDING').toUpperCase() === this.filterStatus;
      const countryMatches = this.filterCountryCode === 'ALL' || this.splitPhone(sponsor.phone || '').code === this.filterCountryCode;
      const queryMatches = !q
        || sponsor.name.toLowerCase().includes(q)
        || sponsor.contactEmail.toLowerCase().includes(q)
        || sponsor.phone.toLowerCase().includes(q);
      return statusMatches && countryMatches && queryMatches;
    });

    const sorted = [...filtered];
    switch (this.filterSort) {
      case 'OLDEST':
        sorted.sort((a, b) => (a.id ?? 0) - (b.id ?? 0));
        break;
      case 'NAME_ASC':
        sorted.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'NAME_DESC':
        sorted.sort((a, b) => b.name.localeCompare(a.name));
        break;
      default:
        sorted.sort((a, b) => (b.id ?? 0) - (a.id ?? 0));
        break;
    }
    return sorted;
  }


  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
  }

  toggleFilterMenu(): void {
    this.showFilterMenu = !this.showFilterMenu;
  }

  onFiltersChanged(): void {
    this.currentPage = 1;
  }

  clearFilters(): void {
    this.filterStatus = 'ALL';
    this.filterCountryCode = 'ALL';
    this.filterQuery = '';
    this.filterSort = 'NEWEST';
    this.currentPage = 1;
  }

  statusClass(status: string | undefined): string {
    switch ((status || '').toUpperCase()) {
      case 'CONFIRMED': return 'sponsors__status-badge--confirmed';
      case 'DENIED': return 'sponsors__status-badge--denied';
      default: return 'sponsors__status-badge--pending';
    }
  }

  onEditSponsor(sponsor: Sponsor): void {
    if (!sponsor.id) return;
    const split = this.splitPhone(sponsor.phone || '');
    this.editForm = {
      id: sponsor.id,
      name: sponsor.name,
      contactEmail: sponsor.contactEmail,
      phone: sponsor.phone,
      status: sponsor.status,
      confirmationToken: sponsor.confirmationToken,
      tokenExpiresAt: sponsor.tokenExpiresAt
    };
    this.editCountryCode = split.code;
    this.editPhoneDigits = split.local;
    this.selectedEditLogoFile = null;
    this.editLogoPreview = sponsor.logoUrl || '';
    this.editError = '';
    this.showEditForm = true;
  }

  onDeleteSponsor(sponsor: Sponsor): void {
    if (!sponsor.id) return;
    this.pendingDelete = sponsor;
    this.showDeleteConfirm = true;
    this.editError = '';
    this.deleteReason = this.deleteReasonOptions[0];
  }

  closeEditForm(): void {
    this.showEditForm = false;
    this.editError = '';
    this.selectedEditLogoFile = null;
    this.editLogoPreview = '';
  }

  closeDeleteConfirm(): void {
    this.showDeleteConfirm = false;
    this.pendingDelete = null;
    this.deleteReason = this.deleteReasonOptions[0];
  }

  onConfirmEdit(): void {
    if (!this.isEditFormValid()) return;

    this.isUpdating = true;
    this.editError = '';

    const payload: UpdateSponsorRequest = {
      ...this.editForm,
      name: this.editForm.name.trim(),
      contactEmail: this.editForm.contactEmail.trim(),
      phone: this.buildFullPhone(this.editCountryCode, this.editPhoneDigits)
    };

    this.sponsorService.update(payload).subscribe({
      next: (updated) => {
        if (this.selectedEditLogoFile && updated.id) {
          this.sponsorService.uploadLogo(updated.id, this.selectedEditLogoFile).subscribe({
            next: (updatedWithLogo) => {
              this.sponsors = this.sponsors.map(s => (s.id === updatedWithLogo.id ? updatedWithLogo : s));
              this.isUpdating = false;
              this.showEditForm = false;
              this.showToast(`Sponsor ${updatedWithLogo.name} updated successfully.`, 'success');
            },
            error: () => {
              this.sponsors = this.sponsors.map(s => (s.id === updated.id ? updated : s));
              this.isUpdating = false;
              this.showEditForm = false;
              this.showToast(`Sponsor ${updated.name} updated, but logo upload failed.`, 'error');
            }
          });
        } else {
          this.sponsors = this.sponsors.map(s => (s.id === updated.id ? updated : s));
          this.isUpdating = false;
          this.showEditForm = false;
          this.showToast(`Sponsor ${updated.name} updated successfully.`, 'success');
        }
      },
      error: (err: unknown) => {
        this.isUpdating = false;
        this.editError = this.resolveError(err, 'Failed to update sponsor.');
        this.showToast(this.editError, 'error');
      }
    });
  }

  onConfirmDelete(): void {
    if (!this.pendingDelete?.id) return;

    this.isDeleting = true;
    this.editError = '';
    const sponsorName = this.pendingDelete.name;

    this.sponsorService.delete(this.pendingDelete.id, this.deleteReason).subscribe({
      next: () => {
        this.sponsors = this.sponsors.filter(s => s.id !== this.pendingDelete?.id);
        this.isDeleting = false;
        this.showDeleteConfirm = false;
        this.pendingDelete = null;
        if (this.currentPage > this.totalPages) {
          this.currentPage = this.totalPages;
        }
        this.showToast(`Sponsor ${sponsorName} deleted successfully.`, 'success');
      },
      error: (err: unknown) => {
        this.isDeleting = false;
        this.editError = this.resolveError(err, 'Failed to delete sponsor.');
        this.showToast(this.editError, 'error');
      }
    });
  }

  toggleActionMenu(sponsor: Sponsor): void {
    if (!sponsor.id) {
      return;
    }
    this.activeActionMenuSponsorId = this.activeActionMenuSponsorId === sponsor.id ? null : sponsor.id;
  }

  onOpenEmails(sponsor: Sponsor): void {
    if (!sponsor.id) {
      return;
    }

    this.activeActionMenuSponsorId = null;
    this.selectedEmailSponsor = sponsor;
    this.showEmailsModal = true;
    this.emailTab = 'LIST';
    this.sponsorEmails = [];
    this.selectedEmail = null;
    this.showReplyBox = false;
    this.replyBody = '';
    this.replyFiles = [];
    this.composeForm = {
      subject: `Sponsorship Follow-up - ${sponsor.name}`,
      body: ''
    };
    this.composeFiles = [];
    this.loadSponsorEmails(sponsor.id);
  }

  loadSponsorships(): void {
    this.sponsorshipsLoading = true;
    this.sponsorshipsError = '';

    this.sponsorshipService.getAll().subscribe({
      next: (data) => {
        this.sponsorships = data;
        this.ensureCurveMonthSelection();
        if (this.showSponsorHistoryModal && !this.selectedHistorySponsorship) {
          this.selectedHistorySponsorship = this.sponsorSponsorshipHistory[0] || null;
        }
        this.sponsorshipsLoading = false;
      },
      error: (err: unknown) => {
        this.sponsorshipsLoading = false;
        this.sponsorshipsError = this.resolveError(err, 'Failed to load sponsorships.');
      }
    });
  }

  sponsorshipCards(status: SponsorshipStatus): Sponsorship[] {
    const cards = this.sponsorships.filter(item => item.status === status);
    const query = this.sponsorshipSearchQuery.trim().toLowerCase();
    if (!query) {
      return cards;
    }

    return [...cards].sort((a, b) => {
      const aMatch = this.matchesSponsorshipSearch(a, query) ? 1 : 0;
      const bMatch = this.matchesSponsorshipSearch(b, query) ? 1 : 0;
      return bMatch - aMatch;
    });
  }

  private matchesSponsorshipSearch(item: Sponsorship, query: string): boolean {
    const haystack = [
      item.sponsorName,
      item.eventName,
      item.ownerName,
      item.proposalSummary,
      item.notes,
      item.contractReference,
      item.proposalDocumentName,
      item.contractDocumentName,
      item.signedDocumentName,
      item.status,
      item.outreachDecision,
      item.expectedAmount,
      item.agreedAmount,
      item.paidAmount
    ]
      .map(value => (value ?? '').toString().toLowerCase())
      .join(' ');

    return haystack.includes(query);
  }

  openAddSponsorshipForm(): void {
    this.showAddSponsorshipForm = true;
    this.showEditSponsorshipForm = false;
    this.generatingSponsorshipSummary = false;
    this.sponsorshipForm = {
      sponsorId: this.sponsors[0]?.id || 0,
      eventName: '',
      expectedAmount: null,
      proposalSummary: '',
      notes: ''
    };
  }

  cancelAddSponsorshipForm(): void {
    this.showAddSponsorshipForm = false;
    this.generatingSponsorshipSummary = false;
  }

  createSponsorship(): void {
    if (!this.sponsorshipForm.sponsorId) {
      this.showToast('Select a sponsor before creating a sponsorship.', 'error');
      return;
    }

    this.sponsorshipSaving = true;
    this.sponsorshipsError = '';

    this.sponsorshipService.create(this.sponsorshipForm).subscribe({
      next: (created) => {
        this.sponsorships = [created, ...this.sponsorships];
        this.sponsorshipSaving = false;
        this.generatingSponsorshipSummary = false;
        this.showAddSponsorshipForm = false;
        this.showToast('Sponsorship card created in Prospecting.', 'success');
      },
      error: (err: unknown) => {
        this.sponsorshipSaving = false;
        this.sponsorshipsError = this.resolveError(err, 'Failed to create sponsorship.');
        this.showToast(this.sponsorshipsError, 'error');
      }
    });
  }

  generateSponsorshipProposalSummary(): void {
    if (this.generatingSponsorshipSummary) {
      return;
    }

    const sponsor = this.sponsors.find((item) => item.id === this.sponsorshipForm.sponsorId);
    if (!sponsor?.name) {
      this.showToast('Select a sponsor before generating the proposal summary.', 'error');
      return;
    }

    const eventName = (this.sponsorshipForm.eventName || '').trim();
    if (!eventName) {
      this.showToast('Enter the event name before generating the proposal summary.', 'error');
      return;
    }

    const expectedAmount = Number(this.sponsorshipForm.expectedAmount || 0);
    if (!Number.isFinite(expectedAmount) || expectedAmount <= 0) {
      this.showToast('Enter a valid expected amount before generating the proposal summary.', 'error');
      return;
    }

    this.generatingSponsorshipSummary = true;
    this.sponsorshipService.generateProposalSummaryWithAi({
      sponsorName: sponsor.name,
      eventName,
      expectedAmount
    }).subscribe({
      next: (response) => {
        this.sponsorshipForm.proposalSummary = (response.summary || '').trim();
        this.generatingSponsorshipSummary = false;
        this.showToast('Proposal summary generated with AI.', 'success');
      },
      error: (err: unknown) => {
        this.generatingSponsorshipSummary = false;
        const message = this.resolveError(err, 'Failed to generate proposal summary with AI.');
        this.showToast(message, 'error');
      }
    });
  }

  openEditSponsorshipForm(item: Sponsorship): void {
    if (item.status !== 'PROSPECTING') {
      this.showToast('Editing is only allowed while card is in Prospecting.', 'info');
      return;
    }
    this.sponsorshipEditId = item.id;
    this.showEditSponsorshipForm = true;
    this.showAddSponsorshipForm = false;
    this.sponsorshipEditStatus = item.status;
    this.sponsorshipEditForm = {
      eventName: item.eventName || '',
      expectedAmount: item.expectedAmount ?? null,
      agreedAmount: item.agreedAmount ?? null,
      paidAmount: item.paidAmount ?? null,
      proposalSummary: item.proposalSummary || '',
      proposalDocumentName: item.proposalDocumentName || '',
      contractDocumentName: item.contractDocumentName || '',
      signedDocumentName: item.signedDocumentName || '',
      contractReference: item.contractReference || '',
      notes: item.notes || ''
    };
  }

  cancelEditSponsorshipForm(): void {
    this.showEditSponsorshipForm = false;
    this.sponsorshipEditId = null;
    this.sponsorshipEditStatus = 'PROSPECTING';
  }

  openSponsorshipDetails(item: Sponsorship): void {
    this.selectedSponsorshipDetails = item;
    this.showSponsorshipDetails = true;
  }

  closeSponsorshipDetails(): void {
    this.showSponsorshipDetails = false;
    this.selectedSponsorshipDetails = null;
  }

  openSponsorshipDoc(folder: 'Proposals' | 'Contracts' | 'Signed', fileName?: string | null): void {
    const url = this.getSponsorshipDocUrl(folder, fileName);
    if (!url) {
      return;
    }
    window.open(url, '_blank', 'noopener');
  }

  private getSponsorshipDocUrl(folder: 'Proposals' | 'Contracts' | 'Signed', fileName?: string | null): string | null {
    const normalized = (fileName || '').trim();
    if (!normalized) {
      return null;
    }
    return `${environment.sponsorsApiUrl}/assets/sponsorfiles/${folder}/${encodeURIComponent(normalized)}`;
  }

  saveSponsorshipEdit(): void {
    if (!this.sponsorshipEditId) {
      return;
    }

    this.sponsorshipSaving = true;
    this.sponsorshipService.update(this.sponsorshipEditId, this.sponsorshipEditForm).subscribe({
      next: (updated) => {
        this.sponsorships = this.sponsorships.map(item => item.id === updated.id ? updated : item);
        this.sponsorshipSaving = false;
        this.showEditSponsorshipForm = false;
        this.sponsorshipEditId = null;
        this.showToast('Sponsorship updated.', 'success');
      },
      error: (err: unknown) => {
        this.sponsorshipSaving = false;
        this.sponsorshipsError = this.resolveError(err, 'Failed to update sponsorship.');
        this.showToast(this.sponsorshipsError, 'error');
      }
    });
  }

  deleteSponsorship(item: Sponsorship): void {
    this.sponsorshipSaving = true;
    this.sponsorshipService.delete(item.id).subscribe({
      next: () => {
        this.sponsorships = this.sponsorships.filter(entry => entry.id !== item.id);
        this.sponsorshipSaving = false;
        this.showToast('Sponsorship deleted.', 'success');
      },
      error: (err: unknown) => {
        this.sponsorshipSaving = false;
        this.sponsorshipsError = this.resolveError(err, 'Failed to delete sponsorship.');
        this.showToast(this.sponsorshipsError, 'error');
      }
    });
  }

  moveSponsorship(item: Sponsorship, toStatus: SponsorshipStatus): void {
    this.sponsorshipSaving = true;
    this.sponsorshipService.move(item.id, toStatus).subscribe({
      next: (updated) => {
        this.sponsorships = this.sponsorships.map(entry => entry.id === updated.id ? updated : entry);
        this.sponsorshipSaving = false;
        this.showToast(`Moved to ${this.statusLabel(updated.status)}.`, 'success');
      },
      error: (err: unknown) => {
        this.sponsorshipSaving = false;
        const reason = this.resolveError(err, 'Failed to move sponsorship card.');
        this.showToast(reason, 'error');
      }
    });
  }

  dropListId(status: SponsorshipStatus): string {
    return `sponsors-kanban-${status.toLowerCase()}`;
  }

  connectedDropLists(status: SponsorshipStatus): string[] {
    const connected: string[] = [];
    const next = this.nextStatus(status);
    if (next && !(status === 'OUTREACH_SENT' && next === 'CONTRACT_SENT')) {
      connected.push(this.dropListId(next));
    }
    return connected;
  }

  onSponsorshipDrop(event: CdkDragDrop<Sponsorship[]>, targetStatus: SponsorshipStatus): void {
    const dragged = event.item.data as Sponsorship | undefined;
    if (!dragged || dragged.status === targetStatus || this.sponsorshipSaving) {
      return;
    }
    if (this.isDeclinedOutreach(dragged)) {
      this.showToast('Declined outreach cards cannot be moved. You can only delete them.', 'info');
      return;
    }
    const currentIndex = this.sponsorshipColumns.findIndex(col => col.status === dragged.status);
    const targetIndex = this.sponsorshipColumns.findIndex(col => col.status === targetStatus);
    if (targetIndex <= currentIndex) {
      this.showToast('Moving cards backwards is not allowed.', 'info');
      return;
    }
    if (dragged.status === 'OUTREACH_SENT' && targetStatus === 'CONTRACT_SENT') {
      this.showToast('This move is automatic after sponsor acceptance from outreach email.', 'info');
      return;
    }
    this.moveSponsorship(dragged, targetStatus);
  }

  getEditMoveGuide(): SponsorshipMoveGuide | null {
    const current = this.sponsorshipEditStatus;
    const next = this.nextStatus(current);
    if (!next) {
      return {
        from: this.statusLabel(current),
        to: 'Completed',
        requirements: [],
        canMove: false,
        note: 'This card is already in the final column.'
      };
    }

    const requirements: SponsorshipMoveRequirement[] = [];
    const agreed = this.sponsorshipEditForm.agreedAmount ?? 0;
    const paid = this.sponsorshipEditForm.paidAmount ?? 0;
    const hasSignedProof = !!this.sponsorshipEditForm.contractReference?.trim() || !!this.sponsorshipEditForm.signedDocumentName?.trim();

    if (current === 'OUTREACH_SENT' && next === 'CONTRACT_SENT') {
      requirements.push({ label: 'Sponsor must accept from outreach email', met: false });
      requirements.push({ label: 'This transition is automatic', met: false });
    } else if (current === 'CONTRACT_SENT' && next === 'SIGNED') {
      requirements.push({ label: 'Signed document name OR contract reference is filled', met: hasSignedProof });
    } else if (current === 'SIGNED' && next === 'PAID') {
      requirements.push({ label: 'Agreed amount is greater than 0', met: agreed > 0 });
      requirements.push({ label: 'Paid amount is at least equal to agreed amount', met: agreed > 0 && paid >= agreed });
    } else {
      requirements.push({ label: 'No mandatory fields for this move', met: true });
    }

    return {
      from: this.statusLabel(current),
      to: this.statusLabel(next),
      canMove: requirements.every(req => req.met),
      requirements,
      note: 'Cards can only be dragged forward to the next column.'
    };
  }

  isFieldEditable(field: 'eventName' | 'expectedAmount' | 'agreedAmount' | 'paidAmount' | 'proposalSummary' | 'proposalDocumentName' | 'contractDocumentName' | 'signedDocumentName' | 'contractReference' | 'notes'): boolean {
    switch (this.sponsorshipEditStatus) {
      case 'PROSPECTING':
        return ['eventName', 'expectedAmount', 'proposalSummary', 'notes'].includes(field);
      case 'OUTREACH_SENT':
        return ['eventName', 'expectedAmount', 'proposalSummary', 'notes'].includes(field);
      case 'CONTRACT_SENT':
        return ['agreedAmount', 'contractDocumentName', 'contractReference', 'proposalSummary', 'notes'].includes(field);
      case 'SIGNED':
        return ['agreedAmount', 'paidAmount', 'signedDocumentName', 'contractReference', 'notes'].includes(field);
      case 'PAID':
        return ['paidAmount', 'notes'].includes(field);
      default:
        return false;
    }
  }

  private startSponsorshipAutoRefresh(): void {
    if (this.sponsorshipRefreshTimer) {
      return;
    }
    this.sponsorshipRefreshTimer = setInterval(() => {
      if (this.sectionTab === 'SPONSORSHIPS' && !this.sponsorshipSaving) {
        this.loadSponsorships();
      }
    }, 15000);
  }

  private stopSponsorshipAutoRefresh(): void {
    if (this.sponsorshipRefreshTimer) {
      clearInterval(this.sponsorshipRefreshTimer);
      this.sponsorshipRefreshTimer = undefined;
    }
  }

  previousStatus(status: SponsorshipStatus): SponsorshipStatus | null {
    const index = this.sponsorshipColumns.findIndex(col => col.status === status);
    if (index <= 0) {
      return null;
    }
    return this.sponsorshipColumns[index - 1].status;
  }

  nextStatus(status: SponsorshipStatus): SponsorshipStatus | null {
    const index = this.sponsorshipColumns.findIndex(col => col.status === status);
    if (index === -1 || index >= this.sponsorshipColumns.length - 1) {
      return null;
    }
    return this.sponsorshipColumns[index + 1].status;
  }

  statusLabel(status: SponsorshipStatus): string {
    return this.sponsorshipColumns.find(col => col.status === status)?.label || status;
  }

  sponsorshipProgress(item: Sponsorship): string {
    const agreed = item.agreedAmount ?? 0;
    const paid = item.paidAmount ?? 0;
    if (agreed <= 0) {
      return '--';
    }
    return `${Math.min(100, Math.round((paid / agreed) * 100))}%`;
  }

  isDeclinedOutreach(item: Sponsorship): boolean {
    return item.status === 'OUTREACH_SENT' && (item.outreachDecision || '').toUpperCase() === 'DECLINED';
  }

  isSponsorshipDragDisabled(item: Sponsorship): boolean {
    return this.sponsorshipSaving || this.isDeclinedOutreach(item);
  }

  onOpenHistory(sponsor: Sponsor): void {
    if (!sponsor.id) {
      return;
    }
    this.activeActionMenuSponsorId = null;
    this.selectedHistorySponsor = sponsor;
    this.showSponsorHistoryModal = true;
    this.historyCurrentPage = 1;
    this.selectedHistorySponsorship = this.sponsorSponsorshipHistory[0] || null;
    this.loadHistoryEmails(sponsor.id);
    if (!this.sponsorshipsLoading) {
      this.loadSponsorships();
    }
  }

  closeSponsorHistoryModal(): void {
    this.showSponsorHistoryModal = false;
    this.selectedHistorySponsor = null;
    this.selectedHistorySponsorship = null;
    this.historyEmails = [];
    this.historyEmailsLoading = false;
    this.historyEmailsError = '';
    this.historyCurrentPage = 1;
  }

  get historyTrackedEmailsPreview(): SponsorEmail[] {
    return this.historyEmails.slice(0, 10);
  }

  private loadHistoryEmails(sponsorId: number): void {
    this.historyEmailsLoading = true;
    this.historyEmailsError = '';
    this.historyEmails = [];

    this.sponsorService.getEmails(sponsorId).subscribe({
      next: (emails) => {
        this.historyEmails = emails;
        this.historyEmailsLoading = false;
      },
      error: (err: unknown) => {
        this.historyEmailsLoading = false;
        this.historyEmailsError = this.resolveError(err, 'Failed to load tracked emails.');
      }
    });
  }

  get sponsorSponsorshipHistory(): Sponsorship[] {
    const sponsorId = this.selectedHistorySponsor?.id;
    if (!sponsorId) {
      return [];
    }

    return this.sponsorships
      .filter(item => item.sponsorId === sponsorId)
      .sort((a, b) => {
        const aTime = this.resolveSponsorshipSortTime(a);
        const bTime = this.resolveSponsorshipSortTime(b);
        return bTime - aTime;
      });
  }

  get pagedSponsorSponsorshipHistory(): Sponsorship[] {
    const start = (this.historyCurrentPage - 1) * this.historyPageSize;
    return this.sponsorSponsorshipHistory.slice(start, start + this.historyPageSize);
  }

  get sponsorHistoryTotalPages(): number {
    return Math.max(1, Math.ceil(this.sponsorSponsorshipHistory.length / this.historyPageSize));
  }

  goToSponsorHistoryPage(page: number): void {
    if (page < 1 || page > this.sponsorHistoryTotalPages) {
      return;
    }
    this.historyCurrentPage = page;
    const pageItems = this.pagedSponsorSponsorshipHistory;
    if (!pageItems.some(item => item.id === this.selectedHistorySponsorship?.id)) {
      this.selectedHistorySponsorship = pageItems[0] || null;
    }
  }

  selectSponsorHistoryItem(item: Sponsorship): void {
    this.selectedHistorySponsorship = item;
  }

  isSponsorshipRunning(item: Sponsorship): boolean {
    if ((item.outreachDecision || '').toUpperCase() === 'DECLINED') {
      return false;
    }
    return item.status !== 'PAID';
  }

  sponsorshipRunningLabel(item: Sponsorship): 'Running' | 'Finished' {
    return this.isSponsorshipRunning(item) ? 'Running' : 'Finished';
  }

  private isSponsorshipFinished(item: Sponsorship): boolean {
    if (!item) {
      return false;
    }
    const outreachDeclined = (item.outreachDecision || '').toUpperCase() === 'DECLINED';
    return item.status === 'PAID' || outreachDeclined;
  }

  exportSponsorHistoryPdf(): void {
    const sponsorName = this.selectedHistorySponsor?.name || 'Sponsor';
    const rows = this.sponsorSponsorshipHistory.map(item => ({
      eventName: item.eventName || 'No event yet',
      statusLabel: this.statusLabel(item.status),
      runningLabel: this.sponsorshipRunningLabel(item),
      createdAtLabel: this.formatDateTime(item.createdAt)
    }));
    this.sponsorshipPdfService.generateSponsorshipHistoryPdf(sponsorName, rows);
    this.showToast('Sponsorship history PDF exported.', 'success');
  }

  closeEmailsModal(): void {
    this.showEmailsModal = false;
    this.selectedEmailSponsor = null;
    this.sponsorEmails = [];
    this.selectedEmail = null;
    this.showReplyBox = false;
    this.replyBody = '';
    this.replyFiles = [];
    this.emailTab = 'LIST';
    this.emailsError = '';
    this.composeFiles = [];
  }

  setEmailTab(tab: 'LIST' | 'COMPOSE'): void {
    this.emailTab = tab;
    this.emailsError = '';
    if (tab === 'COMPOSE') {
      this.showReplyBox = false;
    }
  }

  selectEmail(email: SponsorEmail): void {
    this.selectedEmail = email;
    this.showReplyBox = false;
    this.replyBody = '';

    if (!this.selectedEmailSponsor?.id) {
      return;
    }

    this.sponsorService.getEmail(this.selectedEmailSponsor.id, email.id).subscribe({
      next: (detailed) => {
        this.selectedEmail = detailed;
      },
      error: () => {
        this.selectedEmail = email;
      }
    });
  }

  openReplyBox(): void {
    this.showReplyBox = true;
    this.replyBody = '';
    this.replyFiles = [];
  }

  sendComposeEmail(): void {
    if (!this.selectedEmailSponsor?.id) {
      return;
    }

    const subject = this.composeForm.subject.trim();
    const body = this.composeForm.body.trim();
    if (!subject || !body) {
      this.emailsError = 'Subject and message are required.';
      return;
    }

    this.emailsSubmitting = true;
    this.emailsError = '';

    const payload: SendSponsorEmailRequest = { subject, body };
    const request$ = this.composeFiles.length > 0
      ? this.sponsorService.sendEmailWithFiles(this.selectedEmailSponsor.id, payload, this.composeFiles)
      : this.sponsorService.sendEmail(this.selectedEmailSponsor.id, payload);

    request$.subscribe({
      next: (created) => {
        this.sponsorEmails = [created, ...this.sponsorEmails];
        this.selectedEmail = created;
        this.emailTab = 'LIST';
        this.composeForm.body = '';
        this.composeFiles = [];
        this.emailsSubmitting = false;
        this.showToast(`Email sent to ${this.selectedEmailSponsor?.name}.`, 'success');
      },
      error: (err: unknown) => {
        this.emailsSubmitting = false;
        this.emailsError = this.resolveError(err, 'Failed to send email.');
      }
    });
  }

  sendReply(): void {
    if (!this.selectedEmailSponsor?.id || !this.selectedEmail?.id) {
      return;
    }

    const body = this.replyBody.trim();
    if (!body) {
      this.emailsError = 'Reply message is required.';
      return;
    }

    this.emailsSubmitting = true;
    this.emailsError = '';

    const payload: SendSponsorEmailRequest = { subject: '', body };
    const request$ = this.replyFiles.length > 0
      ? this.sponsorService.replyEmailWithFiles(this.selectedEmailSponsor.id, this.selectedEmail.id, payload, this.replyFiles)
      : this.sponsorService.replyEmail(this.selectedEmailSponsor.id, this.selectedEmail.id, payload);

    request$.subscribe({
      next: (reply) => {
        this.sponsorEmails = [reply, ...this.sponsorEmails];
        this.selectedEmail = reply;
        this.showReplyBox = false;
        this.replyBody = '';
        this.replyFiles = [];
        this.emailsSubmitting = false;
        this.showToast(`Reply sent to ${this.selectedEmailSponsor?.name}.`, 'success');
      },
      error: (err: unknown) => {
        this.emailsSubmitting = false;
        this.emailsError = this.resolveError(err, 'Failed to send reply.');
      }
    });
  }

  togglePin(email: SponsorEmail): void {
    if (!this.selectedEmailSponsor?.id || !email?.id) {
      return;
    }

    this.emailsSubmitting = true;
    this.emailsError = '';

    const request$ = email.pinned
      ? this.sponsorService.unpinEmail(this.selectedEmailSponsor.id, email.id)
      : this.sponsorService.pinEmail(this.selectedEmailSponsor.id, email.id);

    request$.subscribe({
      next: (updated) => {
        this.sponsorEmails = this.sponsorEmails.map(item => item.id === updated.id ? updated : item);
        this.selectedEmail = updated;
        this.emailsSubmitting = false;
        this.showToast(
          updated.pinned ? 'Email pinned successfully.' : 'Email unpinned successfully.',
          'success'
        );
      },
      error: (err: unknown) => {
        this.emailsSubmitting = false;
        this.emailsError = this.resolveError(err, 'Failed to update pin status.');
      }
    });
  }

  formatEmailDate(value: string | undefined): string {
    if (!value) {
      return '--';
    }
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
  }

  onComposeFilesSelected(event: Event): void {
    this.composeFiles = this.mergeFiles(this.composeFiles, this.extractValidFiles(event));
  }

  removeComposeFile(index: number): void {
    this.composeFiles = this.composeFiles.filter((_, i) => i !== index);
  }

  onReplyFilesSelected(event: Event): void {
    this.replyFiles = this.mergeFiles(this.replyFiles, this.extractValidFiles(event));
  }

  removeReplyFile(index: number): void {
    this.replyFiles = this.replyFiles.filter((_, i) => i !== index);
  }

  formatFileSize(sizeBytes: number | undefined): string {
    return this.sponsorFileUtils.formatSize(sizeBytes || 0);
  }

  openAttachmentViewer(attachments: SponsorEmailAttachment[] | undefined, index: number): void {
    if (!attachments || attachments.length === 0) {
      return;
    }
    this.viewerAttachments = attachments;
    this.viewerIndex = Math.max(0, Math.min(index, attachments.length - 1));
    this.viewerZoom = 1;
    this.showAttachmentViewer = true;
    this.loadViewerTextIfNeeded();
  }

  closeAttachmentViewer(): void {
    this.showAttachmentViewer = false;
    this.viewerAttachments = [];
    this.viewerIndex = 0;
    this.viewerZoom = 1;
    this.viewerTextContent = '';
    this.viewerTextLoading = false;
  }

  get currentViewerAttachment(): SponsorEmailAttachment | null {
    if (!this.viewerAttachments.length) {
      return null;
    }
    return this.viewerAttachments[this.viewerIndex] || null;
  }

  previousAttachment(): void {
    if (this.viewerAttachments.length === 0) {
      return;
    }
    this.viewerIndex = (this.viewerIndex - 1 + this.viewerAttachments.length) % this.viewerAttachments.length;
    this.viewerZoom = 1;
    this.loadViewerTextIfNeeded();
  }

  nextAttachment(): void {
    if (this.viewerAttachments.length === 0) {
      return;
    }
    this.viewerIndex = (this.viewerIndex + 1) % this.viewerAttachments.length;
    this.viewerZoom = 1;
    this.loadViewerTextIfNeeded();
  }

  zoomInViewer(): void {
    this.viewerZoom = Math.min(3, this.viewerZoom + 0.2);
  }

  zoomOutViewer(): void {
    this.viewerZoom = Math.max(0.6, this.viewerZoom - 0.2);
  }

  isImageAttachment(att: SponsorEmailAttachment | null): boolean {
    return !!att?.contentType?.startsWith('image/');
  }

  isPdfAttachment(att: SponsorEmailAttachment | null): boolean {
    return att?.contentType === 'application/pdf';
  }

  isTextAttachment(att: SponsorEmailAttachment | null): boolean {
    return !!att?.contentType?.startsWith('text/');
  }

  viewerTransformStyle(): string {
    const att = this.currentViewerAttachment;
    if (this.isPdfAttachment(att)) {
      return 'scale(1)';
    }
    return `scale(${this.viewerZoom})`;
  }

  safeViewerPdfUrl(att: SponsorEmailAttachment | null): SafeResourceUrl | null {
    if (!att?.fileUrl) {
      return null;
    }
    return this.sanitizer.bypassSecurityTrustResourceUrl(att.fileUrl);
  }

  directionLabel(direction: string | undefined): string {
    if ((direction || '').toUpperCase() === 'INBOUND') {
      return 'Inbound';
    }
    if ((direction || '').toUpperCase() === 'REPLY') {
      return 'Reply';
    }
    return 'Outbound';
  }

  formatDateTime(value?: string | null): string {
    if (!value) {
      return '--';
    }
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
  }

  private resolveSponsorshipSortTime(item: Sponsorship): number {
    const created = item.createdAt ? new Date(item.createdAt).getTime() : Number.NaN;
    if (!Number.isNaN(created)) {
      return created;
    }
    return item.id || 0;
  }

  private loadSponsorEmails(sponsorId: number): void {
    this.emailsLoading = true;
    this.emailsError = '';
    this.emailsSyncing = true;

    // Show cached DB emails first, then refresh in background after mailbox sync.
    this.fetchSponsorEmails(sponsorId);

    this.sponsorService.syncInboundEmails().subscribe({
      next: (synced) => {
        this.emailsSyncing = false;
        if (synced && synced.length > 0) {
          this.fetchSponsorEmails(sponsorId);
        }
      },
      error: (err: unknown) => {
        this.emailsSyncing = false;
        const reason = this.resolveError(err, 'Inbox sync failed.');
        this.showToast(`Inbox sync failed: ${reason}`, 'info');
      }
    });
  }

  private fetchSponsorEmails(sponsorId: number): void {
    const previouslySelectedId = this.selectedEmail?.id;

    this.sponsorService.getEmails(sponsorId).subscribe({
      next: (emails) => {
        this.sponsorEmails = emails;
        this.selectedEmail = emails.find(email => email.id === previouslySelectedId) || (emails.length > 0 ? emails[0] : null);
        this.emailsLoading = false;
      },
      error: (err: unknown) => {
        this.sponsorEmails = [];
        this.selectedEmail = null;
        this.emailsLoading = false;
        this.emailsError = this.resolveError(err, 'Failed to load emails.');
      }
    });
  }

  onLogoFileSelected(mode: 'add' | 'edit', event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files && input.files.length > 0 ? input.files[0] : null;
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const preview = String(reader.result || '');
      if (mode === 'add') {
        this.selectedAddLogoFile = file;
        this.addLogoPreview = preview;
      } else {
        this.selectedEditLogoFile = file;
        this.editLogoPreview = preview;
      }
    };
    reader.readAsDataURL(file);
  }

  formatJoinDate(sponsor: Sponsor): string {
    if ((sponsor.status || '').toUpperCase() !== 'CONFIRMED' || !sponsor.joinDate) {
      return '--';
    }
    return sponsor.joinDate;
  }

  onPhoneDigitsInput(mode: 'add' | 'edit', value: string): void {
    const digits = value.replace(/\D/g, '').slice(0, 8);
    if (mode === 'add') {
      this.addPhoneDigits = digits;
    } else {
      this.editPhoneDigits = digits;
    }
  }

  private buildFullPhone(code: string, digits: string): string {
    return `${code}${digits}`;
  }

  private splitPhone(phone: string): { code: string; local: string } {
    const normalized = (phone || '').replace(/\s+/g, '');
    const sortedCodes = [...this.countryCodeOptions].sort((a, b) => b.code.length - a.code.length);
    for (const option of sortedCodes) {
      if (normalized.startsWith(option.code)) {
        return {
          code: option.code,
          local: normalized.slice(option.code.length).replace(/\D/g, '').slice(0, 8)
        };
      }
    }
    return {
      code: '+216',
      local: normalized.replace(/^\+/, '').replace(/\D/g, '').slice(0, 8)
    };
  }

  private extractValidFiles(event: Event): File[] {
    const input = event.target as HTMLInputElement;
    const files = input.files ? Array.from(input.files) : [];
    const valid: File[] = [];

    for (const file of files) {
      const validation = this.sponsorFileUtils.validateFile(file);
      if (validation) {
        this.showToast(validation, 'error');
        continue;
      }
      valid.push(file);
    }

    input.value = '';
    return valid;
  }

  private mergeFiles(existing: File[], incoming: File[]): File[] {
    const merged = [...existing];
    for (const file of incoming) {
      const duplicate = merged.some(f => f.name === file.name && f.size === file.size && f.type === file.type);
      if (!duplicate) {
        merged.push(file);
      }
    }
    return merged;
  }

  private loadViewerTextIfNeeded(): void {
    const attachment = this.currentViewerAttachment;
    if (!this.isTextAttachment(attachment) || !attachment?.fileUrl) {
      this.viewerTextContent = '';
      this.viewerTextLoading = false;
      return;
    }

    this.viewerTextLoading = true;
    fetch(attachment.fileUrl)
      .then(response => response.text())
      .then(text => {
        this.viewerTextContent = text;
        this.viewerTextLoading = false;
      })
      .catch(() => {
        this.viewerTextContent = 'Failed to load text preview.';
        this.viewerTextLoading = false;
      });
  }

  private resolveError(err: unknown, fallback: string): string {
    if (err instanceof HttpErrorResponse) {
      return typeof err.error === 'string'
        ? err.error
        : (err.error?.message ?? err.message ?? fallback);
    }
    return fallback;
  }

  private showToast(message: string, type: 'success' | 'error' | 'info'): void {
    this.toastMessage = message;
    this.toastType = type;
    this.toastVisible = true;
    if (this.toastTimer) {
      clearTimeout(this.toastTimer);
    }
    this.toastTimer = setTimeout(() => {
      this.toastVisible = false;
    }, 10000);
  }
}
