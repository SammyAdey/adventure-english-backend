import { randomInt } from "crypto";
import { ObjectId } from "mongodb";
import {
	CohortCreateInputDTO,
	CohortDTO,
	MongoCohort,
	MongoSession,
	SessionCreateInputDTO,
	SessionDTO,
} from "../dto/cohorts.dto";
import { MongoCourse } from "../dto/courses.dto";
import { MongoUser } from "../dto/users.dto";
import { getAttendanceCollection, initAttendanceCollection } from "../models/attendance.model";
import { getCohortCollection, initCohortCollection } from "../models/cohort.model";
import { getSessionCollection, initSessionCollection } from "../models/session.model";
import { getUserCollection, initUserCollection } from "../models/user.model";
import { connectToDatabase } from "../utils/mongo";

const ALPHANUMERIC_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const generateIdSuffix = (length: number): string =>
	Array.from({ length }, () => ALPHANUMERIC_CHARS[randomInt(0, ALPHANUMERIC_CHARS.length)]).join("");

const buildCohortId = () => `COH-${generateIdSuffix(8)}`;
const buildSessionId = () => `SES-${generateIdSuffix(8)}`;
const buildAttendanceId = () => `ATT-${generateIdSuffix(10)}`;

const mapCohort = (cohort: MongoCohort & { _id: ObjectId }): CohortDTO => ({
	id: cohort._id.toHexString(),
	cohortId: cohort.cohortId,
	courseId: cohort.courseId,
	name: cohort.name,
	location: cohort.location,
	timezone: cohort.timezone,
	capacityPerSession: cohort.capacityPerSession,
	maxEnrollments: cohort.maxEnrollments,
	enrollmentCount: cohort.enrollmentCount,
	recommendedSessionsPerWeek: cohort.recommendedSessionsPerWeek,
	sessionCount: cohort.sessionCount,
	status: cohort.status,
	createdAt: cohort.createdAt,
	updatedAt: cohort.updatedAt,
});

const mapSession = (session: MongoSession & { _id: ObjectId }): SessionDTO => ({
	id: session._id.toHexString(),
	sessionId: session.sessionId,
	cohortId: session.cohortId,
	startsAt: session.startsAt,
	endsAt: session.endsAt,
	capacity: session.capacity,
	bookedCount: session.bookedCount,
	status: session.status,
	calEventTypeId: session.calEventTypeId,
	calBookingUid: session.calBookingUid,
	createdAt: session.createdAt,
	updatedAt: session.updatedAt,
});

const findCourseByIdentifier = async (courseId: string): Promise<(MongoCourse & { _id: ObjectId }) | null> => {
	const db = await connectToDatabase();
	const courses = db.collection<MongoCourse>("courses");
	const normalized = courseId.trim().toLowerCase();
	const isObjectId = ObjectId.isValid(courseId);
	const course = await courses.findOne(
		isObjectId
			? { _id: new ObjectId(courseId) }
			: {
					$or: [{ courseId }, { courseId: courseId.toUpperCase() }, { slug: normalized }],
				},
	);
	if (!course || !course._id) return null;
	return course as MongoCourse & { _id: ObjectId };
};

export const createCohort = async (payload: CohortCreateInputDTO): Promise<CohortDTO | null> => {
	const db = await connectToDatabase();
	initCohortCollection(db);
	const cohortCollection = getCohortCollection();

	const course = await findCourseByIdentifier(payload.courseId);
	if (!course) return null;

	const now = new Date();
	const document: MongoCohort = {
		cohortId: buildCohortId(),
		courseId: course.courseId ?? course._id.toHexString(),
		name: payload.name,
		location: payload.location,
		timezone: payload.timezone,
		capacityPerSession: payload.capacityPerSession ?? 5,
		maxEnrollments: payload.maxEnrollments,
		enrollmentCount: 0,
		recommendedSessionsPerWeek: payload.recommendedSessionsPerWeek,
		sessionCount: payload.sessionCount,
		status: payload.status ?? "open",
		createdAt: now,
		updatedAt: now,
	};

	const result = await cohortCollection.insertOne(document);
	return mapCohort({ ...document, _id: result.insertedId });
};

