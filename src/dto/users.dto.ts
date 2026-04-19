// /src/dto/users.dto.ts
export interface UserDTO {
	id: string;
	firstName: string;
	lastName: string;
	email: string;
	password?: string;
	role?: "student" | "teacher" | "instructor" | "admin";
	languageLevel?: "beginner" | "intermediate" | "advanced";
	country?: string;
	interests?: string[];
	createdAt?: Date;
	updatedAt?: Date;
	status?: "active" | "invited" | "suspended";
	enrolledCourseCount?: number;
	lastLoginAt?: Date;
}

// This is the shape of the document stored in MongoDB
export interface MongoUser extends Omit<UserDTO, "id"> {
	_id?: import("mongodb").ObjectId;
}
