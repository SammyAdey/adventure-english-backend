const appUrl = (process.env.MAIL_APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "https://www.adventureenglish.com")
	.replace(/\/$/, "");

const logoUrl = `${appUrl}/logos/logo-black.svg`;

export const brand = {
	primary: "#FC002C",
	secondary: "#FCA91B",
	accent1: "#5732BF",
	accent2: "#51C1F7",
	background: "#F7F9FB",
	ink: "#0f172a",
	muted: "#64748b",
	white: "#ffffff",
} as const;

const escapeHtml = (value: string): string =>
	value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#039;");

type EmailCta = {
	label: string;
	href: string;
};

type EmailDetailRow = {
	label: string;
	value: string;
};

type BrandedEmailInput = {
	preheader: string;
	heading: string;
	intro: string;
	highlight?: string;
	details?: EmailDetailRow[];
	cta?: EmailCta;
	footerNote?: string;
	accentColor?: string;
};

const formatCurrency = (amount: number, currency?: string): string => {
	const code = currency?.toUpperCase() ?? "AUD";
	try {
		return new Intl.NumberFormat("en-AU", { style: "currency", currency: code }).format(amount);
	} catch {
		return `${amount.toFixed(2)} ${code}`;
	}
};

const formatDate = (value: Date | string): string =>
	new Date(value).toLocaleString("en-AU", {
		weekday: "short",
		day: "numeric",
		month: "short",
		year: "numeric",
		hour: "numeric",
		minute: "2-digit",
	});

const renderDetails = (details: EmailDetailRow[]): string =>
	details
		.map(
			(row) => `
      <tr>
        <td style="padding:10px 0;border-top:1px solid #e2e8f0;font-size:13px;color:${brand.muted};width:38%;vertical-align:top;">${escapeHtml(row.label)}</td>
        <td style="padding:10px 0;border-top:1px solid #e2e8f0;font-size:14px;color:${brand.ink};font-weight:600;vertical-align:top;">${escapeHtml(row.value)}</td>
      </tr>`,
		)
		.join("");

