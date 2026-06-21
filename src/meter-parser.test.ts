import { test } from "node:test";
import assert from "node:assert/strict";
import {
    parseMeterBlob,
    rawToDb,
    labelMeterValues,
    summarizeChannelLevels,
    buildMeterPacket,
    METERS_1_LABELS,
    METERS_2_LABELS,
} from "./meter-parser.js";

test("rawToDb converts 1/256 dB resolution", () => {
    assert.equal(rawToDb(-7680), -30);
    assert.equal(rawToDb(-5120), -20);
    assert.equal(rawToDb(0), 0);
    assert.equal(rawToDb(2560), 10);
});

test("parseMeterBlob decodes XR18 OSC blob format", () => {
    const full = buildMeterPacket("1", [
        -7680,
        -5120,
        256,
        ...Array.from({ length: 37 }, () => -8192),
    ]);
    const result = parseMeterBlob(full);
    assert.ok(result);
    assert.equal(result!.meterId, "1");
    assert.equal(result!.valuesDb.length, 40);
    assert.equal(result!.valuesDb[0], -30);
    assert.equal(result!.valuesDb[1], -20);
    assert.equal(result!.valuesDb[2], 1);
});

test("parseMeterBlob rejects misaligned ,b tag as meter data", () => {
    // Old bug: reading LE int16 at type tag produced ~98 dB
    const buf = Buffer.from("meters/1\0\0\0\0,b\0\0", "ascii");
    assert.equal(parseMeterBlob(buf), null);
});

test("parseMeterBlob handles meters/2 packets", () => {
    const packet = buildMeterPacket(
        "2",
        Array.from({ length: 36 }, () => -8192)
    );
    const result = parseMeterBlob(packet);
    assert.ok(result);
    assert.equal(result!.meterId, "2");
    assert.equal(result!.valuesDb.length, 36);
    assert.equal(result!.valuesDb[0], -32);
});

test("labelMeterValues maps /meters/1 indices to channel labels", () => {
    const values = Array(METERS_1_LABELS.length).fill(-20);
    const labeled = labelMeterValues("1", values);
    assert.equal(labeled.ch01, -20);
    assert.equal(labeled.mainL, -20);
    assert.equal(labeled.monR, -20);
    assert.equal(labeled.idx40, undefined);
});

test("labelMeterValues maps /meters/2 input labels", () => {
    const values = Array(METERS_2_LABELS.length).fill(-40);
    const labeled = labelMeterValues("2", values);
    assert.equal(labeled.input01, -40);
    assert.equal(labeled.usb18, -40);
});

test("summarizeChannelLevels finds hot and silent channels", () => {
    const input = {
        input01: -3,
        input02: -70,
        input03: -20,
    };
    const mix = {
        ch01: -4,
        ch02: -80,
        ch03: -10,
    };
    const { hotChannels, silentChannels } = summarizeChannelLevels(input, mix);
    assert.deepEqual(hotChannels, [1]);
    assert.deepEqual(silentChannels, [2]);
});
