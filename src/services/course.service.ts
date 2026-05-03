// /src/services/course.service.ts

import { randomInt } from "crypto";
import { ObjectId } from "mongodb";
import {
	CourseDTO,
	CourseInputDTO,
	CourseMetaDTO,
	CourseReviewDTO,
	CourseReviewInputDTO,
	CourseReviewSummaryDTO,
	CourseUnitDTO,
	CourseVideoDTO,
	InstructionalLanguage,
	MongoCourse,
	MongoCourseReview,
} from "../dto/courses.dto";
import { initCourseCollection, getCourseCollection } from "../models/course.model";
import { getUserCollection, initUserCollection } from "../models/user.model";
import { mongoCourseActiveFilter } from "../utils/course-active-filter";
import { logPreparedCourseDocument } from "../utils/log-course-body";
import { connectToDatabase } from "../utils/mongo";
import { listCohortsByCourse } from "./cohort.service";

export class CourseValidationError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "CourseValidationError";
	}
}

const DEFAULT_INSTRUCTIONAL_LANGUAGES: InstructionalLanguage[] = ["en"];

export const normalizeInstructionalLanguages = (
	input?: InstructionalLanguage[] | null,
): InstructionalLanguage[] => {
	if (!input?.length) {
		return [...DEFAULT_INSTRUCTIONAL_LANGUAGES];
	}
	const seen = new Set<InstructionalLanguage>();
	const order: InstructionalLanguage[] = [];
	for (const code of input) {
		if (code !== "en" && code !== "zh") continue;
		if (!seen.has(code)) {
			seen.add(code);
			order.push(code);
		}
	}
	return order.length ? order : [...DEFAULT_INSTRUCTIONAL_LANGUAGES];
};

const MAX_COURSE_TARGET_AUDIENCES = 16;

/** Dedupe, trim, cap length; derive legacy `target` as first entry. */
const normalizeCourseTargetsFromPayload = (
	payload: CourseInputDTO & { targets?: unknown },
): { targets: string[]; target?: string } => {
	const ordered: string[] = [];
	const seen = new Set<string>();
	const add = (raw: unknown) => {
		if (typeof raw !== "string") return;
		const t = raw.trim();
		if (!t || seen.has(t)) return;
		if (ordered.length >= MAX_COURSE_TARGET_AUDIENCES) return;
		seen.add(t);
		ordered.push(t);
	};

	if (Array.isArray(payload.targets)) {
		for (const item of payload.targets) {
			add(item);
		}
	}
	if (ordered.length === 0) {
		add(payload.target);
	}

	return { targets: ordered, target: ordered[0] };
};

const deriveTargetsFromMongoCourse = (
	course: MongoCourse & { targets?: unknown; level?: string },
): { targets: string[]; target?: string } => {
	const ordered: string[] = [];
	const seen = new Set<string>();
	const add = (raw: unknown) => {
		if (typeof raw !== "string") return;
		const t = raw.trim();
		if (!t || seen.has(t)) return;
		seen.add(t);
		ordered.push(t);
	};

	if (Array.isArray(course.targets)) {
		for (const item of course.targets) {
			add(item);
		}
	}
	if (ordered.length === 0) {
		add(course.target);
	}
	if (ordered.length === 0) {
		add(course.level);
	}

	return { targets: ordered, target: ordered[0] };
};

const slugify = (value: string): string =>
	value
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");

/** Keep only `meta` fields allowed by the HTTP schema so persistence matches what Ajv accepts. */
const META_PERSIST_KEYS: (keyof CourseMetaDTO)[] = [
	"badge",
	"studentCount",
	"audioLanguages",
	"subtitleLanguages",
	"lessonsCount",
	"downloadsCount",
	"exercisesCount",
	"durationInMinutes",
	"includes",
	"features",
];

const META_NUMERIC_KEYS = new Set<string>([
	"studentCount",
	"lessonsCount",
	"downloadsCount",
	"exercisesCount",
	"durationInMinutes",
]);

