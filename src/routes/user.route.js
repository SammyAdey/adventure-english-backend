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
exports.default = userRoutes;
const user_service_1 = require("../services/user.service");
const auth_1 = require("../utils/auth");
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
};
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
};
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
};
const deleteUserParamsSchema = {
    type: "object",
    required: ["userId"],
    properties: {
        userId: { type: "string", minLength: 24, maxLength: 24 },
    },
};
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
};
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
};
const purchaseParamsSchema = {
    type: "object",
    required: ["userId", "courseId"],
    properties: {
        userId: { type: "string", minLength: 24, maxLength: 24 },
        courseId: { type: "string", minLength: 1 },
    },
};
const createUserPurchaseSchema = {
    body: purchasedCourseSchema,
    params: deleteUserParamsSchema,
};
const updateUserPurchaseSchema = {
    body: {
        type: "object",
        additionalProperties: false,
        properties: purchasedCourseSchema.properties,
        minProperties: 1,
    },
    params: purchaseParamsSchema,
};
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
};
const meCourseProgressParamsSchema = {
    type: "object",
    required: ["courseId"],
    properties: {
        courseId: { type: "string", minLength: 1 },
    },
};
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
};
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
};
const meActivityItemSchema = {
    type: "object",
    required: ["id", "label", "timeLabel"],
    additionalProperties: false,
    properties: {
        id: { type: "string" },
        label: { type: "string" },
        timeLabel: { type: "string" },
    },
};
const getEmailFromAuthHeader = (request, app) => {
    var _a;
    const decoded = (0, auth_1.verifyAuthToken)(app, request);
    return (_a = decoded === null || decoded === void 0 ? void 0 : decoded.email) !== null && _a !== void 0 ? _a : null;
};
function userRoutes(app) {
    return __awaiter(this, void 0, void 0, function* () {
        app.get("/users/me", {
            schema: {
                response: {
                    200: userResponseSchema,
                    401: { type: "object", required: ["message"], properties: { message: { type: "string" } } },
                    404: { type: "object", required: ["message"], properties: { message: { type: "string" } } },
                },
            },
        }, (request, reply) => __awaiter(this, void 0, void 0, function* () {
            const email = getEmailFromAuthHeader(request, app);
            if (!email)
                return reply.status(401).send({ message: "Unauthorized" });
            const user = yield (0, user_service_1.getUserByEmail)(email);
            if (!user)
                return reply.status(404).send({ message: "User not found" });
            return reply.send(user);
        }));
        app.patch("/users/me", {
            schema: Object.assign(Object.assign({}, meProfileUpdateSchema), { response: {
                    200: userResponseSchema,
                    401: { type: "object", required: ["message"], properties: { message: { type: "string" } } },
                    404: { type: "object", required: ["message"], properties: { message: { type: "string" } } },
                } }),
        }, (request, reply) => __awaiter(this, void 0, void 0, function* () {
            const email = getEmailFromAuthHeader(request, app);
            if (!email)
                return reply.status(401).send({ message: "Unauthorized" });
            const updated = yield (0, user_service_1.updateUserByEmail)(email, request.body);
            if (!updated)
                return reply.status(404).send({ message: "User not found" });
            return reply.send(updated);
        }));
        app.get("/users/me/dashboard", {
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
        }, (request, reply) => __awaiter(this, void 0, void 0, function* () {
            const email = getEmailFromAuthHeader(request, app);
            if (!email)
                return reply.status(401).send({ message: "Unauthorized" });
            const summary = yield (0, user_service_1.getUserDashboardSummary)(email);
            if (!summary)
                return reply.status(404).send({ message: "User not found" });
            return reply.send(summary);
        }));
        app.get("/users/me/courses", {
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
        }, (request, reply) => __awaiter(this, void 0, void 0, function* () {
            const email = getEmailFromAuthHeader(request, app);
            if (!email)
                return reply.status(401).send({ message: "Unauthorized" });
            const courses = yield (0, user_service_1.getUserEnrolledCourses)(email);
            if (!courses)
                return reply.status(404).send({ message: "User not found" });
            return reply.send({ courses });
        }));
        app.patch("/users/me/courses/:courseId/progress", {
            schema: Object.assign(Object.assign({}, meCourseProgressSchema), { response: {
                    200: userResponseSchema,
                    401: { type: "object", required: ["message"], properties: { message: { type: "string" } } },
                    404: { type: "object", required: ["message"], properties: { message: { type: "string" } } },
                } }),
        }, (request, reply) => __awaiter(this, void 0, void 0, function* () {
            const email = getEmailFromAuthHeader(request, app);
            if (!email)
                return reply.status(401).send({ message: "Unauthorized" });
            const updated = yield (0, user_service_1.updateUserCourseProgressByEmail)(email, request.params.courseId, request.body.progressPercent);
            if (!updated)
                return reply.status(404).send({ message: "User or enrollment not found" });
            return reply.send(updated);
        }));
        app.get("/users/me/activity", {
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
        }, (request, reply) => __awaiter(this, void 0, void 0, function* () {
            const email = getEmailFromAuthHeader(request, app);
            if (!email)
                return reply.status(401).send({ message: "Unauthorized" });
            const activity = yield (0, user_service_1.getUserActivityFeed)(email);
            if (!activity)
                return reply.status(404).send({ message: "User not found" });
            return reply.send({ activity });
        }));
        app.get("/users", {
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
        }, (_request, reply) => __awaiter(this, void 0, void 0, function* () {
            const roleContext = yield (0, auth_1.requireRole)(app, _request, reply, ["admin", "instructor"]);
            if (!roleContext)
                return;
            const users = yield (0, user_service_1.listUsers)();
            return reply.send({ users });
        }));
        app.post("/users", {
            schema: createUserSchema,
        }, (request, reply) => __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            try {
                const roleContext = yield (0, auth_1.requireRole)(app, request, reply, ["admin", "instructor"]);
                if (!roleContext)
                    return;
                const user = yield (0, user_service_1.createUser)({
                    firstName: request.body.firstName,
                    lastName: request.body.lastName,
                    email: request.body.email,
                    role: request.body.role,
                    status: request.body.status,
                    purchasedCourses: (_a = request.body.purchasedCourses) === null || _a === void 0 ? void 0 : _a.map((course) => (Object.assign(Object.assign({}, course), { purchasedAt: new Date(course.purchasedAt), lastAccessedAt: course.lastAccessedAt ? new Date(course.lastAccessedAt) : undefined }))),
                    enrollments: (_b = request.body.enrollments) === null || _b === void 0 ? void 0 : _b.map((enrollment) => (Object.assign(Object.assign({}, enrollment), { enrolledAt: new Date(enrollment.enrolledAt), lastAccessedAt: enrollment.lastAccessedAt ? new Date(enrollment.lastAccessedAt) : undefined, completedAt: enrollment.completedAt ? new Date(enrollment.completedAt) : undefined, accessExpiresAt: enrollment.accessExpiresAt ? new Date(enrollment.accessExpiresAt) : undefined }))),
                });
                return reply.status(201).send(user);
            }
            catch (error) {
                app.log.error({ err: error }, "Failed to create user");
                return reply.status(500).send({ message: "Failed to create user" });
            }
        }));
        app.delete("/users/:userId", {
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
        }, (request, reply) => __awaiter(this, void 0, void 0, function* () {
            const roleContext = yield (0, auth_1.requireRole)(app, request, reply, ["admin", "instructor"]);
            if (!roleContext)
                return;
            const success = yield (0, user_service_1.deleteUser)(request.params.userId);
            if (!success) {
                return reply.status(404).send({ message: "User not found" });
            }
            return reply.status(204).send();
        }));
        app.patch("/users/:userId", {
            schema: Object.assign(Object.assign({}, updateUserSchema), { response: {
                    200: userResponseSchema,
                    404: {
                        type: "object",
                        required: ["message"],
                        properties: {
                            message: { type: "string" },
                        },
                    },
                } }),
        }, (request, reply) => __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            try {
                const roleContext = yield (0, auth_1.requireRole)(app, request, reply, ["admin", "instructor"]);
                if (!roleContext)
                    return;
                const updated = yield (0, user_service_1.updateUser)(request.params.userId, {
                    role: request.body.role,
                    status: request.body.status,
                    purchasedCourses: (_a = request.body.purchasedCourses) === null || _a === void 0 ? void 0 : _a.map((course) => (Object.assign(Object.assign({}, course), { purchasedAt: new Date(course.purchasedAt), lastAccessedAt: course.lastAccessedAt ? new Date(course.lastAccessedAt) : undefined }))),
                    enrollments: (_b = request.body.enrollments) === null || _b === void 0 ? void 0 : _b.map((enrollment) => (Object.assign(Object.assign({}, enrollment), { enrolledAt: new Date(enrollment.enrolledAt), lastAccessedAt: enrollment.lastAccessedAt ? new Date(enrollment.lastAccessedAt) : undefined, completedAt: enrollment.completedAt ? new Date(enrollment.completedAt) : undefined, accessExpiresAt: enrollment.accessExpiresAt ? new Date(enrollment.accessExpiresAt) : undefined }))),
                });
                if (!updated) {
                    return reply.status(404).send({ message: "User not found" });
                }
                return reply.send(updated);
            }
            catch (error) {
                app.log.error({ err: error }, "Failed to update user");
                return reply.status(500).send({ message: "Failed to update user" });
            }
        }));
        app.post("/users/:userId/purchases", {
            schema: Object.assign(Object.assign({}, createUserPurchaseSchema), { response: {
                    200: userResponseSchema,
                    404: {
                        type: "object",
                        required: ["message"],
                        properties: { message: { type: "string" } },
                    },
                } }),
        }, (request, reply) => __awaiter(this, void 0, void 0, function* () {
            const roleContext = yield (0, auth_1.requireRole)(app, request, reply, ["admin", "instructor"]);
            if (!roleContext)
                return;
            const updatedUser = yield (0, user_service_1.addUserPurchase)(request.params.userId, Object.assign(Object.assign({}, request.body), { purchasedAt: new Date(request.body.purchasedAt), lastAccessedAt: request.body.lastAccessedAt ? new Date(request.body.lastAccessedAt) : undefined }));
            if (!updatedUser) {
                return reply.status(404).send({ message: "User not found" });
            }
            return reply.send(updatedUser);
        }));
        app.patch("/users/:userId/purchases/:courseId", {
            schema: Object.assign(Object.assign({}, updateUserPurchaseSchema), { response: {
                    200: userResponseSchema,
                    404: {
                        type: "object",
                        required: ["message"],
                        properties: { message: { type: "string" } },
                    },
                } }),
        }, (request, reply) => __awaiter(this, void 0, void 0, function* () {
            const roleContext = yield (0, auth_1.requireRole)(app, request, reply, ["admin", "instructor"]);
            if (!roleContext)
                return;
            const updatedUser = yield (0, user_service_1.updateUserPurchase)(request.params.userId, request.params.courseId, Object.assign(Object.assign({}, request.body), { purchasedAt: request.body.purchasedAt ? new Date(request.body.purchasedAt) : undefined, lastAccessedAt: request.body.lastAccessedAt ? new Date(request.body.lastAccessedAt) : undefined }));
            if (!updatedUser) {
                return reply.status(404).send({ message: "User or purchase not found" });
            }
            return reply.send(updatedUser);
        }));
    });
}