export const listCohortsByCourse = async (courseId: string): Promise<CohortDTO[]> => {
	const db = await connectToDatabase();
	initCohortCollection(db);
	const cohortCollection = getCohortCollection();

	const course = await findCourseByIdentifier(courseId);
	if (!course) return [];
	const resolvedCourseId = course.courseId ?? course._id.toHexString();
	const cohorts = await cohortCollection.find({ courseId: resolvedCourseId }).sort({ createdAt: 1 }).toArray();
	return cohorts.filter((c): c is MongoCohort & { _id: ObjectId } => Boolean(c._id)).map(mapCohort);
};

export const createSession = async (payload: SessionCreateInputDTO): Promise<SessionDTO | null> => {
	const db = await connectToDatabase();
	initCohortCollection(db);
	initSessionCollection(db);
	const cohortCollection = getCohortCollection();
	const sessionCollection = getSessionCollection();

	const cohort = await cohortCollection.findOne({ cohortId: payload.cohortId });
	if (!cohort || !cohort._id) return null;

	const now = new Date();
	const document: MongoSession = {
		sessionId: buildSessionId(),
		cohortId: payload.cohortId,
		startsAt: payload.startsAt,
		endsAt: payload.endsAt,
		capacity: payload.capacity ?? cohort.capacityPerSession,
		bookedCount: 0,
		status: payload.status ?? "scheduled",
		calEventTypeId: payload.calEventTypeId,
		createdAt: now,
		updatedAt: now,
	};

	const result = await sessionCollection.insertOne(document);
	return mapSession({ ...document, _id: result.insertedId });
};

export const listSessionsByCohort = async (cohortId: string): Promise<SessionDTO[]> => {
	const db = await connectToDatabase();
	initSessionCollection(db);
	const sessionCollection = getSessionCollection();
	const sessions = await sessionCollection.find({ cohortId }).sort({ startsAt: 1 }).toArray();
	return sessions.filter((s): s is MongoSession & { _id: ObjectId } => Boolean(s._id)).map(mapSession);
};

export const enrollUserInCohort = async (courseId: string, cohortId: string, userEmail: string): Promise<boolean> => {
	const db = await connectToDatabase();
	initCohortCollection(db);
	initUserCollection(db);
	initAttendanceCollection(db);
	const cohortCollection = getCohortCollection();
	const usersCollection = getUserCollection();
	const attendanceCollection = getAttendanceCollection();

	const course = await findCourseByIdentifier(courseId);
	if (!course) return false;
	const resolvedCourseId = course.courseId ?? course._id.toHexString();

	const cohort = await cohortCollection.findOne({ cohortId, courseId: resolvedCourseId });
	if (!cohort || !cohort._id) return false;

	const user = await usersCollection.findOne({ email: userEmail });
	if (!user || !user._id) return false;
	const hasEntitlement = (user.purchasedCourses ?? []).some(
		(purchase) =>
			purchase.courseId === resolvedCourseId &&
			(purchase.accessStatus ?? "active") === "active" &&
			(purchase.paymentStatus === "succeeded" || purchase.paymentStatus === undefined),
	);
	if (!hasEntitlement) return false;

	const alreadyEnrolled = (user.enrollments ?? []).some((enrollment) => enrollment.cohortId === cohortId);
	if (alreadyEnrolled) return true;

	const enrollment = {
		courseId: resolvedCourseId,
		cohortId,
		enrolledAt: new Date(),
		entitlementSource: "purchase" as const,
		status: "active" as const,
		progressPercent: 0,
		attendanceSummary: {
			attended: 0,
			left: cohort.sessionCount,
			total: cohort.sessionCount,
		},
		recommendedSessionsPerWeek: cohort.recommendedSessionsPerWeek,
	};

	const reserveSeatResult = await cohortCollection.updateOne(
		{
			_id: cohort._id,
			enrollmentCount: { $lt: cohort.maxEnrollments },
		},
		{
			$inc: { enrollmentCount: 1 },
			$set: {
				updatedAt: new Date(),
				status: cohort.enrollmentCount + 1 >= cohort.maxEnrollments ? "full" : cohort.status,
			},
		},
	);
	if (reserveSeatResult.modifiedCount !== 1) {
		return false;
	}

	const userEnrollmentUpdate = await usersCollection.updateOne(
		{ _id: user._id },
		{
			$set: { updatedAt: new Date() },
			$push: { enrollments: enrollment },
			$inc: { enrolledCourseCount: 1 },
		},
	);
	if (userEnrollmentUpdate.modifiedCount !== 1) {
		await cohortCollection.updateOne(
			{ _id: cohort._id, enrollmentCount: { $gt: 0 } },
			{
				$inc: { enrollmentCount: -1 },
				$set: { updatedAt: new Date(), status: "open" },
			},
		);
		return false;
	}

	if ((course.maxEnrollments ?? 0) > 0) {
		const cohortAgg = await cohortCollection
			.aggregate<{ total: number }>([
				{ $match: { courseId: resolvedCourseId } },
				{ $group: { _id: null, total: { $sum: "$enrollmentCount" } } },
			])
			.toArray();
		const totalEnrolled = cohortAgg[0]?.total ?? 0;
		await db.collection<MongoCourse>("courses").updateOne(
			{ _id: course._id },
			{
				$set: {
					isSoldOut: totalEnrolled >= (course.maxEnrollments ?? 0),
					updatedAt: new Date(),
				},
			},
		);
	}

	const sessions = await db.collection<MongoSession>("sessions").find({ cohortId }).toArray();
	if (sessions.length > 0) {
		await attendanceCollection.bulkWrite(
			sessions
				.filter((session) => session.sessionId)
				.map((session) => ({
					updateOne: {
						filter: {
							userId: user._id!.toHexString(),
							sessionId: session.sessionId,
						},
						update: {
							$set: {
								status: "booked" as const,
								updatedAt: new Date(),
								courseId: resolvedCourseId,
								cohortId,
							},
							$setOnInsert: {
								attendanceId: buildAttendanceId(),
								createdAt: new Date(),
							},
						},
						upsert: true,
					},
				})),
		);
	}

	return true;
};