const pickMetaForPersistence = (meta: Partial<CourseMetaDTO> | undefined | null): CourseMetaDTO | undefined => {
	if (meta == null) return undefined;
	const out: CourseMetaDTO = {};
	for (const key of META_PERSIST_KEYS) {
		const v = meta[key];
		if (v == null) continue;
		if (key === "badge") {
			if (typeof v !== "string") continue;
			out.badge = v;
			continue;
		}
		if (META_NUMERIC_KEYS.has(key)) {
			if (typeof v !== "number" || Number.isNaN(v)) continue;
			(out as Record<string, unknown>)[key] = v;
			continue;
		}
		if (key === "features" && Array.isArray(v)) {
			out.features = v.filter((item) => item != null).map((item) => String(item));
			continue;
		}
		if ((key === "audioLanguages" || key === "subtitleLanguages" || key === "includes") && Array.isArray(v)) {
			const strings = v.filter((item): item is string => typeof item === "string");
			if (strings.length) (out as Record<string, unknown>)[key] = strings;
			continue;
		}
	}
	return Object.keys(out).length > 0 ? out : undefined;
};

const ALPHANUMERIC_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

const getCourseInitials = (title: string): string => {
	const words = title.match(/[A-Za-z0-9]+/g) ?? [];
	const initials = words.map((word) => word[0]?.toUpperCase() ?? "").join("");
	return initials || "CRS";
};

const generateRandomAlphaNumeric = (length: number): string =>
	Array.from({ length }, () => ALPHANUMERIC_CHARS[randomInt(0, ALPHANUMERIC_CHARS.length)]).join("");

const buildCourseIdFromTitle = (title: string): string => `${getCourseInitials(title)}-${generateRandomAlphaNumeric(6)}`;

const clampRating = (rating: number): number => {
	if (Number.isNaN(rating)) return 5;
	return Math.min(5, Math.max(1, rating));
};

const normalizeReview = (review: CourseReviewInputDTO): MongoCourseReview => ({
	reviewerName: review.reviewerName,
	rating: clampRating(review.rating),
	comment: review.comment,
	headline: review.headline,
	avatarUrl: review.avatarUrl,
	createdAt: new Date(),
	_id: new ObjectId(),
});

const calculateReviewSummary = (reviews: MongoCourseReview[] = []): CourseReviewSummaryDTO => {
	if (reviews.length === 0) {
		return {
			averageRating: 0,
			ratingCount: 0,
			positivePercentage: 0,
		};
	}

	const ratingCount = reviews.length;
	const total = reviews.reduce((sum, review) => sum + review.rating, 0);
	const positiveCount = reviews.filter((review) => review.rating >= 4).length;

	return {
		averageRating: Math.round((total / ratingCount) * 10) / 10,
		ratingCount,
		positivePercentage: Math.round((positiveCount / ratingCount) * 100),
	};
};

const normalizeVideoLocalized = (video: CourseVideoDTO): CourseVideoDTO => {
	const titleFromLegacy = video.title?.trim() ?? "";
	const urlFromLegacy = video.videoUrl?.trim() ?? "";
	const enTitle = video.titles?.en?.trim() || titleFromLegacy;
	const enUrl = video.videoUrls?.en?.trim() || urlFromLegacy;
	const zhTitle = video.titles?.zh?.trim();
	const zhUrl = video.videoUrls?.zh?.trim();
	const titles: NonNullable<CourseVideoDTO["titles"]> = { en: enTitle };
	if (zhTitle) titles.zh = zhTitle;
	const videoUrls: NonNullable<CourseVideoDTO["videoUrls"]> = { en: enUrl };
	if (zhUrl) videoUrls.zh = zhUrl;
	return {
		...video,
		title: enTitle,
		videoUrl: enUrl,
		titles,
		videoUrls,
	};
};

const normalizeUnitLocalized = (unit: CourseUnitDTO): CourseUnitDTO => {
	const titleFromLegacy = unit.title?.trim() ?? "";
	const enTitle = unit.titles?.en?.trim() || titleFromLegacy;
	const zhTitle = unit.titles?.zh?.trim();
	const titles: NonNullable<CourseUnitDTO["titles"]> = { en: enTitle };
	if (zhTitle) titles.zh = zhTitle;
	return {
		...unit,
		title: enTitle,
		titles,
		videos: unit.videos.map(normalizeVideoLocalized),
	};
};

