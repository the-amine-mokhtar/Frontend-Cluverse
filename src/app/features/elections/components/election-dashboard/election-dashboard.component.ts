import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { forkJoin, interval, Subscription, switchMap } from 'rxjs';
import { forceCollide, forceSimulation, forceX, forceY, Simulation, SimulationNodeDatum } from 'd3';
import { ElectionService } from '../../services/election.service';
import { CandidateService } from '../../services/candidate.service';
import { VoteService } from '../../services/vote.service';
import { PositionService } from '../../services/position.service';
import { AuthHelperService } from '../../../../core/services/auth-helper.service';
import { ApiService } from '../../../../core/services/api.service';

type StatusFilter = 'ALL' | 'OPEN' | 'CLOSED' | 'ARCHIVED';

interface CandidateBubble {
  id: number;
  name: string;
  votes: number;
  share: number;
  x: number;
  y: number;
  radius: number;
  color: string;
  dots: BubbleDot[];
}

interface BubbleDot {
  x: number;
  y: number;
  color: string;
}

interface DotNode extends SimulationNodeDatum {
  bubbleIndex: number;
  centerX: number;
  centerY: number;
  radius: number;
  color: string;
}

interface MemberHierarchyLevel {
  levelName: string;
  members: any[];
}

interface CloseCandidateResult {
  candidateId: number;
  firstName: string;
  lastName: string;
  fullName: string;
  votes: number;
}

interface ElectionCloseResult {
  electionId: number;
  electionTitle: string;
  positionName: string;
  clubName: string;
  startDate: string;
  closedAt: string;
  winnerCandidateId: number;
  winnerFirstName: string;
  winnerLastName: string;
  candidates: CloseCandidateResult[];
}

@Component({
  selector: 'app-election-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './election-dashboard.component.html',
  styleUrl: './election-dashboard.component.scss'
})
export class ElectionDashboardComponent implements OnInit, OnDestroy {
  readonly statusFilters: StatusFilter[] = ['ALL', 'OPEN', 'CLOSED', 'ARCHIVED'];
  readonly bubblePalette = ['#4f46e5', '#0ea5e9', '#10b981', '#f59e0b', '#f43f5e', '#8b5cf6', '#14b8a6', '#f97316'];
  readonly roleHierarchy = ['CLUB_ADMIN', 'ADMIN', 'PRESIDENT', 'VICE_PRESIDENT', 'TREASURER', 'SECRETARY', 'HR_MANAGER', 'MEMBER'];

  clubId = 0;
  role = '';
  isAdmin = false;
  isLoading = true;
  isLoadingMembers = false;
  activeTab: 'elections' | 'members' = 'elections';
  lastSync = new Date();

  searchTerm = '';
  selectedStatus: StatusFilter = 'ALL';

  elections: any[] = [];
  candidates: any[] = [];
  votes: any[] = [];
  positions: any[] = [];

  filteredElections: any[] = [];
  selectedElection: any | null = null;

  selectedElectionCandidates: any[] = [];
  selectedElectionVotes: any[] = [];
  selectedLeaderboard: Array<any> = [];
  recentVotes: any[] = [];
  positionVoteBreakdown: Array<{ label: string; votes: number; ratio: number }> = [];

  totalVotesAll = 0;
  engagementIndex = 0;
  competitionIndex = 0;
  pulseScore = 0;

  bubbleViewWidth = 1080;
  bubbleViewHeight = 420;
  candidateBubbles: CandidateBubble[] = [];
  private bubbleSimulation: Simulation<DotNode, undefined> | null = null;
  private pollSub?: Subscription;
  private generatedResultBlob: Blob | null = null;

  // Members hierarchy
  allClubMembers: any[] = [];
  memberHierarchyLevels: MemberHierarchyLevel[] = [];
  clubName = '';
  isClosingElection = false;
  closeError = '';
  closeToast = '';
  closeToastType: 'success' | 'error' | 'info' = 'success';
  showResultModal = false;
  resultImageUrl = '';
  closeResult: ElectionCloseResult | null = null;

  constructor(
    private electionService: ElectionService,
    private candidateService: CandidateService,
    private voteService: VoteService,
    private positionService: PositionService,
    private authHelper: AuthHelperService,
    private apiService: ApiService
  ) {}

