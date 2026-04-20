ALTER TABLE "patients" DROP CONSTRAINT "patients_email_clinic_unique";--> statement-breakpoint
ALTER TABLE "patients" DROP CONSTRAINT "patients_national_id_clinic_unique";--> statement-breakpoint
ALTER TABLE "patients" DROP CONSTRAINT "patients_clinic_id_clinics_id_fk";
--> statement-breakpoint
DROP INDEX "patients_clinic_idx";--> statement-breakpoint
DROP INDEX "patients_clinic_active_idx";--> statement-breakpoint
CREATE INDEX "patients_active_idx" ON "patients" USING btree ("is_active") WHERE "patients"."deleted_at" IS NULL;--> statement-breakpoint
ALTER TABLE "patients" DROP COLUMN "clinic_id";--> statement-breakpoint
ALTER TABLE "patients" ADD CONSTRAINT "patients_phone_unique" UNIQUE("phone");--> statement-breakpoint
ALTER TABLE "patients" ADD CONSTRAINT "patients_email_unique" UNIQUE("email");--> statement-breakpoint
ALTER TABLE "patients" ADD CONSTRAINT "patients_national_id_unique" UNIQUE("national_id");