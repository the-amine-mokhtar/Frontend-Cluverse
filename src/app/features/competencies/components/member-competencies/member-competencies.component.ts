import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Chart, registerables, ChartConfiguration, ChartData, ChartType } from 'chart.js';

Chart.register(...registerables);

import {
  ApiService,
  ClubCompetencyStats,
  CompetencyResponse,
  MemberCompetencyRequest,
  MemberCompetencyResponse,
  MemberCompetencyUpdateRequest,
  SpeechAnalyzerHealthResponse,
  CompetencySessionResponse,
  QuizResponse,
  MemberCompetencySessionsResponse,
  LevelUpdateRequest,
  LearningPathResponse,
  LearningResource
} from '../../../../core/services/api.service';
import { AuthHelperService } from '../../../../core/services/auth-helper.service';
import { ConfettiService } from '../../services/confetti.service';
import { WebSocketService } from '../../../../core/services/websocket.service';
import { environment } from '../../../../../environments/environment';
import { Subscription } from 'rxjs';

type LearningState = 'done' | 'active' | 'locked';

interface SkillTip {
  id: number;
  skillName: string;
  current: number;
  target: number;
  progress: number;
  tip: string;
  category: string;
}

interface LearningStep {
  id: number;
  title: string;
  progress: number;
  state: LearningState;
  summary: string;
  skillName: string;
  current: number;
  category: string;
  // Option A: Estimation de temps + Conseils
  estimatedHours: number;
  personalizedAdvice: string;
  // Option B: Milestones + Impact
  milestones: { level: number; completed: boolean }[];
  impactScore: number;
  completionDate: Date;
  target: number;
}

interface MemberBadge {
  id: string;
  title: string;
  icon: string;
  unlocked: boolean;
  hint: string;
}

interface SpeechSessionSummary {
  status: string;
  score: number;
  level: string;
  confidence: number;
  pace: number;
  feedback: string;
  updatedAt: string;
}

interface ActivityItem {
  id: string;
  type: 'level-up' | 'endorsement' | 'quiz-passed' | 'speech-sync' | 'badge-unlocked';
  title: string;
  description: string;
  skillName?: string;
  timestamp: Date;
  icon: string;
  iconColor: string;
}

interface Goal {
  id: string;
  type: 'weekly' | 'monthly';
  category: 'skills' | 'speech' | 'endorsements' | 'readiness';
  target: number;
  current: number;
  unit: string;
  deadline: Date;
  completed: boolean;
}

interface AIInsight {
  type: 'encouragement' | 'warning' | 'suggestion' | 'neutral';
  title: string;
  message: string;
  actionableTip?: string;
  icon: string;
  iconColor: string;
}

interface MentorshipSuggestion {
  id: string;
  mentorId: string;
  mentorName: string;
  mentorSkill: string;
  mentorLevel: number;
  menteeId: string;
  menteeName: string;
  menteeSkill: string;
  menteeLevel: number;
  matchScore: number;
  reason: string;
}

@Component({
  selector: 'app-member-competencies',
  templateUrl: './member-competencies.component.html',
  styleUrls: ['./member-competencies.component.scss']
})
export class MemberCompetenciesComponent implements OnInit, OnDestroy {
  private readonly speechAnalyzerHttpBase = environment.apiUrl;
  
