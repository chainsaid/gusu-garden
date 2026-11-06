import { createPatchKit } from '../../core/materials.js';
import { createProc } from './proc.js';
import { createJiangnanPalette } from './presets-jiangnan.js';

// ---------------------------------------------------------------------------
// createMaterialKit: the domain-level facade handed to world builders as ctx.mat.
//
// It joins the mechanism (core/materials.js: patch framework, std/phys/glow,
// registry) with this garden's PROCs and palette. World modules never import
// core/materials.js directly; they use ctx.mat / ctx.M / ctx.materials.
//
//   const kit = createMaterialKit({ u, windGLSL, isRealtime });
//   ctx.mat = kit; ctx.materials = kit; ctx.M = kit.materials();
//
// materials() is cached per kit (one shared instance set per process/kit).
// ---------------------------------------------------------------------------
export function createMaterialKit({ u, windGLSL, shaderMin = 0, isRealtime = () => false, registry } = {}) {
  const kit = createPatchKit({ u, windGLSL, shaderMin, registry });
  const PROC = createProc({ isRealtime });
  let _lib = null;
  function materials() {
    if (_lib) return _lib;
    _lib = createJiangnanPalette({ std: kit.std, phys: kit.phys, glow: kit.glow, PROC });
    return _lib;
  }
  return { ...kit, PROC, materials };
}