const normalizeUnitsFromPayload = (units: CourseUnitDTO[] = []): CourseUnitDTO[] =>
	units.map((unit, unitIndex) => {
		const withLocalized = normalizeUnitLocalized(unit);
		return {
			...withLocalized,
			order: withLocalized.order ?? unitIndex,
			videos: withLocalized.videos.map((video, videoIndex) => ({
				...video,
				order: video.order ?? videoIndex,
				isPreviewAvailable: video.isPreviewAvailable ?? false,
			})),
			questions: withLocalized.questions?.map((question) => ({
				...question,
			})),
		};
	});

const assertMandarinFieldsComplete = (units: CourseUnitDTO[], langs: InstructionalLanguage[]): void => {
	if (!langs.includes("zh")) return;
	units.forEach((unit, ui) => {
		if (!unit.titles?.zh?.trim()) {
			throw new CourseValidationError(
				`Unit ${ui + 1}: Mandarin (zh) title is required when Mandarin is an instructional language.`,
			);
		}
		unit.videos.forEach((video, vi) => {
			if (!video.titles?.zh?.trim()) {
				throw new CourseValidationError(
					`Unit ${ui + 1}, lesson ${vi + 1}: Mandarin title is required when Mandarin is an instructional language.`,
				);
			}
			if (!video.videoUrls?.zh?.trim()) {
				throw new CourseValidationError(
					`Unit ${ui + 1}, lesson ${vi + 1}: Mandarin video URL is required when Mandarin is an instructional language.`,
				);
			}
		});
	});
};

const mapVideoForResponse = (video: CourseVideoDTO): CourseVideoDTO => {
	const enTitle = video.title?.trim() ?? "";
	const enUrl = video.videoUrl?.trim() ?? "";
	const titles: NonNullable<CourseVideoDTO["titles"]> = {
		en: video.titles?.en?.trim() || enTitle,
		...(video.titles?.zh?.trim() ? { zh: video.titles.zh.trim() } : {}),
	};
	const videoUrls: NonNullable<CourseVideoDTO["videoUrls"]> = {
		en: video.videoUrls?.en?.trim() || enUrl,
		...(video.videoUrls?.zh?.trim() ? { zh: video.videoUrls.zh.trim() } : {}),
	};
	return {
		...video,
		title: titles.en,
		videoUrl: videoUrls.en,
		titles,
		videoUrls,
	};
};

const mapUnitForResponse = (unit: CourseUnitDTO): CourseUnitDTO => {
	const enTitle = unit.title?.trim() ?? "";
	const titles: NonNullable<CourseUnitDTO["titles"]> = {
		en: unit.titles?.en?.trim() || enTitle,
		...(unit.titles?.zh?.trim() ? { zh: unit.titles.zh.trim() } : {}),
	};
	return {
		...unit,
		title: titles.en,
		titles,
		videos: unit.videos.map(mapVideoForResponse),
	};
};

const prepareCourseForPersistence = (
	payload: CourseInputDTO,
	courseId: string,
): Omit<MongoCourse, "_id"> => {
	const now = new Date();
	const reviews = (payload.reviews ?? []).map((review) => normalizeReview(review));
	const slug = payload.slug ? slugify(payload.slug) : slugify(payload.title);
	const instructionalLanguages = normalizeInstructionalLanguages(payload.instructionalLanguages);
	const units = normalizeUnitsFromPayload(payload.units ?? []);
	assertMandarinFieldsComplete(units, instructionalLanguages);

	const { targets, target } = normalizeCourseTargetsFromPayload(payload);
	if (targets.length === 0) {
		throw new CourseValidationError("Select at least one target audience.");
	}

	const metaPersisted = pickMetaForPersistence(payload.meta);

	/** Do not spread `payload` — Fastify/Ajv may leave `meta: {}` or odd shapes; build the document explicitly. */
	const doc: Omit<MongoCourse, "_id"> = {
		courseId,
		title: payload.title,
		summary: payload.summary,
		slug,
		instructionalLanguages,
		deliveryMode: payload.deliveryMode ?? "online",
		isRecommended: payload.isRecommended,
		isSoldOut: typeof payload.isSoldOut === "boolean" ? payload.isSoldOut : false,
		maxEnrollments: payload.maxEnrollments,
		recommendedSessionsPerWeek: payload.recommendedSessionsPerWeek,
		sessionCount: payload.sessionCount,
		targets,
		target,
		category: payload.category,
		tags: payload.tags,
		thumbnailUrl: payload.thumbnailUrl,
		units,
		pricing: payload.pricing,
		reviews,
		reviewSummary: calculateReviewSummary(reviews),
		createdAt: now,
		updatedAt: now,
	};

	if (metaPersisted != null) {
		doc.meta = metaPersisted;
	}

	return doc;
};

