import assert from "node:assert/strict";
import test, { afterEach, mock } from "node:test";
import { setImmediate } from "node:timers/promises";
import type { Quest } from "../src/lib/quests/model";
import type { ApiFetch } from "../src/hooks/useApiFetch";
import { DEFAULT_USER_SETTINGS } from "../src/lib/userSettings/model";
import { buildSampleQuests } from "../mock/sampleQuests";
import { hookHarness } from "./helpers/hookHarness";
import { loadIsolatedModule } from "./helpers/loadIsolatedModule";

afterEach(() => mock.restoreAll());

const quest: Quest = { ...buildSampleQuests()[0], status: "todo" };
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

async function questScenario() {
  const harness = hookHarness();
  const { useQuests } = await loadIsolatedModule<typeof import("../src/hooks/useQuests")>(
    "src/hooks/useQuests.ts", { react: harness.react },
  );
  let serverQuests = [quest];
  const saves: {
    body: { status: string; review?: boolean };
    resolve: (response: Response) => void;
  }[] = [];
  const apiFetch: ApiFetch = async (_url, init = {}) => {
    if (init.method === "PATCH") {
      const pending = Promise.withResolvers<Response>();
      saves.push({ body: JSON.parse(init.body as string), resolve: pending.resolve });
      return pending.promise;
    }
    return json({ quests: serverQuests });
  };
  const render = () => harness.render(() => useQuests(apiFetch));
  const loading = render();
  await setImmediate();
  return {
    harness, saves, render, loading,
    replaceServerQuests(quests: Quest[]) { serverQuests = quests; },
  };
}

test("取得値と表示値を区別し、閲覧は保存の完了前に画面へ反映する", async () => {
  const s = await questScenario();
  assert.equal(s.loading.displayedQuests, undefined);
  assert.equal(s.render().displayedQuests?.[0].status, "todo");
  s.render().markViewed(quest.id);
  assert.equal(s.render().displayedQuests?.[0].status, "viewed");
  assert.equal(quest.status, "todo", "APIの取得値は変更しない");
  assert.equal(s.saves[0].body.status, "viewed");
  s.saves[0].resolve(json({}));
  await setImmediate();
  s.harness.unmount();
});

test("クリアは保存後に反映し、同時に複数回保存しない", async () => {
  const s = await questScenario();
  s.render().markCleared(quest.id, true);
  s.render().markCleared(quest.id, true);
  assert.equal(s.saves.length, 1);
  assert.equal(s.render().displayedQuests?.[0].status, "todo");
  const learning = { count: 5, batch: 1, reviewEvery: 5, newlyCleared: true };
  s.saves[0].resolve(json({ learning }));
  await setImmediate();
  const saved = s.render();
  assert.equal(saved.displayedQuests?.[0].status, "cleared");
  assert.equal(saved.displayedQuests?.[0].review, true);
  assert.deepEqual(saved.learningEvent, { progress: learning, version: 1 });
  saved.markViewed(quest.id);
  saved.markCleared(quest.id, false);
  assert.equal(s.saves.length, 1, "クリア済みの状態を戻さない");
  s.harness.unmount();
});

test("クリア保存に失敗したら状態を変えず、再試行できる", async () => {
  mock.method(console, "error", () => {});
  const s = await questScenario();
  s.render().markCleared(quest.id, false);
  s.saves[0].resolve(json({}, 500));
  await setImmediate();
  assert.equal(s.render().displayedQuests?.[0].status, "todo");
  assert.equal(s.render().learningEvent, null);
  assert.match(s.render().stateError!, /クリア状態を保存できません/);
  s.render().markCleared(quest.id, false);
  assert.equal(s.saves.length, 2);
  s.saves[1].resolve(json({}));
  await setImmediate();
  assert.equal(s.render().displayedQuests?.[0].status, "cleared");
  assert.equal(s.render().stateError, null);
  s.harness.unmount();
});

