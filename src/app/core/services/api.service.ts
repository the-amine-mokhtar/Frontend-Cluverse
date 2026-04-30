import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../../environments/environment.development';

export interface HttpOptions {
  headers?: HttpHeaders | { [header: string]: string | string[] };
  params?: HttpParams | { [param: string]: string | number | boolean | ReadonlyArray<string | number | boolean> };
}

export type CompetencyCategory = 'SOFT' | 'HARD' | 'TECHNICAL';
export type UpdateSource = 'SPEECH_ANALYZER' | 'PEER_ENDORSEMENT' | 'LIVE_SESSION' | 'AI_COACH' | 'MANUAL';

export interface CompetencyRequest {
  name: string;
  description: string;
  category: CompetencyCategory;
  clubId: number;
}

export interface CompetencyResponse {
  id: number;
  name: string;
  description: string;
  category: CompetencyCategory;
  clubId: number;
}

export interface CompetencyBulkImportErrorResponse {
  rowNumber: number;
  name: string;
  message: string;
}

export interface CompetencyBulkImportResponse {
  clubId: number;
  totalRows: number;
  createdCount: number;
  skippedCount: number;
  createdCompetencies: CompetencyResponse[];
  errors: CompetencyBulkImportErrorResponse[];
}

export interface CompetencyCloneRequest {
  targetClubId: number;
}

export interface CompetencyStatsCompetencyResponse {
  competencyId: number;
  competencyName: string;
  memberCount: number;
  averageCurrentLevel: number;
  averageTargetLevel: number;
  averageGap: number;
}

export interface CompetencyStatsCategoryResponse {
  category: CompetencyCategory;
  competencyCount: number;
  memberCount: number;
  averageCurrentLevel: number;
  averageTargetLevel: number;
  averageGap: number;
}

export interface CompetencyStatsWeakCompetencyResponse {
  competencyId: number;
  competencyName: string;
  category: CompetencyCategory;
  memberCount: number;
  averageCurrentLevel: number;
  averageTargetLevel: number;
  averageGap: number;
}

export interface CompetencyStatsResponse {
  clubId: number;
  totalCompetencies: number;
  totalAssignments: number;
  membersPerCompetency: CompetencyStatsCompetencyResponse[];
  averageLevelByCategory: CompetencyStatsCategoryResponse[];
  weakestCompetencies: CompetencyStatsWeakCompetencyResponse[];
}

export interface MemberCompetencyRequest {
  userId: number;
  skillId?: number;
  competencyId?: number;
  currentLevel: number;
  targetLevel: number;
  lastUpdatedBy?: UpdateSource;
}

export interface MemberCompetencyUpdateRequest {
  currentLevel: number;
  targetLevel: number;
  lastUpdatedBy?: UpdateSource;
}

export interface MemberCompetencyResponse {
  id: number;
  userId: number;
  userName?: string;
  skillId: number;
  competencyId?: number;
  skillName: string;
  competencyName?: string;
  category: CompetencyCategory;
  competencyCategory?: string;
  currentLevel: number;
  targetLevel: number;
  previousLevel: number;
  endorsementCount: number;
  gap: number;
  gapLevel?: number;
  lastUpdatedBy: UpdateSource;
  lastUpdated: string;
}

export interface LevelUpdateRequest {
  newLevel: number;
  source?: UpdateSource;
}

export interface BulkTargetRequest {
  userIds: number[];
  skillId?: number;
  competencyId?: number;
  targetLevel: number;
}

export interface CVAnalysisCompetencyImpact {
  name: string;
  level: number;
  reason: string;
}

export interface ClubCompetencyStats {
  totalMembers: number;
  avgLevelAcrossAll: number;
  totalGaps: number;
  criticalGaps: number;
}

export interface CVAnalysisResponse {
  suggested_competencies: CVAnalysisCompetencyImpact[];
  overall_description: string;
}

export interface LearningResource {
  title: string;
  url: string;
  youtubeId?: string;
  searchQuery?: string;
  type: 'VIDEO' | 'ARTICLE' | 'COURSE' | 'BOOK';
  platform: string;
  description?: string;
}

export interface LearningPathResponse {
  skillName: string;
  targetLevel: number;
  currentLevel?: number;
  estimatedTime: string;
  resources: LearningResource[];
}

export interface ClubCompetencyStats {
  totalMembers: number;
  avgLevelAcrossAll: number;
  totalGaps: number;
  criticalGaps: number;
}

export interface QuizResponse {
  skill: string;
  level: string;
  questions: QuizQuestion[];
}

export interface MemberCompetencyGapResponse {
  id: number;
  currentLevel: number;
  targetLevel: number;
  gap: number;
}

export interface CompetencyMatchingRequest {
  clubId: number;
  contextType: 'MISSION' | 'EVENT' | 'POSITION';
  contextTitle?: string;
  requiredSkillIds: number[];
  topN?: number;
}

export interface CompetencyMatchCandidateResponse {
  userId: number;
  memberName: string;
  memberEmail: string;
  score: number;
  readiness: 'HIGH' | 'MEDIUM' | 'LOW';
  matchedSkills: number;
  totalRequiredSkills: number;
  averageGap: number;
  missingSkills: string[];
}

