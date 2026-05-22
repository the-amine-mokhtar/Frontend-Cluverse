import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { forkJoin } from 'rxjs';
import { environment } from '../../../../environments/environment.development';
import { AuthHelperService } from '../../../core/services/auth-helper.service';
import { FinanceService, TransactionDto, BudgetDto } from '../../../core/services/finance.service';
import { AgentContext, FinancialAgentService } from '../../services/financial-agent.service';

interface ChatMessage {
  role: 'user' | 'bot';
  content: string;
  time: string;
}

interface QuickAction {
  label: string;
  prompt: string;
}

interface ISpeechRecognition extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onresult: ((ev: any) => void) | null;
  onend: (() => void) | null;
  onerror: ((ev: Event) => void) | null;
}

declare global {
  interface Window {
    SpeechRecognition: new () => ISpeechRecognition;
    webkitSpeechRecognition: new () => ISpeechRecognition;
  }
}

const WRITE_INTENTS = new Set([
  'ADD_TRANSACTION', 'EDIT_TRANSACTION', 'DELETE_TRANSACTION',
  'ADD_BUDGET', 'UPDATE_BUDGET'
]);

@Component({
  selector: 'app-financial-agent-widget',
  templateUrl: './financial-agent-widget.component.html',
  styleUrl: './financial-agent-widget.component.scss'
})
export class FinancialAgentWidgetComponent implements OnInit, OnDestroy {
  @ViewChild('messagesEl') private messagesEl!: ElementRef<HTMLDivElement>;

  isOpen = false;
  isHovered = false;
  isTyping = false;
  isListening = false;
  draft = '';
  lang: 'en' | 'fr' = 'en';
  sessionId: string = this.generateUUID();

  private transactions: TransactionDto[] = [];
  private budgets: BudgetDto[] = [];

  messages: ChatMessage[] = [
    {
      role: 'bot',
      content: "Hi! I'm your AI Finance Assistant. I can see your real transactions and budgets. How can I help?",
      time: this.now()
    }
  ];

  quickActionsEn: QuickAction[] = [
    { label: 'Transactions', prompt: 'Show my transactions' },
    { label: 'Budgets',      prompt: 'Show budget overview' },
    { label: 'Insights',     prompt: 'Give me financial insights' },
    { label: 'Anomalies',    prompt: 'Detect spending anomalies' }
  ];

  quickActionsFr: QuickAction[] = [
    { label: 'Transactions', prompt: 'Afficher mes transactions' },
    { label: 'Budgets',      prompt: 'Vue des budgets' },
    { label: 'Analyses',     prompt: 'Donner des insights financiers' },
    { label: 'Anomalies',    prompt: 'Détecter les anomalies de dépenses' }
  ];

  get quickActions(): QuickAction[] {
    return this.lang === 'fr' ? this.quickActionsFr : this.quickActionsEn;
  }

  private recognition: ISpeechRecognition | null = null;

  constructor(
    private readonly agentService: FinancialAgentService,
    private readonly financeService: FinanceService,
    private readonly authHelper: AuthHelperService
  ) {}

  ngOnInit(): void {
    this.loadRealData();
  }

  private loadRealData(): void {
    const clubId = this.authHelper.getClubId();
    if (!clubId) return;

    forkJoin({
      transactions: this.financeService.getTransactions(clubId),
      budgets:      this.financeService.getBudgets(clubId)
    }).subscribe({
      next: ({ transactions, budgets }) => {
        this.transactions = transactions;
        this.budgets      = budgets;
      }
    });
  }

  private buildContext(): AgentContext {
    return {
      transactions: this.transactions,
      budgets:      this.budgets,
      apiUrl:       environment.apiUrl,
      token:        localStorage.getItem('token') ?? '',
      clubId:       this.authHelper.getClubId()
    };
  }

  togglePanel(): void {
    this.isOpen = !this.isOpen;
    if (this.isOpen) {
      this.loadRealData();
      setTimeout(() => this.scrollToBottom(), 100);
    }
  }

  toggleLang(): void {
    this.lang = this.lang === 'en' ? 'fr' : 'en';
    const msg = this.lang === 'fr' ? 'Langue changée en français.' : 'Language switched to English.';
    this.messages.push({ role: 'bot', content: msg, time: this.now() });
    this.scrollToBottom();
  }

  sendQuick(action: QuickAction): void {
    this.draft = action.prompt;
    this.send();
  }

  send(): void {
    const text = this.draft.trim();
    if (!text || this.isTyping) return;

    this.messages.push({ role: 'user', content: text, time: this.now() });
    this.draft    = '';
    this.isTyping = true;
    this.scrollToBottom();

    this.agentService.chat(text, this.sessionId, this.lang, this.buildContext()).subscribe({
      next: (res) => {
        this.sessionId = res.sessionId || this.sessionId;
        this.messages.push({ role: 'bot', content: res.reply, time: this.now() });
        this.isTyping = false;
        this.scrollToBottom();
        this.speak(res.reply);

        // Refresh real data after any write operation
        if (WRITE_INTENTS.has(res.intent)) {
          this.loadRealData();
        }
      },
      error: () => {
        const err = this.lang === 'fr' ? 'Erreur de connexion au service.' : 'Failed to reach the agent service.';
        this.messages.push({ role: 'bot', content: err, time: this.now() });
        this.isTyping = false;
        this.scrollToBottom();
      }
    });
  }

  toggleVoice(): void {
    if (this.isListening) {
      this.recognition?.stop();
      return;
    }

    const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Ctor) {
      const msg = this.lang === 'fr' ? 'Reconnaissance vocale non supportée.' : 'Voice recognition not supported.';
      this.messages.push({ role: 'bot', content: msg, time: this.now() });
      return;
    }

    this.recognition = new Ctor();
    this.recognition.lang = this.lang === 'fr' ? 'fr-FR' : 'en-US';
    this.recognition.continuous    = false;
    this.recognition.interimResults = false;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.recognition.onresult = (ev: any) => {
      const transcript = ev.results[0]?.[0]?.transcript ?? '';
      if (transcript) { this.draft = transcript; this.send(); }
    };
    this.recognition.onend  = () => { this.isListening = false; };
    this.recognition.onerror = () => { this.isListening = false; };

    this.recognition.start();
    this.isListening = true;
  }

  private speak(text: string): void {
    if (!window.speechSynthesis) return;
    const utt = new SpeechSynthesisUtterance(text.slice(0, 200));
    utt.lang = this.lang === 'fr' ? 'fr-FR' : 'en-US';
    utt.rate = 1.0;
    window.speechSynthesis.speak(utt);
  }

  private scrollToBottom(): void {
    setTimeout(() => {
      if (this.messagesEl?.nativeElement) {
        this.messagesEl.nativeElement.scrollTop = this.messagesEl.nativeElement.scrollHeight;
      }
    }, 50);
  }

  private now(): string {
    return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  private generateUUID(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    // Simple fallback UUID generator
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  ngOnDestroy(): void {
    this.recognition?.stop();
    window.speechSynthesis?.cancel();
  }
}
