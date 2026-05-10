import type { CourseDTO } from "../dto/courses.dto";
import type { CourseCheckpointAttemptStateDTO, EnrollmentDTO } from "../dto/users.dto";
import { getUserCollection, initUserCollection } from "../models/user.model";
import { connectToDatabase } from "../utils/mongo";
import {
	getCheckpointIdsForUnit,
	gradeCheckpointAttempt,
} from "../utils/interactive-checkpoint";
import { getCourseById } from "./course.service";

const courseAliases = (course: CourseDTO): Set<string> => {
	const set = new Set<string>();
	if (course.id) set.add(course.id);
	if (course.courseId) set.add(course.courseId);
	if (course.slug) set.add(course.slug);
	return set;
};

const enrollmentMatchesCourse = (enrollment: EnrollmentDTO, course: CourseDTO): boolean => {
	const aliases = courseAliases(course);
	return Boolean(enrollment.courseId && aliases.has(enrollment.courseId));
};

const isEnrollmentActiveForCheckpoints = (enrollment: EnrollmentDTO): boolean => {
	if (enrollment.status === "revoked" || enrollment.status === "paused") {
		return false;
	}
	const exp = enrollment.accessExpiresAt ? new Date(enrollment.accessExpiresAt).getTime() : undefined;
	if (exp != null && exp <= Date.now()) {
		return false;
	}
	return true;
};

export async function submitInteractiveCheckpointAttempt(
	email: string,
	courseIdOrSlug: string,
	checkpointId: string,
	body: unknown,
): Promise<
	| { ok: true; correct: boolean; explanation?: string; alreadySolved?: boolean }
	| { ok: false; status: number; code: string; message: string }
> {
	const course = await getCourseById(courseIdOrSlug);
	if (!course) {
		return { ok: false, status: 404, code: "COURSE_NOT_FOUND", message: "Course not found" };
	}
	const checkpoint = (course.interactiveCheckpoints ?? []).find((c) => c.id === checkpointId);
	if (!checkpoint) {
		return { ok: false, status: 404, code: "CHECKPOINT_NOT_FOUND", message: "Checkpoint not found" };
	}

	const db = await connectToDatabase();
	initUserCollection(db);
	const usersCollection = getUserCollection();
	const userDoc = await usersCollection.findOne({ email });
	if (!userDoc?._id) {
		return { ok: false, status: 401, code: "UNAUTHORIZED", message: "User not found" };
	}

	const enrollments = userDoc.enrollments ?? [];
	const enrollmentIndex = enrollments.findIndex(
		(e) => enrollmentMatchesCourse(e, course) && isEnrollmentActiveForCheckpoints(e),
	);
	if (enrollmentIndex === -1) {
		return { ok: false, status: 403, code: "NOT_ENTITLED", message: "No active enrollment for this course" };
	}

	const enrollment = enrollments[enrollmentIndex];
	const attempts = [...(enrollment.interactiveCheckpointAttempts ?? [])];
	const prev = attempts.find((a) => a.checkpointId === checkpointId);
	if (prev?.lastCorrect) {
		return {
			ok: true,
			correct: true,
			alreadySolved: true,
			explanation: typeof checkpoint.explanation === "string" ? checkpoint.explanation : undefined,
		};
	}

	const { correct, explanation } = gradeCheckpointAttempt(checkpoint, body);
	const nextRow: CourseCheckpointAttemptStateDTO = {
		checkpointId,
		lastCorrect: correct,
		attemptCount: (prev?.attemptCount ?? 0) + 1,
		lastSubmittedAt: new Date(),
	};
	const attemptIndex = attempts.findIndex((a) => a.checkpointId === checkpointId);
	const nextAttempts =
		attemptIndex === -1
			? [...attempts, nextRow]
			: attempts.map((a, i) => (i === attemptIndex ? nextRow : a));

	const nextEnrollments = enrollments.map((e, i) =>
		i === enrollmentIndex ? { ...e, interactiveCheckpointAttempts: nextAttempts } : e,
	);

	await usersCollection.updateOne(
		{ _id: userDoc._id },
		{ $set: { enrollments: nextEnrollments, updatedAt: new Date() } },
	);

	return { ok: true, correct, explanation };
}

