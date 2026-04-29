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
exports.default = dashboardRoutes;
const mongo_1 = require("../utils/mongo");
const auth_1 = require("../utils/auth");
function dashboardRoutes(app) {
    return __awaiter(this, void 0, void 0, function* () {
        app.get("/dashboard/metrics", {
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
        }, (request, reply) => __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            const roleContext = yield (0, auth_1.requireRole)(app, request, reply, ["admin", "instructor"]);
            if (!roleContext)
                return;
            const db = yield (0, mongo_1.connectToDatabase)();
            const usersCollection = db.collection("users");
            const coursesCollection = db.collection("courses");
            const startOfMonth = new Date();
            startOfMonth.setUTCDate(1);
            startOfMonth.setUTCHours(0, 0, 0, 0);
            const [totalUsers, activeUsers, totalCourses, newEnrollmentsAgg] = yield Promise.all([
                usersCollection.countDocuments({}),
                usersCollection.countDocuments({ status: "active" }),
                coursesCollection.countDocuments({}),
                usersCollection
                    .aggregate([
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
                newEnrollmentsThisMonth: (_b = (_a = newEnrollmentsAgg[0]) === null || _a === void 0 ? void 0 : _a.total) !== null && _b !== void 0 ? _b : 0,
            });
        }));
    });
}
