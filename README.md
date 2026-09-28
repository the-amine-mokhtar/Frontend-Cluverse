# Cluverse Frontend

## Architecture Diagram
![Class Diagram](./diag%20classe.png)

<p align="center">
  <img src="https://img.shields.io/badge/Cluverse-Frontend-4f46e5?style=for-the-badge" />
  <img src="https://img.shields.io/badge/Angular-18-DD0031?style=for-the-badge&logo=angular&logoColor=white" />
  <img src="https://img.shields.io/badge/TypeScript-5.x-3178C6?style=for-the-badge&logo=typescript&logoColor=white" />
  <img src="https://img.shields.io/badge/Status-Active-22c55e?style=for-the-badge" />
</p>

<h1 align="center">Cluverse — Frontend</h1>
<p align="center"><em>AI-powered Student Club Management SaaS Platform — built by HexaTeam @ ESPRIT</em></p>

---

## Overview

**Cluverse** is a full-stack, AI-powered SaaS platform designed to unify and digitize student club operations at scale. This repository contains the Angular-based frontend application powering the Cluverse user experience across all modules.

---

## Project Structure

```
cluverse-frontend/
├── src/
│   ├── app/
│   │   ├── core/                  # Auth guards, interceptors, services
│   │   ├── shared/                # Reusable components, pipes, directives
│   │   ├── layouts/               # Shell layouts (sidebar, navbar, footer)
│   │   └── modules/
│   │       ├── finance/           # Budget, payments, cashflow dashboard
│   │       ├── events/            # Event creation, scheduling, attendance
│   │       ├── recruitment/       # Applications, CV upload, interview simulator
│   │       ├── sponsoring/        # Sponsor CRM and partnership pipeline
│   │       ├── elections/         # Digital voting and audit interface
│   │       ├── skills/            # Member skill profiles and tracking
│   │       └── logistics/         # Resource booking and coordination
│   ├── assets/                    # Static assets, icons, images
│   ├── environments/              # environment.ts / environment.prod.ts
│   └── styles/                    # Global SCSS, themes, variables
├── angular.json
├── package.json
└── tsconfig.json
```

---

## Tech Stack

| Layer              | Technology                                      |
|--------------------|-------------------------------------------------|
| Framework          | Angular 18                                      |
| Language           | TypeScript 5.x                                  |
| Styling            | SCSS + PrimeNG / Angular Material               |
| State Management   | NgRx / RxJS                                     |
| HTTP Client        | Angular HttpClient + Interceptors               |
| Authentication     | JWT (stored in HttpOnly cookies)                |
| Charts & Analytics | Chart.js / ApexCharts                           |
| Payments UI        | Stripe.js                                       |
| AI UI              | Custom components bridging the AI service REST  |
| Containerization   | Docker                                          |
| CI/CD              | GitHub Actions                                  |

---

## Modules

| Module         | Description                                                                 |
|----------------|-----------------------------------------------------------------------------|
| Finance        | Budget overview, expense tracking, Stripe payment flows, cashflow charts    |
| Events         | Event creation wizard, calendar view, QR check-in, attendance reports       |
| Recruitment    | Application forms, candidate pipeline, AI interview simulator UI            |
| Sponsoring     | Sponsor directory, partnership status tracker, document upload              |
| Elections      | Voting interface, live results, audit trail viewer                          |
| Skills         | Member skill profiles, gap analysis dashboards, development plans           |
| Logistics      | Resource booking calendar, inventory list, operational task board           |

---

## Getting Started

### Prerequisites

- Node.js 20+
- npm 10+ or yarn
- Angular CLI 18+

```bash
npm install -g @angular/cli
```

### Install & Run

```bash
git clone https://github.com/the-amine-mokhtar/Frontend-Cluverse.git
cd Frontend-Cluverse
npm install
ng serve
```

App runs at `http://localhost:4200`.

### Build for Production

```bash
ng build --configuration production
```

Output is generated in `dist/cluverse-frontend/`.

---

## Environment Configuration

Edit `src/environments/environment.ts`:

```ts
export const environment = {
  production: false,
  apiGatewayUrl: 'http://localhost:8080/api',
  stripePublishableKey: 'pk_test_...',
  keycloakUrl: 'http://localhost:8180',
  keycloakRealm: 'cluverse',
  keycloakClientId: 'cluverse-frontend'
};
```

---

## Authentication Flow

```
User Login → Keycloak (OIDC) → JWT Token → Stored in HttpOnly Cookie
Angular AuthGuard checks token on each route → Refresh via interceptor
```

Role-based UI rendering is enforced per module using Angular route guards and directives: `ADMIN`, `PRESIDENT`, `MEMBER`, `TREASURER`, `GUEST`.

---

## Docker

```bash
docker build -t cluverse-frontend .
docker run -p 4200:80 cluverse-frontend
```

Or via Docker Compose alongside the backend:

```bash
docker-compose up --build
```

---

## Testing

```bash
ng test                     # Unit tests (Karma + Jasmine)
ng e2e                      # End-to-end tests (Cypress)
```

---

## Academic Context

Capstone (PI) project — **ESPRIT School of Engineering**, Tunisia, 2025.

---

<p align="center">Built with Angular, SCSS, and a lot of attention to detail by HexaTeam</p>
