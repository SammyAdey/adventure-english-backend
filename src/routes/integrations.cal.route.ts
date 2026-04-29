import { FastifyInstance, FastifyRequest } from "fastify";
import { syncCalWebhookEvent } from "../services/cohort.service";
import { verifyCalSignature } from "../utils/cal-signature";

export default async function calIntegrationRoutes(app: FastifyInstance) {
	app.post(
		"/integrations/cal/webhook",
		{
			config: {
				rawBody: true,
			},
		},
		async (request: FastifyRequest<{ Body: unknown }>, reply) => {
			try {
				const secret = process.env.CAL_WEBHOOK_SECRET;
				const signature = request.headers["x-cal-signature"];
				const rawBody =
					(request as FastifyRequest & { rawBody?: string }).rawBody ??
					(typeof request.body === "string" ? request.body : JSON.stringify(request.body ?? {}));

				if (secret) {
					const signatureValue = Array.isArray(signature) ? signature[0] : signature;
					const valid = verifyCalSignature(rawBody, signatureValue, secret);
					if (!valid) {
						return reply.status(401).send({ message: "Invalid signature" });
					}
				}

				const payload = (typeof request.body === "string" ? JSON.parse(request.body) : request.body) as {
					type?: string;
					triggerEvent?: string;
					data?: Record<string, unknown>;
					payload?: Record<string, unknown>;
				};

				await syncCalWebhookEvent(payload);
				return reply.send({ received: true });
			} catch (error) {
				app.log.error({ err: error }, "Failed to process Cal webhook");
				return reply.status(500).send({ message: "Webhook processing failed" });
			}
		},
	);
}
