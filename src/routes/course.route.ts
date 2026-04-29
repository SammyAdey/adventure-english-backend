import { FastifyInstance, FastifyRequest } from "fastify";
import { CourseInputDTO } from "../dto/courses.dto";
import { getUserByEmail } from "../services/user.service";
import { addCourseReview, createCourse, deleteCourse, getCourseById, getCourseReviews, getCourses } from "../services/course.service";
import { requireRole, verifyAuthToken } from "../utils/auth";

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
} as const;

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
} as const;

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
} as const;

const createCourseSchema = {
	body: {
		type: "object",
		required: ["title"],
		additionalProperties: false,
		properties: {
			title: { type: "string", minLength: 1 },
			slug: { type: "string", minLength: 1 },
			summary: { type: "string" },
			deliveryMode: {
				type: "string",
				enum: ["online", "in_person"],
			},
			isSoldOut: { type: "boolean" },
			maxEnrollments: { type: "integer", minimum: 1 },
			recommendedSessionsPerWeek: { type: "integer", minimum: 1 },
			sessionCount: { type: "integer", minimum: 1 },
			target: { type: "string", minLength: 1 },
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
} as const;

const courseResponseSchema = {
	type: "object",
	required: ["id", "title", "units", "createdAt", "updatedAt", "reviews", "reviewSummary"],
	additionalProperties: false,
	properties: {
		id: { type: "string" },
		title: { type: "string" },
		slug: { type: "string" },
		summary: { type: "string" },
		deliveryMode: {
			type: "string",
			enum: ["online", "in_person"],
		},
		isSoldOut: { type: "boolean" },
		maxEnrollments: { type: "integer" },
		recommendedSessionsPerWeek: { type: "integer" },
		sessionCount: { type: "integer" },
		target: { type: "string" },
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
} as const;

const courseIdParamSchema = {
	type: "object",
	required: ["courseId"],
	properties: {
		courseId: { type: "string", minLength: 1 },
	},
} as const;

const errorResponseSchema = {
	type: "object",
	required: ["message"],
	properties: {
		message: { type: "string" },
		error: { type: "string" },
	},
	additionalProperties: true,
} as const;

const courseReviewInputSchema = {
	type: "object",
	required: ["rating", "comment"],
	additionalProperties: false,
	properties: {
		reviewerName: { type: "string", minLength: 1 },
		rating: { type: "number", minimum: 1, maximum: 5 },
		comment: { type: "string", minLength: 1 },
		headline: { type: "string" },
		avatarUrl: { type: "string" },
	},
} as const;

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
} as const;

const courseReviewListResponseSchema = {
	type: "object",
	required: ["reviews", "reviewSummary"],
	additionalProperties: false,
	properties: {
		reviews: {
			type: "array",
			items: courseReviewResponseSchema,
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
	},
} as const;

const getEmailFromAuthHeader = (request: FastifyRequest, app: FastifyInstance): string | null => {
	const decoded = verifyAuthToken(app, request);
	return decoded?.email ?? null;
};

export default async function courseRoutes(app: FastifyInstance) {
	app.post(
		"/courses",
		{
			schema: createCourseSchema,
		},
		async (request: FastifyRequest<{ Body: CourseInputDTO }>, reply) => {
			try {
				const roleContext = await requireRole(app, request, reply, ["admin", "instructor"]);
				if (!roleContext) return;
				const createdCourse = await createCourse(request.body);
				return reply.code(201).send(createdCourse);
			} catch (error) {
				app.log.error({ err: error }, "Failed to create course");
				return reply
					.status(500)
					.send({ message: "Failed to create course", error: "COURSE_CREATION_FAILED" });
				}
			},
		);

	app.get(
		"/courses",
		{
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
		},
		async (_request, reply) => {
			try {
				const courses = await getCourses();
				return reply.send({ courses });
			} catch (error) {
				app.log.error({ err: error }, "Failed to list courses");
				return reply
					.status(500)
					.send({ message: "Failed to list courses", error: "COURSE_LIST_FAILED" });
			}
		},
	);

	app.get(
		"/courses/:courseId",
		{
			schema: {
				params: courseIdParamSchema,
				response: {
					200: courseResponseSchema,
					404: errorResponseSchema,
					500: errorResponseSchema,
				},
			},
		},
		async (request: FastifyRequest<{ Params: { courseId: string } }>, reply) => {
			try {
				const course = await getCourseById(request.params.courseId);
				if (!course) {
					return reply.status(404).send({ message: "Course not found" });
				}

				return reply.send(course);
			} catch (error) {
				app.log.error({ err: error }, "Failed to fetch course");
				return reply
					.status(500)
					.send({ message: "Failed to fetch course", error: "COURSE_FETCH_FAILED" });
			}
		},
	);

	app.delete(
		"/courses/:courseId",
		{
			schema: {
				params: courseIdParamSchema,
				response: {
					204: { type: "null" },
					404: errorResponseSchema,
					500: errorResponseSchema,
				},
			},
		},
		async (request: FastifyRequest<{ Params: { courseId: string } }>, reply) => {
			try {
				const roleContext = await requireRole(app, request, reply, ["admin", "instructor"]);
				if (!roleContext) return;
				const success = await deleteCourse(request.params.courseId);
				if (!success) {
					return reply.status(404).send({ message: "Course not found" });
				}

				return reply.status(204).send();
			} catch (error) {
				app.log.error({ err: error }, "Failed to delete course");
				return reply.status(500).send({ message: "Failed to delete course", error: "COURSE_DELETE_FAILED" });
			}
		},
	);

	app.get(
		"/courses/:courseId/reviews",
		{
			schema: {
				params: courseIdParamSchema,
				response: {
					200: courseReviewListResponseSchema,
					404: errorResponseSchema,
					500: errorResponseSchema,
				},
			},
		},
		async (request: FastifyRequest<{ Params: { courseId: string } }>, reply) => {
			try {
				const reviews = await getCourseReviews(request.params.courseId);
				if (!reviews) {
					return reply.status(404).send({ message: "Course not found" });
				}
				return reply.send(reviews);
			} catch (error) {
				app.log.error({ err: error }, "Failed to fetch course reviews");
				return reply.status(500).send({ message: "Failed to fetch reviews", error: "COURSE_REVIEW_LIST_FAILED" });
			}
		},
	);

	app.post(
		"/courses/:courseId/reviews",
		{
			schema: {
				params: courseIdParamSchema,
				body: courseReviewInputSchema,
				response: {
					201: courseReviewResponseSchema,
					404: errorResponseSchema,
					500: errorResponseSchema,
				},
			},
		},
		async (
			request: FastifyRequest<{
				Params: { courseId: string };
				Body: { reviewerName?: string; rating: number; comment: string; headline?: string; avatarUrl?: string };
			}>,
			reply,
		) => {
			try {
				const tokenEmail = getEmailFromAuthHeader(request, app);
				const authUser = tokenEmail ? await getUserByEmail(tokenEmail) : null;
				const fallbackName = authUser
					? `${authUser.firstName} ${authUser.lastName}`.trim() || authUser.email
					: tokenEmail
						? tokenEmail.split("@")[0]
						: "Anonymous learner";
				const created = await addCourseReview(request.params.courseId, {
					...request.body,
					reviewerName: request.body.reviewerName?.trim() || fallbackName,
				});
				if (!created) {
					return reply.status(404).send({ message: "Course not found" });
				}
				return reply.status(201).send(created);
			} catch (error) {
				app.log.error({ err: error }, "Failed to add course review");
				return reply.status(500).send({ message: "Failed to add review", error: "COURSE_REVIEW_FAILED" });
			}
		},
	);
}
