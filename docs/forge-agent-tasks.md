# FORGE — AI Fitness Coach · Agent Build Tasks
**Stack:** Node.js · Fastify · PostgreSQL · Redis · Mem0 · Claude API  
**Method:** Claude Code Agent Teams (Monitor + Developer + QA)

---

## Agent Team Configuration

Add this to your `CLAUDE.md` before starting:

```markdown
## Agent Team Roles

**Monitor Agent**
- Read-only access. Never writes code.
- Tracks task completion, flags blockers, ensures QA signs off before next task begins.
- Maintains a PROGRESS.md file with real-time status of all tasks.

**Developer Agent**
- Writes all implementation code.
- One task at a time. Signals Monitor when complete.
- Follows project conventions in this CLAUDE.md.
- Never marks a task done — that is QA's job.

**QA Agent**
- Runs after every Developer task.
- Validates: code works, tests pass, contracts are correct, no regressions.
- Signs off in PROGRESS.md. Blocks next task if issues found.
- Writes failing tests first if TDD is applicable.
```

Enable Agent Teams:
```bash
export CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1
```

---

## Project Conventions (put in CLAUDE.md)

```markdown
## Stack
- Runtime: Node.js 20+
- Framework: Fastify 4.x
- Database: PostgreSQL (via `pg` driver + raw SQL, no ORM)
- Cache: Redis (via `ioredis`)
- LLM: Claude API (claude-sonnet-4-6 for chat, claude-haiku-4-5 for tagging)
- Memory: Mem0 (REST API)
- Queue: BullMQ (Redis-backed)
- Auth: JWT (jsonwebtoken)
- Validation: Zod schemas on all request/response shapes

## Code Rules
- All async functions use async/await, no callbacks
- All routes have Zod validation on input + output
- No `any` types — use typed interfaces throughout
- Errors propagate via Fastify error handler, never raw try/catch in routes
- Environment variables accessed only via `src/config.ts`, never process.env inline
- Tests use Node's built-in test runner (`node:test`) + assert
- Each module has a corresponding `.test.ts` file

## File Structure
src/
  config.ts          # All env vars
  server.ts          # Fastify instance + plugin registration
  db/
    client.ts        # pg pool
    migrations/      # SQL migration files (numbered)
  cache/
    client.ts        # ioredis instance
  queue/
    client.ts        # BullMQ connection
    workers/         # Worker definitions
  modules/
    users/
    conversations/
    memory/
    workouts/
  agents/            # Claude Code subagent definitions
  prompts/           # System prompt files
  types/             # Shared TypeScript types
```

---

## PHASE 1 — Infrastructure & Project Setup

### TASK 1.1 — Environment & Config Layer
**Agent:** Developer  
**Goal:** Create the config module and environment validation

**Deliverables:**
- `src/config.ts` that reads and validates all env vars using Zod
- `.env.example` with all required keys
- Fastify server bootstrapped in `src/server.ts` with health check route `GET /health`

**Required env vars to support:**
```
DATABASE_URL
REDIS_URL
ANTHROPIC_API_KEY
MEM0_API_KEY
JWT_SECRET
PORT (default 3000)
NODE_ENV
```

**QA Checklist:**
- [ ] `GET /health` returns `{ status: "ok", timestamp: ... }`
- [ ] Server fails fast with clear error if required env vars are missing
- [ ] Config values are typed, not raw strings where possible

---

### TASK 1.2 — Database Setup & Migrations
**Agent:** Developer  
**Goal:** PostgreSQL client + schema for the full app

**Deliverables:**
- `src/db/client.ts` — pg pool with connection error handling
- Migration runner script at `scripts/migrate.ts`
- Migration files:

