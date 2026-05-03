import type { Filter } from "mongodb";
import type { MongoCourse } from "../dto/courses.dto";

/**
 * Matches course documents that are not soft-deleted.
 * Use for catalog, edits, cohorts, and metrics counts.
 */
export const mongoCourseActiveFilter: Filter<MongoCourse> = {
	$or: [{ deletedAt: { $exists: false } }, { deletedAt: null }],
};
