import { Component, OnInit } from '@angular/core';
import {
  ApiService,
  CompetencyMatchCandidateResponse,
  CompetencyMatchingRequest,
  CompetencyMatchingResponse,
  CompetencyResponse,
  MemberCompetencyResponse
} from '../../../../core/services/api.service';
import { AuthHelperService } from '../../../../core/services/auth-helper.service';

type SkillInsight = {
  skillId: number;
  skillName: string;
  category: CompetencyResponse['category'];
  assignedCount: number;
  averageGap: number;
  maxGap: number;
};

type MemberInsight = {
  userId: number;
  memberName: string;
  assignedCount: number;
  averageGap: number;
  maxGap: number;
  readyCount: number;
};

type BreakdownRow = {
  label: string;
  count: number;
  percent: number;
  tone: 'accent' | 'success' | 'warning' | 'danger';
};

@Component({
  selector: 'app-competencies-insights',
  templateUrl: './competencies-insights.component.html',
  styleUrls: ['./competencies-insights.component.scss']
})
export class CompetenciesInsightsComponent implements OnInit {
  readonly matchingContexts: Array<'MISSION' | 'EVENT' | 'POSITION'> = ['MISSION', 'EVENT', 'POSITION'];

  clubId = 0;
  loading = false;
  matchingLoading = false;
  errorMessage = '';
  matchingError = '';

  members: Array<{ userId: number; firstName?: string; lastName?: string; email?: string }> = [];
  competencies: CompetencyResponse[] = [];
  memberCompetencies: MemberCompetencyResponse[] = [];

  matchingContextType: 'MISSION' | 'EVENT' | 'POSITION' = 'MISSION';
  matchingContextTitle = '';
  topN = 5;
  selectedSkillIds: number[] = [];
  matchingResult: CompetencyMatchingResponse | null = null;

  totalMembers = 0;
  totalSkills = 0;
  totalAssignments = 0;
  readyAssignments = 0;
  averageGap = 0;
  criticalAssignments = 0;

  topSkillGaps: SkillInsight[] = [];
  topMemberGaps: MemberInsight[] = [];
  strongestMembers: MemberInsight[] = [];

  constructor(
    private readonly apiService: ApiService,
    private readonly authHelperService: AuthHelperService
  ) {}

  ngOnInit(): void {
    this.clubId = this.authHelperService.getClubId();
    if (!this.clubId) {
      this.errorMessage = 'Club introuvable. Reconnecte-toi puis reessaie.';
      return;
    }

    this.loadData();
  }

  loadData(): void {
    this.loading = true;
    this.errorMessage = '';

    this.apiService.getClubMembers(this.clubId).subscribe({
      next: (members) => {
        this.members = (members ?? []).map((member: any) => ({
          userId: Number(member.userId ?? member.id ?? 0),
          firstName: member.firstName,
          lastName: member.lastName,
          email: member.email
        })).filter((member: { userId: number }) => member.userId > 0);
        this.loadCompetencies();
      },
      error: () => {
        this.errorMessage = 'Impossible de charger les membres du club.';
        this.loading = false;
      }
    });
  }

  loadCompetencies(): void {
    this.apiService.getCompetencies(this.clubId).subscribe({
      next: (competencies) => {
        this.competencies = competencies ?? [];
        this.loadMemberCompetencies();
      },
      error: () => {
        this.errorMessage = 'Impossible de charger les competencies.';
        this.loading = false;
      }
    });
  }

  loadMemberCompetencies(): void {
    this.apiService.getMemberCompetenciesByClub(this.clubId).subscribe({
      next: (items) => {
        this.memberCompetencies = items ?? [];
        this.computeInsights();
        this.loading = false;
      },
      error: () => {
        this.errorMessage = 'Impossible de charger les insights.';
        this.loading = false;
      }
    });
  }

  refresh(): void {
    this.loadData();
  }

  toggleSkillSelection(skillId: number): void {
    if (this.selectedSkillIds.includes(skillId)) {
      this.selectedSkillIds = this.selectedSkillIds.filter(id => id !== skillId);
      return;
    }
    this.selectedSkillIds = [...this.selectedSkillIds, skillId];
  }

  isSkillSelected(skillId: number): boolean {
    return this.selectedSkillIds.includes(skillId);
  }

  runMatching(): void {
    if (this.selectedSkillIds.length === 0) {
      this.matchingError = 'Selectionne au moins une competence requise.';
      return;
    }

    this.matchingLoading = true;
    this.matchingError = '';

    const payload: CompetencyMatchingRequest = {
      clubId: this.clubId,
      contextType: this.matchingContextType,
      contextTitle: this.matchingContextTitle?.trim(),
      requiredSkillIds: this.selectedSkillIds,
      topN: Math.max(1, Math.min(this.topN || 5, 20))
    };

    this.apiService.getCompetencyMatching(payload).subscribe({
      next: (result) => {
        this.matchingResult = result;
        this.matchingLoading = false;
      },
      error: () => {
        this.matchingError = 'Impossible de generer le matching intelligent.';
        this.matchingLoading = false;
      }
    });
  }

  resetMatching(): void {
    this.matchingContextType = 'MISSION';
    this.matchingContextTitle = '';
    this.topN = 5;
    this.selectedSkillIds = [];
    this.matchingResult = null;
    this.matchingError = '';
  }

