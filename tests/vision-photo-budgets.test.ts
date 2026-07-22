import { describe, expect, it } from "vitest";
import {
  descendingPhotoBudgets,
  selectVisionPhotos,
} from "../src/infrastructure/ai/vision-photo-utils.js";

describe("descendingPhotoBudgets", () => {
  it("returns descending counts down to 1", () => {
    expect(descendingPhotoBudgets(6)).toEqual([6, 5, 4, 3, 2, 1]);
    expect(descendingPhotoBudgets(1)).toEqual([1]);
    expect(descendingPhotoBudgets(0)).toEqual([0]);
  });
});

describe("selectVisionPhotos", () => {
  it("takes the first N photos in order", () => {
    const photos = ["a", "b", "c", "d"];

    expect(selectVisionPhotos(photos, 4)).toEqual(["a", "b", "c", "d"]);
    expect(selectVisionPhotos(photos, 2)).toEqual(["a", "b"]);
    expect(selectVisionPhotos(photos, 1)).toEqual(["a"]);
  });
});
