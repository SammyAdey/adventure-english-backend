import { ObjectId } from "mongodb";
import { connectToDatabase } from "../utils/mongo";
import { getUserCollection, initUserCollection } from "../models/user.model";
import type { MongoUser, UserDTO } from "../dto/users.dto";

type CreateUserInput = {
	firstName: string;
	lastName: string;
	email: string;
	role?: "student" | "teacher" | "instructor" | "admin";
	status?: "active" | "invited" | "suspended";
};

type UpdateUserInput = {
	role?: "student" | "teacher" | "instructor" | "admin";
	status?: "active" | "invited" | "suspended";
};

const normalizeRole = (role?: CreateUserInput["role"]) => {
	if (!role) {
		return "student";
	}

	if (role === "instructor") {
		return "teacher";
	}

	return role;
};

const normalizeUpdate = (payload: UpdateUserInput) => {
	const normalized: UpdateUserInput = {};
	if (payload.role !== undefined) {
		normalized.role = normalizeRole(payload.role);
	}
	if (payload.status !== undefined) {
		normalized.status = payload.status;
	}
	return normalized;
};

const mapMongoUserToDTO = (user: MongoUser & { _id: ObjectId }): UserDTO => ({
	id: user._id.toHexString(),
	firstName: user.firstName,
	lastName: user.lastName,
	email: user.email,
	role: user.role === "teacher" ? "instructor" : user.role,
	languageLevel: user.languageLevel,
	country: user.country,
	interests: user.interests,
	createdAt: user.createdAt,
	updatedAt: user.updatedAt,
	status: user.status,
	enrolledCourseCount: user.enrolledCourseCount,
	lastLoginAt: user.lastLoginAt,
});

export const listUsers = async (): Promise<UserDTO[]> => {
	const db = await connectToDatabase();
	initUserCollection(db);
	const usersCollection = getUserCollection();

	const users = await usersCollection.find({}).sort({ createdAt: -1 }).toArray();

	return users
		.filter((user): user is MongoUser & { _id: ObjectId } => Boolean(user._id))
		.map(mapMongoUserToDTO);
};

export const createUser = async (payload: CreateUserInput): Promise<UserDTO> => {
	const db = await connectToDatabase();
	initUserCollection(db);
	const usersCollection = getUserCollection();

	const now = new Date();

	const userDocument: MongoUser = {
		firstName: payload.firstName,
		lastName: payload.lastName,
		email: payload.email,
		role: normalizeRole(payload.role),
		status: payload.status ?? "invited",
		enrolledCourseCount: 0,
		createdAt: now,
		updatedAt: now,
	};

	const result = await usersCollection.insertOne(userDocument);

	const insertedUser: MongoUser & { _id: ObjectId } = {
		...userDocument,
		_id: result.insertedId,
	};

	return mapMongoUserToDTO(insertedUser);
};

export const deleteUser = async (userId: string): Promise<boolean> => {
	if (!ObjectId.isValid(userId)) {
		return false;
	}

	const db = await connectToDatabase();
	initUserCollection(db);
	const usersCollection = getUserCollection();

	const result = await usersCollection.deleteOne({ _id: new ObjectId(userId) });
	return result.deletedCount === 1;
};

export const updateUser = async (userId: string, payload: UpdateUserInput): Promise<UserDTO | null> => {
	if (!ObjectId.isValid(userId)) {
		return null;
	}

	const updates = normalizeUpdate(payload);
	if (Object.keys(updates).length === 0) {
		return null;
	}

	const db = await connectToDatabase();
	initUserCollection(db);
	const usersCollection = getUserCollection();

	const result = await usersCollection.findOneAndUpdate(
		{ _id: new ObjectId(userId) },
		{
			$set: {
				...updates,
				updatedAt: new Date(),
			},
		},
		{
			returnDocument: "after",
		},
	);

	if (!result || !result._id) {
		return null;
	}

	return mapMongoUserToDTO(result as MongoUser & { _id: ObjectId });
};
