// /src/models/course.model.ts

import { Db, Collection } from "mongodb";
import { MongoCourse } from "../dto/courses.dto";

let coursesCollection: Collection<MongoCourse>;

export const initCourseCollection = (db: Db) => {
	coursesCollection = db.collection<MongoCourse>("courses");
	return coursesCollection;
};

export const getCourseCollection = () => {
	if (!coursesCollection) {
		throw new Error("Course collection not initialized.");
	}
	return coursesCollection;
};
