import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiService } from '../../../../core/services/api.service';
import { AuthHelperService } from '../../../../core/services/auth-helper.service';

interface ChatMessage {
  role: 'user' | 'recruiter';
  text: string;
  timestampMs: number;
}

@Component({
  selector: 'app-interview-simulator',
  templateUrl: './interview-simulator.component.html',
  styleUrls: ['./interview-simulator.component.scss'],
  standalone: false
})
export class InterviewSimulatorComponent implements OnInit, OnDestroy {
  // Config state
  positionId!: number;
  positionTitle = 'Chargement...';
  setupMode = true;
  isStarting = false;

  // Form selections
  language = 'FR'; // FR or EN
  durationMinutes = 10;

  // Interview state
  sessionId = '';
  interviewRunning = false;
  recruiterState: 'idle' | 'listening' | 'speaking' | 'thinking' | 'setup' = 'setup';
  
  // Timer
  timeLeft = 0;
  timerInterval: any;

  // Audio / Speech
  private recognition: any;
  interimTranscript = '';
  finalTranscript = '';
  displayedText = ''; // Subtitles for recruiter stream
  
  conversation: ChatMessage[] = [];

  // WebSocket
  private socket!: WebSocket;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private apiService: ApiService,
    private authHelper: AuthHelperService
  ) {}

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      this.positionId = Number(params.get('positionId'));
      this.loadPositionDetails();
    });
  }

  loadPositionDetails(): void {
    this.apiService.getVacantPosition(this.positionId).subscribe({
      next: (data) => {
        this.positionTitle = data.title;
      },
      error: () => {
        this.positionTitle = 'Poste introuvable';
      }
    });
  }

  startSimulation(): void {
    this.isStarting = true;
    const memberId = this.authHelper.getUserId();

    const payload = {
      positionId: this.positionId,
      memberId: memberId,
      language: this.language,
      duration: this.durationMinutes
    };

    this.apiService.startInterview(payload).subscribe({
      next: (response) => {
        this.sessionId = response.sessionId;
        this.setupMode = false;
        this.interviewRunning = true;
        this.recruiterState = 'idle';
        
        // Start systems
        this.connectWebSocket(this.sessionId);
        this.initSpeechRecognition(this.language);
        this.startTimer(this.durationMinutes);

        // Handle first question
        if (response.firstQuestion) {
          this.handleRecruiterMessage({ 
            text: response.firstQuestion, 
            isEnd: false 
          });
        }
      },
      error: (err) => {
        console.error('Failed to start interview', err);
        this.isStarting = false;
      }
    });
  }

  // --- WEBSOCKET --- //

  connectWebSocket(sessionId: string): void {
    const token = localStorage.getItem('token') || '';
    // Adjust URL if needed (using localhost:8081 as per instruction, could use environment variable in prod)
    this.socket = new WebSocket(`ws://localhost:8081/ws/interview?sessionId=${sessionId}&token=${token}`);
    
    this.socket.onopen = () => console.log('WebSocket connected');
    
    this.socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'RECRUITER_MESSAGE') {
          this.handleRecruiterMessage(data);
        }
      } catch (e) {
        console.error('Error parsing WS message', e);
      }
    };
    
    this.socket.onerror = (error) => console.error('WebSocket error', error);
    this.socket.onclose = () => console.log('WebSocket closed');
  }

  sendWebSocketMessage(userText: string): void {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({ type: 'USER_MESSAGE', text: userText }));
    }
  }

  disconnectWebSocket(): void {
    if (this.socket) {
      this.socket.close();
    }
  }

  // --- ACTIONS --- //

  handleRecruiterMessage(data: any): void {
    this.conversation.push({
      role: 'recruiter',
      text: data.text,
      timestampMs: Date.now()
    });
    
    // Stop listening while recruiter speaks
    this.stopListening();
    
    this.streamText(data.text);
    this.speakText(data.text);
    
    if (data.isEnd) {
      this.endInterview();
    }
  }

  streamText(fullText: string): void {
    const words = fullText.split(' ');
    let index = 0;
    this.displayedText = '';
    this.recruiterState = 'speaking';
    
    const interval = setInterval(() => {
      if (index < words.length) {
        this.displayedText += (index === 0 ? '' : ' ') + words[index];
        index++;
      } else {
        clearInterval(interval);
      }
    }, 80);
  }

  speakText(text: string): void {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = this.language === 'FR' ? 'fr-FR' : 'en-US';
    utterance.rate = 1.0;
    utterance.pitch = 1.1; // slightly higher pitch to sound "robotic/different"
    
    utterance.onstart = () => {
      this.recruiterState = 'speaking';
    };
    
    utterance.onend = () => {
      this.recruiterState = 'idle';
      if (this.interviewRunning) {
        setTimeout(() => this.startListening(), 500);
      }
    };

    utterance.onerror = (e) => {
       console.error("Speech synthesis error", e);
       this.recruiterState = 'idle';
       if(this.interviewRunning) this.startListening();
    };
    
    window.speechSynthesis.speak(utterance);
  }

  // --- SPEECH RECOGNITION (MIC) --- //

  initSpeechRecognition(lang: string): void {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Votre navigateur ne supporte pas la reconnaissance vocale. Veuillez utiliser Chrome.");
      return;
    }
    
    this.recognition = new SpeechRecognition();
    this.recognition.lang = lang === 'FR' ? 'fr-FR' : 'en-US';
    this.recognition.continuous = false;
    this.recognition.interimResults = true;

    this.recognition.onresult = (event: any) => {
      const transcript = Array.from(event.results)
        .map((result: any) => result[0].transcript)
        .join('');
      
      this.interimTranscript = transcript;
      
      // When the user stops speaking
      if (event.results[event.results.length - 1].isFinal) {
        this.finalTranscript = transcript;
        this.interimTranscript = '';
        this.onUserFinishedSpeaking(transcript);
      }
    };

    this.recognition.onend = () => {
      // Auto-restart only if interview is running and recruiter is not thinking/speaking
      if (this.interviewRunning && this.recruiterState === 'idle') {
        this.startListening();
      }
    };
    
    this.recognition.onerror = (event: any) => {
      if (event.error === 'no-speech' && this.interviewRunning && this.recruiterState === 'idle') {
        // Just restart if no speech was detected
        setTimeout(() => this.startListening(), 100);
      }
    };
  }

  startListening(): void {
    if (!this.interviewRunning || this.recruiterState === 'speaking' || !this.recognition) return;
    try {
      this.recruiterState = 'listening';
      this.recognition.start();
    } catch (e) {
      // recognition might already be started
    }
  }

  stopListening(): void {
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch (e) {}
    }
    this.interimTranscript = '';
  }

  onUserFinishedSpeaking(text: string): void {
    if (!text.trim()) {
      // if empty, restart listening
      if (this.interviewRunning) this.startListening();
      return;
    }
    this.recruiterState = 'thinking';
    // Add to chat history
    this.conversation.push({ role: 'user', text, timestampMs: Date.now() });
    // Send to backend
    this.sendWebSocketMessage(text);
  }

  // --- TIMER --- //

  startTimer(durationMinutes: number): void {
    this.timeLeft = durationMinutes * 60;
    this.timerInterval = setInterval(() => {
      if (this.timeLeft > 0) {
        this.timeLeft--;
      } else {
        clearInterval(this.timerInterval);
        this.endInterview();
      }
    }, 1000);
  }

  formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  // --- LIFECYCLE / CLEANUP --- //

  endInterview(): void {
    if (!this.interviewRunning) return;
    
    this.interviewRunning = false;
    clearInterval(this.timerInterval);
    this.stopListening();
    window.speechSynthesis.cancel();
    this.disconnectWebSocket();
    
    this.recruiterState = 'idle';

    if (this.sessionId) {
      this.apiService.endInterview({ sessionId: this.sessionId }).subscribe({
        next: () => {
          this.router.navigate(['/dashboard/elections/report', this.sessionId]);
        },
        error: (err) => {
          console.error('Error ending interview', err);
          this.router.navigate(['/dashboard/elections/report', this.sessionId]);
        }
      });
    } else {
      this.router.navigate(['/dashboard/elections/vacant-positions']);
    }
  }

  cancelSetup(): void {
    this.router.navigate(['/dashboard/elections/vacant-positions']);
  }

  ngOnDestroy(): void {
    this.interviewRunning = false;
    if (this.timerInterval) clearInterval(this.timerInterval);
    this.stopListening();
    window.speechSynthesis.cancel();
    this.disconnectWebSocket();
  }
}
