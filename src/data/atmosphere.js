// ---------------------------------------------------------------------------
// The film's atmosphere: the golden-hour setup this garden is lit by.
//
// Pure data — no three.js, no URL parsing. The app layer reads URL overrides and
// passes them into createEnvironment() (src/core/environment.js); nothing in the
// mechanism layer imports this file.
//
// Coordinates: metres, +Y up, +X east, +Z south (so north is -Z).
// ---------------------------------------------------------------------------
export const ATMOSPHERE = {
  // low golden-hour sun in the west-south-west
  sunElevationDeg: 6.8,
  sunAz: [-0.94, 0.34],        // horizontal (x,z) direction TOWARD the sun
  sunColor: [1.0, 0.70, 0.43], // direct sunlight at the ground (linear), ~3300K, slightly rosy
  sunIntensity: 7.0,
  skySunIntensity: 20.0,       // overall sky radiance scale used by the sky shader
  envIntensity: 1.0,
  exposure: 1.0,
  fogDensity: 1.0,             // runtime multiplier (scene.fog.density)

  // prevailing breeze
  windDir: [0.8, 0.6],
  windStrength: 1.0,
};
