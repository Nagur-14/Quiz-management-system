<<<<<<< HEAD
# QuizPit — a Kahoot-style live quiz app

A full-stack, real-time quiz game. A host builds a quiz, launches a game, and
gets a 6-digit code. Players open the site on any device (no account needed),
enter the code and a team name, and play live — questions, timer, scoring,
and leaderboard all sync instantly over WebSockets.

**Stack:** Node.js + Express + MongoDB (Mongoose) for the API and data,
Socket.io for real-time gameplay, and a plain HTML/CSS/JS frontend (no build
step required).

---

## Features

- **Host / admin accounts** — email+password auth (JWT), so a host can log
  in from anywhere and manage their own quizzes.
- **Quiz editor** — create/edit quizzes with multiple questions, 2–6 options
  each, a correct answer, a per-question timer, and a point value.
- **Admin dashboard** — see all your quizzes, how many times each has been
  hosted, and overall stats (quizzes, sessions hosted, teams reached).
- **Live hosting** — pick a quiz, get a join code instantly, watch teams
  join the lobby in real time, then start the game.
- **Join by code, like Kahoot** — anyone with the code and a team name can
  play from their phone or laptop — no login required to play.
- **Real-time gameplay** — synced question timer, speed-based scoring
  (faster correct answers score more), live "X / Y answered" counter for
  the host, per-question results with an answer-distribution chart, and a
  running + final leaderboard.
- **Game history** — every finished game is saved to MongoDB (`Result`
  documents) so hosts can review past scores later.

---

## Project structure

```
quiz-app/
├── server/                  Express + Socket.io backend
│   ├── server.js            App entrypoint (also serves the frontend)
│   ├── config/db.js         MongoDB connection
│   ├── models/               Admin, Quiz, Result (Mongoose schemas)
│   ├── middleware/auth.js   JWT auth guard for admin routes
│   ├── routes/               /api/auth, /api/quizzes, /api/results
│   ├── sockets/gameManager.js   All real-time game logic (join, questions,
│   │                            scoring, timers, leaderboard)
│   ├── utils/                generateCode.js, seedAdmin.js
│   └── .env.example
└── public/                   Static frontend, served directly by Express
    ├── index.html            Player app: enter code → team name → play
    ├── host.html              Host console / "big screen"
    ├── admin/login.html       Host login & sign up
    ├── admin/dashboard.html   Quiz list + stats
    ├── admin/editor.html      Create/edit a quiz
    ├── css/style.css
    └── js/                    api.js, play.js, host.js, admin-*.js
```

---

## How the game loop works

1. A host logs in, opens **Host a game**, and picks a quiz.
2. The server creates an in-memory **session** keyed by a random 6-digit
   **code**, and the host's browser joins a Socket.io room for that code.
3. Players go to the site, type in the code and a team name. The server adds
   them to the session and broadcasts the updated team list to the lobby.
4. The host clicks **Start**. The server pushes out question 1 to everyone
   in the room, with a server-side timer (so scoring can't be gamed by
   tampering with a client-side clock).
5. Each team submits one answer per question. The server scores it (full
   points for a fast correct answer, half points for a correct answer at the
   very last second, 0 for wrong/no answer) and privately tells that team
   whether they were right.
6. When everyone has answered, or time runs out, the server reveals the
   correct answer, an answer-distribution chart, and the leaderboard to the
   host, and each player privately sees their own result.
7. The host clicks **Next question** until the quiz ends, then everyone sees
   the final leaderboard, and the result is saved to MongoDB.

Active games live in memory (a `Map` in `gameManager.js`) rather than in
MongoDB, so gameplay stays fast; only the final result is persisted. This
means restarting the server ends any in-progress games — fine for a single
Node process, but worth knowing before you scale to multiple server
instances (see **Scaling notes** below).

---

## Local setup

**Prerequisites:** Node.js 18+, and a MongoDB database (either a free
[MongoDB Atlas](https://www.mongodb.com/atlas) cluster, or `mongod` running
locally).

```bash
cd server
cp .env.example .env
# edit .env: set MONGO_URI to your database, and set a real JWT_SECRET

npm install
npm run dev        # or: npm start
```

The server serves both the API and the frontend, so once it's running, open:

- `http://localhost:5000/` — play a game
- `http://localhost:5000/admin/login.html` — host login / sign up

Create your first host account either by clicking **Create one** on the
login page, or from the command line:

```bash
node utils/seedAdmin.js "Your Name" you@example.com yourpassword
```

---

## Deployment

This is a single Node process serving both API and static frontend, which
makes it easy to deploy anywhere that runs Node — Render, Railway, Fly.io, a
VPS, etc. Rough steps for a typical PaaS (Render/Railway):

1. Push this repo to GitHub.
2. Create a free MongoDB Atlas cluster, add a database user, and allow
   network access from anywhere (`0.0.0.0/0`) or the platform's IPs.
3. On Render/Railway, create a new **Web Service** from the repo, with:
   - **Root directory:** `server`
   - **Build command:** `npm install`
   - **Start command:** `npm start`
   - **Environment variables:** `MONGO_URI`, `JWT_SECRET`, `JWT_EXPIRES_IN`,
     `CLIENT_ORIGIN` (can stay `*`), `PORT` (most platforms set this
     automatically).
4. Once deployed, share the platform's URL — anyone can play at that URL,
   and you log in at `/admin/login.html` to host.

For a VPS: `git clone`, `cd server && npm install`, set up `.env`, then run
it under a process manager such as `pm2` or a `systemd` service, with Nginx
as a reverse proxy in front (make sure WebSocket upgrade headers are
forwarded, since Socket.io needs them).

---

## Scaling notes (good to know, not required for a class project or demo)

- Game sessions are stored in memory on a single Node process. If you ever
  run multiple server instances behind a load balancer, you'd need either
  sticky sessions (so a given game's socket connections all land on the same
  instance) or to move session state into Redis with the
  [Socket.io Redis adapter](https://socket.io/docs/v4/redis-adapter/).
- There's no reconnect/rejoin support mid-game — if a player's connection
  drops during a live question, they're marked disconnected and can't
  rejoin that same game. Adding player reconnection tokens would be the
  next feature to build if that matters for your use case.

---

## Ideas for v2

- Reconnect support for players who lose connection mid-game
- Quiz import/export (JSON) and image support on questions
- Multiple-correct-answer and true/false question types
- Public quiz gallery / cloning someone else's quiz
- Per-player (not just per-team) scoring, if you want solo play too
=======
# Quiz-management-system
online quiz management system to attend a online quiz by a url.
>>>>>>> e03038fc99c6c1fa48a9cd3607dcb0b1aa749cfa
