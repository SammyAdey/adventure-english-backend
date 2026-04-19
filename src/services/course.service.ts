// /src/services/course.service.ts

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

const normalizeCoursePayload = (payload: CourseInputDTO): Omit<MongoCourse, "_id"> => {
	const now = new Date();
	const reviews = (payload.reviews ?? []).map((review) => normalizeReview(review));

	return {
		...payload,
		reviews,
		reviewSummary: calculateReviewSummary(reviews),
		units: payload.units.map((unit, unitIndex) => ({
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
	id: course._id.toHexString(),
	title: course.title,
	summary: course.summary,
	level: course.level,
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

export const createCourse = async (payload: CourseInputDTO): Promise<CourseDTO> => {
	const db = await connectToDatabase();
	initCourseCollection(db);
	const courseCollection = getCourseCollection();

	const normalizedCourse = normalizeCoursePayload(payload);
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
	if (!ObjectId.isValid(courseId)) {
		return null;
	}

	const db = await connectToDatabase();
	initCourseCollection(db);
	const courseCollection = getCourseCollection();

	const course = await courseCollection.findOne({
		_id: new ObjectId(courseId),
	});

	if (!course || !course._id) {
		return null;
	}

	return mapMongoCourseToDTO(course as MongoCourse & { _id: ObjectId });
};

export const addCourseReview = async (courseId: string, payload: CourseReviewInputDTO): Promise<CourseReviewDTO | null> => {
	if (!ObjectId.isValid(courseId)) {
		return null;
	}

	const db = await connectToDatabase();
	initCourseCollection(db);
	const courseCollection = getCourseCollection();

	const course = await courseCollection.findOne({ _id: new ObjectId(courseId) });
	if (!course) {
		return null;
	}

	const newReview = normalizeReview(payload);
	const existingReviews = (course.reviews ?? []) as MongoCourseReview[];
	const reviews = [newReview, ...existingReviews];
	const reviewSummary = calculateReviewSummary(reviews);

	await courseCollection.updateOne(
		{ _id: new ObjectId(courseId) },
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

export const deleteCourse = async (courseId: string): Promise<boolean> => {
	if (!ObjectId.isValid(courseId)) {
		return false;
	}

	const db = await connectToDatabase();
	initCourseCollection(db);
	const courseCollection = getCourseCollection();

	const result = await courseCollection.deleteOne({
		_id: new ObjectId(courseId),
	});

	return result.deletedCount === 1;
};