const mapMongoReviewToDTO = (review: MongoCourseReview): CourseReviewDTO => ({
	id: review._id ? review._id.toHexString() : new ObjectId().toHexString(),
	reviewerName: review.reviewerName,
	rating: review.rating,
	comment: review.comment,
	headline: review.headline,
	avatarUrl: review.avatarUrl,
	createdAt: review.createdAt ?? new Date(),
});

const mapMongoCourseToDTO = (course: MongoCourse & { _id: ObjectId }): CourseDTO => {
	const { targets, target } = deriveTargetsFromMongoCourse(course);
	return {
	id: course.courseId ?? course._id.toHexString(),
	courseId: course.courseId,
	title: course.title,
	slug: course.slug,
	summary: course.summary,
	instructionalLanguages: normalizeInstructionalLanguages(course.instructionalLanguages),
	deliveryMode: course.deliveryMode ?? "online",
	isRecommended: course.isRecommended ?? false,
	isSoldOut: course.isSoldOut ?? false,
	maxEnrollments: course.maxEnrollments,
	recommendedSessionsPerWeek: course.recommendedSessionsPerWeek,
	sessionCount: course.sessionCount,
	targets: targets.length ? targets : undefined,
	target,
	category: course.category,
	tags: course.tags,
	thumbnailUrl: course.thumbnailUrl,
	units: (course.units ?? []).map(mapUnitForResponse),
	meta: course.meta,
	pricing: course.pricing,
	reviews: (course.reviews ?? []).map(mapMongoReviewToDTO),
	reviewSummary: course.reviewSummary ?? calculateReviewSummary(course.reviews),
	createdAt: course.createdAt,
	updatedAt: course.updatedAt,
};
};

const generateUniqueCourseId = async (title: string): Promise<string> => {
	const db = await connectToDatabase();
	initCourseCollection(db);
	const courseCollection = getCourseCollection();

	for (let attempt = 0; attempt < 12; attempt += 1) {
		const candidate = buildCourseIdFromTitle(title);
		const exists = await courseCollection.findOne(
			{ courseId: candidate },
			{
				projection: { _id: 1 },
			},
		);
		if (!exists) {
			return candidate;
		}
	}

	return `${getCourseInitials(title)}-${generateRandomAlphaNumeric(10)}`;
};

const findCourseDocumentByIdentifier = async (
	courseId: string,
): Promise<(MongoCourse & { _id: ObjectId }) | null> => {
	const db = await connectToDatabase();
	initCourseCollection(db);
	const courseCollection = getCourseCollection();

	const isObjectId = ObjectId.isValid(courseId);
	const normalizedCourseId = courseId.trim().toLowerCase();

	const identityFilter = isObjectId
		? { _id: new ObjectId(courseId) }
		: {
				$or: [
					{ courseId: courseId.toUpperCase() },
					{ courseId },
					{ slug: normalizedCourseId },
					{
						title: {
							$regex: `^${normalizedCourseId.replace(/[-\s]+/g, "[-\\s]")}$`,
							$options: "i",
						},
					},
				],
			};

	const course = await courseCollection.findOne({
		$and: [identityFilter, mongoCourseActiveFilter],
	});

	if (!course || !course._id) {
		return null;
	}

	return course as MongoCourse & { _id: ObjectId };
};

export const createCourse = async (payload: CourseInputDTO): Promise<CourseDTO> => {
	const db = await connectToDatabase();
	initCourseCollection(db);
	const courseCollection = getCourseCollection();

	const generatedCourseId = await generateUniqueCourseId(payload.title);
	const normalizedCourse = prepareCourseForPersistence(payload, generatedCourseId);
	logPreparedCourseDocument("insertOne document", {
		courseId: normalizedCourse.courseId,
		isRecommended: normalizedCourse.isRecommended,
		meta: normalizedCourse.meta,
	});
	const result = await courseCollection.insertOne(normalizedCourse as MongoCourse);

	const insertedCourse: MongoCourse & { _id: ObjectId } = {
		...normalizedCourse,
		_id: result.insertedId,
	};

	return mapMongoCourseToDTO(insertedCourse);
};

