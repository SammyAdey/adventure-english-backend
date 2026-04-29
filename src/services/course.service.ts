// /src/services/course.service.ts

import { randomInt } from "crypto";
import { ObjectId } from "mongodb";
import {
	CourseDTO,
	CourseInputDTO,
	CourseReviewDTO,
	CourseReviewInputDTO,
	CourseReviewSummaryDTO,
	MongoCourse,
	MongoCourseReview,
} from "../dto/courses.dto";
import { initCourseCollection, getCourseCollection } from "../models/course.model";
import { connectToDatabase } from "../utils/mongo";

const slugify = (value: string): string =>
	value
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");

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

const normalizeCoursePayload = (payload: CourseInputDTO, courseId: string): Omit<MongoCourse, "_id"> => {
	const now = new Date();
	const reviews = (payload.reviews ?? []).map((review) => normalizeReview(review));
	const slug = payload.slug ? slugify(payload.slug) : slugify(payload.title);

	return {
		...payload,
		courseId,
		slug,
		deliveryMode: payload.deliveryMode ?? "online",
		isSoldOut: payload.isSoldOut ?? false,
		reviews,
		reviewSummary: calculateReviewSummary(reviews),
		units: (payload.units ?? []).map((unit, unitIndex) => ({
			...unit,
			order: unit.order ?? unitIndex,
			videos: unit.videos.map((video, videoIndex) => ({
				...video,
				order: video.order ?? videoIndex,
				isPreviewAvailable: video.isPreviewAvailable ?? false,
			})),
			questions: unit.questions?.map((question) => ({
				...question,
			})),
		})),
		meta: payload.meta,
		pricing: payload.pricing,
		createdAt: now,
		updatedAt: now,
	};
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

const mapMongoCourseToDTO = (course: MongoCourse & { _id: ObjectId }): CourseDTO => ({
	id: course.courseId ?? course._id.toHexString(),
	courseId: course.courseId,
	title: course.title,
	slug: course.slug,
	summary: course.summary,
	target: (course as MongoCourse & { level?: string }).target ?? (course as MongoCourse & { level?: string }).level,
	category: course.category,
	tags: course.tags,
	thumbnailUrl: course.thumbnailUrl,
	units: course.units,
	meta: course.meta,
	pricing: course.pricing,
	reviews: (course.reviews ?? []).map(mapMongoReviewToDTO),
	reviewSummary: course.reviewSummary ?? calculateReviewSummary(course.reviews),
	createdAt: course.createdAt,
	updatedAt: course.updatedAt,
});

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

	const course = await courseCollection.findOne(
		isObjectId
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
				},
	);

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
	const normalizedCourse = normalizeCoursePayload(payload, generatedCourseId);
	const result = await courseCollection.insertOne(normalizedCourse as MongoCourse);

	const insertedCourse: MongoCourse & { _id: ObjectId } = {
		...normalizedCourse,
		_id: result.insertedId,
	};

	return mapMongoCourseToDTO(insertedCourse);
};

export const getCourses = async (): Promise<CourseDTO[]> => {
	const db = await connectToDatabase();
	initCourseCollection(db);
	const courseCollection = getCourseCollection();

	const courses = await courseCollection.find({}).sort({ createdAt: -1 }).toArray();

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

	const result = await courseCollection.deleteOne({
		_id: new ObjectId(course._id),
	});

	return result.deletedCount === 1;
};
