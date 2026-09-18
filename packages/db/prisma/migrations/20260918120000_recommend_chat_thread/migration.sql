-- 추천 세션(TestFileVersion)별 대화를 영구 저장한다. 메시지 배열을 JSON 한 덩이로 담는다.

-- CreateTable
CREATE TABLE "test_chat_threads" (
    "test_file_version_id" UUID NOT NULL,
    "messages" JSONB NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "test_chat_threads_pkey" PRIMARY KEY ("test_file_version_id")
);

-- AddForeignKey
ALTER TABLE "test_chat_threads" ADD CONSTRAINT "test_chat_threads_test_file_version_id_fkey" FOREIGN KEY ("test_file_version_id") REFERENCES "test_file_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- EnableRLS (Prisma cannot express this in schema.prisma)
ALTER TABLE "public"."test_chat_threads" ENABLE ROW LEVEL SECURITY;
