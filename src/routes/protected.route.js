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
exports.default = protectedRoutes;
const auth_utils_1 = require("../utils/auth.utils");
function protectedRoutes(app) {
    return __awaiter(this, void 0, void 0, function* () {
        app.addHook('onRequest', auth_utils_1.verifyToken); // protect all routes in this file
        app.get('/dashboard', (request) => __awaiter(this, void 0, void 0, function* () {
            const user = request.user; // this contains the decoded JWT payload
            return { message: `Welcome, ${user.username}` };
        }));
    });
}
