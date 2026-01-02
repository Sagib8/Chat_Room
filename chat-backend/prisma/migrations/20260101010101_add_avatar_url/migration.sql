-- Add optional avatar URL for users so clients can render profile images.
ALTER TABLE "User" ADD COLUMN "avatarUrl" TEXT;
