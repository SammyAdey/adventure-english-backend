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
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = authRoutes;
const mongo_1 = require("../utils/mongo");
const user_model_1 = require("../models/user.model");
function authRoutes(app) {
    return __awaiter(this, void 0, void 0, function* () {
        app.post('/auth/validate', (request, reply) => __awaiter(this, void 0, void 0, function* () {
            try {
                const authHeader = request.headers.authorization;
                if (!authHeader) {
                    return reply.status(401).send({ message: 'Missing token' });
                }
                const token = authHeader.replace('Bearer ', '');
                const decoded = app.jwt.verify(token);
                return reply.send({ valid: true, user: decoded });
            }
            catch (error) {
                return reply.status(401).send({ message: 'Invalid or expired token' });
            }
        }));
        app.post('/auth/login', (request, reply) => __awaiter(this, void 0, void 0, function* () {
            const { email, password } = request.body;
            const db = yield (0, mongo_1.connectToDatabase)();
            (0, user_model_1.initUserCollection)(db);
            const users = (0, user_model_1.getUserCollection)();
            const user = yield users.findOne({ email });
            if (!user) {
                return reply.status(401).send({ message: 'No user with this email was found' });
            }
            // In a real app, you should hash passwords and use bcrypt.compare()
            if (user.password === password) {
                const token = app.jwt.sign({ email: user.email });
                const { password } = user, userWithoutPassword = __rest(user, ["password"]);
                return reply.send({
                    email: user.email,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    token,
                });
            }
            return reply.status(401).send({ message: 'Username or password is incorrect' });
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
            yield users.insertOne({
                password,
                email,
                firstName,
                lastName,
                role: "student",
                status: "active",
                createdAt: new Date(),
                updatedAt: new Date(),
            });
            const token = app.jwt.sign({ email });
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
