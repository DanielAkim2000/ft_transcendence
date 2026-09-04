-- CreateEnum
CREATE TYPE "ThemePreference" AS ENUM ('light', 'dark', 'system');

-- CreateEnum
CREATE TYPE "LanguagePreference" AS ENUM ('en', 'fr', 'es');

-- AlterTable
ALTER TABLE "User" ADD COLUMN "theme" "ThemePreference" NOT NULL DEFAULT 'light';
ALTER TABLE "User" ADD COLUMN "language" "LanguagePreference" NOT NULL DEFAULT 'en';
