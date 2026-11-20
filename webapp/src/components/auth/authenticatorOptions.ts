// 公開環境は招待制。自己登録の禁止自体はCognito側でも強制する。
const hiddenActions: "signUp"[] = import.meta.env.PROD ? ["signUp"] : [];

export const authenticatorOptions = {
  hideActions: hiddenActions,
  headings: {
    signedOut: "クエストボードにログイン",
    signingUp: "ユーザー登録",
  },
  actions: {
    signIn: {
      submitLabel: "ログイン",
      fields: {
        username: { label: "メールアドレス" },
        password: { label: "パスワード" },
      },
    },
    signUp: {
      submitLabel: "ユーザー登録",
      fields: {
        username: { label: "メールアドレス" },
        password: { label: "パスワード" },
      },
    },
    resetPassword: { submitLabel: "パスワードを忘れた場合" },
    confirmSignUp: {
      submitLabel: "登録を確認",
      fields: { code: { label: "確認コード" } },
    },
    resendSignUpCode: { submitLabel: "確認コードを再送信" },
  },
};
