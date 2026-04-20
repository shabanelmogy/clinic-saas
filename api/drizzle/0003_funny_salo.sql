CREATE TYPE "public"."doctor_request_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."doctor_request_type" AS ENUM('join', 'create');--> statement-breakpoint
CREATE TABLE "doctor_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" "doctor_request_type" NOT NULL,
	"clinic_id" uuid,
	"name" varchar(100) NOT NULL,
	"phone" varchar(20) NOT NULL,
	"email" varchar(255) NOT NULL,
	"specialty" "doctor_specialty" NOT NULL,
	"experience_years" integer,
	"clinic_name" varchar(200),
	"clinic_address" text,
	"status" "doctor_request_status" DEFAULT 'pending' NOT NULL,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"rejection_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "doctor_requests" ADD CONSTRAINT "doctor_requests_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "doctor_requests" ADD CONSTRAINT "doctor_requests_reviewed_by_staff_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."staff_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "doctor_requests_type_status_idx" ON "doctor_requests" USING btree ("type","status");--> statement-breakpoint
CREATE INDEX "doctor_requests_clinic_status_idx" ON "doctor_requests" USING btree ("clinic_id","status");--> statement-breakpoint
CREATE INDEX "doctor_requests_reviewed_by_idx" ON "doctor_requests" USING btree ("reviewed_by");--> statement-breakpoint
CREATE INDEX "doctor_requests_email_idx" ON "doctor_requests" USING btree ("email");