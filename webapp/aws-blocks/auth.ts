import { AuthCognito } from "@aws-blocks/blocks";
import { scope } from "./storage";

export const auth = new AuthCognito(scope, "auth", {
  signInWith: "email",
  authFlowType: "USER_PASSWORD_AUTH",
  // ローカル開発では登録できるようにする。AWS側はindex.cdk.tsで招待制に制限する。
  selfSignUp: true,
  passwordPolicy: {
    minLength: 8,
    requireDigits: true,
    requireLowercase: true,
    requireUppercase: true,
    requireSymbols: true,
  },
  // 招待されたユーザーがパスワードだけでログインできるよう、MFAは無効にする。
  mfa: "off",
  mfaTypes: ["TOTP"],
  // ローカル専用: 認証コードをメールで送らず、ログに出す
  codeDelivery: async (username, code, purpose) => {
    if (!process.env.BLOCKS_STACK_NAME) {
      console.log(`[local auth] ${purpose}: ${username}: ${code}`);
    }
  },
});
