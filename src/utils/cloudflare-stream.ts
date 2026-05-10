import { importPKCS8, SignJWT } from "jose";

const DEFAULT_TOKEN_TTL_SECONDS = 10 * 60;

const parsePositiveInt = (value: string | undefined): number | undefined => {
	if (!value) return undefined;
	const n = Number(value);
	if (!Number.isFinite(n) || n <= 0) return undefined;
	return Math.floor(n);
};

const trimSlashes = (value: string): string => value.replace(/^\/+|\/+$/g, "");

const resolveBaseDeliveryUrl = (): string | null => {
	const explicitBase = process.env.CLOUDFLARE_STREAM_BASE_URL?.trim();
	if (explicitBase) return explicitBase.replace(/\/+$/, "");
	const subdomain = process.env.CLOUDFLARE_STREAM_CUSTOMER_SUBDOMAIN?.trim();
	if (!subdomain) return null;
	return `https://${subdomain.replace(/^https?:\/\//, "").replace(/\/+$/, "")}`;
};

const maybeCreatePlaybackToken = async (videoUid: string): Promise<string | null> => {
	const privateKeyPem = process.env.CLOUDFLARE_STREAM_SIGNING_PRIVATE_KEY?.trim();
	if (!privateKeyPem) {
		return null;
	}
	const keyId = process.env.CLOUDFLARE_STREAM_SIGNING_KEY_ID?.trim();
	const issuer = process.env.CLOUDFLARE_STREAM_SIGNING_ISSUER?.trim();
	const ttlSeconds = parsePositiveInt(process.env.CLOUDFLARE_STREAM_TOKEN_TTL_SECONDS) ?? DEFAULT_TOKEN_TTL_SECONDS;
	const now = Math.floor(Date.now() / 1000);
	const exp = now + ttlSeconds;
	const privateKey = await importPKCS8(privateKeyPem, "RS256");
	let jwt = new SignJWT({})
		.setProtectedHeader({
			alg: "RS256",
			typ: "JWT",
			...(keyId ? { kid: keyId } : {}),
		})
		.setSubject(videoUid)
		.setIssuedAt(now)
		.setExpirationTime(exp);
	if (issuer) {
		jwt = jwt.setIssuer(issuer);
	}
	return jwt.sign(privateKey);
};

export type CloudflarePlaybackUrlResult = {
	url: string;
	expiresAt?: Date;
	source: "signed_stream" | "stream_url";
};

export const buildCloudflarePlaybackUrl = async (
	streamPublicId: string,
): Promise<CloudflarePlaybackUrlResult | null> => {
	const baseUrl = resolveBaseDeliveryUrl();
	if (!baseUrl) return null;
	const uid = trimSlashes(streamPublicId.trim());
	if (!uid) return null;
	const url = new URL(`${baseUrl}/${uid}/manifest/video.m3u8`);
	const token = await maybeCreatePlaybackToken(uid).catch(() => null);
	if (token) {
		url.searchParams.set("token", token);
		const ttlSeconds = parsePositiveInt(process.env.CLOUDFLARE_STREAM_TOKEN_TTL_SECONDS) ?? DEFAULT_TOKEN_TTL_SECONDS;
		return {
			url: url.toString(),
			expiresAt: new Date(Date.now() + ttlSeconds * 1000),
			source: "signed_stream",
		};
	}
	return {
		url: url.toString(),
		source: "stream_url",
	};
};