```sql
-- 001_users.sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  onboarding_complete BOOLEAN DEFAULT FALSE,
  mem0_user_id TEXT UNIQUE  -- Mem0's reference ID for this user
);

-- 002_conversations.sql
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  session_type TEXT DEFAULT 'chat'  -- 'chat' | 'workout'
);

-- 003_messages.sql
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL,  -- 'user' | 'assistant'
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'
);

-- 004_workouts.sql
CREATE TABLE workouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES conversations(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  plan JSONB NOT NULL,  -- full generated workout
  feedback JSONB DEFAULT '{}'  -- what user reported back
);

-- 005_user_facts.sql
-- Local cache of facts extracted from conversations
-- Source of truth is Mem0, this is a readable audit log
CREATE TABLE user_facts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  fact TEXT NOT NULL,
  category TEXT,  -- 'schedule' | 'fitness_history' | 'personality' | 'goal' | 'constraint'
  source_conversation_id UUID REFERENCES conversations(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  confidence NUMERIC DEFAULT 1.0
);
```

**QA Checklist:**
- [ ] `npm run migrate` runs all migrations cleanly on a fresh DB
- [ ] Re-running migrations is idempotent (no errors on second run)
- [ ] All foreign keys and indexes exist
- [ ] DB client handles pool exhaustion gracefully

---

### TASK 1.3 — Redis & Queue Setup
**Agent:** Developer  
**Goal:** Redis client + BullMQ infrastructure for async jobs

**Deliverables:**
- `src/cache/client.ts` — ioredis singleton with reconnect logic
- `src/queue/client.ts` — BullMQ connection config
- `src/queue/workers/memoryExtractor.ts` — worker that processes `extract-memory` jobs (stub for now, implementation in Phase 3)
- Queue definition: `memoryQueue` for post-conversation memory extraction jobs

**QA Checklist:**
- [ ] Redis connection failure logs clearly and retries
- [ ] BullMQ worker starts without errors
- [ ] Can enqueue and dequeue a test job successfully
- [ ] Worker is gracefully shut down on `SIGTERM`

---

## PHASE 2 — User & Conversation API

### TASK 2.1 — User Creation & Auth
**Agent:** Developer  
**Goal:** Minimal auth flow. Users are anonymous by default (no email/password required for MVP), identified by a device token.

**Deliverables:**
- `POST /api/users` — creates a new user, registers them in Mem0, returns JWT
- `GET /api/users/me` — returns current user profile (requires JWT)
- JWT middleware that validates token and attaches `req.user` to all protected routes
- Mem0 integration: when a user is created, call Mem0 to register a new user entity

**Request/Response shapes:**
```typescript
// POST /api/users
// Body: none (creates anonymous user)
// Response:
{
  userId: string,
  token: string,  // JWT
  createdAt: string
}

// GET /api/users/me
// Headers: Authorization: Bearer <token>
{
  userId: string,
  createdAt: string,
  onboardingComplete: boolean,
  factsCollected: number  // count of user_facts rows
}
```

**QA Checklist:**
- [ ] Two calls to `POST /api/users` create two distinct users
- [ ] JWT is valid and contains `userId`
- [ ] `GET /api/users/me` with invalid JWT returns 401
- [ ] User is registered in Mem0 on creation

---

### TASK 2.2 — Conversation Session Management
**Agent:** Developer  
**Goal:** Start, continue, and end conversations. This is the container for all chat messages.

**Deliverables:**
- `POST /api/conversations` — starts a new conversation, returns `conversationId`
- `GET /api/conversations/:id` — returns conversation with all messages
- `POST /api/conversations/:id/end` — marks conversation as ended, enqueues memory extraction job
- All routes require JWT auth

**QA Checklist:**
- [ ] New conversation returns correct `conversationId`
- [ ] Ending a conversation enqueues a BullMQ job with `{ userId, conversationId }`
- [ ] Fetching a conversation returns messages in chronological order
- [ ] Cannot fetch another user's conversation (403)

---

### TASK 2.3 — The Chat Endpoint (Core AI Loop)
**Agent:** Developer  
**Goal:** This is the heart of the app. The streaming chat endpoint that calls Claude with full context.

**Deliverables:**
- `POST /api/conversations/:id/message` — sends a user message, returns AI response
- Loads last 20 messages from DB for short-term context
- Fetches relevant memories from Mem0 for long-term context
- Constructs full system prompt (see prompt spec below)
- Calls `claude-sonnet-4-6` via Anthropic SDK
- Saves both user message and AI response to DB
- Returns AI response as streaming SSE (`text/event-stream`)

