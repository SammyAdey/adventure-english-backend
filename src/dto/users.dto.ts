// /src/dto/users.dto.ts
export type UserRole = "student" | "instructor" | "admin";
export type LegacyInputRole = UserRole | "teacher";
export type UserStatus = "active" | "invited" | "suspended";
export type StripePaymentStatus = "requires_payment_method" | "requires_action" | "processing" | "succeeded" | "canceled";

export interface PurchasedCourseDTO {
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
	paymentStatus?: StripePaymentStatus;
	progressPercent?: number;
	lastAccessedAt?: Date;
}

export interface EnrollmentDTO {
	courseId: string;
	cohortId?: string;
	enrolledAt: Date;
	entitlementSource?: "purchase" | "gift" | "admin_grant" | "migration";
	status?: "active" | "completed" | "paused" | "revoked";
	progressPercent?: number;
	attendanceSummary?: {
		attended: number;
		left: number;
		total: number;
	};
	recommendedSessionsPerWeek?: number;
	lastAccessedAt?: Date;
	completedAt?: Date;
	accessExpiresAt?: Date;
}

export interface UserDTO {
	id: string;
	firstName: string;
	lastName: string;
	email: string;
	password?: string;
	role?: UserRole;
	languageLevel?: "beginner" | "intermediate" | "advanced";
	country?: string;
	interests?: string[];
	purchasedCourses?: PurchasedCourseDTO[];
	enrollments?: EnrollmentDTO[];
	createdAt?: Date;
	updatedAt?: Date;
	status?: UserStatus;
	enrolledCourseCount?: number;
	lastLoginAt?: Date;
}

// This is the shape of the document stored in MongoDB
export interface MongoUser extends Omit<UserDTO, "id"> {
	_id?: import("mongodb").ObjectId;
}
