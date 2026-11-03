import { NEWS_FEED } from "../../../aws-blocks/constants";
import type { Quest } from "../../lib/quests/model";
import type { UserQuestItem } from "./userQuestItem";

// ニュース本文と、ニュースから生成した共通のクエスト情報を保存するテーブルの項目

export interface NewsItem extends Omit<Quest, "id" | "status" | "review"> {
  newsId: string;
  feed: string;
}

export function toNewsItem(quest: Quest): NewsItem {
  const { id, status: _status, review: _review, ...news } = quest;
  return { ...news, newsId: id, feed: NEWS_FEED };
}

export function toQuest(news: NewsItem, state?: UserQuestItem): Quest {
  const { newsId: _newsId, feed: _feed, ...content } = news;
  return {
    ...content,
    id: news.newsId,
    status: state?.status ?? "todo",
    ...(state?.review === undefined ? {} : { review: state.review }),
  };
}
