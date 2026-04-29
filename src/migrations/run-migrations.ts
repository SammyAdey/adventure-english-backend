import { Db } from "mongodb";
import { connectToDatabase } from "../utils/mongo";

type Migration = {
	id: string;
	description: string;
	run: (db: Db) => Promise<void>;
};

const COLLECTION = "_migrations";

const migrations: Migration[] = [
	{
		id: "2026-04-28-backfill-course-target",
		description: "Backfill courses.target from legacy level values",
		run: async (db) => {
			await db.collection("courses").updateMany(
				{
					target: { $exists: false },
					level: { $type: "string" },
				},
				[
					{
						$set: {
							target: "$level",
							updatedAt: new Date(),
						},
					},
				],
			);
		},
	},
	{
		id: "2026-04-28-backfill-course-delivery-defaults",
		description: "Backfill delivery defaults for existing courses",
		run: async (db) => {
			await db.collection("courses").updateMany(
				{ deliveryMode: { $exists: false } },
				{ $set: { deliveryMode: "online", updatedAt: new Date() } },
			);
			await db.collection("courses").updateMany(
				{ isSoldOut: { $exists: false } },
				{ $set: { isSoldOut: false, updatedAt: new Date() } },
			);
		},
	},
	{
		id: "2026-04-28-create-core-indexes",
		description: "Create core indexes for users/courses/cohorts/sessions/attendance",
		run: async (db) => {
			await db.collection("users").createIndex({ email: 1 }, { unique: true, name: "users_email_unique" });
			await db.collection("courses").createIndex({ courseId: 1 }, { unique: true, sparse: true, name: "courses_courseId_unique" });
			await db.collection("courses").createIndex({ slug: 1 }, { unique: true, sparse: true, name: "courses_slug_unique" });
			await db.collection("cohorts").createIndex({ cohortId: 1 }, { unique: true, name: "cohorts_cohortId_unique" });
			await db.collection("cohorts").createIndex({ courseId: 1, status: 1 }, { name: "cohorts_course_status" });
			await db.collection("sessions").createIndex({ sessionId: 1 }, { unique: true, name: "sessions_sessionId_unique" });
			await db.collection("sessions").createIndex({ cohortId: 1, startsAt: 1 }, { name: "sessions_cohort_startsAt" });
			await db.collection("sessions").createIndex({ calBookingUid: 1 }, { unique: true, sparse: true, name: "sessions_calBookingUid_unique" });
			await db.collection("attendance").createIndex({ userId: 1, sessionId: 1 }, { unique: true, name: "attendance_user_session_unique" });
			await db.collection("attendance").createIndex({ courseId: 1, cohortId: 1, status: 1 }, { name: "attendance_course_cohort_status" });
		},
	},
];

export const runMigrations = async (): Promise<void> => {
	const db = await connectToDatabase();
	const migrationCollection = db.collection<{ id: string; appliedAt: Date; description: string }>(COLLECTION);
	await migrationCollection.createIndex({ id: 1 }, { unique: true, name: "migration_id_unique" });

	for (const migration of migrations) {
		const alreadyApplied = await migrationCollection.findOne({ id: migration.id });
		if (alreadyApplied) {
			continue;
		}
		await migration.run(db);
		await migrationCollection.insertOne({
			id: migration.id,
			appliedAt: new Date(),
			description: migration.description,
		});
	}
};
