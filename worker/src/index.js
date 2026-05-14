const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const TURNSTILE_ACTION = "lead_intake_submit";

const ALLOWED_NEED_TYPES = new Set([
  "Build a new AI product or workflow",
  "Build an agent for an existing workflow",
  "Architecture / advisory / rescue"
]);

const ALLOWED_TIMELINES = new Set([
  "ASAP",
  "Within 2-4 weeks",
  "Within 1-2 months",
  "Just exploring"
]);

const DEFAULT_ALLOWED_ORIGINS = [
  "https://latentship.com",
  "https://www.latentship.com",
  "https://latentship.github.io",
  "http://localhost:8080",
  "http://127.0.0.1:8080"
];

const DEFAULT_ALLOWED_TURNSTILE_HOSTNAMES = [
  "latentship.com",
  "www.latentship.com",
  "latentship.github.io",
  "localhost",
  "127.0.0.1"
];

function parseCsvList(raw, fallback) {
  if (typeof raw !== "string" || !raw.trim()) return fallback;
  return raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeText(value) {
  if (typeof value !== "string") return "";
  const cleaned = value.replace(/\u0000/g, "").trim();
  if (!cleaned) return "";
  const lowered = cleaned.toLowerCase();
  if (lowered === "undefined" || lowered === "null" || lowered === "nan") return "";
  return cleaned;
}

function getOriginContext(request, allowedOrigins) {
  const origin = request.headers.get("Origin");
  if (!origin) {
    return { allowed: true, responseOrigin: allowedOrigins[0] || "*" };
  }
  try {
    const parsed = new URL(origin);
    // Allow any local development origin regardless of port.
    if (parsed.protocol === "http:" && (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1")) {
      return { allowed: true, responseOrigin: origin };
    }
  } catch (_err) {
    // Ignore parsing issues and fall through to explicit allow list.
  }
  if (allowedOrigins.includes(origin)) {
    return { allowed: true, responseOrigin: origin };
  }
  return { allowed: false, responseOrigin: allowedOrigins[0] || "*" };
}

function getCorsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin"
  };
}

function jsonResponse(body, status, origin) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...getCorsHeaders(origin),
      "Content-Type": "application/json"
    }
  });
}

function getClientIp(request) {
  const candidate =
    request.headers.get("CF-Connecting-IP") ||
    request.headers.get("X-Forwarded-For") ||
    "";

  return candidate.split(",")[0].trim() || "unknown";
}

function logRejectedRequest(reason, request, details = {}) {
  const cf = request.cf || {};
  console.warn(
    JSON.stringify({
      event: "lead_intake_rejected",
      reason,
      ip: getClientIp(request),
      origin: request.headers.get("Origin") || "none",
      ua: request.headers.get("User-Agent") || "unknown",
      host: request.headers.get("Host") || "unknown",
      colo: cf.colo || "unknown",
      country: cf.country || "unknown",
      details
    })
  );
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validatePayload(rawBody) {
  if (!rawBody || typeof rawBody !== "object" || Array.isArray(rawBody)) {
    return { ok: false, message: "Invalid request body." };
  }

  const needType = normalizeText(rawBody.needType);
  const projectBrief = normalizeText(rawBody.projectBrief);
  const timeline = normalizeText(rawBody.timeline);
  const firstName = normalizeText(rawBody.firstName);
  const email = normalizeText(rawBody.email);
  const company = normalizeText(rawBody.company);
  const source = normalizeText(rawBody.source) || "latentship-site";
  const page = normalizeText(rawBody.page);
  const submittedAt = normalizeText(rawBody.submittedAt);
  const honeypot = normalizeText(rawBody.website || rawBody.honeypot);
  const turnstileToken = normalizeText(rawBody.turnstileToken || rawBody["cf-turnstile-response"]);

  if (honeypot) return { ok: false, spam: true, message: "Spam submission rejected." };
  if (!ALLOWED_NEED_TYPES.has(needType)) return { ok: false, message: "Invalid need type." };
  if (projectBrief.length < 12 || projectBrief.length > 4000) return { ok: false, message: "Project brief is invalid." };
  if (!ALLOWED_TIMELINES.has(timeline)) return { ok: false, message: "Invalid timeline." };
  if (!firstName || firstName.length > 80) return { ok: false, message: "First name is invalid." };
  if (!company || company.length > 120) return { ok: false, message: "Company is invalid." };
  if (!email || email.length > 200 || !isValidEmail(email)) return { ok: false, message: "Email is invalid." };
  if (!turnstileToken || turnstileToken.length > 2048) return { ok: false, message: "Verification token is missing." };
  if (source.length > 120) return { ok: false, message: "Source is invalid." };
  if (page.length > 400) return { ok: false, message: "Page value is invalid." };

  return {
    ok: true,
    data: {
      needType,
      projectBrief,
      timeline,
      firstName,
      email,
      company,
      source,
      page,
      submittedAt,
      turnstileToken
    }
  };
}

async function verifyTurnstileToken(request, env, token, allowedHostnames) {
  if (!env.TURNSTILE_SECRET_KEY) {
    console.error("TURNSTILE_SECRET_KEY is missing from Worker environment.");
    return { ok: false, code: "turnstile-not-configured" };
  }

  const remoteIp = getClientIp(request);
  const payload = new URLSearchParams({
    secret: env.TURNSTILE_SECRET_KEY,
    response: token
  });

  if (remoteIp && remoteIp !== "unknown") {
    payload.set("remoteip", remoteIp);
  }

  const verifyRes = await fetch(TURNSTILE_VERIFY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: payload.toString()
  });

  let verifyJson = null;
  try {
    verifyJson = await verifyRes.json();
  } catch (_err) {
    return { ok: false, code: "turnstile-invalid-response" };
  }

  if (!verifyRes.ok) {
    return { ok: false, code: "turnstile-api-error", details: verifyJson };
  }

  if (!verifyJson.success) {
    return {
      ok: false,
      code: "turnstile-verification-failed",
      details: { errors: verifyJson["error-codes"] || [] }
    };
  }

  if (verifyJson.action && verifyJson.action !== TURNSTILE_ACTION) {
    return {
      ok: false,
      code: "turnstile-action-mismatch",
      details: { action: verifyJson.action }
    };
  }

  if (verifyJson.hostname && allowedHostnames.length > 0 && !allowedHostnames.includes(verifyJson.hostname)) {
    return {
      ok: false,
      code: "turnstile-hostname-mismatch",
      details: { hostname: verifyJson.hostname }
    };
  }

  return { ok: true };
}

