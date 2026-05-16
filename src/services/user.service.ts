import { ObjectId } from "mongodb";
import { connectToDatabase } from "../utils/mongo";
import { getUserCollection, initUserCollection } from "../models/user.model";
import type { EnrollmentDTO, LegacyInputRole, MongoUser, PurchasedCourseDTO, UserDTO, UserRole, UserStatus } from "../dto/users.dto";

const purchaseRowKey = (p: Pick<PurchasedCourseDTO, "courseId" | "cohortId">): string =>
	`${p.courseId}::${p.cohortId ?? ""}`;

type CreateUserInput = {
	firstName: string;
	lastName: string;
	email: string;
	role?: LegacyInputRole;
	status?: UserStatus;
	purchasedCourses?: PurchasedCourseDTO[];
	enrollments?: EnrollmentDTO[];
};

type UpdateUserInput = {
	role?: LegacyInputRole;
	status?: UserStatus;
	purchasedCourses?: PurchasedCourseDTO[];
	enrollments?: EnrollmentDTO[];
	firstName?: string;
	lastName?: string;
	country?: string;
	languageLevel?: "beginner" | "intermediate" | "advanced";
	interests?: string[];
};

export const normalizeRole = (role?: LegacyInputRole): UserRole => {
	if (!role) {
		return "student";
	}

	if (role === "teacher") {
		return "instructor";
	}

	return role;
};

const normalizeUpdate = (payload: UpdateUserInput) => {
	const normalized: {
		role?: UserRole;
		status?: UserStatus;
		purchasedCourses?: PurchasedCourseDTO[];
		enrollments?: EnrollmentDTO[];
	} = {};
	if (payload.role !== undefined) {
		normalized.role = normalizeRole(payload.role);
	}
	if (payload.status !== undefined) {
		normalized.status = payload.status;
	}
	if (payload.purchasedCourses !== undefined) {
		normalized.purchasedCourses = payload.purchasedCourses;
	}
	if (payload.enrollments !== undefined) {
		normalized.enrollments = payload.enrollments;
	}
	if (payload.firstName !== undefined) {
		(normalized as UpdateUserInput).firstName = payload.firstName;
	}
	if (payload.lastName !== undefined) {
		(normalized as UpdateUserInput).lastName = payload.lastName;
	}
	if (payload.country !== undefined) {
		(normalized as UpdateUserInput).country = payload.country;
	}
	if (payload.languageLevel !== undefined) {
		(normalized as UpdateUserInput).languageLevel = payload.languageLevel;
	}
	if (payload.interests !== undefined) {
		(normalized as UpdateUserInput).interests = payload.interests;
	}
	return normalized;
};

const entitlementSourceFromPurchase = (purchase: PurchasedCourseDTO): EnrollmentDTO["entitlementSource"] => {
	const src = purchase.purchaseSource;
	if (src === "admin" || src === "dashboard") return "admin_grant";
	if (src === "migration") return "migration";
	return "purchase";
};

const upsertEnrollmentFromPurchase = (enrollments: EnrollmentDTO[] = [], purchase: PurchasedCourseDTO): EnrollmentDTO[] => {
	/** Semester-specific purchases only unlock a cohort seat via `enrollUserInCohort`, not a catalog enrollment row. */
	if (purchase.cohortId) {
		return enrollments;
	}

	const existingIndex = enrollments.findIndex(
		(enrollment) => enrollment.courseId === purchase.courseId && !enrollment.cohortId,
	);
	const nextEnrollment: EnrollmentDTO = {
		courseId: purchase.courseId,
		enrolledAt: purchase.purchasedAt,
		entitlementSource: entitlementSourceFromPurchase(purchase),
		status: purchase.accessStatus === "revoked" ? "revoked" : purchase.accessStatus === "refunded" ? "paused" : "active",
		progressPercent: purchase.progressPercent ?? 0,
		lastAccessedAt: purchase.lastAccessedAt,
		accessExpiresAt: purchase.accessExpiresAt,
	};

	if (existingIndex === -1) {
		return [...enrollments, nextEnrollment];
	}

	return enrollments.map((enrollment, index) =>
		index === existingIndex
			? {
					...enrollment,
					...nextEnrollment,
					enrolledAt: enrollment.enrolledAt ?? nextEnrollment.enrolledAt,
				}
			: enrollment,
	);
};

