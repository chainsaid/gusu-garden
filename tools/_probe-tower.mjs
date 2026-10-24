// Measure the reconstructed 北寺塔: storey table, eave footprint, finial, total height.
import L from '../src/layout.js';
import { makeStoreys, pTip, roofY } from '../src/world/pagoda.js';

const P = L.pagoda;
const S = makeStoreys(L);
const TAN = Math.tan(Math.PI / (P.sides || 8)), SEC = 1 / Math.cos(Math.PI / (P.sides || 8));
const ground = 0; // the tower is sampled on the landscape; here we measure from y = 0

const a0 = S[0].a, Xc = S[0].Xc, tip = pTip(S[0], Xc);
const cornerR = Math.hypot(Xc, tip);
const faceFlat = 2 * (S[0].a + S[0].O);
console.log(`--- 第 1 层 ---`);
console.log(`塔身(砖核): 内切半径 ${a0.toFixed(2)}  对边距 ${(2 * a0).toFixed(2)}  对角距 ${(2 * a0 * SEC).toFixed(2)}`);
console.log(`檐口: 面中对边距 ${faceFlat.toFixed(2)}  角对边距 ${(2 * tip).toFixed(2)}  对角距 ${(2 * cornerR).toFixed(2)}`);
console.log(`收分: 顶层对边距 ${(2 * S[S.length - 1].a).toFixed(2)}  (shrink=${P.shrink})`);

console.log(`\n--- 各层 ---`);
S.forEach((s) => {
  const flat = 2 * (s.a + s.O);
  console.log(`#${s.i} F=${s.F.toFixed(2)} Ye=${s.Ye.toFixed(2)} Yt=${s.Yt.toFixed(2)} a=${s.a.toFixed(2)} 檐对边=${flat.toFixed(2)}`);
});

// finial stack, mirroring the rewritten spire()
const s4 = S[S.length - 1];
const Yp = roofY(s4, 0, s4.Rt) - 0.02;
const H = P.spireHeight;
const hBase = H * 0.0725, hBowl = H * 0.0526, hGap = H * 0.0362;
const hMast = H * 0.715, hCan = H * 0.0145, hPearl = H * 0.109;
const yFl = Yp + hBase + hBowl + hGap + hMast + hCan;
const spireTop = yFl + hPearl;
const platTop = P.platform.h;
console.log(`\n--- 总高 ---`);
console.log(`台基顶 ${platTop.toFixed(2)}  第1层底 ${S[0].F.toFixed(2)}  顶层脊 ${s4.Yt.toFixed(2)}`);
console.log(`塔刹基 ${Yp.toFixed(2)}  塔刹顶 ${spireTop.toFixed(2)}`);
console.log(`九层塔身高 ${(s4.Yt - S[0].F).toFixed(2)}  塔身高 ${(s4.Yt - platTop).toFixed(2)}  塔刹高 ${(spireTop - Yp).toFixed(2)}`);
console.log(`>>> 总高(含刹, 自地面) = ${spireTop.toFixed(2)} m   目标 76 m`);
console.log(`>>> 平均每层 ${((s4.Yt - S[0].F) / S.length).toFixed(2)} m`);
