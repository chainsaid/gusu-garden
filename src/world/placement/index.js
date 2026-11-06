// ---------------------------------------------------------------------------
// Placement handle: the single source of avoidance policy for the world.
// The assembly layer creates it once (before any world module) and hands it
// down as ctx.placement; generators and terrain consume it, never the data.
// ---------------------------------------------------------------------------
import { createPlacementRules } from './rules.js';

export function createPlacement({ L, data }) {
  return createPlacementRules({ L, data });
}
