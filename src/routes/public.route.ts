import type { FastifyInstance } from "fastify";

import { buildCloudflarePlaybackUrl } from "../utils/cloudflare-stream";

/** Public Cloudflare Stream UID for the marketing hero video on the home page. */
export const MARKETING_STREAM_VIDEO_ID = "1292cac6a4209db8b9e79cb640005d7f";

export default async function publicRoutes(app: FastifyInstance) {
	app.get("/public/marketing-video/playback-url", async (_request, reply) => {
		const playback = await buildCloudflarePlaybackUrl(MARKETING_STREAM_VIDEO_ID);
		if (!playback) {
			return reply.code(503).send({
				code: "STREAM_NOT_CONFIGURED",
				message: "Cloudflare Stream is not configured for marketing playback",
			});
		}
		return {
			url: playback.url,
			...(playback.expiresAt ? { expiresAt: playback.expiresAt.toISOString() } : {}),
			source: playback.source,
		};
	});
}
