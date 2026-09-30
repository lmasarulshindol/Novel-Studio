import type { CharacterAsset } from './project';

export type ExpressionTemplateItem = {
  id: string;
  label: string;
};

/** キャラクター差分の共通枠。同じ id のファイルをキャラごとに揃える。 */
export const EXPRESSION_TEMPLATE: ExpressionTemplateItem[] = [
  { id: 'smile', label: '笑顔' },
  { id: 'shy', label: '照れ' },
  { id: 'tease', label: 'からかい' },
  { id: 'soft', label: '柔らかい' },
  { id: 'serious', label: '真顔' },
  { id: 'surprise', label: '驚き' },
  { id: 'sad', label: '悲しい' },
  { id: 'angry', label: '怒り' },
];

export type ExpressionSlot = {
  id: string;
  label: string;
  src: string;
  fileName: string;
  path: string;
  filled: boolean;
};

export function expressionPath(character: CharacterAsset, exprId: string): string {
  const sample = character.expressions.find((item) => item.src)?.src ?? `chars/${character.id}_smile.png`;
  const slash = Math.max(sample.lastIndexOf('/'), sample.lastIndexOf('\\'));
  const dir = slash >= 0 ? sample.slice(0, slash + 1) : 'chars/';
  return `${dir}${character.id}_${exprId}.png`;
}

export function expressionBoard(character: CharacterAsset): ExpressionSlot[] {
  const byId = new Map(character.expressions.map((item) => [item.id, item.src]));
  const slots: ExpressionSlot[] = EXPRESSION_TEMPLATE.map((item) => ({
    id: item.id,
    label: item.label,
    src: byId.get(item.id) ?? '',
    fileName: `${character.id}_${item.id}.png`,
    path: expressionPath(character, item.id),
    filled: byId.has(item.id),
  }));
  for (const expr of character.expressions) {
    if (EXPRESSION_TEMPLATE.some((item) => item.id === expr.id)) continue;
    slots.push({
      id: expr.id,
      label: expr.id,
      src: expr.src,
      fileName: `${character.id}_${expr.id}.png`,
      path: expressionPath(character, expr.id),
      filled: true,
    });
  }
  return slots;
}

export function filledExpressionCount(character: CharacterAsset): { filled: number; total: number } {
  const board = expressionBoard(character);
  const templateIds = new Set(EXPRESSION_TEMPLATE.map((item) => item.id));
  const filled = board.filter((slot) => slot.filled && templateIds.has(slot.id)).length;
  return { filled, total: EXPRESSION_TEMPLATE.length };
}
