import { useEffect, useRef, useState, type FormEvent } from "react";
import { Settings2Icon } from "lucide-react";
import { clsx } from "cn";
import { Button } from "../ui/button";
import {
  ANSWER_DETAIL_OPTIONS,
  DIFFICULTY_OPTIONS,
  type UserSettings,
} from "../../lib/userSettings/model";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "../ui/dialog";
import {
  ChoiceFieldset,
  LearningTopicsFieldset,
  LearningReviewIntervalFieldset,
} from "./UserSettingsFields";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: UserSettings;
  loading: boolean;
  loadError: string | null;
  onSave: (settings: UserSettings) => Promise<void>;
}

export default function UserSettingsDialog({
  open,
  onOpenChange,
  settings,
  loading,
  loadError,
  onSave,
}: Props) {
  const [draftSettings, setDraftSettings] = useState(settings);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSucceeded, setSaveSucceeded] = useState(false);

  useEffect(() => {
    if (!open || loading) return;
    setDraftSettings(settingsRef.current);
    setSaveError(null);
    setSaveSucceeded(false);
  }, [open, loading]);

  const saveSettings = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (loading || isSaving) return;
    setIsSaving(true);
    setSaveError(null);
    setSaveSucceeded(false);
    try {
      await onSave(draftSettings);
      setSaveSucceeded(true);
    } catch {
      setSaveError(
        "設定を保存できませんでした。時間をおいて再度お試しください。",
      );
    } finally {
      setIsSaving(false);
    }
  };

  // 下書きの一部を変える(保存済みの表示は消す)
  const updateDraftSettings = (change: Partial<UserSettings>) => {
    setDraftSettings((current) => ({ ...current, ...change }));
    setSaveSucceeded(false);
  };

  const toggleTopic = (topicId: UserSettings["learningTopics"][number]) => {
    setDraftSettings((current) => ({
      ...current,
      learningTopics: current.learningTopics.includes(topicId)
        ? current.learningTopics.filter((item) => item !== topicId)
        : [...current.learningTopics, topicId],
    }));
    setSaveSucceeded(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={clsx(
        "fixed top-1/2 left-1/2 max-h-[min(88dvh,780px)] w-[min(560px,calc(100vw-24px))]",
        "-translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-[3px] border",
        "border-quest-frame bg-quest-card p-0 text-quest-card-ink",
        "shadow-[0_18px_55px_var(--quest-dialog-shadow)]",
      )}>
        <form onSubmit={(event) => void saveSettings(event)}>
          <div className="border-b border-quest-card-line bg-quest-card-header px-6 py-5 pr-12 max-[520px]:px-4">
            <div className="flex items-center gap-2 text-quest-brown">
              <Settings2Icon className="size-4" aria-hidden="true" />
              <span className="text-[11px] tracking-[0.13em]">
                LEARNER PROFILE
              </span>
            </div>
            <DialogTitle className="mt-1 font-quest-tavern text-xl font-medium">
              学習設定
            </DialogTitle>
            <DialogDescription className="mt-1 text-sm text-quest-card-muted">
              学習分野や説明の仕方を、あなたに合わせて調整します。
            </DialogDescription>
          </div>

          <div className="space-y-6 px-6 py-5 max-[520px]:px-4">
            {loading && (
              <p className="text-sm text-quest-card-muted" role="status">
                保存済みの設定を読み込んでいます…
              </p>
            )}
            {loadError && (
              <p
                className="border border-quest-card-line bg-quest-settings-notice-bg px-3 py-2 text-sm text-quest-brown"
                role="alert"
              >
                {loadError}{" "}
                初期設定を表示しています。保存すると設定を登録できます。
              </p>
            )}

            <LearningTopicsFieldset
              topics={draftSettings.learningTopics}
              disabled={loading || isSaving}
              onToggle={toggleTopic}
            />
            <ChoiceFieldset
              legend="学習の難易度"
              options={DIFFICULTY_OPTIONS}
              value={draftSettings.difficulty}
              disabled={loading || isSaving}
              onChange={(difficulty) => updateDraftSettings({ difficulty })}
            />

            <ChoiceFieldset
              legend="回答の詳しさ"
              options={ANSWER_DETAIL_OPTIONS}
              value={draftSettings.answerDetail}
              disabled={loading || isSaving}
              onChange={(answerDetail) => updateDraftSettings({ answerDetail })}
            />

            <LearningReviewIntervalFieldset
              value={draftSettings.learningReviewEvery}
              disabled={loading || isSaving}
              onChange={(learningReviewEvery) =>
                updateDraftSettings({ learningReviewEvery })
              }
            />

            {(saveError || saveSucceeded) && (
              <p
                className={clsx(
                  "text-sm",
                  saveError ? "text-destructive" : "text-quest-success",
                )}
                role={saveError ? "alert" : "status"}
              >
                {saveError ?? "設定を保存しました。"}
              </p>
            )}
          </div>

          <div className={clsx(
            "flex justify-end gap-2 border-t border-quest-card-line bg-quest-settings-footer-bg px-6",
            "py-4",
            "max-[520px]:px-4",
          )}>
            <Button
              type="button"
              variant="questOutline"
              disabled={isSaving}
              onClick={() => onOpenChange(false)}
            >
              閉じる
            </Button>
            <Button
              type="submit"
              variant="questPrimary"
              disabled={loading || isSaving}
            >
              {isSaving ? "保存中…" : "設定を保存"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
