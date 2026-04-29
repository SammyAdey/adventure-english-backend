import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { getUserByEmail } from "../services/user.service";
import { UserRole } from "../dto/users.dto";

export type AuthTokenPayload = {
	email: string;
	role?: UserRole;
	sub?: string;
	iat?: number;
	exp?: number;
	iss?: string;
	aud?: string;
};

const getBearerToken = (request: FastifyRequest): string | null => {
	const authHeader = request.headers.authorization;
	if (!authHeader?.startsWith("Bearer ")) {
		return null;
	}
	return authHeader.replace("Bearer ", "");
};

export const verifyAuthToken = (
	app: FastifyInstance,
	request: FastifyRequest,
): AuthTokenPayload | null => {
	const token = getBearerToken(request);
	if (!token) {
		return null;
	}
	try {
		return app.jwt.verify<AuthTokenPayload>(token);
	} catch {
		return null;
	}
};

export const requireRole = async (
	app: FastifyInstance,
	request: FastifyRequest,
	reply: FastifyReply,
	allowedRoles: UserRole[],
): Promise<AuthTokenPayload | null> => {
	const decoded = verifyAuthToken(app, request);
	if (!decoded?.email) {
		reply.status(401).send({ message: "Unauthorized" });
		return null;
	}

	const user = await getUserByEmail(decoded.email);
	if (!user?.role || !allowedRoles.includes(user.role)) {
		reply.status(403).send({ message: "Forbidden" });
		return null;
	}

	return { ...decoded, role: user.role, sub: user.id };
};
