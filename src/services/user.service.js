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
exports.addUserPurchaseByEmail = exports.updateUserPurchase = exports.getUserActivityFeed = exports.updateUserCourseProgressByEmail = exports.getUserEnrolledCourses = exports.getUserDashboardSummary = exports.addUserPurchase = exports.updateUserByEmail = exports.updateUser = exports.deleteUser = exports.createUser = exports.getUserByEmail = exports.listUsers = void 0;
const mongodb_1 = require("mongodb");
const mongo_1 = require("../utils/mongo");
const user_model_1 = require("../models/user.model");
const normalizeRole = (role) => {
    if (!role) {
        return "student";
    }
    if (role === "teacher") {
        return "instructor";
    }
    return role;
};
const normalizeUpdate = (payload) => {
    const normalized = {};
    if (payload.role !== undefined) {
        normalized.role = normalizeRole(payload.role);
    }
    if (payload.status !== undefined) {
        normalized.status = payload.status;
    }
    if (payload.purchasedCourses !== undefined) {
        normalized.purchasedCourses = payload.purchasedCourses;
    }
    if (payload.enrollments !== undefined) {
        normalized.enrollments = payload.enrollments;
    }
    if (payload.firstName !== undefined) {
        normalized.firstName = payload.firstName;
    }
    if (payload.lastName !== undefined) {
        normalized.lastName = payload.lastName;
    }
    if (payload.country !== undefined) {
        normalized.country = payload.country;
    }
    if (payload.languageLevel !== undefined) {
        normalized.languageLevel = payload.languageLevel;
    }
    if (payload.interests !== undefined) {
        normalized.interests = payload.interests;
    }
    return normalized;
};
const upsertEnrollmentFromPurchase = (enrollments = [], purchase) => {
    var _a;
    const existingIndex = enrollments.findIndex((enrollment) => enrollment.courseId === purchase.courseId);
    const nextEnrollment = {
        courseId: purchase.courseId,
        enrolledAt: purchase.purchasedAt,
        entitlementSource: "purchase",
        status: purchase.accessStatus === "revoked" ? "revoked" : purchase.accessStatus === "refunded" ? "paused" : "active",
        progressPercent: (_a = purchase.progressPercent) !== null && _a !== void 0 ? _a : 0,
        lastAccessedAt: purchase.lastAccessedAt,
    };
    if (existingIndex === -1) {
        return [...enrollments, nextEnrollment];
    }
    return enrollments.map((enrollment, index) => {
        var _a;
        return index === existingIndex
            ? Object.assign(Object.assign(Object.assign({}, enrollment), nextEnrollment), { enrolledAt: (_a = enrollment.enrolledAt) !== null && _a !== void 0 ? _a : nextEnrollment.enrolledAt }) : enrollment;
    });
};
const mapMongoUserToDTO = (user) => {
    var _a, _b, _c, _d, _e;
    return ({
        id: user._id.toHexString(),
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        languageLevel: user.languageLevel,
        country: user.country,
        interests: user.interests,
        purchasedCourses: user.purchasedCourses,
        enrollments: user.enrollments,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        status: user.status,
        enrolledCourseCount: (_e = (_c = (_a = user.enrolledCourseCount) !== null && _a !== void 0 ? _a : (_b = user.enrollments) === null || _b === void 0 ? void 0 : _b.length) !== null && _c !== void 0 ? _c : (_d = user.purchasedCourses) === null || _d === void 0 ? void 0 : _d.length) !== null && _e !== void 0 ? _e : 0,
        lastLoginAt: user.lastLoginAt,
    });
};
const listUsers = () => __awaiter(void 0, void 0, void 0, function* () {
    const db = yield (0, mongo_1.connectToDatabase)();
    (0, user_model_1.initUserCollection)(db);
    const usersCollection = (0, user_model_1.getUserCollection)();
    const users = yield usersCollection.find({}).sort({ createdAt: -1 }).toArray();
    return users
        .filter((user) => Boolean(user._id))
        .map(mapMongoUserToDTO);
});
exports.listUsers = listUsers;
const getUserByEmail = (email) => __awaiter(void 0, void 0, void 0, function* () {
    const db = yield (0, mongo_1.connectToDatabase)();
    (0, user_model_1.initUserCollection)(db);
    const usersCollection = (0, user_model_1.getUserCollection)();
    const user = yield usersCollection.findOne({ email });
    if (!user || !user._id) {
        return null;
    }
    return mapMongoUserToDTO(user);
});
exports.getUserByEmail = getUserByEmail;
const createUser = (payload) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d, _e;
    const db = yield (0, mongo_1.connectToDatabase)();
    (0, user_model_1.initUserCollection)(db);
    const usersCollection = (0, user_model_1.getUserCollection)();
    const now = new Date();
    const purchaseDerivedEnrollments = (_b = (_a = payload.purchasedCourses) === null || _a === void 0 ? void 0 : _a.reduce((acc, purchase) => upsertEnrollmentFromPurchase(acc, purchase), [])) !== null && _b !== void 0 ? _b : [];
    const initialEnrollments = (_c = payload.enrollments) !== null && _c !== void 0 ? _c : purchaseDerivedEnrollments;
    const userDocument = {
        firstName: payload.firstName,
        lastName: payload.lastName,
        email: payload.email,
        role: normalizeRole(payload.role),
        status: (_d = payload.status) !== null && _d !== void 0 ? _d : "invited",
        purchasedCourses: (_e = payload.purchasedCourses) !== null && _e !== void 0 ? _e : [],
        enrollments: initialEnrollments,
        enrolledCourseCount: initialEnrollments.length,
        createdAt: now,
        updatedAt: now,
    };
    const result = yield usersCollection.insertOne(userDocument);
    const insertedUser = Object.assign(Object.assign({}, userDocument), { _id: result.insertedId });
    return mapMongoUserToDTO(insertedUser);
});
exports.createUser = createUser;
const deleteUser = (userId) => __awaiter(void 0, void 0, void 0, function* () {
    if (!mongodb_1.ObjectId.isValid(userId)) {
        return false;
    }
    const db = yield (0, mongo_1.connectToDatabase)();
    (0, user_model_1.initUserCollection)(db);
    const usersCollection = (0, user_model_1.getUserCollection)();
    const result = yield usersCollection.deleteOne({ _id: new mongodb_1.ObjectId(userId) });
    return result.deletedCount === 1;
});
exports.deleteUser = deleteUser;
const updateUser = (userId, payload) => __awaiter(void 0, void 0, void 0, function* () {
    if (!mongodb_1.ObjectId.isValid(userId)) {
        return null;
    }
    const updates = normalizeUpdate(payload);
    if (Object.keys(updates).length === 0) {
        return null;
    }
    const db = yield (0, mongo_1.connectToDatabase)();
    (0, user_model_1.initUserCollection)(db);
    const usersCollection = (0, user_model_1.getUserCollection)();
    const result = yield usersCollection.findOneAndUpdate({ _id: new mongodb_1.ObjectId(userId) }, {
        $set: Object.assign(Object.assign(Object.assign({}, updates), (updates.enrollments
            ? { enrolledCourseCount: updates.enrollments.length }
            : updates.purchasedCourses
                ? { enrolledCourseCount: updates.purchasedCourses.length }
                : {})), { updatedAt: new Date() }),
    }, {
        returnDocument: "after",
    });
    if (!result || !result._id) {
        return null;
    }
    return mapMongoUserToDTO(result);
});
exports.updateUser = updateUser;
const updateUserByEmail = (email, payload) => __awaiter(void 0, void 0, void 0, function* () {
    const db = yield (0, mongo_1.connectToDatabase)();
    (0, user_model_1.initUserCollection)(db);
    const usersCollection = (0, user_model_1.getUserCollection)();
    const existing = yield usersCollection.findOne({ email });
    if (!existing || !existing._id) {
        return null;
    }
    return (0, exports.updateUser)(existing._id.toHexString(), payload);
});
exports.updateUserByEmail = updateUserByEmail;
const addUserPurchase = (userId, purchase) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    if (!mongodb_1.ObjectId.isValid(userId)) {
        return null;
    }
    const db = yield (0, mongo_1.connectToDatabase)();
    (0, user_model_1.initUserCollection)(db);
    const usersCollection = (0, user_model_1.getUserCollection)();
    const existing = yield usersCollection.findOne({ _id: new mongodb_1.ObjectId(userId) });
    if (!existing || !existing._id) {
        return null;
    }
    const purchases = (_a = existing.purchasedCourses) !== null && _a !== void 0 ? _a : [];
    const withoutCurrent = purchases.filter((entry) => entry.courseId !== purchase.courseId);
    const nextPurchases = [...withoutCurrent, purchase];
    const nextEnrollments = upsertEnrollmentFromPurchase((_b = existing.enrollments) !== null && _b !== void 0 ? _b : [], purchase);
    const result = yield usersCollection.findOneAndUpdate({ _id: new mongodb_1.ObjectId(userId) }, {
        $set: {
            purchasedCourses: nextPurchases,
            enrollments: nextEnrollments,
            enrolledCourseCount: nextEnrollments.length,
            updatedAt: new Date(),
        },
    }, { returnDocument: "after" });
    if (!result || !result._id) {
        return null;
    }
    return mapMongoUserToDTO(result);
});
exports.addUserPurchase = addUserPurchase;
const formatLastVisitedLabel = (lastAccessedAt) => {
    if (!lastAccessedAt)
        return "Recently";
    const now = Date.now();
    const diffMs = now - new Date(lastAccessedAt).getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays <= 0)
        return "Today";
    if (diffDays === 1)
        return "Yesterday";
    return `${diffDays} days ago`;
};
const getUserDashboardSummary = (email) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const user = yield (0, exports.getUserByEmail)(email);
    if (!user) {
        return null;
    }
    const enrollments = (_a = user.enrollments) !== null && _a !== void 0 ? _a : [];
    const lessonsCompleted = enrollments.reduce((sum, enrollment) => { var _a, _b; return sum + ((_b = (_a = enrollment.attendanceSummary) === null || _a === void 0 ? void 0 : _a.attended) !== null && _b !== void 0 ? _b : 0); }, 0);
    const db = yield (0, mongo_1.connectToDatabase)();
    const sessionsCollection = db.collection("sessions");
    const cohortIds = enrollments.map((enrollment) => enrollment.cohortId).filter((value) => Boolean(value));
    const now = new Date();
    const upcomingSessionDocs = cohortIds.length > 0
        ? yield sessionsCollection
            .find({
            cohortId: { $in: cohortIds },
            startsAt: { $gte: now },
            status: { $in: ["scheduled", "booked"] },
        })
            .sort({ startsAt: 1 })
            .limit(5)
            .toArray()
        : [];
    const upcomingBookings = upcomingSessionDocs.map((session) => ({
        id: `${session.cohortId}-${session.startsAt.toISOString()}`,
        title: "In-person cohort session",
        dateLabel: session.startsAt.toLocaleDateString("en-AU", {
            weekday: "short",
            day: "numeric",
            month: "short",
            year: "numeric",
        }),
        timeLabel: session.startsAt.toLocaleTimeString("en-AU", {
            hour: "numeric",
            minute: "2-digit",
        }),
        mode: "In person",
    }));
    return {
        stats: {
            enrolledCourses: enrollments.length,
            lessonsCompleted,
            studyHoursThisMonth: Math.round(lessonsCompleted * 0.75),
            streakDays: Math.min(30, Math.max(1, enrollments.length * 2)),
        },
        upcomingBookings,
    };
});
exports.getUserDashboardSummary = getUserDashboardSummary;
const getUserEnrolledCourses = (email) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const user = yield (0, exports.getUserByEmail)(email);
    if (!user) {
        return null;
    }
    const enrollments = (_a = user.enrollments) !== null && _a !== void 0 ? _a : [];
    const db = yield (0, mongo_1.connectToDatabase)();
    const coursesCollection = db.collection("courses");
    const result = yield Promise.all(enrollments.map((enrollment) => __awaiter(void 0, void 0, void 0, function* () {
        var _a, _b, _c, _d, _e, _f, _g;
        const course = yield coursesCollection.findOne({
            $or: [{ courseId: enrollment.courseId }, { slug: enrollment.courseId }],
        });
        return {
            id: enrollment.courseId,
            cohortId: enrollment.cohortId,
            title: (_a = course === null || course === void 0 ? void 0 : course.title) !== null && _a !== void 0 ? _a : enrollment.courseId,
            progressPercent: (_b = enrollment.progressPercent) !== null && _b !== void 0 ? _b : 0,
            nextLessonTitle: "Continue from where you stopped",
            lastVisitedLabel: formatLastVisitedLabel(enrollment.lastAccessedAt),
            attendedSessions: (_d = (_c = enrollment.attendanceSummary) === null || _c === void 0 ? void 0 : _c.attended) !== null && _d !== void 0 ? _d : 0,
            sessionsLeft: (_f = (_e = enrollment.attendanceSummary) === null || _e === void 0 ? void 0 : _e.left) !== null && _f !== void 0 ? _f : 0,
            recommendedSessionsPerWeek: (_g = enrollment.recommendedSessionsPerWeek) !== null && _g !== void 0 ? _g : 1,
        };
    })));
    return result;
});
exports.getUserEnrolledCourses = getUserEnrolledCourses;
const updateUserCourseProgressByEmail = (email, courseId, progressPercent) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    const db = yield (0, mongo_1.connectToDatabase)();
    (0, user_model_1.initUserCollection)(db);
    const usersCollection = (0, user_model_1.getUserCollection)();
    const user = yield usersCollection.findOne({ email });
    if (!user || !user._id) {
        return null;
    }
    const currentEnrollments = (_a = user.enrollments) !== null && _a !== void 0 ? _a : [];
    const enrollmentExists = currentEnrollments.some((entry) => entry.courseId === courseId);
    if (!enrollmentExists) {
        return null;
    }
    const now = new Date();
    const boundedProgress = Math.max(0, Math.min(100, progressPercent));
    const nextEnrollments = currentEnrollments.map((entry) => {
        var _a;
        return entry.courseId === courseId
            ? Object.assign(Object.assign({}, entry), { progressPercent: boundedProgress, lastAccessedAt: now, status: boundedProgress >= 100 ? "completed" : (_a = entry.status) !== null && _a !== void 0 ? _a : "active", completedAt: boundedProgress >= 100 ? now : entry.completedAt }) : entry;
    });
    const nextPurchases = ((_b = user.purchasedCourses) !== null && _b !== void 0 ? _b : []).map((purchase) => purchase.courseId === courseId
        ? Object.assign(Object.assign({}, purchase), { progressPercent: boundedProgress, lastAccessedAt: now }) : purchase);
    const result = yield usersCollection.findOneAndUpdate({ _id: user._id }, {
        $set: {
            enrollments: nextEnrollments,
            purchasedCourses: nextPurchases,
            updatedAt: now,
        },
    }, { returnDocument: "after" });
    if (!result || !result._id) {
        return null;
    }
    return mapMongoUserToDTO(result);
});
exports.updateUserCourseProgressByEmail = updateUserCourseProgressByEmail;
const getUserActivityFeed = (email) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const user = yield (0, exports.getUserByEmail)(email);
    if (!user) {
        return null;
    }
    const activities = ((_a = user.enrollments) !== null && _a !== void 0 ? _a : [])
        .sort((a, b) => {
        const aDate = a.lastAccessedAt ? new Date(a.lastAccessedAt).getTime() : 0;
        const bDate = b.lastAccessedAt ? new Date(b.lastAccessedAt).getTime() : 0;
        return bDate - aDate;
    })
        .slice(0, 10)
        .map((enrollment, index) => {
        var _a;
        return ({
            id: `${enrollment.courseId}-${index}`,
            label: ((_a = enrollment.progressPercent) !== null && _a !== void 0 ? _a : 0) >= 100
                ? `Completed course ${enrollment.courseId}`
                : `Continued learning in ${enrollment.courseId}`,
            timeLabel: formatLastVisitedLabel(enrollment.lastAccessedAt),
        });
    });
    return activities;
});
exports.getUserActivityFeed = getUserActivityFeed;
const updateUserPurchase = (userId, courseId, patch) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    if (!mongodb_1.ObjectId.isValid(userId)) {
        return null;
    }
    const db = yield (0, mongo_1.connectToDatabase)();
    (0, user_model_1.initUserCollection)(db);
    const usersCollection = (0, user_model_1.getUserCollection)();
    const existing = yield usersCollection.findOne({ _id: new mongodb_1.ObjectId(userId) });
    if (!existing || !existing._id) {
        return null;
    }
    const purchases = (_a = existing.purchasedCourses) !== null && _a !== void 0 ? _a : [];
    const purchaseIndex = purchases.findIndex((entry) => entry.courseId === courseId);
    if (purchaseIndex === -1) {
        return null;
    }
    const mergedPurchase = Object.assign(Object.assign(Object.assign({}, purchases[purchaseIndex]), patch), { courseId });
    const nextPurchases = purchases.map((entry, index) => (index === purchaseIndex ? mergedPurchase : entry));
    const nextEnrollments = upsertEnrollmentFromPurchase((_b = existing.enrollments) !== null && _b !== void 0 ? _b : [], mergedPurchase);
    const result = yield usersCollection.findOneAndUpdate({ _id: new mongodb_1.ObjectId(userId) }, {
        $set: {
            purchasedCourses: nextPurchases,
            enrollments: nextEnrollments,
            enrolledCourseCount: nextEnrollments.length,
            updatedAt: new Date(),
        },
    }, { returnDocument: "after" });
    if (!result || !result._id) {
        return null;
    }
    return mapMongoUserToDTO(result);
});
exports.updateUserPurchase = updateUserPurchase;
const addUserPurchaseByEmail = (email, purchase) => __awaiter(void 0, void 0, void 0, function* () {
    const user = yield (0, exports.getUserByEmail)(email);
    if (!(user === null || user === void 0 ? void 0 : user.id)) {
        return null;
    }
    return (0, exports.addUserPurchase)(user.id, purchase);
});
exports.addUserPurchaseByEmail = addUserPurchaseByEmail;
