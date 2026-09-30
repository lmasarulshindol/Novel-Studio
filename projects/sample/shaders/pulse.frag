in vec2 vTextureCoord;
out vec4 finalColor;
uniform sampler2D uTexture;
uniform float uAmount;

void main() {
  vec4 color = texture(uTexture, vTextureCoord);
  vec3 warm = vec3(1.0, 0.62, 0.38);
  float mixAmount = clamp(uAmount, 0.0, 1.0);
  color.rgb = mix(color.rgb, color.rgb * warm + vec3(0.08, 0.02, 0.0), mixAmount);
  finalColor = color;
}
