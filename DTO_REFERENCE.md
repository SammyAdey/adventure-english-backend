# Backend DTO Reference

This document describes the backend DTOs, what they represent, and where they are used in the codebase.

## Why DTOs exist in this project

DTOs define the contract between:

- route handlers and service functions
- service functions and persisted MongoDB shapes
- backend responses and frontend/dashboard consumers

Primary DTO files:

- `src/dto/courses.dto.ts`
- `src/dto/users.dto.ts`
- `src/dto/cohorts.dto.ts`

---

## Courses DTOs (`src/dto/courses.dto.ts`)

### Purpose

Represents the course catalog domain, including:

- online course structure (units, videos, questions)
- in-person course metadata (`deliveryMode`, capacity/session planning fields)
- reviews and aggregated rating summary

### Core types

- `CourseDeliveryMode`
  - `"online" | "in_person"`
  - Used to distinguish video-based vs fixed-session in-person courses.

- `CourseVideoDTO`
  - One lesson video inside a unit.
  - Used by `CourseUnitDTO.videos`.

- `CourseQuestionDTO`
  - Optional assessment item attached to a unit.

- `CourseUnitDTO`
  - A logical learning block containing videos and optional questions.

- `CourseMetaDTO`
  - Display metadata for learner UI (badge, counts, duration, included items).

- `CoursePricingDTO`
  - Price and currency details used by course purchase/checkout flows.

- `CourseReviewInputDTO`
  - Input payload for creating reviews.

- `CourseReviewDTO`
  - Persisted + returned review shape (`id`, `createdAt` included).

- `CourseReviewSummaryDTO`
  - Aggregate rating model (`averageRating`, `ratingCount`, `positivePercentage`).

- `CourseInputDTO`
  - Input shape for create/update-style operations.
  - Includes business fields like `target`, `deliveryMode`, `maxEnrollments`, `sessionCount`.

- `CourseDTO`
  - Response shape returned to clients.
  - Extends `CourseInputDTO` with required identity/time/review summary fields.

- `MongoCourseReview`, `MongoCourse`
  - Internal Mongo persistence shapes (`_id` support, ObjectId-ready).

### Used by

- Routes: `src/routes/course.route.ts`
- Services: `src/services/course.service.ts`
- Persistence models: `src/models/course.model.ts`

### Typical flow

1. Route validates request body -> `CourseInputDTO`
2. Service normalizes payload (slug, defaults, generated courseId)
3. Stored as `MongoCourse`
4. Returned to client as `CourseDTO`

---

## Users DTOs (`src/dto/users.dto.ts`)

### Purpose

Represents users plus commerce/enrollment state that supports:

- auth identity + role/status
- purchase tracking (Stripe metadata)
- enrollment and progress
- learner dashboard summaries

### Core types

- `UserRole`
  - `"student" | "instructor" | "admin"`

- `LegacyInputRole`
  - `UserRole | "teacher"`
  - Backward-compatible input alias; normalized to `instructor` in service layer.

- `UserStatus`
  - `"active" | "invited" | "suspended"`

- `StripePaymentStatus`
  - Stripe-oriented lifecycle enum for payment tracking.

- `PurchasedCourseDTO`
  - Purchase-level record keyed by `courseId`.
  - Includes amount/currency, source, access status, Stripe references, payment status, progress markers.

- `EnrollmentDTO`
  - Enrollment-level record keyed by `courseId`, optionally linked to `cohortId`.
  - Includes status, progress, attendance summary, recommended cadence, completion/expiry timestamps.

- `UserDTO`
  - Main user response shape.
  - Includes profile, role/status, purchases, enrollments, and aggregate counters.

- `MongoUser`
  - Internal persistence shape with optional ObjectId `_id`.

### Used by

- Routes: `src/routes/user.route.ts`, `src/routes/auth.route.ts`
- Services: `src/services/user.service.ts`
- Persistence models: `src/models/user.model.ts`

### Typical flow

1. Route receives create/update/purchase payload
2. Service normalizes role/status and maps identifiers
3. Purchase updates can upsert enrollments
4. Client receives normalized `UserDTO`

---

## Cohorts / Sessions / Attendance DTOs (`src/dto/cohorts.dto.ts`)

### Purpose

Represents in-person course scheduling and attendance:

- course cohorts
- bookable sessions
- learner attendance per session

### Core types

- `CohortStatus`
  - `"draft" | "open" | "full" | "completed" | "cancelled"`

- `SessionStatus`
  - `"scheduled" | "booked" | "completed" | "cancelled"`

- `AttendanceStatus`
  - `"booked" | "attended" | "missed" | "canceled"`

- `CohortDTO`
  - Cohort response model (capacity, enrollment count, pacing recommendations, status).

- `SessionDTO`
  - Session response model (time window, capacity/booked counts, optional Cal.com references).

- `AttendanceDTO`
  - Learner attendance record across course/cohort/session identifiers.

- `CohortCreateInputDTO`
  - Input payload for creating cohorts.

- `SessionCreateInputDTO`
  - Input payload for creating sessions in a cohort.

- `CohortBookingInputDTO`
  - Booking request context model for learner->session booking operations.

- `MongoCohort`, `MongoSession`, `MongoAttendance`
  - Internal Mongo persistence shapes with optional ObjectId `_id`.

### Used by

- Routes: `src/routes/cohort.route.ts`, `src/routes/integrations.cal.route.ts`
- Services: `src/services/cohort.service.ts`
- Persistence models:
  - `src/models/cohort.model.ts`
  - `src/models/session.model.ts`
  - `src/models/attendance.model.ts`

### Typical flow

1. Admin creates cohort (`CohortCreateInputDTO`)
2. Admin adds sessions (`SessionCreateInputDTO`)
3. Learner enrolls + books session (`CohortBookingInputDTO` context)
4. Attendance/session status is synchronized and returned as DTO responses

---

## DTO design conventions in this codebase

- DTO interfaces represent API contracts; Mongo variants represent stored document shape.
- `*InputDTO` types are request-oriented and may contain optional fields.
- Response DTOs include normalized IDs/timestamps and computed data where needed.
- Route-level JSON schemas enforce runtime validation; DTOs provide TypeScript compile-time safety.

---

## Quick mapping table

| Domain | Input DTOs | Response DTOs | Mongo DTOs |
| --- | --- | --- | --- |
| Courses | `CourseInputDTO`, `CourseReviewInputDTO` | `CourseDTO`, `CourseReviewDTO`, `CourseReviewSummaryDTO` | `MongoCourse`, `MongoCourseReview` |
| Users | (via route payloads + service normalization) `LegacyInputRole` related fields | `UserDTO`, `PurchasedCourseDTO`, `EnrollmentDTO` | `MongoUser` |
| In-person scheduling | `CohortCreateInputDTO`, `SessionCreateInputDTO`, `CohortBookingInputDTO` | `CohortDTO`, `SessionDTO`, `AttendanceDTO` | `MongoCohort`, `MongoSession`, `MongoAttendance` |

---

## Maintenance notes

- If you add new API fields, update:
  1. DTO interface
  2. route schema validation
  3. service normalization + mapping
  4. README and this DTO reference
- For backward-incompatible changes, add migration notes and maintain temporary mapping fallbacks where needed.
