/*
  Warnings:

  - You are about to drop the `user_api_keys` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "user_api_keys" DROP CONSTRAINT "user_api_keys_user_id_fkey";

-- DropTable
DROP TABLE "user_api_keys";
