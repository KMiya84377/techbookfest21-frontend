import { useCallback, useEffect, useRef, useState } from "react";
import type { ApiFetch } from "./useApiFetch";
import type { LearningInsight, LearningProgress } from "../lib/learning/model";
import { DEFAULT_LEARNING_REVIEW_EVERY } from "../lib/userSettings/model";

const INSIGHTS_URL = "/api/learning-insights";

// GET /api/learning-insights の応答
interface Status {
  insights: LearningInsight[];
  learning: LearningProgress;
  // まだ分析していない区間(なければ null)
  pendingBatch: number | null;
}

// 関連分析を頼む区間(何件ごとの、何番目のまとまりか)
type ReviewRequest = Pick<LearningProgress, "batch" | "reviewEvery">;

const requestKey = (request: ReviewRequest) =>
  `${request.reviewEvery}:${request.batch}`;

const pendingRequest = (status: Status): ReviewRequest | null =>
  status.pendingBatch
    ? { batch: status.pendingBatch, reviewEvery: status.learning.reviewEvery }
    : null;

// 学習内容の関連分析(図解の通知)の取得と、分析の依頼
//   クエストをクリアするたび(event)に、区切りの件数に達していれば分析を頼む
//   分析は同時に 1 つだけ。実行中に来た依頼は、最後の 1 つだけを次に回す
export function useLearningInsights(
  apiFetch: ApiFetch,
  event: { progress: LearningProgress | null; version: number } | null,
  reviewEvery: number,
) {
  const [insights, setInsights] = useState<LearningInsight[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const queuedRequest = useRef<ReviewRequest | null>(null);
  const mounted = useRef(false);
  // run の中から、次の依頼を最新の run で実行するための参照
  const runner = useRef<(request: ReviewRequest) => Promise<void>>(
    async () => {},
  );

  const refresh = useCallback(async (): Promise<Status> => {
    const response = await apiFetch(INSIGHTS_URL, { cache: "no-store" });
    if (!response.ok) throw new Error("学習の通知を取得できませんでした");
    const status = (await response.json()) as Status;
    if (mounted.current) setInsights(status.insights);
    return status;
  }, [apiFetch]);

  const run = useCallback(
    async (request: ReviewRequest) => {
      if (inFlight.current) {
        queuedRequest.current = request;
        return;
      }
      inFlight.current = true;
      if (mounted.current) {
        setBusy(true);
        setError(null);
      }
      try {
        const response = await apiFetch(INSIGHTS_URL, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(request),
        });
        // 409 は、設定が変わって区間が古くなった(stale)。応答の状態で続ける
        if (!response.ok && response.status !== 409) {
          throw new Error("学習内容のつながりを分析できませんでした");
        }
        const status = (await response.json()) as Status;
        if (mounted.current) setInsights(status.insights);
        const pending = pendingRequest(status);
        if (pending && requestKey(pending) !== requestKey(request)) {
          queuedRequest.current = pending;
        }
      } catch (cause) {
        if (mounted.current) {
          setError(
            cause instanceof Error ? cause.message : "関連分析に失敗しました",
          );
        }
      } finally {
        inFlight.current = false;
        if (mounted.current) setBusy(false);
        const next = queuedRequest.current;
        queuedRequest.current = null;
        // 同じ区間はサーバーでも重複排除。失敗した同一区間を自動で無限再試行しない。
        if (
          mounted.current &&
          next &&
          requestKey(next) !== requestKey(request)
        ) {
          void runner.current(next);
        }
      }
    },
    [apiFetch],
  );
  runner.current = run;

  // 通知を取得し直し、まだ分析していない区間があれば、分析を頼む
  const refreshAndRunPending = useCallback(
    async (failureMessage: string) => {
      try {
        const pending = pendingRequest(await refresh());
        if (mounted.current && pending) await runner.current(pending);
      } catch {
        if (mounted.current) setError(failureMessage);
      }
    },
    [refresh],
  );

  // 表示したときと、設定の「図解を提案する学習件数」が変わったときに取得し直す
  useEffect(() => {
    mounted.current = true;
    void refreshAndRunPending("学習の通知を取得できませんでした");
    return () => {
      mounted.current = false;
    };
  }, [refreshAndRunPending, reviewEvery]);

  // クエストをクリアしたとき。保存の応答に学習件数がなければ、取得し直して確かめる
  useEffect(() => {
    if (!event) return;
    if (event.progress) {
      if (event.progress.batch > 0) void runner.current(event.progress);
    } else {
      void refreshAndRunPending("保存後の学習件数を取得できませんでした");
    }
  }, [event, refreshAndRunPending]);

  const retry = useCallback(async () => {
    setError(null);
    await refreshAndRunPending("学習の通知を取得できませんでした");
  }, [refreshAndRunPending]);

  const markRead = useCallback(
    async (insight: LearningInsight) => {
      try {
        const response = await apiFetch(INSIGHTS_URL, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            batch: insight.batch,
            reviewEvery: insight.reviewEvery ?? DEFAULT_LEARNING_REVIEW_EVERY,
          }),
        });
        if (!response.ok) throw new Error("既読の保存に失敗しました");
        if (mounted.current) {
          setInsights((current) =>
            current.map((item) =>
              item.id === insight.id
                ? { ...item, readAt: new Date().toISOString() }
                : item,
            ),
          );
        }
      } catch {
        if (mounted.current) setError("通知を既読にできませんでした");
      }
    },
    [apiFetch],
  );

  return { insights, busy, error, retry, markRead };
}