export const updateCourse = async (courseId: string, payload: CourseInputDTO): Promise<CourseDTO | null> => {
	const existing = await findCourseDocumentByIdentifier(courseId);
	if (!existing || !existing._id) {
		return null;
	}

	const db = await connectToDatabase();
	initCourseCollection(db);
	const courseCollection = getCourseCollection();

	const slug = payload.slug ? slugify(payload.slug) : slugify(payload.title);
	const now = new Date();
	const instructionalLanguages = normalizeInstructionalLanguages(payload.instructionalLanguages);
	const units = normalizeUnitsFromPayload(payload.units ?? []);
	assertMandarinFieldsComplete(units, instructionalLanguages);

	const mergedMetaRaw: Partial<CourseMetaDTO> | undefined =
		payload.meta !== undefined && payload.meta !== null
			? { ...(existing.meta ?? {}), ...payload.meta }
			: existing.meta ?? undefined;
	const nextMeta = pickMetaForPersistence(mergedMetaRaw);

	const isRecommended = payload.isRecommended;
	const isSoldOut =
		typeof payload.isSoldOut === "boolean" ? payload.isSoldOut : (existing.isSoldOut ?? false);

	const { targets, target } = normalizeCourseTargetsFromPayload(payload);
	if (targets.length === 0) {
		throw new CourseValidationError("Select at least one target audience.");
	}

	logPreparedCourseDocument("updateOne $set", {
		courseId: existing.courseId,
		isRecommended,
		meta: nextMeta,
	});

	const setFields: Record<string, unknown> = {
		title: payload.title,
		slug,
		summary: payload.summary,
		instructionalLanguages,
		deliveryMode: payload.deliveryMode ?? existing.deliveryMode ?? "online",
		isRecommended,
		isSoldOut,
		maxEnrollments: payload.maxEnrollments,
		recommendedSessionsPerWeek: payload.recommendedSessionsPerWeek,
		sessionCount: payload.sessionCount,
		targets,
		target,
		category: payload.category,
		tags: payload.tags,
		thumbnailUrl: payload.thumbnailUrl,
		units,
		pricing: payload.pricing !== undefined ? payload.pricing : existing.pricing,
		updatedAt: now,
	};

	if (nextMeta != null) {
		setFields.meta = nextMeta;
	}

	await courseCollection.updateOne({ _id: existing._id }, { $set: setFields });

	const updated = await findCourseDocumentByIdentifier(existing.courseId ?? courseId);
	if (!updated || !updated._id) {
		return null;
	}

	return mapMongoCourseToDTO(updated);
};

export const getCourses = async (): Promise<CourseDTO[]> => {
	const db = await connectToDatabase();
	initCourseCollection(db);
	const courseCollection = getCourseCollection();

	const courses = await courseCollection.find(mongoCourseActiveFilter).sort({ createdAt: -1 }).toArray();

	return courses
		.filter((course): course is MongoCourse & { _id: ObjectId } => Boolean(course._id))
		.map(mapMongoCourseToDTO);
};

export const getCourseById = async (courseId: string): Promise<CourseDTO | null> => {
	const course = await findCourseDocumentByIdentifier(courseId);
	if (!course) {
		return null;
	}

	return mapMongoCourseToDTO(course);
};

export const addCourseReview = async (courseId: string, payload: CourseReviewInputDTO): Promise<CourseReviewDTO | null> => {
	const db = await connectToDatabase();
	initCourseCollection(db);
	const courseCollection = getCourseCollection();

	const course = await findCourseDocumentByIdentifier(courseId);
	if (!course) {
		return null;
	}

	const newReview = normalizeReview(payload);
	const existingReviews = (course.reviews ?? []) as MongoCourseReview[];
	const reviews = [newReview, ...existingReviews];
	const reviewSummary = calculateReviewSummary(reviews);

	await courseCollection.updateOne(
		{ _id: new ObjectId(course._id) },
		{
			$set: {
				reviews,
				reviewSummary,
				updatedAt: new Date(),
			},
		},
	);

	return mapMongoReviewToDTO(newReview);
};

