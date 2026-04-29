"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyCalSignature = void 0;
const crypto_1 = require("crypto");
const verifyCalSignature = (rawBody, signatureHeader, secret) => {
    if (!signatureHeader || !secret) {
        return false;
    }
    const digest = (0, crypto_1.createHmac)("sha256", secret).update(rawBody, "utf8").digest("hex");
    const provided = signatureHeader.replace(/^sha256=/, "");
    try {
        return (0, crypto_1.timingSafeEqual)(Buffer.from(digest, "hex"), Buffer.from(provided, "hex"));
    }
    catch (_a) {
        return false;
    }
};
exports.verifyCalSignature = verifyCalSignature;
