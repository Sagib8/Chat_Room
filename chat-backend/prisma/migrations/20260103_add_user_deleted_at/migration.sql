-- Add soft-delete timestamp for users
ALTER TABLE "User"
ADD COLUMN "deletedAt" TIMESTAMP(3);
