import { Collection, Db } from "mongodb";
import { MongoAttendance } from "../dto/cohorts.dto";

let attendanceCollection: Collection<MongoAttendance>;

export const initAttendanceCollection = (db: Db) => {
	attendanceCollection = db.collection<MongoAttendance>("attendance");
	return attendanceCollection;
};

export const getAttendanceCollection = () => {
	if (!attendanceCollection) {
		throw new Error("Attendance collection not initialized.");
	}
	return attendanceCollection;
};