  candidateScoreClass(candidate: CompetencyMatchCandidateResponse): string {
    if (candidate.score >= 75) return 'badge badge--success';
    if (candidate.score >= 50) return 'badge badge--warning';
    return 'badge badge--danger';
  }

  getMemberLabel(userId: number): string {
    const normalizedUserId = Number(userId);
    const member = this.members.find(item => Number(item.userId) === normalizedUserId);
    if (!member) {
      return `User #${normalizedUserId}`;
    }

    return [member.firstName, member.lastName].filter(Boolean).join(' ') || member.email || `User #${normalizedUserId}`;
  }

  levelClass(gap: number): string {
    if (gap <= 0) return 'badge badge--success';
    if (gap <= 15) return 'badge badge--warning';
    return 'badge badge--danger';
  }

  progressWidth(gap: number): number {
    return Math.min(gap * 4, 100);
  }

  get competencyBreakdown(): BreakdownRow[] {
    const total = Math.max(this.totalSkills, 1);
    const technical = this.competencies.filter(item => item.category === 'TECHNICAL').length;
    const hard = this.competencies.filter(item => item.category === 'HARD').length;
    const soft = this.competencies.filter(item => item.category === 'SOFT').length;

    return [
      { label: 'Technical', count: technical, percent: Math.round((technical / total) * 100), tone: 'accent' },
      { label: 'Hard', count: hard, percent: Math.round((hard / total) * 100), tone: 'warning' },
      { label: 'Soft', count: soft, percent: Math.round((soft / total) * 100), tone: 'success' }
    ];
  }

  get readinessBreakdown(): BreakdownRow[] {
    const total = Math.max(this.totalAssignments, 1);
    const ready = this.readyAssignments;
    const critical = this.criticalAssignments;
    const review = Math.max(this.totalAssignments - ready - critical, 0);

    return [
      { label: 'Ready', count: ready, percent: Math.round((ready / total) * 100), tone: 'success' },
      { label: 'Review', count: review, percent: Math.round((review / total) * 100), tone: 'warning' },
      { label: 'Critical', count: critical, percent: Math.round((critical / total) * 100), tone: 'danger' }
    ];
  }

  private computeInsights(): void {
    this.totalMembers = new Set(this.members.map(member => member.userId)).size;
    this.totalSkills = this.competencies.length;
    this.totalAssignments = this.memberCompetencies.length;

    const positiveGaps = this.memberCompetencies.map(item => Math.max(item.gap ?? (item.targetLevel - item.currentLevel), 0));
    this.readyAssignments = this.memberCompetencies.filter(item => (item.gap ?? (item.targetLevel - item.currentLevel)) <= 0).length;
    this.criticalAssignments = this.memberCompetencies.filter(item => (item.gap ?? (item.targetLevel - item.currentLevel)) >= 20).length;
    this.averageGap = positiveGaps.length
      ? Math.round((positiveGaps.reduce((sum, value) => sum + value, 0) / positiveGaps.length) * 10) / 10
      : 0;

    const skillMap = new Map<number, { gaps: number[]; count: number }>();
    for (const item of this.memberCompetencies) {
      const gap = Math.max(item.gap ?? (item.targetLevel - item.currentLevel), 0);
      const current = skillMap.get(item.skillId) ?? { gaps: [], count: 0 };
      current.gaps.push(gap);
      current.count += 1;
      skillMap.set(item.skillId, current);
    }

    this.topSkillGaps = Array.from(skillMap.entries())
      .map(([skillId, data]) => {
        const competency = this.competencies.find(item => item.id === skillId);
        const averageGap = data.gaps.length
          ? Math.round((data.gaps.reduce((sum, value) => sum + value, 0) / data.gaps.length) * 10) / 10
          : 0;
        const maxGap = data.gaps.length ? Math.max(...data.gaps) : 0;

        return {
          skillId,
          skillName: competency?.name ?? `Skill #${skillId}`,
          category: competency?.category ?? 'TECHNICAL',
          assignedCount: data.count,
          averageGap,
          maxGap
        };
      })
      .sort((left, right) => right.averageGap - left.averageGap)
      .slice(0, 5);

    const memberMap = new Map<number, { gaps: number[]; readyCount: number; count: number }>();
    for (const item of this.memberCompetencies) {
      const gap = Math.max(item.gap ?? (item.targetLevel - item.currentLevel), 0);
      const current = memberMap.get(item.userId) ?? { gaps: [], readyCount: 0, count: 0 };
      current.gaps.push(gap);
      current.count += 1;
      if (gap <= 0) {
        current.readyCount += 1;
      }
      memberMap.set(item.userId, current);
    }

    this.topMemberGaps = Array.from(memberMap.entries())
      .map(([userId, data]) => {
        const averageGap = data.gaps.length
          ? Math.round((data.gaps.reduce((sum, value) => sum + value, 0) / data.gaps.length) * 10) / 10
          : 0;
        const maxGap = data.gaps.length ? Math.max(...data.gaps) : 0;
        return {
          userId,
          memberName: this.getMemberLabel(userId),
          assignedCount: data.count,
          averageGap,
          maxGap,
          readyCount: data.readyCount
        };
      })
      .sort((left, right) => right.averageGap - left.averageGap)
      .slice(0, 5);

    this.strongestMembers = [...this.topMemberGaps]
      .sort((left, right) => right.readyCount - left.readyCount || left.averageGap - right.averageGap)
      .slice(0, 5);
  }
}
