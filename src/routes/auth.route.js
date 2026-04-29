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
var _a, _b, _c;
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = authRoutes;
const mongo_1 = require("../utils/mongo");
const user_model_1 = require("../models/user.model");
const password_1 = require("../utils/password");
const jwtIssuer = (_a = process.env.JWT_ISSUER) !== null && _a !== void 0 ? _a : "adventure-english-backend";
const jwtAudience = (_b = process.env.JWT_AUDIENCE) !== null && _b !== void 0 ? _b : "adventure-english-clients";
const jwtExpiresIn = (_c = process.env.JWT_EXPIRES_IN) !== null && _c !== void 0 ? _c : "7d";
const buildAuthToken = (app, payload) => app.jwt.sign({
    sub: payload.userId,
    email: payload.email,
    role: payload.role,
    iss: jwtIssuer,
    aud: jwtAudience,
}, {
    expiresIn: jwtExpiresIn,
});
function authRoutes(app) {
    return __awaiter(this, void 0, void 0, function* () {
        app.post("/auth/validate", (request, reply) => __awaiter(this, void 0, void 0, function* () {
            try {
                const authHeader = request.headers.authorization;
                if (!authHeader) {
                    return reply.status(401).send({ message: "Missing token" });
                }
                const token = authHeader.replace("Bearer ", "");
                const decoded = app.jwt.verify(token);
                return reply.send({ valid: true, user: decoded });
            }
            catch (_error) {
                return reply.status(401).send({ message: "Invalid or expired token" });
            }
        }));
        app.post("/auth/login", (request, reply) => __awaiter(this, void 0, void 0, function* () {
            var _a;
            const { email, password } = request.body;
            const db = yield (0, mongo_1.connectToDatabase)();
            (0, user_model_1.initUserCollection)(db);
            const users = (0, user_model_1.getUserCollection)();
            const user = yield users.findOne({ email });
            if (!user || !user._id || !user.password) {
                return reply.status(401).send({ message: "No user with this email was found" });
            }
            const passwordMatches = yield (0, password_1.verifyPassword)(password, user.password);
            if (!passwordMatches) {
                return reply.status(401).send({ message: "Username or password is incorrect" });
            }
            // Transparent migration: if a legacy plaintext password is used successfully,
            // replace it with a secure hash.
            if (!(0, password_1.isPasswordHash)(user.password)) {
                const upgradedHash = yield (0, password_1.hashPassword)(password);
                yield users.updateOne({ _id: user._id }, {
                    $set: {
                        password: upgradedHash,
                        updatedAt: new Date(),
                    },
                });
            }
            const token = buildAuthToken(app, {
                userId: user._id.toHexString(),
                email: user.email,
                role: (_a = user.role) !== null && _a !== void 0 ? _a : "student",
            });
            return reply.send({
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                token,
            });
        }));
        app.post("/auth/register", (request, reply) => __awaiter(this, void 0, void 0, function* () {
            const db = yield (0, mongo_1.connectToDatabase)();
            (0, user_model_1.initUserCollection)(db);
            const users = (0, user_model_1.getUserCollection)();
            const { password, email, firstName, lastName } = request.body;
            const existingUser = yield users.findOne({ email });
            if (existingUser) {
                return reply.status(400).send({ message: "User already exists" });
            }
            const passwordHash = yield (0, password_1.hashPassword)(password);
            const createdAt = new Date();
            const result = yield users.insertOne({
                password: passwordHash,
                email,
                firstName,
                lastName,
                role: "student",
                status: "active",
                createdAt,
                updatedAt: createdAt,
            });
            const token = buildAuthToken(app, {
                userId: result.insertedId.toHexString(),
                email,
                role: "student",
            });
            return reply.send({
                message: "Registered successfully",
                email,
                firstName,
                lastName,
                token,
            });
        }));
    });
}
