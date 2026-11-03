import { useEffect, useRef, useState, type FormEvent } from "react";
import { CheckIcon, Settings2Icon } from "lucide-react";
import { Button } from "./ui/button";
import {
  LEARNING_TOPICS,
  DEFAULT_LEARNING_REVIEW_EVERY,
  MIN_LEARNING_REVIEW_EVERY,
  MAX_LEARNING_REVIEW_EVERY,
  type AnswerDetail,
  type LearningDifficulty,
  type UserSettings,
} from "../lib/userSettings/model";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "./ui/dialog";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: UserSettings;
  loading: boolean;
  loadError: string | null;
  onSave: (settings: UserSettings) => Promise<void>;
}

const DIFFICULTIES: {
  id: LearningDifficulty;
  label: string;
  description: string;
}[] = [
  { id: "beginner", label: "初級", description: "用語から補足" },
  { id: "intermediate", label: "中級", description: "基本知識を前提" },
  { id: "advanced", label: "上級", description: "設計やトレードオフまで" },
];

const ANSWER_DETAILS: {
  id: AnswerDetail;
  label: string;
  description: string;
}[] = [
  { id: "concise", label: "簡潔", description: "要点を中心に" },
  { id: "standard", label: "標準", description: "背景も含めて" },
  { id: "detailed", label: "詳しく", description: "仕組みや注意点まで" },
];

