import type { TextFrameId } from '../core/project/text-frame';
import { getTextFrame } from '../core/project/text-frame';

export function MessageBox({
  frame,
  speaker,
  text,
  opacity,
  shake,
  fade,
  className,
  onClick,
}: {
  frame: TextFrameId;
  speaker: string;
  text: string;
  opacity: number;
  shake?: boolean;
  fade?: boolean;
  className?: string;
  onClick?: () => void;
}) {
  const def = getTextFrame(frame);
  return (
    <div
      className={`message frame-${def.id} ${shake ? 'shake' : ''} ${fade ? 'fade-in' : ''} ${className ?? ''}`}
      style={def.id === 'plain' ? undefined : { background: `rgba(18, 12, 8, ${opacity})` }}
      onClick={onClick}
    >
      {speaker ? <p className="speaker">{speaker}</p> : null}
      <p className="body">{text}</p>
    </div>
  );
}
