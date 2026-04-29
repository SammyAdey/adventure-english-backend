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
exports.default = stripeIntegrationRoutes;
const stripe_1 = __importDefault(require("stripe"));
const user_service_1 = require("../services/user.service");
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
const stripe = stripeSecretKey ? new stripe_1.default(stripeSecretKey) : null;
function stripeIntegrationRoutes(app) {
    return __awaiter(this, void 0, void 0, function* () {
        app.post("/integrations/stripe/webhook", {
            config: {
                rawBody: true,
            },
        }, (request, reply) => __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e, _f;
            if (!stripe || !stripeWebhookSecret) {
                return reply.status(500).send({ message: "Stripe webhook is not configured" });
            }
            const signature = request.headers["stripe-signature"];
            if (!signature) {
                return reply.status(400).send({ message: "Missing stripe signature" });
            }
            try {
                const rawBody = request.rawBody;
                const rawPayload = rawBody
                    ? Buffer.from(rawBody)
                    : Buffer.isBuffer(request.body)
                        ? request.body
                        : Buffer.from(typeof request.body === "string"
                            ? request.body
                            : JSON.stringify((_a = request.body) !== null && _a !== void 0 ? _a : {}));
                const event = stripe.webhooks.constructEvent(rawPayload, Array.isArray(signature) ? signature[0] : signature, stripeWebhookSecret);
                if (event.type === "checkout.session.completed" ||
                    event.type === "checkout.session.async_payment_succeeded") {
                    const session = event.data.object;
                    const courseId = (_b = session.metadata) === null || _b === void 0 ? void 0 : _b.courseId;
                    const customerEmail = (_d = (_c = session.customer_details) === null || _c === void 0 ? void 0 : _c.email) !== null && _d !== void 0 ? _d : session.customer_email;
                    if (!courseId || !customerEmail) {
                        return reply.send({ received: true, skipped: true });
                    }
                    const existingUser = yield (0, user_service_1.getUserByEmail)(customerEmail);
                    if (!existingUser) {
                        return reply.send({ received: true, skipped: true });
                    }
                    const hasMatchingSession = ((_e = existingUser.purchasedCourses) !== null && _e !== void 0 ? _e : []).some((purchase) => Boolean(purchase.stripeCheckoutSessionId) &&
                        purchase.stripeCheckoutSessionId === session.id);
                    if (!hasMatchingSession) {
                        const amountPaid = typeof session.amount_total === "number"
                            ? Math.round((session.amount_total / 100) * 100) / 100
                            : undefined;
                        yield (0, user_service_1.addUserPurchaseByEmail)(customerEmail, {
                            courseId,
                            purchasedAt: new Date(),
                            amountPaid,
                            currency: (_f = session.currency) === null || _f === void 0 ? void 0 : _f.toUpperCase(),
                            purchaseSource: "web",
                            accessStatus: "active",
                            paymentProvider: "stripe",
                            stripePaymentIntentId: typeof session.payment_intent === "string"
                                ? session.payment_intent
                                : undefined,
                            stripeCheckoutSessionId: session.id,
                            stripeCustomerId: typeof session.customer === "string" ? session.customer : undefined,
                            paymentStatus: "succeeded",
                            progressPercent: 0,
                        });
                    }
                }
                return reply.send({ received: true });
            }
            catch (error) {
                app.log.error({ err: error }, "Failed to process Stripe webhook");
                return reply.status(400).send({ message: "Webhook verification failed" });
            }
        }));
    });
}