export default function UserSettingsDialog({
  open,
  onOpenChange,
  settings,
  loading,
  loadError,
  onSave,
}: Props) {
  const [draft, setDraft] = useState(settings);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!open || loading) return;
    setDraft(settingsRef.current);
    setSaveError(null);
    setSaved(false);
  }, [open, loading]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (loading || saving) return;
    setSaving(true);
    setSaveError(null);
    setSaved(false);
    try {
      await onSave(draft);
      setSaved(true);
    } catch {
      setSaveError(
        "設定を保存できませんでした。時間をおいて再度お試しください。",
      );
    } finally {
      setSaving(false);
    }
  };

  const toggleTopic = (topicId: UserSettings["learningTopics"][number]) => {
    setDraft((current) => ({
      ...current,
      learningTopics: current.learningTopics.includes(topicId)
        ? current.learningTopics.filter((item) => item !== topicId)
        : [...current.learningTopics, topicId],
    }));
    setSaved(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="fixed top-1/2 left-1/2 max-h-[min(88dvh,780px)] w-[min(560px,calc(100vw-24px))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-[3px] border border-[#b99a67] bg-[#fffaf0] p-0 text-[#302b22] shadow-[0_18px_55px_#0009]">
        <form onSubmit={(event) => void submit(event)}>
          <div className="border-b border-[#d9c9aa] bg-[#f4e8ce] px-6 py-5 pr-12 max-[520px]:px-4">
            <div className="flex items-center gap-2 text-[#74532b]">
              <Settings2Icon className="size-4" aria-hidden="true" />
              <span className="text-[11px] tracking-[0.13em]">
                LEARNER PROFILE
              </span>
            </div>
            <DialogTitle className="mt-1 font-[var(--font-tavern)] text-xl font-medium">
              学習設定
            </DialogTitle>
            <DialogDescription className="mt-1 text-sm text-[#746b5c]">
              学習分野や説明の仕方を、あなたに合わせて調整します。
            </DialogDescription>
          </div>

          <div className="space-y-6 px-6 py-5 max-[520px]:px-4">
            {loading && (
              <p className="text-sm text-[#746b5c]" role="status">
                保存済みの設定を読み込んでいます…
              </p>
            )}
            {loadError && (
              <p
                className="border border-[#d9c9aa] bg-[#f9f0df] px-3 py-2 text-sm text-[#74532b]"
                role="alert"
              >
                {loadError}{" "}
                初期設定を表示しています。保存すると設定を登録できます。
              </p>
            )}

            <fieldset disabled={loading || saving}>
              <legend className="text-sm font-semibold">学びたい分野</legend>
              <p className="mt-1 text-xs leading-relaxed text-[#746b5c]">
                何も選ばない場合は、AWS全般を対象にします。
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {LEARNING_TOPICS.map((topic) => {
                  const selected = draft.learningTopics.includes(topic.id);
                  return (
                    <Button
                      key={topic.id}
                      type="button"
                      variant="questOutline"
                      size="sm"
                      aria-pressed={selected}
                      className={
                        selected ? "border-[#74532b] bg-[#f0e2c4]" : ""
                      }
                      onClick={() => toggleTopic(topic.id)}
                    >
                      {selected && (
                        <CheckIcon className="size-3.5" aria-hidden="true" />
                      )}
                      {topic.label}
                    </Button>
                  );
                })}
              </div>
            </fieldset>

            <fieldset disabled={loading || saving}>
              <legend className="text-sm font-semibold">学習の難易度</legend>
              <div className="mt-3 grid grid-cols-3 gap-2 max-[420px]:grid-cols-1">
                {DIFFICULTIES.map((option) => {
                  const selected = draft.difficulty === option.id;
                  return (
                    <Button
                      key={option.id}
                      type="button"
                      variant="questOutline"
                      aria-pressed={selected}
                      className={`h-auto min-h-[58px] flex-col items-start whitespace-normal px-3 py-2 ${selected ? "border-[#74532b] bg-[#f0e2c4]" : ""}`}
                      onClick={() => {
                        setDraft((current) => ({
                          ...current,
                          difficulty: option.id,
                        }));
                        setSaved(false);
                      }}
                    >
                      <span className="font-semibold">{option.label}</span>
                      <span className="text-xs font-normal text-[#746b5c]">
                        {option.description}
                      </span>
                    </Button>
                  );
                })}
              </div>
            </fieldset>

            <fieldset disabled={loading || saving}>
              <legend className="text-sm font-semibold">回答の詳しさ</legend>
              <div className="mt-3 grid grid-cols-3 gap-2 max-[420px]:grid-cols-1">
                {ANSWER_DETAILS.map((option) => {
                  const selected = draft.answerDetail === option.id;
                  return (
                    <Button
                      key={option.id}
                      type="button"
                      variant="questOutline"
                      aria-pressed={selected}
                      className={`h-auto min-h-[58px] flex-col items-start whitespace-normal px-3 py-2 ${selected ? "border-[#74532b] bg-[#f0e2c4]" : ""}`}
                      onClick={() => {
                        setDraft((current) => ({
                          ...current,
                          answerDetail: option.id,
                        }));
                        setSaved(false);
                      }}
                    >
                      <span className="font-semibold">{option.label}</span>
                      <span className="text-xs font-normal text-[#746b5c]">
                        {option.description}
                      </span>
                    </Button>
                  );
                })}
              </div>
            </fieldset>

            <fieldset disabled={loading || saving}>
              <label
                htmlFor="learning-review-every"
                className="text-sm font-semibold"
              >
                図解を提案する学習件数
              </label>
              <div className="mt-3 flex items-center gap-2">
                <input
                  id="learning-review-every"
                  type="number"
                  min={MIN_LEARNING_REVIEW_EVERY}
                  max={MAX_LEARNING_REVIEW_EVERY}
                  step={1}
                  required
                  aria-describedby="learning-review-help"
                  value={
                    Number.isFinite(draft.learningReviewEvery)
                      ? draft.learningReviewEvery
                      : ""
                  }
                  onChange={(event) => {
                    const value = event.currentTarget.valueAsNumber;
                    setDraft((current) => ({
                      ...current,
                      learningReviewEvery: value,
                    }));
                    setSaved(false);
                  }}
                  className="w-24 rounded border border-[#b99a67] bg-white px-3 py-2 text-sm"
                />
                <span className="text-sm">件ごと</span>
              </div>
              <p
                id="learning-review-help"
                className="mt-2 text-xs leading-relaxed text-[#746b5c]"
              >
                学習したニュースのつながりを分析して図解を提案します。
                {MIN_LEARNING_REVIEW_EVERY}〜{MAX_LEARNING_REVIEW_EVERY}
                件で設定できます（初期値：{DEFAULT_LEARNING_REVIEW_EVERY}件）。
                少なくすると分析の頻度が上がります。
              </p>
            </fieldset>

            {(saveError || saved) && (
              <p
                className={`text-sm ${saveError ? "text-[#8a1f1f]" : "text-[#3e7254]"}`}
                role={saveError ? "alert" : "status"}
              >
                {saveError ?? "設定を保存しました。"}
              </p>
            )}
          </div>

          <div className="flex justify-end gap-2 border-t border-[#d9c9aa] bg-[#fcf6e9] px-6 py-4 max-[520px]:px-4">
            <Button
              type="button"
              variant="questOutline"
              disabled={saving}
              onClick={() => onOpenChange(false)}
            >
              閉じる
            </Button>
            <Button
              type="submit"
              variant="questPrimary"
              disabled={loading || saving}
            >
              {saving ? "保存中…" : "設定を保存"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
