ALTER TABLE "patients" DROP CONSTRAINT "patients_email_clinic_unique";--> statement-breakpoint
ALTER TABLE "patients" DROP CONSTRAINT "patients_national_id_clinic_unique";--> statement-breakpoint
ALTER TABLE "patients" ADD CONSTRAINT "patients_email_clinic_unique" UNIQUE("email","clinic_id");--> statement-breakpoint
ALTER TABLE "patients" ADD CONSTRAINT "patients_national_id_clinic_unique" UNIQUE("national_id","clinic_id");