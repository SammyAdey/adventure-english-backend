// /src/dto/courses.dto.ts

export type CourseDeliveryMode = "online" | "in_person";

/** How long online catalog access remains after purchase (in-person uses cohort `termEndsAt`). */
export type EnrollmentAccessPeriod = "lifetime" | "three_weeks" | "one_quarter" | "one_year";

export interface CourseCohortPurchaseOptionDTO {
	cohortId: string;
	name: string;
	termLabel?: string;
	termEndsAt?: Date;
}

/** Instructional track language; `zh` is Mandarin for localized titles and video assets. */
export type InstructionalLanguage = "en" | "zh";

export interface LocalizedTitlesDTO {
	en: string;
	zh?: string;
}

export interface LocalizedVideoUrlsDTO {
	en: string;
	zh?: string;
}

/** Marketing feature bullets per language; legacy `meta.features` is canonical English when absent. */
export interface LocalizedFeaturesDTO {
	en?: string[];
	zh?: string[];
}

export type CheckpointQuestionKind =
	| "multiple_choice"
	| "true_false"
	| "short_answer"
	| "select_all"
	| "ordering";

export type InteractiveCheckpointPlacement =
	| { mode: "after_unit"; unitId: string; order?: number }
	| { mode: "mid_video"; videoId: string; triggerAtSeconds: number; order?: number }
	| { mode: "after_video"; videoId: string; order?: number };

export interface InteractiveCheckpointDTO {
	id: string;
	questionKind: CheckpointQuestionKind;
	title?: string;
	explanation?: string;
	placement: InteractiveCheckpointPlacement;
	/** Authoring payload; validated server-side; answers stripped for public course APIs. */
	payload: Record<string, unknown>;
}

export interface CourseVideoDTO {
	/** Stable id for mid-video checkpoints and client keys; assigned when missing on save. */
	id?: string;
	title: string;
	description?: string;
	videoUrl: string;
	/** Cloudinary stream/public identifier used to issue secure short-lived playback URLs. */
	streamPublicId?: string;
	/** Localized lesson titles; legacy `title` is canonical English when absent. */
	titles?: LocalizedTitlesDTO;
	/** Per-language video URLs; legacy `videoUrl` is canonical English when absent. */
	videoUrls?: LocalizedVideoUrlsDTO;
	order?: number;
	durationInSeconds?: number;
	isPreviewAvailable?: boolean;
}

export interface CourseWorksheetDTO {
	id: string;
	title: string;
	/** Cloudinary public_id for raw PDF delivery/signing. */
	publicId: string;
	/** Optional preview URL (admin UX); learner downloads should use signed endpoint. */
	fileUrl?: string;
	fileName?: string;
	mimeType: "application/pdf";
	/** Omit or null for course-wide worksheet. */
	unitId?: string | null;
	order?: number;
}

export interface CourseQuestionDTO {
	prompt: string;
	type?: "multiple-choice" | "short-answer" | "true-false";
	options?: string[];
	answer?: string;
	explanation?: string;
}

export interface CourseUnitDTO {
	/** Stable id for worksheets and after-unit checkpoints; assigned when missing on save. */
	id?: string;
	title: string;
	description?: string;
	/** Localized unit titles; legacy `title` is canonical English when absent. */
	titles?: LocalizedTitlesDTO;
	order?: number;
	videos: CourseVideoDTO[];
	questions?: CourseQuestionDTO[];
}

export interface CourseMetaDTO {
	badge?: string;
	studentCount?: number;
	audioLanguages?: string[];
	subtitleLanguages?: string[];
	lessonsCount?: number;
	downloadsCount?: number;
	exercisesCount?: number;
	durationInMinutes?: number;
	includes?: string[];
	/** Short bullet points for marketing / course cards (separate from `includes` purchase perks). */
	features?: string[];
	/** Localized marketing bullets; legacy `features` is canonical English when absent. */
	featuresByLanguage?: LocalizedFeaturesDTO;
}

export interface CoursePricingDTO {
	currency: string;
	price: number;
	originalPrice?: number;
	message?: string;
	giftAvailable?: boolean;
}

export interface CourseReviewInputDTO {
	reviewerName: string;
	rating: number;
	comment: string;
	headline?: string;
	avatarUrl?: string;
}

export interface CourseReviewDTO extends CourseReviewInputDTO {
	id: string;
	createdAt: Date;
}

export interface CourseReviewSummaryDTO {
	averageRating: number;
	ratingCount: number;
	positivePercentage: number;
}

export interface CourseInputDTO {
	title: string;
	/** Localized display titles; legacy `title` is canonical English when absent. */
	titles?: LocalizedTitlesDTO;
	slug?: string;
	summary?: string;
	/** Localized summaries; legacy `summary` is canonical English when absent. */
	summaries?: LocalizedTitlesDTO;
	/** Languages instructional content is offered in (at least one of en, zh). */
	instructionalLanguages: InstructionalLanguage[];
	deliveryMode?: CourseDeliveryMode;
	/** Highlight on marketing surfaces when true. */
	isRecommended: boolean;
	isSoldOut?: boolean;
	maxEnrollments?: number;
	recommendedSessionsPerWeek?: number;
	sessionCount?: number;
	/** First segment; mirrors `targets[0]` when `targets` is set (legacy clients). */
	target?: string;
	/** Learner segments for this course (order preserved). */
	targets?: string[];
	category?: string;
	tags?: string[];
	thumbnailUrl?: string;
	units?: CourseUnitDTO[];
	worksheets?: CourseWorksheetDTO[];
	interactiveCheckpoints?: InteractiveCheckpointDTO[];
	meta?: CourseMetaDTO;
	pricing?: CoursePricingDTO;
	/** Online: access window after purchase. Ignored for `in_person` at checkout (cohort term applies). */
	enrollmentAccessPeriod?: EnrollmentAccessPeriod;
	reviews?: CourseReviewInputDTO[];
}

export interface CourseDTO extends CourseInputDTO {
	id: string;
	courseId?: string;
	createdAt: Date;
	updatedAt: Date;
	reviews: CourseReviewDTO[];
	reviewSummary: CourseReviewSummaryDTO;
	/** On public `GET /courses/:id` when `deliveryMode` is `in_person`: open cohorts for semester checkout. */
	cohortPurchaseOptions?: CourseCohortPurchaseOptionDTO[];
}

// This represents the MongoDB stored shape
export interface MongoCourseReview extends Omit<CourseReviewDTO, "id"> {
	_id?: import("mongodb").ObjectId;
}

// This represents the MongoDB stored shape
export interface MongoCourse extends Omit<CourseDTO, "id" | "reviews"> {
	_id?: import("mongodb").ObjectId;
	reviews?: MongoCourseReview[];
	/** When set, the course is soft-deleted and excluded from the public catalog. */
	deletedAt?: Date | null;
}
