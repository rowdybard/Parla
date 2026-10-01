// GLSL helpers shared by the scene's shaders: hashes without sine (Dave Hoskins),
// value noise, fbm, camera-facing quads, and the sunset sky gradient that the
// sky draws and the wet sand reflects.
export const hash = /* glsl */ `
  float hash11(float p) { p = fract(p * 0.1031); p *= p + 33.33; p *= p + p; return fract(p); }
  float hash21(vec2 p) { vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
  vec2 hash22(vec2 p) { vec3 q = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973)); q += dot(q, q.yzx + 33.33); return fract((q.xx + q.yz) * q.zy); }
  float hash31(vec3 p) { p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
  float noise2(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash21(i), hash21(i + vec2(1.0, 0.0)), u.x),
               mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x), u.y);
  }
  float fbm(vec2 p) {
    float sum = 0.0, amp = 0.5;
    for (int i = 0; i < 5; i++) {
      sum += amp * noise2(p);
      p = p * 2.03 + 17.1;
      amp *= 0.5;
    }
    return sum;
  }
`;

// A camera-facing quad: `center` in world space, `corner` the quad's own -0.5..0.5 position.
export const billboard = /* glsl */ `
  vec4 billboard(vec3 center, vec2 corner, vec2 size) {
    vec4 mv = modelViewMatrix * vec4(center, 1.0);
    mv.xy += corner * size;
    return projectionMatrix * mv;
  }
`;

// The sunset without its clouds: coral at the horizon, pink, orchid, then
// periwinkle overhead, warmed to gold towards the sun. Needs the uniforms
// uHorizon, uLow, uHigh, uZenith, uGold and uSunDir.
export const skyGradient = /* glsl */ `
  vec3 skyGradient(vec3 d) {
    float up = max(d.y, 0.0);
    vec3 c = mix(uHorizon, uLow, smoothstep(0.0, 0.08, up));
    c = mix(c, uHigh, smoothstep(0.06, 0.34, up));
    c = mix(c, uZenith, smoothstep(0.3, 0.9, up));
    float toward = dot(normalize(d.xz + 1e-5), normalize(uSunDir.xz));
    c = mix(c, uGold, pow(max(toward, 0.0), 9.0) * exp(-up * 10.0) * 0.6);
    c += uGold * pow(max(dot(d, uSunDir), 0.0), 14.0) * 0.25;
    // below the horizon (only seen in grazing reflections)
    if (d.y < 0.0) c = mix(uHorizon, uLow, smoothstep(0.0, 0.3, -d.y));
    return c;
  }
`;
