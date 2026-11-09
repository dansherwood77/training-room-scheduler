/** How many month chips fit, leaving room for a "+N more" link when some stay hidden. */
export function fitMonthItems(available: number, heights: number[], moreHeight: number): number {
  let used = 0;
  let fit = 0;
  for (const height of heights) {
    const reserve = fit + 1 < heights.length ? moreHeight : 0;
    if (used + height + reserve <= available + 1) {
      used += height;
      fit += 1;
      continue;
    }
    if (fit === 0 && height <= available + 1) return 1;
    break;
  }
  return fit;
}
