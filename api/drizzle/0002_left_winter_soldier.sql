ALTER TABLE "patient_requests" DROP CONSTRAINT "patient_requests_clinic_id_clinics_id_fk";
--> statement-breakpoint
DROP INDEX "patient_requests_clinic_status_idx";--> statement-breakpoint
ALTER TABLE "patient_requests" ALTER COLUMN "clinic_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "patient_requests" ADD CONSTRAINT "patient_requests_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "patient_requests_unassigned_idx" ON "patient_requests" USING btree ("status") WHERE "patient_requests"."clinic_id" IS NULL;--> statement-breakpoint
CREATE INDEX "patient_requests_status_idx" ON "patient_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "patient_requests_clinic_status_idx" ON "patient_requests" USING btree ("clinic_id","status") WHERE "patient_requests"."clinic_id" IS NOT NULL;