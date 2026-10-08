import { describe, expect, test } from "claude-code/testing";

const props = { hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns: 120 };

describe("blast-radius", () => {
  test("a harmless command is not held", async ($, on) => {
    let ran = false;
    on("tool.call", { tool: "Bash" }, () => {
      ran = true;
      return { result: { stdout: "ok", stderr: "", interrupted: false } } as any;
    });
    await $.tool.call({ tool: "Bash", command: "ls -la" } as any);
    expect(ran).toBe(true);
  });

  test("the band stays quiet with nothing held", async ($, on) => {
    on("ui.render", ($, e) => $.ui.resolve(e).Text({ children: "base" }));
    const ui = await $.ui.mount({ plugin: "blast-radius", surface: "terminal", component: "AbovePrompt", props } as any);
    expect(await ui.find({ type: "Text", text: /Blast Radius/ })).toBeUndefined();
    expect(await ui.find({ type: "Text", text: /base/ })).toBeDefined();
    await ui.unmount();
  });
});
