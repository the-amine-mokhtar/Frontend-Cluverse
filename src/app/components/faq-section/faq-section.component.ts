import { Component } from '@angular/core';

interface FaqItem {
  question: string;
  answer: string;
}

@Component({
  selector: 'app-faq-section',
  templateUrl: './faq-section.component.html',
  styleUrls: ['./faq-section.component.scss']
})
export class FaqSectionComponent {
  activeIndex: number | null = null;

  faqItems: FaqItem[] = [
    {
      question: 'How do my members join the club?',
      answer: 'As a president, you create your club on Cluverse and automatically become the administrator. You then create your members\' accounts directly from the dashboard. Each member receives their credentials, logs in, selects their club, and instantly accesses their space based on their assigned role.'
    },
    {
      question: 'Are election votes truly anonymous?',
      answer: 'Absolutely. Cluverse\'s election system guarantees complete vote anonymity — even the club administrator cannot see who voted for whom. Only the final results are visible to authorized roles.'
    },
    {
      question: 'Can we cancel our subscription at any time?',
      answer: 'Yes, no commitment required. You can cancel directly from your club settings at any time. You\'ll continue to enjoy your current plan\'s features until the end of the already paid period, then automatically switch to the free Starter plan.'
    },
    {
      question: 'Why should I choose Cluverse over any other app?',
      answer: 'Most club management tools are either too generic or built for large organizations with complex structures. Cluverse is designed specifically for university clubs and associations — meaning every feature, from elections to recruitment, is built around how clubs actually operate. You get a dedicated space for your club, role-based access for every member, and all your operations in one platform — no duct-taping three different tools together. And unlike spreadsheets or group chats, Cluverse keeps your club\'s history, decisions, and data structured and accessible for every future board.'
    }
  ];

  toggle(index: number): void {
    this.activeIndex = this.activeIndex === index ? null : index;
  }
}