**System prompt structure** (save as `src/prompts/coach.ts`):
```typescript
export function buildCoachPrompt(userFacts: string[], recentMemories: string[]): string {
  return `You are a personal fitness coach inside an app called Forge.

Your personality:
- Warm but direct. You don't flatter, you motivate.
- You remember everything about this person and use it naturally.
- You ask one question at a time. Never overwhelm.
- During early conversations, you're building a picture of who this person is — their schedule, history, what makes them quit, what drives them. Do this through natural conversation, never a form.
- You generate workouts only when you have enough context to make them personal.

What you know about this user:
${userFacts.length > 0 ? userFacts.map(f => `- ${f}`).join('\n') : '- Still getting to know them. Keep asking natural questions.'}

Recent context from memory:
${recentMemories.length > 0 ? recentMemories.map(m => `- ${m}`).join('\n') : '- No prior sessions yet.'}

Rules:
- Never mention that you're an AI or built on Claude.
- Never ask more than one question per message.
- If the user mentions anything about their schedule, habits, goals, history, energy, sleep, stress — note it internally; the memory system will extract it.
- When you generate a workout, output it in a structured JSON block wrapped in <workout>...</workout> tags. Otherwise respond in plain conversational text.`;
}
```

**Request/Response:**
```typescript
// POST /api/conversations/:id/message
// Body:
{ content: string }

// Response: SSE stream
// Each event: data: { type: 'delta', content: '...' }
// Final event: data: { type: 'done', messageId: '...' }
```

**QA Checklist:**
- [ ] Sending a message returns a streamed response
- [ ] Both user message and AI response are saved to DB
- [ ] System prompt includes any existing user facts
- [ ] Mem0 is queried for relevant memories before each call
- [ ] Sending to a non-existent or other user's conversation returns correct error
- [ ] Stream closes cleanly with `done` event

---

## PHASE 3 — Memory System

### TASK 3.1 — Mem0 Integration Module
**Agent:** Developer  
**Goal:** Clean wrapper around Mem0's API with typed methods

**Deliverables:**
- `src/modules/memory/mem0Client.ts` — typed wrapper:

```typescript
interface Memory {
  id: string
  content: string
  category?: string
  createdAt: string
}

export const mem0 = {
  // Add a memory for a user
  async addMemory(userId: string, content: string, category?: string): Promise<Memory>

  // Search memories relevant to a query
  async searchMemories(userId: string, query: string, limit?: number): Promise<Memory[]>

  // Get all memories for a user
  async getAllMemories(userId: string): Promise<Memory[]>

  // Delete a specific memory
  async deleteMemory(memoryId: string): Promise<void>
}
```

**QA Checklist:**
- [ ] `addMemory` stores a fact and returns it with an ID
- [ ] `searchMemories("morning workout preference")` returns semantically relevant results
- [ ] `getAllMemories` returns the full list for a user
- [ ] All methods handle Mem0 API errors gracefully with typed errors

---

### TASK 3.2 — Memory Extraction Worker
**Agent:** Developer  
**Goal:** After each conversation ends, extract facts about the user and store them in Mem0

**Deliverables:**
- Implement the `memoryExtractor` BullMQ worker (stubbed in Task 1.3)
- Worker receives `{ userId, conversationId }`
- Fetches all messages from that conversation
- Calls `claude-haiku-4-5` with an extraction prompt to identify facts
- Saves extracted facts to both `user_facts` table AND Mem0
- Extraction prompt spec (save as `src/prompts/extractor.ts`):

```typescript
export const EXTRACTION_PROMPT = `You are a memory extraction system for a fitness coaching app.

Given a conversation between a coach and a user, extract factual information about the user that would help a personal coach.

Extract facts in these categories:
- schedule: when they wake up, work hours, free time, travel patterns
- fitness_history: what they've tried before, injuries, gym experience
- personality: what motivates them, what makes them quit, how they respond to challenge
- goal: what they want to achieve, why they want it
- constraint: injuries, equipment limitations, time constraints

