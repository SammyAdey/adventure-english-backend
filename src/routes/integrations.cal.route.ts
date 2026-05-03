import { FastifyInstance, FastifyRequest } from "fastify";
import { syncCalWebhookEvent } from "../services/cohort.service";
import { verifyCalSignature } from "../utils/cal-signature";
import { requireRole } from "../utils/auth";

const CAL_API_V2 = "https://api.cal.com/v2";
/** Event-types list is versioned separately from other Cal v2 calls; see Cal docs. */
const CAL_EVENT_TYPES_API_VERSION = process.env.CAL_EVENT_TYPES_API_VERSION?.trim() ?? "2024-06-14";

export default async function calIntegrationRoutes(app: FastifyInstance) {
	app.get("/integrations/cal/event-types", async (request, reply) => {
		const roleContext = await requireRole(app, request, reply, ["admin", "instructor"]);
		if (!roleContext) return;

		const apiKey = process.env.CAL_API_KEY?.trim();
		if (!apiKey) {
			return reply.status(503).send({ message: "Cal.com is not configured (set CAL_API_KEY)." });
		}

		const username = process.env.CAL_DEFAULT_USERNAME?.trim();
		const url = new URL(`${CAL_API_V2}/event-types`);
		url.searchParams.set("sortCreatedAt", "desc");
		if (username) {
			url.searchParams.set("username", username);
		}

		try {
			const res = await fetch(url, {
				headers: {
					Authorization: `Bearer ${apiKey}`,
					"cal-api-version": CAL_EVENT_TYPES_API_VERSION,
				},
			});

			const json = (await res.json()) as {
				status?: string;
				data?: unknown;
				error?: { message?: string };
			};

			if (!res.ok) {
				app.log.warn({ status: res.status, body: json }, "Cal.com event-types request failed");
				return reply.status(502).send({
					message: json?.error?.message ?? "Cal.com returned an error when listing event types.",
				});
			}

			const rows = Array.isArray(json.data) ? json.data : [];
			const eventTypes = rows
				.filter((row): row is { id: number; title?: string; slug?: string } => typeof (row as { id?: number }).id === "number")
				.map((row) => ({
					id: row.id,
					title: String(row.title ?? ""),
					slug: String(row.slug ?? ""),
				}));

			return reply.send({ eventTypes });
		} catch (error) {
			app.log.error({ err: error }, "Failed to fetch Cal.com event types");
			return reply.status(502).send({ message: "Could not reach Cal.com." });
		}
	});

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
