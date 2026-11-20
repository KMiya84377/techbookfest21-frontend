type Dependencies = readonly unknown[];
interface Slot {
  value?: unknown;
  dependencies?: Dependencies;
  cleanup?: () => void;
}

// Reactやブラウザーの再現ではなく、フック内の状態・通信処理を検証するための差し替え。
export function hookHarness() {
  const slots: Slot[] = [];
  let cursor = 0;
  let effects: (() => void)[] = [];
  let updates = 0;
  const nextSlot = () => (slots[cursor++] ??= {});
  const sameDependencies = (previous: Dependencies | undefined, next: Dependencies) =>
    previous?.length === next.length && previous.every((value, i) => Object.is(value, next[i]));
  return {
    react: {
      useState(initial: unknown) {
        const slot = nextSlot();
        if (!("value" in slot)) slot.value = initial;
        return [slot.value, (next: unknown) => {
          updates++;
          slot.value = typeof next === "function" ? next(slot.value) : next;
        }];
      },
      useRef(initial: unknown) {
        const slot = nextSlot();
        if (!("value" in slot)) slot.value = { current: initial };
        return slot.value;
      },
      useCallback(callback: unknown, dependencies: Dependencies) {
        const slot = nextSlot();
        if (!sameDependencies(slot.dependencies, dependencies)) {
          slot.value = callback;
          slot.dependencies = dependencies;
        }
        return slot.value;
      },
      useEffect(effect: () => (() => void) | undefined, dependencies: Dependencies) {
        const slot = nextSlot();
        if (!sameDependencies(slot.dependencies, dependencies)) {
          slot.dependencies = dependencies;
          effects.push(() => {
            slot.cleanup?.();
            slot.cleanup = effect();
          });
        }
      },
    },
    render<T>(renderHook: () => T): T {
      cursor = 0;
      effects = [];
      const value = renderHook();
      for (const effect of effects) effect();
      return value;
    },
    unmount() {
      for (const slot of slots) slot.cleanup?.();
    },
    get updates() { return updates; },
  };
}
