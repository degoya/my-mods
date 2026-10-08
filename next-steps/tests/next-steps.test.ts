import { describe, expect, test } from "claude-code/testing";

const props = { hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns: 120 };

describe("next-steps", () => {
  test("a short answer draws no suggestions", async ($, on) => {
    on("turn.complete", () => ({ text: "" }));
    on("ui.render", ($, e) => $.ui.resolve(e).Text({ children: "base" }));
    await $.turn.complete({ turnId: "t1", reason: "answer", answer: "ok", durationMs: 1 } as any);
    const ui = await $.ui.mount({ plugin: "next-steps", surface: "terminal", component: "AbovePrompt", props } as any);
    expect(await ui.find({ type: "Text", text: /next/ })).toBeUndefined();
    expect(await ui.find({ type: "Text", text: /base/ })).toBeDefined();
    await ui.unmount();
  });
});
