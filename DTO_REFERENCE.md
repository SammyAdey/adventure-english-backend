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

- `InstructionalLanguage`
  - `"en" | "zh"` (`zh` = Mandarin instructional track for titles and video assets).

- `LocalizedTitlesDTO` / `LocalizedVideoUrlsDTO`
  - Fixed-key objects `{ en: string; zh?: string }` for localized strings under Fastify JSON Schema.

- `CourseVideoDTO`
  - One lesson video inside a unit.
  - Optional `titles` and `videoUrls` for per-language lesson title and video URL; legacy `title` / `videoUrl` remain the canonical English fields and are kept in sync on write.

- `CourseQuestionDTO`
  - Optional assessment item attached to a unit.

- `CourseUnitDTO`
  - A logical learning block containing videos and optional questions.
  - Optional `titles` for localized unit titles.

- `CourseMetaDTO`
  - Display metadata for learner UI (badge, counts, duration, `includes`, audio/subtitle language lists).
  - `features?: string[]` — short marketing bullets for public catalog cards (not the same as `includes`, which is used for purchase/perk copy on course detail).

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
  - Includes `instructionalLanguages`, `isRecommended`, business fields like `target`, `deliveryMode`, `maxEnrollments`, `sessionCount`, nested `meta` / `pricing` / `units`.

- `CourseDTO`
  - Response shape returned to clients.
  - Extends `CourseInputDTO` with required identity/time/review summary fields.
  - `instructionalLanguages` is always normalized for API consumers (default `["en"]` when absent in storage).

- `MongoCourseReview`, `MongoCourse`
  - Internal Mongo persistence shapes (`_id` support, ObjectId-ready).

### Used by

- Routes: `src/routes/course.route.ts`
- Services: `src/services/course.service.ts`
- Persistence models: `src/models/course.model.ts`

### Typical flow

1. Route validates request body -> `CourseInputDTO`
2. Service normalizes payload (slug, defaults, generated `courseId`, instructional language list, localized unit/video titles and URLs, `isRecommended` default)
3. Business rules: if `zh` is in `instructionalLanguages`, every unit and video must have Mandarin titles and every video must have a Mandarin URL — otherwise a validation error is thrown (**400**)
4. Stored as `MongoCourse`
5. Returned to client as `CourseDTO` with derived `titles` / `videoUrls` objects on read when legacy docs omit them

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
