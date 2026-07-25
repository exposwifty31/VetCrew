import { pgTableCreator } from "drizzle-orm/pg-core";

/** All VetCrew tables carry the vc_ prefix. */
export const vcTable = pgTableCreator((name) => `vc_${name}`);
