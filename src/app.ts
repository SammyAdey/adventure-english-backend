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

app.register(jwt, {
	secret: process.env.JWT_SECRET as string,
});

app.register(fastifyRawBody, {
	field: "rawBody",
	global: false,
	encoding: "utf8",
	runFirst: true,
});

app.register(cors);
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
