import { Resend } from "resend";

import {
	buildEnrollmentGrantedEmail,
	buildPurchaseConfirmationEmail,
	buildSessionBookedEmail,
	buildWelcomeEmail,
} from "./email-templates";

type MailKind = "welcome" | "purchase_confirmation" | "enrollment_granted" | "session_booked";

const resendApiKey = process.env.RESEND_API_KEY?.trim();
const mailFrom = process.env.MAIL_FROM?.trim();
const mailReplyTo = process.env.MAIL_REPLY_TO?.trim();

const resend = resendApiKey ? new Resend(resendApiKey) : null;

const isConfigured = (): boolean => Boolean(resend && mailFrom);

const sendTransactionalEmail = async (input: {
	to: string;
	subject: string;
	html: string;
	text: string;
	kind: MailKind;
}): Promise<void> => {
	if (!isConfigured()) {
		console.warn("[mail] skipped send (missing config)", {
			kind: input.kind,
			hasResendApiKey: Boolean(resendApiKey),
			hasMailFrom: Boolean(mailFrom),
		});
		return;
	}

	try {
		await resend!.emails.send({
			from: mailFrom!,
			to: input.to,
			subject: input.subject,
			text: input.text,
			html: input.html,
			...(mailReplyTo ? { replyTo: mailReplyTo } : {}),
		});
	} catch (error) {
		console.error("[mail] send failed", {
			kind: input.kind,
			to: input.to,
			err: error instanceof Error ? error.message : String(error),
		});
	}
};

export const sendWelcomeEmail = async (input: {
	to: string;
	firstName?: string;
	loginUrl?: string;
}): Promise<void> => {
	const { html, text } = buildWelcomeEmail({
		firstName: input.firstName,
		loginUrl: input.loginUrl,
	});
	await sendTransactionalEmail({
		to: input.to,
		subject: "Welcome to Adventure English",
		html,
		text,
		kind: "welcome",
	});
};

export const sendPurchaseConfirmationEmail = async (input: {
	to: string;
	courseTitle: string;
	courseUrl?: string;
	amountPaid?: number;
	currency?: string;
}): Promise<void> => {
	const courseTitle = input.courseTitle.trim();
	const { html, text } = buildPurchaseConfirmationEmail({
		courseTitle,
		courseUrl: input.courseUrl,
		amountPaid: input.amountPaid,
		currency: input.currency,
	});
	await sendTransactionalEmail({
		to: input.to,
		subject: `Purchase confirmed: ${courseTitle}`,
		html,
		text,
		kind: "purchase_confirmation",
	});
};

export const sendEnrollmentGrantedEmail = async (input: {
	to: string;
	courseTitle: string;
	accessExpiresAt?: Date | string;
	courseUrl?: string;
}): Promise<void> => {
	const courseTitle = input.courseTitle.trim();
	const { html, text } = buildEnrollmentGrantedEmail({
		courseTitle,
		accessExpiresAt: input.accessExpiresAt,
		courseUrl: input.courseUrl,
	});
	await sendTransactionalEmail({
		to: input.to,
		subject: `Enrollment granted: ${courseTitle}`,
		html,
		text,
		kind: "enrollment_granted",
	});
};

export const sendSessionBookedEmail = async (input: {
	to: string;
	cohortId: string;
	sessionId: string;
	sessionStartsAt?: Date | string;
}): Promise<void> => {
	const { html, text } = buildSessionBookedEmail({
		cohortId: input.cohortId,
		sessionId: input.sessionId,
		sessionStartsAt: input.sessionStartsAt,
	});
	await sendTransactionalEmail({
		to: input.to,
		subject: "Session booking confirmed",
		html,
		text,
		kind: "session_booked",
	});
};
