# REST API Plan

This document outlines the REST API architecture for the AI Flashcards application, designed to support the functionality described in the PRD and adhering to the database schema.

## 1. Resources

The API is structured around the following core resources, mapping directly to the database entities:

| Resource        | Database Table                 | Description                                                              |
| :-------------- | :----------------------------- | :----------------------------------------------------------------------- |
| **Decks**       | `decks`                        | Collections of flashcards organized by the user.                         |
| **Cards**       | `cards`                        | The core flashcard entities containing questions, answers, and metadata. |
| **Sources**     | `sources`                      | Original text content uploaded/pasted by users to generate cards.        |
| **Generation**  | N/A (Service)                  | The AI service endpoint for converting text into flashcards.             |
| **User Status** | `profiles`, `user_usage_stats` | User account information, limits, and daily usage statistics.            |
| **Export**      | N/A (Service)                  | Functionality to export deck data for external SRS tools.                |

---

## 2. Endpoints

### 2.1. AI Generation (Core Feature)

**Generate Cards**

- **Method**: `POST`
- **URL**: `/api/ai/generate`
- **Description**: Triggers the AI pipeline. Checks user limits, creates a `source` record, calls the AI provider (OpenRouter), parses the response, and inserts `cards` with `quality_status='draft'`.
- **Success Code**: `201 Created`
- **Request Body**:
  ```json
  {
    "content": "string (min 50 chars, max 100k chars)",
    "deck_id": "uuid (optional)"
  }
  ```
- **Response Body**:
  ```json
  {
    "source_id": "uuid",
    "cards": [
      {
        "id": "uuid",
        "front": "string",
        "back": "string",
        "context": "string",
        "difficulty": "number",
        "tags": ["string"],
        "quality_status": "draft"
      }
    ],
    "remaining_generations": "number"
  }
  ```
- **Notes**:
  - API uses `front`/`back` in response, mapped from DB `question`/`answer`.
- **Business Logic**:
  - Verify `user_usage_stats` for daily generation limit (5 for full, less for demo).
  - Create `kpi_events` entry (`event_type: 'ai_generation'`).
  - Calculate cost/usage.

### 2.2. Decks

**List Decks**

- **Method**: `GET`
- **URL**: `/api/decks`
- **Query Params**: `page`, `limit`, `search` (optional)
- **Response**: `data: Deck[]`, `meta: { total, page, limit }`

**Create Deck**

- **Method**: `POST`
- **URL**: `/api/decks`
- **Request Body**:
  ```json
  {
    "name": "string",
    "description": "string (optional)"
  }
  ```
- **Validation**: Check deck count limit (max 50).

**Get Deck**

- **Method**: `GET`
- **URL**: `/api/decks/:id`

**Update Deck**

- **Method**: `PATCH`
- **URL**: `/api/decks/:id`
- **Request Body**: `{ "name": "string", "description": "string" }`

**Delete Deck**

- **Method**: `DELETE`
- **URL**: `/api/decks/:id`
- **Logic**: Cascades to delete cards (handled by DB `ON DELETE CASCADE` or logic depending on requirement to keep orphaned cards). _Note: DB schema says `cards.deck_id` ON DELETE SET NULL, so cards become unorganized._

### 2.3. Cards

**List Cards**

- **Method**: `GET`
- **URL**: `/api/cards`
- **Query Params**:
  - `deck_id` (optional)
  - `source_id` (optional)
  - `quality_status` (optional)
  - `tags` (optional)
  - `sort` (e.g., `created_at_desc`)
- **Response**: `data: Card[]`, `meta: Pagination`

**Create Card (Manual & Bulk)**

- **Method**: `POST`
- **URL**: `/api/cards`
- **Request Body**: Accepts a single card object or an array of card objects.
  ```json
  // Single object or Array:
  [
    {
      "question": "string",
      "answer": "string",
      "context": "string",
      "deck_id": "uuid",
      "tags": ["string"],
      "difficulty": 3
    }
  ]
  ```
- **Validation**: Check card count limit (max 2000) against the total number of cards to be created.

**Update Card**

- **Method**: `PATCH`
- **URL**: `/api/cards/:id`
- **Request Body**: Partial card object with fields:
  `question`, `answer`, `context`, `deck_id`, `tags`, `difficulty`, `quality_status`
- **Logic**: If critical fields change, update `kpi_events` (`event_type: 'card_edit'`).