export interface CompetencyMatchingResponse {
  contextType: string;
  contextTitle: string;
  requestedSkills: number;
  candidatesEvaluated: number;
  recommendations: CompetencyMatchCandidateResponse[];
}

export interface SpeechAnalyzerHealthResponse {
  status: 'ok' | 'degraded' | string;
  whisperLoaded: boolean;
  modelVersion: string;
}

export interface SpeechAnalyzerSyncResponse {
  sessionId: string;
  speechScore: number;
  speechLevel: string;
  feedback: string;
  memberCompetency: MemberCompetencyResponse;
}

export type SessionStatus = 'SCHEDULED' | 'ONGOING' | 'COMPLETED' | 'CANCELLED';

export interface CompetencySessionParticipantResponse {
  userId: number;
  fullName: string;
  email: string;
  attended?: boolean | null;
}

export interface CompetencySessionResponse {
  id: number;
  clubId: number;
  competencyId: number;
  competencyName: string;
  title: string;
  coachUserId: number;
  coachName: string;
  meetLink?: string;
  startsAt: string;
  endsAt?: string;
  status: SessionStatus;
  participantCount: number;
  reportSummary?: string;
  cancellationReason?: string;
  attended?: boolean | null;
  participants?: CompetencySessionParticipantResponse[];
}

export interface AdminSessionMetricsResponse {
  totalSessions: number;
  upcomingSessions: number;
  completedThisMonth: number;
  cancelledSessions: number;
}

export interface AdminCompetencySessionsResponse {
  metrics: AdminSessionMetricsResponse;
  sessions: CompetencySessionResponse[];
}

export interface MemberSessionMetricsResponse {
  upcomingSessions: number;
  completedSessions: number;
  competenciesWorked: number;
}

export interface MemberCompetencySessionsResponse {
  metrics: MemberSessionMetricsResponse;
  upcoming: CompetencySessionResponse[];
  past: CompetencySessionResponse[];
}

export interface CompetencySessionScheduleRequest {
  clubId: number;
  competencyId: number;
  title: string;
  coachUserId: number;
  startsAt: string;
  meetLink?: string;
  participantUserIds: number[];
}

export interface SessionAttendanceUpdate {
  userId: number;
  attended: boolean;
}

export interface CompetencySessionCloseRequest {
  reportSummary?: string;
  autoGenerateReport?: boolean;
  speechSessionId?: string;
  attendance: SessionAttendanceUpdate[];
}

export interface SessionParticipantInviteRequest {
  participantUserIds: number[];
}

export interface CompetencySessionCancelRequest {
  reason?: string;
}

export interface CompetencySessionRescheduleRequest {
  startsAt: string;
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correct_answer: number;
  explanation: string;
}

