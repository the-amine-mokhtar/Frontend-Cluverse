import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import {
  ApiService,
  CompetencyResponse,
  MemberCompetencyRequest,
  MemberCompetencyResponse,
  MemberCompetencyUpdateRequest,
  SpeechAnalyzerHealthResponse
} from '../../../../core/services/api.service';
import { AuthHelperService } from '../../../../core/services/auth-helper.service';

@Component({
  selector: 'app-member-competencies',
  templateUrl: './member-competencies.component.html',
  styleUrls: ['./member-competencies.component.scss']
})
export class MemberCompetenciesComponent implements OnInit, OnDestroy {
  private readonly speechAnalyzerHttpBase = 'http://127.0.0.1:8001';
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

  members: Array<{ userId: number; firstName?: string; lastName?: string; email?: string }> = [];
  competencies: CompetencyResponse[] = [];
  memberCompetencies: MemberCompetencyResponse[] = [];

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

  readonly randomTopics = [
    'Presente-toi en 60 secondes et explique ton role ideal dans le club.',
    'Raconte une situation ou tu as resolu un probleme difficile en equipe.',
    'Defends une idee innovante pour ameliorer l engagement des membres.',
    'Comment gererais-tu un conflit entre deux responsables de pôle ?',
    'Pitch un mini-projet concret a lancer ce mois-ci dans ton club.'
  ];

  readonly form = this.fb.nonNullable.group({
    userId: [0, [Validators.required, Validators.min(1)]],
    skillId: [0, [Validators.required, Validators.min(1)]],
    currentLevel: [0, [Validators.required, Validators.min(0), Validators.max(100)]],
    targetLevel: [0, [Validators.required, Validators.min(0), Validators.max(100)]]
  });

  readonly editForm = this.fb.nonNullable.group({
    currentLevel: [0, [Validators.required, Validators.min(0), Validators.max(100)]],
    targetLevel: [0, [Validators.required, Validators.min(0), Validators.max(100)]]
  });

  constructor(
    private readonly fb: FormBuilder,
    private readonly apiService: ApiService,
    private readonly authHelperService: AuthHelperService
  ) {}

  ngOnDestroy(): void {
    this.stopSpeechTest();
  }

