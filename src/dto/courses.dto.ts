// /src/dto/courses.dto.ts

export type CourseDeliveryMode = "online" | "in_person";

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

export interface CourseVideoDTO {
	title: string;
	description?: string;
	videoUrl: string;
	/** Localized lesson titles; legacy `title` is canonical English when absent. */
	titles?: LocalizedTitlesDTO;
	/** Per-language video URLs; legacy `videoUrl` is canonical English when absent. */
	videoUrls?: LocalizedVideoUrlsDTO;
	order?: number;
	durationInSeconds?: number;
	isPreviewAvailable?: boolean;
}

export interface CourseQuestionDTO {
	prompt: string;
	type?: "multiple-choice" | "short-answer" | "true-false";
	options?: string[];
	answer?: string;
	explanation?: string;
}

export interface CourseUnitDTO {
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
	slug?: string;
	summary?: string;
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
	meta?: CourseMetaDTO;
	pricing?: CoursePricingDTO;
	reviews?: CourseReviewInputDTO[];
}

export interface CourseDTO extends CourseInputDTO {
	id: string;
	courseId?: string;
	createdAt: Date;
	updatedAt: Date;
	reviews: CourseReviewDTO[];
	reviewSummary: CourseReviewSummaryDTO;
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
