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
exports.default = cohortRoutes;
const cohort_service_1 = require("../services/cohort.service");
const auth_1 = require("../utils/auth");
const courseIdParamSchema = {
    type: "object",
    required: ["courseId"],
    properties: {
        courseId: { type: "string", minLength: 1 },
    },
};
const cohortIdParamSchema = {
    type: "object",
    required: ["cohortId"],
    properties: {
        cohortId: { type: "string", minLength: 1 },
    },
};
const enrollParamsSchema = {
    type: "object",
    required: ["courseId", "cohortId"],
    properties: {
        courseId: { type: "string", minLength: 1 },
        cohortId: { type: "string", minLength: 1 },
    },
};
const bookSessionParamsSchema = {
    type: "object",
    required: ["cohortId", "sessionId"],
    properties: {
        cohortId: { type: "string", minLength: 1 },
        sessionId: { type: "string", minLength: 1 },
    },
};
const getEmailFromAuthHeader = (request, app) => {
    var _a;
    const decoded = (0, auth_1.verifyAuthToken)(app, request);
    return (_a = decoded === null || decoded === void 0 ? void 0 : decoded.email) !== null && _a !== void 0 ? _a : null;
};
function cohortRoutes(app) {
    return __awaiter(this, void 0, void 0, function* () {
        app.post("/cohorts", {
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
        }, (request, reply) => __awaiter(this, void 0, void 0, function* () {
            const roleContext = yield (0, auth_1.requireRole)(app, request, reply, ["admin", "instructor"]);
            if (!roleContext)
                return;
            const cohort = yield (0, cohort_service_1.createCohort)(request.body);
            if (!cohort)
                return reply.status(404).send({ message: "Course not found" });
            return reply.status(201).send(cohort);
        }));
        app.get("/courses/:courseId/cohorts", {
            schema: {
                params: courseIdParamSchema,
            },
        }, (request, reply) => __awaiter(this, void 0, void 0, function* () {
            const roleContext = yield (0, auth_1.requireRole)(app, request, reply, ["admin", "instructor"]);
            if (!roleContext)
                return;
            const cohorts = yield (0, cohort_service_1.listCohortsByCourse)(request.params.courseId);
            return reply.send({ cohorts });
        }));
        app.post("/cohorts/:cohortId/sessions", {
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
        }, (request, reply) => __awaiter(this, void 0, void 0, function* () {
            const roleContext = yield (0, auth_1.requireRole)(app, request, reply, ["admin", "instructor"]);
            if (!roleContext)
                return;
            const session = yield (0, cohort_service_1.createSession)(Object.assign(Object.assign({}, request.body), { cohortId: request.params.cohortId, startsAt: new Date(request.body.startsAt), endsAt: new Date(request.body.endsAt) }));
            if (!session)
                return reply.status(404).send({ message: "Cohort not found" });
            return reply.status(201).send(session);
        }));
        app.get("/cohorts/:cohortId/sessions", {
            schema: {
                params: cohortIdParamSchema,
            },
        }, (request, reply) => __awaiter(this, void 0, void 0, function* () {
            const roleContext = yield (0, auth_1.requireRole)(app, request, reply, ["admin", "instructor"]);
            if (!roleContext)
                return;
            const sessions = yield (0, cohort_service_1.listSessionsByCohort)(request.params.cohortId);
            return reply.send({ sessions });
        }));
        app.post("/courses/:courseId/cohorts/:cohortId/enroll", {
            schema: {
                params: enrollParamsSchema,
                response: {
                    200: { type: "object", properties: { success: { type: "boolean" } }, required: ["success"] },
                    401: { type: "object", properties: { message: { type: "string" } }, required: ["message"] },
                    409: { type: "object", properties: { message: { type: "string" } }, required: ["message"] },
                },
            },
        }, (request, reply) => __awaiter(this, void 0, void 0, function* () {
            const email = getEmailFromAuthHeader(request, app);
            if (!email)
                return reply.status(401).send({ message: "Unauthorized" });
            const success = yield (0, cohort_service_1.enrollUserInCohort)(request.params.courseId, request.params.cohortId, email);
            if (!success)
                return reply.status(409).send({ message: "Unable to enroll in cohort" });
            return reply.send({ success: true });
        }));
        app.post("/users/me/cohorts/:cohortId/sessions/:sessionId/book", {
            schema: {
                params: bookSessionParamsSchema,
                response: {
                    200: { type: "object", properties: { success: { type: "boolean" } }, required: ["success"] },
                    401: { type: "object", properties: { message: { type: "string" } }, required: ["message"] },
                    409: { type: "object", properties: { message: { type: "string" } }, required: ["message"] },
                },
            },
        }, (request, reply) => __awaiter(this, void 0, void 0, function* () {
            const email = getEmailFromAuthHeader(request, app);
            if (!email)
                return reply.status(401).send({ message: "Unauthorized" });
            const success = yield (0, cohort_service_1.bookSessionForUser)(email, request.params.cohortId, request.params.sessionId);
            if (!success)
                return reply.status(409).send({ message: "Unable to book session" });
            return reply.send({ success: true });
        }));
    });
}
