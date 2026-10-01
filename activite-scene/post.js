// Post-processing, as in the techdemo: the scene renders into a half-float
// target so glowing ink can go above 1, bloom picks up only what is brighter
// than its threshold, and OutputPass applies the renderer's tone mapping and sRGB.
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

// Runs before bloom: one NaN or infinite pixel would otherwise bloom across the frame.
const SafeShader = {
  name: "SafeColors",
  uniforms: { tDiffuse: { value: null } },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    varying vec2 vUv;
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      if (any(isnan(c)) || any(isinf(c))) c = vec4(0.0, 0.0, 0.0, 1.0);
      gl_FragColor = min(c, vec4(64.0));
    }
  `
};

// bloom: { strength, radius, threshold }, per setting
export function createPost(renderer, scene, camera, bloomLook) {
  const target = samples => new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples });
  let samples = 4;
  const composer = new EffectComposer(renderer, target(samples));
  const scenePass = new RenderPass(scene, camera);
  const safe = new ShaderPass(SafeShader);
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), bloomLook.strength, bloomLook.radius, bloomLook.threshold);
  const output = new OutputPass();
  composer.addPass(scenePass);
  composer.addPass(safe);
  composer.addPass(bloom);
  composer.addPass(output);

  return {
    render() { composer.render(); },
    // where the scene is drawn (shaders are compiled for it: no tone mapping, linear colour)
    get target() { return composer.readBuffer; },
    setSize(width, height, pixelRatio, bloomScale) {
      composer.setPixelRatio(pixelRatio);
      composer.setSize(width, height);
      bloom.setSize(Math.max(1, Math.round(width * pixelRatio * bloomScale)), Math.max(1, Math.round(height * pixelRatio * bloomScale)));
    },
    setSamples(n) {
      if (n === samples) return;
      samples = n;
      composer.reset(target(n)); // disposes the old targets
    },
    // each pass, then the composer's own targets (it doesn't dispose its passes)
    dispose() {
      scenePass.dispose();
      safe.dispose();
      bloom.dispose();
      output.dispose();
      composer.dispose();
    }
  };
}
