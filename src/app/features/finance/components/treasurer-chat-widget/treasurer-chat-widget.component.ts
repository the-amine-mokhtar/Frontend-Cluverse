import { Component } from '@angular/core';
import { TreasurerAssistantService, PendingApproval } from '../../services/treasurer-assistant.service';

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

@Component({
  selector: 'app-treasurer-chat-widget',
  templateUrl: './treasurer-chat-widget.component.html',
  styleUrl: './treasurer-chat-widget.component.scss'
})
export class TreasurerChatWidgetComponent {
  draftMessage = '';
  isLoading = false;
  sessionId = this.buildSessionId();
  pendingApprovals: PendingApproval[] = [];

  messages: ChatMessage[] = [
    {
      role: 'assistant',
      content: 'Treasurer assistant is ready. Ask about budgets, transactions, or cashflow forecast.'
    }
  ];

  constructor(private readonly treasurerAssistantService: TreasurerAssistantService) {}

  send(): void {
    const content = this.draftMessage.trim();
    if (!content || this.isLoading) {
      return;
    }

    this.messages.push({ role: 'user', content });
    this.draftMessage = '';
    this.isLoading = true;

    this.treasurerAssistantService.chat(content, this.sessionId).subscribe({
      next: (response) => {
        this.sessionId = response.sessionId || this.sessionId;
        this.messages.push({ role: 'assistant', content: response.reply });
        this.pendingApprovals = response.pendingApprovals || [];
        this.isLoading = false;
      },
      error: (error) => {
        const message = error?.error?.detail || 'Unable to reach Treasurer assistant backend.';
        this.messages.push({ role: 'system', content: `Error: ${message}` });
        this.isLoading = false;
      }
    });
  }

  approve(approval: PendingApproval): void {
    if (this.isLoading) {
      return;
    }

    this.isLoading = true;
    this.treasurerAssistantService.approve(this.sessionId, approval.id).subscribe({
      next: (response) => {
        this.messages.push({ role: 'system', content: `Approved: ${response.outcome.summary}` });
        this.pendingApprovals = response.pendingApprovals || [];
        this.isLoading = false;
      },
      error: (error) => {
        const message = error?.error?.detail || 'Failed to approve action.';
        this.messages.push({ role: 'system', content: `Approval error: ${message}` });
        this.isLoading = false;
      }
    });
  }

  reject(approval: PendingApproval): void {
    if (this.isLoading) {
      return;
    }

    this.isLoading = true;
    this.treasurerAssistantService.reject(this.sessionId, approval.id).subscribe({
      next: (response) => {
        this.messages.push({ role: 'system', content: `Rejected: ${response.outcome.summary}` });
        this.pendingApprovals = response.pendingApprovals || [];
        this.isLoading = false;
      },
      error: (error) => {
        const message = error?.error?.detail || 'Failed to reject action.';
        this.messages.push({ role: 'system', content: `Reject error: ${message}` });
        this.isLoading = false;
      }
    });
  }

  private buildSessionId(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return `session-${Date.now()}`;
  }
}
