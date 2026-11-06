import * as THREE from 'three';

// ---------------------------------------------------------------------------
// The shared material library of this garden. Use these instances (they are shared
// so the renderer compiles each program once). Create variants with std()/phys()+PROC.
//
// Everything here is a palette decision for 江南园林 — chestnut-brown timber instead
// of vermilion, cyan-grey tile, white lime plaster, subdued iron fittings. That is
// why it lives in the domain layer next to the PROC snippets it is built from, and
// not in core/materials.js (mechanism only).
//
// Key names and aliases (M.gold, M.tileCyan, M.lacquerRed, ...) are part of the
// contract with src/world/*.js: keep them exactly as they are.
// ---------------------------------------------------------------------------
export function createJiangnanPalette({ std, phys, glow, PROC }) {
  const M = {};
  // Jiangnan palette: chestnut brown timber replacing vermilion red
  M.woodChestnut = phys({ color: 0xffffff, roughness: 0.55, metalness: 0, clearcoat: 0.1, clearcoatRoughness: 0.5 }, PROC.chestnutWood());
  M.woodChestnutDark = phys({ color: 0xffffff, roughness: 0.6, metalness: 0, clearcoat: 0.08, clearcoatRoughness: 0.5 }, PROC.chestnutWood('vec3(0.050, 0.028, 0.018)'));
  M.lacquerRed = M.woodChestnut;
  M.lacquerRedDark = M.woodChestnutDark;
  M.lacquerOrange = phys({ color: 0xffffff, roughness: 0.55, metalness: 0, clearcoat: 0.1, clearcoatRoughness: 0.5 }, PROC.chestnutWood('vec3(0.11, 0.065, 0.038)'));
  // Subdued metal fittings: dark iron / aged bronze instead of flashy gold
  M.iron = std({ color: 0xffffff, roughness: 0.55, metalness: 0.6 }, PROC.darkIron());
  M.gold = M.iron;
  M.goldBright = M.iron;
  M.goldLeaf = M.iron;
  M.bronze = std({ color: 0xffffff, roughness: 0.4, metalness: 1.0 }, PROC.bronze());
  M.blackLacquer = phys({ color: new THREE.Color().setRGB(0.018, 0.016, 0.014), roughness: 0.3, metalness: 0, clearcoat: 1.0, clearcoatRoughness: 0.12 });
  // Jiangnan cyan tile (小青瓦)
  M.tileCyan = std({ color: 0xffffff, roughness: 0.48, metalness: 0.05 }, PROC.cyanTile());
  M.roofTile = M.tileCyan;
  // Jiangnan white plaster (白粉墙)
  M.plasterWhite = std({ color: 0xffffff, roughness: 0.92, metalness: 0 }, PROC.whitePlaster());
  M.plaster = M.plasterWhite;
  M.granite = std({ color: 0xffffff, roughness: 0.8, metalness: 0 }, PROC.granite('0.55'));
  M.graniteMossy = std({ color: 0xffffff, roughness: 0.8, metalness: 0 }, PROC.granite('1.0', 'vec3(0.92, 0.95, 0.9)'));
  M.graniteClean = std({ color: 0xffffff, roughness: 0.75, metalness: 0 }, PROC.granite('0.12', 'vec3(1.08, 1.06, 1.03)'));
  M.taihuStone = std({ color: 0xffffff, roughness: 0.85, metalness: 0, vertexColors: true }, PROC.taihuStone('0.65'));
  M.woodRaw = std({ color: 0xffffff, roughness: 0.8, metalness: 0 }, PROC.wood('vec3(0.24, 0.16, 0.10)', 'x'));
  M.woodRawZ = std({ color: 0xffffff, roughness: 0.8, metalness: 0 }, PROC.wood('vec3(0.24, 0.16, 0.10)', 'z'));
  M.woodFloorX = phys({ color: 0xffffff, roughness: 0.32, metalness: 0, clearcoat: 0.5, clearcoatRoughness: 0.2 }, PROC.wood('vec3(0.16, 0.075, 0.04)', 'x'));
  M.woodFloorZ = phys({ color: 0xffffff, roughness: 0.32, metalness: 0, clearcoat: 0.5, clearcoatRoughness: 0.2 }, PROC.wood('vec3(0.16, 0.075, 0.04)', 'z'));
  M.woodDark = std({ color: 0xffffff, roughness: 0.6, metalness: 0 }, PROC.wood('vec3(0.07, 0.04, 0.025)', 'y'));
  M.latticeGreen = std({ color: 0xffffff, roughness: 0.6, metalness: 0 }, PROC.chestnutWood('vec3(0.05, 0.12, 0.08)'));
  M.whitePaint = std({ color: new THREE.Color().setRGB(0.85, 0.85, 0.83), roughness: 0.85 });
  M.lanternGlow = glow([1.0, 0.58, 0.24], 9);
  M.lanternGlowSoft = glow([1.0, 0.62, 0.30], 4);
  M.flame = glow([1.0, 0.62, 0.25], 40);
  for (const [k, v] of Object.entries(M)) {
    if (v && v.isMaterial && !v.name) v.name = k;
  }
  return M;
}
