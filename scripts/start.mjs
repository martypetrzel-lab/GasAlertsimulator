import "dotenv/config";
import { bootstrapAccount } from "./bootstrap-account.mjs";
process.env.NODE_ENV = "production";
await bootstrapAccount();
await import("../dist/index.js");
