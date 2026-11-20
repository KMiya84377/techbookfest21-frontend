// mock モード専用。認証なしで、固定のユーザーとして扱う
export const authenticateMock = async (_request: Request): Promise<string> =>
  "mock-user";
