# Adventure English Backend API

Fastify + TypeScript API for the Adventure English platform.

This service handles:

- auth and token validation
- users (role/status lifecycle)
- courses (catalog + reviews)
- purchase/enrollment tracking (Stripe-ready fields)
- MongoDB persistence

## Stack

- Fastify
- TypeScript
- MongoDB Node driver
- JWT via `@fastify/jwt`

## Data contracts (DTOs)

- Detailed DTO reference: `DTO_REFERENCE.md`
- Mongo object reference: `MONGO_OBJECT_REFERENCE.md`
- Source DTO definitions:
  - `src/dto/courses.dto.ts`
  - `src/dto/users.dto.ts`
  - `src/dto/cohorts.dto.ts`

## Local setup

```bash
cd backend
pnpm install
pnpm migrate
pnpm dev
```

Default local base URL:

`http://localhost:8080`

## Environment variables

Create `.env.local` (or `.env`) with:

```bash
PORT=8080
JWT_SECRET=your_jwt_secret
JWT_EXPIRES_IN=7d
JWT_ISSUER=adventure-english-backend
JWT_AUDIENCE=adventure-english-clients
MONGO_URI=mongodb://... or mongodb+srv://...
CAL_WEBHOOK_SECRET=your_cal_webhook_secret
STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

Additional optional variables currently present:

- `BASE_URL`
- `APP_URL`
- SMTP values (`SMTP_USER`, `SMTP_PASS`, `SMTP_HOST`, etc.)
- Cal.com values (`CAL_API_KEY`, `CAL_API_VERSION`)

## Common response patterns

- Success responses are JSON unless endpoint returns `204`.
- Validation failures typically return `400`.
- Not found returns `404` with `{ "message": "..." }`.
- Server failures return `500` with `{ "message": "...", "error"?: "..." }`.

## Authentication endpoints

### `POST /auth/register`

Registers a new user with default role `student`.

Request:

```json
{
  "email": "jane@example.com",
  "password": "pass1234",
  "firstName": "Jane",
  "lastName": "Doe"
}
```

Response `200`:

```json
{
  "message": "Registered successfully",
  "email": "jane@example.com",
  "firstName": "Jane",
  "lastName": "Doe",
  "token": "jwt_token_here"
}
```

### `POST /auth/login`

Request:

```json
{
  "email": "jane@example.com",
  "password": "pass1234"
}
```

Response `200`:

```json
{
  "email": "jane@example.com",
  "firstName": "Jane",
  "lastName": "Doe",
  "token": "jwt_token_here"
}
```

Response `401` example:

```json
{
  "message": "Username or password is incorrect"
}
```

### `POST /auth/validate`

Header:

`Authorization: Bearer <token>`

Response `200`:

```json
{
  "valid": true,
  "user": {
    "email": "jane@example.com",
    "iat": 1735660000
  }
}
```

## User endpoints

> Role input accepts `teacher` for compatibility but is normalized to `instructor`.
> Learner dashboard routes (`/users/me/*`) require a valid JWT bearer token.

### User object (response shape)

```json
{
  "id": "6810e13643fa9f6b4e12d630",
  "firstName": "Jane",
  "lastName": "Doe",
  "email": "jane@example.com",
  "role": "instructor",
  "status": "active",
  "purchasedCourses": [],
  "enrollments": [],
  "enrolledCourseCount": 0,
  "createdAt": "2026-04-26T10:15:00.000Z",
  "updatedAt": "2026-04-26T10:15:00.000Z"
}
```

### `GET /users`

Response `200`:

```json
{
  "users": [
    {
      "id": "6810e13643fa9f6b4e12d630",
      "firstName": "Jane",
      "lastName": "Doe",
      "email": "jane@example.com",
      "role": "student",
      "status": "invited"
    }
  ]
}
```

### `POST /users`

Request:

```json
{
  "firstName": "Mina",
  "lastName": "Lee",
  "email": "mina@example.com",
  "role": "teacher",
  "status": "active"
}
```

Response `201`: full user object (role normalized to `instructor`).

### `PATCH /users/:userId`

Request:

```json
{
  "role": "admin",
  "status": "active"
}
```

Response `200`: updated user object.

### `DELETE /users/:userId`

Response `204`: no content.

Response `404`:

```json
{
  "message": "User not found"
}
```

### `POST /users/:userId/purchases`

Creates or replaces purchase for the same `courseId`, and syncs enrollments.

Request:

```json
{
  "courseId": "ES-4G9KQ2",
  "purchasedAt": "2026-04-26T10:30:00.000Z",
  "amountPaid": 199,
  "currency": "USD",
  "purchaseSource": "web",
  "paymentProvider": "stripe",
  "stripePaymentIntentId": "pi_3RXYZ...",
  "stripeCheckoutSessionId": "cs_test_...",
  "stripeCustomerId": "cus_...",
  "paymentStatus": "succeeded",
  "accessStatus": "active",
  "progressPercent": 0
}
```

Response `200`: updated user object with `purchasedCourses` and `enrollments`.

### `PATCH /users/:userId/purchases/:courseId`

Updates an existing purchase record.

Request:

```json
{
  "paymentStatus": "processing",
  "accessStatus": "active",
  "lastAccessedAt": "2026-04-26T11:15:00.000Z",
  "progressPercent": 25
}
```

Response `200`: updated user object.

Response `404`:

```json
{
  "message": "User or purchase not found"
}
```

### Learner dashboard endpoints

Implemented for frontend learner dashboard:

- `GET /users/me`
- `PATCH /users/me`
- `GET /users/me/dashboard`
- `GET /users/me/courses`
- `PATCH /users/me/courses/:courseId/progress`
- `GET /users/me/activity`

### Dashboard metrics endpoint

- `GET /dashboard/metrics` (admin/instructor token required)
- Returns:
  - `totalUsers`
  - `activeUsers`
  - `totalCourses`
  - `newEnrollmentsThisMonth`

`GET /users/me/dashboard` currently returns stats + an empty `upcomingBookings` array placeholder (booking source is still handled via frontend Cal routes).

## Course endpoints

### Course identifier behavior

- New courses get generated logical `courseId` (`<initials>-<random>`).
- API lookup supports logical id, slug, and Mongo `_id` for compatibility.
- In-person courses can be configured via `deliveryMode: "in_person"` and session-related metadata.

### `POST /courses`

Request (minimal):

```json
{
  "title": "Exam Speaking",
  "deliveryMode": "in_person",
  "maxEnrollments": 40,
  "recommendedSessionsPerWeek": 2,
  "sessionCount": 8,
  "target": "years 6 - 11",
  "units": []
}
```

Response `201`:

```json
{
  "id": "ES-4G9KQ2",
  "courseId": "ES-4G9KQ2",
  "title": "Exam Speaking",
  "slug": "exam-speaking",
  "reviews": [],
  "reviewSummary": {
    "averageRating": 0,
    "ratingCount": 0,
    "positivePercentage": 0
  },
  "units": [
    {
      "title": "Unit 1",
      "order": 0,
      "videos": [
        {
          "title": "Lesson 1",
          "videoUrl": "https://example.com/video-1",
          "order": 0,
          "isPreviewAvailable": false
        }
      ]
    }
  ],
  "createdAt": "2026-04-26T10:20:00.000Z",
  "updatedAt": "2026-04-26T10:20:00.000Z"
}
```

## Cohort + Session endpoints (in-person)

### `POST /cohorts`

Create a cohort for a course:

```json
{
  "courseId": "ES-4G9KQ2",
  "name": "May 2026 Cohort A",
  "location": "Sydney CBD",
  "timezone": "Australia/Sydney",
  "capacityPerSession": 5,
  "maxEnrollments": 30,
  "recommendedSessionsPerWeek": 2,
  "sessionCount": 8
}
```

### `GET /courses/:courseId/cohorts`

Lists cohorts for a given course.

### `POST /cohorts/:cohortId/sessions`

Creates a scheduled session:

```json
{
  "startsAt": "2026-05-01T08:00:00.000Z",
  "endsAt": "2026-05-01T09:30:00.000Z",
  "capacity": 5,
  "calEventTypeId": 12345
}
```

### `GET /cohorts/:cohortId/sessions`

Lists all sessions in the cohort.

### `POST /courses/:courseId/cohorts/:cohortId/enroll`

Enroll authenticated learner into cohort. Fails when full.

### `POST /users/me/cohorts/:cohortId/sessions/:sessionId/book`

Books a learner into a specific session (capacity-checked).

## Cal.com webhook integration

### `POST /integrations/cal/webhook`

- Validates signature using `x-cal-signature` when `CAL_WEBHOOK_SECRET` is configured.
- Synchronizes booking lifecycle into backend session and attendance mirrors.

### `POST /integrations/stripe/webhook`

- Validates Stripe signatures using `stripe-signature` and `STRIPE_WEBHOOK_SECRET`.
- Handles checkout completion events and persists purchase/enrollment state to the user record.
- Intended as the source of truth for finalized payment state.

### `GET /courses`

Response `200`:

```json
{
  "courses": [
    {
      "id": "ES-4G9KQ2",
      "title": "Exam Speaking",
      "units": [],
      "reviews": [],
      "reviewSummary": {
        "averageRating": 0,
        "ratingCount": 0,
        "positivePercentage": 0
      }
    }
  ]
}
```

### `GET /courses/:courseId`

Response `200`: full course object.

Response `404`:

```json
{
  "message": "Course not found"
}
```

### `DELETE /courses/:courseId`

Response `204`: no content.

### `POST /courses/:courseId/reviews`

If `reviewerName` is omitted, backend resolves it from JWT email/user profile when available, otherwise defaults to `Anonymous learner`.

Request:

```json
{
  "reviewerName": "Alex",
  "rating": 5,
  "comment": "Great pace and examples."
}
```

Response `201`:

```json
{
  "id": "6810e13643fa9f6b4e12d699",
  "reviewerName": "Alex",
  "rating": 5,
  "comment": "Great pace and examples.",
  "createdAt": "2026-04-26T10:40:00.000Z"
}
```

### `GET /courses/:courseId/reviews`

Returns review list and summary for a course.

Response `200`:

```json
{
  "reviews": [
    {
      "id": "6810e13643fa9f6b4e12d699",
      "reviewerName": "Alex",
      "rating": 5,
      "comment": "Great pace and examples.",
      "createdAt": "2026-04-26T10:40:00.000Z"
    }
  ],
  "reviewSummary": {
    "averageRating": 4.8,
    "ratingCount": 23,
    "positivePercentage": 91
  }
}
```

## Quick curl examples

Set base URL:

```bash
BASE_URL="http://localhost:8080"
```

Create user:

```bash
curl -X POST "$BASE_URL/users" \
  -H "Content-Type: application/json" \
  -d '{"firstName":"Mina","lastName":"Lee","email":"mina@example.com","role":"teacher"}'
```

List courses:

```bash
curl "$BASE_URL/courses"
```

Create purchase for user:

```bash
curl -X POST "$BASE_URL/users/<USER_ID>/purchases" \
  -H "Content-Type: application/json" \
  -d '{
    "courseId":"ES-4G9KQ2",
    "purchasedAt":"2026-04-26T10:30:00.000Z",
    "paymentProvider":"stripe",
    "paymentStatus":"succeeded",
    "accessStatus":"active"
  }'
```

## Build and run production

```bash
pnpm build
pnpm start
```

`pnpm start` runs compiled output from `dist/app.js`.

## Migrations

- Run manually:

```bash
pnpm migrate
```

- Migrations also run automatically during app startup.
- Current migrations include:
  - course backfill `level` -> `target`
  - course delivery default backfills
  - core unique/performance index creation

## Notes for production

- Password hashing and transparent plaintext-to-hash login migration are implemented.
- Admin-sensitive mutation endpoints now require valid JWT + role (`admin`/`instructor`).
- Stripe webhook verification endpoint is implemented for purchase persistence.

### Possible future updates (optional)

- Move Cal booking passthrough from frontend API routes into backend:
  - `GET /users/me/bookings`
  - `POST /users/me/bookings/:uid/reschedule`
  - `POST /users/me/bookings/:uid/cancel`
