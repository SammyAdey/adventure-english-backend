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
        },
        minProperties: 1,
    },
    params: deleteUserParamsSchema,
};
function userRoutes(app) {
    return __awaiter(this, void 0, void 0, function* () {
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
            const users = yield (0, user_service_1.listUsers)();
            return reply.send({ users });
        }));
        app.post("/users", {
            schema: createUserSchema,
        }, (request, reply) => __awaiter(this, void 0, void 0, function* () {
            try {
                const user = yield (0, user_service_1.createUser)({
                    firstName: request.body.firstName,
                    lastName: request.body.lastName,
                    email: request.body.email,
                    role: request.body.role,
                    status: request.body.status,
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
            try {
                const updated = yield (0, user_service_1.updateUser)(request.params.userId, {
                    role: request.body.role,
                    status: request.body.status,
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
    });
}
