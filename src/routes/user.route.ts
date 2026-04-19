import { FastifyInstance, FastifyRequest } from "fastify";
import { createUser, deleteUser, listUsers, updateUser } from "../services/user.service";

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
		},
		minProperties: 1,
	},
	params: deleteUserParamsSchema,
} as const;

export default async function userRoutes(app: FastifyInstance) {
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
			const users = await listUsers();
			return reply.send({ users });
		},
	);

	app.post(
		"/users",
		{
			schema: createUserSchema,
		},
		async (request: FastifyRequest<{ Body: { firstName: string; lastName: string; email: string; role?: string; status?: string } }>, reply) => {
			try {
				const user = await createUser({
					firstName: request.body.firstName,
					lastName: request.body.lastName,
					email: request.body.email,
					role: request.body.role as "student" | "instructor" | "teacher" | "admin" | undefined,
					status: request.body.status as "active" | "invited" | "suspended" | undefined,
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
			request: FastifyRequest<{ Params: { userId: string }; Body: { role?: string; status?: string } }>,
			reply,
		) => {
			try {
				const updated = await updateUser(request.params.userId, {
					role: request.body.role as "student" | "instructor" | "teacher" | "admin" | undefined,
					status: request.body.status as "active" | "invited" | "suspended" | undefined,
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
}
