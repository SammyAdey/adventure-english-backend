import { FastifyInstance, FastifyRequest } from "fastify";
import Stripe from "stripe";
import { addUserPurchaseByEmail, getUserByEmail } from "../services/user.service";
import { getCourseById } from "../services/course.service";
import { getCohortByCohortIdForCourse } from "../services/cohort.service";
import { computeEnrollmentAccessExpiresAt } from "../utils/enrollment-access";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

const stripe = stripeSecretKey ? new Stripe(stripeSecretKey) : null;

type StripeWebhookBody = Buffer | string | Record<string, unknown>;
type StripeCheckoutSessionShape = {
	id: string;
	metadata?: Record<string, string>;
	customer_details?: { email?: string | null } | null;
	customer_email?: string | null;
	amount_total?: number | null;
	currency?: string | null;
	payment_intent?: string | null;
	customer?: string | null;
};

export default async function stripeIntegrationRoutes(app: FastifyInstance) {
	app.post(
		"/integrations/stripe/webhook",
		{
			config: {
				rawBody: true,
			},
		},
		async (request: FastifyRequest<{ Body: StripeWebhookBody }>, reply) => {
			if (!stripe || !stripeWebhookSecret) {
				return reply.status(500).send({ message: "Stripe webhook is not configured" });
			}

			const signature = request.headers["stripe-signature"];
			if (!signature) {
				return reply.status(400).send({ message: "Missing stripe signature" });
			}

			try {
				const rawBody = (request as FastifyRequest & { rawBody?: string }).rawBody;
				const rawPayload = rawBody
					? Buffer.from(rawBody)
					: Buffer.isBuffer(request.body)
					? request.body
					: Buffer.from(
							typeof request.body === "string"
								? request.body
								: JSON.stringify(request.body ?? {}),
						);

				const event = stripe.webhooks.constructEvent(
					rawPayload,
					Array.isArray(signature) ? signature[0] : signature,
					stripeWebhookSecret,
				);

				if (
					event.type === "checkout.session.completed" ||
					event.type === "checkout.session.async_payment_succeeded"
				) {
					const session = event.data.object as StripeCheckoutSessionShape;
					const courseId = session.metadata?.courseId;
					const cohortIdRaw = session.metadata?.cohortId?.trim();
					const cohortId = cohortIdRaw || undefined;
					const customerEmail = session.customer_details?.email ?? session.customer_email;

					if (!courseId || !customerEmail) {
						return reply.send({ received: true, skipped: true });
					}

					const course = await getCourseById(courseId);
					if (!course) {
						return reply.send({ received: true, skipped: true });
					}

					const deliveryMode = course.deliveryMode ?? "online";
					if (deliveryMode === "in_person" && !cohortId) {
						app.log.warn({ courseId }, "Stripe checkout missing cohortId for in_person course; skipping purchase");
						return reply.send({ received: true, skipped: true });
					}

					const existingUser = await getUserByEmail(customerEmail);
					if (!existingUser) {
						return reply.send({ received: true, skipped: true });
					}

					const hasMatchingSession = (existingUser.purchasedCourses ?? []).some(
						(purchase) =>
							Boolean(purchase.stripeCheckoutSessionId) &&
							purchase.stripeCheckoutSessionId === session.id,
					);
					if (!hasMatchingSession) {
						const amountPaid =
							typeof session.amount_total === "number"
								? Math.round((session.amount_total / 100) * 100) / 100
								: undefined;

						const purchasedAt = new Date();
						let accessExpiresAt: Date | undefined;
						let resolvedCohortId: string | undefined;

						if (deliveryMode === "online") {
							accessExpiresAt = computeEnrollmentAccessExpiresAt(
								purchasedAt,
								course.enrollmentAccessPeriod,
							);
						} else if (cohortId) {
							const cohort = await getCohortByCohortIdForCourse(courseId, cohortId);
							if (!cohort) {
								app.log.warn({ courseId, cohortId }, "Stripe webhook cohort not found; skipping purchase");
								return reply.send({ received: true, skipped: true });
							}
							resolvedCohortId = cohort.cohortId;
							accessExpiresAt = cohort.termEndsAt ? new Date(cohort.termEndsAt) : undefined;
						}

						await addUserPurchaseByEmail(customerEmail, {
							courseId: course.courseId ?? course.id,
							purchasedAt,
							amountPaid,
							currency: session.currency?.toUpperCase(),
							purchaseSource: "web",
							accessStatus: "active",
							paymentProvider: "stripe",
							stripePaymentIntentId:
								typeof session.payment_intent === "string"
									? session.payment_intent
									: undefined,
							stripeCheckoutSessionId: session.id,
							stripeCustomerId:
								typeof session.customer === "string" ? session.customer : undefined,
							paymentStatus: "succeeded",
							progressPercent: 0,
							...(resolvedCohortId ? { cohortId: resolvedCohortId } : {}),
							...(accessExpiresAt ? { accessExpiresAt } : {}),
						});
					}
				}

				return reply.send({ received: true });
			} catch (error) {
				app.log.error({ err: error }, "Failed to process Stripe webhook");
				return reply.status(400).send({ message: "Webhook verification failed" });
			}
		},
	);
}