const renderBrandedEmail = (input: BrandedEmailInput): { html: string; text: string } => {
	const accent = input.accentColor ?? brand.primary;
	const detailsHtml = input.details?.length
		? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:20px 0 8px;border-collapse:collapse;">${renderDetails(input.details)}</table>`
		: "";

	const ctaHtml = input.cta
		? `<table role="presentation" cellspacing="0" cellpadding="0" style="margin:24px 0 8px;">
        <tr>
          <td align="center" style="border-radius:10px;background:${brand.primary};">
            <a href="${escapeHtml(input.cta.href)}" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border:2px solid #000000;border-radius:10px;">${escapeHtml(input.cta.label)}</a>
          </td>
        </tr>
      </table>`
		: "";

	const footer = input.footerNote ?? "Adventure English · Learn with confidence";

	const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(input.heading)}</title>
  </head>
  <body style="margin:0;padding:0;background:${brand.background};">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(input.preheader)}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:linear-gradient(180deg,#C6DAF1 0%,#E3DBF5 100%);padding:28px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;border-collapse:separate;">
            <tr>
              <td style="padding:0 0 16px;" align="center">
                <img src="${logoUrl}" width="160" alt="Adventure English" style="display:block;border:0;outline:none;text-decoration:none;" />
              </td>
            </tr>
            <tr>
              <td style="background:${brand.white};border:3px solid #000000;border-radius:20px;overflow:hidden;box-shadow:0 12px 30px rgba(15,23,42,0.08);">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    <td style="height:8px;background:linear-gradient(90deg,${brand.primary} 0%,${brand.secondary} 55%,${accent} 100%);"></td>
                  </tr>
                  <tr>
                    <td style="padding:32px 28px 24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:${brand.ink};">
                      <p style="margin:0 0 8px;font-size:12px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:${accent};">Adventure English</p>
                      <h1 style="margin:0 0 14px;font-size:28px;line-height:1.2;font-weight:800;color:${brand.ink};">${escapeHtml(input.heading)}</h1>
                      <p style="margin:0 0 12px;font-size:16px;line-height:1.6;color:${brand.ink};">${escapeHtml(input.intro)}</p>
                      ${
												input.highlight
													? `<div style="margin:18px 0;padding:14px 16px;border:2px solid #000000;border-radius:14px;background:${brand.background};">
                        <p style="margin:0;font-size:15px;line-height:1.55;color:${brand.ink};font-weight:600;">${escapeHtml(input.highlight)}</p>
                      </div>`
													: ""
											}
                      ${detailsHtml}
                      ${ctaHtml}
                      <p style="margin:24px 0 0;font-size:13px;line-height:1.6;color:${brand.muted};">Questions? Reply to this email and our team will help.</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:18px 8px 0;text-align:center;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;font-size:12px;line-height:1.5;color:${brand.muted};">
                ${escapeHtml(footer)}
                <br />
                <a href="${appUrl}" style="color:${brand.primary};text-decoration:none;font-weight:600;">${escapeHtml(appUrl.replace(/^https?:\/\//, ""))}</a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

	const textParts = [
		input.heading,
		"",
		input.intro,
		input.highlight ?? "",
		...(input.details?.map((row) => `${row.label}: ${row.value}`) ?? []),
		...(input.cta ? ["", `${input.cta.label}: ${input.cta.href}`] : []),
		"",
		footer,
	].filter(Boolean);

	return { html, text: textParts.join("\n") };
};

export const buildWelcomeEmail = (input: {
	firstName?: string;
	loginUrl?: string;
}): { html: string; text: string } => {
	const name = input.firstName?.trim() || "there";
	const loginUrl = input.loginUrl?.trim() || `${appUrl}/en/login`;
	return renderBrandedEmail({
		preheader: "Your Adventure English account is ready",
		heading: `Welcome, ${name}`,
		intro: "Your account is ready. Sign in to explore courses, track your progress, and continue your English journey with us.",
		highlight: "We are excited to have you learning with Adventure English.",
		cta: { label: "Sign in to your account", href: loginUrl },
		accentColor: brand.accent1,
	});
};

export const buildPurchaseConfirmationEmail = (input: {
	courseTitle: string;
	courseUrl?: string;
	amountPaid?: number;
	currency?: string;
}): { html: string; text: string } => {
	const courseTitle = input.courseTitle.trim();
	const amount =
		typeof input.amountPaid === "number" && Number.isFinite(input.amountPaid)
			? formatCurrency(input.amountPaid, input.currency)
			: undefined;
	const courseUrl = input.courseUrl?.trim() || appUrl;

	return renderBrandedEmail({
		preheader: `Purchase confirmed for ${courseTitle}`,
		heading: "Purchase confirmed",
		intro: "Thank you for your purchase. Your course access is now active and ready whenever you are.",
		highlight: courseTitle,
		details: [
			...(amount ? [{ label: "Amount paid", value: amount }] : []),
			{ label: "Status", value: "Active" },
		],
		cta: courseUrl ? { label: "Start learning", href: courseUrl } : undefined,
		accentColor: brand.secondary,
	});
};

export const buildEnrollmentGrantedEmail = (input: {
	courseTitle: string;
	accessExpiresAt?: Date | string;
	courseUrl?: string;
}): { html: string; text: string } => {
	const courseTitle = input.courseTitle.trim();
	const expires =
		input.accessExpiresAt != null
			? formatDate(input.accessExpiresAt)
			: "No expiry date set";
	const courseUrl = input.courseUrl?.trim();

	return renderBrandedEmail({
		preheader: `You now have access to ${courseTitle}`,
		heading: "Course access granted",
		intro: "You have been granted access to a course on Adventure English.",
		highlight: courseTitle,
		details: [
			{ label: "Access", value: "Active" },
			{ label: "Expires", value: expires },
		],
		cta: courseUrl ? { label: "Open your course", href: courseUrl } : undefined,
		accentColor: brand.accent1,
	});
};

export const buildSessionBookedEmail = (input: {
	cohortId: string;
	sessionId: string;
	sessionStartsAt?: Date | string;
}): { html: string; text: string } => {
	const startsAt =
		input.sessionStartsAt != null
			? formatDate(input.sessionStartsAt)
			: "Check your dashboard for the latest session time";

	return renderBrandedEmail({
		preheader: "Your tutoring session is booked",
		heading: "Session booking confirmed",
		intro: "Your tutoring session has been booked. Please join a few minutes early so you can settle in and get the most from your session.",
		details: [
			{ label: "Cohort", value: input.cohortId },
			{ label: "Session", value: input.sessionId },
			{ label: "Starts", value: startsAt },
		],
		cta: { label: "View my dashboard", href: `${appUrl}/en/dashboard` },
		accentColor: brand.accent2,
	});
};
