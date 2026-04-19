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
exports.updateUser = exports.deleteUser = exports.createUser = exports.listUsers = void 0;
const mongodb_1 = require("mongodb");
const mongo_1 = require("../utils/mongo");
const user_model_1 = require("../models/user.model");
const normalizeRole = (role) => {
    if (!role) {
        return "student";
    }
    if (role === "instructor") {
        return "teacher";
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
    return normalized;
};
const mapMongoUserToDTO = (user) => ({
    id: user._id.toHexString(),
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    role: user.role === "teacher" ? "instructor" : user.role,
    languageLevel: user.languageLevel,
    country: user.country,
    interests: user.interests,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    status: user.status,
    enrolledCourseCount: user.enrolledCourseCount,
    lastLoginAt: user.lastLoginAt,
});
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
const createUser = (payload) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const db = yield (0, mongo_1.connectToDatabase)();
    (0, user_model_1.initUserCollection)(db);
    const usersCollection = (0, user_model_1.getUserCollection)();
    const now = new Date();
    const userDocument = {
        firstName: payload.firstName,
        lastName: payload.lastName,
        email: payload.email,
        role: normalizeRole(payload.role),
        status: (_a = payload.status) !== null && _a !== void 0 ? _a : "invited",
        enrolledCourseCount: 0,
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
        $set: Object.assign(Object.assign({}, updates), { updatedAt: new Date() }),
    }, {
        returnDocument: "after",
    });
    if (!result || !result._id) {
        return null;
    }
    return mapMongoUserToDTO(result);
});
exports.updateUser = updateUser;
