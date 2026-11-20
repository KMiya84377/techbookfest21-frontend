import type { z } from "zod";

// ツールの結果をチャットに表示する部品(useFrontendTool の render)が受け取る値
export interface ToolResultProps {
  status: string;
  // ツールが返した値(JSON の文字列)。届くまでは undefined
  result?: string;
}

// ユーザーの回答を待つ部品(useHumanInTheLoop の render)が受け取る値
export interface HumanInTheLoopProps {
  // 回答を、エージェントに返す関数(エージェントの応答待ちの間だけ、渡される)
  respond?: (result: unknown) => Promise<void>;
  // 回答済みのときの、エージェントに返した内容(JSON の文字列)
  result?: string;
}

// ツールの結果(JSON の文字列)を読み、スキーマに合うときだけ値を返す。
// 届きかけ・壊れた・形の違う結果は null(表示側で「更新しています…」などにする)
export function parseToolResult<T>(
  result: string | undefined,
  schema: z.ZodType<T>,
): T | null {
  if (!result) return null;
  try {
    const parsed = schema.safeParse(JSON.parse(result));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
