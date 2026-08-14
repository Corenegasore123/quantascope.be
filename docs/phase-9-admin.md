# Admin Panel (Phase 9)

Admin-only routes under `/api/admin` (requires `UserRole.ADMIN`).

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/admin/stats` | Platform stats + system health |
| GET | `/api/admin/health` | Service health (DB, Redis, CV, uptime) |
| GET | `/api/admin/users` | Paginated user list (`?search=&page=&limit=`) |
| PATCH | `/api/admin/users/:id` | Update user role or name |
| GET | `/api/admin/audit` | Paginated audit log (`?action=&userId=&page=&limit=`) |
| GET | `/api/admin/audit/actions` | Distinct audit action types |

## Access

- Grant `ADMIN` role in the database for platform operators (no demo seed users)
- Admins cannot demote their own account
- All admin actions are audit-logged

## Frontend

- `/admin` — overview (stats + health), users table, audit log viewer
- Admin nav link visible only for `ADMIN` role
