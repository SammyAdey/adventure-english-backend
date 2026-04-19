"use strict";
// /src/services/course.service.ts
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteCourse = exports.addCourseReview = exports.getCourseById = exports.getCourses = exports.createCourse = void 0;
const mongodb_1 = require("mongodb");
const course_model_1 = require("../models/course.model");
const mongo_1 = require("../utils/mongo");
const clampRating = (rating) => {
    if (Number.isNaN(rating))
        return 5;
    return Math.min(5, Math.max(1, rating));
};
const normalizeReview = (review) => ({
    reviewerName: review.reviewerName,
    rating: clampRating(review.rating),
    comment: review.comment,
    headline: review.headline,
    avatarUrl: review.avatarUrl,
    createdAt: new Date(),
    _id: new mongodb_1.ObjectId(),
});
const calculateReviewSummary = (reviews = []) => {
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
const normalizeCoursePayload = (payload) => {
    var _a;
    const now = new Date();
    const reviews = ((_a = payload.reviews) !== null && _a !== void 0 ? _a : []).map((review) => normalizeReview(review));
    return Object.assign(Object.assign({}, payload), { reviews, reviewSummary: calculateReviewSummary(reviews), units: payload.units.map((unit, unitIndex) => {
            var _a, _b;
            return (Object.assign(Object.assign({}, unit), { order: (_a = unit.order) !== null && _a !== void 0 ? _a : unitIndex, videos: unit.videos.map((video, videoIndex) => {
                    var _a, _b;
                    return (Object.assign(Object.assign({}, video), { order: (_a = video.order) !== null && _a !== void 0 ? _a : videoIndex, isPreviewAvailable: (_b = video.isPreviewAvailable) !== null && _b !== void 0 ? _b : false }));
                }), questions: (_b = unit.questions) === null || _b === void 0 ? void 0 : _b.map((question) => (Object.assign({}, question))) }));
        }), meta: payload.meta, pricing: payload.pricing, createdAt: now, updatedAt: now });
};
const mapMongoReviewToDTO = (review) => {
    var _a;
    return ({
        id: review._id ? review._id.toHexString() : new mongodb_1.ObjectId().toHexString(),
        reviewerName: review.reviewerName,
        rating: review.rating,
        comment: review.comment,
        headline: review.headline,
        avatarUrl: review.avatarUrl,
        createdAt: (_a = review.createdAt) !== null && _a !== void 0 ? _a : new Date(),
    });
};
const mapMongoCourseToDTO = (course) => {
    var _a, _b;
    return ({
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
        reviews: ((_a = course.reviews) !== null && _a !== void 0 ? _a : []).map(mapMongoReviewToDTO),
        reviewSummary: (_b = course.reviewSummary) !== null && _b !== void 0 ? _b : calculateReviewSummary(course.reviews),
        createdAt: course.createdAt,
        updatedAt: course.updatedAt,
    });
};
const createCourse = (payload) => __awaiter(void 0, void 0, void 0, function* () {
    const db = yield (0, mongo_1.connectToDatabase)();
    (0, course_model_1.initCourseCollection)(db);
    const courseCollection = (0, course_model_1.getCourseCollection)();
    const normalizedCourse = normalizeCoursePayload(payload);
    const result = yield courseCollection.insertOne(normalizedCourse);
    const insertedCourse = Object.assign(Object.assign({}, normalizedCourse), { _id: result.insertedId });
    return mapMongoCourseToDTO(insertedCourse);
});
exports.createCourse = createCourse;
const getCourses = () => __awaiter(void 0, void 0, void 0, function* () {
    const db = yield (0, mongo_1.connectToDatabase)();
    (0, course_model_1.initCourseCollection)(db);
    const courseCollection = (0, course_model_1.getCourseCollection)();
    const courses = yield courseCollection.find({}).sort({ createdAt: -1 }).toArray();
    return courses
        .filter((course) => Boolean(course._id))
        .map(mapMongoCourseToDTO);
});
exports.getCourses = getCourses;
const getCourseById = (courseId) => __awaiter(void 0, void 0, void 0, function* () {
    if (!mongodb_1.ObjectId.isValid(courseId)) {
        return null;
    }
    const db = yield (0, mongo_1.connectToDatabase)();
    (0, course_model_1.initCourseCollection)(db);
    const courseCollection = (0, course_model_1.getCourseCollection)();
    const course = yield courseCollection.findOne({
        _id: new mongodb_1.ObjectId(courseId),
    });
    if (!course || !course._id) {
        return null;
    }
    return mapMongoCourseToDTO(course);
});
exports.getCourseById = getCourseById;
const addCourseReview = (courseId, payload) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    if (!mongodb_1.ObjectId.isValid(courseId)) {
        return null;
    }
    const db = yield (0, mongo_1.connectToDatabase)();
    (0, course_model_1.initCourseCollection)(db);
    const courseCollection = (0, course_model_1.getCourseCollection)();
    const course = yield courseCollection.findOne({ _id: new mongodb_1.ObjectId(courseId) });
    if (!course) {
        return null;
    }
    const newReview = normalizeReview(payload);
    const existingReviews = ((_a = course.reviews) !== null && _a !== void 0 ? _a : []);
    const reviews = [newReview, ...existingReviews];
    const reviewSummary = calculateReviewSummary(reviews);
    yield courseCollection.updateOne({ _id: new mongodb_1.ObjectId(courseId) }, {
        $set: {
            reviews,
            reviewSummary,
            updatedAt: new Date(),
        },
    });
    return mapMongoReviewToDTO(newReview);
});
exports.addCourseReview = addCourseReview;
const deleteCourse = (courseId) => __awaiter(void 0, void 0, void 0, function* () {
    if (!mongodb_1.ObjectId.isValid(courseId)) {
        return false;
    }
    const db = yield (0, mongo_1.connectToDatabase)();
    (0, course_model_1.initCourseCollection)(db);
    const courseCollection = (0, course_model_1.getCourseCollection)();
    const result = yield courseCollection.deleteOne({
        _id: new mongodb_1.ObjectId(courseId),
    });
    return result.deletedCount === 1;
});
exports.deleteCourse = deleteCourse;
