import { Component } from '@angular/core';

@Component({
  selector: 'app-elections-home',
  template: `
    <div class="elections">
      <h1 class="elections__title">Elections Control Panel</h1>
      
      <div class="elections__grid">
        <a routerLink="../dashboard" class="elections__card elections__card--success">
          <div class="elections__card-icon">🧠</div>
          <h3>Dashboard</h3>
          <p>Real-time analytics & simulation</p>
        </a>

        <a routerLink="../list" class="elections__card elections__card--primary">
          <div class="elections__card-icon">🗳️</div>
          <h3>Elections</h3>
          <p>Manage election events and status</p>
        </a>
        
        <a routerLink="../candidates" class="elections__card elections__card--secondary">
          <div class="elections__card-icon">👥</div>
          <h3>Candidates</h3>
          <p>Register and oversee candidates</p>
        </a>
        
        <a routerLink="../votes" class="elections__card elections__card--warning">
          <div class="elections__card-icon">🎫</div>
          <h3>Votes</h3>
          <p>Track secure voting records</p>
        </a>
        
        <a routerLink="../positions-list" class="elections__card elections__card--danger">
          <div class="elections__card-icon">💼</div>
          <h3>Positions</h3>
          <p>Configure election roles</p>
        </a>

        <a routerLink="../vacant-positions" class="elections__card">
          <div class="elections__card-icon">🎤</div>
          <h3>Interviews</h3>
          <p>AI Voice Interview Simulator</p>
        </a>
      </div>
    </div>
  `,
  styles: [`
    @import '../../elections-theme.scss';

    .elections {
      padding: 2.5rem;
      max-width: 85rem;
      margin: 0 auto;
      animation: fadeIn 0.6s cubic-bezier(0.16, 1, 0.3, 1);
    }
    
    .elections__title {
      font-size: 3.5rem;
      font-weight: 900;
      margin-bottom: 2.5rem;
      padding-bottom: 1rem;
      border-bottom: 2px solid var(--e-border);
      color: var(--e-text);
      letter-spacing: -0.05em;
    }
    
    .elections__grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: 2rem;
    }

    .elections__card {
      display: flex;
      flex-direction: column;
      padding: 2.5rem;
      border-radius: 1.5rem;
      background: var(--e-bg-card);
      border: 1px solid var(--e-border);
      color: var(--e-text);
      text-decoration: none;
      box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
      transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
      position: relative;
      overflow: hidden;
      
      &::before {
        content: '';
        position: absolute;
        top: 0; left: 0; width: 4px; height: 100%;
        background: var(--e-primary);
        opacity: 0;
        transition: opacity 0.3s;
      }

      &--primary {
        --card-accent: var(--e-primary);
        &::before { background: var(--e-primary); }
      }
      
      &--secondary {
        --card-accent: var(--e-secondary);
        &::before { background: var(--e-secondary); }
      }
      
      &--warning {
        --card-accent: var(--e-warning);
        &::before { background: var(--e-warning); }
      }

      &--success {
        --card-accent: var(--e-success);
        &::before { background: var(--e-success); }
      }

      &--danger {
        --card-accent: var(--e-danger);
        &::before { background: var(--e-danger); }
      }

      &:hover {
        transform: translateY(-8px) scale(1.01);
        box-shadow: 0 25px 30px -5px rgba(0, 0, 0, 0.1);
        background: var(--e-row-hover);
        
        &::before { opacity: 1; }
        
        .elections__card-icon {
          transform: scale(1.1) rotate(5deg);
        }
      }
      
      .elections__card-icon {
        font-size: 3.5rem;
        margin-bottom: 1.5rem;
        transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1);
      }
      
      h3 {
        font-size: 1.75rem;
        font-weight: 800;
        margin: 0 0 0.5rem 0;
        color: var(--e-text);
      }
      
      p {
        font-size: 1rem;
        color: var(--e-muted);
        margin: 0;
        font-weight: 500;
      }
    }
  `]
})
export class ElectionsHomeComponent {}
