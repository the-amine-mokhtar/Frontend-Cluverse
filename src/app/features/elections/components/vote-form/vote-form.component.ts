import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { VoteService } from '../../services/vote.service';
import { ElectionService } from '../../services/election.service';
import { CandidateService } from '../../services/candidate.service';
import { AuthHelperService } from '../../../../core/services/auth-helper.service';
import { catchError, forkJoin, of } from 'rxjs';

interface PieSlice {
  index: number;
  label: string;
  sublabel: string;
  path: string;
  labelX: number;
  labelY: number;
  color: string;
  startAngle: number;
  endAngle: number;
  percentage: number;
  voted: boolean;
  data: any;
}

@Component({
  selector: 'app-vote-form',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './vote-form.component.html',
  styleUrls: ['./vote-form.component.scss']
})
export class VoteFormComponent implements OnInit, OnDestroy {
  readonly palette = ['#7c3aed', '#2563eb', '#06b6d4', '#10b981', '#f59e0b', '#f43f5e', '#8b5cf6', '#14b8a6'];
  readonly cx = 250;
  readonly cy = 250;
  readonly radius = 200;
  readonly innerRadius = 56;

  view: 'elections' | 'candidates' = 'elections';
  animState: 'visible' | 'fading-out' | 'fading-in' = 'visible';

  elections: any[] = [];
  candidates: any[] = [];
  slices: PieSlice[] = [];

  selectedElection: any = null;
  selectedCandidate: any = null;
  hoveredIndex: number = -1;
  userVote: any = null; // current user's vote for selected election
  votedElectionIds = new Set<string>();

  errorMessage = '';
  isSubmitting = false;
  currentUserId = 0;
  toastMessage = '';
  toastType: 'success' | 'error' | 'info' = 'success';
  toastVisible = false;
  private toastTimer?: ReturnType<typeof setTimeout>;

  constructor(
    private voteService: VoteService,
    private electionService: ElectionService,
    private candidateService: CandidateService,
    private authHelper: AuthHelperService
  ) {}

  ngOnInit(): void {
    this.currentUserId = this.authHelper.getUserId();
    this.loadElections();
  }

  ngOnDestroy(): void {
    if (this.toastTimer) {
      clearTimeout(this.toastTimer);
    }
  }

  // ─── Data Loading ────────────────────────────────────────

  loadElections(): void {
    const clubId = this.authHelper.getClubId();
    this.electionService.getElections(clubId).subscribe({
      next: (data) => {
        this.elections = (data || []).filter((e: any) => e.status === 'OPEN');
        this.loadElectionVoteFlags();
      },
      error: () => this.errorMessage = 'Failed to load elections'
    });
  }

  loadCandidates(electionId: number): void {
    this.candidateService.getCandidates(electionId).subscribe({
      next: (data) => {
        this.candidates = data || [];
        this.loadMyVote(electionId);
      },
      error: () => this.errorMessage = 'Failed to load candidates'
    });
  }

  private loadElectionVoteFlags(): void {
    if (!this.elections.length) {
      this.votedElectionIds = new Set<string>();
      this.buildElectionSlices();
      return;
    }

    const voteRequests = this.elections.map((election: any) =>
      this.voteService.getMyVote(election.id).pipe(
        catchError(() => of(null))
      )
    );

    forkJoin(voteRequests).subscribe({
      next: (votes) => {
        const votedIds = new Set<string>();
        votes.forEach((vote: any, index: number) => {
          if (vote) {
            votedIds.add(String(this.elections[index]?.id));
          }
        });
        this.votedElectionIds = votedIds;
        this.buildElectionSlices();
      },
      error: () => {
        this.votedElectionIds = new Set<string>();
        this.buildElectionSlices();
      }
    });
  }

  loadMyVote(electionId: number): void {
    this.voteService.getMyVote(electionId).subscribe({
      next: (vote) => {
        this.userVote = vote;
        this.buildCandidateSlices();
      },
      error: () => {
        this.userVote = null;
        this.buildCandidateSlices();
      }
    });
  }

  // ─── Pie Slice Building ──────────────────────────────────

  buildElectionSlices(): void {
    const items = this.elections;
    if (!items.length) { this.slices = []; return; }
    this.slices = this.computeSlices(
      items,
      (e) => e.title || `Election ${e.id}`,
      (e) => e.position?.name || '',
      (e) => this.votedElectionIds.has(String(e.id))
    );
  }

  buildCandidateSlices(): void {
    const items = this.candidates;
    if (!items.length) { this.slices = []; return; }
    const votedCandidateId = this.userVote?.candidate?.id;
    this.slices = this.computeSlices(
      items,
      (c) => c.userName || `Candidate ${c.id}`,
      () => '',
      (c) => c.id === votedCandidateId
    );
  }

  private computeSlices(
    items: any[],
    labelFn: (item: any) => string,
    sublabelFn: (item: any) => string,
    votedFn: (item: any) => boolean
  ): PieSlice[] {
    const count = items.length;
    const basePercentage = 100 / count;
    const hovered = this.hoveredIndex;
    let percentages: number[];

    if (hovered >= 0 && hovered < count) {
      const expandedPct = Math.max(40, basePercentage);
      if (count === 1) {
        percentages = [100];
      } else {
        const remainingPct = 100 - expandedPct;
        const otherPct = remainingPct / (count - 1);
        percentages = items.map((_, i) => i === hovered ? expandedPct : otherPct);
      }
    } else {
      percentages = items.map(() => basePercentage);
    }

    const slices: PieSlice[] = [];
    let currentAngle = -90; // start at top

    for (let i = 0; i < count; i++) {
      const pct = percentages[i];
      const angleSpan = (pct / 100) * 360;
      const startAngle = currentAngle;
      const endAngle = currentAngle + angleSpan;
      const midAngle = startAngle + angleSpan / 2;
      const midRad = (midAngle * Math.PI) / 180;
      const labelDist = this.radius * 0.62;

      slices.push({
        index: i,
        label: labelFn(items[i]),
        sublabel: sublabelFn(items[i]),
        path: this.describeArc(this.cx, this.cy, this.radius, startAngle, endAngle),
        labelX: this.cx + Math.cos(midRad) * labelDist,
        labelY: this.cy + Math.sin(midRad) * labelDist,
        color: this.palette[i % this.palette.length],
        startAngle,
        endAngle,
        percentage: pct,
        voted: votedFn(items[i]),
        data: items[i]
      });
      currentAngle = endAngle;
    }
    return slices;
  }

