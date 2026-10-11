-- CreateEnum
CREATE TYPE "ActivityAction" AS ENUM ('TRIP_CREATED', 'TRIP_UPDATED', 'BUDGET_UPDATED', 'PLACE_ADDED', 'PLACE_UPDATED', 'PLACE_DELETED', 'PLACE_LOCKED', 'PLACE_UNLOCKED', 'MEMBER_JOINED', 'MEMBER_LEFT', 'MEMBER_REMOVED', 'INVITE_SENT');

-- CreateTable
CREATE TABLE "trip_activities" (
    "id" UUID NOT NULL,
    "trip_id" UUID NOT NULL,
    "user_id" UUID,
    "action" "ActivityAction" NOT NULL,
    "details" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trip_activities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "trip_activities_trip_id_created_at_idx" ON "trip_activities"("trip_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "trip_activities" ADD CONSTRAINT "trip_activities_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_activities" ADD CONSTRAINT "trip_activities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