export const mapMongoUserToDTO = (user: MongoUser & { _id: ObjectId }): UserDTO => ({
	id: user._id.toHexString(),
	firstName: user.firstName,
	lastName: user.lastName,
	email: user.email,
	role: user.role,
	languageLevel: user.languageLevel,
	country: user.country,
	interests: user.interests,
	purchasedCourses: user.purchasedCourses,
	enrollments: user.enrollments,
	createdAt: user.createdAt,
	updatedAt: user.updatedAt,
	status: user.status,
	enrolledCourseCount: user.enrolledCourseCount ?? user.enrollments?.length ?? user.purchasedCourses?.length ?? 0,
	lastLoginAt: user.lastLoginAt,
	studyStreakDays: user.studyStreakDays,
	lastStudyStreakUtcDate: user.lastStudyStreakUtcDate,
});

export const listUsers = async (): Promise<UserDTO[]> => {
	const db = await connectToDatabase();
	initUserCollection(db);
	const usersCollection = getUserCollection();

	const users = await usersCollection.find({}).sort({ createdAt: -1 }).toArray();

	return users
		.filter((user): user is MongoUser & { _id: ObjectId } => Boolean(user._id))
		.map(mapMongoUserToDTO);
};

export const getUserByEmail = async (email: string): Promise<UserDTO | null> => {
	const db = await connectToDatabase();
	initUserCollection(db);
	const usersCollection = getUserCollection();

	const user = await usersCollection.findOne({ email });
	if (!user || !user._id) {
		return null;
	}

	return mapMongoUserToDTO(user as MongoUser & { _id: ObjectId });
};

export const createUser = async (payload: CreateUserInput): Promise<UserDTO> => {
	const db = await connectToDatabase();
	initUserCollection(db);
	const usersCollection = getUserCollection();

	const now = new Date();
	const purchaseDerivedEnrollments =
		payload.purchasedCourses?.reduce<EnrollmentDTO[]>(
			(acc, purchase) => upsertEnrollmentFromPurchase(acc, purchase),
			[],
		) ?? [];
	const initialEnrollments = payload.enrollments ?? purchaseDerivedEnrollments;

	const userDocument: MongoUser = {
		firstName: payload.firstName,
		lastName: payload.lastName,
		email: payload.email,
		role: normalizeRole(payload.role),
		status: payload.status ?? "invited",
		purchasedCourses: payload.purchasedCourses ?? [],
		enrollments: initialEnrollments,
		enrolledCourseCount: initialEnrollments.length,
		createdAt: now,
		updatedAt: now,
	};

	const result = await usersCollection.insertOne(userDocument);

	const insertedUser: MongoUser & { _id: ObjectId } = {
		...userDocument,
		_id: result.insertedId,
	};

	return mapMongoUserToDTO(insertedUser);
};

export const deleteUser = async (userId: string): Promise<boolean> => {
	if (!ObjectId.isValid(userId)) {
		return false;
	}

	const db = await connectToDatabase();
	initUserCollection(db);
	const usersCollection = getUserCollection();

	const result = await usersCollection.deleteOne({ _id: new ObjectId(userId) });
	return result.deletedCount === 1;
};

export const updateUser = async (userId: string, payload: UpdateUserInput): Promise<UserDTO | null> => {
	if (!ObjectId.isValid(userId)) {
		return null;
	}

	const updates = normalizeUpdate(payload);
	if (Object.keys(updates).length === 0) {
		return null;
	}

	const db = await connectToDatabase();
	initUserCollection(db);
	const usersCollection = getUserCollection();

	const result = await usersCollection.findOneAndUpdate(
		{ _id: new ObjectId(userId) },
		{
			$set: {
				...updates,
				...(updates.enrollments
					? { enrolledCourseCount: updates.enrollments.length }
					: updates.purchasedCourses
						? { enrolledCourseCount: updates.purchasedCourses.length }
						: {}),
				updatedAt: new Date(),
			},
		},
		{
			returnDocument: "after",
		},
	);

	if (!result || !result._id) {
		return null;
	}

	return mapMongoUserToDTO(result as MongoUser & { _id: ObjectId });
};

export const updateUserByEmail = async (email: string, payload: UpdateUserInput): Promise<UserDTO | null> => {
	const db = await connectToDatabase();
	initUserCollection(db);
	const usersCollection = getUserCollection();

	const existing = await usersCollection.findOne({ email });
	if (!existing || !existing._id) {
		return null;
	}

	return updateUser(existing._id.toHexString(), payload);
};

