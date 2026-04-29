import { ObjectId } from "mongodb";
import { connectToDatabase } from "../utils/mongo";
import { getUserCollection, initUserCollection } from "../models/user.model";
import type { EnrollmentDTO, LegacyInputRole, MongoUser, PurchasedCourseDTO, UserDTO, UserRole, UserStatus } from "../dto/users.dto";

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

const normalizeRole = (role?: LegacyInputRole): UserRole => {
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

const upsertEnrollmentFromPurchase = (enrollments: EnrollmentDTO[] = [], purchase: PurchasedCourseDTO): EnrollmentDTO[] => {
	const existingIndex = enrollments.findIndex((enrollment) => enrollment.courseId === purchase.courseId);
	const nextEnrollment: EnrollmentDTO = {
		courseId: purchase.courseId,
		enrolledAt: purchase.purchasedAt,
		entitlementSource: "purchase",
		status: purchase.accessStatus === "revoked" ? "revoked" : purchase.accessStatus === "refunded" ? "paused" : "active",
		progressPercent: purchase.progressPercent ?? 0,
		lastAccessedAt: purchase.lastAccessedAt,
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

const mapMongoUserToDTO = (user: MongoUser & { _id: ObjectId }): UserDTO => ({
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
	const withoutCurrent = purchases.filter((entry) => entry.courseId !== purchase.courseId);
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
		mode: "Video" | "In person";
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
		title: "In-person cohort session",
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
		mode: "In person" as const,
	}));

	return {
		stats: {
			enrolledCourses: enrollments.length,
			lessonsCompleted,
			studyHoursThisMonth: Math.round(lessonsCompleted * 0.75),
			streakDays: Math.min(30, Math.max(1, enrollments.length * 2)),
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
			};
		}),
	);

	return result;
};

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
	const enrollmentExists = currentEnrollments.some((entry) => entry.courseId === courseId);
	if (!enrollmentExists) {
		return null;
	}

	const now = new Date();
	const boundedProgress = Math.max(0, Math.min(100, progressPercent));
	const nextEnrollments = currentEnrollments.map((entry) =>
		entry.courseId === courseId
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
		purchase.courseId === courseId
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

	return mapMongoUserToDTO(result as MongoUser & { _id: ObjectId });
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
	const purchaseIndex = purchases.findIndex((entry) => entry.courseId === courseId);
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
