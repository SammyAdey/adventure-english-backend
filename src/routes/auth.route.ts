import { FastifyInstance, FastifyRequest } from 'fastify';
import { connectToDatabase } from "../utils/mongo";
import { getUserCollection, initUserCollection } from "../models/user.model";

interface LoginBody {
  email: string;
  password: string;
}

interface ValidateRequest extends FastifyRequest {
  headers: {
    authorization?: string;
  };
}

interface RegisterBody {
  password: string;
  email: string;
  firstName: string;
  lastName: string;
}

export default async function authRoutes(app: FastifyInstance) {
 
  app.post('/auth/validate', async (request: ValidateRequest, reply) => {
    try {
      const authHeader = request.headers.authorization;
      if (!authHeader) {
        return reply.status(401).send({ message: 'Missing token' });
      }

      const token = authHeader.replace('Bearer ', '');
      const decoded = app.jwt.verify(token);
      return reply.send({ valid: true, user: decoded });
    } catch (error) {
      return reply.status(401).send({ message: 'Invalid or expired token' });
    }
  });

  app.post('/auth/login', async (request: FastifyRequest<{ Body: LoginBody }>, reply) => {
    const { email, password } = request.body;

    const db = await connectToDatabase();
    initUserCollection(db);
    const users = getUserCollection();

    const user = await users.findOne({ email });
    if (!user) {
      return reply.status(401).send({ message: 'No user with this email was found' });
    }

    // In a real app, you should hash passwords and use bcrypt.compare()
    if (user.password === password) {
      const token = app.jwt.sign({ email: user.email });
      const { password, ...userWithoutPassword } = user;
      return reply.send({
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        token,
      });
    }

    return reply.status(401).send({ message: 'Username or password is incorrect' });
  });


  app.post("/auth/register", async (request: FastifyRequest<{ Body: RegisterBody }>, reply) => {
    const db = await connectToDatabase();
    initUserCollection(db);
    const users = getUserCollection();
  
    const { password, email, firstName, lastName } = request.body;
  
    const existingUser = await users.findOne({ email });
    if (existingUser) {
      return reply.status(400).send({ message: "User already exists" });
    }
  
    await users.insertOne({
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
  })}