export const addUserPurchase = async (
	userId: string,
	purchase: PurchasedCourseDTO,
): Promise<UserDTO | null> => {
	if (!ObjectId.isValid(userId)) {
		return null;
	}

	const db = await connectToDatabase();
	initUserCollection(db);
	const usersCollection = getUserCollection();

	const existing = await usersCollection.findOne({ _id: new ObjectId(userId) });
	if (!existing || !existing._id) {
		return null;
	}

	const purchases = existing.purchasedCourses ?? [];
	const withoutCurrent = purchases.filter((entry) => purchaseRowKey(entry) !== purchaseRowKey(purchase));
	const nextPurchases = [...withoutCurrent, purchase];
	const nextEnrollments = upsertEnrollmentFromPurchase(existing.enrollments ?? [], purchase);

	const result = await usersCollection.findOneAndUpdate(
		{ _id: new ObjectId(userId) },
		{
			$set: {
				purchasedCourses: nextPurchases,
				enrollments: nextEnrollments,
				enrolledCourseCount: nextEnrollments.length,
				updatedAt: new Date(),
			},
		},
		{ returnDocument: "after" },
	);

	if (!result || !result._id) {
		return null;
	}

	return mapMongoUserToDTO(result as MongoUser & { _id: ObjectId });
};

type DashboardSummary = {
	stats: {
		enrolledCourses: number;
		lessonsCompleted: number;
		studyHoursThisMonth: number;
		streakDays: number;
	};
	upcomingBookings: Array<{
		id: string;
		title: string;
		dateLabel: string;
		timeLabel: string;
		mode: "Video" | "Tutoring";
	}>;
};

const formatLastVisitedLabel = (lastAccessedAt?: Date): string => {
	if (!lastAccessedAt) return "Recently";
	const now = Date.now();
	const diffMs = now - new Date(lastAccessedAt).getTime();
	const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
	if (diffDays <= 0) return "Today";
	if (diffDays === 1) return "Yesterday";
	return `${diffDays} days ago`;
};

export const getUserDashboardSummary = async (email: string): Promise<DashboardSummary | null> => {
	const user = await getUserByEmail(email);
	if (!user) {
		return null;
	}

	const enrollments = user.enrollments ?? [];
	const lessonsCompleted = enrollments.reduce((sum, enrollment) => sum + (enrollment.attendanceSummary?.attended ?? 0), 0);

	const db = await connectToDatabase();
	const sessionsCollection = db.collection<{
		cohortId: string;
		startsAt: Date;
		status?: string;
	}>("sessions");
	const cohortIds = enrollments.map((enrollment) => enrollment.cohortId).filter((value): value is string => Boolean(value));
	const now = new Date();
	const upcomingSessionDocs =
		cohortIds.length > 0
			? await sessionsCollection
					.find({
						cohortId: { $in: cohortIds },
						startsAt: { $gte: now },
						status: { $in: ["scheduled", "booked"] },
					})
					.sort({ startsAt: 1 })
					.limit(5)
					.toArray()
			: [];

	const upcomingBookings = upcomingSessionDocs.map((session) => ({
		id: `${session.cohortId}-${session.startsAt.toISOString()}`,
		title: "Tutoring session",
		dateLabel: session.startsAt.toLocaleDateString("en-AU", {
			weekday: "short",
			day: "numeric",
			month: "short",
			year: "numeric",
		}),
		timeLabel: session.startsAt.toLocaleTimeString("en-AU", {
			hour: "numeric",
			minute: "2-digit",
		}),
		mode: "Tutoring" as const,
	}));

	const streakDays =
		typeof user.studyStreakDays === "number" && Number.isFinite(user.studyStreakDays) && user.studyStreakDays > 0
			? user.studyStreakDays
			: 0;

	return {
		stats: {
			enrolledCourses: enrollments.length,
			lessonsCompleted,
			studyHoursThisMonth: Math.round(lessonsCompleted * 0.75),
			streakDays,
		},
		upcomingBookings,
	};
};

