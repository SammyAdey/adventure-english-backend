import type { CourseInputDTO } from "../dto/courses.dto";

const truthy = (v: string | undefined) => v === "1" || v === "true" || v === "yes";

/** Set `LOG_COURSE_BODY=1` when running the API to log validated mutation bodies (marketing fields). */
export const shouldLogCourseBody = (): boolean => truthy(process.env.LOG_COURSE_BODY);

export function logCourseMutationBody(
	logger: { info: (obj: Record<string, unknown>) => void },
	op: "POST /courses" | "PATCH /courses/:courseId",
	body: CourseInputDTO,
	courseId?: string,
): void {
	if (!shouldLogCourseBody()) return;
	const meta = body.meta;
	const features = meta && typeof meta === "object" && "features" in meta ? meta.features : undefined;
	logger.info({
		msg: "[course mutation] validated body snapshot",
		op,
		courseId: courseId ?? null,
		topLevelKeys: Object.keys(body as object).sort(),
		isRecommended: body.isRecommended,
		isSoldOut: body.isSoldOut,
		metaIsObject: meta !== null && typeof meta === "object",
		metaKeys: meta && typeof meta === "object" ? Object.keys(meta).sort() : [],
		featuresLength: Array.isArray(features) ? features.length : null,
		featuresPreview: Array.isArray(features) ? features.slice(0, 5) : null,
	});
}

/** After mapping to the Mongo document shape (use with `LOG_COURSE_BODY=1`). */
export function logPreparedCourseDocument(
	label: string,
	doc: { courseId?: string; isRecommended?: boolean; meta?: unknown },
): void {
	if (!shouldLogCourseBody()) return;
	// eslint-disable-next-line no-console -- intentional debug when env is set
	console.info("[course persistence]", label, JSON.stringify(doc));
}
