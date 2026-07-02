import dotenv from "dotenv";
import mongoose from "mongoose";
import { seedDemoData } from "./seed-demo.js";

dotenv.config();

const getArgument = (name) => {
  const prefix = `--${name}=`;
  const argument = process.argv.find((value) => value.startsWith(prefix));
  return argument ? argument.slice(prefix.length) : "";
};

const run = async () => {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Demo database reset is disabled when NODE_ENV=production");
  }

  if (!process.env.MONGODB_URL) {
    throw new Error("MONGODB_URL is required");
  }

  const configuredDatabase = process.env.MONGODB_DB_NAME || "carego";
  const requestedDatabase = getArgument("database");
  const confirmation = getArgument("confirm");
  const expectedConfirmation = `RESET-${configuredDatabase}`;

  if (!process.argv.includes("--yes")) {
    throw new Error("Missing --yes confirmation");
  }
  if (requestedDatabase !== configuredDatabase) {
    throw new Error(`Database confirmation must be --database=${configuredDatabase}`);
  }
  if (confirmation !== expectedConfirmation) {
    throw new Error(`Reset confirmation must be --confirm=${expectedConfirmation}`);
  }

  await mongoose.connect(process.env.MONGODB_URL, {
    dbName: configuredDatabase,
  });

  if (mongoose.connection.name !== configuredDatabase) {
    throw new Error(`Connected database is ${mongoose.connection.name}, expected ${configuredDatabase}`);
  }

  const collections = await mongoose.connection.db.collections();
  const deleted = {};
  for (const collection of collections) {
    if (collection.collectionName.startsWith("system.")) continue;
    const result = await collection.deleteMany({});
    deleted[collection.collectionName] = result.deletedCount;
  }

  console.log("Reset database:", mongoose.connection.name);
  console.log("Deleted documents:", deleted);
  await seedDemoData();
};

run()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
