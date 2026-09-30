-- CreateEnum
CREATE TYPE "AccentPreference" AS ENUM ('green', 'blue', 'purple', 'pink', 'red', 'orange', 'amber', 'teal');

-- CreateEnum
CREATE TYPE "RadiusPreference" AS ENUM ('none', 'medium', 'large');

-- AlterTable
ALTER TABLE "User" ADD COLUMN "accent" "AccentPreference" NOT NULL DEFAULT 'green';
ALTER TABLE "User" ADD COLUMN "radius" "RadiusPreference" NOT NULL DEFAULT 'none';
