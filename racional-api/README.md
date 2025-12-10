## Racional Challenge API

Backend-style API built with Next.js (App Router), Prisma and PostgreSQL.

### Prerequisites

- Node 24.0.2 (or any version supported by Prisma 7+)
- Local PostgreSQL instance

### Environment setup

1. Duplicate `env.example` to `.env` and update the connection string if needed:

   ```bash
   cp env.example .env
   ```

2. Ensure the referenced database (`racional_challenge` by default) exists in Postgres.

### Install & database

```bash
npm install
npm run prisma:migrate      # runs `prisma migrate dev`
npm run prisma:generate     # optional: regenerate Prisma client
npm run prisma:seed         # seeds demo user + empty portfolio
```

> The first migration creates the `User` table defined in `prisma/schema.prisma`. Adjust the schema before migrating if you need additional models.

### Development

```bash
npm run dev
```

The dev server runs on [http://localhost:3000](http://localhost:3000).

### Available scripts

- `npm run lint` – Next.js linting
- `npm run prisma:migrate` – Create/apply migrations locally
- `npm run prisma:generate` – Regenerate Prisma client
- `npm run prisma:studio` – Open Prisma Studio for inspecting data
- `npm run prisma:seed` – Seed demo user + starter portfolio

### Users API

`src/app/api/users/route.ts` exposes a simple CRUD starter:

| Method | Description                |
| ------ | -------------------------- |
| GET    | List users ordered by time |
| POST   | Create a new user          |

Example request:

```bash
curl -X POST http://localhost:3000/api/users \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@example.com","name":"Demo"}'
```

Responses follow the shape `{ data: ... }` on success and `{ error: string }` on failures.
