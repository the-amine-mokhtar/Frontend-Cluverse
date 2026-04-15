# Contexte technique — Frontend-Cluverse (Angular 17)

> **Nom du projet** : `cluverse`  
> **Framework** : Angular 17.3 (NgModules, pas standalone par défaut)  
> **Styling** : SCSS + Tailwind CSS 3  
> **Animations** : GSAP + Angular BrowserAnimationsModule  
> **Port dev** : `http://localhost:4200` (par défaut Angular CLI)  
> **Backend attendu** : Spring Boot sur `http://localhost:8081`

---

## 1. Dépendances principales

| Dépendance | Version | Usage |
|---|---|---|
| `@angular/core` | ^17.3.0 | Framework principal |
| `@angular/router` | ^17.3.0 | Routing SPA |
| `@angular/forms` | ^17.3.0 | FormsModule + ReactiveFormsModule |
| `@angular/cdk` | ^17.3.10 | DragDropModule (Kanban recrutement) |
| `@angular/animations` | ^17.3.0 | BrowserAnimationsModule |
| `gsap` | ^3.14.2 | Animations avancées (landing page) |
| `ngx-image-cropper` | ^9.1.6 | Cropping d'images (logo club, photo profil) |
| `rxjs` | ~7.8.0 | Programmation réactive |
| `tailwindcss` | ^3.4.19 | Utilitaires CSS |
| `zone.js` | ~0.14.3 | Change detection Angular |

---

## 2. Architecture globale

```
src/
├── app/
│   ├── app.module.ts              ← Module racine
│   ├── app-routing.module.ts      ← Routes de niveau 1 (lazy loading)
│   ├── app.component.ts/html      ← Contient uniquement <router-outlet>
│   ├── core/                      ← Services singleton + guards
│   │   ├── guards/
│   │   │   └── auth.guard.ts
│   │   └── services/
│   │       ├── api.service.ts          ← Service HTTP centralisé (toutes les API REST)
│   │       ├── auth.service.ts         ← Login (email/password)
│   │       ├── auth-helper.service.ts  ← Décodage JWT, rôles, infos utilisateur
│   │       ├── club.service.ts         ← Récupération club par ID
│   │       ├── dashboard-state.service.ts ← État partagé dashboard (BehaviorSubjects)
│   │       └── theme.service.ts        ← Thème dark/light (localStorage)
│   ├── shared/                    ← Module partagé
│   │   ├── shared.module.ts       ← Exporte CommonModule, FormsModule, ReactiveFormsModule
│   │   └── components/
│   │       └── not-found/         ← Page 404
│   ├── features/                  ← Modules métier (lazy-loaded)
│   │   ├── landing/               ← Page d'accueil publique
│   │   ├── auth/                  ← Authentification
│   │   ├── dashboard/             ← Layout principal (sidebar + header + router-outlet)
│   │   ├── elections/             ← Entretiens vocaux IA
│   │   ├── recruitment/           ← Campagnes de recrutement
│   │   ├── events/                ← Gestion d'événements (placeholder)
│   │   ├── finance/               ← Module finance (placeholder)
│   │   ├── logistics/             ← Module logistique (placeholder)
│   │   ├── skills/                ← Module compétences (placeholder)
│   │   ├── sponsorship/           ← Module sponsoring (placeholder)
│   │   ├── apply/                 ← Candidature publique (non authentifié)
│   │   └── verify/                ← Vérification email
│   └── environments/
│       └── environment.development.ts  ← apiUrl: 'http://localhost:8081'
├── assets/
├── styles.scss                    ← Styles globaux + Tailwind + thème light-mode
├── index.html
└── main.ts
```

---

## 3. Détail des modules et composants

### 3.1 AppModule (`app.module.ts`)

```typescript
imports: [BrowserModule, BrowserAnimationsModule, AppRoutingModule]
providers: [provideHttpClient()]
bootstrap: [AppComponent]
```

