import { FastifyInstance, FastifyRequest } from "fastify";
import {
	addUserPurchase,
	createUser,
	deleteUser,
	getUserActivityFeed,
	getUserByEmail,
	getUserDashboardSummary,
	getUserEnrolledCourses,
	listUsers,
	updateUser,
	updateUserByEmail,
	updateUserCourseProgressByEmail,
	updateUserPurchase,
} from "../services/user.service";
import { requireRole, verifyAuthToken } from "../utils/auth";

const purchasedCourseSchema = {
	type: "object",
	required: ["courseId", "purchasedAt"],
	additionalProperties: false,
	properties: {
		courseId: { type: "string", minLength: 1 },
		purchasedAt: { type: "string" },
		amountPaid: { type: "number", minimum: 0 },
		currency: { type: "string", minLength: 1 },
		purchaseSource: {
			type: "string",
			enum: ["web", "dashboard", "admin", "migration"],
		},
		accessStatus: {
			type: "string",
			enum: ["active", "refunded", "revoked"],
		},
		paymentProvider: {
			type: "string",
			enum: ["stripe"],
		},
		stripePaymentIntentId: { type: "string" },
		stripeCheckoutSessionId: { type: "string" },
		stripeCustomerId: { type: "string" },
		stripeChargeId: { type: "string" },
		stripeInvoiceId: { type: "string" },
		paymentStatus: {
			type: "string",
			enum: ["requires_payment_method", "requires_action", "processing", "succeeded", "canceled"],
		},
		progressPercent: { type: "number", minimum: 0, maximum: 100 },
		lastAccessedAt: { type: "string" },
	},
} as const;

const enrollmentSchema = {
	type: "object",
	required: ["courseId", "enrolledAt"],
	additionalProperties: false,
	properties: {
		courseId: { type: "string", minLength: 1 },
		cohortId: { type: "string", minLength: 1 },
		enrolledAt: { type: "string" },
		entitlementSource: {
			type: "string",
			enum: ["purchase", "gift", "admin_grant", "migration"],
		},
		status: {
			type: "string",
			enum: ["active", "completed", "paused", "revoked"],
		},
		progressPercent: { type: "number", minimum: 0, maximum: 100 },
		attendanceSummary: {
			type: "object",
			properties: {
				attended: { type: "integer", minimum: 0 },
				left: { type: "integer", minimum: 0 },
				total: { type: "integer", minimum: 0 },
			},
			additionalProperties: false,
		},
		recommendedSessionsPerWeek: { type: "integer", minimum: 1 },
		lastAccessedAt: { type: "string" },
		completedAt: { type: "string" },
		accessExpiresAt: { type: "string" },
	},
} as const;

const createUserSchema = {
	body: {
		type: "object",
		required: ["firstName", "lastName", "email"],
		additionalProperties: false,
		properties: {
			firstName: { type: "string", minLength: 1 },
			lastName: { type: "string", minLength: 1 },
			email: { type: "string", format: "email" },
			role: {
				type: "string",
				enum: ["student", "instructor", "teacher", "admin"],
			},
			status: {
				type: "string",
				enum: ["active", "invited", "suspended"],
			},
			purchasedCourses: {
				type: "array",
				items: purchasedCourseSchema,
			},
			enrollments: {
				type: "array",
				items: enrollmentSchema,
			},
		},
	},
} as const;

const deleteUserParamsSchema = {
	type: "object",
	required: ["userId"],
	properties: {
		userId: { type: "string", minLength: 24, maxLength: 24 },
	},
} as const;

const userResponseSchema = {
	type: "object",
	required: ["id", "firstName", "lastName", "email"],
	additionalProperties: false,
	properties: {
		id: { type: "string" },
		firstName: { type: "string" },
		lastName: { type: "string" },
		email: { type: "string" },
		role: { type: "string" },
		status: { type: "string" },
		languageLevel: { type: "string" },
		country: { type: "string" },
		interests: {
			type: "array",
			items: { type: "string" },
		},
		purchasedCourses: {
			type: "array",
			items: purchasedCourseSchema,
		},
		enrollments: {
			type: "array",
			items: enrollmentSchema,
		},
		createdAt: { type: "string" },
		updatedAt: { type: "string" },
		enrolledCourseCount: { type: "number" },
		lastLoginAt: { type: "string" },
	},
} as const;

