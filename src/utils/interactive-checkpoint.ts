import type {
	CheckpointQuestionKind,
	CourseDTO,
	CourseUnitDTO,
	InteractiveCheckpointDTO,
} from "../dto/courses.dto";

const CHECKPOINT_QUESTION_KINDS: readonly CheckpointQuestionKind[] = [
	"multiple_choice",
	"true_false",
	"short_answer",
	"select_all",
	"ordering",
];

export function isCheckpointQuestionKind(value: unknown): value is CheckpointQuestionKind {
	return typeof value === "string" && (CHECKPOINT_QUESTION_KINDS as readonly string[]).includes(value);
}

const asRecord = (value: unknown): Record<string, unknown> =>
	value && typeof value === "object" ? (value as Record<string, unknown>) : {};

export function assertAuthoringCheckpointPayload(kind: CheckpointQuestionKind, payload: unknown): void {
	const p = asRecord(payload);
	switch (kind) {
		case "multiple_choice": {
			const options = p.options;
			if (!Array.isArray(options) || options.length < 2) {
				throw new Error("multiple_choice requires options array with at least 2 entries");
			}
			const strings = options.map((o) => String(o).trim()).filter(Boolean);
			if (strings.length < 2) throw new Error("multiple_choice options must be non-empty strings");
			const ci = p.correctIndex;
			if (typeof ci !== "number" || !Number.isInteger(ci) || ci < 0 || ci >= strings.length) {
				throw new Error("multiple_choice requires valid correctIndex");
			}
			break;
		}
		case "true_false": {
			if (typeof p.correct !== "boolean") {
				throw new Error("true_false requires boolean correct");
			}
			break;
		}
		case "short_answer": {
			const accepted = p.acceptedAnswers;
			if (!Array.isArray(accepted) || accepted.length < 1) {
				throw new Error("short_answer requires acceptedAnswers array");
			}
			const ok = accepted.some((a) => typeof a === "string" && String(a).trim().length > 0);
			if (!ok) throw new Error("short_answer acceptedAnswers must include a non-empty string");
			break;
		}
		case "select_all": {
			const options = p.options;
			if (!Array.isArray(options) || options.length < 2) {
				throw new Error("select_all requires options array with at least 2 entries");
			}
			const strings = options.map((o) => String(o).trim()).filter(Boolean);
			if (strings.length < 2) throw new Error("select_all options must be non-empty strings");
			const raw = p.correctIndices;
			if (!Array.isArray(raw) || raw.length < 1) {
				throw new Error("select_all requires correctIndices array");
			}
			const idxs = raw.filter((i): i is number => typeof i === "number" && Number.isInteger(i));
			if (idxs.some((i) => i < 0 || i >= strings.length)) {
				throw new Error("select_all correctIndices out of range");
			}
			break;
		}
		case "ordering": {
			const items = p.items;
			if (!Array.isArray(items) || items.length < 2) {
				throw new Error("ordering requires items array with at least 2 entries");
			}
			const strings = items.map((o) => String(o).trim()).filter(Boolean);
			if (strings.length < 2) throw new Error("ordering items must be non-empty strings");
			break;
		}
		default: {
			const _exhaustive: never = kind;
			void _exhaustive;
			throw new Error("Unknown checkpoint kind");
		}
	}
}

/** Strips solution fields for catalog / learner course responses. */
export function learnerCheckpointPayload(
	kind: CheckpointQuestionKind,
	payload: Record<string, unknown>,
): Record<string, unknown> {
	switch (kind) {
		case "multiple_choice":
			return {
				prompt: typeof payload.prompt === "string" ? payload.prompt : undefined,
				options: Array.isArray(payload.options) ? payload.options.map((o) => String(o)) : [],
			};
		case "true_false":
			return {
				statement: typeof payload.statement === "string" ? payload.statement : undefined,
			};
		case "short_answer":
			return {
				prompt: typeof payload.prompt === "string" ? payload.prompt : undefined,
			};
		case "select_all":
			return {
				prompt: typeof payload.prompt === "string" ? payload.prompt : undefined,
				options: Array.isArray(payload.options) ? payload.options.map((o) => String(o)) : [],
			};
		case "ordering": {
			const items = Array.isArray(payload.items) ? payload.items.map((o) => String(o)) : [];
			return {
				prompt: typeof payload.prompt === "string" ? payload.prompt : undefined,
				items,
			};
		}
		default: {
			const _exhaustive: never = kind;
			void _exhaustive;
			return {};
		}
	}
}

