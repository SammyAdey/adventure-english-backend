import { FastifyInstance } from "fastify";
import { connectToDatabase } from "../utils/mongo";
import { requireRole } from "../utils/auth";

export default async function dashboardRoutes(app: FastifyInstance) {
	app.get(
		"/dashboard/metrics",
		{
			schema: {
				response: {
					200: {
						type: "object",
						required: ["totalUsers", "activeUsers", "totalCourses", "newEnrollmentsThisMonth"],
						properties: {
							totalUsers: { type: "number" },
							activeUsers: { type: "number" },
							totalCourses: { type: "number" },
							newEnrollmentsThisMonth: { type: "number" },
						},
					},
				},
			},
		},
		async (request, reply) => {
			const roleContext = await requireRole(app, request, reply, ["admin", "instructor"]);
			if (!roleContext) return;

			const db = await connectToDatabase();
			const usersCollection = db.collection("users");
			const coursesCollection = db.collection("courses");

			const startOfMonth = new Date();
			startOfMonth.setUTCDate(1);
			startOfMonth.setUTCHours(0, 0, 0, 0);

			const [totalUsers, activeUsers, totalCourses, newEnrollmentsAgg] = await Promise.all([
				usersCollection.countDocuments({}),
				usersCollection.countDocuments({ status: "active" }),
				coursesCollection.countDocuments({}),
				usersCollection
					.aggregate<{ total: number }>([
						{ $unwind: { path: "$enrollments", preserveNullAndEmptyArrays: false } },
						{ $match: { "enrollments.enrolledAt": { $gte: startOfMonth } } },
						{ $count: "total" },
					])
					.toArray(),
			]);

			return reply.send({
				totalUsers,
				activeUsers,
				totalCourses,
				newEnrollmentsThisMonth: newEnrollmentsAgg[0]?.total ?? 0,
			});
		},
	);
}
