CREATE TYPE "public"."permission_category" AS ENUM('users', 'roles', 'appointments', 'clinic', 'doctors', 'patients', 'slots', 'reports', 'system');--> statement-breakpoint
CREATE TYPE "public"."patient_blood_type" AS ENUM('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-');--> statement-breakpoint
CREATE TYPE "public"."patient_gender" AS ENUM('male', 'female', 'other');--> statement-breakpoint
CREATE TYPE "public"."doctor_specialty" AS ENUM('general_practice', 'cardiology', 'dermatology', 'endocrinology', 'gastroenterology', 'gynecology', 'hematology', 'nephrology', 'neurology', 'oncology', 'ophthalmology', 'orthopedics', 'otolaryngology', 'pediatrics', 'psychiatry', 'pulmonology', 'radiology', 'rheumatology', 'surgery', 'urology', 'other');--> statement-breakpoint
CREATE TYPE "public"."day_of_week" AS ENUM('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday');--> statement-breakpoint
CREATE TYPE "public"."appointment_status" AS ENUM('pending', 'confirmed', 'cancelled', 'completed', 'no_show');--> statement-breakpoint
CREATE TYPE "public"."slot_status" AS ENUM('available', 'booked', 'blocked');--> statement-breakpoint
CREATE TABLE "staff_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" varchar(255) NOT NULL,
	"phone" varchar(20),
	"is_active" boolean DEFAULT true NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "staff_users_email_active_unique" UNIQUE NULLS NOT DISTINCT("email")
);
--> statement-breakpoint
CREATE TABLE "refresh_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"staff_user_id" uuid NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"family_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"user_agent" varchar(512),
	"ip_address" varchar(45),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "refresh_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "permissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" varchar(100) NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" varchar(500),
	"category" "permission_category" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "permissions_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "role_permissions" (
	"role_id" uuid NOT NULL,
	"permission_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "role_permissions_role_id_permission_id_pk" PRIMARY KEY("role_id","permission_id")
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" varchar(500),
	"clinic_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "roles_global_name_unique" UNIQUE NULLS NOT DISTINCT("name"),
	CONSTRAINT "roles_clinic_name_unique" UNIQUE NULLS NOT DISTINCT("name","clinic_id")
);
--> statement-breakpoint
CREATE TABLE "staff_user_roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"staff_user_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	"clinic_id" uuid,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL,
	"assigned_by" uuid,
	CONSTRAINT "staff_user_roles_global_unique" UNIQUE NULLS NOT DISTINCT("staff_user_id","role_id"),
	CONSTRAINT "staff_user_roles_clinic_unique" UNIQUE NULLS NOT DISTINCT("staff_user_id","role_id","clinic_id")
);
--> statement-breakpoint
CREATE TABLE "clinics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(200) NOT NULL,
	"slug" varchar(200) NOT NULL,
	"description" text,
	"address" text,
	"phone" varchar(20),
	"email" varchar(255),
	"website" varchar(255),
	"logo" varchar(500),
	"is_active" boolean DEFAULT true NOT NULL,
	"is_published" boolean DEFAULT false NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "clinics_slug_active_unique" UNIQUE NULLS NOT DISTINCT("slug")
);
--> statement-breakpoint
CREATE TABLE "patients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clinic_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"phone" varchar(20),
	"email" varchar(255),
	"date_of_birth" date,
	"gender" "patient_gender",
	"blood_type" "patient_blood_type",
	"allergies" text,
	"medical_notes" text,
	"emergency_contact_name" varchar(100),
	"emergency_contact_phone" varchar(20),
	"address" text,
	"national_id" varchar(50),
	"is_active" boolean DEFAULT true NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "patients_email_clinic_unique" UNIQUE NULLS NOT DISTINCT("email","clinic_id"),
	CONSTRAINT "patients_national_id_clinic_unique" UNIQUE NULLS NOT DISTINCT("national_id","clinic_id")
);
--> statement-breakpoint
CREATE TABLE "doctors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clinic_id" uuid NOT NULL,
	"staff_user_id" uuid,
	"name" varchar(100) NOT NULL,
	"specialty" "doctor_specialty" NOT NULL,
	"bio" text,
	"avatar" varchar(500),
	"phone" varchar(20),
	"email" varchar(255),
	"experience_years" integer,
	"consultation_fee" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_published" boolean DEFAULT true NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "doctors_staff_user_clinic_unique" UNIQUE NULLS NOT DISTINCT("staff_user_id","clinic_id"),
	CONSTRAINT "chk_doctor_experience" CHECK ("doctors"."experience_years" IS NULL OR ("doctors"."experience_years" >= 0 AND "doctors"."experience_years" <= 70)),
	CONSTRAINT "chk_doctor_fee" CHECK ("doctors"."consultation_fee" IS NULL OR "doctors"."consultation_fee" >= 0)
);
--> statement-breakpoint
CREATE TABLE "doctor_schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clinic_id" uuid NOT NULL,
	"doctor_id" uuid NOT NULL,
	"day_of_week" "day_of_week" NOT NULL,
	"start_time" time NOT NULL,
	"end_time" time NOT NULL,
	"slot_duration_minutes" smallint DEFAULT 30 NOT NULL,
	"max_appointments" smallint DEFAULT 1 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "doctor_schedules_doctor_day_unique" UNIQUE("doctor_id","day_of_week"),
	CONSTRAINT "chk_schedule_time_order" CHECK ("doctor_schedules"."end_time" > "doctor_schedules"."start_time"),
	CONSTRAINT "chk_slot_duration" CHECK ("doctor_schedules"."slot_duration_minutes" >= 5 AND "doctor_schedules"."slot_duration_minutes" <= 480),
	CONSTRAINT "chk_max_appointments" CHECK ("doctor_schedules"."max_appointments" >= 1 AND "doctor_schedules"."max_appointments" <= 50)
);
--> statement-breakpoint
CREATE TABLE "appointment_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"appointment_id" uuid NOT NULL,
	"clinic_id" uuid NOT NULL,
	"previous_status" "appointment_status",
	"new_status" "appointment_status" NOT NULL,
	"changed_by" uuid,
	"reason" text,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "appointments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clinic_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"doctor_id" uuid,
	"slot_id" uuid,
	"title" varchar(200) NOT NULL,
	"description" text,
	"scheduled_at" timestamp with time zone NOT NULL,
	"duration_minutes" integer DEFAULT 60 NOT NULL,
	"status" "appointment_status" DEFAULT 'pending' NOT NULL,
	"notes" text,
	"version" integer DEFAULT 0 NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "appointments_slot_id_unique" UNIQUE("slot_id"),
	CONSTRAINT "appointments_doctor_no_double_booking" UNIQUE NULLS NOT DISTINCT("doctor_id","scheduled_at","clinic_id"),
	CONSTRAINT "chk_appointment_duration" CHECK ("appointments"."duration_minutes" > 0 AND "appointments"."duration_minutes" <= 480),
	CONSTRAINT "chk_appointment_version" CHECK ("appointments"."version" >= 0)
);
--> statement-breakpoint
CREATE TABLE "slot_times" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clinic_id" uuid NOT NULL,
	"doctor_id" uuid NOT NULL,
	"start_time" timestamp with time zone NOT NULL,
	"end_time" timestamp with time zone NOT NULL,
	"status" "slot_status" DEFAULT 'available' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "slot_times_doctor_start_time_unique" UNIQUE("doctor_id","start_time")
);
--> statement-breakpoint
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_staff_user_id_staff_users_id_fk" FOREIGN KEY ("staff_user_id") REFERENCES "public"."staff_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_permissions_id_fk" FOREIGN KEY ("permission_id") REFERENCES "public"."permissions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roles" ADD CONSTRAINT "roles_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_user_roles" ADD CONSTRAINT "staff_user_roles_staff_user_id_staff_users_id_fk" FOREIGN KEY ("staff_user_id") REFERENCES "public"."staff_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_user_roles" ADD CONSTRAINT "staff_user_roles_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_user_roles" ADD CONSTRAINT "staff_user_roles_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_user_roles" ADD CONSTRAINT "staff_user_roles_assigned_by_staff_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."staff_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patients" ADD CONSTRAINT "patients_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "doctors" ADD CONSTRAINT "doctors_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "doctors" ADD CONSTRAINT "doctors_staff_user_id_staff_users_id_fk" FOREIGN KEY ("staff_user_id") REFERENCES "public"."staff_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "doctor_schedules" ADD CONSTRAINT "doctor_schedules_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "doctor_schedules" ADD CONSTRAINT "doctor_schedules_doctor_id_doctors_id_fk" FOREIGN KEY ("doctor_id") REFERENCES "public"."doctors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment_history" ADD CONSTRAINT "appointment_history_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment_history" ADD CONSTRAINT "appointment_history_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment_history" ADD CONSTRAINT "appointment_history_changed_by_staff_users_id_fk" FOREIGN KEY ("changed_by") REFERENCES "public"."staff_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_doctor_id_doctors_id_fk" FOREIGN KEY ("doctor_id") REFERENCES "public"."doctors"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_slot_id_slot_times_id_fk" FOREIGN KEY ("slot_id") REFERENCES "public"."slot_times"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "slot_times" ADD CONSTRAINT "slot_times_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "slot_times" ADD CONSTRAINT "slot_times_doctor_id_doctors_id_fk" FOREIGN KEY ("doctor_id") REFERENCES "public"."doctors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "staff_users_email_idx" ON "staff_users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "staff_users_active_idx" ON "staff_users" USING btree ("is_active") WHERE "staff_users"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "refresh_tokens_token_hash_idx" ON "refresh_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "refresh_tokens_staff_user_id_idx" ON "refresh_tokens" USING btree ("staff_user_id");--> statement-breakpoint
CREATE INDEX "refresh_tokens_family_id_idx" ON "refresh_tokens" USING btree ("family_id");--> statement-breakpoint
CREATE INDEX "refresh_tokens_expires_at_idx" ON "refresh_tokens" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "permissions_key_idx" ON "permissions" USING btree ("key");--> statement-breakpoint
CREATE INDEX "permissions_category_idx" ON "permissions" USING btree ("category");--> statement-breakpoint
CREATE INDEX "role_permissions_role_idx" ON "role_permissions" USING btree ("role_id");--> statement-breakpoint
CREATE INDEX "role_permissions_permission_idx" ON "role_permissions" USING btree ("permission_id");--> statement-breakpoint
CREATE INDEX "roles_clinic_idx" ON "roles" USING btree ("clinic_id");--> statement-breakpoint
CREATE INDEX "staff_user_roles_staff_user_idx" ON "staff_user_roles" USING btree ("staff_user_id");--> statement-breakpoint
CREATE INDEX "staff_user_roles_role_idx" ON "staff_user_roles" USING btree ("role_id");--> statement-breakpoint
CREATE INDEX "staff_user_roles_clinic_idx" ON "staff_user_roles" USING btree ("clinic_id");--> statement-breakpoint
CREATE INDEX "clinics_is_published_idx" ON "clinics" USING btree ("is_published");--> statement-breakpoint
CREATE INDEX "clinics_is_active_idx" ON "clinics" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "clinics_marketplace_idx" ON "clinics" USING btree ("is_published","is_active") WHERE "clinics"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "patients_clinic_idx" ON "patients" USING btree ("clinic_id");--> statement-breakpoint
CREATE INDEX "patients_clinic_active_idx" ON "patients" USING btree ("clinic_id","is_active") WHERE "patients"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "patients_phone_idx" ON "patients" USING btree ("phone");--> statement-breakpoint
CREATE INDEX "doctors_clinic_idx" ON "doctors" USING btree ("clinic_id");--> statement-breakpoint
CREATE INDEX "doctors_staff_user_idx" ON "doctors" USING btree ("staff_user_id");--> statement-breakpoint
CREATE INDEX "doctors_clinic_active_idx" ON "doctors" USING btree ("clinic_id","is_active") WHERE "doctors"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "doctors_specialty_idx" ON "doctors" USING btree ("specialty");--> statement-breakpoint
CREATE INDEX "doctors_clinic_specialty_idx" ON "doctors" USING btree ("clinic_id","specialty");--> statement-breakpoint
CREATE INDEX "doctor_schedules_clinic_idx" ON "doctor_schedules" USING btree ("clinic_id");--> statement-breakpoint
CREATE INDEX "doctor_schedules_doctor_idx" ON "doctor_schedules" USING btree ("doctor_id");--> statement-breakpoint
CREATE INDEX "doctor_schedules_clinic_day_active_idx" ON "doctor_schedules" USING btree ("clinic_id","day_of_week","is_active");--> statement-breakpoint
CREATE INDEX "appt_history_timeline_idx" ON "appointment_history" USING btree ("appointment_id","changed_at");--> statement-breakpoint
CREATE INDEX "appt_history_clinic_idx" ON "appointment_history" USING btree ("clinic_id","changed_at");--> statement-breakpoint
CREATE INDEX "appt_history_changed_by_idx" ON "appointment_history" USING btree ("changed_by","changed_at");--> statement-breakpoint
CREATE INDEX "appointments_clinic_idx" ON "appointments" USING btree ("clinic_id");--> statement-breakpoint
CREATE INDEX "appointments_patient_idx" ON "appointments" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "appointments_doctor_idx" ON "appointments" USING btree ("doctor_id");--> statement-breakpoint
CREATE INDEX "appointments_slot_idx" ON "appointments" USING btree ("slot_id");--> statement-breakpoint
CREATE INDEX "appointments_scheduled_at_idx" ON "appointments" USING btree ("scheduled_at");--> statement-breakpoint
CREATE INDEX "appointments_status_idx" ON "appointments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "appointments_clinic_scheduled_idx" ON "appointments" USING btree ("clinic_id","scheduled_at") WHERE "appointments"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "appointments_clinic_status_idx" ON "appointments" USING btree ("clinic_id","status") WHERE "appointments"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "appointments_clinic_patient_idx" ON "appointments" USING btree ("clinic_id","patient_id") WHERE "appointments"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "appointments_doctor_scheduled_idx" ON "appointments" USING btree ("doctor_id","scheduled_at") WHERE "appointments"."deleted_at" IS NULL AND "appointments"."status" NOT IN ('cancelled', 'no_show');--> statement-breakpoint
CREATE INDEX "slot_times_clinic_idx" ON "slot_times" USING btree ("clinic_id");--> statement-breakpoint
CREATE INDEX "slot_times_doctor_idx" ON "slot_times" USING btree ("doctor_id");--> statement-breakpoint
CREATE INDEX "slot_times_status_idx" ON "slot_times" USING btree ("status");--> statement-breakpoint
CREATE INDEX "slot_times_clinic_doctor_status_idx" ON "slot_times" USING btree ("clinic_id","doctor_id","status","start_time");--> statement-breakpoint
CREATE INDEX "slot_times_clinic_status_time_idx" ON "slot_times" USING btree ("clinic_id","status","start_time");--> statement-breakpoint
CREATE INDEX "slot_times_available_idx" ON "slot_times" USING btree ("clinic_id","doctor_id","start_time") WHERE status = 'available';