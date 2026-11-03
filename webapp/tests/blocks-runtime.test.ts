import assert from "node:assert/strict";
import test from "node:test";
import { userContext, withUserId } from "../src/server/agent/userContext.ts";

test("検証済みのID・CookieだけをローカルAIエージェントへ渡す", () => {
  const input = JSON.stringify({ forwardedProps: { userId: "spoofed", localAuthCookie: "spoofed-cookie", learningReview: true } });
  assert.deepEqual(JSON.parse(withUserId(input)).forwardedProps, { learningReview: true });
  const signed = userContext.run({ userId: "verified" }, () => JSON.parse(withUserId(input)));
  assert.deepEqual(signed.forwardedProps, { userId: "verified", learningReview: true });
  const local = userContext.run({ userId: "verified", localAuthCookie: "local-cookie" }, () => JSON.parse(withUserId(input)));
  assert.equal(local.forwardedProps.localAuthCookie, "local-cookie");
});