  ngOnInit(): void {
    this.role = this.authHelper.getRole().toUpperCase();
    this.isAdmin = this.role === 'ADMIN' || this.role === 'PRESIDENT';
    this.isAdmin = true;

    if (!this.isAdmin) {
      this.isLoading = false;
      return;
    }

    this.clubId = this.authHelper.getClubId();
    this.apiService.getClubById(this.clubId).subscribe({
      next: (club) => {
        this.clubName = String(club?.name || '');
      }
    });
    this.loadDashboardData();

    this.pollSub = interval(4500)
      .pipe(
        switchMap(() =>
          forkJoin({
            elections: this.electionService.getElections(this.clubId),
            candidates: this.candidateService.getCandidates(),
            votes: this.voteService.getVotes(),
            positions: this.positionService.getByClubId(this.clubId)
          })
        )
      )
      .subscribe({
        next: ({ elections, candidates, votes, positions }) => {
          this.elections = elections || [];
          this.candidates = candidates || [];
          this.votes = votes || [];
          this.positions = positions || [];
          this.lastSync = new Date();
          this.refreshViewState();
        }
      });
  }

  ngOnDestroy(): void {
    this.pollSub?.unsubscribe();
    this.bubbleSimulation?.stop();
  }

  loadDashboardData(): void {
    this.isLoading = true;
    forkJoin({
      elections: this.electionService.getElections(this.clubId),
      candidates: this.candidateService.getCandidates(),
      votes: this.voteService.getVotes(),
      positions: this.positionService.getByClubId(this.clubId)
    }).subscribe({
      next: ({ elections, candidates, votes, positions }) => {
        this.elections = elections || [];
        this.candidates = candidates || [];
        this.votes = votes || [];
        this.positions = positions || [];
        this.lastSync = new Date();
        this.refreshViewState();
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
      }
    });
  }

  get openElectionCount(): number {
    return this.elections.filter(e => String(e.status).toUpperCase() === 'OPEN').length;
  }

  get closedElectionCount(): number {
    return this.elections.filter(e => String(e.status).toUpperCase() === 'CLOSED').length;
  }

  get archivedElectionCount(): number {
    return this.elections.filter(e => String(e.status).toUpperCase() === 'ARCHIVED').length;
  }

  get totalCandidatesAll(): number {
    return this.candidates.length;
  }

  get totalPositionsAll(): number {
    return this.positions.length;
  }

  get hasSelectedElection(): boolean {
    return !!this.selectedElection;
  }

  get openRatio(): number {
    return (this.openElectionCount / Math.max(this.elections.length, 1)) * 100;
  }

  get closedRatio(): number {
    return (this.closedElectionCount / Math.max(this.elections.length, 1)) * 100;
  }

  get archivedRatio(): number {
    return (this.archivedElectionCount / Math.max(this.elections.length, 1)) * 100;
  }

  get statusCounts(): Record<StatusFilter, number> {
    return {
      ALL: this.elections.length,
      OPEN: this.openElectionCount,
      CLOSED: this.closedElectionCount,
      ARCHIVED: this.archivedElectionCount
    };
  }

  applyFilters(): void {
    const query = this.searchTerm.trim().toLowerCase();
    this.filteredElections = this.elections.filter(election => {
      const status = String(election.status || '').toUpperCase();
      const statusMatch = this.selectedStatus === 'ALL' || status === this.selectedStatus;
      const searchMatch =
        !query ||
        String(election.title || '').toLowerCase().includes(query) ||
        String(election.id || '').includes(query) ||
        String(election.status || '').toLowerCase().includes(query) ||
        String(election.position?.name || '').toLowerCase().includes(query);
      return statusMatch && searchMatch;
    });

    this.filteredElections.sort((a, b) => {
      const dateA = new Date(a.startDate || 0).getTime();
      const dateB = new Date(b.startDate || 0).getTime();
      return dateB - dateA;
    });

    if (!this.selectedElection && this.filteredElections.length) {
      this.selectElection(this.filteredElections[0]);
      return;
    }

    if (this.selectedElection) {
      const stillVisible = this.filteredElections.find(e => e.id === this.selectedElection?.id);
      if (!stillVisible && this.filteredElections.length) {
        this.selectElection(this.filteredElections[0]);
        return;
      }
      if (!stillVisible) {
        this.selectedElection = null;
        this.buildSelectedElectionInsights();
      }
    }
  }

