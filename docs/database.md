# Database

PostgreSQL via Prisma. Schema supports multi-user isolation and future SaaS expansion without billing tables yet.

## Core entities (Milestone 1–2)

```
User
 ├── Session[]
 ├── Project[]        (personal workspace created on register)
 ├── Image[]          (documents with DocumentStatus)
 ├── CalculationJob[]
 └── AuditLog[]

Project
 ├── Image[]
 └── CalculationJob[]

Image → CalculationJob → measurements, variables, result, steps, reports
```

## Document status

`Image.status`: `UPLOADING` | `UPLOADED` | `PROCESSING` | `PROCESSED` | `FAILED`

See [document-processing.md](./document-processing.md).

## User isolation

Every `CalculationJob` and `Image` is scoped to `userId`. API handlers use `assertJobAccess(userId, jobId)` — cross-user IDOR returns 404.

Legacy jobs without `userId` (pre-migration) are invisible to authenticated users.

## Indexes

- `User.email`
- `Session.userId`, `Session.expiresAt`
- `Project.ownerId`, `Project.status`
- `CalculationJob.userId`, `projectId`, `status`, `createdAt`

## Audit log

Append-only `AuditLog` for security events: register, login, logout, password change, project create, calculation create.

## Migrations

```bash
npm run db:generate
npm run db:push
npm run seed
```

## Future (not implemented)

- `Organization`, `OrganizationMember`, invitations
- `Subscription`, `Plan`, usage billing
- Calculation versioning table
- Comments and notifications

These can be added without changing the deterministic calculation engine.
