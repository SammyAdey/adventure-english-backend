# Mongo Object Reference

This document describes the MongoDB document shapes used by the backend, organized by collection.

## Scope

- Database collections currently used by backend models
- Stored document shape (Mongo object) per collection
- Relationship notes between collections
- Recommended indexes for production hardening

Source model files:

- `src/models/user.model.ts` -> `users`
- `src/models/course.model.ts` -> `courses`
- `src/models/cohort.model.ts` -> `cohorts`
- `src/models/session.model.ts` -> `sessions`
- `src/models/attendance.model.ts` -> `attendance`

---

## `users` collection

Model type: `MongoUser` (`src/dto/users.dto.ts`)

### Stored object (shape)

```ts
{
  _id?: ObjectId;
  firstName: string;
  lastName: string;
  email: string;
  password?: string;
  role?: "student" | "instructor" | "admin";
  languageLevel?: "beginner" | "intermediate" | "advanced";
  country?: string;
  interests?: string[];
  status?: "active" | "invited" | "suspended";
  enrolledCourseCount?: number;
  lastLoginAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
  purchasedCourses?: Array<{
    courseId: string;
    purchasedAt: Date;
    amountPaid?: number;
    currency?: string;
    purchaseSource?: "web" | "dashboard" | "admin" | "migration";
    accessStatus?: "active" | "refunded" | "revoked";
    paymentProvider?: "stripe";
    stripePaymentIntentId?: string;
    stripeCheckoutSessionId?: string;
    stripeCustomerId?: string;
    stripeChargeId?: string;
    stripeInvoiceId?: string;
    paymentStatus?: "requires_payment_method" | "requires_action" | "processing" | "succeeded" | "canceled";
    progressPercent?: number;
    lastAccessedAt?: Date;
  }>;
  enrollments?: Array<{
    courseId: string;
    cohortId?: string;
    enrolledAt: Date;
    entitlementSource?: "purchase" | "gift" | "admin_grant" | "migration";
    status?: "active" | "completed" | "paused" | "revoked";
    progressPercent?: number;
    attendanceSummary?: { attended: number; left: number; total: number };
    recommendedSessionsPerWeek?: number;
    lastAccessedAt?: Date;
    completedAt?: Date;
    accessExpiresAt?: Date;
  }>;
}
```

### Notes

- Purchases and enrollments are embedded arrays in the user document.
- `enrolledCourseCount` is treated as a denormalized summary field.

---

## `courses` collection

Model type: `MongoCourse` (`src/dto/courses.dto.ts`)

### Stored object (shape)

```ts
{
  _id?: ObjectId;
  courseId?: string; // logical identifier, e.g. ES-4G9KQ2
  title: string;
  slug?: string;
  summary?: string;
  deliveryMode?: "online" | "in_person";
  isSoldOut?: boolean;
  maxEnrollments?: number;
  recommendedSessionsPerWeek?: number;
  sessionCount?: number;
  target?: string;
  category?: string;
  tags?: string[];
  thumbnailUrl?: string;
  units?: Array<{
    title: string;
    description?: string;
    order?: number;
    videos: Array<{
      title: string;
      description?: string;
      videoUrl: string;
      order?: number;
      durationInSeconds?: number;
      isPreviewAvailable?: boolean;
    }>;
    questions?: Array<{
      prompt: string;
      type?: "multiple-choice" | "short-answer" | "true-false";
      options?: string[];
      answer?: string;
      explanation?: string;
    }>;
  }>;
  meta?: {
    badge?: string;
    studentCount?: number;
    audioLanguages?: string[];
    subtitleLanguages?: string[];
    lessonsCount?: number;
    downloadsCount?: number;
    exercisesCount?: number;
    durationInMinutes?: number;
    includes?: string[];
  };
  pricing?: {
    currency: string;
    price: number;
    originalPrice?: number;
    message?: string;
    giftAvailable?: boolean;
  };
  reviews?: Array<{
    _id?: ObjectId;
    reviewerName: string;
    rating: number;
    comment: string;
    headline?: string;
    avatarUrl?: string;
    createdAt: Date;
  }>;
  reviewSummary: {
    averageRating: number;
    ratingCount: number;
    positivePercentage: number;
  };
  createdAt: Date;
  updatedAt: Date;
}
```

### Notes

- Reviews are embedded in the course document.
- `courseId` is the stable logical identifier used by clients.
- Current service layer still includes legacy compatibility for historical `level` values when mapping out.

---

## `cohorts` collection

Model type: `MongoCohort` (`src/dto/cohorts.dto.ts`)

### Stored object (shape)

```ts
{
  _id?: ObjectId;
  cohortId: string;
  courseId: string;
  name: string;
  location: string;
  timezone: string;
  capacityPerSession: number;
  maxEnrollments: number;
  enrollmentCount: number;
  recommendedSessionsPerWeek: number;
  sessionCount: number;
  status: "draft" | "open" | "full" | "completed" | "cancelled";
  createdAt: Date;
  updatedAt: Date;
}
```

### Notes

- One cohort belongs to one course via `courseId`.
- `enrollmentCount` is a mutable summary field.

---

## `sessions` collection

Model type: `MongoSession` (`src/dto/cohorts.dto.ts`)

### Stored object (shape)

```ts
{
  _id?: ObjectId;
  sessionId: string;
  cohortId: string;
  startsAt: Date;
  endsAt: Date;
  capacity: number;
  bookedCount: number;
  status: "scheduled" | "booked" | "completed" | "cancelled";
  calEventTypeId?: number;
  calBookingUid?: string;
  createdAt: Date;
  updatedAt: Date;
}
```

### Notes

- One session belongs to one cohort via `cohortId`.
- `bookedCount` is a mutable summary field.
- `calBookingUid` links mirrored state from Cal.com webhook events.

---

## `attendance` collection

Model type: `MongoAttendance` (`src/dto/cohorts.dto.ts`)

### Stored object (shape)

```ts
{
  _id?: ObjectId;
  attendanceId: string;
  userId: string;
  courseId: string;
  cohortId: string;
  sessionId: string;
  status: "booked" | "attended" | "missed" | "canceled";
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}
```

### Notes

- Bridges learner to course/cohort/session.
- Supports attendance lifecycle and reporting.

---

## Relationship overview

- `courses.courseId` -> parent for `cohorts.courseId`
- `cohorts.cohortId` -> parent for `sessions.cohortId`
- `sessions.sessionId` + `cohorts.cohortId` + `courses.courseId` + user identifier -> attendance records
- `users` stores embedded enrollment/purchase snapshots keyed by `courseId` (and optionally `cohortId`)

---

## Recommended indexes (not all guaranteed to exist yet)

These are recommended for correctness and performance:

- `users`
  - unique: `email`
  - optional multikey: `purchasedCourses.courseId`
  - optional multikey: `enrollments.courseId`, `enrollments.cohortId`
- `courses`
  - unique: `courseId`
  - unique: `slug`
  - optional: `deliveryMode`, `target`, `createdAt`
- `cohorts`
  - unique: `cohortId`
  - index: `courseId`, `status`
- `sessions`
  - unique: `sessionId`
  - index: `cohortId`, `startsAt`
  - optional unique sparse: `calBookingUid`
- `attendance`
  - unique compound: `userId + sessionId`
  - index: `courseId`, `cohortId`, `status`

---

## Maintenance checklist

When Mongo object shape changes:

1. Update the source DTO (`Mongo*` interface)
2. Update service normalization/mapping logic
3. Update route schema where request/response contracts changed
4. Update this file and `DTO_REFERENCE.md`
5. Add migration notes/script if change is not backward compatible
