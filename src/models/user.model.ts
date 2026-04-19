// /src/models/user.model.ts

import { Db, Collection } from "mongodb";
import { MongoUser } from "../dto/users.dto";

let usersCollection: Collection<MongoUser>;

export const initUserCollection = (db: Db) => {
	usersCollection = db.collection<MongoUser>("users");
	return usersCollection;
};

export const getUserCollection = (): Collection<MongoUser> => {
	if (!usersCollection) {
		throw new Error("User collection not initialized.");
	}
	return usersCollection;
};