  // ─── SVG Arc Utility ─────────────────────────────────────

  private describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number): string {
    const start = this.polarToCartesian(cx, cy, r, endAngle);
    const end = this.polarToCartesian(cx, cy, r, startAngle);
    const largeArc = endAngle - startAngle > 180 ? 1 : 0;
    return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y} Z`;
  }

  private polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
    const rad = (angleDeg * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  }

  // ─── Interactions ────────────────────────────────────────

  onSliceHover(index: number): void {
    this.hoveredIndex = index;
    if (this.view === 'elections') {
      this.buildElectionSlices();
    } else {
      this.buildCandidateSlices();
    }
  }

  onSliceLeave(): void {
    this.hoveredIndex = -1;
    if (this.view === 'elections') {
      this.buildElectionSlices();
    } else {
      this.buildCandidateSlices();
    }
  }

  onSliceClick(index: number): void {
    if (this.view === 'elections') {
      this.selectElection(this.elections[index]);
    } else {
      this.selectCandidate(this.candidates[index]);
    }
  }

  selectElection(election: any): void {
    this.selectedElection = election;
    this.selectedCandidate = null;
    this.hoveredIndex = -1;
    this.errorMessage = '';

    // Fade out elections, then load + show candidates
    this.animState = 'fading-out';
    setTimeout(() => {
      this.view = 'candidates';
      this.loadCandidates(election.id);
      this.animState = 'fading-in';
      setTimeout(() => this.animState = 'visible', 400);
    }, 350);
  }

  goBackToElections(): void {
    this.selectedCandidate = null;
    this.hoveredIndex = -1;
    this.errorMessage = '';

    this.animState = 'fading-out';
    setTimeout(() => {
      this.view = 'elections';
      this.selectedElection = null;
      this.userVote = null;
      this.buildElectionSlices();
      this.animState = 'fading-in';
      setTimeout(() => this.animState = 'visible', 400);
    }, 350);
  }

  selectCandidate(candidate: any): void {
    this.selectedCandidate = candidate;
    this.errorMessage = '';
  }

  // ─── Vote Logic ──────────────────────────────────────────

  get voteButtonLabel(): string {
    if (!this.userVote) return 'Vote';
    if (this.userVote.candidate?.id === this.selectedCandidate?.id) return 'Remove Vote';
    return 'Change Vote';
  }

  get voteButtonClass(): string {
    if (!this.userVote) return 'vote-pie__action-btn--vote';
    if (this.userVote.candidate?.id === this.selectedCandidate?.id) return 'vote-pie__action-btn--cancel';
    return 'vote-pie__action-btn--change';
  }

  onVoteAction(): void {
    if (!this.selectedCandidate || !this.selectedElection || this.isSubmitting) return;

    this.isSubmitting = true;
    this.errorMessage = '';

    if (!this.userVote) {
      // Cast new vote
      const payload = { electionId: this.selectedElection.id, candidateId: this.selectedCandidate.id };
      this.voteService.castVote(payload).subscribe({
        next: () => this.afterVoteAction(),
        error: (err) => this.handleVoteError(err)
      });
    } else if (this.userVote.candidate?.id === this.selectedCandidate.id) {
      // Cancel vote
      this.voteService.delete(this.userVote.id).subscribe({
        next: () => this.afterVoteAction(),
        error: (err) => this.handleVoteError(err)
      });
    } else {
      // Change vote
      const payload = { electionId: this.selectedElection.id, candidateId: this.selectedCandidate.id };
      this.voteService.update(this.userVote.id, payload).subscribe({
        next: () => this.afterVoteAction(),
        error: (err) => this.handleVoteError(err)
      });
    }
  }

  private afterVoteAction(): void {
    this.isSubmitting = false;
    if (!this.userVote) {
      this.showToast('Vote submitted successfully.', 'success');
    } else if (this.userVote.candidate?.id === this.selectedCandidate?.id) {
      this.showToast('Vote removed successfully.', 'info');
    } else {
      this.showToast('Vote changed successfully.', 'success');
    }
    this.loadElectionVoteFlags();
    this.loadMyVote(this.selectedElection.id);
  }

  private handleVoteError(err: any): void {
    this.isSubmitting = false;
    this.errorMessage = err.error?.message || 'Vote action failed.';
    this.showToast(this.errorMessage, 'error');
  }

  private showToast(message: string, type: 'success' | 'error' | 'info' = 'success'): void {
    this.toastMessage = message;
    this.toastType = type;
    this.toastVisible = true;
    if (this.toastTimer) {
      clearTimeout(this.toastTimer);
    }
    this.toastTimer = setTimeout(() => {
      this.toastVisible = false;
    }, 3200);
  }

  // ─── Helpers ─────────────────────────────────────────────

  getInitials(name: string): string {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return parts[0][0].toUpperCase();
  }

  getCandidateStatusLabel(status: string): string {
    if (!status) return 'Unknown';
    return status.charAt(0) + status.slice(1).toLowerCase();
  }
}