Return ONLY a JSON array. No explanation.
Format:
[
  { "fact": "Wakes up at 6am on weekdays", "category": "schedule", "confidence": 0.9 },
  { "fact": "Has tried gym twice before but quit after 3 weeks", "category": "fitness_history", "confidence": 0.95 }
]

If no clear facts can be extracted, return an empty array: []`;
```

**QA Checklist:**
- [ ] Worker processes job without errors
- [ ] Extracted facts appear in `user_facts` table
- [ ] Extracted facts are stored in Mem0 under the correct user
- [ ] Worker handles Claude API errors without crashing (logs + retries)
- [ ] Empty/very short conversations produce no facts (empty array) without errors

---

### TASK 3.3 — Memory API Endpoints
**Agent:** Developer  
**Goal:** Let the frontend read what the coach knows about the user

**Deliverables:**
- `GET /api/users/me/memories` — returns all facts known about the current user
- `DELETE /api/users/me/memories/:factId` — user can remove a fact (GDPR)

**Response shape:**
```typescript
// GET /api/users/me/memories
{
  facts: [
    {
      id: string,
      fact: string,
      category: string,
      createdAt: string,
      confidence: number
    }
  ],
  totalCount: number
}
```

**QA Checklist:**
- [ ] Returns facts grouped or sortable by category
- [ ] Deleting a fact removes it from both `user_facts` table and Mem0
- [ ] Empty memory state returns `{ facts: [], totalCount: 0 }` not an error

---

## PHASE 4 — Workout Generation

### TASK 4.1 — Workout Generation Endpoint
**Agent:** Developer  
**Goal:** Generate a personalized workout on demand based on everything known about the user

**Deliverables:**
- `POST /api/workouts/generate` — generates a workout
- Fetches all user memories from Mem0
- Fetches last 5 workouts from DB (to avoid repetition)
- Calls `claude-sonnet-4-6` with workout generation prompt
- Parses and validates the structured output
- Saves workout to DB
- Returns typed workout object

**Request:**
```typescript
// POST /api/workouts/generate
{
  durationMinutes: number,     // e.g. 30
  energyLevel: 1 | 2 | 3 | 4 | 5,  // user self-reports
  availableEquipment?: string[], // optional override
  notes?: string               // "my shoulder is sore today"
}
```

**Workout output schema** (validate with Zod):
```typescript
const ExerciseSchema = z.object({
  name: z.string(),
  sets: z.number(),
  reps: z.union([z.number(), z.string()]),  // string for "30 seconds"
  weight: z.string().optional(),            // "bodyweight" | "65kg" | "moderate"
  restSeconds: z.number(),
  coachNote: z.string()                     // personalized to this user
})

const WorkoutSchema = z.object({
  title: z.string(),
  totalMinutes: z.number(),
  warmup: z.array(ExerciseSchema),
  main: z.array(ExerciseSchema),
  cooldown: z.array(ExerciseSchema),
  coachIntro: z.string(),  // Personalized opening from the coach
  coachOutro: z.string()   // What to expect / why this workout
})
```

**QA Checklist:**
- [ ] Returns a valid workout matching the Zod schema
- [ ] `coachIntro` references something specific to the user (from memory)
- [ ] Workout is saved to `workouts` table with `plan` JSONB
- [ ] Duration is respected (30 min request ≠ 60 min workout)
- [ ] Consecutive calls produce different workouts (no exact repeats)

---

### TASK 4.2 — Workout Feedback Endpoint
**Agent:** Developer  
**Goal:** Let users report back on a completed workout — this feeds the memory system

**Deliverables:**
- `POST /api/workouts/:id/feedback` — submit post-workout feedback
- Saves feedback to `workouts.feedback` column
- Enqueues a memory extraction job with the feedback content
- This ensures things like "skipped leg day again" become part of the user's memory

