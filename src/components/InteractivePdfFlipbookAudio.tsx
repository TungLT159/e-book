import type { RefObject } from 'react';

type InteractivePdfFlipbookAudioProps = {
  pageFlipAudioRef: RefObject<HTMLAudioElement | null>;
  narrationAudioRef: RefObject<HTMLAudioElement | null>;
  resolvedPageFlipSoundPath: string;
};

export function InteractivePdfFlipbookAudio({
  pageFlipAudioRef,
  narrationAudioRef,
  resolvedPageFlipSoundPath,
}: InteractivePdfFlipbookAudioProps) {
  return (
    <>
      <audio
        ref={pageFlipAudioRef}
        src={resolvedPageFlipSoundPath}
        aria-label="Hiệu ứng âm thanh lật trang"
        preload="auto"
      />
      <audio ref={narrationAudioRef} aria-label="Âm thanh đọc văn bản" preload="auto" />
    </>
  );
}
