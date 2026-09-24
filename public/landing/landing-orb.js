// A self-contained version of the dashboard orb's moving shader language.
// No external 3D runtime is needed by the marketing page; CSS remains the fallback.
export function createLandingOrb(canvas) {
  const empty = { setActive() {}, setMotion() {}, setTilt() {}, destroy() {} };
  if (!canvas) return empty;
  const gl = canvas.getContext("webgl", { alpha: true, antialias: false, powerPreference: "low-power" });
  if (!gl) return empty;

  const vertexSource = `
    attribute vec2 a_position;
    varying vec2 v_uv;
    void main() { v_uv = a_position * .5 + .5; gl_Position = vec4(a_position, 0., 1.); }
  `;
  const fragmentSource = `
    precision mediump float;
    varying vec2 v_uv;
    uniform float u_time;
    uniform vec2 u_tilt;

    void main() {
      vec2 p = (v_uv - .5) * 2.03;
      float radius = length(p);
      if (radius >= 1.) discard;
      float depth = sqrt(max(0., 1. - radius * radius));
      vec3 normal = normalize(vec3(p + u_tilt * .085, depth));
      float current = sin(normal.x * 6.4 + u_time * .62 + sin(normal.y * 5.1 - u_time * .33) * 2.2);
      float second = cos(normal.y * 10.2 - u_time * .39 + sin(normal.x * 4.6 + u_time * .22));
      float ribbons = sin(normal.x * 11.1 + normal.y * 7.3 + u_time * .26 + second * 1.8);
      vec3 violet = vec3(.28, .21, .66);
      vec3 indigo = vec3(.07, .13, .39);
      vec3 blue = vec3(.16, .46, .76);
      vec3 color = mix(indigo, violet, .5 + .38 * current);
      color = mix(color, blue, clamp(.14 + .2 * second + .13 * ribbons, 0., .55));
      vec3 lightDirection = normalize(vec3(-.48 + u_tilt.x * .15, .58 + u_tilt.y * .15, .95));
      float diffuse = max(dot(normal, lightDirection), 0.);
      float specular = pow(max(dot(reflect(-lightDirection, normal), vec3(0., 0., 1.)), 0.), 25.);
      float edge = pow(1. - depth, 2.3);
      color *= .48 + diffuse * .92;
      color += vec3(.72, .64, 1.) * specular * .54;
      color += mix(vec3(.49, .33, .9), vec3(.35, .79, .94), .5 + .5 * second) * edge * .68;
      color += vec3(.12, .1, .24) * (.5 + .5 * sin(u_time * .9)) * (.5 + .5 * ribbons);
      float alpha = 1. - smoothstep(.972, 1., radius);
      gl_FragColor = vec4(color, alpha);
    }
  `;
  const compile = (type, source) => {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return shader;
    gl.deleteShader(shader);
    return null;
  };
  const vertex = compile(gl.VERTEX_SHADER, vertexSource);
  const fragment = compile(gl.FRAGMENT_SHADER, fragmentSource);
  if (!vertex || !fragment) return empty;
  const program = gl.createProgram();
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteProgram(program);
    return empty;
  }
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  gl.useProgram(program);
  const position = gl.getAttribLocation(program, "a_position");
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
  const timeUniform = gl.getUniformLocation(program, "u_time");
  const tiltUniform = gl.getUniformLocation(program, "u_tilt");
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

  let active = true;
  let motion = true;
  let disposed = false;
  let contextLost = false;
  let frame = 0;
  let previous = 0;
  let elapsed = 0;
  let tiltX = 0;
  let tiltY = 0;
  const size = () => {
    const bounds = canvas.getBoundingClientRect();
    const cssSize = Math.max(1, Math.round(bounds.width));
    const ratio = Math.min(devicePixelRatio || 1, 1.5, 560 / cssSize);
    const pixels = Math.round(cssSize * ratio);
    if (canvas.width !== pixels || canvas.height !== pixels) {
      canvas.width = pixels;
      canvas.height = pixels;
      gl.viewport(0, 0, pixels, pixels);
    }
  };
  const draw = () => {
    if (disposed || contextLost) return;
    size();
    gl.uniform1f(timeUniform, elapsed);
    gl.uniform2f(tiltUniform, tiltX, tiltY);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    canvas.parentElement?.classList.add("orb-webgl-ready");
  };
  const tick = timestamp => {
    frame = 0;
    if (!active || !motion || disposed || document.hidden) return;
    if (!previous || timestamp - previous >= 32) {
      elapsed += previous ? Math.min((timestamp - previous) / 1000, .1) : 0;
      previous = timestamp;
      draw();
    }
    frame = requestAnimationFrame(tick);
  };
  const resume = () => {
    if (frame || disposed || contextLost) return;
    previous = 0;
    if (active && motion && !document.hidden) frame = requestAnimationFrame(tick);
    else draw();
  };
  const stop = () => { if (frame) cancelAnimationFrame(frame); frame = 0; previous = 0; };
  const visibility = () => { if (document.hidden) stop(); else resume(); };
  const resizeObserver = "ResizeObserver" in window ? new ResizeObserver(() => { if (!disposed) draw(); }) : null;
  resizeObserver?.observe(canvas);
  window.addEventListener("resize", draw, { passive: true });
  document.addEventListener("visibilitychange", visibility);
  const handleContextLost = event => {
    event.preventDefault();
    contextLost = true;
    stop();
    canvas.parentElement?.classList.remove("orb-webgl-ready");
  };
  canvas.addEventListener("webglcontextlost", handleContextLost);
  draw();
  resume();
  return {
    setActive(value) { active = value; if (active) resume(); else stop(); },
    setMotion(value) { motion = value; if (motion) resume(); else { stop(); draw(); } },
    setTilt(x, y) { tiltX = x; tiltY = y; if (!motion) draw(); },
    destroy() {
      disposed = true;
      stop();
      resizeObserver?.disconnect();
      window.removeEventListener("resize", draw);
      document.removeEventListener("visibilitychange", visibility);
      canvas.removeEventListener("webglcontextlost", handleContextLost);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
    }
  };
}
