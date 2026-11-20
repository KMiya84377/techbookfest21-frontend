import { CheckIcon } from "lucide-react";
import { clsx } from "cn";
import { Button } from "../ui/button";
import {
  DEFAULT_LEARNING_REVIEW_EVERY,
  LEARNING_TOPICS,
  MAX_LEARNING_REVIEW_EVERY,
  MIN_LEARNING_REVIEW_EVERY,
  type UserSettings,
} from "../../lib/userSettings/model";

// 選択中のボタンの色
const SELECTED_CLASS = "border-quest-brown bg-quest-selected-bg";

// 説明つきの選択肢から 1 つを選ぶ欄(難易度、回答の詳しさ)
export function ChoiceFieldset<T extends string>({
  legend,
  options,
  value,
  disabled,
  onChange,
}: {
  legend: string;
  options: readonly { id: T; label: string; description: string }[];
  value: T;
  disabled: boolean;
  onChange: (value: T) => void;
}) {
  return (
    <fieldset disabled={disabled}>
      <legend className="text-sm font-semibold">{legend}</legend>
      <div className="mt-3 grid grid-cols-3 gap-2 max-[420px]:grid-cols-1">
        {options.map((option) => {
          const selected = value === option.id;
          return (
            <Button
              key={option.id}
              type="button"
              variant="questOutline"
              aria-pressed={selected}
              className={clsx(
                "h-auto min-h-[58px] flex-col items-start whitespace-normal px-3 py-2",
                selected && SELECTED_CLASS,
              )}
              onClick={() => onChange(option.id)}
            >
              <span className="font-semibold">{option.label}</span>
              <span className="text-xs font-normal text-quest-card-muted">
                {option.description}
              </span>
            </Button>
          );
        })}
      </div>
    </fieldset>
  );
}

export function LearningTopicsFieldset({
  topics,
  disabled,
  onToggle,
}: {
  topics: UserSettings["learningTopics"];
  disabled: boolean;
  onToggle: (topicId: UserSettings["learningTopics"][number]) => void;
}) {
  return (
    <fieldset disabled={disabled}>
      <legend className="text-sm font-semibold">学びたい分野</legend>
      <p className="mt-1 text-xs leading-relaxed text-quest-card-muted">
        何も選ばない場合は、AWS全般を対象にします。
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {LEARNING_TOPICS.map((topic) => {
          const selected = topics.includes(topic.id);
          return (
            <Button
              key={topic.id}
              type="button"
              variant="questOutline"
              size="sm"
              aria-pressed={selected}
              className={selected ? SELECTED_CLASS : ""}
              onClick={() => onToggle(topic.id)}
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
  );
}

export function LearningReviewIntervalFieldset({
  value,
  disabled,
  onChange,
}: {
  value: number;
  disabled: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <fieldset disabled={disabled}>
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
            Number.isFinite(value)
              ? value
              : ""
          }
          onChange={(event) => {
            onChange(event.currentTarget.valueAsNumber);
          }}
          className="w-24 rounded border border-quest-frame bg-white px-3 py-2 text-sm"
        />
        <span className="text-sm">件ごと</span>
      </div>
      <p
        id="learning-review-help"
        className="mt-2 text-xs leading-relaxed text-quest-card-muted"
      >
        学習したニュースのつながりを分析して図解を提案します。
        {MIN_LEARNING_REVIEW_EVERY}〜{MAX_LEARNING_REVIEW_EVERY}
        件で設定できます（初期値：{DEFAULT_LEARNING_REVIEW_EVERY}件）。
        少なくすると分析の頻度が上がります。
      </p>
    </fieldset>
  );
}
