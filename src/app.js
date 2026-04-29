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
const fastify_1 = __importDefault(require("fastify"));
const dotenv_1 = __importDefault(require("dotenv"));
const cors_1 = __importDefault(require("@fastify/cors"));
const fastify_raw_body_1 = __importDefault(require("fastify-raw-body"));
const root_route_1 = __importDefault(require("./routes/root.route"));
const jwt_1 = __importDefault(require("@fastify/jwt"));
const auth_route_1 = __importDefault(require("./routes/auth.route"));
const course_route_1 = __importDefault(require("./routes/course.route"));
const user_route_1 = __importDefault(require("./routes/user.route"));
const cohort_route_1 = __importDefault(require("./routes/cohort.route"));
const integrations_cal_route_1 = __importDefault(require("./routes/integrations.cal.route"));
const integrations_stripe_route_1 = __importDefault(require("./routes/integrations.stripe.route"));
const dashboard_route_1 = __importDefault(require("./routes/dashboard.route"));
const run_migrations_1 = require("./migrations/run-migrations");
dotenv_1.default.config();
const app = (0, fastify_1.default)({ logger: true });
app.register(jwt_1.default, {
    secret: process.env.JWT_SECRET,
});
app.register(fastify_raw_body_1.default, {
    field: "rawBody",
    global: false,
    encoding: "utf8",
    runFirst: true,
});
app.register(cors_1.default);
app.register(root_route_1.default);
app.register(auth_route_1.default);
app.register(course_route_1.default);
app.register(user_route_1.default);
app.register(cohort_route_1.default);
app.register(integrations_cal_route_1.default);
app.register(integrations_stripe_route_1.default);
app.register(dashboard_route_1.default);
const start = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield (0, run_migrations_1.runMigrations)();
        const port = parseInt(process.env.PORT || '5000');
        yield app.listen({ port, host: '0.0.0.0' });
        console.log(`🚀 Server listening on http://localhost:${port}`);
    }
    catch (err) {
        app.log.error(err);
        process.exit(1);
    }
});
start();
