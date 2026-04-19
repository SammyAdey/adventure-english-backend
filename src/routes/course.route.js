"use strict";
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
exports.default = courseRoutes;
const course_service_1 = require("../services/course.service");
const courseQuestionSchema = {
    type: "object",
    required: ["prompt"],
    additionalProperties: false,
    properties: {
        prompt: { type: "string", minLength: 1 },
        type: {
            type: "string",
            enum: ["multiple-choice", "short-answer", "true-false"],
        },
        options: {
            type: "array",
            items: { type: "string" },
        },
        answer: { type: "string" },
        explanation: { type: "string" },
    },
};
const courseVideoSchema = {
    type: "object",
    required: ["title", "videoUrl"],
    additionalProperties: false,
    properties: {
        title: { type: "string", minLength: 1 },
        description: { type: "string" },
        videoUrl: { type: "string", minLength: 1 },
        order: { type: "integer", minimum: 0 },
        durationInSeconds: { type: "integer", minimum: 0 },
        isPreviewAvailable: { type: "boolean" },
    },
};
const courseUnitSchema = {
    type: "object",
    required: ["title", "videos"],
    additionalProperties: false,
    properties: {
        title: { type: "string", minLength: 1 },
        description: { type: "string" },
        order: { type: "integer", minimum: 0 },
        videos: {
            type: "array",
            minItems: 1,
            items: courseVideoSchema,
        },
        questions: {
            type: "array",
            items: courseQuestionSchema,
        },
    },
};
const createCourseSchema = {
    body: {
        type: "object",
        required: ["title", "units"],
        additionalProperties: false,
        properties: {
            title: { type: "string", minLength: 1 },
            summary: { type: "string" },
            level: {
                type: "string",
                enum: ["beginner", "intermediate", "advanced"],
            },
            category: { type: "string" },
            tags: {
                type: "array",
                items: { type: "string" },
            },
            thumbnailUrl: { type: "string" },
            units: {
                type: "array",
                minItems: 1,
                items: courseUnitSchema,
            },
            meta: {
                type: "object",
                additionalProperties: false,
                properties: {
                    badge: { type: "string" },
                    studentCount: { type: "integer", minimum: 0 },
                    audioLanguages: {
                        type: "array",
                        items: { type: "string" },
                    },
                    subtitleLanguages: {
                        type: "array",
                        items: { type: "string" },
                    },
                    lessonsCount: { type: "integer", minimum: 0 },
                    downloadsCount: { type: "integer", minimum: 0 },
                    exercisesCount: { type: "integer", minimum: 0 },
                    durationInMinutes: { type: "integer", minimum: 0 },
                    includes: {
                        type: "array",
                        items: { type: "string" },
                    },
                },
            },
            pricing: {
                type: "object",
                additionalProperties: false,
                required: ["currency", "price"],
                properties: {
                    currency: { type: "string", minLength: 1 },
                    price: { type: "number", minimum: 0 },
                    originalPrice: { type: "number", minimum: 0 },
                    message: { type: "string" },
                    giftAvailable: { type: "boolean" },
                },
            },
            reviews: {
                type: "array",
                items: {
                    type: "object",
                    required: ["reviewerName", "rating", "comment"],
                    additionalProperties: false,
                    properties: {
                        reviewerName: { type: "string", minLength: 1 },
                        rating: { type: "number", minimum: 1, maximum: 5 },
                        comment: { type: "string", minLength: 1 },
                        headline: { type: "string" },
                        avatarUrl: { type: "string" },
                    },
                },
            },
        },
    },
};
const courseResponseSchema = {
    type: "object",
    required: ["id", "title", "units", "createdAt", "updatedAt", "reviews", "reviewSummary"],
    additionalProperties: false,
    properties: {
        id: { type: "string" },
        title: { type: "string" },
        summary: { type: "string" },
        level: {
            type: "string",
            enum: ["beginner", "intermediate", "advanced"],
        },
        category: { type: "string" },
        tags: {
            type: "array",
            items: { type: "string" },
        },
        thumbnailUrl: { type: "string" },
        units: {
            type: "array",
            items: courseUnitSchema,
        },
        meta: {
            type: "object",
            properties: {
                badge: { type: "string" },
                studentCount: { type: "integer" },
                audioLanguages: {
                    type: "array",
                    items: { type: "string" },
                },
                subtitleLanguages: {
                    type: "array",
                    items: { type: "string" },
                },
                lessonsCount: { type: "integer" },
                downloadsCount: { type: "integer" },
                exercisesCount: { type: "integer" },
                durationInMinutes: { type: "integer" },
                includes: {
                    type: "array",
                    items: { type: "string" },
                },
            },
            additionalProperties: false,
        },
        pricing: {
            type: "object",
            properties: {
                currency: { type: "string" },
                price: { type: "number" },
                originalPrice: { type: "number" },
                message: { type: "string" },
                giftAvailable: { type: "boolean" },
            },
            additionalProperties: false,
        },
        reviews: {
            type: "array",
            items: {
                type: "object",
                required: ["id", "reviewerName", "rating", "comment", "createdAt"],
                additionalProperties: false,
                properties: {
                    id: { type: "string" },
                    reviewerName: { type: "string" },
                    rating: { type: "number" },
                    comment: { type: "string" },
                    headline: { type: "string" },
                    avatarUrl: { type: "string" },
                    createdAt: { type: "string" },
                },
            },
        },
        reviewSummary: {
            type: "object",
            required: ["averageRating", "ratingCount", "positivePercentage"],
            additionalProperties: false,
            properties: {
                averageRating: { type: "number" },
                ratingCount: { type: "integer" },
                positivePercentage: { type: "integer" },
            },
        },
        createdAt: { type: "string" },
        updatedAt: { type: "string" },
    },
};
const courseIdParamSchema = {
    type: "object",
    required: ["courseId"],
    properties: {
        courseId: { type: "string", minLength: 24, maxLength: 24 },
    },
};
const errorResponseSchema = {
    type: "object",
    required: ["message"],
    properties: {
        message: { type: "string" },
        error: { type: "string" },
    },
    additionalProperties: true,
};
const courseReviewInputSchema = {
    type: "object",
    required: ["reviewerName", "rating", "comment"],
    additionalProperties: false,
    properties: {
        reviewerName: { type: "string", minLength: 1 },
        rating: { type: "number", minimum: 1, maximum: 5 },
        comment: { type: "string", minLength: 1 },
        headline: { type: "string" },
        avatarUrl: { type: "string" },
    },
};
const courseReviewResponseSchema = {
    type: "object",
    required: ["id", "reviewerName", "rating", "comment", "createdAt"],
    additionalProperties: false,
    properties: {
        id: { type: "string" },
        reviewerName: { type: "string" },
        rating: { type: "number" },
        comment: { type: "string" },
        headline: { type: "string" },
        avatarUrl: { type: "string" },
        createdAt: { type: "string" },
    },
};
function courseRoutes(app) {
    return __awaiter(this, void 0, void 0, function* () {
        app.post("/courses", {
            schema: createCourseSchema,
        }, (request, reply) => __awaiter(this, void 0, void 0, function* () {
            try {
                const createdCourse = yield (0, course_service_1.createCourse)(request.body);
                return reply.code(201).send(createdCourse);
            }
            catch (error) {
                app.log.error({ err: error }, "Failed to create course");
                return reply
                    .status(500)
                    .send({ message: "Failed to create course", error: "COURSE_CREATION_FAILED" });
            }
        }));
        app.get("/courses", {
            schema: {
                response: {
                    200: {
                        type: "object",
                        properties: {
                            courses: {
                                type: "array",
                                items: courseResponseSchema,
                            },
                        },
                        required: ["courses"],
                    },
                    500: errorResponseSchema,
                },
            },
        }, (_request, reply) => __awaiter(this, void 0, void 0, function* () {
            try {
                const courses = yield (0, course_service_1.getCourses)();
                return reply.send({ courses });
            }
            catch (error) {
                app.log.error({ err: error }, "Failed to list courses");
                return reply
                    .status(500)
                    .send({ message: "Failed to list courses", error: "COURSE_LIST_FAILED" });
            }
        }));
        app.get("/courses/:courseId", {
            schema: {
                params: courseIdParamSchema,
                response: {
                    200: courseResponseSchema,
                    404: errorResponseSchema,
                    500: errorResponseSchema,
                },
            },
        }, (request, reply) => __awaiter(this, void 0, void 0, function* () {
            try {
                const course = yield (0, course_service_1.getCourseById)(request.params.courseId);
                if (!course) {
                    return reply.status(404).send({ message: "Course not found" });
                }
                return reply.send(course);
            }
            catch (error) {
                app.log.error({ err: error }, "Failed to fetch course");
                return reply
                    .status(500)
                    .send({ message: "Failed to fetch course", error: "COURSE_FETCH_FAILED" });
            }
        }));
        app.delete("/courses/:courseId", {
            schema: {
                params: courseIdParamSchema,
                response: {
                    204: { type: "null" },
                    404: errorResponseSchema,
                    500: errorResponseSchema,
                },
            },
        }, (request, reply) => __awaiter(this, void 0, void 0, function* () {
            try {
                const success = yield (0, course_service_1.deleteCourse)(request.params.courseId);
                if (!success) {
                    return reply.status(404).send({ message: "Course not found" });
                }
                return reply.status(204).send();
            }
            catch (error) {
                app.log.error({ err: error }, "Failed to delete course");
                return reply.status(500).send({ message: "Failed to delete course", error: "COURSE_DELETE_FAILED" });
            }
        }));
        app.post("/courses/:courseId/reviews", {
            schema: {
                params: courseIdParamSchema,
                body: courseReviewInputSchema,
                response: {
                    201: courseReviewResponseSchema,
                    404: errorResponseSchema,
                    500: errorResponseSchema,
                },
            },
        }, (request, reply) => __awaiter(this, void 0, void 0, function* () {
            try {
                const created = yield (0, course_service_1.addCourseReview)(request.params.courseId, request.body);
                if (!created) {
                    return reply.status(404).send({ message: "Course not found" });
                }
                return reply.status(201).send(created);
            }
            catch (error) {
                app.log.error({ err: error }, "Failed to add course review");
                return reply.status(500).send({ message: "Failed to add review", error: "COURSE_REVIEW_FAILED" });
            }
        }));
    });
}
