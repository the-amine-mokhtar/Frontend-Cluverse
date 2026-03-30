import { Component } from '@angular/core';

@Component({
  selector: 'app-elections-home',
  template: `
    <div class="elections-dashboard animate-fade-in p-8 max-w-7xl mx-auto">
      <h1 class="text-5xl font-extrabold mb-10 pb-4 border-b border-gray-200">
        <span class="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">
          Elections Control Panel
        </span>
      </h1>
      
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        <a routerLink="../list" class="dashboard-card bg-gradient-to-br from-blue-500 to-blue-700 hover:from-blue-600 hover:to-blue-800">
          <div class="card-icon">🗳️</div>
          <h3>Elections</h3>
          <p>Manage election events and status</p>
        </a>
        
        <a routerLink="../candidates" class="dashboard-card bg-gradient-to-br from-teal-500 to-emerald-700 hover:from-teal-600 hover:to-emerald-800">
          <div class="card-icon">👥</div>
          <h3>Candidates</h3>
          <p>Register and oversee candidates</p>
        </a>
        
        <a routerLink="../votes" class="dashboard-card bg-gradient-to-br from-purple-500 to-pink-700 hover:from-purple-600 hover:to-pink-800">
          <div class="card-icon">🎫</div>
          <h3>Votes</h3>
          <p>Track secure voting records</p>
        </a>
        
        <a routerLink="../positions-list" class="dashboard-card bg-gradient-to-br from-orange-500 to-red-700 hover:from-orange-600 hover:to-red-800">
          <div class="card-icon">💼</div>
          <h3>Positions</h3>
          <p>Configure election roles</p>
        </a>

        <a routerLink="../vacant-positions" class="dashboard-card bg-gradient-to-br from-gray-700 to-gray-900 hover:from-gray-800 hover:to-black">
          <div class="card-icon">🎤</div>
          <h3>Interviews</h3>
          <p>AI Voice Interview Simulator</p>
        </a>
      </div>
    </div>
  `,
  styles: [`
    .animate-fade-in {
      animation: fadeIn 0.6s cubic-bezier(0.16, 1, 0.3, 1);
    }
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(30px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .dashboard-card {
      display: flex;
      flex-direction: column;
      padding: 2.5rem;
      border-radius: 1.5rem;
      color: white;
      text-decoration: none;
      box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
      transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
      cursor: pointer;
      position: relative;
      overflow: hidden;
      
      &::after {
        content: '';
        position: absolute;
        top: 0; right: 0; bottom: 0; left: 0;
        background: linear-gradient(rgba(255,255,255,0.1), transparent);
        opacity: 0;
        transition: opacity 0.3s;
      }

      &:hover {
        transform: translateY(-8px) scale(1.02);
        box-shadow: 0 25px 30px -5px rgba(0, 0, 0, 0.15), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
        
        &::after {
          opacity: 1;
        }
      }
      
      .card-icon {
        font-size: 3.5rem;
        margin-bottom: 1.5rem;
        filter: drop-shadow(0 4px 6px rgba(0,0,0,0.1));
      }
      
      h3 {
        font-size: 1.75rem;
        font-weight: 800;
        margin-bottom: 0.5rem;
        margin-top: 0;
        letter-spacing: -0.025em;
      }
      
      p {
        font-size: 1rem;
        opacity: 0.9;
        font-weight: 500;
        margin: 0;
      }
    }
  `]
})
export class ElectionsHomeComponent {}
