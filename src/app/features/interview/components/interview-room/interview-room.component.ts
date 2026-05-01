import { Component, OnInit, OnDestroy, NgZone, ViewChild, ElementRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../../environments/environment.development';

@Component({
  selector: 'app-interview-room',
  templateUrl: './interview-room.component.html',
  styleUrl: './interview-room.component.scss'
})
export class InterviewRoomComponent implements OnInit, OnDestroy {
  @ViewChild('avatarVideo') avatarVideo!: ElementRef<HTMLVideoElement>;
  
  private _videoRef!: ElementRef<HTMLVideoElement>;
  @ViewChild('videoRef') set videoRefSetter(el: ElementRef<HTMLVideoElement>) {
    if (el) {
      this._videoRef = el;
      this.initWebcam();
    }
  }

  avatarSrc = 'assets/animations/avatar-idle.mp4';

  uniqueLink!: string;
  config: any = null;
  sessionId: string = '';
  messages: { role: 'recruiter' | 'candidate'; text: string }[] = [];
  isLoading = true;
  isRecruiterSpeaking = false;
  isListening = false;
  elapsedSec = 0;
  timerInterval: any;
  recognition: any = null;
  currentInterim = '';
  utteranceBuffer = '';
  silenceTimer: any = null;
  requestInFlight = false;
  synth = window.speechSynthesis;

  constructor(private route: ActivatedRoute, private router: Router, private http: HttpClient, private zone: NgZone) {}

  ngOnInit(): void {
    this.uniqueLink = this.route.snapshot.paramMap.get('uniqueLink')!;
    const nav = window.history.state;
    this.config = nav?.config;

    if (!this.config) {
      this.http.get(`${environment.userApiUrl}/api/interview-configs/link/${this.uniqueLink}`).subscribe({
        next: (data: any) => { this.config = data; this.startInterview(); },
        error: () => this.router.navigate(['/interview', this.uniqueLink])
      });
    } else {
      this.startInterview();
    }
  }

  initWebcam(): void {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices.getUserMedia({ video: true, audio: false })
        .then(stream => {
          if (this._videoRef && this._videoRef.nativeElement) {
            this._videoRef.nativeElement.srcObject = stream;
          }
        })
        .catch(err => console.error("Webcam error:", err));
    }
  }

  switchAvatar(talking: boolean): void {
    this.avatarSrc = talking
      ? 'assets/animations/avatar-talking.mp4'
      : 'assets/animations/avatar-idle.mp4';
    if (this.avatarVideo && this.avatarVideo.nativeElement) {
      setTimeout(() => {
        this.avatarVideo.nativeElement.load();
        this.avatarVideo.nativeElement.play().catch(e => console.error("Avatar playback error", e));
      }, 50);
    }
  }

  get lastRecruiterMessage(): string {
    const recruiterMsgs = this.messages.filter(m => m.role === 'recruiter');
    return recruiterMsgs.length > 0 ? recruiterMsgs[recruiterMsgs.length - 1].text : '';
  }

  startInterview(): void {
    const club = this.config?.application?.recruitmentCampaign?.club;
    const campaign = this.config?.application?.recruitmentCampaign;

    this.http.post(`${environment.userApiUrl}/api/ai-interview/start`, {
      clubName: club?.name || '',
      clubDescription: club?.description || '',
      campaignTitle: campaign?.title || '',
      candidateName: this.config?.application?.candidateName || '',
      presidentNotes: this.config?.presidentNotes || '',
      duration: this.config?.duration || 30,
      userId: this.config?.application?.id || 0,
      clubId: club?.id || 0
    }).subscribe({
      next: (res: any) => {
        this.sessionId = res.sessionId;
        const say = res.data?.say;
        if (say) {
          this.messages.push({ role: 'recruiter', text: say });
          this.speak(say);
        }
        this.isLoading = false;
        this.startTimer();
        this.initSpeechRecognition();
      },
      error: () => { this.isLoading = false; }
    });
  }

  speak(text: string): void {
    this.synth.cancel();
    this.isRecruiterSpeaking = true;
    this.switchAvatar(true);
    this.stopListening();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'fr-FR';
    const voices = this.synth.getVoices();
    const frVoice = voices.find(v => v.lang.startsWith('fr'));
    if (frVoice) utterance.voice = frVoice;
    utterance.onend = () => {
      this.zone.run(() => {
        this.isRecruiterSpeaking = false;
        this.switchAvatar(false);
        this.startListening();
      });
    };
    this.synth.speak(utterance);
  }

  initSpeechRecognition(): void {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    this.recognition = new SpeechRecognition();
    this.recognition.lang = 'fr-FR';
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.onresult = (event: any) => {
      this.zone.run(() => {
        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) {
            this.utteranceBuffer += event.results[i][0].transcript + ' ';
            this.resetSilenceTimer();
          } else {
            interim += event.results[i][0].transcript;
          }
        }
        this.currentInterim = interim;
      });
    };
    this.recognition.onerror = () => {};
    this.recognition.onend = () => {
      if (this.isListening && !this.isRecruiterSpeaking) {
        this.recognition.start();
      }
    };
  }

  startListening(): void {
    if (!this.recognition || this.isRecruiterSpeaking) return;
    this.isListening = true;
    try { this.recognition.start(); } catch(e) {}
  }

  stopListening(): void {
    this.isListening = false;
    try { this.recognition?.stop(); } catch(e) {}
  }

  resetSilenceTimer(): void {
    if (this.silenceTimer) clearTimeout(this.silenceTimer);
    this.silenceTimer = setTimeout(() => {
      const buffer = this.utteranceBuffer.trim();
      if (buffer.length > 5 && !this.requestInFlight && !this.isRecruiterSpeaking) {
        this.sendTurn(buffer);
        this.utteranceBuffer = '';
        this.currentInterim = '';
      }
    }, 1500);
  }

  sendTurn(candidateText: string): void {
    if (this.requestInFlight) return;
    this.requestInFlight = true;
    this.messages.push({ role: 'candidate', text: candidateText });
    this.stopListening();

    this.http.post(`${environment.userApiUrl}/api/ai-interview/turn`, {
      sessionId: this.sessionId,
      candidateText,
      elapsedSec: this.elapsedSec
    }).subscribe({
      next: (res: any) => {
        this.zone.run(() => {
          const say = res.data?.say;
          if (say) {
            this.messages.push({ role: 'recruiter', text: say });
            this.speak(say);
          } else {
            this.startListening();
          }
          this.requestInFlight = false;
        });
      },
      error: () => {
        this.zone.run(() => {
          this.requestInFlight = false;
          this.startListening();
        });
      }
    });
  }

  endInterview(): void {
    this.stopListening();
    this.synth.cancel();
    clearInterval(this.timerInterval);

    this.http.post(`${environment.userApiUrl}/api/ai-interview/end`, {
      sessionId: this.sessionId,
      uniqueLink: this.uniqueLink
    }).subscribe({
      next: () => {
        this.http.put(`${environment.userApiUrl}/api/interview-configs/link/${this.uniqueLink}/status?status=TERMINE`, {}).subscribe();
        this.router.navigate(['/interview/done']);
      },
      error: () => this.router.navigate(['/interview/done'])
    });
  }

  startTimer(): void {
    this.timerInterval = setInterval(() => {
      this.zone.run(() => this.elapsedSec++);
    }, 1000);
  }

  get formattedTime(): string {
    const m = Math.floor(this.elapsedSec / 60).toString().padStart(2, '0');
    const s = (this.elapsedSec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  ngOnDestroy(): void {
    this.stopListening();
    this.synth.cancel();
    clearInterval(this.timerInterval);
    if (this.silenceTimer) clearTimeout(this.silenceTimer);
    if (this._videoRef && this._videoRef.nativeElement && this._videoRef.nativeElement.srcObject) {
      const stream = this._videoRef.nativeElement.srcObject as MediaStream;
      stream.getTracks().forEach(t => t.stop());
    }
  }
}