export const bookSessionForUser = async (
	userEmail: string,
	cohortId: string,
	sessionId: string,
): Promise<boolean> => {
	const db = await connectToDatabase();
	initSessionCollection(db);
	initAttendanceCollection(db);
	initUserCollection(db);

	const sessionCollection = getSessionCollection();
	const attendanceCollection = getAttendanceCollection();
	const usersCollection = getUserCollection();

	const user = await usersCollection.findOne({ email: userEmail });
	if (!user || !user._id) return false;

	const enrollment = (user.enrollments ?? []).find((entry) => entry.cohortId === cohortId);
	if (!enrollment) return false;

	const session = await sessionCollection.findOne({ cohortId, sessionId });
	if (!session || !session._id) return false;
	const attendanceQuery = { userId: user._id.toHexString(), cohortId, sessionId };
	const existingAttendance = await attendanceCollection.findOne(attendanceQuery);
	if (existingAttendance?.status === "booked" || existingAttendance?.status === "attended") {
		return true;
	}

	const reserveResult = await sessionCollection.updateOne(
		{
			_id: session._id,
			bookedCount: { $lt: session.capacity },
		},
		{
			$inc: { bookedCount: 1 },
			$set: {
				status: session.bookedCount + 1 >= session.capacity ? "booked" : session.status,
				updatedAt: new Date(),
			},
		},
	);
	if (reserveResult.modifiedCount !== 1) {
		return false;
	}

	try {
		await attendanceCollection.updateOne(
			attendanceQuery,
			{
				$set: {
					status: "booked",
					updatedAt: new Date(),
				},
				$setOnInsert: {
					attendanceId: buildAttendanceId(),
					courseId: enrollment.courseId,
					createdAt: new Date(),
				},
			},
			{ upsert: true },
		);
	} catch (error) {
		await sessionCollection.updateOne(
			{ _id: session._id, bookedCount: { $gt: 0 } },
			{
				$inc: { bookedCount: -1 },
				$set: { updatedAt: new Date() },
			},
		);
		throw error;
	}

	return true;
};

type CalWebhookEvent = {
	type?: string;
	triggerEvent?: string;
	data?: Record<string, unknown>;
	payload?: Record<string, unknown>;
};

const normalizeCalEventType = (event: CalWebhookEvent): string => {
	return String(event.type ?? event.triggerEvent ?? "").toLowerCase();
};

const extractCalPayload = (event: CalWebhookEvent): Record<string, unknown> => {
	return (event.payload ?? event.data ?? {}) as Record<string, unknown>;
};

