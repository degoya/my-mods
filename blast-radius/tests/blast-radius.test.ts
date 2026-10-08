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

// process.run's stdout for the rm measuring script: four files in ./build.
const RM_FILES = "4 73728 1\n./build/a.js\n./build/b.js\n./build/c.js\n./build/d.js\n";

// The world beneath a held command: cwd, a pane (placed or not), `sleep` as a
// wait on the mock clock, and every other process answered by `run(argv)`.
function heldRm(on: any, placed = true, run: (argv: readonly string[], init?: any) => string = () => RM_FILES) {
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
    return { value: { ...ok, stdout: run(e.argv, e.init) } };
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

  test("git reset --hard lists the files with uncommitted changes", async ($, on) => {
    const { clock, state } = heldRm(on, true, (argv) => {
      if (argv[1] === "status") return " M src/app.ts\nA  src/new.ts\n?? notes.txt\n";
      if (argv[1] === "diff") return " 2 files changed, 10 insertions(+), 3 deletions(-)\n";
      return "";
    });
    const call = $.tool.call({ tool: "Bash", command: "git reset --hard" } as any);
    await clock.settle();

    const ui = await $.ui.mount(PANE);
    expect(await ui.find({ type: "Text", text: /discard uncommitted changes in 2 files/ })).toBeDefined();
    expect(await ui.find({ type: "Text", text: /src\/app\.ts/ })).toBeDefined();
    expect(await ui.find({ type: "Text", text: /src\/new\.ts/ })).toBeDefined();
    expect(await ui.find({ type: "Text", text: /notes\.txt/ })).toBeUndefined(); // untracked: reset --hard keeps it
    expect(await ui.find({ type: "Text", text: /2 files changed/ })).toBeDefined();
    await ui.press({ key: "cancel" });
    await clock.advance(300);

    const result = (await call) as any;
    expect(result.deny).toMatch(/discard uncommitted changes in 2 files/);
    expect(state.ran).toBe(false);
    await ui.unmount();
  });

  test("git clean -fdx lists the untracked paths a dry run would remove", async ($, on) => {
    let dryRun: readonly string[] = [];
    const { clock, state } = heldRm(on, true, (argv) => {
      if (argv[1] !== "clean") return "";
      dryRun = argv;
      return "Would remove build/\nWould remove .env\nWould remove tmp/cache.bin\n";
    });
    const call = $.tool.call({ tool: "Bash", command: "git clean -fdx" } as any);
    await clock.settle();

    // Measured with the same flags minus -f, plus -n, so nothing is removed.
    expect(dryRun).toEqual(["git", "clean", "-n", "-dx", "--"]);
    const ui = await $.ui.mount(PANE);
    expect(await ui.find({ type: "Text", text: /remove 3 untracked paths/ })).toBeDefined();
    expect(await ui.find({ type: "Text", text: /build\// })).toBeDefined();
    expect(await ui.find({ type: "Text", text: /\.env/ })).toBeDefined();
    expect(await ui.find({ type: "Text", text: /tmp\/cache\.bin/ })).toBeDefined();
    expect(await ui.find({ type: "Text", text: /can't be recovered/ })).toBeDefined();
    await ui.press({ key: "cancel" });
    await clock.advance(300);

    const result = (await call) as any;
    expect(result.deny).toMatch(/remove 3 untracked paths/);
    expect(state.ran).toBe(false);
    await ui.unmount();
  });

  test("git push --force lists the remote commits the push would drop", async ($, on) => {
    let logRange = "";
    const { clock, state } = heldRm(on, true, (argv) => {
      if (argv[1] === "rev-parse" && argv[2] === "--abbrev-ref") return "main\n";
      if (argv[1] === "rev-parse") return ""; // --verify origin/main: known
      if (argv[1] === "log") {
        logRange = argv[argv.length - 1];
        return "a1b2c3d Fix login redirect\n9f8e7d6 Bump deps\n";
      }
      return "";
    });
    const call = $.tool.call({ tool: "Bash", command: "git push --force" } as any);
    await clock.settle();

    expect(logRange).toBe("HEAD..origin/main");
    const ui = await $.ui.mount(PANE);
    expect(await ui.find({ type: "Text", text: /force-push to origin\/main: drops 2 commits/ })).toBeDefined();
    expect(await ui.find({ type: "Text", text: /a1b2c3d Fix login redirect/ })).toBeDefined();
    expect(await ui.find({ type: "Text", text: /9f8e7d6 Bump deps/ })).toBeDefined();
    await ui.press({ key: "cancel" });
    await clock.advance(300);

    const result = (await call) as any;
    expect(result.deny).toMatch(/drops 2 commits/);
    expect(state.ran).toBe(false);
    await ui.unmount();
  });

  test("a cd earlier on the line moves where rm is measured", async ($, on) => {
    const seen: { resolve?: { arg: string; cwd?: string }; measure?: { cwd?: string } } = {};
    const { clock, state } = heldRm(on, true, (argv, init) => {
      if (argv[2]?.includes("pwd -P")) {
        seen.resolve = { arg: argv[4], cwd: init?.cwd };
        return "/work/sub\n";
      }
      seen.measure = { cwd: init?.cwd };
      return RM_FILES;
    });
    const call = $.tool.call({ tool: "Bash", command: "cd sub && rm -rf build" } as any);
    await clock.settle();

    // The cd target is resolved from the session folder, then rm is measured there.
    expect(seen.resolve).toEqual({ arg: "sub", cwd: "/work" });
    expect(seen.measure).toEqual({ cwd: "/work/sub" });
    const ui = await $.ui.mount(PANE);
    expect(await ui.find({ type: "Text", text: /delete 4 files/ })).toBeDefined();
    await ui.press({ key: "cancel" });
    await clock.advance(300);

    const result = (await call) as any;
    expect(result.deny).toMatch(/the user pressed Cancel/);
    expect(state.ran).toBe(false);
    await ui.unmount();
  });

  test("a risky command quoted inside another is not held", async ($, on) => {
    const { state } = heldRm(on);
    for (const command of [
      'git commit -m "test: cd sub && rm -rf build moves the cwd"',
      "git commit -m 'rm -rf build; git clean -fdx'",
      'echo "git push --force | rm -rf /"',
      "echo '$(rm -rf build)'", // single quotes: no substitution
      "echo x # rm -rf build", // commented out
      "echo $'rm -rf build; x'", // ANSI-C quoted text
    ]) {
      state.ran = false;
      const result = (await $.tool.call({ tool: "Bash", command } as any)) as any;
      expect(result.deny).toBeUndefined();
      expect(state.ran).toBe(true);
    }
  });

  test("a substitution inside double quotes still runs, so it is still held", async ($, on) => {
    const { clock, state } = heldRm(on);
    for (const command of [
      'echo "$(cd sub && rm -rf build)"',
      'echo "`rm -rf build; true`"',
      'echo "$(true)" && rm -rf build',
      'echo "$(echo "(x)")" && rm -rf build',
      'echo "odd quote && rm -rf build', // unterminated: fail closed
      'echo "$(case x in x) rm -rf build;; esac)"', // a paren counter misreads case: fail closed
      "diff <(rm -rf build) x", // process substitution
      'echo "$(echo "(x)") || rm -rf build"', // quoted text, but a substitution is on the line: fail closed
      "echo \"it's\" $(rm -rf build) 'x'", // an apostrophe in double quotes doesn't start a single quote
      'echo x # "\nrm -rf build # "', // a quote in a comment is no quote
      'echo x;# "\nrm -rf build;# "', // a comment can follow an operator without a space
      '(# "\nrm -rf build) # "', // or an opening paren
      "echo a\\ #; rm -rf build", // an escaped space: the # is text, the ; is real
      "echo ${x:- #} ; rm -rf build", // # inside ${ } is text
      "(( 1 #)) ; rm -rf build", // # inside (( )) is text
      "echo $'a\\'b' && rm -rf build # '", // $'…' escapes the quote with a backslash
      'cat <<EOF\n"\nEOF\nrm -rf build\ncat <<EOF\n"\nEOF', // heredoc bodies aren't lexed: fail closed
    ]) {
      state.ran = false;
      const call = $.tool.call({ tool: "Bash", command } as any);
      await clock.settle();
      const ui = await $.ui.mount(PANE);
      expect(await ui.find({ type: "Text", text: /Blast Radius/ })).toBeDefined();
      await ui.press({ key: "cancel" });
      await clock.advance(300);
      const result = (await call) as any;
      expect(result.deny).toMatch(/the user pressed Cancel/);
      expect(state.ran).toBe(false);
      await ui.unmount();
    }
  });
});
