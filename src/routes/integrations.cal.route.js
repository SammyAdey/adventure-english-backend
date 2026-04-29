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
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = calIntegrationRoutes;
const cohort_service_1 = require("../services/cohort.service");
const cal_signature_1 = require("../utils/cal-signature");
function calIntegrationRoutes(app) {
    return __awaiter(this, void 0, void 0, function* () {
        app.post("/integrations/cal/webhook", {
            config: {
                rawBody: true,
            },
        }, (request, reply) => __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            try {
                const secret = process.env.CAL_WEBHOOK_SECRET;
                const signature = request.headers["x-cal-signature"];
                const rawBody = (_a = request.rawBody) !== null && _a !== void 0 ? _a : (typeof request.body === "string" ? request.body : JSON.stringify((_b = request.body) !== null && _b !== void 0 ? _b : {}));
                if (secret) {
                    const signatureValue = Array.isArray(signature) ? signature[0] : signature;
                    const valid = (0, cal_signature_1.verifyCalSignature)(rawBody, signatureValue, secret);
                    if (!valid) {
                        return reply.status(401).send({ message: "Invalid signature" });
                    }
                }
                const payload = (typeof request.body === "string" ? JSON.parse(request.body) : request.body);
                yield (0, cohort_service_1.syncCalWebhookEvent)(payload);
                return reply.send({ received: true });
            }
            catch (error) {
                app.log.error({ err: error }, "Failed to process Cal webhook");
                return reply.status(500).send({ message: "Webhook processing failed" });
            }
        }));
    });
}