export const syncCalWebhookEvent = async (event: CalWebhookEvent): Promise<void> => {
	const db = await connectToDatabase();
	initSessionCollection(db);
	initAttendanceCollection(db);
	initUserCollection(db);

	const sessionCollection = getSessionCollection();
	const attendanceCollection = getAttendanceCollection();
	const usersCollection = getUserCollection();
	const cohortCollection = db.collection<MongoCohort>("cohorts");

	const eventType = normalizeCalEventType(event);
	const payload = extractCalPayload(event);
	if (!eventType) return;

	const bookingUid = String(payload.uid ?? payload.bookingUid ?? "");
	const attendeeEmail = String(payload.attendeeEmail ?? payload.email ?? "");
	const sessionId = String(payload.sessionId ?? "");
	const status = String(payload.status ?? "").toLowerCase();
	const startsAt = payload.startTime ? new Date(String(payload.startTime)) : undefined;
	const endsAt = payload.endTime ? new Date(String(payload.endTime)) : undefined;

	let session: MongoSession | null = null;
	if (sessionId) {
		session = await sessionCollection.findOne({ sessionId });
	}
	if (!session && bookingUid) {
		session = await sessionCollection.findOne({ calBookingUid: bookingUid });
	}
	if (!session && startsAt && endsAt) {
		session = await sessionCollection.findOne({ startsAt, endsAt });
	}
	if (!session || !session._id || !session.sessionId) return;

	const user = attendeeEmail ? await usersCollection.findOne({ email: attendeeEmail }) : null;
	const cohort = await cohortCollection.findOne({ cohortId: session.cohortId });
	if (!cohort) return;
	const now = new Date();
	const isCancelled = eventType.includes("cancel") || status === "cancelled";
	const isCreated = eventType.includes("create") || eventType.includes("book");
	const isRescheduled = eventType.includes("resched");

	if (isCreated || isRescheduled) {
		const shouldIncrementBookedCount =
			Boolean(bookingUid) && session.calBookingUid !== bookingUid && isCreated;
		const sessionUpdate: {
			$set: { calBookingUid?: string; status: "booked"; updatedAt: Date };
			$inc?: { bookedCount: number };
		} = {
			$set: {
				calBookingUid: bookingUid || session.calBookingUid,
				status: "booked",
				updatedAt: now,
			},
		};
		if (shouldIncrementBookedCount) {
			sessionUpdate.$inc = { bookedCount: 1 };
		}

		await sessionCollection.updateOne(
			{ _id: session._id },
			sessionUpdate,
		);

		if (user?._id) {
			await attendanceCollection.updateOne(
				{ userId: user._id.toHexString(), sessionId: session.sessionId },
				{
					$set: {
						status: "booked",
						updatedAt: now,
					},
					$setOnInsert: {
						attendanceId: buildAttendanceId(),
						userId: user._id.toHexString(),
						courseId: cohort.courseId,
						cohortId: session.cohortId,
						sessionId: session.sessionId,
						createdAt: now,
					},
				},
				{ upsert: true },
			);
		}
		return;
	}

	if (isCancelled) {
		const attendeeFilter = user?._id
			? { userId: user._id.toHexString(), sessionId: session.sessionId }
			: { sessionId: session.sessionId, cohortId: session.cohortId };
		const relevantAttendance = await attendanceCollection.findOne(attendeeFilter);
		const canDecrement =
			(session.calBookingUid && bookingUid && session.calBookingUid === bookingUid) ||
			relevantAttendance?.status === "booked" ||
			relevantAttendance?.status === "attended";

		await sessionCollection.updateOne(
			{ _id: session._id },
			{
				$set: { status: "cancelled", updatedAt: now },
				...(canDecrement ? { $inc: { bookedCount: -1 } } : {}),
			},
		);
		const updatedSession = await sessionCollection.findOne({ _id: session._id });
		if (updatedSession && updatedSession.bookedCount < 0) {
			await sessionCollection.updateOne(
				{ _id: session._id },
				{ $set: { bookedCount: 0, updatedAt: new Date() } },
			);
		}
		if (user?._id) {
			await attendanceCollection.updateOne(
				{ userId: user._id.toHexString(), sessionId: session.sessionId },
				{
					$set: {
						status: "canceled",
						updatedAt: now,
					},
				},
			);
		}
	}
};