export function redactInteractiveCheckpointsOnCourse(course: CourseDTO): CourseDTO {
	const list = course.interactiveCheckpoints ?? [];
	if (!list.length) return course;
	return {
		...course,
		interactiveCheckpoints: list.map((c) => ({
			...c,
			payload: learnerCheckpointPayload(c.questionKind, asRecord(c.payload)),
		})),
	};
}

export function getAfterUnitCheckpointIdsForUnit(course: CourseDTO, unitId: string): string[] {
	const ids: string[] = [];
	for (const c of course.interactiveCheckpoints ?? []) {
		if (c.placement.mode !== "after_unit") continue;
		if (c.placement.unitId === unitId) ids.push(c.id);
	}
	return ids;
}

export function collectUnitIdsFromCourseUnits(units: CourseUnitDTO[]): Set<string> {
	const set = new Set<string>();
	units.forEach((u, i) => {
		const id = typeof u.id === "string" && u.id.trim() ? u.id.trim() : `unit-${typeof u.order === "number" ? u.order : i}`;
		set.add(id);
	});
	return set;
}

export function gradeCheckpointAttempt(
	checkpoint: InteractiveCheckpointDTO,
	body: unknown,
): { correct: boolean; explanation?: string } {
	const p = asRecord(checkpoint.payload);
	const b = asRecord(body);
	const explanation = typeof checkpoint.explanation === "string" ? checkpoint.explanation : undefined;

	switch (checkpoint.questionKind) {
		case "multiple_choice": {
			const options = (Array.isArray(p.options) ? p.options : []).map((o) => String(o));
			const correctIndex = typeof p.correctIndex === "number" ? p.correctIndex : -1;
			const selectedIndex = typeof b.selectedIndex === "number" ? b.selectedIndex : NaN;
			const correct =
				Number.isInteger(selectedIndex) && selectedIndex >= 0 && selectedIndex < options.length
					? selectedIndex === correctIndex
					: false;
			return { correct, explanation };
		}
		case "true_false": {
			const correct = p.correct === true || p.correct === false ? p.correct : null;
			const value = b.value;
			const ok = typeof value === "boolean" && correct !== null && value === correct;
			return { correct: ok, explanation };
		}
		case "short_answer": {
			const accepted = (Array.isArray(p.acceptedAnswers) ? p.acceptedAnswers : []).map((a) =>
				normalizeAnswerText(String(a)),
			);
			const text = normalizeAnswerText(typeof b.text === "string" ? b.text : "");
			const correct = text.length > 0 && accepted.some((a) => a === text);
			return { correct, explanation };
		}
		case "select_all": {
			const correctRaw = Array.isArray(p.correctIndices) ? p.correctIndices : [];
			const correctSet = new Set(
				correctRaw.filter((i): i is number => typeof i === "number" && Number.isInteger(i)),
			);
			const selectedRaw = Array.isArray(b.selectedIndices) ? b.selectedIndices : [];
			const selectedSet = new Set(
				selectedRaw.filter((i): i is number => typeof i === "number" && Number.isInteger(i)),
			);
			if (correctSet.size === 0) return { correct: false, explanation };
			if (correctSet.size !== selectedSet.size) return { correct: false, explanation };
			for (const n of correctSet) {
				if (!selectedSet.has(n)) return { correct: false, explanation };
			}
			return { correct: true, explanation };
		}
		case "ordering": {
			const expected = (Array.isArray(p.items) ? p.items : []).map((x) => String(x));
			const order = Array.isArray(b.order) ? b.order.map((x) => String(x)) : [];
			if (expected.length !== order.length) return { correct: false, explanation };
			const correct = expected.every((item, i) => item === order[i]);
			return { correct, explanation };
		}
		default: {
			const _exhaustive: never = checkpoint.questionKind;
			void _exhaustive;
			return { correct: false, explanation };
		}
	}
}

function normalizeAnswerText(value: string): string {
	return value.trim().replace(/\s+/g, " ").toLowerCase();
}
