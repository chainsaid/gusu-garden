import { createShotEvaluator } from '../core/film/shot-eval.js';

// ---------------------------------------------------------------------------
// Director: owns the film clock. Resolves the current shot to the scalar the
// shaders consume (shotUniform), keeps the app-level clock offset private, and
// hands the data/mechanism pieces to the world through ctx.film.
// ---------------------------------------------------------------------------
export function createDirector({ film, timeline, choreography, clockOffset = 37.0 }) {
  const evaluator = createShotEvaluator({ shots: film.shots, duration: film.shotDur });
  const shotUniform = { value: -1 };

  return {
    shots: film.shots,
    duration: evaluator.duration,
    shotDur: film.shotDur,
    clockOffset,
    choreography,
    evalShot: evaluator.evalShot,
    shotUniform,
    // shader clock = film time + offset (the same formula the pond always used)
    shaderTimeOf: (i) => (i ?? -1) * film.shotDur + clockOffset,
    setShot: (i) => { shotUniform.value = (i === undefined || i === null) ? -1 : i; },
    sample: timeline.sample,
  };
}
