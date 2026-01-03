# Chat Room

Detailed setup and operations guide.

## Architecture
- **API** (`chat-backend`, Node.js + Express + Prisma + Socket.IO) on port 4000. JWT auth (access token + refresh cookie), real-time messaging, PostgreSQL.
- **Frontend** (`chat-frontend`, React + Vite) built to `dist` and served by nginx on port 8080 with SPA fallback.
- **DB** PostgreSQL 16 (Docker) on port 5432.

## Prerequisites
- Docker + Docker Compose
- (Optional for local dev) Node 20+ and npm if running without Docker.

## Environment files
### Backend (`chat-backend/.env`)
```env
NODE_ENV=production
PORT=4000
CORS_ORIGIN=http://localhost:8080
DATABASE_URL="postgresql://postgres:postgres@db:5432/chatdb"
JWT_ACCESS_SECRET=...    # required
JWT_REFRESH_SECRET=...   # required
ACCESS_TTL_SECONDS=900   # 15 minutes
REFRESH_TTL_DAYS=7
# Optional: auto-create an admin on startup (created only if username+password are set)
# INITIAL_ADMIN_USERNAME=admin
# INITIAL_ADMIN_PASSWORD=change-me
```
- When `INITIAL_ADMIN_USERNAME` and `INITIAL_ADMIN_PASSWORD` are  provided, the API will create an
  admin user on startup if that username does not already exist. Existing users are left untouched
  (a warning is logged instead).

### Frontend (`chat-frontend/.env`)
```env
VITE_API_BASE_URL=http://localhost:4000
# optional for sockets:
# VITE_SOCKET_URL=http://localhost:4000
```

## Run with Docker Compose (recommended)
```sh
docker compose down          # stop if running
docker compose up --build    # build and start
```
- Frontend: http://localhost:8080  
- API + Socket.IO: http://localhost:4000  
- DB: localhost:5432 (user/password: postgres/postgres, DB: chatdb)

Logs:
```sh
docker compose logs -f              # all services
docker compose logs -f api          # backend only
docker compose logs -f frontend     # frontend (nginx) only
```

Stop:
```sh
docker compose down
```

## Core API endpoints
- `POST /auth/register` – create user.
- `POST /auth/login` – returns access token and sets refresh cookie (`withCredentials` required).
- `POST /auth/refresh` – new access token from refresh cookie.
- `POST /auth/logout` – revoke refresh.
- `GET /messages` plus CRUD; real-time updates via Socket.IO.

## Socket.IO
- Endpoint: `http://localhost:4000` (same as API).
- Pass access token when connecting (see `chat-frontend/src/realtime/socket.ts`).

## Security notes
- CORS restricted to `CORS_ORIGIN` (default http://localhost:8080) with `credentials: true`.
- `helmet` enabled.
- JWT secrets are required; server will crash on startup without them.


## Useful command
- Inspect DB schema: `cd chat-backend && npx prisma studio` (if DB reachable).

## Project structure (brief)
- `chat-backend/src` – Express routes, auth/messages modules, socket, Prisma.
- `chat-frontend/src` – React SPA (Vite); API calls in `src/api`, socket in `src/realtime`, pages in `src/pages`.
- `docker-compose.yml` – defines db + api + frontend.
