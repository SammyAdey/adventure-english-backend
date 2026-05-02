import Fastify from 'fastify';
import dotenv from 'dotenv';
import cors from '@fastify/cors';
import fastifyRawBody from "fastify-raw-body";
import rootRoute from './routes/root.route';
import jwt from '@fastify/jwt';
import authRoutes from './routes/auth.route';
import courseRoutes from './routes/course.route';
import userRoutes from './routes/user.route';
import cohortRoutes from './routes/cohort.route';
import calIntegrationRoutes from './routes/integrations.cal.route';
import stripeIntegrationRoutes from "./routes/integrations.stripe.route";
import dashboardRoutes from "./routes/dashboard.route";
import { runMigrations } from "./migrations/run-migrations";

dotenv.config();

const app = Fastify({ logger: true });
const defaultCorsOrigins = [
	"https://www.adventureenglish.com",
	"https://adventureenglish.com",
	"http://localhost:3000",
	"http://localhost:3001",
];
const configuredCorsOrigins = (process.env.CORS_ORIGINS ?? "")
	.split(",")
	.map((origin) => origin.trim())
	.filter(Boolean);
const allowedOrigins = new Set(
	configuredCorsOrigins.length > 0 ? configuredCorsOrigins : defaultCorsOrigins,
);

app.register(jwt, {
	secret: process.env.JWT_SECRET as string,
});

app.register(fastifyRawBody, {
	field: "rawBody",
	global: false,
	encoding: "utf8",
	runFirst: true,
});

app.register(cors, {
	origin: (origin, callback) => {
		// Allow non-browser/server-to-server requests with no Origin header.
		if (!origin) {
			callback(null, true);
			return;
		}
		if (allowedOrigins.has(origin)) {
			callback(null, true);
			return;
		}
		callback(new Error("Origin not allowed by CORS"), false);
	},
	methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
	allowedHeaders: ["Content-Type", "Authorization", "stripe-signature", "x-cal-signature"],
	credentials: true,
	maxAge: 86400,
});
app.register(rootRoute);
app.register(authRoutes);
app.register(courseRoutes);
app.register(userRoutes);
app.register(cohortRoutes);
app.register(calIntegrationRoutes);
app.register(stripeIntegrationRoutes);
app.register(dashboardRoutes);

const start = async () => {
  try {
    await runMigrations();
    const port = parseInt(process.env.PORT || '5000');
    await app.listen({ port, host: '0.0.0.0' });
    console.log(`🚀 Server listening on http://localhost:${port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
