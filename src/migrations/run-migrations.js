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
exports.runMigrations = void 0;
const mongo_1 = require("../utils/mongo");
const COLLECTION = "_migrations";
const migrations = [
    {
        id: "2026-04-28-backfill-course-target",
        description: "Backfill courses.target from legacy level values",
        run: (db) => __awaiter(void 0, void 0, void 0, function* () {
            yield db.collection("courses").updateMany({
                target: { $exists: false },
                level: { $type: "string" },
            }, [
                {
                    $set: {
                        target: "$level",
                        updatedAt: new Date(),
                    },
                },
            ]);
        }),
    },
    {
        id: "2026-04-28-backfill-course-delivery-defaults",
        description: "Backfill delivery defaults for existing courses",
        run: (db) => __awaiter(void 0, void 0, void 0, function* () {
            yield db.collection("courses").updateMany({ deliveryMode: { $exists: false } }, { $set: { deliveryMode: "online", updatedAt: new Date() } });
            yield db.collection("courses").updateMany({ isSoldOut: { $exists: false } }, { $set: { isSoldOut: false, updatedAt: new Date() } });
        }),
    },
    {
        id: "2026-04-28-create-core-indexes",
        description: "Create core indexes for users/courses/cohorts/sessions/attendance",
        run: (db) => __awaiter(void 0, void 0, void 0, function* () {
            yield db.collection("users").createIndex({ email: 1 }, { unique: true, name: "users_email_unique" });
            yield db.collection("courses").createIndex({ courseId: 1 }, { unique: true, sparse: true, name: "courses_courseId_unique" });
            yield db.collection("courses").createIndex({ slug: 1 }, { unique: true, sparse: true, name: "courses_slug_unique" });
            yield db.collection("cohorts").createIndex({ cohortId: 1 }, { unique: true, name: "cohorts_cohortId_unique" });
            yield db.collection("cohorts").createIndex({ courseId: 1, status: 1 }, { name: "cohorts_course_status" });
            yield db.collection("sessions").createIndex({ sessionId: 1 }, { unique: true, name: "sessions_sessionId_unique" });
            yield db.collection("sessions").createIndex({ cohortId: 1, startsAt: 1 }, { name: "sessions_cohort_startsAt" });
            yield db.collection("sessions").createIndex({ calBookingUid: 1 }, { unique: true, sparse: true, name: "sessions_calBookingUid_unique" });
            yield db.collection("attendance").createIndex({ userId: 1, sessionId: 1 }, { unique: true, name: "attendance_user_session_unique" });
            yield db.collection("attendance").createIndex({ courseId: 1, cohortId: 1, status: 1 }, { name: "attendance_course_cohort_status" });
        }),
    },
];
const runMigrations = () => __awaiter(void 0, void 0, void 0, function* () {
    const db = yield (0, mongo_1.connectToDatabase)();
    const migrationCollection = db.collection(COLLECTION);
    yield migrationCollection.createIndex({ id: 1 }, { unique: true, name: "migration_id_unique" });
    for (const migration of migrations) {
        const alreadyApplied = yield migrationCollection.findOne({ id: migration.id });
        if (alreadyApplied) {
            continue;
        }
        yield migration.run(db);
        yield migrationCollection.insertOne({
            id: migration.id,
            appliedAt: new Date(),
            description: migration.description,
        });
    }
});
exports.runMigrations = runMigrations;
