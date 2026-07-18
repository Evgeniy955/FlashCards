const HUMAN_VOICE_HINTS = [
  'natural',
  'premium',
  'enhanced',
  'neural',
  'aria',
  'jenny',
  'guy',
  'samantha',
  'ava',
  'allison',
  'serena',
  'daniel',
  'google us english',
  'microsoft aria',
  'microsoft jenny',
  'microsoft guy',
] as const;

const ROBOTIC_VOICE_HINTS = [
  'compact',
  'espeak',
  'robot',
  'synth',
  'basic',
  'legacy',
] as const;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const getVoiceScore = (voice: SpeechSynthesisVoice) => {
  const name = voice.name.toLowerCase();
  let score = 0;

  if (voice.lang.startsWith('en-US')) score += 50;
  else if (voice.lang.startsWith('en-GB')) score += 45;
  else if (voice.lang.startsWith('en-AU') || voice.lang.startsWith('en-CA')) score += 40;
  else if (voice.lang.startsWith('en')) score += 30;

  if (voice.localService) score += 8;
  if (voice.default) score += 5;

  for (const hint of HUMAN_VOICE_HINTS) {
    if (name.includes(hint)) score += 18;
  }

  for (const hint of ROBOTIC_VOICE_HINTS) {
    if (name.includes(hint)) score -= 25;
  }

  return score;
};

export const getPreferredEnglishVoice = (
  voices: SpeechSynthesisVoice[],
  selectedVoiceURI?: string | null,
) => {
  if (voices.length === 0) return null;

  const savedVoice = selectedVoiceURI
    ? voices.find((voice) => voice.voiceURI === selectedVoiceURI)
    : null;

  if (savedVoice) return savedVoice;

  return [...voices]
    .filter((voice) => voice.lang.startsWith('en'))
    .sort((left, right) => {
      const scoreDiff = getVoiceScore(right) - getVoiceScore(left);
      if (scoreDiff !== 0) return scoreDiff;
      return left.name.localeCompare(right.name);
    })[0] || [...voices].sort((left, right) => getVoiceScore(right) - getVoiceScore(left))[0] || null;
};

export const getSortedVoices = (voices: SpeechSynthesisVoice[]) =>
  [...voices].sort((left, right) => {
    const scoreDiff = getVoiceScore(right) - getVoiceScore(left);
    if (scoreDiff !== 0) return scoreDiff;
    return left.name.localeCompare(right.name);
  });

export const getSpeechRate = (savedRate: string | null, fallback = 0.95) => {
  const parsed = savedRate ? Number.parseFloat(savedRate) : Number.NaN;
  return Number.isFinite(parsed) ? clamp(parsed, 0.75, 1.2) : fallback;
};

export const applySpeechPreferences = (
  utterance: SpeechSynthesisUtterance,
  voices: SpeechSynthesisVoice[],
  selectedVoiceURI?: string | null,
) => {
  const preferredVoice = getPreferredEnglishVoice(voices, selectedVoiceURI);

  if (preferredVoice) {
    utterance.voice = preferredVoice;
    utterance.lang = preferredVoice.lang;
  } else {
    utterance.lang = 'en-US';
  }

  utterance.rate = getSpeechRate(globalThis.localStorage?.getItem('fwt_speech_rate'));
  utterance.pitch = 1;

  return preferredVoice;
};