const updateUserSchema = {
	body: {
		type: "object",
		additionalProperties: false,
		properties: {
			role: {
				type: "string",
				enum: ["student", "instructor", "teacher", "admin"],
			},
			status: {
				type: "string",
				enum: ["active", "invited", "suspended"],
			},
			purchasedCourses: {
				type: "array",
				items: purchasedCourseSchema,
			},
			enrollments: {
				type: "array",
				items: enrollmentSchema,
			},
		},
		minProperties: 1,
	},
	params: deleteUserParamsSchema,
} as const;

const purchaseParamsSchema = {
	type: "object",
	required: ["userId", "courseId"],
	properties: {
		userId: { type: "string", minLength: 24, maxLength: 24 },
		courseId: { type: "string", minLength: 1 },
	},
} as const;

const createUserPurchaseSchema = {
	body: purchasedCourseSchema,
	params: deleteUserParamsSchema,
} as const;

const updateUserPurchaseSchema = {
	body: {
		type: "object",
		additionalProperties: false,
		properties: purchasedCourseSchema.properties,
		minProperties: 1,
	},
	params: purchaseParamsSchema,
} as const;

const meProfileUpdateSchema = {
	body: {
		type: "object",
		additionalProperties: false,
		properties: {
			firstName: { type: "string", minLength: 1 },
			lastName: { type: "string", minLength: 1 },
			country: { type: "string", minLength: 1 },
			languageLevel: {
				type: "string",
				enum: ["beginner", "intermediate", "advanced"],
			},
			interests: {
				type: "array",
				items: { type: "string" },
			},
		},
		minProperties: 1,
	},
} as const;

const meCourseProgressParamsSchema = {
	type: "object",
	required: ["courseId"],
	properties: {
		courseId: { type: "string", minLength: 1 },
	},
} as const;

const meCourseProgressSchema = {
	params: meCourseProgressParamsSchema,
	body: {
		type: "object",
		required: ["progressPercent"],
		additionalProperties: false,
		properties: {
			progressPercent: { type: "number", minimum: 0, maximum: 100 },
		},
	},
} as const;

const meCourseItemSchema = {
	type: "object",
	required: [
		"id",
		"title",
		"progressPercent",
		"nextLessonTitle",
		"lastVisitedLabel",
		"attendedSessions",
		"sessionsLeft",
		"recommendedSessionsPerWeek",
	],
	additionalProperties: false,
	properties: {
		id: { type: "string" },
		cohortId: { type: "string" },
		title: { type: "string" },
		progressPercent: { type: "number" },
		nextLessonTitle: { type: "string" },
		lastVisitedLabel: { type: "string" },
		attendedSessions: { type: "number" },
		sessionsLeft: { type: "number" },
		recommendedSessionsPerWeek: { type: "number" },
	},
} as const;

const meActivityItemSchema = {
	type: "object",
	required: ["id", "label", "timeLabel"],
	additionalProperties: false,
	properties: {
		id: { type: "string" },
		label: { type: "string" },
		timeLabel: { type: "string" },
	},
} as const;

const getEmailFromAuthHeader = (request: FastifyRequest, app: FastifyInstance): string | null => {
	const decoded = verifyAuthToken(app, request);
	return decoded?.email ?? null;
};

