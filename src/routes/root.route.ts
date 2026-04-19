import { FastifyInstance } from 'fastify';

export default async function rootRoute(app: FastifyInstance) {
  app.get('/', async (request, reply) => {
    return { message: 'Adventure English API is live with TypeScript!' };
  });
}
