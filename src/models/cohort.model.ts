import { Collection, Db } from "mongodb";
import { MongoCohort } from "../dto/cohorts.dto";

let cohortCollection: Collection<MongoCohort>;

export const initCohortCollection = (db: Db) => {
	cohortCollection = db.collection<MongoCohort>("cohorts");
	return cohortCollection;
};

export const getCohortCollection = () => {
	if (!cohortCollection) {
		throw new Error("Cohort collection not initialized.");
	}
	return cohortCollection;
};
