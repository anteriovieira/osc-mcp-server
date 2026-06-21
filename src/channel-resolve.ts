import type { OSCClient } from "./osc-client.js";

export interface ChannelNameIndex {
    /** channel number -> display name */
    names: Record<number, string>;
    /** lowercased trimmed name -> channel number (exact match) */
    exact: Map<string, number>;
}

export function buildNameIndex(names: Record<number, string>): ChannelNameIndex {
    const exact = new Map<string, number>();
    for (const [chStr, name] of Object.entries(names)) {
        const ch = Number(chStr);
        const key = name.trim().toLowerCase();
        if (key) {
            exact.set(key, ch);
        }
    }
    return { names, exact };
}

export function formatAvailableNames(index: ChannelNameIndex): string {
    return Object.entries(index.names)
        .filter(([, name]) => name.trim())
        .map(([ch, name]) => `ch${ch}="${name}"`)
        .join(", ");
}

export function resolveChannelRef(
    ref: number | string,
    index: ChannelNameIndex
): number {
    if (typeof ref === "number") {
        if (ref < 1 || ref > 16 || !Number.isInteger(ref)) {
            throw new Error("Channel must be an integer 1-16");
        }
        return ref;
    }

    const trimmed = ref.trim();
    if (!trimmed) {
        throw new Error("Channel reference cannot be empty");
    }

    const asNumber = Number(trimmed);
    if (/^\d+$/.test(trimmed) && asNumber >= 1 && asNumber <= 16) {
        return asNumber;
    }

    const lower = trimmed.toLowerCase();
    const exact = index.exact.get(lower);
    if (exact !== undefined) {
        return exact;
    }

    const startsWith: number[] = [];
    const contains: number[] = [];
    for (const [chStr, name] of Object.entries(index.names)) {
        const ch = Number(chStr);
        const nameLower = name.trim().toLowerCase();
        if (!nameLower) continue;
        if (nameLower.startsWith(lower)) startsWith.push(ch);
        else if (nameLower.includes(lower)) contains.push(ch);
    }

    if (startsWith.length === 1) return startsWith[0]!;
    if (startsWith.length > 1) {
        throw new Error(
            `Ambiguous channel name "${ref}" (matches: ${startsWith.map((c) => `ch${c}`).join(", ")}). Available: ${formatAvailableNames(index)}`
        );
    }

    if (contains.length === 1) return contains[0]!;
    if (contains.length > 1) {
        throw new Error(
            `Ambiguous channel name "${ref}" (matches: ${contains.map((c) => `ch${c}`).join(", ")}). Available: ${formatAvailableNames(index)}`
        );
    }

    throw new Error(
        `Channel "${ref}" not found. Available: ${formatAvailableNames(index) || "(no named channels)"}`
    );
}

export function resolveChannelRefs(
    refs: (number | string)[],
    index: ChannelNameIndex
): number[] {
    const seen = new Set<number>();
    const resolved: number[] = [];
    for (const ref of refs) {
        const ch = resolveChannelRef(ref, index);
        if (!seen.has(ch)) {
            seen.add(ch);
            resolved.push(ch);
        }
    }
    return resolved;
}

export async function fetchChannelNameIndex(
    client: OSCClient
): Promise<ChannelNameIndex> {
    const overview = await client.getMixerOverview({ includeChannels: true });
    const names: Record<number, string> = {};
    for (const ch of overview.channels ?? []) {
        names[ch.ch] = ch.name;
    }
    return buildNameIndex(names);
}
