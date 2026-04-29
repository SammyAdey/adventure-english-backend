import { FastifyInstance, FastifyRequest } from "fastify";
import { bookSessionForUser, createCohort, createSession, enrollUserInCohort, listCohortsByCourse, listSessionsByCohort } from "../services/cohort.service";
import { requireRole, verifyAuthToken } from "../utils/auth";

const courseIdParamSchema = {
	type: "object",
	required: ["courseId"],
	properties: {
		courseId: { type: "string", minLength: 1 },
	},
} as const;

const cohortIdParamSchema = {
	type: "object",
	required: ["cohortId"],
	properties: {
		cohortId: { type: "string", minLength: 1 },
	},
} as const;

const enrollParamsSchema = {
	type: "object",
	required: ["courseId", "cohortId"],
	properties: {
		courseId: { type: "string", minLength: 1 },
		cohortId: { type: "string", minLength: 1 },
	},
} as const;

const bookSessionParamsSchema = {
	type: "object",
	required: ["cohortId", "sessionId"],
	properties: {
		cohortId: { type: "string", minLength: 1 },
		sessionId: { type: "string", minLength: 1 },
	},
} as const;

const getEmailFromAuthHeader = (request: FastifyRequest, app: FastifyInstance): string | null => {
	const decoded = verifyAuthToken(app, request);
	return decoded?.email ?? null;
};

export default async function cohortRoutes(app: FastifyInstance) {
	app.post(
		"/cohorts",
		{
			schema: {
				body: {
					type: "object",
					required: ["courseId", "name", "location", "timezone", "maxEnrollments", "recommendedSessionsPerWeek", "sessionCount"],
					additionalProperties: false,
					properties: {
						courseId: { type: "string", minLength: 1 },
						name: { type: "string", minLength: 1 },
						location: { type: "string", minLength: 1 },
						timezone: { type: "string", minLength: 1 },
						capacityPerSession: { type: "integer", minimum: 1 },
						maxEnrollments: { type: "integer", minimum: 1 },
						recommendedSessionsPerWeek: { type: "integer", minimum: 1 },
						sessionCount: { type: "integer", minimum: 1 },
						status: { type: "string", enum: ["draft", "open", "full", "completed", "cancelled"] },
					},
				},
			},
		},
		async (
			request: FastifyRequest<{
				Body: {
					courseId: string;
					name: string;
					location: string;
					timezone: string;
					capacityPerSession?: number;
					maxEnrollments: number;
					recommendedSessionsPerWeek: number;
					sessionCount: number;
					status?: "draft" | "open" | "full" | "completed" | "cancelled";
				};
			}>,
			reply,
		) => {
			const roleContext = await requireRole(app, request, reply, ["admin", "instructor"]);
			if (!roleContext) return;
			const cohort = await createCohort(request.body);
			if (!cohort) return reply.status(404).send({ message: "Course not found" });
			return reply.status(201).send(cohort);
		},
	);

	app.get(
		"/courses/:courseId/cohorts",
		{
			schema: {
				params: courseIdParamSchema,
			},
		},
		async (request: FastifyRequest<{ Params: { courseId: string } }>, reply) => {
			const roleContext = await requireRole(app, request, reply, ["admin", "instructor"]);
			if (!roleContext) return;
			const cohorts = await listCohortsByCourse(request.params.courseId);
			return reply.send({ cohorts });
		},
	);

	app.post(
		"/cohorts/:cohortId/sessions",
		{
			schema: {
				params: cohortIdParamSchema,
				body: {
					type: "object",
					required: ["startsAt", "endsAt"],
					additionalProperties: false,
					properties: {
						startsAt: { type: "string" },
						endsAt: { type: "string" },
						capacity: { type: "integer", minimum: 1 },
						calEventTypeId: { type: "integer", minimum: 1 },
						status: { type: "string", enum: ["scheduled", "booked", "completed", "cancelled"] },
					},
				},
			},
		},
		async (
			request: FastifyRequest<{
				Params: { cohortId: string };
				Body: {
					startsAt: string;
					endsAt: string;
					capacity?: number;
					calEventTypeId?: number;
					status?: "scheduled" | "booked" | "completed" | "cancelled";
				};
			}>,
			reply,
		) => {
			const roleContext = await requireRole(app, request, reply, ["admin", "instructor"]);
			if (!roleContext) return;
			const session = await createSession({
				...request.body,
				cohortId: request.params.cohortId,
				startsAt: new Date(request.body.startsAt),
				endsAt: new Date(request.body.endsAt),
			});
			if (!session) return reply.status(404).send({ message: "Cohort not found" });
			return reply.status(201).send(session);
		},
	);

	app.get(
		"/cohorts/:cohortId/sessions",
		{
			schema: {
				params: cohortIdParamSchema,
			},
		},
		async (request: FastifyRequest<{ Params: { cohortId: string } }>, reply) => {
			const roleContext = await requireRole(app, request, reply, ["admin", "instructor"]);
			if (!roleContext) return;
			const sessions = await listSessionsByCohort(request.params.cohortId);
			return reply.send({ sessions });
		},
	);

	app.post(
		"/courses/:courseId/cohorts/:cohortId/enroll",
		{
			schema: {
				params: enrollParamsSchema,
				response: {
					200: { type: "object", properties: { success: { type: "boolean" } }, required: ["success"] },
					401: { type: "object", properties: { message: { type: "string" } }, required: ["message"] },
					409: { type: "object", properties: { message: { type: "string" } }, required: ["message"] },
				},
			},
		},
		async (request: FastifyRequest<{ Params: { courseId: string; cohortId: string } }>, reply) => {
			const email = getEmailFromAuthHeader(request, app);
			if (!email) return reply.status(401).send({ message: "Unauthorized" });

			const success = await enrollUserInCohort(request.params.courseId, request.params.cohortId, email);
			if (!success) return reply.status(409).send({ message: "Unable to enroll in cohort" });
			return reply.send({ success: true });
		},
	);

	app.post(
		"/users/me/cohorts/:cohortId/sessions/:sessionId/book",
		{
			schema: {
				params: bookSessionParamsSchema,
				response: {
					200: { type: "object", properties: { success: { type: "boolean" } }, required: ["success"] },
					401: { type: "object", properties: { message: { type: "string" } }, required: ["message"] },
					409: { type: "object", properties: { message: { type: "string" } }, required: ["message"] },
				},
			},
		},
		async (request: FastifyRequest<{ Params: { cohortId: string; sessionId: string } }>, reply) => {
			const email = getEmailFromAuthHeader(request, app);
			if (!email) return reply.status(401).send({ message: "Unauthorized" });
			const success = await bookSessionForUser(email, request.params.cohortId, request.params.sessionId);
			if (!success) return reply.status(409).send({ message: "Unable to book session" });
			return reply.send({ success: true });
		},
	);
}
