import { test } from "node:test";
import assert from "node:assert/strict";
import {
    buildPresetChanges,
    getPreset,
    listPresetIds,
} from "./presets.js";

test("listPresetIds returns all presets", () => {
    assert.deepEqual(listPresetIds(), [
        "vocal",
        "bass",
        "acoustic-guitar",
        "electric-guitar-forro",
        "percussion",
    ]);
});

test("getPreset resolves known presets", () => {
    assert.equal(getPreset("vocal").id, "vocal");
    assert.equal(getPreset("bass").hpf.frequencyHz, 40);
});

test("getPreset throws for unknown preset", () => {
    assert.throws(() => getPreset("unknown"), /Unknown preset/);
});

test("buildPresetChanges vocal preset includes HPF EQ comp and FX", () => {
    const preset = getPreset("vocal");
    const changes = buildPresetChanges(5, preset);
    const targets = changes.map((c) => c.target);

    assert.ok(targets.includes("ch05.hpf.on"));
    assert.ok(targets.includes("ch05.hpf.hz"));
    assert.ok(targets.includes("ch05.eq.on"));
    assert.ok(targets.includes("ch05.eq.band2.gain"));
    assert.ok(targets.includes("ch05.eq.band3.gain"));
    assert.ok(targets.includes("ch05.compressor.on"));
    assert.ok(targets.includes("ch05.fx1.send"));

    assert.equal(changes[0]!.target, "ch05.hpf.on");
    assert.equal(changes[changes.length - 1]!.target, "ch05.fx1.send");
});

test("buildPresetChanges does not mark changes as applied", () => {
    const changes = buildPresetChanges(1, getPreset("bass"));
    assert.ok(changes.length > 0);
    assert.ok(changes.every((c) => c.applied === undefined));
});