export const getCourseReviews = async (
	courseId: string,
): Promise<{ reviews: CourseReviewDTO[]; reviewSummary: CourseReviewSummaryDTO } | null> => {
	const course = await findCourseDocumentByIdentifier(courseId);
	if (!course) {
		return null;
	}

	const reviews = (course.reviews ?? []).map(mapMongoReviewToDTO);
	return {
		reviews,
		reviewSummary: course.reviewSummary ?? calculateReviewSummary(course.reviews),
	};
};

export const deleteCourse = async (courseId: string): Promise<boolean> => {
	const course = await findCourseDocumentByIdentifier(courseId);
	if (!course) {
		return false;
	}

	const db = await connectToDatabase();
	initCourseCollection(db);
	const courseCollection = getCourseCollection();

	const now = new Date();
	const result = await courseCollection.updateOne(
		{
			$and: [{ _id: new ObjectId(course._id) }, mongoCourseActiveFilter],
		},
		{
			$set: { deletedAt: now, updatedAt: now },
		},
	);

	return result.modifiedCount === 1;
};

export type CourseLearnerMetricsDTO = {
	resolvedCourseId: string;
	title: string;
	slug?: string;
	/** Users with at least one enrollment row for this course (any status). */
	usersWithEnrollment: number;
	/** Users with a non-revoked enrollment for this course. */
	usersWithActiveEnrollment: number;
	/** Users with any purchase record for this course (including refunded/revoked lines). */
	usersWithPurchaseRecord: number;
	/** Users with an active purchase line (not refunded/revoked; succeeded or unset payment). */
	usersWithActivePurchaseAccess: number;
	cohortCount: number;
	cohortSeatsReserved: number;
};

const courseIdAliasesForUserMatching = (course: MongoCourse & { _id: ObjectId }): string[] => {
	const ids = new Set<string>();
	ids.add(course._id.toHexString());
	if (course.courseId) {
		ids.add(course.courseId);
		ids.add(course.courseId.toUpperCase());
		ids.add(course.courseId.toLowerCase());
	}
	if (typeof course.slug === "string" && course.slug.trim()) {
		const s = course.slug.trim();
		ids.add(s);
		ids.add(s.toLowerCase());
	}
	return [...ids];
};

export const getCourseLearnerMetrics = async (courseIdParam: string): Promise<CourseLearnerMetricsDTO | null> => {
	const course = await findCourseDocumentByIdentifier(courseIdParam);
	if (!course || !course._id) {
		return null;
	}

	const aliases = courseIdAliasesForUserMatching(course);
	const resolvedCourseId = course.courseId ?? course._id.toHexString();

	const db = await connectToDatabase();
	initUserCollection(db);
	const usersCollection = getUserCollection();

	const [
		usersWithEnrollment,
		usersWithActiveEnrollment,
		usersWithPurchaseRecord,
		usersWithActivePurchaseAccess,
	] = await Promise.all([
		usersCollection.countDocuments({
			enrollments: { $elemMatch: { courseId: { $in: aliases } } },
		}),
		usersCollection.countDocuments({
			enrollments: {
				$elemMatch: {
					courseId: { $in: aliases },
					$or: [{ status: { $exists: false } }, { status: { $nin: ["revoked"] } }],
				},
			},
		}),
		usersCollection.countDocuments({
			purchasedCourses: { $elemMatch: { courseId: { $in: aliases } } },
		}),
		usersCollection.countDocuments({
			purchasedCourses: {
				$elemMatch: {
					courseId: { $in: aliases },
					accessStatus: { $nin: ["refunded", "revoked"] },
					$or: [{ paymentStatus: "succeeded" }, { paymentStatus: { $exists: false } }, { paymentStatus: null }],
				},
			},
		}),
	]);

	const cohorts = await listCohortsByCourse(resolvedCourseId);
	const cohortSeatsReserved = cohorts.reduce((sum, c) => sum + (c.enrollmentCount ?? 0), 0);

	return {
		resolvedCourseId,
		title: course.title ?? resolvedCourseId,
		slug: typeof course.slug === "string" ? course.slug : undefined,
		usersWithEnrollment,
		usersWithActiveEnrollment,
		usersWithPurchaseRecord,
		usersWithActivePurchaseAccess,
		cohortCount: cohorts.length,
		cohortSeatsReserved,
	};
};