  setStatusFilter(status: StatusFilter): void {
    this.selectedStatus = status;
    this.applyFilters();
  }

  selectElection(election: any): void {
    this.selectedElection = election;
    this.buildSelectedElectionInsights();
  }

  electionVoteCount(electionId: number): number {
    return this.votes.filter(v => this.resolveElectionId(v) === electionId).length;
  }

  electionCandidateCount(electionId: number): number {
    return this.candidates.filter(c => this.resolveElectionId(c) === electionId).length;
  }

  electionProgress(election: any): number {
    const st = String(election.status || '').toUpperCase();
    if (st === 'CLOSED' || st === 'ARCHIVED') {
      return 100;
    }
    const start = new Date(election.startDate || 0).getTime();
    const end = new Date(election.endDate || 0).getTime();
    const now = Date.now();
    if (!start || !end || end <= start) {
      return 0;
    }
    if (now <= start) {
      return 0;
    }
    if (now >= end) {
      return 100;
    }
    return Math.max(0, Math.min(100, Math.round(((now - start) / (end - start)) * 100)));
  }

  getDonutStyle(): string {
    const n = Math.max(this.elections.length, 1);
    const openSlice = Math.round((this.openElectionCount / n) * 360);
    const closedSlice = Math.round((this.closedElectionCount / n) * 360);
    const archivedSlice = Math.max(0, 360 - openSlice - closedSlice);
    return `conic-gradient(#10b981 0deg ${openSlice}deg, #f59e0b ${openSlice}deg ${openSlice + closedSlice}deg, #64748b ${openSlice + closedSlice}deg ${openSlice + closedSlice + archivedSlice}deg), radial-gradient(circle at center, transparent 48px, rgba(0,0,0,0.95) 49px)`;
  }

  electionStatusIs(election: any, status: string): boolean {
    return String(election?.status || '').toUpperCase() === status;
  }

  orbTrackBy(_: number, bubble: CandidateBubble): number {
    return bubble.id;
  }

  voteTrackBy(_: number, vote: any): number {
    return vote.id;
  }

  closeElectionManually(): void {
    if (!this.selectedElection || this.isClosingElection) {
      return;
    }

    if (!this.electionStatusIs(this.selectedElection, 'OPEN')) {
      this.showCloseToast('Only OPEN elections can be manually closed.', 'info');
      return;
    }

    this.isClosingElection = true;
    this.closeError = '';

    this.electionService.closeElection(this.selectedElection.id).subscribe({
      next: async (result: ElectionCloseResult) => {
        this.isClosingElection = false;
        this.closeResult = result;
        this.updateElectionStatusLocally(result.electionId, 'CLOSED');
        await this.generateResultGraphic(result);
        this.showResultModal = true;
        this.showCloseToast('Election closed successfully.', 'success');
        this.loadDashboardData();
      },
      error: (err) => {
        this.isClosingElection = false;
        this.closeError = err?.error?.message || err?.error?.error || 'Failed to close election.';
        this.showCloseToast(this.closeError, 'error');
      }
    });
  }

  closeResultModal(): void {
    this.showResultModal = false;
    if (this.resultImageUrl) {
      URL.revokeObjectURL(this.resultImageUrl);
      this.resultImageUrl = '';
    }
    this.generatedResultBlob = null;
  }

  shareToFacebook(): void {
    if (!this.closeResult || !this.generatedResultBlob) {
      return;
    }
    this.blobToBase64(this.generatedResultBlob).then((imageBase64) => {
      this.electionService.publishElectionResultToFacebook({
        message: this.getShareCaption(),
        imageBase64,
        privatePost: false
      }).subscribe({
        next: () => {
          this.showCloseToast('Posted publicly to Facebook page.', 'success');
        },
        error: (err) => {
          const message = err?.error?.message || 'Facebook API not configured. Opening fallback share.';
          this.showCloseToast(message, 'info');
          const quote = encodeURIComponent(this.getShareCaption());
          const url = encodeURIComponent(window.location.href);
          window.open(`https://www.facebook.com/sharer/sharer.php?u=${url}&quote=${quote}`, '_blank', 'noopener,noreferrer');
        }
      });
    }).catch(() => {
      this.showCloseToast('Could not prepare image for Facebook.', 'error');
    });
  }

