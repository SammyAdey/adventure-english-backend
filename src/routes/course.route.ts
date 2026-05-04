import { FastifyInstance, FastifyRequest } from "fastify";
import type { LegacyInputRole } from "../dto/users.dto";
import { CourseInputDTO } from "../dto/courses.dto";
import { CourseValidationError } from "../services/course.service";
import { getUserByEmail, normalizeRole } from "../services/user.service";
import {
	addCourseReview,
	createCourse,
	deleteCourse,
	adminEnrollUserInCourse,
	getCourseById,
	getCourseEnrolledLearners,
	getCourseLearnerMetrics,
	getCourseReviews,
	getCourses,
	updateCourse,
} from "../services/course.service";
import { requireRole, verifyAuthToken } from "../utils/auth";
import { redactInteractiveCheckpointsOnCourse } from "../utils/interactive-checkpoint";
import { logCourseMutationBody } from "../utils/log-course-body";

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

const localizedTitlesSchema = {
	type: "object",
	additionalProperties: false,
	properties: {
		en: { type: "string", minLength: 1 },
		zh: { type: "string", minLength: 1 },
	},
} as const;

const localizedVideoUrlsSchema = {
	type: "object",
	additionalProperties: false,
	properties: {
		en: { type: "string", minLength: 1 },
		zh: { type: "string", minLength: 1 },
	},
} as const;

const courseVideoSchema = {
	type: "object",
	required: ["title", "videoUrl"],
	additionalProperties: false,
	properties: {
		id: { type: "string", minLength: 1 },
		title: { type: "string", minLength: 1 },
		description: { type: "string" },
		videoUrl: { type: "string", minLength: 1 },
		titles: localizedTitlesSchema,
		videoUrls: localizedVideoUrlsSchema,
		order: { type: "integer", minimum: 0 },
		durationInSeconds: { type: "integer", minimum: 0 },
		isPreviewAvailable: { type: "boolean" },
	},
} as const;

const courseWorksheetSchema = {
	type: "object",
	required: ["id", "title", "publicId", "mimeType"],
	additionalProperties: false,
	properties: {
		id: { type: "string", minLength: 1 },
		title: { type: "string", minLength: 1 },
		publicId: { type: "string", minLength: 1 },
		fileUrl: { type: "string", minLength: 1 },
		fileName: { type: "string", minLength: 1 },
		mimeType: { type: "string", enum: ["application/pdf"] },
		unitId: { type: "string", minLength: 1 },
		order: { type: "integer", minimum: 0 },
	},
} as const;

const interactiveCheckpointPlacementSchema = {
	type: "object",
	required: ["mode", "unitId"],
	additionalProperties: false,
	properties: {
		mode: { type: "string", enum: ["after_unit"] },
		unitId: { type: "string", minLength: 1 },
		order: { type: "integer", minimum: 0 },
	},
} as const;

const interactiveCheckpointSchema = {
	type: "object",
	required: ["id", "questionKind", "placement", "payload"],
	additionalProperties: false,
	properties: {
		id: { type: "string", minLength: 1 },
		questionKind: {
			type: "string",
			enum: ["multiple_choice", "true_false", "short_answer", "select_all", "ordering"],
		},
		title: { type: "string" },
		explanation: { type: "string" },
		placement: interactiveCheckpointPlacementSchema,
		payload: { type: "object", additionalProperties: true },
	},
} as const;

