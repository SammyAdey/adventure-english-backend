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
// server.ts
const fastify_1 = __importDefault(require("fastify"));
const cookie_1 = __importDefault(require("@fastify/cookie"));
const cors_1 = __importDefault(require("@fastify/cors"));
const jose_1 = require("jose");
const undici_1 = require("undici");
const CAL_API = "https://api.cal.com/v2";
const CAL_API_KEY = process.env.CAL_API_KEY;
const CAL_API_VERSION = process.env.CAL_API_VERSION || "2024-08-13";
const JWT_SECRET = new TextEncoder().encode(process.env.APP_JWT_SECRET);
function startServer() {
    return __awaiter(this, void 0, void 0, function* () {
        const app = (0, fastify_1.default)({ logger: true });
        yield app.register(cors_1.default, {
            origin: ["http://localhost:3000", "https://your-frontend.com"],
            credentials: true, // allow cookies
        });
        yield app.register(cookie_1.default);
        // --- helpers ---
        function signSession(email) {
            return __awaiter(this, void 0, void 0, function* () {
                return yield new jose_1.SignJWT({ email })
                    .setProtectedHeader({ alg: "HS256" })
                    .setIssuedAt()
                    .setExpirationTime("2h")
                    .sign(JWT_SECRET);
            });
        }
        function getUserEmailFromReq(req) {
            return __awaiter(this, void 0, void 0, function* () {
                var _a, _b;
                const token = (_a = req.cookies) === null || _a === void 0 ? void 0 : _a.session;
                if (!token)
                    return null;
                try {
                    const { payload } = yield (0, jose_1.jwtVerify)(token, JWT_SECRET);
                    return (_b = payload.email) !== null && _b !== void 0 ? _b : null;
                }
                catch (_c) {
                    return null;
                }
            });
        }
        // --- routes ---
        // 1) Login (issue HttpOnly cookie). Replace body validation with your real auth.
        app.post("/api/auth/login", (req, reply) => __awaiter(this, void 0, void 0, function* () {
            const { email } = req.body || {};
            if (!email)
                return reply.code(400).send({ error: "Email required" });
            const token = yield signSession(email);
            reply
                .setCookie("session", token, {
                httpOnly: true,
                sameSite: "lax",
                secure: process.env.NODE_ENV === "production",
                path: "/",
                maxAge: 60 * 60 * 2, // 2 hours
            })
                .send({ ok: true });
        }));
        // 2) List my bookings (uses attendeeEmail = session email)
        app.get("/api/cal/bookings", (req, reply) => __awaiter(this, void 0, void 0, function* () {
            const email = yield getUserEmailFromReq(req);
            if (!email)
                return reply.code(401).send({ error: "Not logged in" });
            const url = new URL(`${CAL_API}/bookings`);
            url.searchParams.set("attendeeEmail", email);
            const res = yield (0, undici_1.fetch)(url.toString(), {
                headers: {
                    Authorization: `Bearer ${CAL_API_KEY}`,
                    "cal-api-version": CAL_API_VERSION,
                },
            });
            const data = yield res.json();
            return reply.code(res.status).send(data);
        }));
        // 3) Reschedule booking
        app.post("/api/cal/bookings/:uid/reschedule", (req, reply) => __awaiter(this, void 0, void 0, function* () {
            const email = yield getUserEmailFromReq(req);
            if (!email)
                return reply.code(401).send({ error: "Not logged in" });
            const { uid } = req.params;
            const { newStartISO } = req.body || {};
            if (!newStartISO)
                return reply.code(400).send({ error: "newStartISO required" });
            const res = yield (0, undici_1.fetch)(`${CAL_API}/bookings/${uid}/reschedule`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${CAL_API_KEY}`,
                    "cal-api-version": CAL_API_VERSION,
                },
                body: JSON.stringify({ start: newStartISO, email /* optional */ }),
            });
            const data = yield res.json();
            return reply.code(res.status).send(data);
        }));
        // 4) Cancel booking
        app.post("/api/cal/bookings/:uid/cancel", (req, reply) => __awaiter(this, void 0, void 0, function* () {
            const email = yield getUserEmailFromReq(req);
            if (!email)
                return reply.code(401).send({ error: "Not logged in" });
            const { uid } = req.params;
            const res = yield (0, undici_1.fetch)(`${CAL_API}/bookings/${uid}/cancel`, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${CAL_API_KEY}`,
                    "cal-api-version": CAL_API_VERSION,
                },
            });
            const data = yield res.json();
            return reply.code(res.status).send(data);
        }));
        yield app.listen({ port: 4000, host: "0.0.0.0" });
    });
}
startServer().catch(console.error);