- **Pas d'HTTP Interceptors** configurés
- `provideHttpClient()` utilise la nouvelle API Angular 17 (pas `HttpClientModule`)

### 3.2 SharedModule (`shared/shared.module.ts`)

Exporte les modules Angular courants pour éviter les imports répétitifs :
- `CommonModule`
- `FormsModule`
- `ReactiveFormsModule`
- `NotFoundComponent` (page 404)

### 3.3 Landing Module (`features/landing/`)

**Route** : `/` (page d'accueil publique)

| Composant | Rôle |
|---|---|
| `LandingComponent` | Conteneur principal qui orchestre toutes les sections |
| `NavbarComponent` | Barre de navigation du site public |
| `HeroSequenceComponent` | Section héro animée (GSAP) |
| `TrustedByComponent` | Section "Ils nous font confiance" |
| `ServicesSectionComponent` | Présentation des services |
| `ServiceDetailComponent` | Détail d'un service |
| `FaqSectionComponent` | FAQ |
| `PricingSectionComponent` | Plans tarifaires |
| `DevelopingTeamComponent` | Présentation de l'équipe |
| `FooterComponent` | Pied de page |

### 3.4 Auth Module (`features/auth/`)

**Routes** :
- `/auth/login` → `AuthContainerComponent` (conteneur principal login)
- `/auth/login2` → `Login2Component`
- `/auth/thank-you` → `ThankYouComponent`

| Composant | Rôle |
|---|---|
| `AuthContainerComponent` | Conteneur de la page de login |
| `LoginComponent` | Formulaire de login standard |
| `Login2Component` | Formulaire de login alternatif |
| `ClubApplicationComponent` | Formulaire de demande de création de club |
| `MemberLoginComponent` | Login spécifique membre (avec sélection du club) |
| `ThankYouComponent` | Page de confirmation post-inscription |

### 3.5 Dashboard Module (`features/dashboard/`)

**Route** : `/dashboard` (protégé par `AuthGuard`)  
**Layout** : `DashboardLayoutComponent` contient le sidebar + header + `<router-outlet>` enfant

| Composant | Rôle |
|---|---|
| `DashboardLayoutComponent` | Layout avec sidebar + header + zone de contenu |
| `SidebarComponent` | Navigation latérale du dashboard |
| `HeaderComponent` | En-tête avec recherche, notifications, avatar |
| `ThemeToggleComponent` | Bouton de bascule dark/light |
| `HomeComponent` | Page d'accueil du dashboard (stats, bienvenue) |
| `ProfileComponent` | Édition du profil utilisateur + photo |
| `MembersComponent` | Gestion des membres du club |

**Sous-modules chargés en lazy-loading depuis le dashboard** :

| Path | Module chargé |
|---|---|
| `dashboard/elections` | `ElectionsModule` |
| `dashboard/events` | `EventsModule` |
| `dashboard/recruitment` | `RecruitmentModule` |
| `dashboard/skills` | `SkillsModule` |
| `dashboard/logistics` | `LogisticsModule` |
| `dashboard/finance` | `FinanceModule` |
| `dashboard/sponsorship` | `SponsorshipModule` |

### 3.6 Elections Module (`features/elections/`)

**Routes** (sous `/dashboard/elections/`) :
- `/vacant-positions` → `VacantPositionsComponent`
- `/create-position` → `CreatePositionComponent`
- `/interview/:positionId` → `InterviewSimulatorComponent`
- `/report/:sessionId` → `InterviewReportComponent`

| Composant | Rôle |
|---|---|
| `ElectionsHomeComponent` | Page d'accueil des élections |
| `VacantPositionsComponent` | Liste des postes vacants |
| `CreatePositionComponent` | Création d'un nouveau poste |
| `InterviewSimulatorComponent` | **Simulateur d'entretien vocal IA** (Web Speech API + WebSocket) |
| `InterviewReportComponent` | Rapport post-entretien |

### 3.7 Recruitment Module (`features/recruitment/`)

**Routes** (sous `/dashboard/recruitment/`) :
- `/` → `CampaignListComponent`
- `/:id/builder` → `FormBuilderComponent`
- `/:id/applications` → `ApplicationsKanbanComponent`

| Composant | Rôle |
|---|---|
| `CampaignListComponent` | Liste et gestion des campagnes de recrutement |
| `FormBuilderComponent` | Constructeur de formulaire de candidature |
| `ApplicationsKanbanComponent` | Vue Kanban des candidatures (utilise `@angular/cdk/drag-drop`) |

### 3.8 Modules placeholder (structure minimale)

Les modules suivants n'ont qu'un composant "home" chacun et sont prêts à être enrichis :

| Module | Route | Composant unique |
|---|---|---|
| Events | `/dashboard/events` | `EventsHomeComponent` |
| Finance | `/dashboard/finance` | `FinanceHomeComponent` |
| Logistics | `/dashboard/logistics` | `LogisticsHomeComponent` |
| Skills | `/dashboard/skills` | `SkillsHomeComponent` |
| Sponsorship | `/dashboard/sponsorship` | `SponsorshipHomeComponent` |

### 3.9 Apply Module (`features/apply/`)

**Route** : `/apply/:publicLink` → `PublicApplicationComponent`  
**Accès** : Public (pas d'authentification requise)  
Permet aux candidats externes de postuler à une campagne via un lien public.

### 3.10 Verify Module (`features/verify/`)

**Route** : `/verify` → `VerifyComponent`  
**Accès** : Public  
Vérification d'email (probablement via token envoyé par email).

---

## 4. Communication avec Spring Boot

### 4.1 Base URL

```typescript
// src/environments/environment.development.ts
export const environment = {
  production: false,
  apiUrl: 'http://localhost:8081'
};
```

Tous les services utilisent `environment.apiUrl` comme base URL.  
Le backend Spring Boot est attendu sur le **port 8081**.

### 4.2 Service HTTP principal : `ApiService`

Le fichier `api.service.ts` est le **service centralisé** pour toutes les communications HTTP. Il contient :

#### Méthodes génériques
| Méthode | Signature |
|---|---|
| `post<T>` | `(endpoint, body, options?) → Observable<T>` |
| `put<T>` | `(endpoint, body, options?) → Observable<T>` |
| `delete<T>` | `(endpoint, options?) → Observable<T>` |

#### Endpoints dans `ApiService`

| Catégorie | Méthode HTTP | Endpoint | Auth |
|---|---|---|---|
| **Clubs** | GET | `/api/clubs/names` | ❌ |
| | POST | `/api/clubs` | ❌ |
| | GET | `/api/clubs/{id}` | ❌ |
| | POST | `/api/clubs/{id}/logo` | ❌ |
| | GET | `/api/clubs/check-email?email=` | ❌ |
| **Auth** | POST | `/api/auth/login-member` | ❌ |
| | POST | `/api/auth/refresh-token` | ✅ Bearer |
| **Profil** | GET | `/api/users/me` | ✅ Bearer |
| | PUT | `/api/users/me` | ✅ Bearer |
| | POST | `/api/users/me/photo` | ✅ Bearer |
| **Membres** | GET | `/api/clubs/{id}/members` | ✅ Bearer |
| | POST | `/api/clubs/{id}/members/send-invite` | ✅ Bearer |
| | DELETE | `/api/clubs/{id}/members/{userId}` | ✅ Bearer |
| | PUT | `/api/clubs/{id}/members/{userId}/deactivate` | ✅ Bearer |
| | PUT | `/api/clubs/{id}/members/{userId}/activate` | ✅ Bearer |
| | PUT | `/api/clubs/{id}/members/{userId}/role?role=` | ✅ Bearer |
| **Recrutement** | GET | `/api/recruitment/campaigns/club/{clubId}` | ✅ Bearer |
| | POST | `/api/recruitment/campaigns?clubId=` | ✅ Bearer |
| | PUT | `/api/recruitment/campaigns/{id}` | ✅ Bearer |
| | GET | `/api/recruitment/campaigns/{id}` | ✅ Bearer |
| | DELETE | `/api/recruitment/campaigns/{id}` | ✅ Bearer |
| | POST | `/api/recruitment/campaigns/{id}/questions` | ✅ Bearer |
| | PUT | `/api/recruitment/questions/{id}` | ✅ Bearer |
| | DELETE | `/api/recruitment/questions/{id}` | ✅ Bearer |
| | GET | `/api/recruitment/campaigns/{id}/applications` | ✅ Bearer |
| | PUT | `/api/recruitment/applications/{id}/status?status=` | ✅ Bearer |
| | GET | `/api/recruitment/campaigns/{id}/stats` | ✅ Bearer |
| | GET | `/api/recruitment/campaigns/{id}/export/csv` | ✅ Bearer |
| | GET | `/api/recruitment/campaigns/public/{publicLink}` | ❌ |
| | POST | `/api/recruitment/campaigns/{id}/apply` | ❌ |
| **Notifications** | GET | `/api/notifications?clubId=` | ✅ Bearer |
| | PUT | `/api/notifications/{id}/read` | ✅ Bearer |
| | PUT | `/api/notifications/read-all?clubId=` | ✅ Bearer |
| **Élections** | GET | `/api/elections/positions?clubId=` | ✅ Bearer |
| | GET | `/api/elections/positions/{id}` | ✅ Bearer |
| | POST | `/api/elections/positions?clubId=` | ✅ Bearer |
| | POST | `/api/elections/interview/start` | ✅ Bearer |
| | POST | `/api/elections/interview/end` | ✅ Bearer |
| | GET | `/api/elections/interview/report/{sessionId}` | ✅ Bearer |

#### Endpoints dans `AuthService` (séparé)

| Méthode HTTP | Endpoint | Auth |
|---|---|---|
| POST | `/api/auth/login` | ❌ |
| POST | `/api/auth/login-club` | ❌ |

### 4.3 Gestion de l'authentification

#### Pas d'HTTP Interceptor

> **IMPORTANT** : Le projet n'utilise **aucun HTTP Interceptor**. Le header `Authorization` est ajouté manuellement dans chaque méthode qui en a besoin.

#### Mécanisme d'ajout du token

```typescript
// Méthode helper dans ApiService
private authHeaders(): HttpHeaders {
  const token = localStorage.getItem('token') ?? '';
  return new HttpHeaders({ Authorization: `Bearer ${token}` });
}
```

Le JWT est stocké dans `localStorage` sous la clé **`token`**.

Certaines méthodes utilisent `this.authHeaders()`, d'autres recréent les headers manuellement :
```typescript
const headers = new HttpHeaders({
  'Authorization': `Bearer ${localStorage.getItem('token')}`,
  'Content-Type': 'application/json'
});
```

### 4.4 Décodage JWT : `AuthHelperService`

Service utilitaire qui décode le JWT côté client (sans vérification de signature) :

| Méthode | Retour |
|---|---|
| `getDecodedToken()` | Payload JWT complet |
| `getFirstName()` | `string` |
| `getLastName()` | `string` |
| `getFullName()` | `string` |
| `getClubId()` | `number` (claim `clubid`) |
| `getRole()` | `string` (claim `role`) |
| `getUserId()` | `number` (claim `sub` ou `id`) |
| `isPresident()` | `boolean` (role === 'PRESIDENT') |
| `isLoggedIn()` | `boolean` (vérifie token + expiration) |

### 4.5 WebSocket

L'`InterviewSimulatorComponent` établit une connexion WebSocket directe :

```typescript
this.socket = new WebSocket(
  `ws://localhost:8081/ws/interview?sessionId=${sessionId}&token=${token}`
);
```

- **URL hardcodée** : `ws://localhost:8081` (pas via `environment.apiUrl`)
- **Authentification** : token JWT passé en query parameter
- **Protocol** : Échange de messages JSON (`USER_MESSAGE` / `RECRUITER_MESSAGE`)

### 4.6 Gestion d'erreur

```typescript
private handleError(error: any) {
  let errorMessage = 'An unknown error occurred!';
  if (error.error instanceof ErrorEvent) {
    errorMessage = `Error: ${error.error.message}`;      // Erreur client
  } else {
    errorMessage = `Error Code: ${error.status}\nMessage: ${error.message}`; // Erreur serveur
  }
  console.error(errorMessage);
  return throwError(() => new Error(errorMessage));
}
```

Pas de gestion automatique de 401 (pas de redirect vers `/auth/login` en cas de token expiré dans un interceptor).

---

## 5. Système de Routing

### 5.1 Vue d'ensemble

```
/                          → LandingModule (lazy) → LandingComponent
/auth                      → AuthModule (lazy)
  /auth/login              → AuthContainerComponent
  /auth/login2             → Login2Component
  /auth/thank-you          → ThankYouComponent
/dashboard                 → DashboardModule (lazy, protégé AuthGuard)
  /dashboard/home          → HomeComponent
  /dashboard/profile       → ProfileComponent
  /dashboard/members       → MembersComponent
  /dashboard/elections     → ElectionsModule (lazy)
    /vacant-positions      → VacantPositionsComponent
    /create-position       → CreatePositionComponent
    /interview/:positionId → InterviewSimulatorComponent
    /report/:sessionId     → InterviewReportComponent
  /dashboard/recruitment   → RecruitmentModule (lazy)
    /                      → CampaignListComponent
    /:id/builder           → FormBuilderComponent
    /:id/applications      → ApplicationsKanbanComponent
  /dashboard/events        → EventsModule (lazy) → EventsHomeComponent
  /dashboard/finance       → FinanceModule (lazy) → FinanceHomeComponent
  /dashboard/logistics     → LogisticsModule (lazy) → LogisticsHomeComponent
  /dashboard/skills        → SkillsModule (lazy) → SkillsHomeComponent
  /dashboard/sponsorship   → SponsorshipModule (lazy) → SponsorshipHomeComponent
/apply/:publicLink         → ApplyModule (lazy) → PublicApplicationComponent
/verify                    → VerifyModule (lazy) → VerifyComponent
/not-found                 → NotFoundComponent
/**                        → NotFoundComponent (wildcard)
```

### 5.2 Options du Router

```typescript
RouterModule.forRoot(routes, {
  scrollPositionRestoration: 'enabled',
  anchorScrolling: 'enabled'
})
```

### 5.3 AuthGuard

```typescript
@Injectable({ providedIn: 'root' })
export class AuthGuard implements CanActivate {
  canActivate(): boolean {
    if (this.authHelper.isLoggedIn()) {
      return true;
    }
    this.router.navigate(['/auth/login']);
    return false;
  }
}
```

- Protège uniquement la route `/dashboard` et ses enfants
- Vérifie la présence ET l'expiration du JWT via `AuthHelperService.isLoggedIn()`
- Redirige vers `/auth/login` si non authentifié

### 5.4 Stratégie de chargement

Tous les modules métier sont chargés en **lazy loading** via `loadChildren`, ce qui signifie que le bundle initial ne contient que `AppModule`, `AppRoutingModule` et `SharedModule`.

---

## 6. Intégration de contenu externe

### 6.1 État actuel : AUCUN mécanisme existant

Après analyse exhaustive du code source :

| Mécanisme | Présent ? |
|---|---|
| `<iframe>` | ❌ Aucun usage |
| Micro-frontends (Module Federation, Single SPA) | ❌ Aucun |
| `DomSanitizer` / `bypassSecurityTrustResourceUrl` | ❌ Aucun usage |
| `window.open()` | ❌ Aucun usage |
| `window.postMessage()` | ❌ Aucun usage |
| Redirections externes (`window.location.href`) | ❌ (sauf construction d'URL interne pour le lien public de recrutement) |
| Web Components / Custom Elements | ❌ Aucun |
| HTTP Interceptors | ❌ Aucun |

### 6.2 Seul usage de `window.location`

Dans `CampaignListComponent` :
```typescript
const url = `${window.location.origin}/apply/${camp.publicLink}`;
```
Utilisé uniquement pour **générer un lien à copier** (lien de candidature publique), pas pour une redirection externe.

### 6.3 WebSocket (seul canal temps-réel)

Le seul canal de communication hors HTTP REST est le **WebSocket** dans `InterviewSimulatorComponent` :
- URL : `ws://localhost:8081/ws/interview?sessionId=xxx&token=xxx`
- Utilise le WebSocket natif du navigateur (pas de librairie comme `socket.io`)
- Communication bidirectionnelle JSON (entretien IA vocal en temps réel)

### 6.4 Web Speech API (navigateur)

L'`InterviewSimulatorComponent` utilise les API natives du navigateur :
- **SpeechRecognition** (`webkitSpeechRecognition`) : transcription vocale → texte
- **SpeechSynthesis** (`window.speechSynthesis`) : texte → synthèse vocale
- Support des langues : français (`fr-FR`) et anglais (`en-US`)

---

## 7. Variables de thème et design system

### Couleurs CSS custom properties

```css
:root {
  --deep-navy: #0A0A1A;     /* Fond principal dark */
  --accent-teal: #2DD4BF;   /* Couleur d'accent */
  --heading: rgba(255, 255, 255, 0.90);
  --body: rgba(255, 255, 255, 0.60);
}
```

### Thème dark/light

- **Dark par défaut**, géré via `ThemeService`
- Bascule via la classe CSS `body.light-mode`
- Persistance dans `localStorage` sous la clé `cluverse-theme`
- Styles light-mode définis dans `styles.scss` avec des overrides BEM

### Typographie

- Police principale : **Inter** (Google Fonts)
- Fallbacks : `-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif`

---

## 8. État partagé du dashboard : `DashboardStateService`

Service qui utilise des `BehaviorSubject` pour partager des données entre composants du dashboard :

| Observable | Type | Description |
|---|---|---|
| `clubName$` | `string` | Nom du club (chargé via API) |
| `clubLogoUrl$` | `string` | URL du logo du club |
| `userFullName$` | `string` | Nom complet (token puis API) |
| `userRole$` | `string` | Rôle de l'utilisateur |
| `userPhotoUrl$` | `string` | URL de la photo de profil |

Appelé par le dashboard au chargement via `loadDashboardData()` qui :
1. Décode le token JWT pour les infos immédiates
2. Appelle `getClubById()` pour les infos du club
3. Appelle `getMyProfile()` pour la photo utilisateur

---

## 9. Résumé des points clés pour l'intégration

| Aspect | Détail |
|---|---|
| **Architecture** | NgModules classique, pas de standalone components |
| **Lazy loading** | Tous les feature modules |
| **Auth** | JWT dans localStorage, headers manuels (pas d'interceptor) |
| **Base URL** | `http://localhost:8081` via `environment.apiUrl` |
| **WebSocket** | `ws://localhost:8081/ws/interview` (URL hardcodée) |
| **API prefix** | Toutes les routes API commencent par `/api/` |
| **Intégration externe** | **Aucun mécanisme existant** (pas d'iframe, micro-frontend, etc.) |
| **Ajout facilité de modules** | La structure en feature modules facilite l'ajout de nouveaux domaines |
| **Points d'attention** | Pas d'interceptor → pas de gestion automatique des 401, WebSocket URL hardcodée |
