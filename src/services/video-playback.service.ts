import type { CourseDTO, CourseVideoDTO, InstructionalLanguage } from "../dto/courses.dto";
import type { EnrollmentDTO } from "../dto/users.dto";
import { getUserCollection, initUserCollection } from "../models/user.model";
import { buildCloudflarePlaybackUrl } from "../utils/cloudflare-stream";
import { connectToDatabase } from "../utils/mongo";
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

const isEnrollmentActive = (enrollment: EnrollmentDTO): boolean => {
	if (enrollment.status === "revoked" || enrollment.status === "paused") {
		return false;
	}
	const expiresAt = enrollment.accessExpiresAt ? new Date(enrollment.accessExpiresAt).getTime() : undefined;
	if (expiresAt != null && Number.isFinite(expiresAt) && expiresAt <= Date.now()) {
		return false;
	}
	return true;
};

const resolveVideoForLanguage = (video: CourseVideoDTO, lang: InstructionalLanguage): string => {
	const byLanguage = video.videoUrls?.[lang]?.trim();
	if (byLanguage) return byLanguage;
	const english = video.videoUrls?.en?.trim();
	if (english) return english;
	return video.videoUrl?.trim() ?? "";
};

const findVideoInCourse = (course: CourseDTO, videoId: string): CourseVideoDTO | null => {
	for (const unit of course.units ?? []) {
		const found = (unit.videos ?? []).find((video) => video.id?.trim() === videoId);
		if (found) return found;
	}
	return null;
};

export type CourseVideoPlaybackUrlResult =
	| { ok: true; url: string; expiresAt?: string; source: "signed_stream" | "stream_url" | "legacy_url" }
	| { ok: false; status: number; code: string; message: string };

export async function getSecureCourseVideoPlaybackUrlForUser(
	email: string,
	courseIdOrSlug: string,
	videoId: string,
	lang: InstructionalLanguage,
): Promise<CourseVideoPlaybackUrlResult> {
	const course = await getCourseById(courseIdOrSlug);
	if (!course) {
		return { ok: false, status: 404, code: "COURSE_NOT_FOUND", message: "Course not found" };
	}
	const video = findVideoInCourse(course, videoId);
	if (!video) {
		return { ok: false, status: 404, code: "VIDEO_NOT_FOUND", message: "Video not found in this course" };
	}

	const db = await connectToDatabase();
	initUserCollection(db);
	const usersCollection = getUserCollection();
	const userDoc = await usersCollection.findOne({ email });
	if (!userDoc?._id) {
		return { ok: false, status: 401, code: "UNAUTHORIZED", message: "User not found" };
	}

	const enrollment = (userDoc.enrollments ?? []).find(
		(e: EnrollmentDTO) => enrollmentMatchesCourse(e, course) && isEnrollmentActive(e),
	);
	if (!enrollment) {
		return { ok: false, status: 403, code: "NOT_ENTITLED", message: "No active enrollment for this course" };
	}

	const streamPublicId = video.streamPublicId?.trim();
	if (streamPublicId) {
		const signed = await buildCloudflarePlaybackUrl(streamPublicId);
		if (signed) {
			return {
				ok: true,
				url: signed.url,
				...(signed.expiresAt ? { expiresAt: signed.expiresAt.toISOString() } : {}),
				source: signed.source,
			};
		}
	}

	const fallbackUrl = resolveVideoForLanguage(video, lang);
	if (!fallbackUrl) {
		return { ok: false, status: 404, code: "VIDEO_URL_MISSING", message: "No playable URL configured for this lesson" };
	}
	return { ok: true, url: fallbackUrl, source: "legacy_url" };
}
