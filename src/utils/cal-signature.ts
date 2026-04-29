import { createHmac, timingSafeEqual } from "crypto";

export const verifyCalSignature = (rawBody: string, signatureHeader: string | undefined, secret: string): boolean => {
	if (!signatureHeader || !secret) {
		return false;
	}

	const digest = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
	const provided = signatureHeader.replace(/^sha256=/, "");

	try {
		return timingSafeEqual(Buffer.from(digest, "hex"), Buffer.from(provided, "hex"));
	} catch {
		return false;
	}
};
