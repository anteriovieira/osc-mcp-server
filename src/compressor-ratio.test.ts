import { test } from "node:test";
import assert from "node:assert/strict";
import {
    indexToRatio,
    parseRatioOscValue,
    ratioToIndex,
} from "./compressor-ratio.js";

test("ratioToIndex maps display ratios to X-Air indices", () => {
    assert.equal(ratioToIndex(1.3), 1);
    assert.equal(ratioToIndex(3), 5);
    assert.equal(ratioToIndex(20), 10);
});

test("indexToRatio maps indices to display ratios", () => {
    assert.equal(indexToRatio(1), 1.3);
    assert.equal(indexToRatio(5), 3);
    assert.equal(indexToRatio(11), 100);
});

test("parseRatioOscValue accepts integer index from mixer", () => {
    assert.equal(parseRatioOscValue(1), 1.3);
    assert.equal(parseRatioOscValue(5), 3);
});

test("parseRatioOscValue accepts normalized float fallback", () => {
    assert.equal(parseRatioOscValue(5 / 11), 3);
});
