import type { EnrollmentAccessPeriod } from "../dto/courses.dto";

/** End of access from `enrolledAt` based on course policy. `lifetime` / undefined → no expiry. */
export function computeEnrollmentAccessExpiresAt(
	enrolledAt: Date,
	period?: EnrollmentAccessPeriod | null,
): Date | undefined {
	if (period == null || period === "lifetime") {
		return undefined;
	}
	const d = new Date(enrolledAt.getTime());
	switch (period) {
		case "three_weeks":
			d.setDate(d.getDate() + 21);
			return d;
		case "one_quarter":
			d.setMonth(d.getMonth() + 3);
			return d;
		case "one_year":
			d.setFullYear(d.getFullYear() + 1);
			return d;
		default:
			return undefined;
	}
}