export const getUserEnrolledCourses = async (email: string) => {
	const user = await getUserByEmail(email);
	if (!user) {
		return null;
	}

	const enrollments = user.enrollments ?? [];
	const db = await connectToDatabase();
	const coursesCollection = db.collection<{ title?: string; courseId?: string; slug?: string }>("courses");

	const result = await Promise.all(
		enrollments.map(async (enrollment) => {
			const course = await coursesCollection.findOne({
				$or: [{ courseId: enrollment.courseId }, { slug: enrollment.courseId }],
			});

			const accessExpiresAt = enrollment.accessExpiresAt
				? new Date(enrollment.accessExpiresAt).toISOString()
				: undefined;
			const accessExpired =
				enrollment.accessExpiresAt != null &&
				new Date(enrollment.accessExpiresAt).getTime() <= Date.now();

			return {
				id: enrollment.courseId,
				cohortId: enrollment.cohortId,
				title: course?.title ?? enrollment.courseId,
				progressPercent: enrollment.progressPercent ?? 0,
				nextLessonTitle: "Continue from where you stopped",
				lastVisitedLabel: formatLastVisitedLabel(enrollment.lastAccessedAt),
				attendedSessions: enrollment.attendanceSummary?.attended ?? 0,
				sessionsLeft: enrollment.attendanceSummary?.left ?? 0,
				recommendedSessionsPerWeek: enrollment.recommendedSessionsPerWeek ?? 1,
				accessExpiresAt,
				accessExpired,
			};
		}),
	);

	return result;
};

const MS_PER_UTC_DAY = 86_400_000;

function utcCalendarDateString(d: Date): string {
	return d.toISOString().slice(0, 10);
}

function addCalendarDaysUtc(yyyyMmDd: string, deltaDays: number): string {
	const y = parseInt(yyyyMmDd.slice(0, 4), 10);
	const mo = parseInt(yyyyMmDd.slice(5, 7), 10);
	const day = parseInt(yyyyMmDd.slice(8, 10), 10);
	const t = Date.UTC(y, mo - 1, day);
	return utcCalendarDateString(new Date(t + deltaDays * MS_PER_UTC_DAY));
}

/**
 * Call after meaningful study activity (checkpoint/progress/video). Idempotent per UTC day.
 * - Same UTC day as `lastStudyStreakUtcDate`: streak unchanged, no write.
 * - Previous UTC day: increment streak.
 * - Older gap or first activity: streak resets to 1.
 */
export async function touchUserStudyStreak(email: string): Promise<number | null> {
	const db = await connectToDatabase();
	initUserCollection(db);
	const usersCollection = getUserCollection();
	const userDoc = await usersCollection.findOne({ email });
	if (!userDoc?._id) {
		return null;
	}

	const today = utcCalendarDateString(new Date());
	const prevLast =
		typeof userDoc.lastStudyStreakUtcDate === "string" && userDoc.lastStudyStreakUtcDate.trim().length >= 10
			? userDoc.lastStudyStreakUtcDate.trim().slice(0, 10)
			: undefined;
	const prevStreak =
		typeof userDoc.studyStreakDays === "number" &&
		Number.isFinite(userDoc.studyStreakDays) &&
		userDoc.studyStreakDays > 0
			? userDoc.studyStreakDays
			: 0;

	if (prevLast === today) {
		return Math.max(1, prevStreak);
	}

	let nextStreak: number;
	if (!prevLast) {
		nextStreak = 1;
	} else if (prevLast === addCalendarDaysUtc(today, -1)) {
		nextStreak = prevStreak > 0 ? prevStreak + 1 : 1;
	} else {
		nextStreak = 1;
	}

	const capped = Math.min(nextStreak, 3650);

	await usersCollection.updateOne(
		{ _id: userDoc._id },
		{ $set: { studyStreakDays: capped, lastStudyStreakUtcDate: today, updatedAt: new Date() } },
	);

	return capped;
}

