import bcrypt from "bcryptjs";

const PASSWORD_HASH_PREFIXES = ["$2a$", "$2b$", "$2y$"];
const SALT_ROUNDS = 12;

export const isPasswordHash = (value: string): boolean =>
	PASSWORD_HASH_PREFIXES.some((prefix) => value.startsWith(prefix));

export const hashPassword = async (plainTextPassword: string): Promise<string> =>
	bcrypt.hash(plainTextPassword, SALT_ROUNDS);

export const verifyPassword = async (
	plainTextPassword: string,
	storedPassword: string,
): Promise<boolean> => {
	if (isPasswordHash(storedPassword)) {
		return bcrypt.compare(plainTextPassword, storedPassword);
	}
	return storedPassword === plainTextPassword;
};
