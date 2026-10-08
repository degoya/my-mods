import { describe, expect, mock, test } from "claude-code/testing";

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

// The world beneath a held rm -rf: cwd, a placed pane, and process.run answering
// the measuring script with four files, and `sleep` with a wait on the mock clock.
function heldRm(on: any, placed = true) {
  const clock = mock.clock(on);
  const state = { ran: false };
  on("tool.call", { tool: "Bash" }, () => {
    state.ran = true;
    return { result: { stdout: "", stderr: "", interrupted: false } } as any;
  });
  on("session.cwd", () => ({ value: "/work" }));
  on("ui.open", () => ({ value: placed ? { isPlaced: true } : { isPlaced: false, reason: "narrow" } }));
  on("ui.close", () => ({ value: undefined }));
  on("ui.invalidate", () => ({ value: undefined }));
  on("ui.toast", () => ({ value: undefined }));
  on("process.run", async ($: any, e: any) => {
    const ok = { exitCode: 0, stderr: "", isStdoutTruncated: false, isStderrTruncated: false };
    if (e.argv[0] === "sleep") {
      await clock.sleep(250);
      return { value: { ...ok, stdout: "" } };
    }
    return { value: { ...ok, stdout: "4 73728 1\n./build/a.js\n./build/b.js\n./build/c.js\n./build/d.js\n" } };
  });
  return { clock, state };
}

const PANE = {
  plugin: "blast-radius",
  surface: "terminal",
  component: "Pane",
  requestId: "blast-radius",
  props: { title: "Blast Radius", isFocused: true, bodyColumns: 80, placement: "dock" },
} as any;

describe("blast-radius holds", () => {
  test("rm -rf is held and Cancel refuses it", async ($, on) => {
    const { clock, state } = heldRm(on);
    const call = $.tool.call({ tool: "Bash", command: "rm -rf build" } as any);
    await clock.settle();

    const ui = await $.ui.mount(PANE);
    expect(await ui.find({ type: "Text", text: /delete 4 files/ })).toBeDefined();
    await ui.press({ key: "cancel" });
    await clock.advance(300);

    const result = (await call) as any;
    expect(result.deny).toMatch(/the user pressed Cancel/);
    expect(result.deny).toMatch(/delete 4 files/);
    expect(state.ran).toBe(false);
    await ui.unmount();
  });

  test("rm -rf is held and Proceed runs it", async ($, on) => {
    const { clock, state } = heldRm(on);
    const call = $.tool.call({ tool: "Bash", command: "rm -rf build" } as any);
    await clock.settle();

    const ui = await $.ui.mount(PANE);
    expect(await ui.find({ type: "Text", text: /delete 4 files/ })).toBeDefined();
    await ui.press({ key: "proceed" });
    await clock.advance(300);

    const result = (await call) as any;
    expect(result.deny).toBeUndefined();
    expect(state.ran).toBe(true);
    await ui.unmount();
  });

  test("with no room for a pane the report is drawn above the prompt", async ($, on) => {
    const { clock, state } = heldRm(on, false);
    const call = $.tool.call({ tool: "Bash", command: "rm -rf build" } as any);
    await clock.settle();

    const ui = await $.ui.mount({
      plugin: "blast-radius",
      surface: "terminal",
      component: "AbovePrompt",
      props: { hasSurvey: false, isWorking: true, maxRows: 20, bodyColumns: 120 },
    } as any);
    expect(await ui.find({ type: "Text", text: /Blast Radius/ })).toBeDefined();
    expect(await ui.find({ type: "Text", text: /delete 4 files/ })).toBeDefined();
    await ui.press({ key: "cancel" });
    await clock.advance(300);

    const result = (await call) as any;
    expect(result.deny).toMatch(/the user pressed Cancel/);
    expect(state.ran).toBe(false);
    await ui.unmount();
  });
});
