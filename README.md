# AI Flashcards

AI Flashcards is an empathetic web application designed to streamline the learning process by automatically transforming any text into high-quality educational flashcards. Powered by AI, the app generates questions, answers, context, tags, and difficulty levels, allowing users to focus on learning rather than content creation.

## Table of Contents
- [Project Description](#project-description)
- [Tech Stack](#tech-stack)
- [Getting Started Locally](#getting-started-locally)
- [Available Scripts](#available-scripts)
- [Project Scope](#project-scope)
- [Project Status](#project-status)
- [License](#license)

---

## Project Description

The manual creation of flashcards is often a bottleneck in effective learning. AI Flashcards solves this by providing:
- **Instant Generation:** Copy-paste text to receive AI-suggested flashcards.
- **Smart Metadata:** Automatic tagging, difficulty assessment, and context extraction.
- **Manual Control:** A robust inline editor for refining AI suggestions and batch processing.
- **Progress Tracking:** Real-time session goals and statistics.
- **Seamless Integration:** Export data to existing Spaced Repetition Systems (SRS) via JSON/CSV or API.

---

## Tech Stack

### Frontend
- **Astro 5:** High-performance web framework for content-focused websites.
- **React 19:** Used for interactive components like the flashcard editor and filtering systems.
- **TypeScript 5:** For type-safe development.
- **Tailwind CSS 4:** Utility-first styling.
- **Shadcn/ui:** High-quality accessible UI components.

### Backend & AI
- **Supabase:** Managed PostgreSQL database, Authentication, and Row Level Security (RLS).
- **Openrouter.ai:** Unified API for accessing various AI models (OpenAI, Anthropic, Google, etc.).

### Infrastructure
- **GitHub Actions:** Automated CI/CD pipelines.
- **DigitalOcean + Docker:** Containerized hosting and deployment.

---

## Getting Started Locally

### Prerequisites
- **Node.js:** Version `22.14.0` (as specified in `.nvmrc`).
- **Package Manager:** `npm` (included with Node.js).

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/your-username/10xdevs-project.git
   cd 10xdevs-project
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start local Supabase (database + API):**
   ```bash
   npx supabase start
   ```
   To apply migrations to your local database:
   ```bash
   npx supabase db reset
   ```
   Notes:
   - `npx supabase db reset` resets local DB (destructive) and re-applies migrations from `supabase/migrations/`.
   - The project uses an RPC for atomic daily limit enforcement: `public.increment_daily_generation(...)`.

3. **Set up Environment Variables:**
   Create a `.env` file in the root directory and add your credentials:
   ```env
   PUBLIC_SUPABASE_URL=your_supabase_url
   PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   SUPABASE_URL=your_supabase_url
   SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
   OPENROUTER_API_KEY=your_openrouter_api_key
   DEFAULT_USER_ID=your_existing_profiles_id_uuid
   ```
   Notes:
   - `DEFAULT_USER_ID` is a temporary development shortcut (auth will be added later). It must match an existing `public.profiles.id` in your local Supabase DB.

4. **Start the development server:**
   ```bash
   npm run dev
   ```
   The application will be available at `http://localhost:4321`.

---

## Available Scripts

| Command | Description |
| :--- | :--- |
| `npm run dev` | Starts the local development server with hot-reloading. |
| `npm run build` | Builds the production-ready application. |
| `npm run preview` | Previews the production build locally. |
| `npm run lint` | Runs ESLint to check for code quality issues. |
| `npm run lint:fix` | Automatically fixes linting errors where possible. |
| `npm run format` | Formats the codebase using Prettier. |

---

## Project Scope

### MVP Features
- AI-powered flashcard generation from raw text.
- Manual inline editor with batch actions (approve, reject, tag).
- User authentication (Demo vs. Full accounts).
- Usage limits enforcement (2,000 flashcards, 50 decks, 5 generations/day).
- Session progress monitoring and KPI tracking.
- JSON/CSV export for SRS synchronization.

### Out of Scope (MVP)
- Native mobile application (Web-only).
- Direct PDF/DOCX file imports (Copy-paste only).
- Social features or deck sharing between users.
- Built-in advanced SRS algorithm (Integration via export/API).

---

## Project Status

The project is currently in the **MVP Development Phase** as part of a 10-week roadmap.
- [x] Phase 1: Data & Architecture Setup
- [ ] Phase 2: Core AI Generation & Editor Implementation
- [ ] Phase 3: SRS Integration & KPI Testing
- [ ] Phase 4: Final Launch & Optimization

---

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
