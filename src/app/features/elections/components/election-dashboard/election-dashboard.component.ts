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

  // Members hierarchy
  allClubMembers: any[] = [];
  memberHierarchyLevels: MemberHierarchyLevel[] = [];

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
}
