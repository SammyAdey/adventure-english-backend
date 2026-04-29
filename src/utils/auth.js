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
exports.requireRole = exports.verifyAuthToken = void 0;
const user_service_1 = require("../services/user.service");
const getBearerToken = (request) => {
    const authHeader = request.headers.authorization;
    if (!(authHeader === null || authHeader === void 0 ? void 0 : authHeader.startsWith("Bearer "))) {
        return null;
    }
    return authHeader.replace("Bearer ", "");
};
const verifyAuthToken = (app, request) => {
    const token = getBearerToken(request);
    if (!token) {
        return null;
    }
    try {
        return app.jwt.verify(token);
    }
    catch (_a) {
        return null;
    }
};
exports.verifyAuthToken = verifyAuthToken;
const requireRole = (app, request, reply, allowedRoles) => __awaiter(void 0, void 0, void 0, function* () {
    const decoded = (0, exports.verifyAuthToken)(app, request);
    if (!(decoded === null || decoded === void 0 ? void 0 : decoded.email)) {
        reply.status(401).send({ message: "Unauthorized" });
        return null;
    }
    const user = yield (0, user_service_1.getUserByEmail)(decoded.email);
    if (!(user === null || user === void 0 ? void 0 : user.role) || !allowedRoles.includes(user.role)) {
        reply.status(403).send({ message: "Forbidden" });
        return null;
    }
    return Object.assign(Object.assign({}, decoded), { role: user.role, sub: user.id });
});
exports.requireRole = requireRole;
