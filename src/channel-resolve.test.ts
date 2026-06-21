import { test } from "node:test";
import assert from "node:assert/strict";
import {
    buildNameIndex,
    resolveChannelRef,
    resolveChannelRefs,
} from "./channel-resolve.js";

const sampleIndex = buildNameIndex({
    1: "Bass",
    2: "Perc",
    3: "Guitar",
    4: "Acc1",
    5: "Vocals",
    6: "Acc2",
});

test("resolveChannelRef accepts channel numbers", () => {
    assert.equal(resolveChannelRef(5, sampleIndex), 5);
});

test("resolveChannelRef accepts numeric strings", () => {
    assert.equal(resolveChannelRef("5", sampleIndex), 5);
});

test("resolveChannelRef matches names case-insensitively", () => {
    assert.equal(resolveChannelRef("vocals", sampleIndex), 5);
    assert.equal(resolveChannelRef("VOCALS", sampleIndex), 5);
});

test("resolveChannelRef uses unique partial match", () => {
    assert.equal(resolveChannelRef("Gui", sampleIndex), 3);
});

test("resolveChannelRef throws on ambiguous partial name", () => {
    assert.throws(
        () => resolveChannelRef("Acc", buildNameIndex({ 4: "Acc1", 6: "Acc2" })),
        /Ambiguous channel name/
    );
});

test("resolveChannelRef throws on missing name with hint", () => {
    assert.throws(
        () => resolveChannelRef("Drums", sampleIndex),
        /Channel "Drums" not found/
    );
});

test("resolveChannelRefs deduplicates channels", () => {
    assert.deepEqual(
        resolveChannelRefs([5, "Vocals", "5"], sampleIndex),
        [5]
    );
});
