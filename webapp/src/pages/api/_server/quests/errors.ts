// 指定したニュースが見つからない(利用者側の指定の誤り)。API は 404 を返す
export class QuestNotFoundError extends Error {
  constructor() {
    super("対象のニュースが見つかりません");
    this.name = "QuestNotFoundError";
  }
}
