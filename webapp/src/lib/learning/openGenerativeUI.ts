import { z } from "zod";

export const LEARNING_UI_TOOL = "generateSandboxedUi";
export const LEARNING_UI_ACTIVITY = "open-generative-ui";

// CopilotKit 1.73.3のツール引数に、保存用のサイズ・高さの制約を加える。
// HTMLはホストDOMへ挿入せず、公式レンダラーのsandbox内だけで実行する。
export const learningUIArgsSchema = z
  .object({
    initialHeight: z.number().int().min(200).max(1000),
    placeholderMessages: z.array(z.string().max(200)).max(3).optional(),
    css: z.string().max(20_000),
    html: z.string().trim().min(1).max(60_000),
    jsFunctions: z.string().max(20_000).optional(),
    jsExpressions: z.array(z.string().max(5_000)).max(12).optional(),
  })
  .strict();

const contentSchema = z
  .object({
    initialHeight: z.number().int().min(200).max(1000),
    generating: z.literal(false),
    css: z.string().max(20_000),
    cssComplete: z.literal(true),
    html: z.array(z.string()).min(1).max(5000),
    htmlComplete: z.literal(true),
    jsFunctions: z.string().max(20_000).optional(),
    jsFunctionsComplete: z.literal(true).optional(),
    jsExpressions: z.array(z.string().max(5_000)).max(12).optional(),
    jsExpressionsComplete: z.literal(true).optional(),
  })
  .strict()
  .superRefine((content, context) => {
    if (
      !content.html.join("").trim() ||
      content.html.join("").length > 60_000
    ) {
      context.addIssue({
        code: "custom",
        message: "図解のHTMLが空、または長すぎます",
      });
    }
    if (
      new TextEncoder().encode(JSON.stringify(content)).byteLength > 160_000
    ) {
      context.addIssue({
        code: "custom",
        message: "図解の保存サイズが上限を超えています",
      });
    }
  });

export const learningUISchema = z
  .object({
    version: z.literal(1),
    messageId: z.string().min(1).max(200),
    content: contentSchema,
  })
  .strict();
export type LearningUI = z.infer<typeof learningUISchema>;

// srcdocの先頭で適用する。親ページのCSPに加え、同一オリジンへの通信も禁止する。
// 公式sandboxのインラインスクリプトだけを許可し、eval・外部スクリプト・通信は禁止する。
const SANDBOX_HEAD = `<head><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; connect-src 'none'; font-src 'none'; frame-src 'none'; object-src 'none'; form-action 'none'; base-uri 'none'"></head>`;

export function restrictedLearningUIContent(ui: LearningUI) {
  return { ...ui.content, html: [SANDBOX_HEAD + ui.content.html.join("")] };
}
