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
exports.syncCalWebhookEvent = exports.bookSessionForUser = exports.enrollUserInCohort = exports.listSessionsByCohort = exports.createSession = exports.listCohortsByCourse = exports.createCohort = void 0;
const crypto_1 = require("crypto");
const mongodb_1 = require("mongodb");
const attendance_model_1 = require("../models/attendance.model");
const cohort_model_1 = require("../models/cohort.model");
const session_model_1 = require("../models/session.model");
const user_model_1 = require("../models/user.model");
const mongo_1 = require("../utils/mongo");
const ALPHANUMERIC_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const generateIdSuffix = (length) => Array.from({ length }, () => ALPHANUMERIC_CHARS[(0, crypto_1.randomInt)(0, ALPHANUMERIC_CHARS.length)]).join("");
const buildCohortId = () => `COH-${generateIdSuffix(8)}`;
const buildSessionId = () => `SES-${generateIdSuffix(8)}`;
const buildAttendanceId = () => `ATT-${generateIdSuffix(10)}`;
const mapCohort = (cohort) => ({
    id: cohort._id.toHexString(),
    cohortId: cohort.cohortId,
    courseId: cohort.courseId,
    name: cohort.name,
    location: cohort.location,
    timezone: cohort.timezone,
    capacityPerSession: cohort.capacityPerSession,
    maxEnrollments: cohort.maxEnrollments,
    enrollmentCount: cohort.enrollmentCount,
    recommendedSessionsPerWeek: cohort.recommendedSessionsPerWeek,
    sessionCount: cohort.sessionCount,
    status: cohort.status,
    createdAt: cohort.createdAt,
    updatedAt: cohort.updatedAt,
});
const mapSession = (session) => ({
    id: session._id.toHexString(),
    sessionId: session.sessionId,
    cohortId: session.cohortId,
    startsAt: session.startsAt,
    endsAt: session.endsAt,
    capacity: session.capacity,
    bookedCount: session.bookedCount,
    status: session.status,
    calEventTypeId: session.calEventTypeId,
    calBookingUid: session.calBookingUid,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
});
const findCourseByIdentifier = (courseId) => __awaiter(void 0, void 0, void 0, function* () {
    const db = yield (0, mongo_1.connectToDatabase)();
    const courses = db.collection("courses");
    const normalized = courseId.trim().toLowerCase();
    const isObjectId = mongodb_1.ObjectId.isValid(courseId);
    const course = yield courses.findOne(isObjectId
        ? { _id: new mongodb_1.ObjectId(courseId) }
        : {
            $or: [{ courseId }, { courseId: courseId.toUpperCase() }, { slug: normalized }],
        });
    if (!course || !course._id)
        return null;
    return course;
});
const createCohort = (payload) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c;
    const db = yield (0, mongo_1.connectToDatabase)();
    (0, cohort_model_1.initCohortCollection)(db);
    const cohortCollection = (0, cohort_model_1.getCohortCollection)();
    const course = yield findCourseByIdentifier(payload.courseId);
    if (!course)
        return null;
    const now = new Date();
    const document = {
        cohortId: buildCohortId(),
        courseId: (_a = course.courseId) !== null && _a !== void 0 ? _a : course._id.toHexString(),
        name: payload.name,
        location: payload.location,
        timezone: payload.timezone,
        capacityPerSession: (_b = payload.capacityPerSession) !== null && _b !== void 0 ? _b : 5,
        maxEnrollments: payload.maxEnrollments,
        enrollmentCount: 0,
        recommendedSessionsPerWeek: payload.recommendedSessionsPerWeek,
        sessionCount: payload.sessionCount,
        status: (_c = payload.status) !== null && _c !== void 0 ? _c : "open",
        createdAt: now,
        updatedAt: now,
    };
    const result = yield cohortCollection.insertOne(document);
    return mapCohort(Object.assign(Object.assign({}, document), { _id: result.insertedId }));
});
exports.createCohort = createCohort;
const listCohortsByCourse = (courseId) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const db = yield (0, mongo_1.connectToDatabase)();
    (0, cohort_model_1.initCohortCollection)(db);
    const cohortCollection = (0, cohort_model_1.getCohortCollection)();
    const course = yield findCourseByIdentifier(courseId);
    if (!course)
        return [];
    const resolvedCourseId = (_a = course.courseId) !== null && _a !== void 0 ? _a : course._id.toHexString();
    const cohorts = yield cohortCollection.find({ courseId: resolvedCourseId }).sort({ createdAt: 1 }).toArray();
    return cohorts.filter((c) => Boolean(c._id)).map(mapCohort);
});
exports.listCohortsByCourse = listCohortsByCourse;
const createSession = (payload) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    const db = yield (0, mongo_1.connectToDatabase)();
    (0, cohort_model_1.initCohortCollection)(db);
    (0, session_model_1.initSessionCollection)(db);
    const cohortCollection = (0, cohort_model_1.getCohortCollection)();
    const sessionCollection = (0, session_model_1.getSessionCollection)();
    const cohort = yield cohortCollection.findOne({ cohortId: payload.cohortId });
    if (!cohort || !cohort._id)
        return null;
    const now = new Date();
    const document = {
        sessionId: buildSessionId(),
        cohortId: payload.cohortId,
        startsAt: payload.startsAt,
        endsAt: payload.endsAt,
        capacity: (_a = payload.capacity) !== null && _a !== void 0 ? _a : cohort.capacityPerSession,
        bookedCount: 0,
        status: (_b = payload.status) !== null && _b !== void 0 ? _b : "scheduled",
        calEventTypeId: payload.calEventTypeId,
        createdAt: now,
        updatedAt: now,
    };
    const result = yield sessionCollection.insertOne(document);
    return mapSession(Object.assign(Object.assign({}, document), { _id: result.insertedId }));
});
exports.createSession = createSession;
const listSessionsByCohort = (cohortId) => __awaiter(void 0, void 0, void 0, function* () {
    const db = yield (0, mongo_1.connectToDatabase)();
    (0, session_model_1.initSessionCollection)(db);
    const sessionCollection = (0, session_model_1.getSessionCollection)();
    const sessions = yield sessionCollection.find({ cohortId }).sort({ startsAt: 1 }).toArray();
    return sessions.filter((s) => Boolean(s._id)).map(mapSession);
});
exports.listSessionsByCohort = listSessionsByCohort;
const enrollUserInCohort = (courseId, cohortId, userEmail) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d, _e, _f, _g;
    const db = yield (0, mongo_1.connectToDatabase)();
    (0, cohort_model_1.initCohortCollection)(db);
    (0, user_model_1.initUserCollection)(db);
    (0, attendance_model_1.initAttendanceCollection)(db);
    const cohortCollection = (0, cohort_model_1.getCohortCollection)();
    const usersCollection = (0, user_model_1.getUserCollection)();
    const attendanceCollection = (0, attendance_model_1.getAttendanceCollection)();
    const course = yield findCourseByIdentifier(courseId);
    if (!course)
        return false;
    const resolvedCourseId = (_a = course.courseId) !== null && _a !== void 0 ? _a : course._id.toHexString();
    const cohort = yield cohortCollection.findOne({ cohortId, courseId: resolvedCourseId });
    if (!cohort || !cohort._id)
        return false;
    const user = yield usersCollection.findOne({ email: userEmail });
    if (!user || !user._id)
        return false;
    const hasEntitlement = ((_b = user.purchasedCourses) !== null && _b !== void 0 ? _b : []).some((purchase) => {
        var _a;
        return purchase.courseId === resolvedCourseId &&
            ((_a = purchase.accessStatus) !== null && _a !== void 0 ? _a : "active") === "active" &&
            (purchase.paymentStatus === "succeeded" || purchase.paymentStatus === undefined);
    });
    if (!hasEntitlement)
        return false;
    const alreadyEnrolled = ((_c = user.enrollments) !== null && _c !== void 0 ? _c : []).some((enrollment) => enrollment.cohortId === cohortId);
    if (alreadyEnrolled)
        return true;
    const enrollment = {
        courseId: resolvedCourseId,
        cohortId,
        enrolledAt: new Date(),
        entitlementSource: "purchase",
        status: "active",
        progressPercent: 0,
        attendanceSummary: {
            attended: 0,
            left: cohort.sessionCount,
            total: cohort.sessionCount,
        },
        recommendedSessionsPerWeek: cohort.recommendedSessionsPerWeek,
    };
    const reserveSeatResult = yield cohortCollection.updateOne({
        _id: cohort._id,
        enrollmentCount: { $lt: cohort.maxEnrollments },
    }, {
        $inc: { enrollmentCount: 1 },
        $set: {
            updatedAt: new Date(),
            status: cohort.enrollmentCount + 1 >= cohort.maxEnrollments ? "full" : cohort.status,
        },
    });
    if (reserveSeatResult.modifiedCount !== 1) {
        return false;
    }
    const userEnrollmentUpdate = yield usersCollection.updateOne({ _id: user._id }, {
        $set: { updatedAt: new Date() },
        $push: { enrollments: enrollment },
        $inc: { enrolledCourseCount: 1 },
    });
    if (userEnrollmentUpdate.modifiedCount !== 1) {
        yield cohortCollection.updateOne({ _id: cohort._id, enrollmentCount: { $gt: 0 } }, {
            $inc: { enrollmentCount: -1 },
            $set: { updatedAt: new Date(), status: "open" },
        });
        return false;
    }
    if (((_d = course.maxEnrollments) !== null && _d !== void 0 ? _d : 0) > 0) {
        const cohortAgg = yield cohortCollection
            .aggregate([
            { $match: { courseId: resolvedCourseId } },
            { $group: { _id: null, total: { $sum: "$enrollmentCount" } } },
        ])
            .toArray();
        const totalEnrolled = (_f = (_e = cohortAgg[0]) === null || _e === void 0 ? void 0 : _e.total) !== null && _f !== void 0 ? _f : 0;
        yield db.collection("courses").updateOne({ _id: course._id }, {
            $set: {
                isSoldOut: totalEnrolled >= ((_g = course.maxEnrollments) !== null && _g !== void 0 ? _g : 0),
                updatedAt: new Date(),
            },
        });
    }
    const sessions = yield db.collection("sessions").find({ cohortId }).toArray();
    if (sessions.length > 0) {
        yield attendanceCollection.bulkWrite(sessions
            .filter((session) => session.sessionId)
            .map((session) => ({
            updateOne: {
                filter: {
                    userId: user._id.toHexString(),
                    sessionId: session.sessionId,
                },
                update: {
                    $set: {
                        status: "booked",
                        updatedAt: new Date(),
                        courseId: resolvedCourseId,
                        cohortId,
                    },
                    $setOnInsert: {
                        attendanceId: buildAttendanceId(),
                        createdAt: new Date(),
                    },
                },
                upsert: true,
            },
        })));
    }
    return true;
});
exports.enrollUserInCohort = enrollUserInCohort;
const bookSessionForUser = (userEmail, cohortId, sessionId) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const db = yield (0, mongo_1.connectToDatabase)();
    (0, session_model_1.initSessionCollection)(db);
    (0, attendance_model_1.initAttendanceCollection)(db);
    (0, user_model_1.initUserCollection)(db);
    const sessionCollection = (0, session_model_1.getSessionCollection)();
    const attendanceCollection = (0, attendance_model_1.getAttendanceCollection)();
    const usersCollection = (0, user_model_1.getUserCollection)();
    const user = yield usersCollection.findOne({ email: userEmail });
    if (!user || !user._id)
        return false;
    const enrollment = ((_a = user.enrollments) !== null && _a !== void 0 ? _a : []).find((entry) => entry.cohortId === cohortId);
    if (!enrollment)
        return false;
    const session = yield sessionCollection.findOne({ cohortId, sessionId });
    if (!session || !session._id)
        return false;
    const attendanceQuery = { userId: user._id.toHexString(), cohortId, sessionId };
    const existingAttendance = yield attendanceCollection.findOne(attendanceQuery);
    if ((existingAttendance === null || existingAttendance === void 0 ? void 0 : existingAttendance.status) === "booked" || (existingAttendance === null || existingAttendance === void 0 ? void 0 : existingAttendance.status) === "attended") {
        return true;
    }
    const reserveResult = yield sessionCollection.updateOne({
        _id: session._id,
        bookedCount: { $lt: session.capacity },
    }, {
        $inc: { bookedCount: 1 },
        $set: {
            status: session.bookedCount + 1 >= session.capacity ? "booked" : session.status,
            updatedAt: new Date(),
        },
    });
    if (reserveResult.modifiedCount !== 1) {
        return false;
    }
    try {
        yield attendanceCollection.updateOne(attendanceQuery, {
            $set: {
                status: "booked",
                updatedAt: new Date(),
            },
            $setOnInsert: {
                attendanceId: buildAttendanceId(),
                courseId: enrollment.courseId,
                createdAt: new Date(),
            },
        }, { upsert: true });
    }
    catch (error) {
        yield sessionCollection.updateOne({ _id: session._id, bookedCount: { $gt: 0 } }, {
            $inc: { bookedCount: -1 },
            $set: { updatedAt: new Date() },
        });
        throw error;
    }
    return true;
});
exports.bookSessionForUser = bookSessionForUser;
const normalizeCalEventType = (event) => {
    var _a, _b;
    return String((_b = (_a = event.type) !== null && _a !== void 0 ? _a : event.triggerEvent) !== null && _b !== void 0 ? _b : "").toLowerCase();
};
const extractCalPayload = (event) => {
    var _a, _b;
    return ((_b = (_a = event.payload) !== null && _a !== void 0 ? _a : event.data) !== null && _b !== void 0 ? _b : {});
};
const syncCalWebhookEvent = (event) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d, _e, _f;
    const db = yield (0, mongo_1.connectToDatabase)();
    (0, session_model_1.initSessionCollection)(db);
    (0, attendance_model_1.initAttendanceCollection)(db);
    (0, user_model_1.initUserCollection)(db);
    const sessionCollection = (0, session_model_1.getSessionCollection)();
    const attendanceCollection = (0, attendance_model_1.getAttendanceCollection)();
    const usersCollection = (0, user_model_1.getUserCollection)();
    const cohortCollection = db.collection("cohorts");
    const eventType = normalizeCalEventType(event);
    const payload = extractCalPayload(event);
    if (!eventType)
        return;
    const bookingUid = String((_b = (_a = payload.uid) !== null && _a !== void 0 ? _a : payload.bookingUid) !== null && _b !== void 0 ? _b : "");
    const attendeeEmail = String((_d = (_c = payload.attendeeEmail) !== null && _c !== void 0 ? _c : payload.email) !== null && _d !== void 0 ? _d : "");
    const sessionId = String((_e = payload.sessionId) !== null && _e !== void 0 ? _e : "");
    const status = String((_f = payload.status) !== null && _f !== void 0 ? _f : "").toLowerCase();
    const startsAt = payload.startTime ? new Date(String(payload.startTime)) : undefined;
    const endsAt = payload.endTime ? new Date(String(payload.endTime)) : undefined;
    let session = null;
    if (sessionId) {
        session = yield sessionCollection.findOne({ sessionId });
    }
    if (!session && bookingUid) {
        session = yield sessionCollection.findOne({ calBookingUid: bookingUid });
    }
    if (!session && startsAt && endsAt) {
        session = yield sessionCollection.findOne({ startsAt, endsAt });
    }
    if (!session || !session._id || !session.sessionId)
        return;
    const user = attendeeEmail ? yield usersCollection.findOne({ email: attendeeEmail }) : null;
    const cohort = yield cohortCollection.findOne({ cohortId: session.cohortId });
    if (!cohort)
        return;
    const now = new Date();
    const isCancelled = eventType.includes("cancel") || status === "cancelled";
    const isCreated = eventType.includes("create") || eventType.includes("book");
    const isRescheduled = eventType.includes("resched");
    if (isCreated || isRescheduled) {
        const shouldIncrementBookedCount = Boolean(bookingUid) && session.calBookingUid !== bookingUid && isCreated;
        const sessionUpdate = {
            $set: {
                calBookingUid: bookingUid || session.calBookingUid,
                status: "booked",
                updatedAt: now,
            },
        };
        if (shouldIncrementBookedCount) {
            sessionUpdate.$inc = { bookedCount: 1 };
        }
        yield sessionCollection.updateOne({ _id: session._id }, sessionUpdate);
        if (user === null || user === void 0 ? void 0 : user._id) {
            yield attendanceCollection.updateOne({ userId: user._id.toHexString(), sessionId: session.sessionId }, {
                $set: {
                    status: "booked",
                    updatedAt: now,
                },
                $setOnInsert: {
                    attendanceId: buildAttendanceId(),
                    userId: user._id.toHexString(),
                    courseId: cohort.courseId,
                    cohortId: session.cohortId,
                    sessionId: session.sessionId,
                    createdAt: now,
                },
            }, { upsert: true });
        }
        return;
    }
    if (isCancelled) {
        const attendeeFilter = (user === null || user === void 0 ? void 0 : user._id)
            ? { userId: user._id.toHexString(), sessionId: session.sessionId }
            : { sessionId: session.sessionId, cohortId: session.cohortId };
        const relevantAttendance = yield attendanceCollection.findOne(attendeeFilter);
        const canDecrement = (session.calBookingUid && bookingUid && session.calBookingUid === bookingUid) ||
            (relevantAttendance === null || relevantAttendance === void 0 ? void 0 : relevantAttendance.status) === "booked" ||
            (relevantAttendance === null || relevantAttendance === void 0 ? void 0 : relevantAttendance.status) === "attended";
        yield sessionCollection.updateOne({ _id: session._id }, Object.assign({ $set: { status: "cancelled", updatedAt: now } }, (canDecrement ? { $inc: { bookedCount: -1 } } : {})));
        const updatedSession = yield sessionCollection.findOne({ _id: session._id });
        if (updatedSession && updatedSession.bookedCount < 0) {
            yield sessionCollection.updateOne({ _id: session._id }, { $set: { bookedCount: 0, updatedAt: new Date() } });
        }
        if (user === null || user === void 0 ? void 0 : user._id) {
            yield attendanceCollection.updateOne({ userId: user._id.toHexString(), sessionId: session.sessionId }, {
                $set: {
                    status: "canceled",
                    updatedAt: now,
                },
            });
        }
    }
});
exports.syncCalWebhookEvent = syncCalWebhookEvent;
