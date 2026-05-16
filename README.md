# projectHub

> AI-powered student startup collaboration platform

**Live Demo:** https://shambhavi-singh05.github.io/ProjectHub/

---

## What it does

projectHub helps college students build, launch, and grow startup ideas by connecting them with the right teammates, mentors, and funding opportunities — all in one place.

---

## Features

- **AI Matchmaking** — Gemini AI analyzes user profiles using semantic embeddings and ranks matches by compatibility. Generates a personalized "Why you match" explanation for each match.
- **Team Finder** — Search and connect with students by skills and interests. Send/accept/decline connection requests.
- **Mentorship** — Students request mentorship from experienced mentors. Mentors review student projects and leave feedback.
- **Projects** — Create and manage startup projects with task tracking and team collaboration.
- **AI Assistant** — Get instant AI feedback on startup ideas and proposals using Groq LLaMA.
- **RAG Project Copilot** — Ask questions about your project and get context-aware answers. Uses FAISS vector search over your actual tasks, team members, and activity logs.
- **Funding Portal** — Explore grants and funding opportunities. Track applications.
- **Real-time Chat** — Message your connections directly with live notifications.
- **Notifications** — Real-time alerts for connection requests, matches, mentorship updates, and project activity.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TypeScript, Vite |
| Backend | Flask, Flask-SocketIO, Flask-JWT-Extended |
| Database | MongoDB Atlas |
| AI (Matchmaking) | Google Gemini 2.5 Flash (explanations), Gemini Embedding 001 (semantic vectors) |
| AI (Project Copilot) | Groq LLaMA 3.1 (text), FAISS (vector search), RAG pipeline |
| Auth | JWT tokens + Google OAuth |
| Deployment | GitHub Pages (frontend), Render (backend) |

---

## Local Setup

### Backend

```bash
cd backend
pip install -r requirements.txt
```

Create a `.env` file in the `backend/` folder:

```
MONGO_URI=your_mongodb_atlas_uri
SECRET_KEY=your_secret_key
JWT_SECRET_KEY=your_jwt_secret_key
GEMINI_API_KEY=your_gemini_api_key
GROQ_API_KEY=your_groq_api_key
GOOGLE_CLIENT_ID=your_google_client_id
PORT=10000
```

Run the server:

```bash
python app.py
```

### Frontend

```bash
cd frontend
npm install
```

Create a `.env` file in the `frontend/` folder:

```
VITE_API_URL=http://localhost:10000
VITE_GOOGLE_CLIENT_ID=your_google_client_id
```

Run the dev server:

```bash
npm run dev
```

---

## Deployment

| Service | Platform | Branch |
|---------|----------|--------|
| Frontend | GitHub Pages | `gh-pages` (auto-built) |
| Backend | Render | `main` (auto-deploys) |

Deploy frontend:
```bash
cd frontend
npm run deploy
```

---

## Project Structure

```
ProjectHub/
├── backend/
│   ├── routes/          # API route handlers
│   ├── services/        # Gemini AI embedding and matchmaking logic
│   ├── rag/             # FAISS vector store and RAG pipeline for project copilot
│   ├── agents/          # AI orchestration agents
│   ├── utils/           # Shared utilities (embeddings, notifications)
│   ├── sockets/         # Socket.IO real-time handlers
│   └── app.py           # Flask application entry point
└── frontend/
    └── src/
        ├── components/  # React UI components
        ├── services/    # API service layer
        └── types/       # TypeScript type definitions
```

---

## Team

Built by student founders for student founders.
