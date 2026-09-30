import { Menti } from '@/components/menti/Menti';
import { Reveal } from '@/components/motion/Reveal';

export function JourneyMentiGuide() {
  return (
    <Reveal className="roadmap-guide">
      <Menti />
      <div className="roadmap-speech">
        <p>
          “I’ll guide you
          <br />
          step by step.”
        </p>
        <span>Menti · Your future AI guide</span>
      </div>
    </Reveal>
  );
}