/** Removes stored progress for one checkpoint so the learner can answer again. */
export async function resetInteractiveCheckpointProgressForUser(
	email: string,
	courseIdOrSlug: string,
	checkpointId: string,
): Promise<{ ok: true } | { ok: false; status: number; code: string; message: string }> {
	const course = await getCourseById(courseIdOrSlug);
	if (!course) {
		return { ok: false, status: 404, code: "COURSE_NOT_FOUND", message: "Course not found" };
	}
	const checkpointExists = (course.interactiveCheckpoints ?? []).some((c) => c.id === checkpointId);
	if (!checkpointExists) {
		return { ok: false, status: 404, code: "CHECKPOINT_NOT_FOUND", message: "Checkpoint not found" };
	}

	const db = await connectToDatabase();
	initUserCollection(db);
	const usersCollection = getUserCollection();
	const userDoc = await usersCollection.findOne({ email });
	if (!userDoc?._id) {
		return { ok: false, status: 401, code: "UNAUTHORIZED", message: "User not found" };
	}

	const enrollments = userDoc.enrollments ?? [];
	const enrollmentIndex = enrollments.findIndex(
		(e) => enrollmentMatchesCourse(e, course) && isEnrollmentActiveForCheckpoints(e),
	);
	if (enrollmentIndex === -1) {
		return { ok: false, status: 403, code: "NOT_ENTITLED", message: "No active enrollment for this course" };
	}

	const enrollment = enrollments[enrollmentIndex];
	const attempts = enrollment.interactiveCheckpointAttempts ?? [];
	const nextAttempts = attempts.filter((a) => a.checkpointId !== checkpointId);

	const nextEnrollments = enrollments.map((e, i) =>
		i === enrollmentIndex ? { ...e, interactiveCheckpointAttempts: nextAttempts } : e,
	);

	await usersCollection.updateOne(
		{ _id: userDoc._id },
		{ $set: { enrollments: nextEnrollments, updatedAt: new Date() } },
	);

	return { ok: true };
}

export type CourseCheckpointProgressDTO = {
	solvedCheckpointIds: string[];
	unitProgress: Array<{
		unitId: string;
		complete: boolean;
		checkpointIds: string[];
	}>;
};

export async function getInteractiveCheckpointProgressForUser(
	email: string,
	courseIdOrSlug: string,
): Promise<
	| { ok: true; progress: CourseCheckpointProgressDTO }
	| { ok: false; status: number; code: string; message: string }
> {
	const course = await getCourseById(courseIdOrSlug);
	if (!course) {
		return { ok: false, status: 404, code: "COURSE_NOT_FOUND", message: "Course not found" };
	}

	const db = await connectToDatabase();
	initUserCollection(db);
	const usersCollection = getUserCollection();
	const userDoc = await usersCollection.findOne({ email });
	if (!userDoc?._id) {
		return { ok: false, status: 401, code: "UNAUTHORIZED", message: "User not found" };
	}

	const enrollments = userDoc.enrollments ?? [];
	const enrollment = enrollments.find(
		(e) => enrollmentMatchesCourse(e, course) && isEnrollmentActiveForCheckpoints(e),
	);
	if (!enrollment) {
		return { ok: false, status: 403, code: "NOT_ENTITLED", message: "No active enrollment for this course" };
	}

	const solved = new Set(
		(enrollment.interactiveCheckpointAttempts ?? [])
			.filter((a) => a.lastCorrect)
			.map((a) => a.checkpointId),
	);

	const solvedCheckpointIds = [...solved];

	const unitProgress = (course.units ?? []).map((unit) => {
		const unitId = typeof unit.id === "string" && unit.id.trim() ? unit.id.trim() : "";
		const checkpointIds = unitId ? getCheckpointIdsForUnit(course, unitId) : [];
		const complete =
			checkpointIds.length > 0 && checkpointIds.every((id) => solved.has(id));
		return { unitId: unitId || `unit-${unit.order ?? 0}`, complete, checkpointIds };
	});

	return { ok: true, progress: { solvedCheckpointIds, unitProgress } };
}