function buildEmailBody(data, request) {
  const ip = getClientIp(request);
  return `
New LatentShip Intake

Name: ${data.firstName}
Email: ${data.email}
Company: ${data.company}

Need: ${data.needType}
Timeline: ${data.timeline}

Brief:
${data.projectBrief}

Metadata:
Source: ${data.source}
Page: ${data.page || "unknown"}
Submitted At: ${data.submittedAt || "unknown"}
IP: ${ip}
  `;
}

export default {
  async fetch(request, env) {
    const allowedOrigins = parseCsvList(env.ALLOWED_ORIGINS, DEFAULT_ALLOWED_ORIGINS);
    const allowedTurnstileHostnames = parseCsvList(env.TURNSTILE_ALLOWED_HOSTNAMES, DEFAULT_ALLOWED_TURNSTILE_HOSTNAMES);
    const originCtx = getOriginContext(request, allowedOrigins);

    if (request.method === "OPTIONS") {
      if (!originCtx.allowed && request.headers.get("Origin")) {
        return jsonResponse({ error: "Origin not allowed." }, 403, originCtx.responseOrigin);
      }
      return new Response(null, {
        status: 204,
        headers: getCorsHeaders(originCtx.responseOrigin)
      });
    }

    if (!originCtx.allowed && request.headers.get("Origin")) {
      logRejectedRequest("origin-not-allowed", request);
      return jsonResponse({ error: "Origin not allowed." }, 403, originCtx.responseOrigin);
    }

    if (request.method !== "POST") {
      return jsonResponse({ error: "Method not allowed." }, 405, originCtx.responseOrigin);
    }

    let body = null;
    try {
      body = await request.json();
    } catch (_err) {
      logRejectedRequest("invalid-json", request);
      return jsonResponse({ error: "Invalid JSON payload." }, 400, originCtx.responseOrigin);
    }

    const validated = validatePayload(body);
    if (!validated.ok) {
      if (validated.spam) {
        logRejectedRequest("honeypot-populated", request);
        return jsonResponse({ success: true }, 200, originCtx.responseOrigin);
      }
      logRejectedRequest("payload-validation-failed", request, { message: validated.message });
      return jsonResponse({ error: validated.message }, 400, originCtx.responseOrigin);
    }

    const turnstile = await verifyTurnstileToken(
      request,
      env,
      validated.data.turnstileToken,
      allowedTurnstileHostnames
    );

    if (!turnstile.ok) {
      logRejectedRequest(turnstile.code, request, turnstile.details);
      return jsonResponse({ error: "Verification failed." }, 403, originCtx.responseOrigin);
    }

    if (!env.RESEND_API_KEY || !env.LEAD_FORWARD_TO) {
      console.error("Missing RESEND_API_KEY or LEAD_FORWARD_TO in Worker environment.");
      return jsonResponse({ error: "Email service is not configured." }, 503, originCtx.responseOrigin);
    }

    const emailText = buildEmailBody(validated.data, request);
    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: "hello@latentship.com",
        to: [env.LEAD_FORWARD_TO],
        reply_to: validated.data.email,
        subject: "New LatentShip intake",
        text: emailText
      })
    });

    if (!resendRes.ok) {
      const errorBody = await resendRes.text();
      console.error("Resend request failed", errorBody);
      return jsonResponse({ error: "Failed to send intake email." }, 502, originCtx.responseOrigin);
    }

    return jsonResponse({ success: true }, 200, originCtx.responseOrigin);
  }
};