test("一覧の再取得直後は、再描画の前でも最新のクエストを参照できる", async () => {
  const s = await questScenario();
  const previous = s.render();
  const added = { ...quest, id: "new-quest" };
  s.replaceServerQuests([added]);
  assert.deepEqual(await previous.reloadQuests(), [added]);
  assert.deepEqual(previous.findDisplayedQuest(added.id), added);
  assert.equal(previous.findDisplayedQuest(quest.id), undefined);
  assert.equal(s.render().displayedQuests?.[0].id, added.id);
  s.harness.unmount();
});

type SharedOptions = Parameters<
  typeof import("../src/hooks/copilotkit/useSharedAgentState").useSharedAgentState
>[0];

async function sharedScenario(
  initialState: Record<string, unknown>,
  reloadQuests: () => Promise<Quest[]> = async () => [quest],
) {
  const harness = hookHarness();
  const writes: Record<string, unknown>[] = [];
  const errors: string[] = [];
  const agent = {
    state: initialState,
    setState(state: Record<string, unknown>) {
      writes.push(state);
      agent.state = state;
    },
  };
  const { useSharedAgentState } = await loadIsolatedModule<
    typeof import("../src/hooks/copilotkit/useSharedAgentState")
  >("src/hooks/copilotkit/useSharedAgentState.ts", {
    react: harness.react,
    "@copilotkit/react-core/v2": { useAgent: () => ({ agent }) },
  });
  const options: SharedOptions = {
    quests: [quest], reloadQuests,
    onRefreshError: (message) => errors.push(message),
    userSettings: DEFAULT_USER_SETTINGS, userSettingsReady: false,
  };
  const render = () => harness.render(() => useSharedAgentState(options));
  return { harness, agent, writes, errors, options, render };
}

test("共有は必要なニュース項目だけを送り、設定は読み込み完了まで送らない", async () => {
  const s = await sharedScenario({ other: "keep" });
  s.render();
  assert.equal(s.agent.state.other, "keep");
  assert.equal(s.agent.state.userSettings, undefined);
  const board = s.agent.state.questBoard as { quests: Record<string, unknown>[] };
  assert.equal(board.quests[0].id, quest.id);
  assert.equal(board.quests[0].changes, undefined);
  s.render();
  assert.equal(s.writes.length, 1, "同じ一覧は書き直さない");
  s.options.userSettingsReady = true;
  s.render();
  assert.deepEqual(s.agent.state.userSettings, DEFAULT_USER_SETTINGS);
  assert.equal(s.agent.state.other, "keep");
  s.render();
  assert.equal(s.writes.length, 2, "同じ設定は書き直さない");
  s.harness.unmount();
});

test("エージェントの更新要求に応じて一覧を取得し直す", async () => {
  const pending = Promise.withResolvers<Quest[]>();
  const s = await sharedScenario({ other: "keep", questBoard: { refreshRequested: true } }, () => pending.promise);
  s.render();
  assert.equal(s.writes.length, 0, "取得前に古い一覧を共有しない");
  const latest = { ...quest, title: "最新のニュース" };
  pending.resolve([latest]);
  await setImmediate();
  const board = s.agent.state.questBoard as { refreshRequested: boolean; quests: Quest[] };
  assert.equal(board.refreshRequested, false);
  assert.equal(board.quests[0].title, latest.title);
  assert.equal(s.agent.state.other, "keep");
  s.harness.unmount();
});

test("共有状態の更新失敗を通知し、他の状態を失わない", async () => {
  mock.method(console, "error", () => {});
  const s = await sharedScenario({
    other: "keep", questBoard: { refreshRequested: true, custom: "keep-board" },
  }, async () => { throw new Error("network failed"); });
  s.render();
  await setImmediate();
  assert.deepEqual(s.agent.state.questBoard, {
    refreshRequested: false, refreshError: true, custom: "keep-board",
  });
  assert.equal(s.agent.state.other, "keep");
  assert.equal(s.errors.length, 1);
  s.harness.unmount();
});

test("画面を閉じた後は、取得が完了しても共有状態を更新しない", async () => {
  const pending = Promise.withResolvers<Quest[]>();
  const s = await sharedScenario({ questBoard: { refreshRequested: true } }, () => pending.promise);
  s.render();
  s.harness.unmount();
  pending.resolve([quest]);
  await setImmediate();
  assert.equal(s.writes.length, 0);
});
