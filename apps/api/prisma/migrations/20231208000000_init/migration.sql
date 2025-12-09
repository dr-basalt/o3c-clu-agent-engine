-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "name" VARCHAR(255),
    "workspace_id" VARCHAR(50) NOT NULL,
    "api_key" VARCHAR(64) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provider_configs" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "provider_name" VARCHAR(50) NOT NULL,
    "flavor" VARCHAR(50) NOT NULL,
    "base_url" TEXT,
    "api_key_encrypted" TEXT,
    "headers" JSONB,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "default_model" VARCHAR(100),
    "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP NOT NULL,

    CONSTRAINT "provider_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agents" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "system_prompt" TEXT NOT NULL,
    "mcp_servers" JSONB NOT NULL DEFAULT '[]',
    "tools" JSONB NOT NULL DEFAULT '[]',
    "schedule_cron" VARCHAR(100),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "allow_shell" BOOLEAN NOT NULL DEFAULT false,
    "max_iterations" INTEGER NOT NULL DEFAULT 10,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP NOT NULL,

    CONSTRAINT "agents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "execution_runs" (
    "id" UUID NOT NULL,
    "agent_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "status" VARCHAR(50) NOT NULL,
    "input_text" TEXT,
    "output_result" JSONB,
    "logs" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "error_message" TEXT,
    "started_at" TIMESTAMP,
    "completed_at" TIMESTAMP,
    "duration_ms" INTEGER,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "execution_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_workspace_id_key" ON "users"("workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_api_key_key" ON "users"("api_key");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_api_key_idx" ON "users"("api_key");

-- CreateIndex
CREATE UNIQUE INDEX "provider_configs_user_id_provider_name_key" ON "provider_configs"("user_id", "provider_name");

-- CreateIndex
CREATE INDEX "agents_user_id_idx" ON "agents"("user_id");

-- CreateIndex
CREATE INDEX "agents_schedule_cron_idx" ON "agents"("schedule_cron");

-- CreateIndex
CREATE INDEX "execution_runs_agent_id_idx" ON "execution_runs"("agent_id");

-- CreateIndex
CREATE INDEX "execution_runs_user_id_idx" ON "execution_runs"("user_id");

-- CreateIndex
CREATE INDEX "execution_runs_status_idx" ON "execution_runs"("status");

-- CreateIndex
CREATE INDEX "execution_runs_created_at_idx" ON "execution_runs"("created_at" DESC);

-- AddForeignKey
ALTER TABLE "provider_configs" ADD CONSTRAINT "provider_configs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agents" ADD CONSTRAINT "agents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "execution_runs" ADD CONSTRAINT "execution_runs_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "execution_runs" ADD CONSTRAINT "execution_runs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
