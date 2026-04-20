CREATE TYPE "public"."patient_request_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TABLE "patient_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clinic_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"phone" varchar(20) NOT NULL,
	"email" varchar(255),
	"date_of_birth" date,
	"gender" "patient_gender",
	"preferred_slot_id" uuid,
	"auto_book" boolean DEFAULT false NOT NULL,
	"status" "patient_request_status" DEFAULT 'pending' NOT NULL,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"rejection_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "patient_requests" ADD CONSTRAINT "patient_requests_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patient_requests" ADD CONSTRAINT "patient_requests_preferred_slot_id_slot_times_id_fk" FOREIGN KEY ("preferred_slot_id") REFERENCES "public"."slot_times"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patient_requests" ADD CONSTRAINT "patient_requests_reviewed_by_staff_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."staff_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "patient_requests_clinic_idx" ON "patient_requests" USING btree ("clinic_id");--> statement-breakpoint
CREATE INDEX "patient_requests_clinic_status_idx" ON "patient_requests" USING btree ("clinic_id","status");--> statement-breakpoint
CREATE INDEX "patient_requests_slot_idx" ON "patient_requests" USING btree ("preferred_slot_id");--> statement-breakpoint
CREATE INDEX "patient_requests_reviewed_by_idx" ON "patient_requests" USING btree ("reviewed_by");