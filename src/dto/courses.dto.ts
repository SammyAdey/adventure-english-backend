// /src/dto/courses.dto.ts

export type CourseDeliveryMode = "online" | "in_person";

export interface CourseVideoDTO {
	title: string;
	description?: string;
	videoUrl: string;
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
	deliveryMode?: CourseDeliveryMode;
	isSoldOut?: boolean;
	maxEnrollments?: number;
	recommendedSessionsPerWeek?: number;
	sessionCount?: number;
	target?: string;
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
}
