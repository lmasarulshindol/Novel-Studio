export type TextFrameId = 'band' | 'overlay' | 'nameplate' | 'narration' | 'plain';

export type TextFrameDef = {
  id: TextFrameId;
  label: string;
  layout: 'dock' | 'overlay';
  detail: string;
};

export const TEXT_FRAMES: TextFrameDef[] = [
  { id: 'band', label: '下の帯', layout: 'dock', detail: '絵の下に、金の枠で置く。' },
  { id: 'overlay', label: '絵の上', layout: 'overlay', detail: '絵の下端に、半透明の枠を重ねる。' },
  { id: 'nameplate', label: '名札', layout: 'dock', detail: '名前を小さな札にして、本文の枠と分ける。' },
  { id: 'narration', label: '地の文', layout: 'dock', detail: '上下の線だけにして、文章を中央に置く。' },
  { id: 'plain', label: '枠なし', layout: 'overlay', detail: '枠を消して、文字だけを絵の上に置く。' },
];

export function normalizeTextFrame(value: unknown): TextFrameId {
  const found = TEXT_FRAMES.find((frame) => frame.id === value);
  return found ? found.id : 'band';
}

export function getTextFrame(value: unknown): TextFrameDef {
  const id = normalizeTextFrame(value);
  return TEXT_FRAMES.find((frame) => frame.id === id) ?? TEXT_FRAMES[0];
}