export const updateUserCourseProgressByEmail = async (
	email: string,
	courseId: string,
	progressPercent: number,
) => {
	const db = await connectToDatabase();
	initUserCollection(db);
	const usersCollection = getUserCollection();

	const user = await usersCollection.findOne({ email });
	if (!user || !user._id) {
		return null;
	}

	const currentEnrollments = user.enrollments ?? [];
	const now = new Date();
	const enrollmentIndex = currentEnrollments.findIndex((entry) => {
		if (entry.courseId !== courseId) return false;
		const exp = entry.accessExpiresAt ? new Date(entry.accessExpiresAt).getTime() : undefined;
		if (exp != null && exp <= now.getTime()) return false;
		return true;
	});
	if (enrollmentIndex === -1) {
		return null;
	}

	const boundedProgress = Math.max(0, Math.min(100, progressPercent));
	const targetEnrollment = currentEnrollments[enrollmentIndex];
	const nextEnrollments = currentEnrollments.map((entry, index) =>
		index === enrollmentIndex
			? {
					...entry,
					progressPercent: boundedProgress,
					lastAccessedAt: now,
					status: boundedProgress >= 100 ? "completed" : entry.status ?? "active",
					completedAt: boundedProgress >= 100 ? now : entry.completedAt,
				}
			: entry,
	);

	const nextPurchases = (user.purchasedCourses ?? []).map((purchase) =>
		purchaseRowKey(purchase) === purchaseRowKey({ courseId, cohortId: targetEnrollment.cohortId })
			? {
					...purchase,
					progressPercent: boundedProgress,
					lastAccessedAt: now,
				}
			: purchase,
	);

	const result = await usersCollection.findOneAndUpdate(
		{ _id: user._id },
		{
			$set: {
				enrollments: nextEnrollments,
				purchasedCourses: nextPurchases,
				updatedAt: now,
			},
		},
		{ returnDocument: "after" },
	);

	if (!result || !result._id) {
		return null;
	}

	const mapped = mapMongoUserToDTO(result as MongoUser & { _id: ObjectId });
	try {
		await touchUserStudyStreak(email);
	} catch (err) {
		console.warn("[study-streak] touch failed after course progress update", err);
	}
	return mapped;
};

export const getUserActivityFeed = async (email: string) => {
	const user = await getUserByEmail(email);
	if (!user) {
		return null;
	}

	const activities = (user.enrollments ?? [])
		.sort((a, b) => {
			const aDate = a.lastAccessedAt ? new Date(a.lastAccessedAt).getTime() : 0;
			const bDate = b.lastAccessedAt ? new Date(b.lastAccessedAt).getTime() : 0;
			return bDate - aDate;
		})
		.slice(0, 10)
		.map((enrollment, index) => ({
			id: `${enrollment.courseId}-${index}`,
			label:
				(enrollment.progressPercent ?? 0) >= 100
					? `Completed course ${enrollment.courseId}`
					: `Continued learning in ${enrollment.courseId}`,
			timeLabel: formatLastVisitedLabel(enrollment.lastAccessedAt),
		}));

	return activities;
};

export const updateUserPurchase = async (
	userId: string,
	courseId: string,
	patch: Partial<PurchasedCourseDTO>,
): Promise<UserDTO | null> => {
	if (!ObjectId.isValid(userId)) {
		return null;
	}

	const db = await connectToDatabase();
	initUserCollection(db);
	const usersCollection = getUserCollection();

	const existing = await usersCollection.findOne({ _id: new ObjectId(userId) });
	if (!existing || !existing._id) {
		return null;
	}

	const purchases = existing.purchasedCourses ?? [];
	const keyFromPatch = purchaseRowKey({
		courseId,
		cohortId: patch.cohortId ?? purchases.find((e) => e.courseId === courseId)?.cohortId,
	});
	let purchaseIndex = purchases.findIndex((entry) => purchaseRowKey(entry) === keyFromPatch);
	if (purchaseIndex === -1) {
		purchaseIndex = purchases.findIndex((entry) => entry.courseId === courseId);
	}
	if (purchaseIndex === -1) {
		return null;
	}

	const mergedPurchase: PurchasedCourseDTO = {
		...purchases[purchaseIndex],
		...patch,
		courseId,
	};

	const nextPurchases = purchases.map((entry, index) => (index === purchaseIndex ? mergedPurchase : entry));
	const nextEnrollments = upsertEnrollmentFromPurchase(existing.enrollments ?? [], mergedPurchase);

	const result = await usersCollection.findOneAndUpdate(
		{ _id: new ObjectId(userId) },
		{
			$set: {
				purchasedCourses: nextPurchases,
				enrollments: nextEnrollments,
				enrolledCourseCount: nextEnrollments.length,
				updatedAt: new Date(),
			},
		},
		{ returnDocument: "after" },
	);

	if (!result || !result._id) {
		return null;
	}

	return mapMongoUserToDTO(result as MongoUser & { _id: ObjectId });
};

export const addUserPurchaseByEmail = async (
	email: string,
	purchase: PurchasedCourseDTO,
): Promise<UserDTO | null> => {
	const user = await getUserByEmail(email);
	if (!user?.id) {
		return null;
	}
	return addUserPurchase(user.id, purchase);
};
