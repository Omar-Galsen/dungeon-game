import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname } from "node:path";

const source = "assets";
const destination = "public/assets";

if (!existsSync(source)) {
  throw new Error(`Missing source asset directory: ${source}`);
}

rmSync(destination, { recursive: true, force: true });
mkdirSync(dirname(destination), { recursive: true });
cpSync(source, destination, { recursive: true });

console.log(`Copied ${source} -> ${destination}`);
