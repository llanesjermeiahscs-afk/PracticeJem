// tests/integration.test.js
// Integration tests using Jest + Supertest. They run against an in-memory SQLite DB.
// Tests cover register, login, /api/me, todos create/patch/delete, and validation behavior.
//
// Important testing pattern:
// - set process.env.DB_FILE = ':memory:' BEFORE requiring the app so db.js uses in-memory DB.
// - use supertest.agent to preserve cookies between requests (simulate a browser session).

// Ensure environment is test before app/db modules load.
process.env.DB_FILE = ':memory:';
process.env.JWT_SECRET = 'test-secret'; // deterministic signing in tests

const request = require('supertest');

let app;
let agent;

beforeAll(() => {
  // require app after we set DB_FILE so db.js initializes the in-memory DB
  app = require('../app');
  agent = request.agent(app);
});

describe('Auth & Todos integration', () => {
  const user = { email: 'tester@example.com', password: 'password123', name: 'Tester' };
  let createdTodoId;

  test('Register a new user', async () => {
    const res = await agent.post('/api/register').send(user);
    expect(res.status).toBe(201);
    expect(res.body.user).toBeDefined();
    expect(res.body.user.email).toBe(user.email);
  });

  test('Registration with short password returns validation errors', async () => {
    const res = await agent.post('/api/register').send({ email: 'bad@example.com', password: 'short' });
    expect(res.status).toBe(400);
    expect(res.body.errors).toBeDefined();
    expect(Array.isArray(res.body.errors)).toBe(true);
  });

  test('Login with correct credentials sets cookie and returns token', async () => {
    const res = await agent.post('/api/login').send({ email: user.email, password: user.password });
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/Logged in/i);
    // supertest agent stores cookies automatically for subsequent requests
    // token may also be returned in JSON (app returns it for convenience)
    expect(res.body.token).toBeDefined();
  });

  test('GET /api/me returns authenticated user', async () => {
    const res = await agent.get('/api/me');
    expect(res.status).toBe(200);
    expect(res.body.user).toBeDefined();
    expect(res.body.user.email).toBe(user.email);
  });

  test('Create a todo', async () => {
    const res = await agent.post('/api/todos').send({ text: 'Write tests' });
    expect(res.status).toBe(201);
    expect(res.body.todo).toBeDefined();
    expect(res.body.todo.text).toBe('Write tests');
    createdTodoId = res.body.todo.id;
  });

  test('List todos shows created todo', async () => {
    const res = await agent.get('/api/todos');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.todos)).toBe(true);
    expect(res.body.todos.length).toBeGreaterThanOrEqual(1);
  });

  test('Patch todo (toggle done)', async () => {
    const res = await agent.patch(`/api/todos/${createdTodoId}`).send({ done: true });
    expect(res.status).toBe(200);
    expect(res.body.todo).toBeDefined();
    expect(res.body.todo.done).toBe(true);
  });

  test('Delete todo', async () => {
    const res = await agent.delete(`/api/todos/${createdTodoId}`);
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/Deleted/i);

    // Confirm it's gone
    const list = await agent.get('/api/todos');
    const ids = (list.body.todos || []).map(t => t.id);
    expect(ids).not.toContain(createdTodoId);
  });
});