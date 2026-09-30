import { GlassSurface } from '@/components/ui/GlassSurface';

export function MentiSpeechBubble() {
  return (
    <GlassSurface className="menti-speech">
      <p>
        Hi! I’m Menti <span aria-hidden="true">✦</span>
      </p>
      <span>
        Your future AI guide.
        <br />
        Coming soon.
      </span>
    </GlassSurface>
  );
}