  ngOnInit(): void {
    this.clubId = this.authHelperService.getClubId();
    if (!this.clubId) {
      this.errorMessage = 'Club introuvable. Reconnecte-toi puis reessaie.';
      return;
    }

    this.loadInitialData();
    this.loadSpeechAnalyzerHealth();
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

  get filteredMemberCompetencies(): MemberCompetencyResponse[] {
    return this.selectedMemberUserId > 0
      ? this.memberCompetencies.filter(item => item.userId === this.selectedMemberUserId)
      : this.memberCompetencies;
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
        this.errorMessage = 'Impossible de charger les membres du club.';
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
        this.errorMessage = 'Impossible de charger les competencies.';
        this.loading = false;
      }
    });
  }

  loadMemberCompetencies(): void {
    this.apiService.getMemberCompetenciesByClub(this.clubId).subscribe({
      next: (items) => {
        this.memberCompetencies = items;
        if (this.selectedSpeechMemberCompetencyId === 0 && this.memberCompetencies.length > 0) {
          this.selectedSpeechMemberCompetencyId = this.memberCompetencies[0].id;
        }
        this.loading = false;
      },
      error: () => {
        this.errorMessage = 'Impossible de charger les member competencies.';
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
        this.successMessage = 'Member competency ajoutee.';
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
        this.errorMessage = 'Creation impossible.';
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

    const payload: MemberCompetencyUpdateRequest = {
      currentLevel: this.editForm.controls.currentLevel.value,
      targetLevel: this.editForm.controls.targetLevel.value
    };

    this.apiService.updateMemberCompetency(this.editingId, payload).subscribe({
      next: () => {
        this.saving = false;
        this.successMessage = 'Member competency mise a jour.';
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
    const confirmed = window.confirm(`Supprimer la relation ${item.skillName} pour ce membre ?`);
    if (!confirmed) {
      return;
    }

    this.apiService.deleteMemberCompetency(item.id).subscribe({
      next: () => {
        this.successMessage = 'Member competency supprimee.';
        this.memberCompetencies = this.memberCompetencies.filter(entry => entry.id !== item.id);
      },
      error: () => {
        this.errorMessage = 'Suppression impossible.';
      }
    });
  }

  endorse(item: MemberCompetencyResponse): void {
    this.apiService.endorseMemberCompetency(item.id).subscribe({
      next: (updated) => {
        this.successMessage = 'Endorsement ajoute.';
        this.memberCompetencies = this.memberCompetencies.map(entry => entry.id === updated.id ? updated : entry);
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
          entry.id === gap.id ? { ...entry, gap: gap.gap, currentLevel: gap.currentLevel, targetLevel: gap.targetLevel } : entry
        );
      }
    });
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

    this.apiService.syncSpeechAnalyzerReport(item.id, sessionId).subscribe({
      next: (result) => {
        this.memberCompetencies = this.memberCompetencies.map(entry =>
          entry.id === result.memberCompetency.id ? result.memberCompetency : entry
        );
        this.speechSessionIds[item.id] = '';
        if (this.globalSpeechSessionId === result.sessionId) {
          this.globalSpeechSessionId = '';
        }
        this.speechTestFeedback = result.feedback || '';
        this.successMessage = `Score synchronise (${result.speechScore}/100 - ${result.speechLevel}).`;
        this.speechSyncingId = null;
        this.liveSocketState = 'synced';
        this.closeSpeechSocket();
      },
      error: (error: Error) => {
        this.errorMessage = error.message || 'Synchronisation Speech Analyzer impossible.';
        this.speechSyncingId = null;
      }
    });
  }

  syncSpeechReportFromPanel(): void {
    const selected = this.memberCompetencies.find(item => item.id === this.selectedSpeechMemberCompetencyId);
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

    const selected = this.memberCompetencies.find(item => item.id === this.selectedSpeechMemberCompetencyId);
    if (!selected) {
      this.errorMessage = 'Choisis une competency membre avant de demarrer le test vocal.';
      return;
    }

    const topic = this.speechTopic.trim();
    if (!topic) {
      this.errorMessage = 'Donne un sujet avant de commencer.';
      return;
    }

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

      const recorderOptions = this.buildRecorderOptions();
      if (!recorderOptions) {
        this.errorMessage = 'Capture audio non supportee par ce navigateur.';
        this.liveSocketState = 'idle';
        this.cleanupSpeechResources();
        return;
      }

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
    setTimeout(() => this.cleanupAudioCaptureResources(), 300);

    if (this.globalSpeechSessionId) {
      this.successMessage = 'Enregistrement termine. Clique sur Sync Speech Result pour analyser et mettre a jour la competency.';
    }
  }

  private bindSpeechSocketEvents(): void {
    if (!this.speechSocket) {
      return;
    }

    this.speechSocket.onmessage = (event: MessageEvent<string>) => {
      try {
        const payload = JSON.parse(event.data) as {
          type?: string;
          transcript_partial?: string;
          score?: { global_score?: number; level?: string };
          metrics?: {
            speech_rate?: number;
            whisper_confidence?: number;
            pauses?: { pauses_per_minute?: number };
            fillers?: { fillers_per_minute?: number };
          };
          feedback?: string;
          message?: string;
        };

        if (payload.type === 'realtime_metrics') {
          if (payload.transcript_partial) {
            this.appendTranscriptPartial(payload.transcript_partial);
          }
          if (typeof payload.score?.global_score === 'number') {
            this.liveScore = Math.round(payload.score.global_score);
          }
          if (payload.score?.level) {
            this.liveLevel = payload.score.level;
          }
          if (typeof payload.metrics?.speech_rate === 'number') {
            this.liveSpeechRate = Math.round(payload.metrics.speech_rate);
          }
          if (typeof payload.metrics?.whisper_confidence === 'number') {
            this.liveConfidence = Math.round(payload.metrics.whisper_confidence * 100);
          }
          if (typeof payload.metrics?.pauses?.pauses_per_minute === 'number') {
            this.livePausesPerMinute = Math.round(payload.metrics.pauses.pauses_per_minute * 10) / 10;
          }
          if (typeof payload.metrics?.fillers?.fillers_per_minute === 'number') {
            this.liveFillersPerMinute = Math.round(payload.metrics.fillers.fillers_per_minute * 10) / 10;
          }
          return;
        }

        if (payload.type === 'ai_feedback') {
          this.speechTestFeedback = payload.feedback || this.speechTestFeedback;
          return;
        }

        if (payload.type === 'topic_set') {
          return;
        }

        if (payload.type === 'error') {
          this.errorMessage = payload.message || 'Erreur WebSocket Speech Analyzer.';
        }
      } catch {
        this.errorMessage = 'Message Speech Analyzer invalide.';
      }
    };

    this.speechSocket.onclose = () => {
      if (!this.isRecordingSpeech) {
        return;
      }
      this.isRecordingSpeech = false;
      this.liveSocketState = this.globalSpeechSessionId ? 'ready-to-sync' : 'idle';
    };
  }

  private buildSpeechWsUrl(sessionId: string): string {
    const wsBase = this.speechAnalyzerHttpBase.replace(/^http/i, 'ws');
    return `${wsBase}/ws/speech/${encodeURIComponent(sessionId)}`;
  }

  private openSpeechSocket(wsUrl: string): Promise<WebSocket> {
    return new Promise((resolve, reject) => {
      const socket = new WebSocket(wsUrl);
      const onOpen = () => {
        socket.removeEventListener('error', onError);
        resolve(socket);
      };
      const onError = () => {
        socket.removeEventListener('open', onOpen);
        reject(new Error('Connexion WebSocket impossible vers Speech Analyzer.'));
      };

      socket.addEventListener('open', onOpen, { once: true });
      socket.addEventListener('error', onError, { once: true });
    });
  }

  private buildRecorderOptions(): { supported: true } | null {
    const AudioCtx = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) {
      return null;
    }
    return { supported: true };
  }

  private generateSpeechSessionId(topic: string): string {
    const slug = topic
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 36);
    return `speech-${slug || 'test'}-${Date.now()}`;
  }

  private cleanupSpeechResources(): void {
    this.closeSpeechSocket();
    this.cleanupAudioCaptureResources();
  }

  private closeSpeechSocket(): void {
    if (!this.speechSocket) {
      return;
    }

    if (this.speechSocket.readyState === WebSocket.OPEN || this.speechSocket.readyState === WebSocket.CONNECTING) {
      this.speechSocket.close();
    }
    this.speechSocket = null;
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
      try {
        this.processorNode.disconnect();
      } catch {
        // no-op
      }
      this.processorNode.onaudioprocess = null;
      this.processorNode = null;
    }

    if (this.sourceNode) {
      try {
        this.sourceNode.disconnect();
      } catch {
        // no-op
      }
      this.sourceNode = null;
    }

    if (this.silenceGainNode) {
      try {
        this.silenceGainNode.disconnect();
      } catch {
        // no-op
      }
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
    const AudioCtx = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) {
      throw new Error('AudioContext non supporte');
    }

    this.audioContext = new AudioCtx();
    this.sourceNode = this.audioContext.createMediaStreamSource(stream);
    this.processorNode = this.audioContext.createScriptProcessor(4096, 1, 1);
    this.silenceGainNode = this.audioContext.createGain();
    this.silenceGainNode.gain.value = 0;

    this.processorNode.onaudioprocess = (event: AudioProcessingEvent) => {
      if (!this.isRecordingSpeech) {
        return;
      }

      const input = event.inputBuffer.getChannelData(0);
      const chunk = new Float32Array(input.length);
      chunk.set(input);
      this.pcmChunks.push(chunk);
      this.pcmSamples += chunk.length;
    };

    this.sourceNode.connect(this.processorNode);
    this.processorNode.connect(this.silenceGainNode);
    this.silenceGainNode.connect(this.audioContext.destination);

    this.pcmFlushTimer = window.setInterval(() => {
      this.flushPcmBuffer(false);
    }, this.speechFlushIntervalMs);
  }

  private sendSpeechTopicHint(): void {
    if (!this.speechSocket || this.speechSocket.readyState !== WebSocket.OPEN) {
      return;
    }

    const topic = this.speechTopic.trim();
    if (!topic) {
      return;
    }

    this.speechSocket.send(JSON.stringify({
      type: 'set_topic',
      topic
    }));
  }

  private flushPcmBuffer(force: boolean): void {
    if (!this.speechSocket || this.speechSocket.readyState !== WebSocket.OPEN) {
      this.pcmChunks = [];
      this.pcmSamples = 0;
      return;
    }

    if (this.pcmSamples === 0) {
      return;
    }

    const sampleRate = this.audioContext?.sampleRate ?? 44100;
    const minSamples = Math.floor(sampleRate * this.speechMinChunkSeconds);
    if (!force && this.pcmSamples < minSamples) {
      return;
    }

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

    const writeString = (offset: number, value: string): void => {
      for (let index = 0; index < value.length; index += 1) {
        view.setUint8(offset + index, value.charCodeAt(index));
      }
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
    for (let i = 0; i < samples.length; i += 1) {
      const s = Math.max(-1, Math.min(1, samples[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      offset += 2;
    }

    return buffer;
  }

  private appendTranscriptPartial(partial: string): void {
    const cleaned = partial.replace(/\s+/g, ' ').trim();
    if (!cleaned) {
      return;
    }

    const normalized = this.normalizeTranscriptChunk(cleaned);
    const lastChunk = this.recentTranscriptChunks[this.recentTranscriptChunks.length - 1] || '';

    // Drop near-identical consecutive chunks that often appear during live ASR streaming.
    if (normalized && (normalized === lastChunk || lastChunk.endsWith(normalized) || normalized.endsWith(lastChunk))) {
      return;
    }

    this.recentTranscriptChunks.push(normalized);
    if (this.recentTranscriptChunks.length > this.transcriptHistoryLimit) {
      this.recentTranscriptChunks.shift();
    }

    const merged = `${this.liveTranscript} ${cleaned}`.trim();
    this.liveTranscript = this.squashRepeatedPhrases(merged);
  }

  private normalizeTranscriptChunk(value: string): string {
    return value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private squashRepeatedPhrases(text: string): string {
    const trimmed = text.trim();
    if (!trimmed) {
      return '';
    }

    const tokens = trimmed.split(/\s+/);
    if (tokens.length < 6) {
      return trimmed;
    }

    const output: string[] = [];
    let index = 0;

    while (index < tokens.length) {
      let collapsed = false;
      const maxSize = Math.min(8, Math.floor((tokens.length - index) / 2));

      for (let size = maxSize; size >= 2; size -= 1) {
        const phrase = tokens.slice(index, index + size).join(' ').toLowerCase();
        let nextIndex = index + size;
        let repeats = 1;

        while (nextIndex + size <= tokens.length) {
          const candidate = tokens.slice(nextIndex, nextIndex + size).join(' ').toLowerCase();
          if (candidate !== phrase) {
            break;
          }
          repeats += 1;
          nextIndex += size;
        }

        if (repeats > 1) {
          output.push(...tokens.slice(index, index + size));
          index = nextIndex;
          collapsed = true;
          break;
        }
      }

      if (!collapsed) {
        output.push(tokens[index]);
        index += 1;
      }
    }

    return output.join(' ').replace(/\s+([,.;:!?])/g, '$1').trim();
  }

  private extractBrowserError(error: unknown): string {
    if (error instanceof DOMException) {
      if (error.name === 'NotAllowedError') {
        return 'Microphone refuse. Autorise le micro dans le navigateur.';
      }
      if (error.name === 'NotFoundError') {
        return 'Aucun micro detecte sur cette machine.';
      }
      return error.message;
    }

    if (error instanceof Error) {
      return error.message;
    }

    return '';
  }

  get improvementTips(): string[] {
    const tips: string[] = [];
    const reliablePace = this.liveConfidence >= 82;

    if (reliablePace && this.liveSpeechRate > 185) {
      tips.push('Ton debit est eleve. Ralentis legerement pour mieux articuler.');
    } else if (reliablePace && this.liveSpeechRate > 0 && this.liveSpeechRate < 105) {
      tips.push('Ton debit est un peu lent. Accelere un peu pour garder l attention.');
    }

    if (this.liveFillersPerMinute >= 3) {
      tips.push('Tu utilises beaucoup de mots de remplissage. Fais des pauses silencieuses a la place.');
    }

    if (this.livePausesPerMinute > 12) {
      tips.push('Il y a beaucoup de pauses. Essaie des phrases plus courtes et enchaine les idees.');
    }

    if (this.liveConfidence > 0 && this.liveConfidence < 55) {
      tips.push('La transcription est peu confiante. Parle plus pres du micro et dans un environnement calme.');
    }

    if (this.liveScore >= 75) {
      tips.push('Bonne performance globale. Travaille la structure des arguments pour passer au niveau superieur.');
    } else if (this.liveScore > 0 && this.liveScore < 45) {
      tips.push('Commence par une structure simple: introduction, 2 points cles, conclusion.');
    }

    if (tips.length === 0) {
      tips.push('Continue a parler 45-90 secondes pour obtenir un rapport plus stable.');
    }

    return tips;
  }

  getMemberLabel(userId: number): string {
    const member = this.members.find(item => item.userId === userId);
    if (!member) {
      return `User #${userId}`;
    }

    return [member.firstName, member.lastName].filter(Boolean).join(' ') || member.email || `User #${userId}`;
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

  trackById(_: number, item: MemberCompetencyResponse): number {
    return item.id;
  }

  trackByMember(_: number, item: { userId: number }): number {
    return item.userId;
  }

  trackByCompetency(_: number, item: { id: number }): number {
    return item.id;
  }
}
