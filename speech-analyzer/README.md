# Speech Analyzer (Python Microservice)

Microservice IA Python indépendant de Spring Boot pour analyser des discours en temps réel via WebSocket et REST.

## Stack

- FastAPI (REST + WebSocket)
- Whisper (transcription streaming)
- librosa + numpy (acoustique)
- Scoring ML (scikit-learn RandomForest)
- Feedback LLM (OpenAI GPT-4o ou Anthropic Claude)

## Structure

```text
speech-analyzer/
├── app/
│   ├── main.py
│   ├── websocket/speech_handler.py
│   ├── pipeline/
│   ├── models/schemas.py
│   └── config/settings.py
├── training/
├── tests/
├── .env.example
├── requirements.txt
├── Dockerfile
└── README.md
```

## Installation locale

```bash
cd speech-analyzer
python -m venv .venv
# Windows PowerShell
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env
uvicorn app.main:app --host 0.0.0.0 --port 8001
```

## API

### GET /health (et POST /health)

Retour:

```json
{
  "status": "ok",
  "whisper_loaded": true,
  "model_version": "base"
}
```

### POST /analyze

Body:

```json
{
  "audio_base64": "<base64>",
  "session_id": "session-123"
}
```

Retour: `SpeechReport` complet.

### POST /report/{session_id}

Clôture la session WebSocket et retourne le rapport final.

## WebSocket temps réel

URL:

```text
ws://localhost:8001/ws/speech/{sessionId}
```

Messages entrants:

- `{"type":"audio_chunk","audio_base64":"..."}`
- `{"type":"end_session"}`

Messages sortants:

- `realtime_metrics` (à chaque chunk)
- `ai_feedback` (toutes les 30s, async)
- `final_report` (à la fin)

## Intégration Spring Boot

### 1) Démarrer une session

- Spring Boot vérifie la disponibilité: `POST http://localhost:8001/health` (endpoint `GET` compatible aussi)
- Angular ouvre: `ws://localhost:8001/ws/speech/{sessionId}`

### 2) Pendant la session

- Angular envoie des chunks audio bruts (binaire ou base64)
- FastAPI renvoie les métriques temps réel directement à Angular

### 3) Fin de session

- Spring Boot appelle: `POST http://localhost:8001/report/{sessionId}`
- FastAPI retourne un `SpeechReport` JSON
- Spring Boot stocke le rapport dans `Session.sessionReport`
- Spring Boot appelle `CompetencyService.updateLevel()` avec `score.global_score`

Exemple `WebClient` Spring Boot:

```java
WebClient.create("http://localhost:8001")
    .post()
    .uri("/report/{id}", sessionId)
    .retrieve()
    .bodyToMono(SpeechReport.class);
```

## Entraînement du scoreur ML

```bash
python training/train_scorer.py
```

Le modèle est sauvegardé dans `app/models/scorer.pkl` et chargé automatiquement au démarrage du service.

## Docker

```bash
docker build -t speech-analyzer:latest .
docker run --rm -p 8001:8001 --env-file .env speech-analyzer:latest
```

## Variables d'environnement

Voir `.env.example`.

- `WHISPER_MODEL` (`tiny|base|small|medium|large`)
- `LLM_PROVIDER` (`openai|anthropic`)
- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY`
- `LLM_MODEL`
- `FEEDBACK_INTERVAL_SECONDS`
- `AUDIO_SAMPLE_RATE`
- `HOST`
- `PORT`
- `SPRING_BACKEND_URL`
