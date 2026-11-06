// ---------------------------------------------------------------------------
// Camera evaluation for the film. Pure math: focal length -> FOV and applying a
// camera description (pos / look / roll / clip / focal) to a PerspectiveCamera.
// Width and height are explicit parameters so the mechanism layer never has to
// guess the project resolution.
// ---------------------------------------------------------------------------

export function focalToFov(focal, aspect) {
  const sensorH = 36 / aspect;
  return (2 * Math.atan(sensorH / (2 * focal)) * 180) / Math.PI;
}

export function applyCamera(cam, c, { width, height, jitter = null } = {}) {
  cam.position.copy(c.pos);
  cam.up.set(0, 1, 0);
  cam.lookAt(c.look);
  if (c.roll) cam.rotateZ(c.roll);
  cam.near = c.near || 0.12;
  cam.far = c.far || 6000;
  cam.fov = c.fov || focalToFov(c.focal || 35, width / height);
  cam.aspect = width / height;
  cam.updateProjectionMatrix();
  if (jitter) {
    const [jx, jy] = jitter;
    cam.projectionMatrix.elements[8] += (2 * jx) / width;
    cam.projectionMatrix.elements[9] += (2 * jy) / height;
    cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();
  }
  cam.updateMatrixWorld();
}
