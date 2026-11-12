/**
 * Storm's ADPCM — MPQ compression masks 0x40 (mono) and 0x80 (stereo), which Warcraft III and
 * Diablo II apply to the sample data of WAVE files, then Huffman on top. It is Storm's own scheme,
 * not Microsoft IMA ADPCM: the two share only the quantiser step sizes (`IMA_STEP_TABLE`).
 *
 * A stream opens with a zero byte and a bit shift, then one little-endian 16-bit starting sample
 * per channel. Each following byte belongs to the next channel in turn: 0x80 repeats the channel's
 * sample and lowers its step index, 0x81 raises the index by 8 and keeps the same channel for the
 * next byte; otherwise six magnitude bits scale the step and 0x40 says the difference subtracts.
 * Output is 16-bit little-endian samples and stops at `outputBytes`, as a sector's size says.
 */
import { IMA_STEP_TABLE } from '@modkit/codec-kit/audio';
/** Step index change for each code's low five bits. */
const NEXT_STEP = Object.freeze([
    -1, 0, -1, 4, -1, 2, -1, 6, -1, 1, -1, 5, -1, 3, -1, 7,
    -1, 1, -1, 5, -1, 3, -1, 7, -1, 2, -1, 4, -1, 6, -1, 8,
]);
const INITIAL_STEP_INDEX = 0x2c;
const MAX_STEP_INDEX = IMA_STEP_TABLE.length - 1;
/** Expand a Storm ADPCM stream of `channels` interleaved channels into at most `outputBytes`. */
export function expandStormAdpcm(input, outputBytes, channels) {
    if (!Number.isSafeInteger(outputBytes) || outputBytes < 0) {
        throw new TypeError('outputBytes must be a non-negative safe integer');
    }
    const output = new Uint8Array(outputBytes);
    const view = new DataView(output.buffer);
    let written = 0;
    const write = (sample) => {
        if (written + 2 > outputBytes)
            return false;
        view.setInt16(written, sample, true);
        written += 2;
        return true;
    };
    if (input.byteLength < 2)
        return output.subarray(0, 0);
    const shift = input[1];
    let position = 2;
    const predicted = [0, 0];
    const stepIndex = [INITIAL_STEP_INDEX, INITIAL_STEP_INDEX];
    for (let channel = 0; channel < channels; channel += 1) {
        if (position + 2 > input.byteLength)
            return output.subarray(0, written);
        const sample = input[position] | (input[position + 1] << 8);
        position += 2;
        predicted[channel] = sample >= 0x8000 ? sample - 0x10000 : sample;
        if (!write(predicted[channel]))
            return output.subarray(0, written);
    }
    let channel = channels - 1;
    while (position < input.byteLength) {
        const code = input[position];
        position += 1;
        channel = (channel + 1) % channels;
        if (code === 0x80) {
            if (stepIndex[channel] !== 0)
                stepIndex[channel] = stepIndex[channel] - 1;
            if (!write(predicted[channel]))
                break;
            continue;
        }
        if (code === 0x81) {
            stepIndex[channel] = Math.min(stepIndex[channel] + 8, MAX_STEP_INDEX);
            channel = (channel + 1) % channels;
            continue;
        }
        const index = stepIndex[channel];
        const step = IMA_STEP_TABLE[index];
        let difference = step >> shift;
        for (let bit = 0; bit < 6; bit += 1) {
            if ((code & (1 << bit)) !== 0)
                difference += step >> bit;
        }
        const previous = predicted[channel];
        const next = (code & 0x40) !== 0
            ? Math.max(previous - difference, -32768)
            : Math.min(previous + difference, 32767);
        predicted[channel] = next;
        if (!write(next))
            break;
        stepIndex[channel] = Math.min(Math.max(index + NEXT_STEP[code & 0x1f], 0), MAX_STEP_INDEX);
    }
    return output.subarray(0, written);
}
//# sourceMappingURL=adpcm.js.map