**Batch Update Cards**

- **Method**: `PATCH`
- **URL**: `/api/cards/batch`
- **Description**: Efficiently update status or tags for multiple cards (US-003).
- **Request Body**:
  ```json
  {
    "card_ids": ["uuid"],
    "action": "update_status" | "add_tags" | "delete",
    "payload": {
      "quality_status": "ok", // if action is update_status
      "tags": ["new_tag"]     // if action is add_tags
    }
  }
  ```

**Delete Card**

- **Method**: `DELETE`
- **URL**: `/api/cards/:id`

### 2.4. User & Status

**Get User Status**

- **Method**: `GET`
- **URL**: `/api/me/status`
- **Description**: Returns user role, current usage vs limits, and demo status.
- **Response**:
  ```json
  {
    "id": "uuid",
    "role": "demo" | "full",
    "limits": {
      "cards_created": 150,
      "cards_limit": 2000,
      "decks_created": 5,
      "decks_limit": 50,
      "daily_generations_used": 2,
      "daily_generations_limit": 5
    }
  }
  ```

### 2.5. Export

**Export Data**

- **Method**: `GET`
- **URL**: `/api/export`
- **Query Params**: `deck_id` (optional), `format` (json/csv)
- **Description**: Generates a download of the user's cards for external SRS.

---

## 3. Authentication & Authorization

- **Mechanism**: Supabase Auth (JWT).
- **Implementation**:
  - All API routes (except public assets) are protected via middleware.
  - The backend extracts the `access_token` from the request Authorization header or Cookie.
  - `auth.uid()` is used to enforce Row Level Security (RLS) policies at the database level.
  - API endpoints verify the user exists before proceeding.

## 4. Validation & Business Logic

### 4.1. Validation Rules (Zod Schemas)

- **Cards**:
  - `question`: min 1 char, required.
  - `answer`: min 1 char, required.
  - `difficulty`: integer 1-5.
  - `quality_status`: enum ['draft', 'ok', 'good'].
- **Decks**:
  - `name`: required, max length 100.
- **AI Request**:
  - `content`: max 100,000 characters (soft limit per PRD/DB schema).

### 4.2. Business Logic Enforcement

1.  **Limits**:
    - Before any `POST` to `/decks` or `/cards`, query `count(*)` (or a pre-calculated counter) to ensure user is within limits (50 decks, 2000 cards).
    - Before `POST` to `/ai/generate`, check `user_usage_stats` for today's date. If record missing, create it. If `generation_count` >= limit, reject with `429 Too Many Requests`.

2.  **KPI Tracking**:
    - Use an internal helper `logEvent(userId, type, metadata)` to insert into `kpi_events` asynchronously (or fire-and-forget) to avoid slowing down the main response.
    - Events to track: `session_start`, `ai_generation`, `card_accept`, `export`.

3.  **Demo vs Full**:
    - Endpoints check `profiles.account_role`.
    - Demo users might have stricter limits (e.g., 1 generation/day) handled in the Limit logic.

## 5. Error Handling

Standard HTTP status codes will be used:

- `200 OK`: Success.
- `201 Created`: Resource created successfully.
- `400 Bad Request`: Validation failure (response includes field-level error details).
- `401 Unauthorized`: Missing or invalid JWT.
- `403 Forbidden`: User tries to access resource they don't own (enforced by RLS/Logic).
- `429 Too Many Requests`: Limit reached (daily generations or account limits).
- `500 Internal Server Error`: Unhandled application error.

---

## 6. DTO Shapes (API Responses)

These shapes describe what the API returns. They align with `src/types.ts`.

**Deck**

```json
{
  "id": "uuid",
  "name": "string",
  "description": "string | null",
  "created_at": "timestamp"
}
```

**Card**

```json
{
  "id": "uuid",
  "question": "string",
  "answer": "string",
  "context": "string | null",
  "difficulty": "number",
  "tags": ["string"],
  "quality_status": "draft" | "ok" | "good",
  "deck_id": "uuid | null",
  "source_id": "uuid | null",
  "created_at": "timestamp",
  "updated_at": "timestamp"
}
```

**GeneratedCard** (AI response)

```json
{
  "id": "uuid",
  "front": "string",
  "back": "string",
  "context": "string | null",
  "difficulty": "number",
  "tags": ["string"],
  "quality_status": "draft"
}
```
