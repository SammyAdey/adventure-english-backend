import { FastifyInstance, FastifyRequest } from "fastify";
import { connectToDatabase } from "../utils/mongo";
import { getUserCollection, initUserCollection } from "../models/user.model";
import { hashPassword, isPasswordHash, verifyPassword } from "../utils/password";

interface LoginBody {
	email: string;
	password: string;
}

interface ValidateRequest extends FastifyRequest {
	headers: {
		authorization?: string;
	};
}

interface RegisterBody {
	password: string;
	email: string;
	firstName: string;
	lastName: string;
}

const jwtIssuer = process.env.JWT_ISSUER ?? "adventure-english-backend";
const jwtAudience = process.env.JWT_AUDIENCE ?? "adventure-english-clients";
const jwtExpiresIn = process.env.JWT_EXPIRES_IN ?? "7d";

const buildAuthToken = (
	app: FastifyInstance,
	payload: { userId: string; email: string; role: "student" | "instructor" | "admin" },
) =>
	app.jwt.sign(
		{
			sub: payload.userId,
			email: payload.email,
			role: payload.role,
			iss: jwtIssuer,
			aud: jwtAudience,
		},
		{
			expiresIn: jwtExpiresIn,
		},
	);

export default async function authRoutes(app: FastifyInstance) {
	app.post("/auth/validate", async (request: ValidateRequest, reply) => {
		try {
			const authHeader = request.headers.authorization;
			if (!authHeader) {
				return reply.status(401).send({ message: "Missing token" });
			}

			const token = authHeader.replace("Bearer ", "");
			const decoded = app.jwt.verify(token);
			return reply.send({ valid: true, user: decoded });
		} catch (_error) {
			return reply.status(401).send({ message: "Invalid or expired token" });
		}
	});

	app.post("/auth/login", async (request: FastifyRequest<{ Body: LoginBody }>, reply) => {
		const { email, password } = request.body;

		const db = await connectToDatabase();
		initUserCollection(db);
		const users = getUserCollection();

		const user = await users.findOne({ email });
		if (!user || !user._id || !user.password) {
			return reply.status(401).send({ message: "No user with this email was found" });
		}

		const passwordMatches = await verifyPassword(password, user.password);
		if (!passwordMatches) {
			return reply.status(401).send({ message: "Username or password is incorrect" });
		}

		// Transparent migration: if a legacy plaintext password is used successfully,
		// replace it with a secure hash.
		if (!isPasswordHash(user.password)) {
			const upgradedHash = await hashPassword(password);
			await users.updateOne(
				{ _id: user._id },
				{
					$set: {
						password: upgradedHash,
						updatedAt: new Date(),
					},
				},
			);
		}

		const token = buildAuthToken(app, {
			userId: user._id.toHexString(),
			email: user.email,
			role: user.role ?? "student",
		});

		return reply.send({
			email: user.email,
			firstName: user.firstName,
			lastName: user.lastName,
			token,
		});
	});

	app.post("/auth/register", async (request: FastifyRequest<{ Body: RegisterBody }>, reply) => {
		const db = await connectToDatabase();
		initUserCollection(db);
		const users = getUserCollection();

		const { password, email, firstName, lastName } = request.body;

		const existingUser = await users.findOne({ email });
		if (existingUser) {
			return reply.status(400).send({ message: "User already exists" });
		}

		const passwordHash = await hashPassword(password);
		const createdAt = new Date();
		const result = await users.insertOne({
			password: passwordHash,
			email,
			firstName,
			lastName,
			role: "student",
			status: "active",
			createdAt,
			updatedAt: createdAt,
		});

		const token = buildAuthToken(app, {
			userId: result.insertedId.toHexString(),
			email,
			role: "student",
		});

		return reply.send({
			message: "Registered successfully",
			email,
			firstName,
			lastName,
			token,
		});
	});
}
