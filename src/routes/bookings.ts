// server.ts
import Fastify from "fastify";
import fastifyCookie from "@fastify/cookie";
import cors from "@fastify/cors";
import { SignJWT, jwtVerify } from "jose";
import { fetch } from "undici";

const CAL_API = "https://api.cal.com/v2";
const CAL_API_KEY = process.env.CAL_API_KEY!;
const CAL_API_VERSION = process.env.CAL_API_VERSION || "2024-08-13";
const JWT_SECRET = new TextEncoder().encode(process.env.APP_JWT_SECRET!);

async function startServer() {
  const app = Fastify({ logger: true });

  await app.register(cors, {
    origin: ["http://localhost:3000", "https://your-frontend.com"],
    credentials: true, // allow cookies
  });
  await app.register(fastifyCookie);

  // --- helpers ---
  async function signSession(email: string) {
    return await new SignJWT({ email })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("2h")
      .sign(JWT_SECRET);
  }

  async function getUserEmailFromReq(req: any): Promise<string | null> {
    const token = req.cookies?.session;
    if (!token) return null;
    try {
      const { payload } = await jwtVerify(token, JWT_SECRET);
      return (payload.email as string) ?? null;
    } catch {
      return null;
    }
  }

  // --- routes ---

  // 1) Login (issue HttpOnly cookie). Replace body validation with your real auth.
  app.post("/api/auth/login", async (req, reply) => {
    const { email } = (req.body as any) || {};
    if (!email) return reply.code(400).send({ error: "Email required" });

    const token = await signSession(email);
    reply
      .setCookie("session", token, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 60 * 60 * 2, // 2 hours
      })
      .send({ ok: true });
  });

  // 2) List my bookings (uses attendeeEmail = session email)
  app.get("/api/cal/bookings", async (req, reply) => {
    const email = await getUserEmailFromReq(req);
    if (!email) return reply.code(401).send({ error: "Not logged in" });

    const url = new URL(`${CAL_API}/bookings`);
    url.searchParams.set("attendeeEmail", email);

    const res = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${CAL_API_KEY}`,
        "cal-api-version": CAL_API_VERSION,
      },
    });
    const data = await res.json();
    return reply.code(res.status).send(data);
  });

  // 3) Reschedule booking
  app.post("/api/cal/bookings/:uid/reschedule", async (req, reply) => {
    const email = await getUserEmailFromReq(req);
    if (!email) return reply.code(401).send({ error: "Not logged in" });

    const { uid } = req.params as any;
    const { newStartISO } = (req.body as any) || {};
    if (!newStartISO) return reply.code(400).send({ error: "newStartISO required" });

    const res = await fetch(`${CAL_API}/bookings/${uid}/reschedule`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${CAL_API_KEY}`,
        "cal-api-version": CAL_API_VERSION,
      },
      body: JSON.stringify({ start: newStartISO, email /* optional */ }),
    });
    const data = await res.json();
    return reply.code(res.status).send(data);
  });

  // 4) Cancel booking
  app.post("/api/cal/bookings/:uid/cancel", async (req, reply) => {
    const email = await getUserEmailFromReq(req);
    if (!email) return reply.code(401).send({ error: "Not logged in" });

    const { uid } = req.params as any;
    const res = await fetch(`${CAL_API}/bookings/${uid}/cancel`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${CAL_API_KEY}`,
        "cal-api-version": CAL_API_VERSION,
      },
    });
    const data = await res.json();
    return reply.code(res.status).send(data);
  });

  await app.listen({ port: 4000, host: "0.0.0.0" });
}

startServer().catch(console.error);