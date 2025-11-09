# PracticeJem
Web Dev Continuous Step Progression Practice 

```markdown

-------------------------------------------------------------------------------------------
# Codespaces Practice: Step-by-step Web Dev (Node + Express + SQLite + Vanilla JS)

Overview
This is a small, progressive learning project designed like a Codecademy exercise series.
It uses Node.js + Express for the backend and SQLite (file DB) for persistence. The frontend is plain HTML/vanilla JS so you can focus on fundamentals. Each lesson adds a small feature.

Quick start in Codespaces
1. Open this repository in GitHub Codespaces.
2. Codespaces will run `npm install` automatically (devcontainer configured).
3. Start the app:
   npm start
4. Visit http://localhost:3000 in the Codespaces browser preview (or forward port 3000 to your local browser).

Files of interest
- server.js         : Express server & API routes (register, login, todos).
- db.js             : SQLite setup and helper functions.
- public/index.html : Simple UI (register / login / todo).
- public/app.js     : Frontend logic calling the API.
- .devcontainer/*   : Codespaces devcontainer to auto-install deps.

Environment
- Copy .env.example to .env and set JWT_SECRET if you want (a default is provided for local practice).

Lesson plan (do them in order)
1. Lesson 1 — Run the server and open the UI
   - Goal: see the static page served by Express.
   - Commands: npm start, open http://localhost:3000
   - What you learn: Express static files, folder structure.

2. Lesson 2 — Register a user
   - Task: create an account using the Register form.
   - What you learn: POST to /api/register, password hashing, storing user in DB.

3. Lesson 3 — Log in and session cookie
   - Task: Log in from the Login form.
   - What you learn: verifying password, issuing JWT in an httpOnly cookie (so JS can't read it), sending credentials: 'include' from fetch.

4. Lesson 4 — Protected endpoints & Todos
   - Task: After logging in, create todos and view them.
   - What you learn: protected route middleware that validates JWT, using user context to create/read todos.

5. Lesson 5 — Add input validation & error messages
   - Task: Add small checks in frontend and backend to prevent bad input.
   - What you learn: basic validation patterns.

6. Lesson 6 — Refactor & test locally
   - Task: Explore db.js and server.js and try adding a new field (e.g., todo 'done' flag).
   - What you learn: simple schema changes, running app with new migrations.

Extend after lessons
- Convert frontend to React
- Add password reset (email integration)
- Add refresh tokens and rotate them
- Add rate limiting (express-rate-limit)

Tips
- The JWT is set as an httpOnly cookie to reduce XSS risk. The frontend cannot read it directly (that's intentional).
- The SQLite file is located at ./data/dev.db — safe for local practice but not for production.
- Use `console.log` in Codespaces terminal to inspect server logs.

If you want, I will:
- Provide the next lesson with unit tests and exercises for each task.
- Convert the frontend to React in a later lesson and explain state flow.
- Add a Docker Compose and deployment lesson.

Start by opening this repo in Codespaces and running: npm start
```

---

## Running the rentals feed (local setup notes)

This project includes a new Rentals feed UI at `/feed.html` and API endpoints for posting rentals, uploading images, commenting and liking.

Recommended environment:
- Node.js 18.x (prebuilt native modules like better-sqlite3 work best)
- A POSIX environment with build tools installed if you need to rebuild native modules (see below)

Quick setup (Linux / Codespaces / devcontainer):

```bash
# (optional) use nvm to switch to Node 18
nvm install 18
nvm use 18

# install dependencies
npm install

# run DB migrations for rentals/comments/likes
node migrations/migrate-create-rentals.js

# start the server
npm start

# Open http://localhost:3000/feed.html to see the feed
```

If you run into build errors installing `better-sqlite3`, install system build deps first:

```bash
sudo apt update
sudo apt install -y build-essential python3-dev libsqlite3-dev
rm -rf node_modules package-lock.json
npm install
```

Notes:
- The upload endpoint stores images under `public/uploads/` and they are served statically.
- Authentication APIs exist (`/api/register`, `/api/login`) and use an httpOnly JWT cookie. Use the UI or send `Authorization: Bearer <token>` to authenticate API calls from other clients.


3000 (https://urban-space-fiesta-wrqpqr6gq77ghv6vp-3000.app.github.dev/)