import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const extractedAccounts = pgTable("extracted_accounts", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  device_id: text("device_id").notNull(),
  full_name: text("full_name").notNull(),
  account_number: text("account_number").notNull(),
  referral_code: text("referral_code").notNull().default(""),
  sender_name: text("sender_name").notNull().default(""),
  status: text("status").notNull().default("pending"),
  image_time: text("image_time").notNull().default(""),
  folder: text("folder").notNull().default(""),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