export default async function userRoutes(app: FastifyInstance) {
	app.get(
		"/users/me",
		{
			schema: {
				response: {
					200: userResponseSchema,
					401: { type: "object", required: ["message"], properties: { message: { type: "string" } } },
					404: { type: "object", required: ["message"], properties: { message: { type: "string" } } },
				},
			},
		},
		async (request, reply) => {
			const email = getEmailFromAuthHeader(request, app);
			if (!email) return reply.status(401).send({ message: "Unauthorized" });
			const user = await getUserByEmail(email);
			if (!user) return reply.status(404).send({ message: "User not found" });
			return reply.send(user);
		},
	);

	app.patch(
		"/users/me",
		{
			schema: {
				...meProfileUpdateSchema,
				response: {
					200: userResponseSchema,
					401: { type: "object", required: ["message"], properties: { message: { type: "string" } } },
					404: { type: "object", required: ["message"], properties: { message: { type: "string" } } },
				},
			},
		},
		async (
			request: FastifyRequest<{
				Body: {
					firstName?: string;
					lastName?: string;
					country?: string;
					languageLevel?: "beginner" | "intermediate" | "advanced";
					interests?: string[];
				};
			}>,
			reply,
		) => {
			const email = getEmailFromAuthHeader(request, app);
			if (!email) return reply.status(401).send({ message: "Unauthorized" });
			const updated = await updateUserByEmail(email, request.body);
			if (!updated) return reply.status(404).send({ message: "User not found" });
			return reply.send(updated);
		},
	);

	app.get(
		"/users/me/dashboard",
		{
			schema: {
				response: {
					200: {
						type: "object",
						required: ["stats", "upcomingBookings"],
						properties: {
							stats: {
								type: "object",
								required: ["enrolledCourses", "lessonsCompleted", "studyHoursThisMonth", "streakDays"],
								properties: {
									enrolledCourses: { type: "number" },
									lessonsCompleted: { type: "number" },
									studyHoursThisMonth: { type: "number" },
									streakDays: { type: "number" },
								},
							},
							upcomingBookings: {
								type: "array",
								items: {
									type: "object",
									required: ["id", "title", "dateLabel", "timeLabel", "mode"],
									properties: {
										id: { type: "string" },
										title: { type: "string" },
										dateLabel: { type: "string" },
										timeLabel: { type: "string" },
										mode: { type: "string", enum: ["Video", "In person"] },
									},
								},
							},
						},
					},
					401: { type: "object", required: ["message"], properties: { message: { type: "string" } } },
					404: { type: "object", required: ["message"], properties: { message: { type: "string" } } },
				},
			},
		},
		async (request, reply) => {
			const email = getEmailFromAuthHeader(request, app);
			if (!email) return reply.status(401).send({ message: "Unauthorized" });
			const summary = await getUserDashboardSummary(email);
			if (!summary) return reply.status(404).send({ message: "User not found" });
			return reply.send(summary);
		},
	);

	app.get(
		"/users/me/courses",
		{
			schema: {
				response: {
					200: {
						type: "object",
						required: ["courses"],
						properties: {
							courses: {
								type: "array",
								items: meCourseItemSchema,
							},
						},
					},
					401: { type: "object", required: ["message"], properties: { message: { type: "string" } } },
					404: { type: "object", required: ["message"], properties: { message: { type: "string" } } },
				},
			},
		},
		async (request, reply) => {
			const email = getEmailFromAuthHeader(request, app);
			if (!email) return reply.status(401).send({ message: "Unauthorized" });
			const courses = await getUserEnrolledCourses(email);
			if (!courses) return reply.status(404).send({ message: "User not found" });
			return reply.send({ courses });
		},
	);

	app.patch(
		"/users/me/courses/:courseId/progress",
		{
			schema: {
				...meCourseProgressSchema,
				response: {
					200: userResponseSchema,
					401: { type: "object", required: ["message"], properties: { message: { type: "string" } } },
					404: { type: "object", required: ["message"], properties: { message: { type: "string" } } },
				},
			},
		},
		async (
			request: FastifyRequest<{ Params: { courseId: string }; Body: { progressPercent: number } }>,
			reply,
		) => {
			const email = getEmailFromAuthHeader(request, app);
			if (!email) return reply.status(401).send({ message: "Unauthorized" });
			const updated = await updateUserCourseProgressByEmail(email, request.params.courseId, request.body.progressPercent);
			if (!updated) return reply.status(404).send({ message: "User or enrollment not found" });
			return reply.send(updated);
		},
	);

	app.get(
		"/users/me/activity",
		{
			schema: {
				response: {
					200: {
						type: "object",
						required: ["activity"],
						properties: {
							activity: {
								type: "array",
								items: meActivityItemSchema,
							},
						},
					},
					401: { type: "object", required: ["message"], properties: { message: { type: "string" } } },
					404: { type: "object", required: ["message"], properties: { message: { type: "string" } } },
				},
			},
		},
		async (request, reply) => {
			const email = getEmailFromAuthHeader(request, app);
			if (!email) return reply.status(401).send({ message: "Unauthorized" });
			const activity = await getUserActivityFeed(email);
			if (!activity) return reply.status(404).send({ message: "User not found" });
			return reply.send({ activity });
		},
	);

	app.get(
		"/users",
		{
			schema: {
				response: {
					200: {
						type: "object",
						required: ["users"],
						properties: {
							users: {
								type: "array",
								items: userResponseSchema,
							},
						},
					},
				},
			},
		},
		async (_request, reply) => {
			const roleContext = await requireRole(app, _request, reply, ["admin", "instructor"]);
			if (!roleContext) return;
			const users = await listUsers();
			return reply.send({ users });
		},
	);

	app.post(
		"/users",
		{
			schema: createUserSchema,
		},
		async (
			request: FastifyRequest<{
				Body: {
					firstName: string;
					lastName: string;
					email: string;
					role?: string;
					status?: string;
					purchasedCourses?: {
						courseId: string;
						purchasedAt: string;
						amountPaid?: number;
						currency?: string;
						purchaseSource?: "web" | "dashboard" | "admin" | "migration";
						accessStatus?: "active" | "refunded" | "revoked";
						progressPercent?: number;
						lastAccessedAt?: string;
					}[];
					enrollments?: {
						courseId: string;
						cohortId?: string;
						enrolledAt: string;
						entitlementSource?: "purchase" | "gift" | "admin_grant" | "migration";
						status?: "active" | "completed" | "paused" | "revoked";
						progressPercent?: number;
						attendanceSummary?: { attended: number; left: number; total: number };
						recommendedSessionsPerWeek?: number;
						lastAccessedAt?: string;
						completedAt?: string;
						accessExpiresAt?: string;
					}[];
				};
			}>,
			reply,
		) => {
			try {
				const roleContext = await requireRole(app, request, reply, ["admin", "instructor"]);
				if (!roleContext) return;
				const user = await createUser({
					firstName: request.body.firstName,
					lastName: request.body.lastName,
					email: request.body.email,
					role: request.body.role as "student" | "instructor" | "teacher" | "admin" | undefined,
					status: request.body.status as "active" | "invited" | "suspended" | undefined,
					purchasedCourses: request.body.purchasedCourses?.map((course) => ({
						...course,
						purchasedAt: new Date(course.purchasedAt),
						lastAccessedAt: course.lastAccessedAt ? new Date(course.lastAccessedAt) : undefined,
					})),
					enrollments: request.body.enrollments?.map((enrollment) => ({
						...enrollment,
						enrolledAt: new Date(enrollment.enrolledAt),
						lastAccessedAt: enrollment.lastAccessedAt ? new Date(enrollment.lastAccessedAt) : undefined,
						completedAt: enrollment.completedAt ? new Date(enrollment.completedAt) : undefined,
						accessExpiresAt: enrollment.accessExpiresAt ? new Date(enrollment.accessExpiresAt) : undefined,
					})),
				});
				return reply.status(201).send(user);
			} catch (error) {
				app.log.error({ err: error }, "Failed to create user");
				return reply.status(500).send({ message: "Failed to create user" });
			}
		},
	);

	app.delete(
		"/users/:userId",
		{
			schema: {
				params: deleteUserParamsSchema,
				response: {
					204: { type: "null" },
					404: {
						type: "object",
						required: ["message"],
						properties: {
							message: { type: "string" },
						},
					},
				},
			},
		},
		async (request: FastifyRequest<{ Params: { userId: string } }>, reply) => {
			const roleContext = await requireRole(app, request, reply, ["admin", "instructor"]);
			if (!roleContext) return;
			const success = await deleteUser(request.params.userId);
			if (!success) {
				return reply.status(404).send({ message: "User not found" });
			}

			return reply.status(204).send();
		},
	);

	app.patch(
		"/users/:userId",
		{
			schema: {
				...updateUserSchema,
				response: {
					200: userResponseSchema,
					404: {
						type: "object",
						required: ["message"],
						properties: {
							message: { type: "string" },
						},
					},
				},
			},
		},
		async (
			request: FastifyRequest<{
				Params: { userId: string };
				Body: {
					role?: string;
					status?: string;
					purchasedCourses?: {
						courseId: string;
						purchasedAt: string;
						amountPaid?: number;
						currency?: string;
						purchaseSource?: "web" | "dashboard" | "admin" | "migration";
						accessStatus?: "active" | "refunded" | "revoked";
						progressPercent?: number;
						lastAccessedAt?: string;
					}[];
					enrollments?: {
						courseId: string;
						cohortId?: string;
						enrolledAt: string;
						entitlementSource?: "purchase" | "gift" | "admin_grant" | "migration";
						status?: "active" | "completed" | "paused" | "revoked";
						progressPercent?: number;
						attendanceSummary?: { attended: number; left: number; total: number };
						recommendedSessionsPerWeek?: number;
						lastAccessedAt?: string;
						completedAt?: string;
						accessExpiresAt?: string;
					}[];
				};
			}>,
			reply,
		) => {
			try {
				const roleContext = await requireRole(app, request, reply, ["admin", "instructor"]);
				if (!roleContext) return;
				const updated = await updateUser(request.params.userId, {
					role: request.body.role as "student" | "instructor" | "teacher" | "admin" | undefined,
					status: request.body.status as "active" | "invited" | "suspended" | undefined,
					purchasedCourses: request.body.purchasedCourses?.map((course) => ({
						...course,
						purchasedAt: new Date(course.purchasedAt),
						lastAccessedAt: course.lastAccessedAt ? new Date(course.lastAccessedAt) : undefined,
					})),
					enrollments: request.body.enrollments?.map((enrollment) => ({
						...enrollment,
						enrolledAt: new Date(enrollment.enrolledAt),
						lastAccessedAt: enrollment.lastAccessedAt ? new Date(enrollment.lastAccessedAt) : undefined,
						completedAt: enrollment.completedAt ? new Date(enrollment.completedAt) : undefined,
						accessExpiresAt: enrollment.accessExpiresAt ? new Date(enrollment.accessExpiresAt) : undefined,
					})),
				});

				if (!updated) {
					return reply.status(404).send({ message: "User not found" });
				}

				return reply.send(updated);
			} catch (error) {
				app.log.error({ err: error }, "Failed to update user");
				return reply.status(500).send({ message: "Failed to update user" });
			}
		},
	);

	app.post(
		"/users/:userId/purchases",
		{
			schema: {
				...createUserPurchaseSchema,
				response: {
					200: userResponseSchema,
					404: {
						type: "object",
						required: ["message"],
						properties: { message: { type: "string" } },
					},
				},
			},
		},
		async (
			request: FastifyRequest<{
				Params: { userId: string };
				Body: {
					courseId: string;
					purchasedAt: string;
					amountPaid?: number;
					currency?: string;
					purchaseSource?: "web" | "dashboard" | "admin" | "migration";
					accessStatus?: "active" | "refunded" | "revoked";
					paymentProvider?: "stripe";
					stripePaymentIntentId?: string;
					stripeCheckoutSessionId?: string;
					stripeCustomerId?: string;
					stripeChargeId?: string;
					stripeInvoiceId?: string;
					paymentStatus?: "requires_payment_method" | "requires_action" | "processing" | "succeeded" | "canceled";
					progressPercent?: number;
					lastAccessedAt?: string;
				};
			}>,
			reply,
		) => {
			const roleContext = await requireRole(app, request, reply, ["admin", "instructor"]);
			if (!roleContext) return;
			const updatedUser = await addUserPurchase(request.params.userId, {
				...request.body,
				purchasedAt: new Date(request.body.purchasedAt),
				lastAccessedAt: request.body.lastAccessedAt ? new Date(request.body.lastAccessedAt) : undefined,
			});

			if (!updatedUser) {
				return reply.status(404).send({ message: "User not found" });
			}

			return reply.send(updatedUser);
		},
	);

	app.patch(
		"/users/:userId/purchases/:courseId",
		{
			schema: {
				...updateUserPurchaseSchema,
				response: {
					200: userResponseSchema,
					404: {
						type: "object",
						required: ["message"],
						properties: { message: { type: "string" } },
					},
				},
			},
		},
		async (
			request: FastifyRequest<{
				Params: { userId: string; courseId: string };
				Body: {
					purchasedAt?: string;
					amountPaid?: number;
					currency?: string;
					purchaseSource?: "web" | "dashboard" | "admin" | "migration";
					accessStatus?: "active" | "refunded" | "revoked";
					paymentProvider?: "stripe";
					stripePaymentIntentId?: string;
					stripeCheckoutSessionId?: string;
					stripeCustomerId?: string;
					stripeChargeId?: string;
					stripeInvoiceId?: string;
					paymentStatus?: "requires_payment_method" | "requires_action" | "processing" | "succeeded" | "canceled";
					progressPercent?: number;
					lastAccessedAt?: string;
				};
			}>,
			reply,
		) => {
			const roleContext = await requireRole(app, request, reply, ["admin", "instructor"]);
			if (!roleContext) return;
			const updatedUser = await updateUserPurchase(request.params.userId, request.params.courseId, {
				...request.body,
				purchasedAt: request.body.purchasedAt ? new Date(request.body.purchasedAt) : undefined,
				lastAccessedAt: request.body.lastAccessedAt ? new Date(request.body.lastAccessedAt) : undefined,
			});

			if (!updatedUser) {
				return reply.status(404).send({ message: "User or purchase not found" });
			}

			return reply.send(updatedUser);
		},
	);
}
