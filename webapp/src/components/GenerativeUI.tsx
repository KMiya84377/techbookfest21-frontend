import { useAgentContext, useFrontendTool, useHumanInTheLoop } from "@copilotkit/react-core/v2";
import { z } from "zod";
import type { Quest } from "../data/quests";
import {
  describeFilter,
  filterPatchSchema,
  type FilterChange,
  type FilterPatch,
  type QuestFilter,
} from "../lib/questFilter";
import {
  detailUpdateSchema,
  type DetailSection,
  type DetailUpdate,
} from "../lib/detailSections";
import DetailUpdateCard from "./DetailUpdateCard";
import FilterChangeCard from "./FilterChangeCard";
import Quiz, { quizSchema } from "./Quiz";

interface Props {
  // ボードのクエストと、詳細を開いているクエストの ID、適用中の検索条件(エージェントに、状況として渡す)
  quests: Quest[];
  openedId: string | null;
  filter: QuestFilter;
  // メイン領域(クエストボード)の検索条件を変える。変更の内容を返す
  updateFilter: (patch: FilterPatch) => FilterChange;
  // クエストを取得し直して、ボードを更新する
  reloadQuests: () => Promise<{ count: number }>;
  // 詳細を開いているクエストに、チャットで追加した表示(クエストの ID ごと)
  detailExtras: Record<string, DetailSection[]>;
  // 詳細を開いているクエストの詳細に、表示を追加・更新する。結果を返す
  updateDetail: (questId: string, sections: DetailSection[]) => DetailUpdate;
}

// エージェントが呼び出せる、チャット内の UI と、画面を操作するツールを登録し、画面の状況を渡す
// (CopilotKitProvider の中に置く)
export default function GenerativeUI({
  quests,
  openedId,
  filter,
  updateFilter,
  reloadQuests,
  detailExtras,
  updateDetail,
}: Props) {
  // 画面の状況: エージェントは、クエストの ID を知らないため、ここで渡す
  useAgentContext({
    description:
      "クエストボードにあるクエストの一覧。id は、show_quiz の questId などに、そのまま使う(推測しない)",
    value: quests.map((q) => ({
      id: q.id,
      title: q.title,
      services: q.services,
      importance: q.importance,
      minutes: q.minutes,
      status: q.status,
      publishedAt: q.publishedAt,
      summary: q.summary,
    })),
  });
  const opened = quests.find((q) => q.id === openedId);
  useAgentContext({
    description:
      "ユーザーが、いま詳細を開いているクエスト(なければ null)。「このクエスト」は、これを指す",
    value: opened
      ? {
          ...JSON.parse(JSON.stringify(opened)),
          // すでにチャットで追加した表示(更新するときは、同じ id を使う)
          chatAddedSections: detailExtras[opened.id] ?? [],
        }
      : null,
  });
  useAgentContext({
    description: "クエストボードで、適用中の検索条件(空なら、条件なし)",
    value: describeFilter(filter),
  });

  // 理解度チェック: 問題を表示し、ユーザーの初回の回答を、エージェントに返す
  // 回答が返るまで、エージェントの実行は止まる
  useHumanInTheLoop({
    name: "show_quiz",
    description:
      "クエストの内容に合わせた、単一選択の理解度チェックの問題を、チャットに表示する。questId は、クエスト一覧の id を、そのまま使う。ユーザーが回答すると、その内容(選んだ選択肢と、正誤)が返る",
    parameters: quizSchema,
    render: ({ args, respond, result }) => (
      <Quiz {...args} respond={respond} result={result} />
    ),
  });

  // クエストボードの検索条件の変更: ユーザーの依頼(期間、サービス、重要度など)を、メイン領域に反映する
  // 変更の内容(変更前、変更後、件数)を、チャットに表示し、エージェントにも返す
  useFrontendTool({
    name: "update_quest_filter",
    description:
      "クエストボードの検索条件を変える。ユーザーが、期間、AWS サービス、重要度、想定学習時間、状態で、クエストを絞り込みたいときに呼ぶ。指定した条件だけを変え、null で条件を解除する。すべて解除するときは reset を true にする。変更前後の条件と、表示される件数が返る",
    parameters: filterPatchSchema,
    handler: async (args) => updateFilter(args),
    render: ({ status, result }) => <FilterChangeCard status={status} result={result} />,
  });

  // クエスト詳細の更新: 質問への回答のうち、比較や影響など、広い表示が向くものを、メイン領域の詳細に出す
  // 更新の内容(追加・更新した表示)を、チャットに表示し、エージェントにも返す
  useFrontendTool({
    name: "update_quest_detail",
    description:
      "詳細を開いているクエストの詳細レイヤー(メイン領域)に、表示を追加または更新する。比較(これまでと更新後)や、影響の整理など、チャットには広すぎる情報を出すときに呼ぶ。短い説明は、チャットで答える。同じ id の表示は更新し、新しい id は追加する。詳細を開いていないクエストには使えない",
    parameters: detailUpdateSchema,
    handler: async ({ questId, sections }) => updateDetail(questId, sections),
    render: ({ status, result }) => <DetailUpdateCard status={status} result={result} />,
  });

  // クエストの取得し直し: エージェントが、クエストを保存したあとに呼び、ボードに反映する
  useFrontendTool({
    name: "reload_quests",
    description:
      "保存済みのクエストを取得し直して、クエストボードを更新する。save_quests でクエストを保存したあとに、必ず呼ぶ。更新後のクエストの数が返る",
    parameters: z.object({}),
    handler: async () => reloadQuests(),
    render: ({ status, result }) => {
      const count = (() => {
        try {
          return (JSON.parse(result ?? "") as { count: number }).count;
        } catch {
          return null;
        }
      })();
      return (
        <div className="notice" role="status">
          {status === "complete" && count !== null
            ? `クエストボードを更新しました(${count} 件)`
            : "クエストボードを更新しています…"}
        </div>
      );
    },
  });

  return null;
}
