import { describe, expect, it } from "vitest";
import { parseBodyTypeResponse } from "../src/infrastructure/ai/body-response-parser.js";

describe("parseBodyTypeResponse", () => {
  it("parses explicit labels", () => {
    expect(parseBodyTypeResponse("PASS")).toBe("pass");
    expect(parseBodyTypeResponse("FAIL")).toBe("fail");
  });

  it("does not match FAIL inside other words", () => {
    expect(parseBodyTypeResponse("PASS - not overweight")).toBe("pass");
  });

  it("defaults to pass when unparseable", () => {
    expect(parseBodyTypeResponse("uncertain")).toBe("pass");
    expect(parseBodyTypeResponse("")).toBe("pass");
  });
});
