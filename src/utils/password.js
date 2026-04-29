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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyPassword = exports.hashPassword = exports.isPasswordHash = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const PASSWORD_HASH_PREFIXES = ["$2a$", "$2b$", "$2y$"];
const SALT_ROUNDS = 12;
const isPasswordHash = (value) => PASSWORD_HASH_PREFIXES.some((prefix) => value.startsWith(prefix));
exports.isPasswordHash = isPasswordHash;
const hashPassword = (plainTextPassword) => __awaiter(void 0, void 0, void 0, function* () { return bcryptjs_1.default.hash(plainTextPassword, SALT_ROUNDS); });
exports.hashPassword = hashPassword;
const verifyPassword = (plainTextPassword, storedPassword) => __awaiter(void 0, void 0, void 0, function* () {
    if ((0, exports.isPasswordHash)(storedPassword)) {
        return bcryptjs_1.default.compare(plainTextPassword, storedPassword);
    }
    return storedPassword === plainTextPassword;
});
exports.verifyPassword = verifyPassword;
