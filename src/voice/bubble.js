
// Artwork and playback response adapted from voice_chat_mcp/AgentVoiceBubble.
// Keep the animation local: no app renders for individual audio samples.
export function mountVoiceBubble(container, getSession) {
  container.innerHTML = `<div class="agent-voice-stage" role="img" aria-label="Assistant idle" data-speaking="false" data-connecting="false"><div class="agent-voice-art" aria-hidden="true"><div class="agent-voice-aura"></div><div class="agent-voice-ring agent-voice-ring-outer"></div><div class="agent-voice-ring agent-voice-ring-inner"></div><div class="agent-voice-orb"><div class="agent-voice-flow"></div><div class="agent-voice-shine"></div></div></div></div>`;
  const bubble = container.firstElementChild;
  let frame, level = 0, turn = 0, lastFrame = performance.now(), lastSpeech = -Infinity;
  const draw = now => {
    const elapsed = Math.min(now - lastFrame, 64);
    lastFrame = now;
    const session = getSession();
    const state = session?.state || 'idle';
    const active = state === 'listening';
    const rms = active ? session.player?.getPlaybackLevel() || 0 : 0;
    const target = rms < 0.004 ? 0 : Math.min(1, Math.pow(rms * 5.2, 0.65));
    // Fast attack, slower release, independent of display refresh rate.
    level += (target - level) * (1 - Math.exp(-elapsed / (target > level ? 45 : 280)));
    if (!active) { level = 0; turn = 0; lastSpeech = -Infinity; }
    if (level < 0.001) level = 0;
    turn = (turn + elapsed * level * 0.15) % 360;
    bubble.style.setProperty('--voice-level', level.toFixed(4));
    bubble.style.setProperty('--voice-turn', `${turn.toFixed(2)}deg`);
    bubble.style.setProperty('--voice-wobble', (Math.sin(turn * Math.PI / 90) * level).toFixed(4));
    if (target > 0) lastSpeech = now;
    const speaking = active && now - lastSpeech < 280;
    bubble.dataset.speaking = String(speaking);
    bubble.dataset.connecting = String(state === 'connecting');
    bubble.setAttribute('aria-label', state === 'connecting' ? 'Assistant connecting' : speaking ? 'Assistant speaking' : active ? 'Assistant listening' : 'Assistant idle');
    frame = requestAnimationFrame(draw);
  };
  frame = requestAnimationFrame(draw);
  return () => cancelAnimationFrame(frame);
}
