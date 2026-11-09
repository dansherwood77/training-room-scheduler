import path from "node:path";
import { fileURLToPath } from "node:url";
import { createApp } from "./app";
import { openDatabase } from "./db";
import { seedIfEmpty } from "./seed";

const port = Number(process.env.PORT ?? 4000);
const root = path.dirname(fileURLToPath(import.meta.url));
const filename = process.env.DB_PATH ?? path.join(root, "..", "data", "scheduler.sqlite");

const db = openDatabase(filename);
seedIfEmpty(db);

const app = createApp(db);
const server = app.listen(port, "127.0.0.1", () => {
  console.log(`Training rooms API on http://127.0.0.1:${port}`);
});

server.on("error", (error: NodeJS.ErrnoException) => {
  if (error.code === "EADDRINUSE") {
    console.error(`Port ${port} is already in use.`);
    process.exit(1);
  }
  throw error;
});
