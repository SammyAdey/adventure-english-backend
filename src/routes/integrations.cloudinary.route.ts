import { FastifyInstance, FastifyRequest } from "fastify";
import { requireRole } from "../utils/auth";

type CloudinaryListResource = {
	public_id?: string;
	secure_url?: string;
	width?: number;
	height?: number;
	created_at?: string;
	resource_type?: string;
};

/**
 * Lists image uploads via Cloudinary Admin API (signed with API key + secret).
 *
 * Env:
 * - CLOUDINARY_CLOUD_NAME
 * - CLOUDINARY_API_KEY
 * - CLOUDINARY_API_SECRET
 * - CLOUDINARY_ASSET_FOLDER (optional) — folder path / public_id prefix, depending on list mode
 * - CLOUDINARY_LIST_MODE (optional) — `prefix` (default) or `asset_folder`
 *   - `prefix`: legacy **fixed folder** / uploads where `folder` becomes part of `public_id`
 *     (e.g. `course-thumbnails` → `public_id` like `course-thumbnails/abc`).
 *   - `asset_folder`: **dynamic folder** mode — lists by DAM folder name/path even when
 *     `public_id` does not include that path (e.g. folder `adventure english` in the console).
 *     Use the exact folder path shown in Cloudinary (spaces OK). Not for legacy fixed-folder-only accounts.
 *
 * Match browser uploads: set `NEXT_PUBLIC_CLOUDINARY_FOLDER` (dashboard) to the same path/name
 * you use in `CLOUDINARY_ASSET_FOLDER` when organizing uploads.
 *
 * Uses GET /resources/image?prefix=… or GET /resources/by_asset_folder?asset_folder=… (not Search API).
 */
export default async function cloudinaryIntegrationRoutes(app: FastifyInstance) {
	app.get(
		"/integrations/cloudinary/images",
		async (request: FastifyRequest<{ Querystring: { maxResults?: string } }>, reply) => {
			const roleContext = await requireRole(app, request, reply, ["admin", "instructor"]);
			if (!roleContext) return;

			const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim();
			const apiKey = process.env.CLOUDINARY_API_KEY?.trim();
			const apiSecret = process.env.CLOUDINARY_API_SECRET?.trim();

			if (!cloudName || !apiKey || !apiSecret) {
				return reply.status(503).send({
					message:
						"Cloudinary Admin API is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET on the server.",
				});
			}

			const folder = process.env.CLOUDINARY_ASSET_FOLDER?.trim();
			const listMode = (process.env.CLOUDINARY_LIST_MODE ?? "prefix").trim().toLowerCase();
			const useAssetFolderApi = listMode === "asset_folder" || listMode === "dynamic";

			const rawMax = Number(request.query?.maxResults);
			const maxResults = Number.isFinite(rawMax) ? Math.min(Math.max(Math.floor(rawMax), 1), 200) : 60;

			const auth = Buffer.from(`${apiKey}:${apiSecret}`, "utf8").toString("base64");

			const normalizedFolder = folder ? folder.replace(/^\/+|\/+$/g, "") : "";

			if (useAssetFolderApi && !normalizedFolder) {
				return reply.status(503).send({
					message:
						"CLOUDINARY_LIST_MODE is asset_folder but CLOUDINARY_ASSET_FOLDER is empty. Set it to your Cloudinary folder path (e.g. adventure english).",
				});
			}

			const url = useAssetFolderApi
				? new URL(`https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/resources/by_asset_folder`)
				: new URL(`https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/resources/image`);

			url.searchParams.set("max_results", String(maxResults));

			if (useAssetFolderApi) {
				url.searchParams.set("asset_folder", normalizedFolder);
			} else {
				url.searchParams.set("type", "upload");
				if (normalizedFolder.length > 0) {
					url.searchParams.set("prefix", normalizedFolder.endsWith("/") ? normalizedFolder : `${normalizedFolder}/`);
				}
			}

			try {
				const res = await fetch(url.toString(), {
					method: "GET",
					headers: {
						Authorization: `Basic ${auth}`,
					},
				});

				const text = await res.text();
				let json: {
					resources?: CloudinaryListResource[];
					error?: { message?: string };
				};
				try {
					json = JSON.parse(text) as typeof json;
				} catch {
					app.log.warn({ status: res.status, text: text.slice(0, 500) }, "Cloudinary list: non-JSON body");
					return reply.status(502).send({
						message: "Cloudinary returned an unexpected response.",
						details: text.slice(0, 200),
					});
				}

				if (!res.ok) {
					const errMsg = json?.error?.message ?? `HTTP ${res.status}`;
					app.log.warn({ status: res.status, body: json }, "Cloudinary list resources failed");
					return reply.status(502).send({
						message: errMsg,
						details: json?.error ?? json,
					});
				}

				const resources = Array.isArray(json.resources) ? json.resources : [];
				const images = resources
					.filter(
						(r): r is CloudinaryListResource & { public_id: string; secure_url: string } =>
							Boolean(r.public_id && r.secure_url) &&
							(!useAssetFolderApi || !r.resource_type || r.resource_type === "image"),
					)
					.map((r) => ({
						publicId: r.public_id,
						secureUrl: r.secure_url,
						width: typeof r.width === "number" ? r.width : undefined,
						height: typeof r.height === "number" ? r.height : undefined,
						createdAt: r.created_at,
					}));

				return reply.send({
					images,
					folder: folder ?? null,
					listMode: useAssetFolderApi ? "asset_folder" : "prefix",
				});
			} catch (error) {
				app.log.error({ err: error }, "Cloudinary list request failed");
				return reply.status(502).send({
					message: error instanceof Error ? error.message : "Could not reach Cloudinary.",
				});
			}
		},
	);
}
