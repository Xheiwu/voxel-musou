// No texture assets: paper grain, ink edges and the limited accent palette are procedural.
// These shaders deliberately do NOT replace the character geometry or animation.
export const INK_VERTEX = /* glsl */`
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;
export const INK_FRAGMENT = /* glsl */`
  varying vec2 vUv;
  uniform sampler2D tColor, tDepth;
  uniform vec2 uSize, uNearFar;
  uniform mat4 uProjectionInverse, uCameraWorld;
  uniform float uFlash;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float eyeDepth(float z) {
    float n = uNearFar.x, f = uNearFar.y;
    return n * f / max(f - z * (f - n), 0.0001);
  }
  vec3 worldPosition(vec2 uv, float z) {
    vec4 p = uProjectionInverse * vec4(uv * 2.0 - 1.0, z * 2.0 - 1.0, 1.0);
    return (uCameraWorld * vec4(p.xyz / p.w, 1.0)).xyz;
  }
  void main() {
    vec2 pixel = 1.0 / uSize;
    float z = texture2D(tDepth, vUv).r;
    float d = eyeDepth(z);
    // Stable grain: no time-dependent noise, so the paper does not shimmer while standing still.
    float grain = (hash(floor(vUv * uSize)) - 0.5) * 0.012;
    vec3 paper = vec3(0.954, 0.948, 0.925) + grain;
    vec3 source = texture2D(tColor, vUv).rgb;
    vec3 color = pow(max(source / (vec3(1.0) + source * 0.45), vec3(0.0)), vec3(1.0 / 2.2));
    float luminance = dot(color, vec3(0.2126, 0.7152, 0.0722));
    float density = pow(clamp(1.0 - luminance, 0.0, 1.0), 1.25) * 0.78;
    vec3 wp = worldPosition(vUv, z);
    vec3 derivNormal = cross(dFdx(wp), dFdy(wp));
    float ny = abs(derivNormal.y) / max(length(derivNormal), 0.00001);
    // Ground receives a light wash; upright figures and fortifications keep their silhouette.
    float ground = smoothstep(0.90, 0.99, ny);
    density *= mix(1.0, 0.25, ground);
    float e = 0.0;
    e = max(e, abs(eyeDepth(texture2D(tDepth, vUv + vec2(pixel.x, 0.0)).r) - d));
    e = max(e, abs(eyeDepth(texture2D(tDepth, vUv - vec2(pixel.x, 0.0)).r) - d));
    e = max(e, abs(eyeDepth(texture2D(tDepth, vUv + vec2(0.0, pixel.y)).r) - d));
    e = max(e, abs(eyeDepth(texture2D(tDepth, vUv - vec2(0.0, pixel.y)).r) - d));
    float edge = smoothstep(0.018, 0.075, e / max(d, 1.0));
    vec3 ink = mix(paper, vec3(0.095, 0.104, 0.11), clamp(density + edge * 0.53, 0.0, 0.90));
    float red = smoothstep(0.09, 0.25, color.r - max(color.g, color.b));
    float cool = smoothstep(0.07, 0.22, max(color.g, color.b) - color.r);
    float accent = max(red, cool * 0.78) * (1.0 - ground * 0.85);
    vec3 pigment = mix(color * 0.82, paper, 0.12);
    ink = mix(ink, pigment, accent * 0.72 * (1.0 - edge * 0.50));
    float mist = smoothstep(45.0, 185.0, d) * 0.82;
    ink = mix(ink, paper, mist);
    // A depth-less sky becomes negative space, not the original golden-hour sky.
    if (z > 0.99999) ink = paper;
    ink = mix(ink, paper, clamp(uFlash, 0.0, 0.55));
    gl_FragColor = vec4(clamp(ink, 0.0, 1.0), 1.0);
  }
`;