export interface QuizResponse {
  skill: string;
  level: string;
  questions: QuizQuestion[];
}

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private baseUrl = environment.apiUrl;
  private speechUrl = (environment as any).speechUrl || 'http://localhost:8001';

  constructor(private http: HttpClient) {}

  //la fct pour recuperer les clubs
  getClubsNames(): Observable<string[]> {
    return this.http.get<string[]>(`${this.baseUrl}/api/clubs/names`);
  }

  //la fct pour ajouter un nouveau club
  applyForClubCreation(club: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/api/clubs`, club);
  }

  /**
   * Generic POST method
   */
  post<T>(endpoint: string, body: any, options?: HttpOptions): Observable<T> {
    return this.http.post<T>(`${this.baseUrl}${endpoint}`, body, options).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Generic PUT method
   */
  put<T>(endpoint: string, body: any, options?: HttpOptions): Observable<T> {
    return this.http.put<T>(`${this.baseUrl}${endpoint}`, body, options).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Generic DELETE method
   */
  delete<T>(endpoint: string, options?: HttpOptions): Observable<T> {
    return this.http.delete<T>(`${this.baseUrl}${endpoint}`, options).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Custom Error Handler
   */
  private handleError(error: any) {
    let errorMessage = 'An unknown error occurred!';

    if (error?.error instanceof ErrorEvent) {
      errorMessage = `Error: ${error.error.message}`;
    } else if (typeof error?.error === 'string' && error.error.trim()) {
      errorMessage = error.error.trim();
    } else if (typeof error?.error?.message === 'string' && error.error.message.trim()) {
      errorMessage = error.error.message.trim();
    } else if (typeof error?.error?.error === 'string' && error.error.error.trim()) {
      errorMessage = error.error.error.trim();
    } else if (typeof error?.message === 'string' && error.message.trim()) {
      errorMessage = error.message.trim();
    } else if (error?.status) {
      errorMessage = `Error Code: ${error.status}`;
    }

    console.error(errorMessage);
    return throwError(() => new Error(errorMessage));
  }

  login(connectionIdentifier: string, password: string, clubName: string): Observable<any> {
  return this.http.post(`${this.baseUrl}/api/auth/login-member`, {
    connectionIdentifier,
    password,
    clubName
  });
}
uploadClubLogo(clubId: number, formData: FormData): Observable<string> {
  return this.http.post(`${this.baseUrl}/api/clubs/${clubId}/logo`, formData, { responseType: 'text' });
}

getClubById(id: number): Observable<any> {
  return this.http.get(`${this.baseUrl}/api/clubs/${id}`);
}

checkEmailExists(email: string): Observable<boolean> {
  return this.http.get<boolean>(`${this.baseUrl}/api/clubs/check-email?email=${email}`);
}

// ─── Profile endpoints ─────────────────────────────────────────────────────

private authHeaders(): HttpHeaders {
  const token = localStorage.getItem('token') ?? '';
  return new HttpHeaders({ Authorization: `Bearer ${token}` });
}

getMyProfile(): Observable<any> {
  return this.http.get(`${this.baseUrl}/api/users/me`, {
    headers: this.authHeaders()
  }).pipe(catchError(this.handleError));
}

updateMyProfile(data: any): Observable<any> {
  return this.http.put(`${this.baseUrl}/api/users/me`, data, {
    headers: this.authHeaders()
  }).pipe(catchError(this.handleError));
}

updateMyPhoto(formData: FormData): Observable<string> {
  return this.http.post(`${this.baseUrl}/api/users/me/photo`, formData, {
    headers: this.authHeaders(),
    responseType: 'text'
  }).pipe(catchError(this.handleError));
}

refreshToken(): Observable<string> {
  return this.http.post<{ token: string; email: string }>(
    `${this.baseUrl}/api/auth/refresh-token`,
    {},
    { headers: this.authHeaders() }
  ).pipe(
    map((res: { token: string; email: string }) => res.token),
    catchError(this.handleError)
  );
}

// ─── Members ─────────────────────────────────────────────────────────────────

getClubMembers(clubId: number): Observable<any[]> {
  return this.http.get<any[]>(`${this.baseUrl}/api/clubs/${clubId}/members`, {
    headers: this.authHeaders()
  }).pipe(catchError(this.handleError));
}

inviteMember(clubId: number, email: string, role: string): Observable<any> {
  const headers = new HttpHeaders({
    'Authorization': `Bearer ${localStorage.getItem('token')}`,
    'Content-Type': 'application/json'
  });
  return this.http.post(`${this.baseUrl}/api/clubs/${clubId}/members/send-invite`, 
    { email, role }, 
    { headers, responseType: 'text' }
  );
}

removeMember(clubId: number, userId: number): Observable<any> {
  const headers = new HttpHeaders({
    'Authorization': `Bearer ${localStorage.getItem('token')}`
  });
  return this.http.delete(`${this.baseUrl}/api/clubs/${clubId}/members/${userId}`,
    { headers, responseType: 'text' }
  );
}

deactivateMember(clubId: number, userId: number): Observable<any> {
  const headers = new HttpHeaders({
    'Authorization': `Bearer ${localStorage.getItem('token')}`
  });
  return this.http.put(
    `${this.baseUrl}/api/clubs/${clubId}/members/${userId}/deactivate`,
    {},
    { headers, responseType: 'text' }
  );
}

activateMember(clubId: number, userId: number): Observable<any> {
  const headers = new HttpHeaders({
    'Authorization': `Bearer ${localStorage.getItem('token')}`
  });
  return this.http.put(
    `${this.baseUrl}/api/clubs/${clubId}/members/${userId}/activate`,
    {},
    { headers, responseType: 'text' }
  );
}

updateMemberRole(clubId: number, userId: number, role: string): Observable<any> {
  const headers = new HttpHeaders({
    'Authorization': `Bearer ${localStorage.getItem('token')}`
  });
  return this.http.put(
    `${this.baseUrl}/api/clubs/${clubId}/members/${userId}/role?role=${encodeURIComponent(role)}`,
    {},
    { headers, responseType: 'text' }
  );
}

// ─── Recruitment API Methods ─────────────────────────────────────────────── //

getClubCampaigns(clubId: number): Observable<any[]> {
  const headers = new HttpHeaders({ 'Authorization': `Bearer ${localStorage.getItem('token')}` });
  return this.http.get<any[]>(`${this.baseUrl}/api/recruitment/campaigns/club/${clubId}`, { headers });
}

createCampaign(clubId: number, campaign: any): Observable<any> {
  const headers = new HttpHeaders({ 'Authorization': `Bearer ${localStorage.getItem('token')}` });
  return this.http.post<any>(`${this.baseUrl}/api/recruitment/campaigns?clubId=${clubId}`, campaign, { headers });
}

updateCampaign(id: number, campaign: any): Observable<any> {
  const headers = new HttpHeaders({ 'Authorization': `Bearer ${localStorage.getItem('token')}` });
  return this.http.put<any>(`${this.baseUrl}/api/recruitment/campaigns/${id}`, campaign, { headers });
}

getCampaign(id: number): Observable<any> {
  const headers = new HttpHeaders({ 'Authorization': `Bearer ${localStorage.getItem('token')}` });
  return this.http.get<any>(`${this.baseUrl}/api/recruitment/campaigns/${id}`, { headers });
}

deleteCampaign(id: number): Observable<any> {
  const headers = new HttpHeaders({ 'Authorization': `Bearer ${localStorage.getItem('token')}` });
  return this.http.delete(`${this.baseUrl}/api/recruitment/campaigns/${id}`, { headers, responseType: 'text' });
}

// ─── Questions ───

addQuestion(campaignId: number, question: any): Observable<any> {
  const headers = new HttpHeaders({ 'Authorization': `Bearer ${localStorage.getItem('token')}` });
  return this.http.post<any>(`${this.baseUrl}/api/recruitment/campaigns/${campaignId}/questions`, question, { headers });
}

updateQuestion(id: number, question: any): Observable<any> {
  const headers = new HttpHeaders({ 'Authorization': `Bearer ${localStorage.getItem('token')}` });
  return this.http.put<any>(`${this.baseUrl}/api/recruitment/questions/${id}`, question, { headers });
}

generateQuestions(campaignId: number, body: any): Observable<any[]> {
  return this.http.post<any[]>(
    `${this.baseUrl}/api/recruitment/campaigns/${campaignId}/generate-questions`,
    body,
    { headers: this.authHeaders() }
  ).pipe(catchError(this.handleError));
}

deleteQuestion(id: number): Observable<any> {
  const headers = new HttpHeaders({
    'Authorization': `Bearer ${localStorage.getItem('token')}`
  });
  return this.http.delete(`${this.baseUrl}/api/recruitment/questions/${id}`, 
    { headers, responseType: 'text' }
  );
}

// ─── Applications ───

getCampaignApplications(campaignId: number): Observable<any[]> {
  const headers = new HttpHeaders({ 'Authorization': `Bearer ${localStorage.getItem('token')}` });
  return this.http.get<any[]>(`${this.baseUrl}/api/recruitment/campaigns/${campaignId}/applications`, { headers });
}

updateApplicationStatus(id: number, status: string): Observable<any> {
  const headers = new HttpHeaders({ 'Authorization': `Bearer ${localStorage.getItem('token')}` });
  return this.http.put(`${this.baseUrl}/api/recruitment/applications/${id}/status?status=${encodeURIComponent(status)}`, {}, { headers, responseType: 'text' });
}

getCampaignStats(campaignId: number): Observable<any> {
  const headers = new HttpHeaders({ 'Authorization': `Bearer ${localStorage.getItem('token')}` });
  return this.http.get<any>(`${this.baseUrl}/api/recruitment/campaigns/${campaignId}/stats`, { headers });
}

exportApplicationsCSV(campaignId: number): Observable<Blob> {
  const headers = new HttpHeaders({ 'Authorization': `Bearer ${localStorage.getItem('token')}` });
  return this.http.get(`${this.baseUrl}/api/recruitment/campaigns/${campaignId}/export/csv`, { headers, responseType: 'blob' });
}

// ─── Notifications ───

getNotifications(clubId: number): Observable<any[]> {
  const headers = new HttpHeaders({ 'Authorization': `Bearer ${localStorage.getItem('token')}` });
  return this.http.get<any[]>(`${this.baseUrl}/api/notifications?clubId=${clubId}`, { headers });
}

markNotificationRead(id: number): Observable<any> {
  const headers = new HttpHeaders({ 'Authorization': `Bearer ${localStorage.getItem('token')}` });
  return this.http.put(`${this.baseUrl}/api/notifications/${id}/read`, {}, { headers, responseType: 'text' });
}

markAllNotificationsRead(clubId: number): Observable<any> {
  const headers = new HttpHeaders({ 'Authorization': `Bearer ${localStorage.getItem('token')}` });
  return this.http.put(`${this.baseUrl}/api/notifications/read-all?clubId=${clubId}`, {}, { headers, responseType: 'text' });
}

// ─── Public Unauthenticated API Methods ───

getCampaignByPublicLink(publicLink: string): Observable<any> {
  // Graceful handling of possible missing endpoint or 404
  return this.http.get<any>(`${this.baseUrl}/api/recruitment/campaigns/public/${encodeURIComponent(publicLink)}`);
}

  applyToCampaign(campaignId: number, submission: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/api/recruitment/campaigns/${campaignId}/apply`, submission, { responseType: 'text' });
  }

  // ─── Elections Voice Interview ─── //

  getVacantPositions(clubId: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/api/elections/positions?clubId=${clubId}`, { headers: this.authHeaders() });
  }

  getVacantPosition(id: number): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/api/elections/positions/${id}`, { headers: this.authHeaders() });
  }

  createVacantPosition(clubId: number, position: any): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/api/elections/positions?clubId=${clubId}`, position, { headers: this.authHeaders() });
  }

  startInterview(data: any): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/api/elections/interview/start`, data, { headers: this.authHeaders() });
  }

  endInterview(data: any): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/api/elections/interview/end`, data, { headers: this.authHeaders() });
  }

  getInterviewReport(sessionId: string): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/api/elections/interview/report/${sessionId}`, { headers: this.authHeaders() });
  }

  // ─── Competencies ──────────────────────────────────────────────────────────

  getCompetencies(clubId: number): Observable<CompetencyResponse[]> {
    return this.http.get<CompetencyResponse[]>(`${this.baseUrl}/api/competencies?clubId=${clubId}`, {
      headers: this.authHeaders()
    }).pipe(catchError(this.handleError));
  }

  uploadCompetencyBulkImport(clubId: number, file: File): Observable<CompetencyBulkImportResponse> {
    const formData = new FormData();
    formData.append('file', file);

    return this.http.post<CompetencyBulkImportResponse>(`${this.baseUrl}/api/competencies/bulk?clubId=${clubId}`, formData, {
      headers: this.authHeaders()
    }).pipe(catchError(this.handleError));
  }

  cloneCompetency(id: number, payload: CompetencyCloneRequest): Observable<CompetencyResponse> {
    return this.http.post<CompetencyResponse>(`${this.baseUrl}/api/competencies/${id}/clone`, payload, {
      headers: this.authHeaders()
    }).pipe(catchError(this.handleError));
  }

  getCompetencyStats(clubId: number): Observable<CompetencyStatsResponse> {
    return this.http.get<CompetencyStatsResponse>(`${this.baseUrl}/api/competencies/stats?clubId=${clubId}`, {
      headers: this.authHeaders()
    }).pipe(catchError(this.handleError));
  }

  createCompetency(payload: CompetencyRequest): Observable<CompetencyResponse> {
    return this.http.post<CompetencyResponse>(`${this.baseUrl}/api/competencies`, payload, {
      headers: this.authHeaders()
    }).pipe(catchError(this.handleError));
  }

  updateCompetency(id: number, payload: CompetencyRequest): Observable<CompetencyResponse> {
    return this.http.put<CompetencyResponse>(`${this.baseUrl}/api/competencies/${id}`, payload, {
      headers: this.authHeaders()
    }).pipe(catchError(this.handleError));
  }

  deleteCompetency(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/api/competencies/${id}`, {
      headers: this.authHeaders()
    }).pipe(catchError(this.handleError));
  }

  getMemberCompetenciesByClub(clubId: number): Observable<MemberCompetencyResponse[]> {
    return this.http.get<MemberCompetencyResponse[]>(`${this.baseUrl}/api/member-competencies/club/${clubId}`, {
      headers: this.authHeaders()
    }).pipe(catchError(this.handleError));
  }

  getMemberCompetenciesByUser(userId: number): Observable<MemberCompetencyResponse[]> {
    return this.http.get<MemberCompetencyResponse[]>(`${this.baseUrl}/api/member-competencies/user/${userId}`, {
      headers: this.authHeaders()
    }).pipe(catchError(this.handleError));
  }

  getMemberCompetencyClubStats(clubId: number): Observable<ClubCompetencyStats> {
    return this.http.get<ClubCompetencyStats>(`${this.baseUrl}/api/member-competencies/club/${clubId}/stats`, {
      headers: this.authHeaders()
    }).pipe(catchError(this.handleError));
  }

  createMemberCompetency(payload: MemberCompetencyRequest): Observable<MemberCompetencyResponse> {
    return this.http.post<MemberCompetencyResponse>(`${this.baseUrl}/api/member-competencies`, payload, {
      headers: this.authHeaders()
    }).pipe(catchError(this.handleError));
  }

  assignCompetency(payload: MemberCompetencyRequest): Observable<MemberCompetencyResponse> {
    // Correct endpoint: POST /api/member-competencies
    return this.http.post<MemberCompetencyResponse>(`${this.baseUrl}/api/member-competencies`, payload, {
      headers: this.authHeaders()
    }).pipe(catchError(this.handleError));
  }

  updateMemberCompetency(id: number, payload: MemberCompetencyUpdateRequest): Observable<MemberCompetencyResponse> {
    return this.http.put<MemberCompetencyResponse>(`${this.baseUrl}/api/member-competencies/${id}`, payload, {
      headers: this.authHeaders()
    }).pipe(catchError(this.handleError));
  }

  deleteMemberCompetency(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/api/member-competencies/${id}`, {
      headers: this.authHeaders()
    }).pipe(catchError(this.handleError));
  }

  endorseMemberCompetency(id: number): Observable<MemberCompetencyResponse> {
    return this.http.post<MemberCompetencyResponse>(`${this.baseUrl}/api/member-competencies/${id}/endorse`, {}, {
      headers: this.authHeaders()
    }).pipe(catchError(this.handleError));
  }

  endorseMemberCompetencyByCompetency(userId: number, competencyId: number): Observable<MemberCompetencyResponse> {
    return this.http.patch<MemberCompetencyResponse>(
      `${this.baseUrl}/api/member-competencies/${userId}/competency/${competencyId}/endorse`,
      {},
      { headers: this.authHeaders() }
    ).pipe(catchError(this.handleError));
  }

  patchMemberCompetencyLevel(userId: number, competencyId: number, payload: LevelUpdateRequest): Observable<MemberCompetencyResponse> {
    return this.http.patch<MemberCompetencyResponse>(
      `${this.baseUrl}/api/member-competencies/${userId}/competency/${competencyId}/level`,
      payload,
      { headers: this.authHeaders() }
    ).pipe(catchError(this.handleError));
  }

  bulkSetMemberCompetencyTarget(payload: BulkTargetRequest): Observable<{ updated: number }> {
    return this.http.patch<{ updated: number }>(`${this.baseUrl}/api/member-competencies/bulk-target`, payload, {
      headers: this.authHeaders()
    }).pipe(catchError(this.handleError));
  }

  getMemberCompetencyGap(id: number): Observable<MemberCompetencyGapResponse> {
    return this.http.get<MemberCompetencyGapResponse>(`${this.baseUrl}/api/member-competencies/${id}/gap`, {
      headers: this.authHeaders()
    }).pipe(catchError(this.handleError));
  }

  getCompetencyMatching(payload: CompetencyMatchingRequest): Observable<CompetencyMatchingResponse> {
    return this.http.post<CompetencyMatchingResponse>(`${this.baseUrl}/api/member-competencies/matching`, payload, {
      headers: this.authHeaders()
    }).pipe(catchError(this.handleError));
  }

  getSpeechAnalyzerHealth(): Observable<SpeechAnalyzerHealthResponse> {
    return this.http.get<SpeechAnalyzerHealthResponse>(`${this.baseUrl}/api/member-competencies/speech-analyzer/health`, {
      headers: this.authHeaders()
    }).pipe(catchError(this.handleError));
  }

  syncSpeechAnalyzerReport(memberCompetencyId: number, sessionId: string): Observable<SpeechAnalyzerSyncResponse> {
    return this.http.post<SpeechAnalyzerSyncResponse>(
      `${this.baseUrl}/api/member-competencies/${memberCompetencyId}/speech-analyzer/sync/${encodeURIComponent(sessionId)}`,
      {},
      {
        headers: this.authHeaders()
      }
    ).pipe(catchError(this.handleError));
  }

  analyzeCV(userId: number, clubId: number, file: File): Observable<CVAnalysisResponse> {
    const formData = new FormData();
    formData.append('userId', String(userId));
    formData.append('clubId', String(clubId));
    formData.append('file', file);

    return this.http.post<CVAnalysisResponse>(`${this.baseUrl}/api/member-competencies/cv/analyze`, formData, {
      headers: this.authHeaders()
    }).pipe(catchError(this.handleError));
  }

  generateLearningPath(skillName: string, targetLevel: number): Observable<LearningPathResponse> {
    return this.http.get<LearningPathResponse>(`${this.baseUrl}/api/member-competencies/cv/learning-path/generate`, {
      headers: this.authHeaders(),
      params: { skillName, targetLevel: targetLevel.toString() }
    }).pipe(catchError(this.handleError));
  }

  getAdminCompetencySessions(clubId: number, params?: { status?: string; competencyId?: number; coachUserId?: number; search?: string }): Observable<AdminCompetencySessionsResponse> {
    let httpParams = new HttpParams().set('clubId', String(clubId));
    if (params?.status) {
      httpParams = httpParams.set('status', params.status);
    }
    if (params?.competencyId) {
      httpParams = httpParams.set('competencyId', String(params.competencyId));
    }
    if (params?.coachUserId) {
      httpParams = httpParams.set('coachUserId', String(params.coachUserId));
    }
    if (params?.search) {
      httpParams = httpParams.set('search', params.search);
    }

    return this.http.get<AdminCompetencySessionsResponse>(`${this.baseUrl}/api/competency-sessions/admin`, {
      headers: this.authHeaders(),
      params: httpParams
    }).pipe(catchError(this.handleError));
  }

  getMemberCompetencySessions(clubId: number, userId: number): Observable<MemberCompetencySessionsResponse> {
    const params = new HttpParams()
      .set('clubId', String(clubId))
      .set('userId', String(userId));

    return this.http.get<MemberCompetencySessionsResponse>(`${this.baseUrl}/api/competency-sessions/member`, {
      headers: this.authHeaders(),
      params
    }).pipe(catchError(this.handleError));
  }

  scheduleCompetencySession(payload: CompetencySessionScheduleRequest): Observable<CompetencySessionResponse> {
    return this.http.post<CompetencySessionResponse>(`${this.baseUrl}/api/competency-sessions/schedule`, payload, {
      headers: this.authHeaders()
    }).pipe(catchError(this.handleError));
  }

  closeCompetencySession(sessionId: number, payload: CompetencySessionCloseRequest): Observable<CompetencySessionResponse> {
    return this.http.post<CompetencySessionResponse>(`${this.baseUrl}/api/competency-sessions/${sessionId}/close`, payload, {
      headers: this.authHeaders()
    }).pipe(catchError(this.handleError));
  }

  cancelCompetencySession(sessionId: number, payload?: CompetencySessionCancelRequest): Observable<CompetencySessionResponse> {
    return this.http.patch<CompetencySessionResponse>(`${this.baseUrl}/api/competency-sessions/${sessionId}/cancel`, payload ?? {}, {
      headers: this.authHeaders()
    }).pipe(catchError(this.handleError));
  }

  rescheduleCompetencySession(sessionId: number, payload: CompetencySessionRescheduleRequest): Observable<CompetencySessionResponse> {
    return this.http.patch<CompetencySessionResponse>(`${this.baseUrl}/api/competency-sessions/${sessionId}/reschedule`, payload, {
      headers: this.authHeaders()
    }).pipe(catchError(this.handleError));
  }

  getCompetencySessionParticipants(sessionId: number): Observable<CompetencySessionParticipantResponse[]> {
    return this.http.get<CompetencySessionParticipantResponse[]>(`${this.baseUrl}/api/competency-sessions/${sessionId}/participants`, {
      headers: this.authHeaders()
    }).pipe(catchError(this.handleError));
  }

  inviteCompetencySessionParticipants(sessionId: number, payload: SessionParticipantInviteRequest): Observable<CompetencySessionParticipantResponse[]> {
    return this.http.post<CompetencySessionParticipantResponse[]>(`${this.baseUrl}/api/competency-sessions/${sessionId}/participants/invite`, payload, {
      headers: this.authHeaders()
    }).pipe(catchError(this.handleError));
  }

  getCompetencySessionReport(sessionId: number, userId?: number): Observable<CompetencySessionResponse> {
    let params = new HttpParams();
    if (userId) {
      params = params.set('userId', String(userId));
    }
    return this.http.get<CompetencySessionResponse>(`${this.baseUrl}/api/competency-sessions/${sessionId}/report`, {
      headers: this.authHeaders(),
      params
    }).pipe(catchError(this.handleError));
  }

  generateQuiz(skillName: string, level: number): Observable<QuizResponse> {
    return this.http.post<QuizResponse>(`${this.speechUrl}/quiz/generate`, {
      skill_name: skillName,
      level
    }).pipe(catchError(this.handleError));
  }

  // Mentorship API methods
  createMentorshipConversation(mentorId: number, menteeId: number, clubId: number, 
    skillName: string, mentorLevel: number, menteeLevel: number): Observable<any> {
    let params = new HttpParams()
      .set('mentorId', mentorId)
      .set('menteeId', menteeId)
      .set('clubId', clubId)
      .set('skillName', skillName)
      .set('mentorLevel', mentorLevel)
      .set('menteeLevel', menteeLevel);
    
    return this.http.post(`${this.baseUrl}/api/mentorship/conversations`, null, {
      headers: this.authHeaders(),
      params
    }).pipe(catchError(this.handleError));
  }

  getUserMentorshipConversations(userId: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/api/mentorship/conversations/user/${userId}`, {
      headers: this.authHeaders()
    }).pipe(catchError(this.handleError));
  }

  getMentorshipConversationMessages(conversationId: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/api/mentorship/conversations/${conversationId}/messages`, {
      headers: this.authHeaders()
    }).pipe(catchError(this.handleError));
  }

  sendMentorshipMessage(conversationId: number, senderId: number, content: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/api/mentorship/conversations/${conversationId}/messages`, 
      content, {
      headers: this.authHeaders(),
      params: new HttpParams().set('senderId', senderId)
    }).pipe(catchError(this.handleError));
  }

  markMentorshipMessagesAsRead(conversationId: number, userId: number): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/api/mentorship/conversations/${conversationId}/read`, null, {
      headers: this.authHeaders(),
      params: new HttpParams().set('userId', userId)
    }).pipe(catchError(this.handleError));
  }

  // Mentorship Session Request API methods
  createMentorshipSessionRequest(conversationId: number, requesterId: number, requestedUserId: number, 
    proposedDateTime: string, description: string): Observable<any> {
    let params = new HttpParams()
      .set('conversationId', conversationId)
      .set('requesterId', requesterId)
      .set('requestedUserId', requestedUserId)
      .set('proposedDateTime', proposedDateTime)
      .set('description', description);
    
    return this.http.post(`${this.baseUrl}/api/mentorship/session-requests`, null, {
      headers: this.authHeaders(),
      params
    }).pipe(catchError(this.handleError));
  }

  respondToMentorshipSessionRequest(requestId: number, userId: number, accepted: boolean, responseMessage?: string): Observable<any> {
    let params = new HttpParams()
      .set('userId', userId)
      .set('accepted', accepted);
    
    if (responseMessage) {
      params = params.set('responseMessage', responseMessage);
    }
    
    return this.http.post(`${this.baseUrl}/api/mentorship/session-requests/${requestId}/respond`, null, {
      headers: this.authHeaders(),
      params
    }).pipe(catchError(this.handleError));
  }

  getPendingMentorshipRequests(userId: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/api/mentorship/session-requests/pending/${userId}`, {
      headers: this.authHeaders()
    }).pipe(catchError(this.handleError));
  }

  getUserMentorshipRequests(userId: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/api/mentorship/session-requests/user/${userId}`, {
      headers: this.authHeaders()
    }).pipe(catchError(this.handleError));
  }

  // Mentorship Feedback API methods
  submitMentorshipFeedback(conversationId: number, giverId: number, receiverId: number, 
    rating: number, comment?: string): Observable<any> {
    let params = new HttpParams()
      .set('conversationId', conversationId)
      .set('giverId', giverId)
      .set('receiverId', receiverId)
      .set('rating', rating);
    
    if (comment) {
      params = params.set('comment', comment);
    }
    
    return this.http.post(`${this.baseUrl}/api/mentorship/feedback`, null, {
      headers: this.authHeaders(),
      params
    }).pipe(catchError(this.handleError));
  }

  getConversationFeedback(conversationId: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/api/mentorship/feedback/conversation/${conversationId}`, {
      headers: this.authHeaders()
    }).pipe(catchError(this.handleError));
  }

  getUserReceivedFeedback(userId: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/api/mentorship/feedback/received/${userId}`, {
      headers: this.authHeaders()
    }).pipe(catchError(this.handleError));
  }

  // Mentorship Goals API methods
  createMentorshipGoal(conversationId: number, menteeId: number, title: string, 
    description?: string, targetDate?: string): Observable<any> {
    let params = new HttpParams()
      .set('conversationId', conversationId)
      .set('menteeId', menteeId)
      .set('title', title);
    
    if (description) params = params.set('description', description);
    if (targetDate) params = params.set('targetDate', targetDate);
    
    return this.http.post(`${this.baseUrl}/api/mentorship/goals`, null, {
      headers: this.authHeaders(),
      params
    }).pipe(catchError(this.handleError));
  }

  updateGoalProgress(goalId: number, progress: number): Observable<any> {
    return this.http.put(`${this.baseUrl}/api/mentorship/goals/${goalId}/progress`, null, {
      headers: this.authHeaders(),
      params: new HttpParams().set('progress', progress)
    }).pipe(catchError(this.handleError));
  }

  getConversationGoals(conversationId: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/api/mentorship/goals/conversation/${conversationId}`, {
      headers: this.authHeaders()
    }).pipe(catchError(this.handleError));
  }

  getMenteeGoals(menteeId: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/api/mentorship/goals/mentee/${menteeId}`, {
      headers: this.authHeaders()
    }).pipe(catchError(this.handleError));
  }

  areAllGoalsCompleted(conversationId: number): Observable<boolean> {
    return this.http.get<boolean>(`${this.baseUrl}/api/mentorship/goals/${conversationId}/completed`, {
      headers: this.authHeaders()
    }).pipe(catchError(this.handleError));
  }

  // Mentorship Certificate API methods
  generateCertificate(conversationId: number): Observable<any> {
    return this.http.post(`${this.baseUrl}/api/mentorship/certificates/generate`, null, {
      headers: this.authHeaders(),
      params: new HttpParams().set('conversationId', conversationId)
    }).pipe(catchError(this.handleError));
  }

  getCertificateByConversation(conversationId: number): Observable<any> {
    return this.http.get(`${this.baseUrl}/api/mentorship/certificates/conversation/${conversationId}`, {
      headers: this.authHeaders()
    }).pipe(catchError(this.handleError));
  }

  getMenteeCertificates(menteeId: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/api/mentorship/certificates/mentee/${menteeId}`, {
      headers: this.authHeaders()
    }).pipe(catchError(this.handleError));
  }

  getMentorCertificates(mentorId: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/api/mentorship/certificates/mentor/${mentorId}`, {
      headers: this.authHeaders()
    }).pipe(catchError(this.handleError));
  }

  downloadCertificatePdf(conversationId: number): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/api/mentorship/certificates/${conversationId}/pdf`, {
      headers: this.authHeaders(),
      responseType: 'blob'
    }).pipe(catchError(this.handleError));
  }

  
  passToInterview(applicationId: number, config: any): Observable<any> {
    return this.http.post(
      `${this.baseUrl}/api/applications/${applicationId}/interview`,
      config,
      { headers: this.authHeaders() }
    ).pipe(catchError(this.handleError));
  }

  getInterviewResult(applicationId: number): Observable<any> {
    return this.http.get<any>(
      `${this.baseUrl}/api/interview-configs/application/${applicationId}/result`,
      { headers: this.authHeaders() }
    ).pipe(catchError(this.handleError));
  }

  getInterviewMessages(applicationId: number): Observable<any[]> {
    return this.http.get<any[]>(
      `${this.baseUrl}/api/interview-configs/application/${applicationId}/messages`,
      { headers: this.authHeaders() }
    ).pipe(catchError(this.handleError));
  }

// ─── Member Payments ──────────────────────────────────────────────────────────

  getMemberPayments(clubId: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/api/member-payments?clubId=${clubId}`, {
      headers: this.authHeaders()
    }).pipe(catchError(this.handleError));
  }

  createMemberPayment(membershipId: number, clubId: number, payment: { amount: number; status: string; dueDate: string }): Observable<any> {
    return this.http.post<any>(
      `${this.baseUrl}/api/member-payments?membershipId=${membershipId}&clubId=${clubId}`,
      payment,
      { headers: this.authHeaders() }
    ).pipe(catchError(this.handleError));
  }

  updateMemberPayment(id: number, payment: any): Observable<any> {
    return this.http.put<any>(`${this.baseUrl}/api/member-payments/${id}`, payment, {
      headers: this.authHeaders()
    }).pipe(catchError(this.handleError));
  }

  deleteMemberPayment(id: number): Observable<any> {
    return this.http.delete(`${this.baseUrl}/api/member-payments/${id}`, {
      headers: this.authHeaders(), responseType: 'text'
    }).pipe(catchError(this.handleError));
  }

  sendPaymentReminders(clubId: number): Observable<number> {
    return this.http.post<number>(
      `${this.baseUrl}/api/member-payments/remind?clubId=${clubId}`,
      {},
      { headers: this.authHeaders() }
    ).pipe(catchError(this.handleError));
  }

  forgotPassword(email: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/api/auth/forgot-password`, { email }, { responseType: 'text' })
      .pipe(catchError(this.handleError));
  }

  resetPassword(token: string, newPassword: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/api/auth/reset-password`, { token, newPassword }, { responseType: 'text' })
      .pipe(catchError(this.handleError));
  }
}


