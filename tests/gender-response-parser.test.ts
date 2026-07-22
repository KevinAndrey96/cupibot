import { describe, expect, it } from "vitest";
import { parseGenderResponse } from "../src/infrastructure/ai/gender-response-parser.js";

const REJECT_LABELS = ["MALE", "TRANS"] as const;

describe("parseGenderResponse", () => {
  it("parses FEMALE without matching the MALE substring", () => {
    expect(parseGenderResponse("FEMALE", REJECT_LABELS)).toBe("female");
    expect(parseGenderResponse("female", REJECT_LABELS)).toBe("female");
    expect(parseGenderResponse("Answer: FEMALE", REJECT_LABELS)).toBe("female");
  });

  it("parses explicit reject labels", () => {
    expect(parseGenderResponse("MALE", REJECT_LABELS)).toBe("male");
    expect(parseGenderResponse("TRANS", REJECT_LABELS)).toBe("trans");
  });

  it("defaults to male when response is unparseable", () => {
    expect(parseGenderResponse("", REJECT_LABELS)).toBe("male");
    expect(parseGenderResponse("uncertain", REJECT_LABELS)).toBe("male");
  });
});
