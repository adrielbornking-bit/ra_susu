-- Preserve successful activations from the earlier token-per-login version.
ALTER TABLE "User" ADD COLUMN "activatedAt" TIMESTAMP(3);
UPDATE "User" AS u SET "activatedAt" = t.last_used
FROM (SELECT "userId", MAX("usedAt") AS last_used FROM "VerificationToken"
      WHERE "usedAt" IS NOT NULL AND "revokedAt" IS NULL GROUP BY "userId") AS t
WHERE u.id = t."userId" AND u.role = 'PARTICIPANT' AND u.status = 'APPROVED';
