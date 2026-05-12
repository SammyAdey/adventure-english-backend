import type { CourseDTO } from "../dto/courses.dto";
import type { CourseCheckpointAttemptStateDTO, EnrollmentDTO } from "../dto/users.dto";
import { getUserCollection, initUserCollection } from "../models/user.model";
import { connectToDatabase } from "../utils/mongo";
import {
	getCheckpointIdsForUnit,
	getCheckpointIdsForVideo,
	gradeCheckpointAttempt,
} from "../utils/interactive-checkpoint";
import { getCourseById } from "./course.service";
import { updateUserCourseProgressByEmail } from "./user.service";

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

/** Share of course interactive checkpoints answered correctly at least once (ties `progressPercent` to checkpoints). */
export function computeCheckpointBasedProgressPercent(
	course: CourseDTO,
	attempts: CourseCheckpointAttemptStateDTO[] | undefined,
): number {
	const checkpoints = course.interactiveCheckpoints ?? [];
	const validIds = new Set(checkpoints.map((c) => c.id));
	const list = attempts ?? [];
	const solved = list.filter((a) => a.lastCorrect && validIds.has(a.checkpointId)).length;
	const total = checkpoints.length;
	if (total === 0) return 100;
	return Math.max(0, Math.min(100, Math.round((solved / total) * 100)));
}

async function syncEnrollmentProgressPercentFromCheckpointAttempts(
	email: string,
	course: CourseDTO,
	enrollmentCourseId: string,
	attempts: CourseCheckpointAttemptStateDTO[],
): Promise<void> {
	const pct = computeCheckpointBasedProgressPercent(course, attempts);
	await updateUserCourseProgressByEmail(email, enrollmentCourseId, pct);
}

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

	const attemptsAfter = nextEnrollments[enrollmentIndex].interactiveCheckpointAttempts ?? [];
	await syncEnrollmentProgressPercentFromCheckpointAttempts(
		email,
		course,
		enrollment.courseId,
		attemptsAfter,
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

	const attemptsAfter = nextEnrollments[enrollmentIndex].interactiveCheckpointAttempts ?? [];
	await syncEnrollmentProgressPercentFromCheckpointAttempts(
		email,
		course,
		enrollment.courseId,
		attemptsAfter,
	);

	return { ok: true };
}

/** Clears stored attempts for every checkpoint on this lesson video (mid + after video). */
export async function resetInteractiveCheckpointProgressForLessonVideo(
	email: string,
	courseIdOrSlug: string,
	videoId: string,
): Promise<
	| { ok: true; resetCount: number }
	| { ok: false; status: number; code: string; message: string }
> {
	const course = await getCourseById(courseIdOrSlug);
	if (!course) {
		return { ok: false, status: 404, code: "COURSE_NOT_FOUND", message: "Course not found" };
	}

	const videoExists = (course.units ?? []).some((unit) =>
		(unit.videos ?? []).some((v) => typeof v.id === "string" && v.id.trim() === videoId.trim()),
	);
	if (!videoExists) {
		return { ok: false, status: 404, code: "VIDEO_NOT_FOUND", message: "Lesson video not found on this course" };
	}

	const lessonCheckpointIds = getCheckpointIdsForVideo(course, videoId);
	const removeSet = new Set(lessonCheckpointIds);

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
	const before = attempts.length;
	const nextAttempts = attempts.filter((a) => !removeSet.has(a.checkpointId));
	const resetCount = before - nextAttempts.length;

	const nextEnrollments = enrollments.map((e, i) =>
		i === enrollmentIndex ? { ...e, interactiveCheckpointAttempts: nextAttempts } : e,
	);

	await usersCollection.updateOne(
		{ _id: userDoc._id },
		{ $set: { enrollments: nextEnrollments, updatedAt: new Date() } },
	);

	const attemptsAfter = nextEnrollments[enrollmentIndex].interactiveCheckpointAttempts ?? [];
	await syncEnrollmentProgressPercentFromCheckpointAttempts(
		email,
		course,
		enrollment.courseId,
		attemptsAfter,
	);

	return { ok: true, resetCount };
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