**Request:**
```typescript
{
  completed: boolean,
  perceivedDifficulty: 1 | 2 | 3 | 4 | 5,
  skippedExercises: string[],  // exercise names
  notes?: string               // "felt great" | "shoulder hurt on press"
}
```

**QA Checklist:**
- [ ] Feedback is saved to the workout record
- [ ] A memory job is enqueued after feedback submission
- [ ] Submitting feedback twice returns 409 conflict

---

## PHASE 5 — Integration & Hardening

### TASK 5.1 — End-to-End Integration Test
**Agent:** QA (leads this task)  
**Goal:** Verify the complete user journey works as a single flow

**Test scenario to implement as `tests/integration/full-journey.test.ts`:**

```
1. Create user → get JWT
2. Start conversation
3. Send 5 messages (simulate onboarding conversation)
4. End conversation → verify memory extraction job was enqueued
5. Wait for worker to process (or trigger manually)
6. Verify user_facts table has at least 1 extracted fact
7. Generate a workout with energyLevel: 3, durationMinutes: 30
8. Verify workout structure matches schema
9. Submit workout feedback
10. Verify feedback saved to DB
11. Fetch /api/users/me/memories → verify facts exist
```

**QA Checklist:**
- [ ] Full journey completes without errors
- [ ] All DB records exist in expected state at each step
- [ ] No orphaned records or dangling references
- [ ] Total latency for steps 1–7 is under 30 seconds

---

### TASK 5.2 — Error Handling & Observability
**Agent:** Developer  
**Goal:** Make the API production-safe with consistent error handling and logging

**Deliverables:**
- Global Fastify error handler that returns consistent error shape:
```typescript
{ error: { code: string, message: string, statusCode: number } }
```
- Request logging using Fastify's built-in `pino` logger
- Structured log output with `requestId`, `userId` (when available), `duration`
- Rate limiting on chat endpoint: 60 messages/minute per user (via `@fastify/rate-limit`)
- Graceful shutdown: drain in-flight requests + close DB pool + close Redis on `SIGTERM`

**QA Checklist:**
- [ ] 404 on unknown route returns consistent error shape
- [ ] Validation errors return 400 with field-level detail
- [ ] Auth errors return 401 with clear message
- [ ] Rate limit returns 429 with `retryAfter` header
- [ ] `SIGTERM` causes clean shutdown (no hanging connections)

---

### TASK 5.3 — README & Local Dev Setup
**Agent:** Developer  
**Goal:** Any developer can clone and run this in under 10 minutes

**Deliverables:**
- `README.md` with:
  - Prerequisites (Node 20+, Docker)
  - `docker-compose.yml` with Postgres + Redis services
  - Step-by-step local setup instructions
  - All `npm run` scripts documented
  - API endpoint reference table
- `package.json` scripts:
  - `dev` — watch mode with tsx
  - `build` — compile TypeScript
  - `migrate` — run migrations
  - `test` — run all tests
  - `test:integration` — integration tests only

**QA Checklist:**
- [ ] Following the README from scratch results in a running server
- [ ] `npm test` passes all unit tests
- [ ] All environment variables are documented in `.env.example`

---

## Delivery Order Summary

```
Phase 1: Infrastructure
  1.1 → Config & Server
  1.2 → Database & Migrations
  1.3 → Redis & Queue

Phase 2: Conversation API
  2.1 → Users & Auth
  2.2 → Conversation Sessions
  2.3 → Chat Endpoint (AI loop)  ← First "it's alive" moment

Phase 3: Memory
  3.1 → Mem0 Integration
  3.2 → Extraction Worker
  3.3 → Memory API

Phase 4: Workouts
  4.1 → Workout Generation
  4.2 → Feedback Loop

Phase 5: Hardening
  5.1 → Integration Test
  5.2 → Error Handling
  5.3 → README & Dev Setup
```

**First proof-of-life checkpoint: Task 2.3**  
Once the chat endpoint is live and responding through the Claude API with user facts in context — the brain is working. Everything after that is making it smarter and more complete.

---

*Tasks written for Claude Code Agent Teams. Each task is self-contained with clear inputs, outputs, and QA sign-off criteria.*
