import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

export function log(msg: string) {
  const dir = path.dirname(fileURLToPath(import.meta.url));
  const logPath = path.resolve(dir, "server.log");
  fs.appendFileSync(logPath, msg);
}
