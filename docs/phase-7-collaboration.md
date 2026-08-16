# Collaboration (Phase 7)

Multi-user project sharing with role-based access and in-app notifications.

## Roles

| Role | Permissions |
|------|-------------|
| **Owner** | Full control — edit project, manage team, upload, edit calculations |
| **Editor** | Upload documents, correct/recalculate, create scenarios |
| **Viewer** | Read-only — view documents, calculations, reports, activity |

## API

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/projects/:id/members` | List owner + members |
| POST | `/api/projects/:id/members` | Invite user by email (owner only) |
| PATCH | `/api/projects/:id/members/:userId` | Change role (owner only) |
| DELETE | `/api/projects/:id/members/:userId` | Remove member (owner only) |
| GET | `/api/notifications` | User notifications + unread count |
| PATCH | `/api/notifications/:id/read` | Mark one read |
| POST | `/api/notifications/read-all` | Mark all read |

## Notifications

Triggered automatically for:

- Project invite (`PROJECT_INVITE`)
- Member removed (`MEMBER_REMOVED`)
- Calculation completed on shared project (`CALCULATION_COMPLETED`)
- Low-confidence result needs review (`CALCULATION_NEEDS_REVIEW`)

## Access model

- Projects list includes owned **and** shared projects
- Calculations/images accessible via project membership
- Activity feed includes project events **and** linked calculation job events
- Dashboard stats include shared project data

## Frontend

- Project detail **Team** tab — invite, change roles, remove members
- **Alerts** dropdown in header with unread badge
- Shared project badges on projects list
