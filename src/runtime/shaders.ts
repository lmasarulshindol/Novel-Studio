import { Filter, GlProgram, UniformGroup } from 'pixi.js';

export const FILTER_VERTEX = `
in vec2 aPosition;
out vec2 vTextureCoord;

uniform vec4 uInputSize;
uniform vec4 uOutputFrame;
uniform vec4 uOutputTexture;

vec4 filterVertexPosition(void) {
  vec2 position = aPosition * uOutputFrame.zw + uOutputFrame.xy;
  position.x = position.x * (2.0 / uOutputTexture.x) - 1.0;
  position.y = position.y * (2.0 * uOutputTexture.z / uOutputTexture.y) - uOutputTexture.z;
  return vec4(position, 0.0, 1.0);
}

vec2 filterTextureCoord(void) {
  return aPosition * (uOutputFrame.zw * uInputSize.zw);
}

void main(void) {
  gl_Position = filterVertexPosition();
  vTextureCoord = filterTextureCoord();
}
`;

const STUDIO_FRAGMENT = `
in vec2 vTextureCoord;
out vec4 finalColor;
uniform sampler2D uTexture;
uniform float uMode;
uniform float uAmount;
uniform float uLevels;
uniform float uTime;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

void main() {
  vec2 uv = vTextureCoord;
  int mode = int(uMode + 0.5);
  if (mode == 4) {
    uv.x += sin(uv.y * 24.0 + uTime * 6.0) * 0.02 * uAmount;
    uv.y += cos(uv.x * 18.0 + uTime * 4.0) * 0.012 * uAmount;
  }
  vec4 color = texture(uTexture, uv);
  if (mode == 1) {
    color.rgb = mix(color.rgb, vec3(1.0) - color.rgb, clamp(uAmount, 0.0, 1.0));
  } else if (mode == 2) {
    float levels = max(uLevels, 2.0);
    color.rgb = floor(color.rgb * levels + 0.001) / levels;
  } else if (mode == 3) {
    float vignette = smoothstep(0.85, 0.25, distance(uv, vec2(0.5)));
    color.rgb *= mix(1.0, vignette, clamp(uAmount, 0.0, 1.0));
  } else if (mode == 5) {
    vec3 warm = vec3(1.0, 0.68, 0.42);
    color.rgb = mix(color.rgb, color.rgb * warm, clamp(uAmount, 0.0, 1.0));
  } else if (mode == 6) {
    float luma = dot(color.rgb, vec3(0.299, 0.587, 0.114));
    vec3 mapped = mix(vec3(0.07, 0.1, 0.24), vec3(1.0, 0.78, 0.42), luma);
    color.rgb = mix(color.rgb, mapped, clamp(uAmount, 0.0, 1.0));
  } else if (mode == 7) {
    float noise = hash(floor(uv * vec2(160.0, 90.0)));
    if (noise > uAmount) color.a = 0.0;
  }
  finalColor = color;
}
`;

type StudioBag = { studioUniforms: { uniforms: { uMode: number; uAmount: number; uLevels: number; uTime: number } } };
type CustomBag = { customUniforms: { uniforms: { uAmount: number } } };

export class StudioFilter extends Filter {
  constructor() {
    super({
      glProgram: GlProgram.from({ vertex: FILTER_VERTEX, fragment: STUDIO_FRAGMENT, name: 'studio-filter' }),
      resources: {
        studioUniforms: new UniformGroup({
          uMode: { value: 0, type: 'f32' },
          uAmount: { value: 0, type: 'f32' },
          uLevels: { value: 4, type: 'f32' },
          uTime: { value: 0, type: 'f32' },
        }),
      },
    });
  }

  private bag(): StudioBag['studioUniforms']['uniforms'] {
    return (this.resources as unknown as StudioBag).studioUniforms.uniforms;
  }

  setMode(mode: number, amount: number, levels: number): void {
    const uniforms = this.bag();
    uniforms.uMode = mode;
    uniforms.uAmount = amount;
    uniforms.uLevels = levels;
  }

  setTime(time: number): void {
    this.bag().uTime = time;
  }
}

export class SourceFilter extends Filter {
  constructor(fragment: string) {
    super({
      glProgram: GlProgram.from({ vertex: FILTER_VERTEX, fragment, name: 'custom-shader' }),
      resources: {
        customUniforms: new UniformGroup({
          uAmount: { value: 0, type: 'f32' },
        }),
      },
    });
  }

  set amount(value: number) {
    (this.resources as unknown as CustomBag).customUniforms.uniforms.uAmount = value;
  }
}
