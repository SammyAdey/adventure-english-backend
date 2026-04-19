import { FastifyInstance } from 'fastify';
import { verifyToken } from '../utils/auth.utils';

export default async function protectedRoutes(app: FastifyInstance) {
  app.addHook('onRequest', verifyToken); // protect all routes in this file

  app.get('/dashboard', async (request) => {
    const user : any = request.user; // this contains the decoded JWT payload
    return { message: `Welcome, ${user.username}` };
  });
}
