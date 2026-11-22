import { Auth } from "aws-cdk-blocks";
import { scope } from "./storage";

// ブロックのid("auth")は変えない。idはリソース名の一部で、変えるとCognitoのユーザープールが作り直される。
export const auth = new Auth(scope, "auth", {
  emailPassword: {
    // ローカル開発では登録できるようにする。AWS側はindex.cdk.tsで招待制に制限する。
    selfSignUp: true,
    passwordPolicy: {
      minLength: 8,
      requireDigits: true,
      requireLowercase: true,
      requireUppercase: true,
      requireSymbols: true,
    },
  },
  users: {
    signInWith: ["email"],
    authFlow: "USER_PASSWORD_AUTH",
  },
  // 招待されたユーザーがパスワードだけでログインできるよう、MFAは無効にする。
  mfa: "off",
  // ユーザープールを消すと、中のユーザーも全員消えて、戻せない。実ユーザーがいるため、明示的に残す。
  removalPolicy: "retain",
  // ローカル専用: 認証コードをメールで送らず、ログに出す
  codeDelivery: async (username, code, purpose) => {
    if (!process.env.BLOCKS_STACK_NAME) {
      console.log(`[local auth] ${purpose}: ${username}: ${code}`);
    }
  },
});