  async shareToInstagram(): Promise<void> {
    if (this.generatedResultBlob && navigator.share) {
      const file = new File([this.generatedResultBlob], 'election-result.png', { type: 'image/png' });
      try {
        await navigator.share({
          title: 'Election Result',
          text: 'Election result announcement',
          files: [file]
        });
        return;
      } catch {
        // ignore and use fallback
      }
    }
    window.open('https://www.instagram.com/', '_blank', 'noopener,noreferrer');
    this.showCloseToast('Instagram opened. Upload the downloaded result image.', 'info');
  }

  async copyShareCaption(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.getShareCaption());
      this.showCloseToast('Caption copied.', 'success');
    } catch {
      this.showCloseToast('Could not copy caption.', 'error');
    }
  }

  async copyShareLink(): Promise<void> {
    try {
      await navigator.clipboard.writeText(window.location.href);
      this.showCloseToast('Link copied.', 'success');
    } catch {
      this.showCloseToast('Could not copy link.', 'error');
    }
  }

  connectFacebookMetaApp(): void {
    this.electionService.getFacebookOAuthUrl().subscribe({
      next: (response) => {
        const url = response?.url;
        if (url) {
          window.open(url, '_blank', 'noopener,noreferrer');
        } else {
          this.showCloseToast('Facebook OAuth URL is missing.', 'error');
        }
      },
      error: (err) => {
        const message = err?.error?.message || 'Meta app is not configured yet on backend.';
        this.showCloseToast(message, 'error');
      }
    });
  }

  downloadResultImage(): void {
    if (!this.resultImageUrl || !this.closeResult) {
      return;
    }
    const a = document.createElement('a');
    a.href = this.resultImageUrl;
    a.download = `election-result-${this.closeResult.electionId}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    this.showCloseToast('Image downloaded.', 'success');
  }

  getVoteTime(vote: any): Date | null {
    const value = vote?.createdAt || vote?.timestamp;
    if (!value) {
      return null;
    }
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  private refreshViewState(): void {
    if (this.selectedElection) {
      const latest = this.elections.find(e => e.id === this.selectedElection.id);
      this.selectedElection = latest || null;
    }
    this.totalVotesAll = this.votes.length;
    this.applyFilters();
    this.recomputeGlobalIndexes();
    this.buildSelectedElectionInsights();
  }

  private recomputeGlobalIndexes(): void {
    const electionsCount = Math.max(this.elections.length, 1);
    const avgVotes = this.totalVotesAll / electionsCount;
    this.engagementIndex = Math.min(100, Math.round((avgVotes / 25) * 100));

    const candidatesPerElection = this.totalCandidatesAll / electionsCount;
    this.competitionIndex = Math.min(100, Math.round((candidatesPerElection / 5) * 100));

    const pulseWeight = this.openElectionCount * 2 + this.closedElectionCount;
    this.pulseScore = Math.min(100, Math.round((pulseWeight / Math.max(electionsCount * 2, 1)) * 100));
  }

  private buildSelectedElectionInsights(): void {
    if (!this.selectedElection) {
      this.selectedElectionCandidates = [];
      this.selectedElectionVotes = [];
      this.selectedLeaderboard = [];
      this.recentVotes = [];
      this.positionVoteBreakdown = [];
      this.candidateBubbles = [];
      this.bubbleSimulation?.stop();
      this.bubbleSimulation = null;
      return;
    }

    const electionId = this.selectedElection.id;
    this.selectedElectionCandidates = this.candidates.filter(c => this.resolveElectionId(c) === electionId);
    this.selectedElectionVotes = this.votes.filter(v => this.resolveElectionId(v) === electionId);
    this.recentVotes = [...this.selectedElectionVotes]
      .sort((a, b) => new Date(b.createdAt || b.timestamp || 0).getTime() - new Date(a.createdAt || a.timestamp || 0).getTime())
      .slice(0, 8);

    const votesByCandidate = new Map<number, number>();
    this.selectedElectionVotes.forEach(vote => {
      const candidateId = this.resolveCandidateId(vote);
      if (!candidateId) {
        return;
      }
      votesByCandidate.set(candidateId, (votesByCandidate.get(candidateId) || 0) + 1);
    });

    const leaderboardSeed = this.selectedElectionCandidates.map(candidate => {
      const id = Number(candidate.id || candidate.candidateId || 0);
      const voteCount = votesByCandidate.get(id) || 0;
      const name = String(candidate.userName || candidate.name || candidate.user?.fullName || `Candidate #${id}`);
      return {
        id,
        name,
        voteCount,
        program: candidate.program || 'No program statement',
        status: candidate.status || 'ACTIVE'
      };
    });

    leaderboardSeed.sort((a, b) => b.voteCount - a.voteCount);
    const totalVotes = Math.max(this.selectedElectionVotes.length, 1);
    this.selectedLeaderboard = leaderboardSeed.map((candidate, index) => ({
      ...candidate,
      rank: index + 1,
      share: Math.round((candidate.voteCount / totalVotes) * 100),
      intensity: Math.max(8, Math.round((candidate.voteCount / totalVotes) * 100))
    }));

    const breakdown = new Map<string, number>();
    this.selectedLeaderboard.forEach(candidate => {
      const source = this.selectedElectionCandidates.find(item => Number(item.id || item.candidateId || 0) === candidate.id);
      const label = String(source?.positionName || source?.position?.name || this.selectedElection?.position?.name || 'General');
      breakdown.set(label, (breakdown.get(label) || 0) + candidate.voteCount);
    });
    this.positionVoteBreakdown = Array.from(breakdown.entries())
      .map(([label, votes]) => ({
        label,
        votes,
        ratio: totalVotes ? Math.round((votes / totalVotes) * 100) : 0
      }))
      .sort((a, b) => b.votes - a.votes);

    this.buildBubbleViewer();
  }

  private buildBubbleViewer(): void {
    this.bubbleSimulation?.stop();

    const source = this.selectedLeaderboard.slice(0, 8);
    if (!source.length) {
      this.candidateBubbles = [];
      return;
    }

    const columns = source.length > 4 ? 4 : source.length;
    const rows = Math.ceil(source.length / columns);
    const horizontalGap = this.bubbleViewWidth / (columns + 1);
    const verticalGap = this.bubbleViewHeight / (rows + 1);
    const totalVotes = Math.max(this.selectedElectionVotes.length, 1);

    this.candidateBubbles = source.map((entry, index) => {
      const row = Math.floor(index / columns);
      const col = index % columns;
      const x = horizontalGap * (col + 1);
      const y = verticalGap * (row + 1);
      const baseRadius = 48;
      const radiusScale = Math.max(0.22, entry.voteCount / totalVotes);
      const radius = Math.min(92, Math.max(baseRadius, baseRadius + radiusScale * 52));

      return {
        id: entry.id,
        name: entry.name,
        votes: entry.voteCount,
        share: entry.share,
        x,
        y,
        radius,
        color: this.bubblePalette[index % this.bubblePalette.length],
        dots: []
      };
    });

    const dotNodes: DotNode[] = [];
    this.candidateBubbles.forEach((bubble, bubbleIndex) => {
      const dotCount = bubble.votes > 0 ? Math.min(180, bubble.votes) : 1;
      for (let i = 0; i < dotCount; i += 1) {
        const angle = Math.random() * Math.PI * 2;
        const distance = Math.random() * (bubble.radius - 8);
        dotNodes.push({
          bubbleIndex,
          centerX: bubble.x,
          centerY: bubble.y,
          radius: bubble.radius - 4,
          color: bubble.color,
          x: bubble.x + Math.cos(angle) * distance,
          y: bubble.y + Math.sin(angle) * distance,
          vx: (Math.random() - 0.5) * 0.8,
          vy: (Math.random() - 0.5) * 0.8
        });
      }
    });

    this.bubbleSimulation = forceSimulation(dotNodes)
      .velocityDecay(0.08)
      .alphaDecay(0.01)
      .force('x', forceX<DotNode>(node => node.centerX).strength(0.08))
      .force('y', forceY<DotNode>(node => node.centerY).strength(0.08))
      .force('collide', forceCollide<DotNode>(2.4))
      .on('tick', () => {
        const grouped: BubbleDot[][] = this.candidateBubbles.map(() => []);
        dotNodes.forEach(node => {
          const dx = (node.x || 0) - node.centerX;
          const dy = (node.y || 0) - node.centerY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const maxDist = node.radius;
          if (dist > maxDist) {
            const ratio = maxDist / dist;
            node.x = node.centerX + dx * ratio;
            node.y = node.centerY + dy * ratio;
            node.vx = (node.vx || 0) * 0.4;
            node.vy = (node.vy || 0) * 0.4;
          }
          grouped[node.bubbleIndex].push({
            x: node.x || node.centerX,
            y: node.y || node.centerY,
            color: node.color
          });
        });
        this.candidateBubbles = this.candidateBubbles.map((bubble, index) => ({
          ...bubble,
          dots: grouped[index]
        }));
      });
  }

  private resolveElectionId(entity: any): number {
    if (!entity) {
      return 0;
    }
    return Number(entity.electionId || entity.election?.id || 0);
  }

  private resolveCandidateId(vote: any): number {
    if (!vote) {
      return 0;
    }
    return Number(vote.candidateId || vote.candidate?.id || 0);
  }

  loadClubMembers(): void {
    if (this.allClubMembers.length > 0) {
      this.buildHierarchyLevels();
      return;
    }

    this.isLoadingMembers = true;
    this.apiService.getClubMembers(this.clubId).subscribe({
      next: (members) => {
        this.allClubMembers = members || [];
        this.buildHierarchyLevels();
        this.isLoadingMembers = false;
      },
      error: (err) => {
        console.error('Error loading club members:', err);
        this.isLoadingMembers = false;
      }
    });
  }

  private buildHierarchyLevels(): void {
    const roleOrder = ['CLUB_ADMIN', 'PRESIDENT', 'VICE_PRESIDENT', 'TREASURER', 'SECRETARY', 'MEMBER', 'HR_MANAGER'];

    // Group members by role
    const membersByRole: { [key: string]: any[] } = {};
    roleOrder.forEach(role => {
      membersByRole[role] = [];
    });

    this.allClubMembers.forEach(member => {
      const role = member.role || 'MEMBER';
      if (!membersByRole[role]) {
        membersByRole[role] = [];
      }
      membersByRole[role].push(member);
    });

    // Sort each role group by name
    Object.keys(membersByRole).forEach(role => {
      membersByRole[role].sort((a, b) => {
        const nameA = `${a.firstName} ${a.lastName}`.toLowerCase();
        const nameB = `${b.firstName} ${b.lastName}`.toLowerCase();
        return nameA.localeCompare(nameB);
      });
    });

    // Build hierarchy levels
    this.memberHierarchyLevels = [];

    // Level 1: ADMIN
    if (membersByRole['CLUB_ADMIN']?.length > 0) {
      this.memberHierarchyLevels.push({
        levelName: 'Leadership',
        members: membersByRole['CLUB_ADMIN']
      });
    }

    // Level 2: PRESIDENT, VICE_PRESIDENT, TREASURER, SECRETARY
    const middleRoles = ['PRESIDENT', 'VICE_PRESIDENT', 'TREASURER', 'SECRETARY','HR_MANAGER'];
    const middleMembers: any[] = [];

    middleRoles.forEach(role => {
      if (membersByRole[role]?.length > 0) {
        middleMembers.push(...membersByRole[role]);
      }
    });

    if (middleMembers.length > 0) {
      this.memberHierarchyLevels.push({
        levelName: 'Officers',
        members: middleMembers
      });
    }

    // Level 3: MEMBER
    if (membersByRole['MEMBER']?.length > 0) {
      this.memberHierarchyLevels.push({
        levelName: 'Members',
        members: membersByRole['MEMBER']
      });
    }
  }

  private updateElectionStatusLocally(electionId: number, status: string): void {
    this.elections = this.elections.map(election =>
      election.id === electionId ? { ...election, status } : election
    );
    if (this.selectedElection?.id === electionId) {
      this.selectedElection = { ...this.selectedElection, status };
    }
    this.applyFilters();
  }

  private async generateResultGraphic(result: ElectionCloseResult): Promise<void> {
    if (this.resultImageUrl) {
      URL.revokeObjectURL(this.resultImageUrl);
      this.resultImageUrl = '';
    }

    const canvas = document.createElement('canvas');
    const width = 1180;
    const baseHeight = 1320;
    const extraRows = Math.max(0, result.candidates.length - 3);
    const height = baseHeight + extraRows * 48;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }

    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, '#0f172a');
    gradient.addColorStop(1, '#1e293b');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = '#f8fafc';
    ctx.font = '700 42px Inter, Arial';
    const club = result.clubName || this.clubName || 'Club';
    const position = result.positionName || 'Position';
    const winnerText = `${result.winnerFirstName || ''} ${result.winnerLastName || ''}`.trim();
    ctx.fillText(`${club} welcomes its new ${position} :`, 72, 120);
    ctx.font = '800 56px Inter, Arial';
    ctx.fillStyle = '#a5b4fc';
    ctx.fillText(winnerText, 72, 190);

    const start = new Date(result.startDate);
    const end = new Date();
    const days = Math.max(0, Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
    ctx.font = '600 24px Inter, Arial';
    ctx.fillStyle = '#cbd5e1';
    ctx.textAlign = 'right';
    ctx.fillText(`Duration: ${result.startDate} -> ${end.toISOString().slice(0, 10)} (${days} days)`, width - 72, 72);
    ctx.textAlign = 'left';

    const winnerCandidate = result.candidates.find(candidate => candidate.candidateId === result.winnerCandidateId);
    const winnerMeta = this.selectedElectionCandidates.find(
      candidate => Number(candidate.id || candidate.candidateId || 0) === result.winnerCandidateId
    );
    const winnerBio = String(winnerMeta?.bio || 'No bio provided.');
    const winnerProgram = String(winnerMeta?.program || 'No program provided.');
    const winnerLine = winnerCandidate ? `${winnerCandidate.fullName}` : `${result.winnerFirstName} ${result.winnerLastName}`;

    let winnerSectionY = 270;
    ctx.fillStyle = '#cbd5e1';
    ctx.font = '700 22px Inter, Arial';
    ctx.fillText('🧬 Bio', 72, winnerSectionY);
    winnerSectionY += 30;
    winnerSectionY = this.drawWrappedText(ctx, winnerBio, 72, winnerSectionY, width - 144, 27, '#e2e8f0', '500 20px Inter, Arial');

    winnerSectionY += 18;
    ctx.fillStyle = '#cbd5e1';
    ctx.font = '700 22px Inter, Arial';
    ctx.fillText('📋 Program', 72, winnerSectionY);
    winnerSectionY += 30;
    winnerSectionY = this.drawWrappedText(ctx, winnerProgram, 72, winnerSectionY, width - 144, 27, '#e2e8f0', '500 20px Inter, Arial');

    const podiumTop = Math.max(840, winnerSectionY + 240);
    const laneWidth = 220;
    const centers = [width / 2 - laneWidth, width / 2, width / 2 + laneWidth];
    const heights = [170, 240, 130];
    const order = [1, 0, 2]; // second, first, third visual order
    const colors = ['#64748b', '#f59e0b', '#94a3b8'];

    order.forEach((candidateIndex, visualIndex) => {
      const candidate = result.candidates[candidateIndex];
      const center = centers[visualIndex];
      const blockHeight = heights[visualIndex];
      const x = center - 90;
      const y = podiumTop - blockHeight;
      ctx.fillStyle = '#0b1220';
      ctx.strokeStyle = colors[visualIndex];
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(x, y, 180, blockHeight, 18);
      ctx.fill();
      ctx.stroke();

      const label = candidate
        ? `${candidate.fullName} (${candidate.votes} votes)`
        : `No candidate (0 votes)`;
      const decoratedLabel = candidate && candidateIndex === 0 ? `🏆 ${label}` : label;
      ctx.fillStyle = '#e2e8f0';
      ctx.font = '700 19px Inter, Arial';
      if (visualIndex === 0) {
        ctx.textAlign = 'right'; // second place label ends at right
        ctx.fillText(this.trimLabel(decoratedLabel, 30), x + 172, y - 18);
      } else if (visualIndex === 2) {
        ctx.textAlign = 'left'; // third place label starts at left
        ctx.fillText(this.trimLabel(decoratedLabel, 30), x + 8, y - 18);
      } else {
        ctx.textAlign = 'center';
        ctx.fillText(this.trimLabel(decoratedLabel, 30), center, y - 18);
      }

      ctx.fillStyle = colors[visualIndex];
      ctx.font = '800 44px Inter, Arial';
      ctx.textAlign = 'center';
      ctx.fillText(String(candidateIndex + 1), center, y + 54);
      ctx.textAlign = 'left';
    });

    let listY = podiumTop + 70;
    ctx.strokeStyle = 'rgba(148,163,184,0.4)';
    ctx.lineWidth = 1;
const marginTop = 2;
const marginBottom = 2;

for (let i = 3; i < result.candidates.length; i += 1) {
  const candidate = result.candidates[i];

  ctx.beginPath();
  ctx.moveTo(72, listY - 26);
  ctx.lineTo(width - 72, listY - 26);
  ctx.stroke();

  ctx.fillStyle = '#cbd5e1';
  ctx.font = '600 24px Inter, Arial';

  ctx.fillText(
    `${i + 1}. ${candidate.fullName} (${candidate.votes} votes)`,
    72,
    listY + marginTop
  );

  listY += 46 + marginTop + marginBottom;
}

    const logo = await this.loadImage('assets/logos/Logo+Nom+Slogan.png');
    if (logo) {
      const logoWidth = 360;
      const scale = logoWidth / logo.width;
      const logoHeight = logo.height * scale;
      ctx.drawImage(logo, 42, height - logoHeight - 28, logoWidth, logoHeight);
    }

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) {
      return;
    }
    this.generatedResultBlob = blob;
    this.resultImageUrl = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = this.resultImageUrl;
    a.download = `election-result-${result.electionId}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  private trimLabel(value: string, max: number): string {
    if (!value) {
      return '';
    }
    return value.length <= max ? value : `${value.slice(0, max - 1)}…`;
  }

  private getShareCaption(): string {
    if (!this.closeResult) {
      return 'Election result announcement';
    }
    const club = this.closeResult.clubName || this.clubName || 'Club';
    const position = this.closeResult.positionName || 'Position';
    const winner = `${this.closeResult.winnerFirstName} ${this.closeResult.winnerLastName}`.trim();
    return `${club} welcomes its new ${position}: ${winner}`;
  }

  private blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result;
        if (typeof result === 'string') {
          resolve(result);
        } else {
          reject(new Error('Failed to convert blob to base64.'));
        }
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  }

  private drawWrappedText(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    maxWidth: number,
    lineHeight: number,
    color: string,
    font: string
  ): number {
    ctx.fillStyle = color;
    ctx.font = font;
    const words = text.split(' ');
    let line = '';
    let cursorY = y;

    for (let i = 0; i < words.length; i += 1) {
      const testLine = line ? `${line} ${words[i]}` : words[i];
      if (ctx.measureText(testLine).width > maxWidth && line) {
        ctx.fillText(line, x, cursorY);
        line = words[i];
        cursorY += lineHeight;
      } else {
        line = testLine;
      }
    }
    if (line) {
      ctx.fillText(line, x, cursorY);
    }
    return cursorY + lineHeight;
  }

  private loadImage(src: string): Promise<HTMLImageElement | null> {
    return new Promise((resolve) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => resolve(null);
      image.src = src;
    });
  }

  private showCloseToast(message: string, type: 'success' | 'error' | 'info'): void {
    this.closeToast = message;
    this.closeToastType = type;
    setTimeout(() => {
      if (this.closeToast === message) {
        this.closeToast = '';
      }
    }, 3200);
  }
}
