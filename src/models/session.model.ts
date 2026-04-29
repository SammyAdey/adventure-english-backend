import { Collection, Db } from "mongodb";
import { MongoSession } from "../dto/cohorts.dto";

let sessionCollection: Collection<MongoSession>;

export const initSessionCollection = (db: Db) => {
	sessionCollection = db.collection<MongoSession>("sessions");
	return sessionCollection;
};

export const getSessionCollection = () => {
	if (!sessionCollection) {
		throw new Error("Session collection not initialized.");
	}
	return sessionCollection;
};
