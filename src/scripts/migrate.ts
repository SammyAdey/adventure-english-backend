import dotenv from "dotenv";
import { runMigrations } from "../migrations/run-migrations";

dotenv.config();

const main = async () => {
	await runMigrations();
	console.log("Migrations completed successfully.");
	process.exit(0);
};

main().catch((error) => {
	console.error("Migration failed", error);
	process.exit(1);
});
