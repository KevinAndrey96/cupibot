import { describe, expect, it } from "vitest";
import {
  EXTRACT_TIME_LABEL_SCRIPT,
  wrapDomEvaluateScript,
} from "../src/infrastructure/browser/chat-timestamp.js";

describe("wrapDomEvaluateScript", () => {
  it("produces valid javascript for page.evaluate", () => {
    const script = wrapDomEvaluateScript("return [{ sender: 'me', content: 'hola', timeLabel: null }];");

    expect(() => {
      // eslint-disable-next-line no-new-func
      new Function(script);
    }).not.toThrow();

    expect(script).toContain(EXTRACT_TIME_LABEL_SCRIPT);
    expect(script).toContain("return [{ sender: 'me', content: 'hola', timeLabel: null }];");
  });
});
