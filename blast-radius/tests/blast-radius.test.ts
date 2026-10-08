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

describe("blast-radius holds", () => {
  test("rm -rf is held and Cancel refuses it", async ($, on) => {
    const clock = mock.clock(on);
    let ran = false;
    on("tool.call", { tool: "Bash" }, () => {
      ran = true;
      return { result: { stdout: "", stderr: "", interrupted: false } } as any;
    });
    on("session.cwd", () => ({ value: "/work" }));
    on("ui.open", () => ({ value: { isPlaced: true } }));
    on("ui.close", () => ({ value: undefined }));
    on("ui.invalidate", () => ({ value: undefined }));
    on("ui.toast", () => ({ value: undefined }));
    on("process.run", async ($, e) => {
      const ok = { exitCode: 0, stderr: "", isStdoutTruncated: false, isStderrTruncated: false };
      if (e.argv[0] === "sleep") {
        await clock.sleep(250);
        return { value: { ...ok, stdout: "" } };
      }
      // The rm measuring script: "<files> <bytes> <paths>" then the file list.
      return { value: { ...ok, stdout: "4 73728 1\n./build/a.js\n./build/b.js\n./build/c.js\n./build/d.js\n" } };
    });

    const call = $.tool.call({ tool: "Bash", command: "rm -rf build" } as any);
    await clock.settle();

    const ui = await $.ui.mount({
      plugin: "blast-radius",
      surface: "terminal",
      component: "Pane",
      requestId: "blast-radius",
      props: { title: "Blast Radius", isFocused: true, bodyColumns: 80, placement: "dock" },
    } as any);
    expect(await ui.find({ type: "Text", text: /delete 4 files/ })).toBeDefined();
    await ui.press({ key: "cancel" });
    await clock.advance(300);

    const result = (await call) as any;
    expect(result.deny).toMatch(/the user pressed Cancel/);
    expect(result.deny).toMatch(/delete 4 files/);
    expect(ran).toBe(false);
    await ui.unmount();
  });
});
