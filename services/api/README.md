# API service boundary

The MVP implements its Node/TypeScript API as Next.js route handlers in
`src/app/api`. That keeps the web UI and simulation boundary deployable together.
When `DATABASE_URL` is present, completed reports are persisted to PostgreSQL using
this directory’s schema. Without it (for `npm run dev`), reports are deliberately
ephemeral and the `GET /api/stress-tests/:id` endpoint works only until restart.

The pure economic model is deliberately outside HTTP code under `src/engine`.
