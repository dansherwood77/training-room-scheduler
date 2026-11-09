export type Span = {
  startMs: number;
  endMs: number;
};

export type Laned<T> = T & {
  lane: number;
  lanes: number;
};

/** Greedy lane pack. Back-to-back spans share a lane because the end is exclusive. */
export function packLanes<T extends Span>(items: T[]): Laned<T>[] {
  const sorted = [...items].sort((a, b) => a.startMs - b.startMs || b.endMs - a.endMs);
  const laneEnds: number[] = [];
  const placed: Laned<T>[] = sorted.map((item) => {
    let lane = laneEnds.findIndex((end) => end <= item.startMs);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(item.endMs);
    } else {
      laneEnds[lane] = item.endMs;
    }
    return { ...item, lane, lanes: 1 };
  });

  for (const item of placed) {
    const cluster = placed.filter(
      (other) => other.startMs < item.endMs && item.startMs < other.endMs,
    );
    item.lanes = Math.max(...cluster.map((other) => other.lane)) + 1;
  }

  return placed;
}
