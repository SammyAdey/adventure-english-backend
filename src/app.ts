import Fastify from 'fastify';
import dotenv from 'dotenv';
import cors from '@fastify/cors';
import rootRoute from './routes/root.route';
import jwt from '@fastify/jwt';
import authRoutes from './routes/auth.route';
import courseRoutes from './routes/course.route';
import userRoutes from './routes/user.route';

dotenv.config();

const app = Fastify({ logger: true });

app.register(jwt, {
    secret: process.env.JWT_SECRET as string,
  });  

app.register(cors);
app.register(rootRoute);
app.register(authRoutes);
app.register(courseRoutes);
app.register(userRoutes);

const start = async () => {
  try {
    const port = parseInt(process.env.PORT || '5000');
    await app.listen({ port, host: '0.0.0.0' });
    console.log(`🚀 Server listening on http://localhost:${port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