  // Chart.js Radar Properties
  public radarChartOptions: ChartConfiguration['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      r: {
        min: 0,
        max: 5,
        ticks: { 
          stepSize: 1, 
          display: true,
          font: { size: 10, family: 'Inter, system-ui, sans-serif', weight: 500 },
          color: '#94a3b8',
          backdropColor: 'transparent'
        },
        pointLabels: {
          font: { size: 12, family: 'Inter, system-ui, sans-serif', weight: 700 },
          color: '#1e293b',
          padding: 15
        },
        grid: { 
          color: 'rgba(148, 163, 184, 0.15)',
          lineWidth: 1
        },
        angleLines: { 
          color: 'rgba(148, 163, 184, 0.15)',
          lineWidth: 1
        }
      }
    },
    plugins: {
      legend: { 
        position: 'bottom', 
        labels: { 
          usePointStyle: true, 
          boxWidth: 10, 
          padding: 20,
          font: { size: 12, family: 'Inter, sans-serif', weight: 600 },
          color: '#475569'
        } 
      },
      tooltip: {
        backgroundColor: 'rgba(30, 41, 59, 0.95)',
        padding: 16,
        titleFont: { size: 14, family: 'Inter, sans-serif', weight: 700 },
        bodyFont: { size: 13, family: 'Inter, sans-serif' },
        cornerRadius: 12,
        displayColors: true,
        boxWidth: 12,
        boxPadding: 6
      }
    },
    animation: {
      duration: 1000,
      easing: 'easeOutQuart'
    }
  };
  public radarChartType: ChartType = 'radar';
  public radarChartData: ChartData<'radar'> = { labels: [], datasets: [] };

  // Optimized Data Properties
  public filteredPersonalCompetencies: MemberCompetencyResponse[] = [];
  public totalSkillsCount: number = 0;
  public averageCurrentLevel: number = 0;
  public averageTargetLevel: number = 0;
  public averageGapLevel: number = 0;
  public readinessScore: number = 0;

  private readonly speechFlushIntervalMs = 2500;
  private readonly speechMinChunkSeconds = 1.4;
  private readonly transcriptHistoryLimit = 12;
  private speechSocket: WebSocket | null = null;
  private speechStream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private processorNode: ScriptProcessorNode | null = null;
  private silenceGainNode: GainNode | null = null;
  private pcmChunks: Float32Array[] = [];
  private pcmSamples = 0;
  private pcmFlushTimer: number | null = null;
  private recentTranscriptChunks: string[] = [];

  clubId = 0;
  loading = false;
  saving = false;
  selectedMemberUserId = 0;
  currentUserId = 0;
  currentUserFullName = '';
  userRole = '';
  isMemberRole = false;

  members: Array<{ userId: number; firstName?: string; lastName?: string; email?: string }> = [];
  competencies: CompetencyResponse[] = [];
  memberCompetencies: MemberCompetencyResponse[] = [];
  clubStats: ClubCompetencyStats | null = null;

  editingId: number | null = null;
  speechSyncingId: number | null = null;
  errorMessage = '';
  successMessage = '';
  speechHealthStatus = '';
  speechHealthModel = '';
  speechSessionIds: Record<number, string> = {};
  globalSpeechSessionId = '';
  selectedSpeechMemberCompetencyId = 0;
  speechTestFeedback = '';
  speechTopic = '';
  liveTranscript = '';
  liveScore = 0;
  liveLevel = 'BEGINNER';
  liveSocketState = 'idle';
  isRecordingSpeech = false;
  liveSpeechRate = 0;
  livePausesPerMinute = 0;
  liveFillersPerMinute = 0;
  liveConfidence = 0;
  syncProgress = 0;
  private syncProgressInterval: number | null = null;
  public isAnalyzingCV: boolean = false;
  showCVAnalysisModal = false;
  cvAnalysisResults: any = null;
  analyzedFileName = '';
  activeTab: 'overview' | 'inventory' | 'path' | 'mentorship' = 'overview';
  inventoryViewMode: 'grid' | 'list' = 'grid';
  inventoryCategoryFilter: 'ALL' | 'SOFT' | 'HARD' | 'TECHNICAL' = 'ALL';
  inventoryCurrentPage = 1;
  inventoryItemsPerPage = 4;
  generatedResources: { [stepId: number]: LearningResource[] } = {};
  isGeneratingResources: { [stepId: number]: boolean } = {};
  estimatedTimes: { [stepId: number]: string } = {};
  selectedStepForStudy: LearningStep | null = null;
  showStudyCenter = false;

  // Gap Analysis Chart
  gapChartData: any = { labels: [], datasets: [] };
  gapChartOptions: any = {
    indexAxis: 'y',
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { min: 0, max: 5, grid: { display: false } },
      y: { grid: { display: false } }
    }
  };

  readonly randomTopics = [
    'Introduce yourself in 60 seconds and explain your ideal role in the club.',
    'Tell us about a situation where you solved a difficult problem in a team.',
    'Advocate for an innovative idea to improve member engagement.',
    'How would you handle a conflict between two department heads?',
    'Pitch a concrete mini-project to launch this month in your club.'
  ];

  readonly form = this.fb.nonNullable.group({
    userId: [0, [Validators.required, Validators.min(1)]],
    skillId: [0, [Validators.required, Validators.min(1)]],
    currentLevel: [0, [Validators.required, Validators.min(0), Validators.max(5)]],
    targetLevel: [0, [Validators.required, Validators.min(0), Validators.max(5)]]
  });

  readonly editForm = this.fb.nonNullable.group({
    currentLevel: [0, [Validators.required, Validators.min(0), Validators.max(5)]],
    targetLevel: [0, [Validators.required, Validators.min(0), Validators.max(5)]]
  });

  public showSessionsModal = false;
  public isSessionsLoading = false;
  public selectedStepForSessions: LearningStep | null = null;
  public stepSessions: CompetencySessionResponse[] = [];

  public showQuizModal = false;
  public isQuizLoading = false;
  public currentQuiz: QuizResponse | null = null;
  public quizAnswers: (number | null)[] = [];
  public currentQuizQuestionIndex = 0;
  public showQuizReview = false;
  public quizResult: { score: number; oldLevel: number; newLevel: number } | null = null;

  // Study Corner State
  public studyTab: 'curriculum' | 'notes' | 'ai' = 'curriculum';
  public isSavingNotes = false;
  public studyNotes = '';
  public studyChecklist: { text: string; done: boolean }[] = [];
  public pomodoroSeconds = 25 * 60;
  public pomodoroRunning = false;
  private pomodoroInterval: any;

  private allMemberSessions: CompetencySessionResponse[] = [];

  // Level up animation state
  public glowingBadgeId: string | null = null;
  public isLevelUpCelebration: boolean = false;

  // Recent Activity
  public recentActivities: ActivityItem[] = [];

  // Goals Tracking
  public goals: Goal[] = [];

  // AI Insight
  public aiInsight: AIInsight | null = null;

  // Mentorship Suggestions
  public mentorshipSuggestions: MentorshipSuggestion[] = [];
  public showMentorshipPanel: boolean = false;
  public selectedMentorshipSuggestion: MentorshipSuggestion | null = null;
  public mentorshipMessages: { sender: string; message: string; timestamp: Date; senderId?: number }[] = [];
  public newMentorshipMessage: string = '';
  public currentConversationId: number | null = null;
  public activeConversations: any[] = [];
  public showSessionRequestModal: boolean = false;
  public showSessionResponseModal: boolean = false;
  public pendingSessionRequest: any = null;
  public isSubmittingRequest: boolean = false;
  public isResponding: boolean = false;
  public sessionRequestForm: FormGroup;
  public sessionResponseForm: FormGroup;
  public minDateTime: string;
  public pendingSessionRequests: any[] = [];
  public showFeedbackModal: boolean = false;
  public feedbackForm: FormGroup;
  public isSubmittingFeedback: boolean = false;
  public showGoalsModal: boolean = false;
  public showCertificateModal: boolean = false;
  public conversationGoals: any[] = [];
  public conversationCertificate: any = null;
  public newGoalTitle: string = '';
  public newGoalDescription: string = '';
  private wsSubscription: Subscription | null = null;

  constructor(
    private readonly fb: FormBuilder,
    private readonly apiService: ApiService,
    private readonly authHelperService: AuthHelperService,
    private readonly sanitizer: DomSanitizer,
    private readonly confettiService: ConfettiService,
    private readonly webSocketService: WebSocketService
  ) {
    this.sessionRequestForm = this.fb.group({
      proposedDateTime: ['', Validators.required],
      description: ['', Validators.required]
    });
    
    this.sessionResponseForm = this.fb.group({
      responseMessage: ['']
    });
    
    this.feedbackForm = this.fb.group({
      rating: [0, [Validators.required, Validators.min(1), Validators.max(5)]],
      comment: ['']
    });
    
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    this.minDateTime = now.toISOString().slice(0, 16);
  }

  ngOnDestroy(): void {
    this.stopSpeechTest();
    this.webSocketService.disconnect();
    if (this.wsSubscription) {
      this.wsSubscription.unsubscribe();
    }
  }

  ngOnInit(): void {
    this.userRole = this.authHelperService.getRole();
    this.isMemberRole = this.userRole === 'MEMBER';
    this.currentUserId = this.authHelperService.getUserId();
    this.currentUserFullName = this.authHelperService.getFullName();

    // Initialize WebSocket connection
    if (this.currentUserId) {
      this.webSocketService.connect(this.currentUserId);
      this.wsSubscription = this.webSocketService.messages$.subscribe((message) => {
        this.handleWebSocketMessage(message);
      });
    }

    this.clubId = this.authHelperService.getClubId();
    if (!this.clubId) {
      this.errorMessage = 'Club not found. Reconnect and try again.';
      return;
    }

    if (this.isMemberRole) {
      this.selectedMemberUserId = this.currentUserId;
    }

    this.loadInitialData();
    this.loadSpeechAnalyzerHealth();
  }

  onCVFileSelected(event: any): void {
    const file = event.target.files[0];
    if (!file) return;

    this.isAnalyzingCV = true;
    this.errorMessage = '';
    this.successMessage = '';
    this.analyzedFileName = file.name;

    this.apiService.analyzeCV(this.currentUserId, this.clubId, file).subscribe({
      next: (res) => {
        this.isAnalyzingCV = false;
        this.cvAnalysisResults = res;
        this.showCVAnalysisModal = true;
        this.loadMemberCompetencies(); // Reload to update dashboard behind the scenes
      },
      error: (err) => {
        this.isAnalyzingCV = false;
        this.errorMessage = 'Error during CV analysis: ' + err.message;
      }
    });
  }

  closeCVAnalysisModal(): void {
    this.showCVAnalysisModal = false;
  }

  setTab(tab: 'overview' | 'inventory' | 'path' | 'mentorship'): void {
    this.activeTab = tab;
    if (tab === 'mentorship') {
      this.loadActiveConversations();
      this.loadPendingSessionRequests();
    }
  }

  setInventoryView(mode: 'grid' | 'list'): void {
    this.inventoryViewMode = mode;
  }

  setInventoryCategoryFilter(filter: 'ALL' | 'SOFT' | 'HARD' | 'TECHNICAL'): void {
    this.inventoryCategoryFilter = filter;
    this.inventoryCurrentPage = 1; // Reset to first page when filter changes
  }

  getFilteredInventoryItems(): MemberCompetencyResponse[] {
    if (this.inventoryCategoryFilter === 'ALL') {
      return this.filteredPersonalCompetencies;
    }
    return this.filteredPersonalCompetencies.filter(
      item => (item.category || 'HARD').toUpperCase() === this.inventoryCategoryFilter
    );
  }

  getPaginatedInventoryItems(): MemberCompetencyResponse[] {
    const filtered = this.getFilteredInventoryItems();
    const startIndex = (this.inventoryCurrentPage - 1) * this.inventoryItemsPerPage;
    return filtered.slice(startIndex, startIndex + this.inventoryItemsPerPage);
  }

  getInventoryTotalPages(): number {
    return Math.ceil(this.getFilteredInventoryItems().length / this.inventoryItemsPerPage);
  }

  goToInventoryPage(page: number): void {
    if (page >= 1 && page <= this.getInventoryTotalPages()) {
      this.inventoryCurrentPage = page;
    }
  }

  getInventoryPageNumbers(): number[] {
    const totalPages = this.getInventoryTotalPages();
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  getCategoryCount(category: 'SOFT' | 'HARD' | 'TECHNICAL'): number {
    return this.filteredPersonalCompetencies.filter(item => 
      (item.category || 'HARD').toUpperCase() === category
    ).length;
  }

  // Inventory Statistics - Unique to Inventory section (not present in other tabs)
  getInventoryStats() {
    const items = this.filteredPersonalCompetencies;
    const total = items.length;
    
    if (total === 0) {
      return {
        total: 0,
        skillsNeedingAttention: 0,
        averageGapToTarget: 0,
        recentlyUpdated: 0,
        maxLevelSkills: 0
      };
    }

    // Skills needing attention (current < target)
    const skillsNeedingAttention = items.filter(item => item.currentLevel < item.targetLevel).length;
    
    // Average gap to target
    const totalGap = items.reduce((sum, item) => sum + (item.targetLevel - item.currentLevel), 0);
    const averageGapToTarget = totalGap / total;
    
    // Recently updated (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentlyUpdated = items.filter(item => {
      const updateDate = new Date(item.lastUpdated);
      return updateDate >= thirtyDaysAgo;
    }).length;
    
    // Skills at max level (level 5)
    const maxLevelSkills = items.filter(item => item.currentLevel === 5).length;

    return {
      total,
      skillsNeedingAttention,
      averageGapToTarget: Math.round(averageGapToTarget * 10) / 10,
      recentlyUpdated,
      maxLevelSkills
    };
  }

  getCategoryIconSvg(category: string): string {
    // SVG paths for category icons
    switch (category?.toUpperCase()) {
      case 'SOFT': 
        return 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z'; // Check circle
      case 'HARD': 
        return 'M20 6h-4V4c0-1.11-.89-2-2-2h-4c-1.11 0-2 .89-2 2v2H4c-1.11 0-1.99.89-1.99 2L2 19c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zm-6 0h-4V4h4v2z'; // Briefcase
      case 'TECHNICAL': 
        return 'M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0l4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z'; // Code brackets
      default: 
        return 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z'; // Info circle
    }
  }

  getCategoryColor(category: string): string {
    switch (category?.toUpperCase()) {
      case 'SOFT': return 'linear-gradient(135deg, #34d399, #10b981)';
      case 'HARD': return 'linear-gradient(135deg, #f87171, #ef4444)';
      case 'TECHNICAL': return 'linear-gradient(135deg, #60a5fa, #3b82f6)';
      default: return 'linear-gradient(135deg, #94a3b8, #64748b)';
    }
  }

  // SVG Icon Paths - Replacing all emojis with SVG icons
  getIconSvg(iconName: string): string {
    const icons: { [key: string]: string } = {
      // Badge icons
      'lock': 'M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z',
      'unlock': 'M12 17c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm6-9h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6h1.9c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm0 12H6V10h12v10z',
      
      // Category icons
      'computer': 'M20 18c1.1 0 1.99-.9 1.99-2L22 5c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v11c0 1.1.9 2 2 2H0c0 1.1.9 2 2 2h20c1.1 0 2-.9 2-2h-4zM4 5h16v11H4V5z',
      'chat': 'M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z',
      'check': 'M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z',
      'calendar': 'M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM9 10H7v2h2v-2zm4 0h-2v2h2v-2zm4 0h-2v2h2v-2zm-8 4H7v2h2v-2zm4 0h-2v2h2v-2zm4 0h-2v2h2v-2z',
      'target': 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-5-9h4V7H7v4zm6 0h4V7h-4v4zm-6 6h4v-4H7v4zm6 0h4v-4h-4v4z',
      'trophy': 'M19 5h-2V3H7v2H5c-1.1 0-2 .9-2 2v1c0 2.55 1.92 4.63 4.39 4.94.63 1.5 1.98 2.63 3.61 2.96V19H7v2h10v-2h-4v-3.1c1.63-.33 2.98-1.46 3.61-2.96C19.08 12.63 21 10.55 21 8V7c0-1.1-.9-2-2-2zM5 8V7h2v3.82C5.84 10.4 5 9.3 5 8zm14 0c0 1.3-.84 2.4-2 2.82V7h2v1z',
      'scroll': 'M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z',
      'search': 'M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z',
      'video': 'M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z',
      'refresh': 'M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z',
      'sparkle': 'M7 2v11h3v9l7-12h-4l4-8z',
      'notes': 'M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z',
      'graduation': 'M5 13.18v4L12 21l7-3.82v-4L12 17l-7-3.82zM12 3L1 9l11 6 9-4.91V17h2V9L12 3z',
      'document': 'M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z',
      'close': 'M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z',
      'correct': 'M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z',
      'incorrect': 'M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z',
      'info': 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z',
      'star': 'M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z',
      'robot': 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-3-8c.55 0 1-.45 1-1s-.45-1-1-1-1 .45-1 1 .45 1 1 1zm6 0c.55 0 1-.45 1-1s-.45-1-1-1-1 .45-1 1 .45 1 1 1zm-3 3c-1.66 0-3 1.34-3 3h6c0-1.66-1.34-3-3-3z'
    };
    return icons[iconName] || icons['info'];
  }

  onMemberChange(): void {
    this.loadMemberCompetencies();
  }

  generateResourcesForStep(step: LearningStep): void {
    if (this.isGeneratingResources[step.id]) return;

    this.isGeneratingResources[step.id] = true;
    this.generatedResources[step.id] = []; // Clear current to show loading
    this.apiService.generateLearningPath(step.title, 5).subscribe({
      next: (res) => {
        this.generatedResources[step.id] = res.resources;
        this.estimatedTimes[step.id] = res.estimatedTime;
        this.isGeneratingResources[step.id] = false;
        
        // Open study center automatically when resources are ready
        this.openStudyCenter(step);
      },
      error: (err) => {
        this.isGeneratingResources[step.id] = false;
        this.errorMessage = 'Error during resource generation: ' + err.message;
      }
    });
  }

  openStudyCenter(step: LearningStep): void {
    this.selectedStepForStudy = step;
    this.showStudyCenter = true;
    this.loadStudyNotes(step.id);
    this.initializeChecklist(step);
  }

  // --- Study Corner Methods ---
  togglePomodoro(): void {
    if (this.pomodoroRunning) {
      clearInterval(this.pomodoroInterval);
      this.pomodoroRunning = false;
    } else {
      this.pomodoroRunning = true;
      this.pomodoroInterval = setInterval(() => {
        if (this.pomodoroSeconds > 0) {
          this.pomodoroSeconds--;
        } else {
          this.togglePomodoro();
          alert('Focus session finished!');
        }
      }, 1000);
    }
  }

  resetPomodoro(): void {
    clearInterval(this.pomodoroInterval);
    this.pomodoroRunning = false;
    this.pomodoroSeconds = 25 * 60;
  }

  get formattedTime(): string {
    const mins = Math.floor(this.pomodoroSeconds / 60);
    const secs = this.pomodoroSeconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  saveNotes(): void {
    if (this.selectedStepForStudy) {
      this.isSavingNotes = true;
      localStorage.setItem(`study_notes_${this.selectedStepForStudy.id}`, this.studyNotes);
      setTimeout(() => this.isSavingNotes = false, 1000);
    }
  }

  get checklistProgress(): number {
    if (!this.studyChecklist.length) return 0;
    const done = this.studyChecklist.filter(i => i.done).length;
    return Math.round((done / this.studyChecklist.length) * 100);
  }

  loadStudyNotes(stepId: number): void {
    this.studyNotes = localStorage.getItem(`study_notes_${stepId}`) || '';
  }

  initializeChecklist(step: LearningStep): void {
    const saved = localStorage.getItem(`study_checklist_${step.id}`);
    if (saved) {
      this.studyChecklist = JSON.parse(saved);
    } else {
      this.studyChecklist = [
        { text: 'Understand core concepts', done: false },
        { text: 'Watch video tutorials', done: false },
        { text: 'Practice on a real project', done: false },
        { text: 'Pass validation quiz', done: false }
      ];
    }
  }

  toggleCheckItem(index: number): void {
    this.studyChecklist[index].done = !this.studyChecklist[index].done;
    if (this.selectedStepForStudy) {
      localStorage.setItem(`study_checklist_${this.selectedStepForStudy.id}`, JSON.stringify(this.studyChecklist));
    }
  }

  openVideo(res: LearningResource): void {
    if (res.url) {
      window.open(res.url, '_blank');
    }
  }

  closeStudyCenter(): void {
    this.showStudyCenter = false;
    this.selectedStepForStudy = null;
  }

  getSafeVideoUrl(urlOrId: string): SafeResourceUrl | null {
    if (!urlOrId) return null;
    
    let videoId = '';
    
    // Check if it's already an ID (no dots, short string)
    if (!urlOrId.includes('.') && urlOrId.length < 20) {
      videoId = urlOrId;
    } else {
      // It's a URL
      if (urlOrId.includes('v=')) {
        videoId = urlOrId.split('v=')[1].split('&')[0];
      } else if (urlOrId.includes('youtu.be/')) {
        videoId = urlOrId.split('youtu.be/')[1].split('?')[0];
      } else if (urlOrId.includes('embed/')) {
        videoId = urlOrId.split('embed/')[1].split('?')[0];
      }
    }
    
    if (videoId) {
      return this.sanitizer.bypassSecurityTrustResourceUrl(`https://www.youtube.com/embed/${videoId}?autoplay=0&rel=0`);
    }
    return null;
  }

  hasVideoResource(resources: LearningResource[] | undefined): boolean {
    if (!resources) return false;
    return resources.some(r => r.type.toUpperCase() === 'VIDEO');
  }

  getFirstVideo(resources: LearningResource[] | undefined): LearningResource | null {
    if (!resources) return null;
    return resources.find(r => r.type.toUpperCase() === 'VIDEO') || null;
  }

  private refreshCalculatedData(): void {
    const targetUserId = this.isMemberRole ? this.currentUserId : (this.selectedMemberUserId || this.currentUserId);
    
    // 1. Filter and Sort ONCE
    this.filteredPersonalCompetencies = this.memberCompetencies
      .filter(item => Number(item.userId) === Number(targetUserId))
      .sort((a, b) => b.targetLevel - a.targetLevel);

    // 2. Calculate Metrics
    this.totalSkillsCount = this.filteredPersonalCompetencies.length;
    
    if (this.totalSkillsCount > 0) {
      const sumCurrent = this.filteredPersonalCompetencies.reduce((acc, c) => acc + c.currentLevel, 0);
      const sumTarget = this.filteredPersonalCompetencies.reduce((acc, c) => acc + c.targetLevel, 0);
      const sumGap = this.filteredPersonalCompetencies.reduce((acc, c) => acc + Math.max(0, this.getGapValue(c)), 0);
      
      this.averageCurrentLevel = Math.round((sumCurrent / this.totalSkillsCount) * 10) / 10;
      this.averageTargetLevel = Math.round((sumTarget / this.totalSkillsCount) * 10) / 10;
      this.averageGapLevel = Math.round((sumGap / this.totalSkillsCount) * 10) / 10;
      
      const completedBonus = this.filteredPersonalCompetencies.filter(item => this.getGapValue(item) <= 0).length * 8;
      const baseline = 100 - (this.averageGapLevel * 12) + completedBonus;
      this.readinessScore = Math.max(0, Math.min(100, Math.round(baseline)));
    } else {
      this.averageCurrentLevel = 0;
      this.averageTargetLevel = 0;
      this.averageGapLevel = 0;
      this.readinessScore = 0;
    }

    // 3. Update Radar and Charts
    this.updateRadarValues();
    this.updateGapChartValues();
  }

  private updateGapChartValues(): void {
    const skills = this.filteredPersonalCompetencies.slice(0, 10);
    this.gapChartData = {
      labels: skills.map(s => s.skillName),
      datasets: [
        {
          label: 'Level Gap',
          data: skills.map(s => Math.max(0, s.targetLevel - s.currentLevel)),
          backgroundColor: skills.map(s => {
            const gap = s.targetLevel - s.currentLevel;
            return gap >= 2 ? '#ef4444' : (gap >= 1 ? '#f59e0b' : '#10b981');
          }),
          borderRadius: 8,
          barThickness: 20
        }
      ]
    };
  }

  get radarSkills(): Array<{ name: string; current: number; target: number }> {
    return this.filteredPersonalCompetencies
      .slice(0, 8)
      .map(item => ({
        name: item.skillName,
        current: item.currentLevel,
        target: item.targetLevel
      }));
  }

  get softSkillsForSpeech(): MemberCompetencyResponse[] {
    return this.filteredPersonalCompetencies.filter(c => !this.isHardSkill(c.category));
  }

  get skillTips(): SkillTip[] {
    return this.filteredPersonalCompetencies.slice(0, 8).map(item => {
      const target = Math.max(1, item.targetLevel);
      const progress = Math.max(0, Math.min(100, Math.round((item.currentLevel / target) * 100)));
      const tip = this.getPersonalizedTip(item);

      return {
        id: item.id,
        skillName: item.skillName,
        current: item.currentLevel,
        target: item.targetLevel,
        progress,
        tip,
        category: item.category
      };
    });
  }

  isHardSkill(category: string): boolean {
    return category === 'HARD' || category === 'TECHNICAL';
  }

  // Option A: Estimation de temps + Conseils personnalisés
  calculateEstimatedHours(gap: number, category: string): number {
    const baseHours = gap * 4; // 4 heures par niveau
    const multiplier = this.isHardSkill(category) ? 1.2 : 0.9; // Hard skills = plus de temps
    return Math.round(baseHours * multiplier);
  }

  getPersonalizedAdvice(current: number, target: number, gap: number, category: string): string {
    if (gap <= 0) {
      return 'Bravo! Objectif atteint - Consolidez votre niveau maintenant';
    }
    if (gap === 1) {
      return 'Étape finale - 1 niveau seulement! Intensifiez vos efforts';
    }
    if (gap >= 3) {
      return `Grand écart (${gap} niveaux) - Suivez des formations + pratique intensive`;
    }
    return 'Progression régulière - Continuez avec sessions et quizz hebdomadaires';
  }

  // Option B: Milestones + Impact Score
  generateMilestones(target: number, current: number): { level: number; completed: boolean }[] {
    const milestones: { level: number; completed: boolean }[] = [];
    for (let i = 1; i <= target; i++) {
      milestones.push({ level: i, completed: i <= current });
    }
    return milestones;
  }

  calculateImpactScore(category: string, target: number): number {
    // Score basé sur catégorie et niveau cible
    const categoryMultiplier = this.isHardSkill(category) ? 1.3 : 0.8;
    const baseScore = (target / 5) * 10; // Max 10 points
    return Math.round(baseScore * categoryMultiplier * 10) / 10;
  }

  calculateCompletionDate(estimatedHours: number, pace: number = 3): Date {
    // pace = heures d'apprentissage par semaine (default 3h/week)
    const weeks = Math.ceil(estimatedHours / pace);
    const completionDate = new Date();
    completionDate.setDate(completionDate.getDate() + weeks * 7);
    return completionDate;
  }

  get learningPath(): LearningStep[] {
    const ordered = [...this.filteredPersonalCompetencies]
      .sort((a, b) => {
        const aDone = this.getGapValue(a) <= 0 ? 1 : 0;
        const bDone = this.getGapValue(b) <= 0 ? 1 : 0;
        if (aDone !== bDone) return aDone - bDone;
        return this.getGapValue(b) - this.getGapValue(a);
      })
      .slice(0, 6);

    const firstPendingIndex = ordered.findIndex(item => this.getGapValue(item) > 0);

    return ordered.map((item, index) => {
      let state: LearningState = 'locked';
      if (this.getGapValue(item) <= 0) {
        state = 'done';
      } else if (firstPendingIndex === index) {
        state = 'active';
      }

      const target = Math.max(1, item.targetLevel);
      const progress = Math.max(0, Math.min(100, Math.round((item.currentLevel / target) * 100)));
      const gap = Math.max(0, target - item.currentLevel);
      const estimatedHours = this.calculateEstimatedHours(gap, item.category);
      const advice = this.getPersonalizedAdvice(item.currentLevel, target, gap, item.category);
      const milestones = this.generateMilestones(target, item.currentLevel);
      const impactScore = this.calculateImpactScore(item.category, target);
      const completionDate = this.calculateCompletionDate(estimatedHours);

      return {
        id: item.id,
        title: item.skillName,
        progress,
        state,
        skillName: item.skillName,
        current: item.currentLevel,
        category: item.category,
        target,
        estimatedHours,
        personalizedAdvice: advice,
        milestones,
        impactScore,
        completionDate,
        summary: state === 'done'
          ? 'Goal achieved. Consolidate level.'
          : state === 'active'
            ? 'Current priority to gain impact.'
            : 'Next step after active skill.'
      };
    });
  }

  // Learning Path Filter Methods
  getCompletedSkills(): LearningStep[] {
    return this.learningPath.filter(step => step.state === 'done');
  }

  getActiveSkills(): LearningStep[] {
    return this.learningPath.filter(step => step.state === 'active');
  }

  getLockedSkills(): LearningStep[] {
    return this.learningPath.filter(step => step.state === 'locked');
  }

  get memberBadges(): MemberBadge[] {
    const sessionsWithSpeech = this.filteredPersonalCompetencies.filter(item => item.lastUpdatedBy === 'SPEECH_ANALYZER').length;

    return [
      {
        id: 'starter',
        title: 'Starter',
        icon: 'S',
        unlocked: this.totalSkillsCount > 0,
        hint: 'Have at least one tracked competency.'
      },
      {
        id: 'steady',
        title: 'Steady Builder',
        icon: 'B',
        unlocked: this.totalSkillsCount >= 4,
        hint: 'Track at least 4 competencies.'
      },
      {
        id: 'crusher',
        title: 'Gap Crusher',
        icon: 'G',
        unlocked: this.averageGapLevel <= 1 && this.totalSkillsCount > 0,
        hint: 'Maintain an average gap <= 1.'
      },
      {
        id: 'speaker',
        title: 'Voice Performer',
        icon: 'V',
        unlocked: sessionsWithSpeech >= 1 || this.liveScore >= 70,
        hint: 'Sync at least one Speech Analyzer session.'
      },
      {
        id: 'elite',
        title: 'Elite Ready',
        icon: 'E',
        unlocked: this.readinessScore >= 80,
        hint: 'Reach a readiness score >= 80.'
      }
    ];
  }

  get latestSpeechSummary(): SpeechSessionSummary {
    const speechEntries = this.filteredPersonalCompetencies
      .filter(item => item.lastUpdatedBy === 'SPEECH_ANALYZER')
      .sort((a, b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime());

    const latest = speechEntries[0];
    const hasLiveData = this.liveScore > 0 || this.liveConfidence > 0 || !!this.speechTestFeedback;

    if (hasLiveData) {
      return {
        status: this.liveSocketState || 'ready',
        score: this.liveScore,
        level: this.liveLevel,
        confidence: this.liveConfidence,
        pace: this.liveSpeechRate,
        feedback: this.speechTestFeedback || (this.isRecordingSpeech ? 'Analysis in progress... Keep talking.' : 'Session finished. Ready for sync.'),
        updatedAt: new Date().toISOString()
      };
    }

    if (!latest) {
      return {
        status: 'not-started',
        score: 0,
        level: 'BEGINNER',
        confidence: 0,
        pace: 0,
        feedback: 'No Speech Analyzer session synced yet.',
        updatedAt: ''
      };
    }

    return {
      status: 'synced',
      score: latest.currentLevel * 20,
      level: latest.currentLevel >= 4 ? 'ADVANCED' : latest.currentLevel >= 3 ? 'INTERMEDIATE' : 'BEGINNER',
      confidence: this.liveConfidence,
      pace: this.liveSpeechRate,
      feedback: this.speechTestFeedback || 'Last session successfully synced.',
      updatedAt: latest.lastUpdated
    };
  }

  get isEditing(): boolean {
    return this.editingId !== null;
  }

  get formUserIdControl() {
    return this.form.controls.userId;
  }

  get formSkillIdControl() {
    return this.form.controls.skillId;
  }

  get visibleMemberCompetenciesForSpeech(): MemberCompetencyResponse[] {
    return this.filteredPersonalCompetencies;
  }

  get unlockedBadgesCount(): number {
    return this.memberBadges.filter(b => b.unlocked).length;
  }

  private initializeRecentActivities(): void {
    // Generate activities from real competency data
    const activities: ActivityItem[] = [];
    const now = new Date();

    // Get recent competency updates
    const recentCompetencies = [...this.filteredPersonalCompetencies]
      .sort((a, b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime())
      .slice(0, 10);

    recentCompetencies.forEach(comp => {
      const lastUpdated = new Date(comp.lastUpdated);
      const daysAgo = (now.getTime() - lastUpdated.getTime()) / (1000 * 60 * 60 * 24);

      if (daysAgo > 90) return; // Show activities from last 90 days

      let type: ActivityItem['type'];
      let icon: string;
      let iconColor: string;
      let title: string;
      let description: string;

      switch (comp.lastUpdatedBy) {
        case 'PEER_ENDORSEMENT':
          type = 'endorsement';
          icon = '👍';
          iconColor = '#3b82f6';
          title = 'New Endorsement';
          description = `Peer endorsement received`;
          break;
        case 'SPEECH_ANALYZER':
          type = 'speech-sync';
          icon = '🎙️';
          iconColor = '#f59e0b';
          title = 'Speech Synced';
          description = 'Speech Studio session synced';
          break;
        case 'LIVE_SESSION':
          type = 'level-up';
          icon = '📈';
          iconColor = '#10b981';
          title = 'Level Updated';
          description = `Current level: ${comp.currentLevel}`;
          break;
        case 'AI_COACH':
          type = 'quiz-passed';
          icon = '🎯';
          iconColor = '#8b5cf6';
          title = 'AI Coach Feedback';
          description = 'AI coach provided insights';
          break;
        default:
          type = 'level-up';
          icon = '📝';
          iconColor = '#64748b';
          title = 'Skill Updated';
          description = 'Manual update';
      }

      activities.push({
        id: `${comp.id}-${Date.now()}`,
        type,
        title,
        description,
        skillName: comp.skillName,
        timestamp: lastUpdated,
        icon,
        iconColor
      });
    });

    // Add badge unlock activities based on unlocked badges
    this.memberBadges.forEach(badge => {
      if (badge.unlocked) {
        activities.push({
          id: `badge-${badge.id}`,
          type: 'badge-unlocked',
          title: 'Badge Unlocked',
          description: `Earned "${badge.title}" badge`,
          timestamp: new Date(now.getTime() - Math.random() * 7 * 24 * 60 * 60 * 1000),
          icon: '🏆',
          iconColor: '#fbbf24'
        });
      }
    });

    // Sort by timestamp and take top 5
    this.recentActivities = activities
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, 5);
  }

  private initializeGoals(): void {
    const now = new Date();
    const weekEnd = new Date(now);
    weekEnd.setDate(weekEnd.getDate() + 7);

    const monthEnd = new Date(now);
    monthEnd.setMonth(monthEnd.getMonth() + 1);

    this.goals = [
      {
        id: '1',
        type: 'weekly',
        category: 'skills',
        target: 5,
        current: 3,
        unit: 'skills',
        deadline: weekEnd,
        completed: false
      },
      {
        id: '2',
        type: 'weekly',
        category: 'speech',
        target: 3,
        current: 2,
        unit: 'sessions',
        deadline: weekEnd,
        completed: false
      },
      {
        id: '3',
        type: 'monthly',
        category: 'endorsements',
        target: 10,
        current: 7,
        unit: 'endorsements',
        deadline: monthEnd,
        completed: false
      },
      {
        id: '4',
        type: 'monthly',
        category: 'readiness',
        target: 85,
        current: this.readinessScore,
        unit: '%',
        deadline: monthEnd,
        completed: this.readinessScore >= 85
      }
    ];
  }

  get goalProgress(): number {
    if (this.goals.length === 0) return 0;
    const totalProgress = this.goals.reduce((sum, goal) => {
      return sum + (goal.current / goal.target) * 100;
    }, 0);
    return Math.round(totalProgress / this.goals.length);
  }

  get completedGoalsCount(): number {
    return this.goals.filter(g => g.completed).length;
  }

  get skillsProgress(): number {
    return Math.min((this.totalSkillsCount / 10) * 100, 100);
  }

  getActivityTimeAgo(timestamp: Date): string {
    const now = new Date();
    const diff = now.getTime() - timestamp.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days} day${days > 1 ? 's' : ''} ago`;
    }
    if (hours > 0) {
      return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    }
    return 'Just now';
  }

  private generateAIInsight(): void {
    const now = new Date();
    const activities = this.recentActivities;
    const competencies = this.filteredPersonalCompetencies;

    // Check for inactivity (no activity in last 14 days)
    const hasRecentActivity = activities.length > 0;
    const oldestActivity = activities.length > 0 ? activities[activities.length - 1].timestamp : null;
    const daysSinceLastActivity = oldestActivity ? (now.getTime() - oldestActivity.getTime()) / (1000 * 60 * 60 * 24) : 999;

    // Check for dispersion (too many skills with low progress)
    const lowProgressSkills = competencies.filter(c => c.currentLevel < 2 && c.targetLevel > 2).length;
    const totalSkills = competencies.length;
    const dispersionRatio = totalSkills > 0 ? lowProgressSkills / totalSkills : 0;

    // Check for stagnation (no level changes in last 30 days)
    const recentCompetencies = competencies.filter(c => {
      const daysSinceUpdate = (now.getTime() - new Date(c.lastUpdated).getTime()) / (1000 * 60 * 60 * 24);
      return daysSinceUpdate < 30;
    });
    const hasStagnation = recentCompetencies.length === 0 && totalSkills > 0;

    // Generate insight based on analysis
    if (daysSinceLastActivity > 14 && totalSkills > 0) {
      // Inactivity detected
      this.aiInsight = {
        type: 'warning',
        title: 'Time to get back on track!',
        message: `It's been ${Math.floor(daysSinceLastActivity)} days since your last activity. Your skills are waiting for you!`,
        actionableTip: 'Start with a quick Speech Studio session or update one skill to reignite your progress.',
        icon: '⏰',
        iconColor: '#f59e0b'
      };
    } else if (dispersionRatio > 0.6 && totalSkills > 3) {
      // Too dispersed
      this.aiInsight = {
        type: 'suggestion',
        title: 'Focus on what matters',
        message: `You're tracking ${totalSkills} skills but ${lowProgressSkills} are still at early levels. Consider focusing on fewer skills at a time.`,
        actionableTip: 'Pick 2-3 skills to prioritize this month and pause the others for better results.',
        icon: '🎯',
        iconColor: '#8b5cf6'
      };
    } else if (hasStagnation) {
      // Stagnation detected
      this.aiInsight = {
        type: 'encouragement',
        title: 'Keep pushing forward',
        message: 'Your skills haven\'t been updated in a while. Small consistent steps lead to big improvements!',
        actionableTip: 'Try a 15-minute session today: practice one skill or get a peer endorsement.',
        icon: '💪',
        iconColor: '#10b981'
      };
    } else if (this.readinessScore > 80) {
      // High readiness - encouragement
      this.aiInsight = {
        type: 'encouragement',
        title: 'You\'re doing great!',
        message: `Your readiness score is ${this.readinessScore}% - you're on the right track! Keep up the momentum.`,
        actionableTip: 'Consider mentoring others or taking on a new challenge to grow further.',
        icon: '🌟',
        iconColor: '#10b981'
      };
    } else if (this.readinessScore < 50) {
      // Low readiness - encouragement
      this.aiInsight = {
        type: 'encouragement',
        title: 'Every journey starts with a step',
        message: `Your readiness score is ${this.readinessScore}%. Don't worry - progress takes time.`,
        actionableTip: 'Focus on closing your biggest gaps first. Small wins build confidence!',
        icon: '🚀',
        iconColor: '#3b82f6'
      };
    } else {
      // Neutral status
      this.aiInsight = {
        type: 'neutral',
        title: 'Steady progress',
        message: `You're tracking ${totalSkills} skills with a readiness score of ${this.readinessScore}%.`,
        actionableTip: 'Keep consistent with your practice routine. Consistency beats intensity!',
        icon: '📊',
        iconColor: '#64748b'
      };
    }
  }

  private generateMentorshipSuggestions(): void {
    // Only generate for members, not admins
    if (!this.isMemberRole) {
      this.mentorshipSuggestions = [];
      return;
    }

    const suggestions: MentorshipSuggestion[] = [];
    const myCompetencies = this.filteredPersonalCompetencies;
    const allMembers = this.members.filter(m => m.userId !== this.currentUserId);

    // Find potential mentees (members with lower levels in skills I'm good at)
    myCompetencies.forEach(myComp => {
      if (myComp.currentLevel < 3) return; // Only mentor skills I'm decent at

      allMembers.forEach(member => {
        const memberComp = this.memberCompetencies.find(
          mc => mc.userId === member.userId && mc.skillId === myComp.skillId
        );

        if (!memberComp || memberComp.currentLevel >= myComp.currentLevel) return;
        if (memberComp.currentLevel >= 3) return; // Only mentor those who need help

        const levelGap = myComp.currentLevel - memberComp.currentLevel;
        const matchScore = Math.min(levelGap * 20, 100);
        const memberName = `${member.firstName || ''} ${member.lastName || ''}`.trim() || 'Member';

        suggestions.push({
          id: `${this.currentUserId}-${member.userId}-${myComp.skillId}`,
          mentorId: String(this.currentUserId),
          mentorName: this.currentUserFullName,
          mentorSkill: myComp.skillName,
          mentorLevel: myComp.currentLevel,
          menteeId: String(member.userId),
          menteeName: memberName,
          menteeSkill: memberComp.skillName,
          menteeLevel: memberComp.currentLevel,
          matchScore,
          reason: `You're level ${myComp.currentLevel} in ${myComp.skillName} while ${memberName} is at level ${memberComp.currentLevel}. Your expertise could help them progress.`
        });
      });
    });

    // Sort by match score and take top 3
    this.mentorshipSuggestions = suggestions
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, 3);
  }

  openMentorshipPanel(): void {
    this.showMentorshipPanel = true;
  }

  startMentorshipSession(suggestion: MentorshipSuggestion): void {
    this.selectedMentorshipSuggestion = suggestion;
    
    // Create or get existing conversation
    this.apiService.createMentorshipConversation(
      this.currentUserId,
      Number(suggestion.menteeId),
      this.clubId,
      suggestion.mentorSkill,
      suggestion.mentorLevel,
      suggestion.menteeLevel
    ).subscribe({
      next: (conversation) => {
        this.currentConversationId = conversation.id;
        this.loadConversationMessages(conversation.id);
        this.showMentorshipPanel = true;
      },
      error: (err) => {
        console.error('Error creating conversation:', err);
        this.mentorshipMessages = [{
          sender: 'system',
          message: 'Error starting mentorship session. Please try again.',
          timestamp: new Date()
        }];
        this.showMentorshipPanel = true;
      }
    });
  }

  loadConversationMessages(conversationId: number): void {
    this.apiService.getMentorshipConversationMessages(conversationId).subscribe({
      next: (messages) => {
        this.mentorshipMessages = messages.map(msg => ({
          sender: msg.senderId === this.currentUserId ? 'me' : 'mentee',
          message: msg.content,
          timestamp: new Date(msg.sentAt),
          senderId: msg.senderId
        }));
        
        // Mark messages as read
        this.apiService.markMentorshipMessagesAsRead(conversationId, this.currentUserId).subscribe();
      },
      error: (err) => {
        console.error('Error loading messages:', err);
      }
    });
  }

  viewMemberProfile(memberId: string): void {
    // TODO: Implement member profile viewing
    console.log('Viewing profile for member:', memberId);
  }

  sendMentorshipMessage(): void {
    if (!this.newMentorshipMessage.trim() || !this.currentConversationId) return;

    const content = this.newMentorshipMessage;
    this.newMentorshipMessage = '';

    this.apiService.sendMentorshipMessage(
      this.currentConversationId,
      this.currentUserId,
      content
    ).subscribe({
      next: (message) => {
        this.mentorshipMessages.push({
          sender: 'me',
          message: message.content,
          timestamp: new Date(message.sentAt),
          senderId: message.senderId
        });
      },
      error: (err) => {
        console.error('Error sending message:', err);
        this.newMentorshipMessage = content; // Restore message on error
      }
    });
  }

  closeMentorshipPanel(): void {
    this.showMentorshipPanel = false;
    this.selectedMentorshipSuggestion = null;
    this.mentorshipMessages = [];
    this.currentConversationId = null;
  }

  autoResizeTextarea(event: Event): void {
    const textarea = event.target as HTMLTextAreaElement;
    textarea.style.height = 'auto';
    textarea.style.height = textarea.scrollHeight + 'px';
  }

  onEnterPress(event: Event): void {
    const keyboardEvent = event as KeyboardEvent;
    if (!keyboardEvent.shiftKey) {
      event.preventDefault();
      this.sendMentorshipMessage();
    }
  }

  loadActiveConversations(): void {
    this.apiService.getUserMentorshipConversations(this.currentUserId).subscribe({
      next: (conversations) => {
        this.activeConversations = conversations;
      },
      error: (err) => {
        console.error('Error loading conversations:', err);
        this.activeConversations = [];
      }
    });
  }

  loadPendingSessionRequests(): void {
    this.apiService.getPendingMentorshipRequests(this.currentUserId).subscribe({
      next: (requests) => {
        this.pendingSessionRequests = requests;
      },
      error: (err) => {
        console.error('Error loading pending requests:', err);
        this.pendingSessionRequests = [];
      }
    });
  }

  openConversation(conversation: any): void {
    this.currentConversationId = conversation.id;
    this.selectedMentorshipSuggestion = {
      id: conversation.id.toString(),
      mentorId: conversation.mentorId.toString(),
      mentorName: conversation.mentorName,
      mentorSkill: conversation.skillName,
      mentorLevel: conversation.mentorLevel,
      menteeId: conversation.menteeId.toString(),
      menteeName: conversation.menteeName,
      menteeSkill: conversation.skillName,
      menteeLevel: conversation.menteeLevel,
      matchScore: 100,
      reason: 'Active mentorship conversation'
    };
    this.loadConversationMessages(conversation.id);
    this.showMentorshipPanel = true;
  }

  getConversationPartnerName(conversation: any): string {
    return conversation.mentorId === this.currentUserId ? conversation.menteeName : conversation.mentorName;
  }

  hasUnreadMessages(conversation: any): boolean {
    if (!conversation.messages) return false;
    return conversation.messages.some((m: any) => !m.isRead && m.senderId !== this.currentUserId);
  }

  getUnreadCount(conversation: any): number {
    if (!conversation.messages) return 0;
    return conversation.messages.filter((m: any) => !m.isRead && m.senderId !== this.currentUserId).length;
  }

  getLastMessage(conversation: any): string {
    if (!conversation.messages || conversation.messages.length === 0) return 'No messages yet';
    const lastMsg = conversation.messages[conversation.messages.length - 1];
    return lastMsg.content.length > 50 ? lastMsg.content.substring(0, 50) + '...' : lastMsg.content;
  }

  getLastMessageTime(conversation: any): string {
    if (!conversation.messages || conversation.messages.length === 0) return '';
    const lastMsg = conversation.messages[conversation.messages.length - 1];
    const date = new Date(lastMsg.sentAt);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  }

  // Session Request Methods
  openSessionRequestModal(): void {
    this.showSessionRequestModal = true;
  }

  closeSessionRequestModal(): void {
    this.showSessionRequestModal = false;
    this.sessionRequestForm.reset();
  }

  submitSessionRequest(): void {
    if (!this.currentConversationId || !this.selectedMentorshipSuggestion) return;

    this.isSubmittingRequest = true;
    const proposedDateTime = this.sessionRequestForm.value.proposedDateTime;
    const description = this.sessionRequestForm.value.description;
    
    const requestedUserId = this.selectedMentorshipSuggestion.menteeId === this.currentUserId.toString()
      ? Number(this.selectedMentorshipSuggestion.mentorId)
      : Number(this.selectedMentorshipSuggestion.menteeId);

    this.apiService.createMentorshipSessionRequest(
      this.currentConversationId,
      this.currentUserId,
      requestedUserId,
      proposedDateTime,
      description
    ).subscribe({
      next: (request) => {
        this.isSubmittingRequest = false;
        this.closeSessionRequestModal();
        this.mentorshipMessages.push({
          sender: 'system',
          message: `Session request sent for ${this.formatDateTime(proposedDateTime)}`,
          timestamp: new Date()
        });
      },
      error: (err) => {
        this.isSubmittingRequest = false;
        console.error('Error creating session request:', err);
        this.mentorshipMessages.push({
          sender: 'system',
          message: 'Error sending session request. Please try again.',
          timestamp: new Date()
        });
      }
    });
  }

  openSessionResponseModal(request: any): void {
    this.pendingSessionRequest = request;
    this.showSessionResponseModal = true;
  }

  closeSessionResponseModal(): void {
    this.showSessionResponseModal = false;
    this.pendingSessionRequest = null;
    this.sessionResponseForm.reset();
  }

  respondToSessionRequest(accepted: boolean): void {
    if (!this.pendingSessionRequest) return;

    this.isResponding = true;
    const responseMessage = this.sessionResponseForm.value.responseMessage || '';

    this.apiService.respondToMentorshipSessionRequest(
      this.pendingSessionRequest.id,
      this.currentUserId,
      accepted,
      responseMessage
    ).subscribe({
      next: (response) => {
        this.isResponding = false;
        this.closeSessionResponseModal();
        
        if (accepted) {
          this.mentorshipMessages.push({
            sender: 'system',
            message: `Session accepted! Scheduled for ${this.formatDateTime(this.pendingSessionRequest.proposedDateTime)}`,
            timestamp: new Date()
          });
          // TODO: Create actual session in the sessions system
        } else {
          this.mentorshipMessages.push({
            sender: 'system',
            message: 'Session request declined.',
            timestamp: new Date()
          });
        }
      },
      error: (err) => {
        this.isResponding = false;
        console.error('Error responding to session request:', err);
      }
    });
  }

  formatDateTime(dateTimeStr: string): string {
    const date = new Date(dateTimeStr);
    return date.toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  // Feedback Methods
  openFeedbackModal(): void {
    this.showFeedbackModal = true;
  }

  closeFeedbackModal(): void {
    this.showFeedbackModal = false;
    this.feedbackForm.reset({ rating: 0, comment: '' });
  }

  submitFeedback(): void {
    if (!this.currentConversationId || !this.selectedMentorshipSuggestion) return;

    this.isSubmittingFeedback = true;
    const rating = this.feedbackForm.value.rating;
    const comment = this.feedbackForm.value.comment;
    
    const receiverId = this.selectedMentorshipSuggestion.menteeId === this.currentUserId.toString()
      ? Number(this.selectedMentorshipSuggestion.mentorId)
      : Number(this.selectedMentorshipSuggestion.menteeId);

    this.apiService.submitMentorshipFeedback(
      this.currentConversationId,
      this.currentUserId,
      receiverId,
      rating,
      comment
    ).subscribe({
      next: (feedback) => {
        this.isSubmittingFeedback = false;
        this.closeFeedbackModal();
        this.mentorshipMessages.push({
          sender: 'system',
          message: `Thank you for your feedback! You rated this mentorship ${rating}/5 stars.`,
          timestamp: new Date()
        });
      },
      error: (err) => {
        this.isSubmittingFeedback = false;
        console.error('Error submitting feedback:', err);
        this.mentorshipMessages.push({
          sender: 'system',
          message: 'Error submitting feedback. Please try again.',
          timestamp: new Date()
        });
      }
    });
  }

  // Goals Methods
  viewGoals(): void {
    if (!this.currentConversationId) {
      this.mentorshipMessages.push({
        sender: 'system',
        message: 'Please start a conversation first to view goals.',
        timestamp: new Date()
      });
      return;
    }

    this.apiService.getConversationGoals(this.currentConversationId).subscribe({
      next: (goals) => {
        this.conversationGoals = goals;
        this.showGoalsModal = true;
      },
      error: (err) => {
        console.error('Error loading goals:', err);
        this.mentorshipMessages.push({
          sender: 'system',
          message: 'Error loading goals. Please try again.',
          timestamp: new Date()
        });
      }
    });
  }

  closeGoalsModal(): void {
    this.showGoalsModal = false;
    this.conversationGoals = [];
  }

  createGoal(title: string, description: string): void {
    if (!this.currentConversationId) return;

    const conversationId = typeof this.currentConversationId === 'string' 
      ? parseInt(this.currentConversationId, 10) 
      : this.currentConversationId;

    const menteeId = this.selectedMentorshipSuggestion?.menteeId 
      ? (typeof this.selectedMentorshipSuggestion.menteeId === 'string' 
          ? parseInt(this.selectedMentorshipSuggestion.menteeId, 10) 
          : this.selectedMentorshipSuggestion.menteeId)
      : this.currentUserId;

    this.apiService.createMentorshipGoal(conversationId, menteeId, title, description).subscribe({
      next: (goal) => {
        this.conversationGoals.push(goal);
        this.mentorshipMessages.push({
          sender: 'system',
          message: `New goal created: ${title}`,
          timestamp: new Date()
        });
      },
      error: (err) => {
        console.error('Error creating goal:', err);
      }
    });
  }

  updateGoalProgress(goalId: number, progress: number): void {
    this.apiService.updateGoalProgress(goalId, progress).subscribe({
      next: (updated) => {
        const goalIndex = this.conversationGoals.findIndex(g => g.id === goalId);
        if (goalIndex !== -1) {
          this.conversationGoals[goalIndex] = updated;
        }
        
        // Check if all goals are completed
        if (this.conversationGoals.every(g => g.progress === 100)) {
          this.mentorshipMessages.push({
            sender: 'system',
            message: '🎉 All goals completed! You can now generate a certificate.',
            timestamp: new Date()
          });
        }
      },
      error: (err) => {
        console.error('Error updating goal progress:', err);
      }
    });
  }

  onGoalProgressChange(goalId: number, event: Event): void {
    const target = event.target as HTMLInputElement;
    const progress = parseInt(target.value, 10);
    this.updateGoalProgress(goalId, progress);
  }

  // Certificate Methods
  viewCertificate(): void {
    if (!this.currentConversationId) {
      this.mentorshipMessages.push({
        sender: 'system',
        message: 'Please start a conversation first to view certificates.',
        timestamp: new Date()
      });
      return;
    }

    // First check if there are any goals
    this.apiService.getConversationGoals(this.currentConversationId).subscribe({
      next: (goals) => {
        if (goals.length === 0) {
          this.mentorshipMessages.push({
            sender: 'system',
            message: '⚠️ No goals set yet. Please create goals first before generating a certificate.',
            timestamp: new Date()
          });
          this.showGoalsModal = true;
          return;
        }

        // Check if certificate exists
        if (this.currentConversationId) {
          this.apiService.getCertificateByConversation(this.currentConversationId).subscribe({
            next: (certificate) => {
              this.conversationCertificate = certificate;
              this.showCertificateModal = true;
            },
            error: (err) => {
              console.error('Error loading certificate:', err);
              // Check if all goals are completed to offer generation
              if (this.currentConversationId) {
                this.apiService.areAllGoalsCompleted(this.currentConversationId).subscribe({
                  next: (completed) => {
                    if (completed) {
                      this.mentorshipMessages.push({
                        sender: 'system',
                        message: '✅ All goals are completed! Click the certificate button to generate your certificate.',
                        timestamp: new Date()
                      });
                      // Open certificate modal to show generate button
                      this.showCertificateModal = true;
                    } else {
                      this.mentorshipMessages.push({
                        sender: 'system',
                        message: '⚠️ Complete all goals to generate a certificate. Current progress: ' + goals.filter(g => g.progress >= 100).length + '/' + goals.length + ' goals completed.',
                        timestamp: new Date()
                      });
                    }
                  },
                  error: (err2) => {
                    this.mentorshipMessages.push({
                      sender: 'system',
                      message: 'No certificate found. Complete all goals to generate one.',
                      timestamp: new Date()
                    });
                  }
                });
              }
            }
          });
        }
      },
      error: (err) => {
        console.error('Error loading goals:', err);
        this.mentorshipMessages.push({
          sender: 'system',
          message: 'Error loading goals. Please try again.',
          timestamp: new Date()
        });
      }
    });
  }

  generateCertificate(): void {
    if (!this.currentConversationId) {
      console.error('Cannot generate certificate: No current conversation ID');
      return;
    }

    console.log('Generating certificate for conversation:', this.currentConversationId);

    this.apiService.generateCertificate(this.currentConversationId).subscribe({
      next: (certificate) => {
        console.log('Certificate generated successfully:', certificate);
        this.conversationCertificate = certificate;
        this.showCertificateModal = true;
        this.mentorshipMessages.push({
          sender: 'system',
          message: '🎉 Certificate generated successfully!',
          timestamp: new Date()
        });
        this.confettiService.celebrateAchievement();
      },
      error: (err) => {
        console.error('Error generating certificate:', err);
        this.mentorshipMessages.push({
          sender: 'system',
          message: 'Error generating certificate. Make sure all goals are completed.',
          timestamp: new Date()
        });
      }
    });
  }

  downloadCertificatePdf(): void {
    if (!this.currentConversationId) {
      console.error('Cannot download certificate: No current conversation ID');
      this.mentorshipMessages.push({
        sender: 'system',
        message: 'Error: No active conversation.',
        timestamp: new Date()
      });
      return;
    }

    console.log('Downloading certificate PDF for conversation:', this.currentConversationId);
    this.mentorshipMessages.push({
      sender: 'system',
      message: '📄 Generating certificate PDF...',
      timestamp: new Date()
    });

    this.apiService.downloadCertificatePdf(this.currentConversationId).subscribe({
      next: (blob: Blob) => {
        console.log('PDF blob received, size:', blob.size);
        
        if (blob.size === 0) {
          this.mentorshipMessages.push({
            sender: 'system',
            message: 'Error: Empty PDF received from server.',
            timestamp: new Date()
          });
          return;
        }

        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `certificate_${this.currentConversationId}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        
        this.mentorshipMessages.push({
          sender: 'system',
          message: '📄 Certificate PDF downloaded successfully!',
          timestamp: new Date()
        });
      },
      error: (err) => {
        console.error('Error downloading certificate PDF:', err);
        this.mentorshipMessages.push({
          sender: 'system',
          message: 'Error downloading certificate PDF: ' + (err.message || 'Unknown error'),
          timestamp: new Date()
        });
      }
    });
  }

  closeCertificateModal(): void {
    this.showCertificateModal = false;
    this.conversationCertificate = null;
  }

  // WebSocket Message Handler
  handleWebSocketMessage(message: any): void {
    if (!message) return;

    switch (message.type) {
      case 'new_message':
        // Handle new message notification
        if (this.currentConversationId && this.currentConversationId === message.conversationId) {
          // Reload messages if the notification is for current conversation
          this.loadConversationMessages(this.currentConversationId);
        } else {
          // Show notification for other conversation
          this.showNotification(`New message from ${message.senderName}: ${message.content}`);
        }
        break;
      case 'session_request_response':
        // Handle session request response
        if (message.accepted) {
          this.showNotification('Your session request was accepted!');
        } else {
          this.showNotification('Your session request was declined.');
        }
        // Reload pending requests
        if (this.activeTab === 'mentorship') {
          this.loadPendingSessionRequests();
        }
        break;
      default:
        console.log('Unknown message type:', message.type);
    }
  }

  showNotification(message: string): void {
    // Simple notification - could be enhanced with a toast service
    console.log('Notification:', message);
    // For now, add as a system message if in mentorship chat
    if (this.mentorshipMessages) {
      this.mentorshipMessages.push({
        sender: 'system',
        message: message,
        timestamp: new Date()
      });
    }
  }

  loadInitialData(): void {
    this.loading = true;
    this.errorMessage = '';

    this.apiService.getClubMembers(this.clubId).subscribe({
      next: (members) => {
        this.members = members ?? [];
        this.loadCompetencies();
      },
      error: () => {
        this.errorMessage = 'Failed to load club members.';
        this.loading = false;
      }
    });
  }

  loadSpeechAnalyzerHealth(): void {
    this.apiService.getSpeechAnalyzerHealth().subscribe({
      next: (health: SpeechAnalyzerHealthResponse) => {
        this.speechHealthStatus = health.status;
        this.speechHealthModel = health.modelVersion;
      },
      error: () => {
        this.speechHealthStatus = 'degraded';
        this.speechHealthModel = 'unavailable';
      }
    });
  }

  loadCompetencies(): void {
    this.apiService.getCompetencies(this.clubId).subscribe({
      next: (items) => {
        this.competencies = items;
        this.loadMemberCompetencies();
      },
      error: () => {
        this.errorMessage = 'Failed to load competencies.';
        this.loading = false;
      }
    });
  }

  loadMemberCompetencies(): void {
    const request$ = this.isMemberRole
      ? this.apiService.getMemberCompetenciesByClub(this.clubId) // Load all club competencies for mentorship
      : this.apiService.getMemberCompetenciesByClub(this.clubId);

    request$.subscribe({
      next: (items) => {
        this.memberCompetencies = items;
        this.loadClubStats();
        this.refreshCalculatedData();
        this.initializeRecentActivities();
        this.initializeGoals();
        this.generateAIInsight();
        this.generateMentorshipSuggestions();

        if (this.selectedSpeechMemberCompetencyId === 0 && this.filteredPersonalCompetencies.length > 0) {
          this.selectedSpeechMemberCompetencyId = this.filteredPersonalCompetencies[0].id;
        }
        this.loading = false;
      },
      error: () => {
        this.errorMessage = 'Failed to load member competencies.';
        this.loading = false;
      }
    });
  }

  submit(): void {
    if (this.isEditing) {
      this.submitEdit();
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving = true;
    this.errorMessage = '';
    this.successMessage = '';

    const payload: MemberCompetencyRequest = {
      userId: this.form.controls.userId.value,
      skillId: this.form.controls.skillId.value,
      currentLevel: this.form.controls.currentLevel.value,
      targetLevel: this.form.controls.targetLevel.value
    };

    this.apiService.createMemberCompetency(payload).subscribe({
      next: () => {
        this.saving = false;
        this.successMessage = 'Member competency added.';
        this.form.reset({
          userId: 0,
          skillId: 0,
          currentLevel: 0,
          targetLevel: 0
        });
        this.loadMemberCompetencies();
      },
      error: () => {
        this.saving = false;
        this.errorMessage = 'Creation failed.';
      }
    });
  }

  submitEdit(): void {
    if (this.editingId === null) {
      return;
    }

    if (this.editForm.invalid) {
      this.editForm.markAllAsTouched();
      this.saving = false;
      return;
    }

    this.saving = true;
    this.errorMessage = '';
    this.successMessage = '';

    const oldLevel = this.editForm.controls.currentLevel.value;
    const payload: MemberCompetencyUpdateRequest = {
      currentLevel: this.editForm.controls.currentLevel.value,
      targetLevel: this.editForm.controls.targetLevel.value
    };

    this.apiService.updateMemberCompetency(this.editingId, payload).subscribe({
      next: (updated) => {
        this.saving = false;
        this.successMessage = 'Member competency mise a jour.';
        
        // Check if level increased
        if (updated.currentLevel > oldLevel) {
          this.triggerLevelUpEffects();
        }
        
        this.cancelEdit();
        this.loadMemberCompetencies();
      },
      error: () => {
        this.saving = false;
        this.errorMessage = 'Mise a jour impossible.';
      }
    });
  }

  edit(item: MemberCompetencyResponse): void {
    this.editingId = item.id;
    this.successMessage = '';
    this.errorMessage = '';
    this.form.patchValue({
      userId: item.userId,
      skillId: item.skillId
    });
    this.editForm.setValue({
      currentLevel: item.currentLevel,
      targetLevel: item.targetLevel
    });
  }

  cancelEdit(): void {
    this.editingId = null;
    this.editForm.reset({
      currentLevel: 0,
      targetLevel: 0
    });
  }

  delete(item: MemberCompetencyResponse): void {
    const confirmed = window.confirm(`Delete the relation ${item.skillName} for this member?`);
    if (!confirmed) {
      return;
    }

    this.apiService.deleteMemberCompetency(item.id).subscribe({
      next: () => {
        this.successMessage = 'Member competency supprimee.';
        this.memberCompetencies = this.memberCompetencies.filter(entry => entry.id !== item.id);
        this.refreshCalculatedData();
      },
      error: () => {
        this.errorMessage = 'Suppression impossible.';
      }
    });
  }

  endorse(item: MemberCompetencyResponse): void {
    const oldLevel = item.currentLevel;
    this.apiService.endorseMemberCompetencyByCompetency(item.userId, this.resolveCompetencyId(item)).subscribe({
      next: (updated) => {
        this.successMessage = 'Endorsement ajoute.';
        this.memberCompetencies = this.memberCompetencies.map(entry => entry.id === updated.id ? updated : entry);
        this.refreshCalculatedData();
        
        // Check if level increased (endorsement can trigger auto level-up every 3 endorsements)
        if (updated.currentLevel > oldLevel) {
          this.triggerLevelUpEffects();
        }
      },
      error: () => {
        this.errorMessage = 'Endorsement impossible.';
      }
    });
  }

  refreshGap(item: MemberCompetencyResponse): void {
    this.apiService.getMemberCompetencyGap(item.id).subscribe({
      next: (gap) => {
        this.memberCompetencies = this.memberCompetencies.map(entry =>
          entry.id === gap.id
            ? { ...entry, gap: gap.gap, gapLevel: gap.gap, currentLevel: gap.currentLevel, targetLevel: gap.targetLevel }
            : entry
        );
        this.refreshCalculatedData();
      }
    });
  }

  gapSeverity(item: MemberCompetencyResponse): 'critical' | 'warning' | 'ok' {
    const gap = this.getGapValue(item);
    if (gap >= 2) {
      return 'critical';
    }
    if (gap === 1) {
      return 'warning';
    }
    return 'ok';
  }

  competencyById(id: number): MemberCompetencyResponse | undefined {
    return this.filteredPersonalCompetencies.find(item => item.id === id);
  }

  gapDisplay(item: MemberCompetencyResponse): number {
    return this.getGapValue(item);
  }

  gapSeverityById(id: number): 'critical' | 'warning' | 'ok' {
    const competency = this.competencyById(id);
    if (!competency) {
      return 'ok';
    }
    return this.gapSeverity(competency);
  }

  gapDisplayById(id: number): number {
    const competency = this.competencyById(id);
    return competency ? this.gapDisplay(competency) : 0;
  }

  private loadClubStats(): void {
    this.apiService.getMemberCompetencyClubStats(this.clubId).subscribe({
      next: (stats) => {
        this.clubStats = stats;
      }
    });
  }

  private getGapValue(item: MemberCompetencyResponse): number {
    if (typeof item.gapLevel === 'number') {
      return item.gapLevel;
    }
    return item.gap;
  }

  private resolveCompetencyId(item: MemberCompetencyResponse): number {
    return item.competencyId ?? item.skillId;
  }

  syncSpeechReport(item: MemberCompetencyResponse): void {
    const sessionId = (this.speechSessionIds[item.id] || '').trim();
    if (!sessionId) {
      this.errorMessage = 'SessionId requis pour synchroniser le Speech Analyzer.';
      return;
    }

    this.speechSyncingId = item.id;
    this.errorMessage = '';
    this.successMessage = '';
    this.syncProgress = 0;

    if (this.syncProgressInterval) window.clearInterval(this.syncProgressInterval);
    this.syncProgressInterval = window.setInterval(() => {
      if (this.syncProgress < 92) {
        this.syncProgress += Math.random() * 8;
      }
    }, 450);

    const oldLevel = item.currentLevel;
    
    this.apiService.syncSpeechAnalyzerReport(item.id, sessionId).subscribe({
      next: (result) => {
        if (this.syncProgressInterval) window.clearInterval(this.syncProgressInterval);
        this.syncProgress = 100;

        this.memberCompetencies = this.memberCompetencies.map(entry =>
          entry.id === result.memberCompetency.id ? result.memberCompetency : entry
        );
        this.refreshCalculatedData();
        this.speechSessionIds[item.id] = '';
        if (this.globalSpeechSessionId === result.sessionId) {
          this.globalSpeechSessionId = '';
        }
        this.speechTestFeedback = result.feedback || '';
        this.successMessage = `Score synchronise (${result.speechScore}/100 - ${result.speechLevel}).`;
        
        // Check if level increased
        if (result.memberCompetency.currentLevel > oldLevel) {
          this.triggerLevelUpEffects();
        }
        
        setTimeout(() => {
          this.speechSyncingId = null;
          this.syncProgress = 0;
          this.liveSocketState = 'synced';
        }, 1000);

        this.closeSpeechSocket();
      },
      error: (error: Error) => {
        if (this.syncProgressInterval) window.clearInterval(this.syncProgressInterval);
        this.syncProgress = 0;
        this.errorMessage = error.message || 'Synchronisation Speech Analyzer impossible.';
        this.speechSyncingId = null;
      }
    });
  }

  syncSpeechReportFromPanel(): void {
    const selected = this.memberCompetencies.find(item => Number(item.id) === Number(this.selectedSpeechMemberCompetencyId));
    if (!selected) {
      this.errorMessage = 'Choisis une competency membre a synchroniser.';
      return;
    }

    const sessionId = this.globalSpeechSessionId.trim();
    if (!sessionId) {
      this.errorMessage = 'SessionId requis pour tester Speech Analyzer.';
      return;
    }

    this.speechSessionIds[selected.id] = sessionId;
    this.syncSpeechReport(selected);
  }

  pickRandomTopic(): void {
    if (this.randomTopics.length === 0) {
      return;
    }

    const randomIndex = Math.floor(Math.random() * this.randomTopics.length);
    this.speechTopic = this.randomTopics[randomIndex];
    this.successMessage = 'Sujet propose automatiquement. Clique sur Start Voice Test.';
  }

  async startSpeechTest(): Promise<void> {
    if (this.isRecordingSpeech) {
      return;
    }

    const selected = this.memberCompetencies.find(item => Number(item.id) === Number(this.selectedSpeechMemberCompetencyId));
    if (!selected || Number(this.selectedSpeechMemberCompetencyId) === 0) {
      this.errorMessage = 'Choisis une competency membre avant de demarrer le test vocal.';
      return;
    }

    const topic = this.speechTopic.trim() || 'Session Libre';

    if (!navigator.mediaDevices?.getUserMedia) {
      this.errorMessage = 'Le navigateur ne supporte pas l acces microphone.';
      return;
    }

    this.errorMessage = '';
    this.successMessage = '';
    this.speechTestFeedback = '';
    this.liveTranscript = '';
    this.recentTranscriptChunks = [];
    this.liveScore = 0;
    this.liveLevel = 'BEGINNER';
    this.liveSpeechRate = 0;
    this.livePausesPerMinute = 0;
    this.liveFillersPerMinute = 0;
    this.liveConfidence = 0;
    this.globalSpeechSessionId = this.generateSpeechSessionId(topic);
    this.liveSocketState = 'connecting';

    try {
      this.speechStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const wsUrl = this.buildSpeechWsUrl(this.globalSpeechSessionId);
      this.speechSocket = await this.openSpeechSocket(wsUrl);
      this.bindSpeechSocketEvents();
      this.sendSpeechTopicHint();
      this.setupPcmStreaming(this.speechStream);
      this.isRecordingSpeech = true;
      this.liveSocketState = 'recording';
      this.successMessage = `Sujet en cours: ${topic}. Parle maintenant puis clique sur Stop.`;
      this.speechSessionIds[selected.id] = this.globalSpeechSessionId;
    } catch (error) {
      this.errorMessage = this.extractBrowserError(error) || 'Impossible de demarrer le test vocal.';
      this.liveSocketState = 'idle';
      this.cleanupSpeechResources();
    }
  }

  stopSpeechTest(): void {
    if (!this.isRecordingSpeech) {
      this.liveSocketState = this.globalSpeechSessionId ? 'ready-to-sync' : 'idle';
      this.cleanupAudioCaptureResources();
      return;
    }

    this.liveSocketState = 'finalizing';
    this.isRecordingSpeech = false;

    if (this.pcmFlushTimer !== null) {
      window.clearInterval(this.pcmFlushTimer);
      this.pcmFlushTimer = null;
    }

    this.flushPcmBuffer(true);
    this.liveSocketState = this.globalSpeechSessionId ? 'ready-to-sync' : 'idle';
    
    // Give more time for the AI to deliver the final feedback (Groq/LLM latency)
    setTimeout(() => this.cleanupAudioCaptureResources(), 3000);

    if (this.globalSpeechSessionId) {
      this.successMessage = 'Enregistrement termine. Clique sur Sync Speech Result pour analyser et mettre a jour la competency.';
    }
  }

  private bindSpeechSocketEvents(): void {
    if (!this.speechSocket) return;

    this.speechSocket.onmessage = (event: MessageEvent<string>) => {
      try {
        const payload = JSON.parse(event.data);

        if (payload.type === 'realtime_metrics') {
          if (payload.transcript_partial) this.appendTranscriptPartial(payload.transcript_partial);
          if (typeof payload.score?.global_score === 'number') this.liveScore = Math.round(payload.score.global_score);
          if (payload.score?.level) this.liveLevel = payload.score.level;
          if (typeof payload.metrics?.speech_rate === 'number') this.liveSpeechRate = Math.round(payload.metrics.speech_rate);
          if (typeof payload.metrics?.whisper_confidence === 'number') this.liveConfidence = Math.round(payload.metrics.whisper_confidence * 100);
          if (typeof payload.metrics?.pauses?.pauses_per_minute === 'number') this.livePausesPerMinute = Math.round(payload.metrics.pauses.pauses_per_minute * 10) / 10;
          if (typeof payload.metrics?.fillers?.fillers_per_minute === 'number') this.liveFillersPerMinute = Math.round(payload.metrics.fillers.fillers_per_minute * 10) / 10;
        }

        if (payload.type === 'ai_feedback') {
          this.speechTestFeedback = payload.feedback || this.speechTestFeedback;
        }

        if (payload.type === 'error') {
          this.errorMessage = payload.message || 'Erreur WebSocket Speech Analyzer.';
        }
      } catch {
        this.errorMessage = 'Message Speech Analyzer invalide.';
      }
    };

    this.speechSocket.onclose = () => {
      if (this.isRecordingSpeech) {
        this.isRecordingSpeech = false;
        this.liveSocketState = this.globalSpeechSessionId ? 'ready-to-sync' : 'idle';
      }
    };
  }

  private buildSpeechWsUrl(sessionId: string): string {
    const wsBase = this.speechAnalyzerHttpBase.replace(/^http/i, 'ws');
    return `${wsBase}/ws/speech/${encodeURIComponent(sessionId)}`;
  }

  private openSpeechSocket(wsUrl: string): Promise<WebSocket> {
    return new Promise((resolve, reject) => {
      const socket = new WebSocket(wsUrl);
      socket.onopen = () => resolve(socket);
      socket.onerror = () => reject(new Error('WebSocket connection to Speech Analyzer failed.'));
    });
  }

  private generateSpeechSessionId(topic: string): string {
    const slug = topic.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 36);
    return `speech-${slug || 'test'}-${Date.now()}`;
  }

  private cleanupSpeechResources(): void {
    this.closeSpeechSocket();
    this.cleanupAudioCaptureResources();
  }

  private closeSpeechSocket(): void {
    if (this.speechSocket) {
      if (this.speechSocket.readyState === WebSocket.OPEN || this.speechSocket.readyState === WebSocket.CONNECTING) {
        this.speechSocket.close();
      }
      this.speechSocket = null;
    }
  }

  private cleanupAudioCaptureResources(): void {
    if (this.speechStream) {
      this.speechStream.getTracks().forEach(track => track.stop());
      this.speechStream = null;
    }
    if (this.pcmFlushTimer !== null) {
      window.clearInterval(this.pcmFlushTimer);
      this.pcmFlushTimer = null;
    }
    if (this.processorNode) {
      this.processorNode.disconnect();
      this.processorNode.onaudioprocess = null;
      this.processorNode = null;
    }
    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }
    if (this.silenceGainNode) {
      this.silenceGainNode.disconnect();
      this.silenceGainNode = null;
    }
    if (this.audioContext) {
      this.audioContext.close().catch(() => undefined);
      this.audioContext = null;
    }
    this.pcmChunks = [];
    this.pcmSamples = 0;
  }

  private setupPcmStreaming(stream: MediaStream): void {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) throw new Error('AudioContext non supporte');

    this.audioContext = new AudioCtx();
    this.sourceNode = this.audioContext.createMediaStreamSource(stream);
    this.processorNode = this.audioContext.createScriptProcessor(4096, 1, 1);
    this.silenceGainNode = this.audioContext.createGain();
    this.silenceGainNode.gain.value = 0;

    this.processorNode.onaudioprocess = (event: AudioProcessingEvent) => {
      if (!this.isRecordingSpeech) return;
      const input = event.inputBuffer.getChannelData(0);
      const chunk = new Float32Array(input.length);
      chunk.set(input);
      this.pcmChunks.push(chunk);
      this.pcmSamples += chunk.length;
    };

    this.sourceNode.connect(this.processorNode);
    this.processorNode.connect(this.silenceGainNode);
    this.silenceGainNode.connect(this.audioContext.destination);

    this.pcmFlushTimer = window.setInterval(() => this.flushPcmBuffer(false), this.speechFlushIntervalMs);
  }

  private sendSpeechTopicHint(): void {
    if (!this.speechSocket || this.speechSocket.readyState !== WebSocket.OPEN) return;
    const topic = this.speechTopic.trim();
    if (!topic) return;
    this.speechSocket.send(JSON.stringify({ type: 'set_topic', topic }));
  }

  private flushPcmBuffer(force: boolean): void {
    if (!this.speechSocket || this.speechSocket.readyState !== WebSocket.OPEN) {
      this.pcmChunks = [];
      this.pcmSamples = 0;
      return;
    }

    if (this.pcmSamples === 0) return;

    const sampleRate = this.audioContext?.sampleRate ?? 44100;
    const minSamples = Math.floor(sampleRate * this.speechMinChunkSeconds);
    if (!force && this.pcmSamples < minSamples) return;

    const merged = new Float32Array(this.pcmSamples);
    let offset = 0;
    for (const chunk of this.pcmChunks) {
      merged.set(chunk, offset);
      offset += chunk.length;
    }

    const wavBuffer = this.encodeWavMono16(merged, sampleRate);
    this.speechSocket.send(wavBuffer);
    this.pcmChunks = [];
    this.pcmSamples = 0;
  }

  private encodeWavMono16(samples: Float32Array, sampleRate: number): ArrayBuffer {
    const bytesPerSample = 2;
    const blockAlign = bytesPerSample;
    const byteRate = sampleRate * blockAlign;
    const dataSize = samples.length * bytesPerSample;
    const buffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buffer);

    const writeString = (offset: number, value: string) => {
      for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i));
    };

    writeString(0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, dataSize, true);

    let offset = 44;
    for (let i = 0; i < samples.length; i++) {
      const s = Math.max(-1, Math.min(1, samples[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      offset += 2;
    }
    return buffer;
  }

  private appendTranscriptPartial(partial: string): void {
    const cleaned = partial.replace(/\s+/g, ' ').trim();
    if (!cleaned) return;
    this.liveTranscript = `${this.liveTranscript} ${cleaned}`.trim();
  }

  private extractBrowserError(error: any): string {
    if (error instanceof DOMException) {
      if (error.name === 'NotAllowedError') return 'Microphone refuse.';
      if (error.name === 'NotFoundError') return 'Aucun micro detecte.';
      return error.message;
    }
    return error.message || '';
  }

  private updateRadarValues(): void {
    const skills = this.filteredPersonalCompetencies.slice(0, 8);
    
    this.radarChartData = {
      labels: skills.map(s => s.skillName),
      datasets: [
        {
          label: 'Current Level',
          data: skills.map(s => s.currentLevel),
          backgroundColor: 'rgba(59, 130, 246, 0.25)',
          borderColor: '#3b82f6',
          pointBackgroundColor: '#3b82f6',
          pointBorderColor: '#fff',
          pointHoverBackgroundColor: '#fff',
          pointHoverBorderColor: '#3b82f6',
          pointRadius: 5,
          pointHoverRadius: 7,
          borderWidth: 3,
          fill: true
        },
        {
          label: 'Target Level',
          data: skills.map(s => s.targetLevel),
          backgroundColor: 'rgba(16, 185, 129, 0.15)',
          borderColor: '#10b981',
          pointBackgroundColor: '#10b981',
          pointBorderColor: '#fff',
          pointHoverBackgroundColor: '#fff',
          pointHoverBorderColor: '#10b981',
          borderDash: [5, 5],
          borderWidth: 2
        }
      ]
    };
  }

  private getPersonalizedTip(item: MemberCompetencyResponse): string {
    const gap = this.getGapValue(item);
    if (gap <= 0) return 'Level achieved. Switch to mentoring mode.';
    if (gap === 1) return "You're close to the goal: do 1 practice session.";
    return 'Split the goal into 2 micro-steps.';
  }

  get improvementTips(): string[] {
    const tips: string[] = [];
    if (this.liveSpeechRate > 185) tips.push('Your pace is high. Slow down.');
    if (this.liveFillersPerMinute >= 3) tips.push('Too many filler words.');
    if (tips.length === 0) tips.push('Continue talking to get a report.');
    return tips;
  }

  getMemberLabel(userId: number): string {
    if (this.isMemberRole && userId === this.currentUserId) return this.currentUserFullName || 'My Profile';
    const member = this.members.find(item => item.userId === userId);
    return member ? [member.firstName, member.lastName].filter(Boolean).join(' ') || member.email || `User #${userId}` : `User #${userId}`;
  }

  getCompetencyLabel(skillId: number): string {
    return this.competencies.find(item => item.id === skillId)?.name || `Skill #${skillId}`;
  }

  levelBadgeClass(gap: number): string {
    if (gap <= 0) return 'badge badge--success';
    if (gap <= 20) return 'badge badge--warning';
    return 'badge badge--danger';
  }

  sourceLabel(source: MemberCompetencyResponse['lastUpdatedBy']): string {
    if (source === 'PEER_ENDORSEMENT') return 'Peer endorsement';
    if (source === 'LIVE_SESSION') return 'Live session';
    if (source === 'AI_COACH') return 'AI coach';
    if (source === 'SPEECH_ANALYZER') return 'Speech analyzer';
    return 'Manual';
  }

  sourceBadgeClass(source: MemberCompetencyResponse['lastUpdatedBy']): string {
    if (source === 'PEER_ENDORSEMENT') return 'badge badge--source-peer';
    if (source === 'LIVE_SESSION') return 'badge badge--source-live';
    if (source === 'AI_COACH') return 'badge badge--source-ai';
    if (source === 'SPEECH_ANALYZER') return 'badge badge--source-speech';
    return 'badge badge--source-manual';
  }

  viewStepSessions(step: LearningStep): void {
    this.selectedStepForSessions = step;
    this.showSessionsModal = true;
    this.stepSessions = [];
    this.isSessionsLoading = true;

    const mc = this.memberCompetencies.find(m => m.id === step.id);
    if (!mc) {
      this.isSessionsLoading = false;
      return;
    }

    const targetCompId = mc.competencyId || mc.skillId;

    const filterSessions = () => {
      this.stepSessions = this.allMemberSessions.filter(s => s.competencyId === targetCompId);
      this.isSessionsLoading = false;
    };

    if (this.allMemberSessions.length === 0) {
      const targetUserId = this.selectedMemberUserId || this.currentUserId;
      this.apiService.getMemberCompetencySessions(this.clubId, targetUserId).subscribe({
        next: (res) => {
          this.allMemberSessions = [...(res.upcoming || []), ...(res.past || [])];
          filterSessions();
        },
        error: (err) => {
          console.error('Failed to fetch sessions:', err);
          this.isSessionsLoading = false;
        }
      });
    } else {
      filterSessions();
    }
  }

  closeSessionsModal(): void {
    this.showSessionsModal = false;
    this.selectedStepForSessions = null;
    this.stepSessions = [];
  }

  trackById(_: number, item: MemberCompetencyResponse): number { return item.id; }

  // ─── Level Up Effects ────────────────────────────────────────────────────────

  /**
   * Déclenche les effets visuels lors d'une montée de niveau
   * - Confettis explosifs
   * - Animation de brillance sur les badges débloqués
   */
  private triggerLevelUpEffects(): void {
    // Lancer les confettis
    this.confettiService.celebrateLevelUp();
    
    // Activer le mode célébration
    this.isLevelUpCelebration = true;
    
    // Faire briller tous les badges débloqués
    const unlockedBadges = this.memberBadges.filter(b => b.unlocked).map(b => b.id);
    if (unlockedBadges.length > 0) {
      // Faire briller le premier badge débloqué puis les autres en séquence
      let index = 0;
      const glowInterval = setInterval(() => {
        if (index < unlockedBadges.length) {
          this.glowingBadgeId = unlockedBadges[index];
          index++;
        } else {
          clearInterval(glowInterval);
          this.glowingBadgeId = null;
          this.isLevelUpCelebration = false;
        }
      }, 300);
    }
    
    // Fallback: si aucun badge débloqué, faire briller le badge 'elite' par défaut
    if (unlockedBadges.length === 0) {
      this.glowingBadgeId = 'elite';
      setTimeout(() => {
        this.glowingBadgeId = null;
        this.isLevelUpCelebration = false;
      }, 2000);
    }
  }

  // ─── Quiz Logic ────────────────────────────────────────────────────────────

  startQuiz(skill: any): void {
    this.showQuizModal = true;
    this.isQuizLoading = true;
    this.currentQuiz = null;
    this.quizResult = null;
    this.showQuizReview = false;
    this.currentQuizQuestionIndex = 0;

    const roundedLevel = Math.floor(skill.current || 0);
    this.apiService.generateQuiz(skill.skillName, roundedLevel).subscribe({
      next: (quiz) => {
        this.currentQuiz = quiz;
        this.quizAnswers = new Array(quiz.questions.length).fill(null);
        this.isQuizLoading = false;
      },
      error: (err) => {
        console.error('Quiz generation failed:', err);
        this.isQuizLoading = false;
        this.errorMessage = 'Failed to generate quiz. Try again later.';
      }
    });
  }

  selectQuizOption(optionIndex: number): void {
    if (this.quizResult) return;
    this.quizAnswers[this.currentQuizQuestionIndex] = optionIndex;
  }

  nextQuizQuestion(): void {
    if (this.currentQuiz && this.currentQuizQuestionIndex < this.currentQuiz.questions.length - 1) {
      this.currentQuizQuestionIndex++;
    }
  }

  prevQuizQuestion(): void {
    if (this.currentQuizQuestionIndex > 0) {
      this.currentQuizQuestionIndex--;
    }
  }

  submitQuiz(): void {
    if (!this.currentQuiz) return;

    let correctCount = 0;
    this.currentQuiz.questions.forEach((q: any, i: number) => {
      if (this.quizAnswers[i] === q.correct_answer) {
        correctCount++;
      }
    });

    const score = Math.round((correctCount / this.currentQuiz.questions.length) * 100);
    
    // Find the member competency
    const mc = this.memberCompetencies.find(m => m.skillName === this.currentQuiz?.skill);
    if (!mc) return;

    const oldLevel = mc.currentLevel;
    let newLevel = oldLevel;

    // Logic: If score >= 80%, level up!
    if (score >= 80 && oldLevel < 5) {
      newLevel = oldLevel + 1;
      this.updateLevelAfterQuiz(mc, newLevel);
    }

    this.quizResult = { score, oldLevel, newLevel };
  }

  private updateLevelAfterQuiz(mc: MemberCompetencyResponse, newLevel: number): void {
    const userId = this.selectedMemberUserId || this.currentUserId;
    this.apiService.patchMemberCompetencyLevel(userId, mc.competencyId || mc.skillId, {
      newLevel: newLevel,
      source: 'AI_COACH'
    }).subscribe({
      next: () => {
        mc.currentLevel = newLevel;
        this.refreshCalculatedData();
        
        // Trigger level up effects
        this.triggerLevelUpEffects();
      },
      error: (err) => console.error('Failed to update level after quiz:', err)
    });
  }

  closeQuizModal(): void {
    this.showQuizModal = false;
    this.currentQuiz = null;
    this.quizResult = null;
    this.showQuizReview = false;
  }

  toggleQuizReview(): void {
    this.showQuizReview = !this.showQuizReview;
    this.currentQuizQuestionIndex = 0;
  }
  trackByMember(_: number, item: { userId: number }): number { return item.userId; }
  trackByCompetency(_: number, item: { id: number }): number { return item.id; }
}