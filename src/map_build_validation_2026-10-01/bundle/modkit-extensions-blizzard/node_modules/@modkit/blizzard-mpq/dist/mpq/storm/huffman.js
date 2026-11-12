/**
 * Storm's adaptive Huffman code — MPQ compression mask 0x01, which Warcraft III and Diablo II
 * apply to sounds after ADPCM.
 *
 * A stream opens with one byte naming the weight table (0–8) the tree starts from. Bits follow,
 * least significant first; each symbol walks the tree from the root, a 1 bit taking the heavier
 * child. Symbol 0x100 ends the stream; 0x101 says the next 8 bits are a byte the tree lacks, which
 * becomes a new branch off the lightest leaf. Weights then grow along the decoded leaf's path and
 * the tree is rebalanced so every node's heavier child keeps its place: after every byte for
 * table 0, after each new byte otherwise.
 *
 * The tree lives in a list sorted by weight, heaviest first, with each node's heavier child the
 * list neighbour just before its lighter one — the arrangement the format's reference decoder
 * keeps, which the rebalancing depends on. The weight tables are the format's data.
 */
export const STORM_HUFFMAN_MALFORMED = 'blizzard/mpq-huffman-malformed';
function malformed(message) {
    const error = new RangeError(`MPQ Huffman stream ${message}`);
    Object.defineProperty(error, 'code', { value: STORM_HUFFMAN_MALFORMED, enumerable: true });
    return error;
}
/** The nine starting weight tables, 256 bytes each, as hexadecimal. */
const STORM_HUFFMAN_WEIGHTS_HEX = [
    '0a00000000000000000000000000000000000000000000000000000000000000' +
        '0000000000000000000000000000000000000000000000000000000000000000' +
        '0000000000000000000000000000000000000000000000000000000000000000' +
        '0000000000000000000000000000000000000000000000000000000000000000' +
        '0000000000000000000000000000000000000000000000000000000000000000' +
        '0000000000000000000000000000000000000000000000000000000000000000' +
        '0000000000000000000000000000000000000000000000000000000000000000' +
        '0000000000000000000000000000000000000000000000000000000000000002',
    '5416160d0c08060506050603040403050e0b141313090b060504030203020202' +
        '0d07090606040302040303030303020209060404040403020302020202030204' +
        '0803040709050303030302020203020203020202020202020201010102010202' +
        '060a080806070403040402020402030304030707090604030302010202020202' +
        '0a02020302020101020202060305020302010101010101010101010203010101' +
        '02010101010101020404040709080c0201010101010101010101010102010103' +
        '0401020405010101010101010201010104010101010102010101010101010101' +
        '020101010101010103010101010101010201010101010102020101020202064b',
    '0000000000000000000327000023000000000000000000000000000000000000' +
        'ff0101010101010102020101060e100406080504040303020203030101020101' +
        '0104020402020201010401010203030203010306040101010101010201020101' +
        '0129071612400a0a112501031710262a100123232f1006070209010101010100' +
        '0000000000000000000000000000000000000000000000000000000000000000' +
        '0000000000000000000000000000000000000000000000000000000000000000' +
        '0000000000000000000000000000000000000000000000000000000000000000' +
        '0000000000000000000000000000000000000000000000000000000000000000',
    'ff0b07050b020202060202010402010309010101030401010201010102010101' +
        '050101010d010101010101010101010102010103010101010101010201010101' +
        '0a04020106030201010101010301010105020304030303020101010201020303' +
        '01030101020501010403050103010303020104030a0601010101010101010101' +
        '0202010a0205010102070217010501010e010101010101010101010101010101' +
        '0101010101010101010101010101010101010101010101010101010101010101' +
        '0602010405010102010101010201010101010101010101010101010101010101' +
        '0101010101010101070101020101010102010101010101010201010101010111',
    'fffb989a848563643e3e22221313181700000000000000000000000000000000' +
        '0000000000000000000000000000000000000000000000000000000000000000' +
        '0000000000000000000000000000000000000000000000000000000000000000' +
        '0000000000000000000000000000000000000000000000000000000000000000' +
        '0000000000000000000000000000000000000000000000000000000000000000' +
        '0000000000000000000000000000000000000000000000000000000000000000' +
        '0000000000000000000000000000000000000000000000000000000000000000' +
        '0000000000000000000000000000000000000000000000000000000000000000',
    'fff19d9e9a9b9a9793938c8e868880827c7c7273696b5f6055564a4b40413737' +
        '2f2f272721211b1c1717131310100d0d0b0b0909080807070605050404041918' +
        '0000000000000000000000000000000000000000000000000000000000000000' +
        '0000000000000000000000000000000000000000000000000000000000000000' +
        '0000000000000000000000000000000000000000000000000000000000000000' +
        '0000000000000000000000000000000000000000000000000000000000000000' +
        '0000000000000000000000000000000000000000000000000000000000000000' +
        '0000000000000000000000000000000000000000000000000000000000000000',
    'c3cbf541ff7bf721000000000000000000000000000000000000000000000000' +
        '0000000000000000000000000000000000000000000000000000000000000000' +
        'bfccf240fd7cf722000000000000000000000000000000000000000000000000' +
        '0000000000000000000000000000000000000000000000000000000000000000' +
        '7a46000000000000000000000000000000000000000000000000000000000000' +
        '0000000000000000000000000000000000000000000000000000000000000000' +
        '0000000000000000000000000000000000000000000000000000000000000000' +
        '0000000000000000000000000000000000000000000000000000000000000000',
    'c3d9ef3df97ce91efdabf12cfc5bfe1700000000000000000000000000000000' +
        '0000000000000000000000000000000000000000000000000000000000000000' +
        'bdd9ec3df57de81dfbaef02cfb5cff1800000000000000000000000000000000' +
        '0000000000000000000000000000000000000000000000000000000000000000' +
        '706c000000000000000000000000000000000000000000000000000000000000' +
        '0000000000000000000000000000000000000000000000000000000000000000' +
        '0000000000000000000000000000000000000000000000000000000000000000' +
        '0000000000000000000000000000000000000000000000000000000000000000',
    'bac5da33e36dd818e594da23df4ad110eeafe42cea5ade15f487e921f643fc12' +
        '0000000000000000000000000000000000000000000000000000000000000000' +
        'b0c7d833e36bd618e795d823db49d011e9b2e22be85cdd15f187e720f744ff13' +
        '0000000000000000000000000000000000000000000000000000000000000000' +
        '5f9e000000000000000000000000000000000000000000000000000000000000' +
        '0000000000000000000000000000000000000000000000000000000000000000' +
        '0000000000000000000000000000000000000000000000000000000000000000' +
        '0000000000000000000000000000000000000000000000000000000000000000',
];
const WEIGHTS = STORM_HUFFMAN_WEIGHTS_HEX.map(hex => Uint8Array.from({ length: 256 }, (_, index) => Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16)));
const END_OF_STREAM = 0x100;
const NEW_BYTE = 0x101;
/** 256 leaves, the two control symbols and every internal node the reference decoder allows. */
const MAX_ITEMS = 0x203;
class Tree {
    /** Sentinel: `head.next` is the heaviest item (the root), `head.prev` the lightest. */
    head = { value: -1, weight: 0, parent: undefined, childLo: undefined, next: undefined, prev: undefined };
    byValue = [];
    used = 0;
    constructor(table) {
        this.head.next = this.head;
        this.head.prev = this.head;
        let maxWeight = 0;
        for (let value = 0; value < 0x100; value += 1) {
            const weight = table[value] ?? 0;
            if (weight === 0)
                continue;
            const item = this.create(value, weight, true);
            this.byValue[value] = item;
            maxWeight = this.placeByWeight(item, maxWeight);
        }
        this.byValue[END_OF_STREAM] = this.create(END_OF_STREAM, 1, false);
        this.byValue[NEW_BYTE] = this.create(NEW_BYTE, 1, false);
        // Pair items from the lightest end; each parent is placed by its weight and paired in turn.
        let lighter = this.head.prev;
        while (lighter !== this.head) {
            const heavier = lighter.prev;
            if (heavier === this.head)
                break;
            const parent = this.create(0, heavier.weight + lighter.weight, true);
            lighter.parent = parent;
            heavier.parent = parent;
            parent.childLo = lighter;
            maxWeight = this.placeByWeight(parent, maxWeight);
            lighter = heavier.prev;
        }
    }
    create(value, weight, first) {
        if (this.used >= MAX_ITEMS)
            throw malformed('grows past the tree it may build');
        this.used += 1;
        const item = { value, weight, parent: undefined, childLo: undefined, next: undefined, prev: undefined };
        if (first)
            this.linkAfter(this.head, item);
        else {
            item.next = this.head;
            item.prev = this.head.prev;
            this.head.prev.next = item;
            this.head.prev = item;
        }
        return item;
    }
    unlink(item) {
        if (item.next === undefined)
            return;
        item.prev.next = item.next;
        item.next.prev = item.prev;
        item.next = undefined;
        item.prev = undefined;
    }
    linkAfter(anchor, item) {
        item.next = anchor.next;
        item.prev = anchor;
        anchor.next.prev = item;
        anchor.next = item;
    }
    /** The nearest item at or before `from` (towards the heavy end) weighing at least `weight`. */
    atLeast(from, weight) {
        for (let item = from; item !== undefined && item !== this.head; item = item.prev) {
            if (item.weight >= weight)
                return item;
        }
        return this.head;
    }
    /** Move a just-created item behind every item at least as heavy; returns the running maximum. */
    placeByWeight(item, maxWeight) {
        if (item.weight >= maxWeight)
            return item.weight;
        const heavier = this.atLeast(this.head.prev, item.weight);
        this.unlink(item);
        this.linkAfter(heavier, item);
        return maxWeight;
    }
    /** One more of `item`: its path's weights grow, and a node that now outweighs its place moves up. */
    increment(item) {
        for (; item !== undefined; item = item.parent) {
            item.weight += 1;
            const heavier = this.atLeast(item.prev, item.weight);
            const displaced = heavier.next;
            if (displaced === item)
                continue;
            this.unlink(displaced);
            this.linkAfter(item, displaced);
            this.unlink(item);
            this.linkAfter(heavier, item);
            const itemParent = item.parent;
            const displacedParent = displaced.parent;
            if (itemParent === undefined || displacedParent === undefined)
                throw malformed('rebalances its root');
            const displacedWasLighter = displacedParent.childLo === displaced;
            if (itemParent.childLo === item)
                itemParent.childLo = displaced;
            if (displacedWasLighter)
                displacedParent.childLo = item;
            item.parent = displacedParent;
            displaced.parent = itemParent;
        }
    }
    /** The lightest leaf splits: it keeps its byte on one side and gains `value` on the other. */
    addByte(value) {
        const lightest = this.head.prev;
        if (lightest === this.head)
            throw malformed('has no tree to grow');
        const kept = this.create(lightest.value, lightest.weight, false);
        kept.parent = lightest;
        this.byValue[lightest.value] = kept;
        const added = this.create(value, 0, false);
        added.parent = lightest;
        lightest.childLo = added;
        this.byValue[value] = added;
        this.increment(added);
    }
    leafOf(value) {
        return this.byValue[value];
    }
    root() {
        const root = this.head.next;
        if (root === this.head)
            throw malformed('has no tree');
        return root;
    }
}
/** Decode a Storm Huffman stream into at most `outputBytes` bytes. */
export function decompressStormHuffman(input, outputBytes) {
    if (!Number.isSafeInteger(outputBytes) || outputBytes < 0) {
        throw new TypeError('outputBytes must be a non-negative safe integer');
    }
    const output = new Uint8Array(outputBytes);
    if (outputBytes === 0)
        return output;
    let position = 0;
    let buffer = 0;
    let available = 0;
    const bit = () => {
        if (available === 0) {
            if (position >= input.byteLength)
                throw malformed('ends before its end code');
            buffer = input[position] ?? 0;
            position += 1;
            available = 8;
        }
        const value = buffer & 1;
        buffer >>= 1;
        available -= 1;
        return value;
    };
    const byte = () => {
        let value = 0;
        for (let index = 0; index < 8; index += 1)
            value |= bit() << index;
        return value;
    };
    const type = byte();
    const table = WEIGHTS[type & 0x0f];
    if ((type & 0x0f) > 8 || table === undefined)
        throw malformed(`names weight table ${type}`);
    const everyByte = type === 0;
    const tree = new Tree(table);
    let written = 0;
    for (;;) {
        let item = tree.root();
        while (item.childLo !== undefined)
            item = bit() === 1 ? item.childLo.prev : item.childLo;
        let value = item.value;
        if (value === END_OF_STREAM)
            break;
        if (value === NEW_BYTE) {
            value = byte();
            tree.addByte(value);
            if (!everyByte)
                tree.increment(tree.leafOf(value));
        }
        output[written] = value;
        written += 1;
        if (written >= outputBytes)
            break;
        if (everyByte)
            tree.increment(tree.leafOf(value));
    }
    return output.subarray(0, written);
}
//# sourceMappingURL=huffman.js.map