const courseUnitSchema = {
	type: "object",
	required: ["title", "videos"],
	additionalProperties: false,
	properties: {
		id: { type: "string", minLength: 1 },
		title: { type: "string", minLength: 1 },
		description: { type: "string" },
		titles: localizedTitlesSchema,
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
		required: ["title", "instructionalLanguages", "isRecommended"],
		additionalProperties: false,
		properties: {
			title: { type: "string", minLength: 1 },
			slug: { type: "string", minLength: 1 },
			summary: { type: "string" },
			instructionalLanguages: {
				type: "array",
				minItems: 1,
				maxItems: 2,
				items: { type: "string", enum: ["en", "zh"] },
			},
			deliveryMode: {
				type: "string",
				enum: ["online", "in_person"],
			},
			enrollmentAccessPeriod: {
				type: "string",
				enum: ["lifetime", "three_weeks", "one_quarter", "one_year"],
			},
			isRecommended: { type: "boolean" },
			isSoldOut: { type: "boolean" },
			maxEnrollments: { type: "integer", minimum: 1 },
			recommendedSessionsPerWeek: { type: "integer", minimum: 1 },
			sessionCount: { type: "integer", minimum: 1 },
			target: { type: "string", minLength: 1 },
			targets: {
				type: "array",
				minItems: 1,
				maxItems: 16,
				items: { type: "string", minLength: 1 },
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
			worksheets: {
				type: "array",
				items: courseWorksheetSchema,
			},
			interactiveCheckpoints: {
				type: "array",
				items: interactiveCheckpointSchema,
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
					features: {
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
	required: [
		"id",
		"title",
		"instructionalLanguages",
		"isRecommended",
		"units",
		"createdAt",
		"updatedAt",
		"reviews",
		"reviewSummary",
	],
	additionalProperties: false,
	properties: {
		id: { type: "string" },
		courseId: { type: "string" },
		title: { type: "string" },
		slug: { type: "string" },
		summary: { type: "string" },
		instructionalLanguages: {
			type: "array",
			minItems: 1,
			maxItems: 2,
			items: { type: "string", enum: ["en", "zh"] },
		},
		deliveryMode: {
			type: "string",
			enum: ["online", "in_person"],
		},
		enrollmentAccessPeriod: {
			type: "string",
			enum: ["lifetime", "three_weeks", "one_quarter", "one_year"],
		},
		cohortPurchaseOptions: {
			type: "array",
			items: {
				type: "object",
				required: ["cohortId", "name"],
				additionalProperties: false,
				properties: {
					cohortId: { type: "string" },
					name: { type: "string" },
					termLabel: { type: "string" },
					termEndsAt: { type: "string" },
				},
			},
		},
		isRecommended: { type: "boolean" },
		isSoldOut: { type: "boolean" },
		maxEnrollments: { type: "integer" },
		recommendedSessionsPerWeek: { type: "integer" },
		sessionCount: { type: "integer" },
		target: { type: "string" },
		targets: {
			type: "array",
			items: { type: "string" },
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
		worksheets: {
			type: "array",
			items: courseWorksheetSchema,
		},
		interactiveCheckpoints: {
			type: "array",
			items: interactiveCheckpointSchema,
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
				features: {
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

const courseLearnerMetricsResponseSchema = {
	type: "object",
	required: [
		"resolvedCourseId",
		"title",
		"usersWithEnrollment",
		"usersWithActiveEnrollment",
		"usersWithPurchaseRecord",
		"usersWithActivePurchaseAccess",
		"cohortCount",
		"cohortSeatsReserved",
	],
	additionalProperties: false,
	properties: {
		resolvedCourseId: { type: "string" },
		title: { type: "string" },
		slug: { type: "string" },
		usersWithEnrollment: { type: "integer", minimum: 0 },
		usersWithActiveEnrollment: { type: "integer", minimum: 0 },
		usersWithPurchaseRecord: { type: "integer", minimum: 0 },
		usersWithActivePurchaseAccess: { type: "integer", minimum: 0 },
		cohortCount: { type: "integer", minimum: 0 },
		cohortSeatsReserved: { type: "integer", minimum: 0 },
	},
} as const;

const courseEnrolledLearnerEnrollmentResponseSchema = {
	type: "object",
	required: ["courseId", "enrolledAt"],
	additionalProperties: false,
	properties: {
		courseId: { type: "string" },
		cohortId: { type: "string" },
		enrolledAt: { type: "string" },
		status: { type: "string" },
		progressPercent: { type: "number" },
		entitlementSource: { type: "string" },
		lastAccessedAt: { type: "string" },
	},
} as const;

const courseEnrolledLearnerRowResponseSchema = {
	type: "object",
	required: ["userId", "firstName", "lastName", "email", "enrollment"],
	additionalProperties: false,
	properties: {
		userId: { type: "string", minLength: 1 },
		firstName: { type: "string" },
		lastName: { type: "string" },
		email: { type: "string" },
		role: { type: "string" },
		accountStatus: { type: "string" },
		enrollment: courseEnrolledLearnerEnrollmentResponseSchema,
	},
} as const;

const courseEnrolledLearnersResponseSchema = {
	type: "object",
	required: ["resolvedCourseId", "title", "totalMatching", "truncated", "learners"],
	additionalProperties: false,
	properties: {
		resolvedCourseId: { type: "string" },
		title: { type: "string" },
		totalMatching: { type: "integer", minimum: 0 },
		truncated: { type: "boolean" },
		learners: {
			type: "array",
			items: courseEnrolledLearnerRowResponseSchema,
		},
	},
} as const;

const courseAdminEnrollBodySchema = {
	type: "object",
	required: ["userId"],
	additionalProperties: false,
	properties: {
		userId: { type: "string", minLength: 24, maxLength: 24, pattern: "^[a-fA-F0-9]{24}$" },
	},
} as const;

const adminEnrollUserResponseSchema = {
	type: "object",
	additionalProperties: true,
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

const isCourseCatalogRequestPrivileged = async (
	app: FastifyInstance,
	request: FastifyRequest,
): Promise<boolean> => {
	const decoded = verifyAuthToken(app, request);
	if (!decoded?.email) {
		return false;
	}
	const user = await getUserByEmail(decoded.email);
	const role = normalizeRole(user?.role as LegacyInputRole | undefined);
	return role === "admin" || role === "instructor";
};

export default async function courseRoutes(app: FastifyInstance) {
	app.post(
		"/courses",
		{
			schema: {
				...createCourseSchema,
				response: {
					201: courseResponseSchema,
					400: errorResponseSchema,
					500: errorResponseSchema,
				},
			},
		},
		async (request: FastifyRequest<{ Body: CourseInputDTO }>, reply) => {
			try {
				const roleContext = await requireRole(app, request, reply, ["admin", "instructor"]);
				if (!roleContext) return;
				logCourseMutationBody(request.log, "POST /courses", request.body);
				const createdCourse = await createCourse(request.body);
				return reply.code(201).send(createdCourse);
			} catch (error) {
				if (error instanceof CourseValidationError) {
					return reply.status(400).send({ message: error.message });
				}
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
		async (request, reply) => {
			try {
				const privileged = await isCourseCatalogRequestPrivileged(app, request);
				const courses = await getCourses();
				const payload = privileged ? courses : courses.map(redactInteractiveCheckpointsOnCourse);
				return reply.send({ courses: payload });
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

				const privileged = await isCourseCatalogRequestPrivileged(app, request);
				return reply.send(privileged ? course : redactInteractiveCheckpointsOnCourse(course));
			} catch (error) {
				app.log.error({ err: error }, "Failed to fetch course");
				return reply
					.status(500)
					.send({ message: "Failed to fetch course", error: "COURSE_FETCH_FAILED" });
			}
		},
	);

	app.get(
		"/courses/:courseId/stats",
		{
			schema: {
				params: courseIdParamSchema,
				response: {
					200: courseLearnerMetricsResponseSchema,
					401: errorResponseSchema,
					403: errorResponseSchema,
					404: errorResponseSchema,
					500: errorResponseSchema,
				},
			},
		},
		async (request: FastifyRequest<{ Params: { courseId: string } }>, reply) => {
			try {
				const roleContext = await requireRole(app, request, reply, ["admin", "instructor"]);
				if (!roleContext) return;

				const metrics = await getCourseLearnerMetrics(request.params.courseId);
				if (!metrics) {
					return reply.status(404).send({ message: "Course not found" });
				}

				return reply.send(metrics);
			} catch (error) {
				app.log.error({ err: error }, "Failed to fetch course learner metrics");
				return reply
					.status(500)
					.send({ message: "Failed to fetch course stats", error: "COURSE_STATS_FAILED" });
			}
		},
	);

	app.get(
		"/courses/:courseId/enrollments",
		{
			schema: {
				params: courseIdParamSchema,
				response: {
					200: courseEnrolledLearnersResponseSchema,
					401: errorResponseSchema,
					403: errorResponseSchema,
					404: errorResponseSchema,
					500: errorResponseSchema,
				},
			},
		},
		async (request: FastifyRequest<{ Params: { courseId: string } }>, reply) => {
			try {
				const roleContext = await requireRole(app, request, reply, ["admin", "instructor"]);
				if (!roleContext) return;

				const payload = await getCourseEnrolledLearners(request.params.courseId);
				if (!payload) {
					return reply.status(404).send({ message: "Course not found" });
				}

				return reply.send(payload);
			} catch (error) {
				app.log.error({ err: error }, "Failed to fetch course enrollments");
				return reply
					.status(500)
					.send({ message: "Failed to fetch course enrollments", error: "COURSE_ENROLLMENTS_LIST_FAILED" });
			}
		},
	);

	app.post(
		"/courses/:courseId/enrollments",
		{
			schema: {
				params: courseIdParamSchema,
				body: courseAdminEnrollBodySchema,
				response: {
					200: adminEnrollUserResponseSchema,
					401: errorResponseSchema,
					403: errorResponseSchema,
					404: errorResponseSchema,
					500: errorResponseSchema,
				},
			},
		},
		async (
			request: FastifyRequest<{ Params: { courseId: string }; Body: { userId: string } }>,
			reply,
		) => {
			try {
				const roleContext = await requireRole(app, request, reply, ["admin", "instructor"]);
				if (!roleContext) return;

				const updatedUser = await adminEnrollUserInCourse(request.body.userId, request.params.courseId);
				if (!updatedUser) {
					return reply.status(404).send({ message: "User or course not found" });
				}

				return reply.send(updatedUser);
			} catch (error) {
				app.log.error({ err: error }, "Failed to admin-enroll user in course");
				return reply
					.status(500)
					.send({ message: "Failed to enroll user", error: "COURSE_ADMIN_ENROLL_FAILED" });
			}
		},
	);

	app.patch(
		"/courses/:courseId",
		{
			schema: {
				params: courseIdParamSchema,
				body: createCourseSchema.body,
				response: {
					200: courseResponseSchema,
					400: errorResponseSchema,
					404: errorResponseSchema,
					500: errorResponseSchema,
				},
			},
		},
		async (request: FastifyRequest<{ Params: { courseId: string }; Body: CourseInputDTO }>, reply) => {
			try {
				const roleContext = await requireRole(app, request, reply, ["admin", "instructor"]);
				if (!roleContext) return;
				logCourseMutationBody(request.log, "PATCH /courses/:courseId", request.body, request.params.courseId);
				const updated = await updateCourse(request.params.courseId, request.body);
				if (!updated) {
					return reply.status(404).send({ message: "Course not found" });
				}
				return reply.send(updated);
			} catch (error) {
				if (error instanceof CourseValidationError) {
					return reply.status(400).send({ message: error.message });
				}
				app.log.error({ err: error }, "Failed to update course");
				return reply
					.status(500)
					.send({ message: "Failed to update course", error: "COURSE_UPDATE_FAILED" });
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

				return reply.code(204).send();
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
