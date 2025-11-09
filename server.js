// server.js: start script that imports the app and listens
// Purpose: keep app.js test-friendly (no listen) while server.js does the actual listen in dev/prod.

const app = require('./app');

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT} (PORT=${PORT})`);
});