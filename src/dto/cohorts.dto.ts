export type CohortStatus = "draft" | "open" | "full" | "completed" | "cancelled";
export type SessionStatus = "scheduled" | "booked" | "completed" | "cancelled";
export type AttendanceStatus = "booked" | "attended" | "missed" | "canceled";

export interface CohortDTO {
	id: string;
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
	status: CohortStatus;
	createdAt: Date;
	updatedAt: Date;
}

export interface SessionDTO {
	id: string;
	sessionId: string;
	cohortId: string;
	startsAt: Date;
	endsAt: Date;
	capacity: number;
	bookedCount: number;
	status: SessionStatus;
	calEventTypeId?: number;
	calBookingUid?: string;
	createdAt: Date;
	updatedAt: Date;
}

export interface AttendanceDTO {
	id: string;
	attendanceId: string;
	userId: string;
	courseId: string;
	cohortId: string;
	sessionId: string;
	status: AttendanceStatus;
	notes?: string;
	createdAt: Date;
	updatedAt: Date;
}

export interface CohortCreateInputDTO {
	courseId: string;
	name: string;
	location: string;
	timezone: string;
	capacityPerSession?: number;
	maxEnrollments: number;
	recommendedSessionsPerWeek: number;
	sessionCount: number;
	status?: CohortStatus;
}

export interface SessionCreateInputDTO {
	cohortId: string;
	startsAt: Date;
	endsAt: Date;
	capacity?: number;
	calEventTypeId?: number;
	status?: SessionStatus;
}

export interface CohortBookingInputDTO {
	cohortId: string;
	sessionId: string;
	userId: string;
	userEmail: string;
}

export interface MongoCohort extends Omit<CohortDTO, "id"> {
	_id?: import("mongodb").ObjectId;
}

export interface MongoSession extends Omit<SessionDTO, "id"> {
	_id?: import("mongodb").ObjectId;
}

export interface MongoAttendance extends Omit<AttendanceDTO, "id"> {
	_id?: import("mongodb").ObjectId;
}
