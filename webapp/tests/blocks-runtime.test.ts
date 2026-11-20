import assert from "node:assert/strict";
import test from "node:test";
import {
  userContext,
  attachVerifiedUserContext,
} from "../src/pages/api/_server/agent/userContext.ts";

test("検証済みのID・CookieだけをローカルAIエージェントへ渡す", () => {
  const input = JSON.stringify({
    forwardedProps: {
      userId: "spoofed",
      localAuthCookie: "spoofed-cookie",
      learningReview: true,
    },
  });
  assert.deepEqual(JSON.parse(attachVerifiedUserContext(input)).forwardedProps, {
    learningReview: true,
  });
  const signed = userContext.run({ userId: "verified" }, () =>
    JSON.parse(attachVerifiedUserContext(input)),
  );
  assert.deepEqual(signed.forwardedProps, {
    userId: "verified",
    learningReview: true,
  });
  const local = userContext.run(
    { userId: "verified", localAuthCookie: "local-cookie" },
    () => JSON.parse(attachVerifiedUserContext(input)),
  );
  assert.equal(local.forwardedProps.localAuthCookie, "local-cookie");
});

test("同時リクエストでも、検証済みユーザーの情報を混ぜない", async () => {
  const input = JSON.stringify({
    threadId: "thread", forwardedProps: { userId: "spoofed", learningReview: true },
  });
  const outputs = await Promise.all(["user-a", "user-b"].map((userId) =>
    userContext.run({ userId, localAuthCookie: `${userId}-cookie` }, async () => {
      await Promise.resolve();
      return JSON.parse(attachVerifiedUserContext(input));
    }),
  ));
  assert.deepEqual(outputs.map(output => output.forwardedProps), [
    { userId: "user-a", localAuthCookie: "user-a-cookie", learningReview: true },
    { userId: "user-b", localAuthCookie: "user-b-cookie", learningReview: true },
  ]);
  assert.ok(outputs.every(output => output.threadId === "thread"));
  assert.equal(attachVerifiedUserContext(""), "");
  assert.throws(() => attachVerifiedUserContext("invalid json"));
});
