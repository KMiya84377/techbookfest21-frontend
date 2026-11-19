import assert from "node:assert/strict";
import test from "node:test";
import { Children, createElement, isValidElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Toggle } from "@base-ui/react/toggle";
import { ToggleGroup } from "@base-ui/react/toggle-group";
import OptionButtons from "../src/components/human-in-the-loop/OptionButtons";

const options = [
  { id: "a", label: "選択肢A", description: "Aの補足" },
  { id: "b", label: "選択肢B" },
];

test("選択管理をBase UIに委ね、単一・複数選択と解除結果をそのまま親へ返す", () => {
  for (const selectionMode of ["single", "multiple"] as const) {
    let received: string[] | undefined;
    const tree = OptionButtons({
      options,
      selectionMode,
      selectedIds: ["a"],
      onSelectionChange: (ids) => {
        received = ids;
      },
    });
    assert.equal(tree.type, ToggleGroup);
    assert.equal(tree.props.multiple, selectionMode === "multiple");
    assert.equal(tree.props.orientation, "vertical");
    assert.deepEqual(tree.props.value, ["a"]);
    tree.props.onValueChange([]);
    assert.deepEqual(received, []);
    const children = Children.toArray(tree.props.children);
    assert.equal(children.length, options.length);
    for (const [index, child] of children.entries()) {
      assert.ok(isValidElement<{ value: string }>(child));
      assert.equal(child.type, Toggle);
      assert.equal(child.props.value, options[index].id);
    }
  }
});

test("選択済み・未選択・説明を正しいボタンとして出力し、ボタンを入れ子にしない", () => {
  const html = renderToStaticMarkup(
    createElement(OptionButtons, {
      options,
      selectionMode: "single",
      selectedIds: ["a"],
      onSelectionChange: () => {},
    }),
  );
  assert.equal((html.match(/<button\b/g) ?? []).length, 2);
  assert.match(html, /aria-pressed="true"/);
  assert.match(html, /aria-pressed="false"/);
  assert.match(html, /選択肢（単一選択）/);
  assert.match(html, /Aの補足/);
  assert.doesNotMatch(
    html,
    /<button\b[^>]*>(?:(?!<\/button>)[\s\S])*<button\b/,
  );
});

test("回答済み・送信中は全選択肢を無効化する", () => {
  const html = renderToStaticMarkup(
    createElement(OptionButtons, {
      options,
      selectionMode: "multiple",
      selectedIds: ["a", "b"],
      onSelectionChange: () => {},
      disabled: true,
    }),
  );
  assert.match(html, /選択肢（複数選択）/);
  assert.equal((html.match(/<button\b[^>]*\sdisabled=""/g) ?? []).length, 2);
  assert.equal((html.match(/aria-pressed="true"/g) ?? []).length, 2);
});
