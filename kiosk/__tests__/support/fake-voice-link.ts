import type { VoiceLink, VoiceLinkHandlers } from '../../lib/voice-link';

export function fakeVoiceLink() {
  let current: VoiceLinkHandlers | undefined;
  const state = {
    responses: [] as unknown[][],
    closed: false,
    connections: 0,
  };
  const link: VoiceLink = {
    async connect(_connection, handlers) {
      state.connections += 1;
      state.closed = false;
      current = handlers;
      return {
        sendFunctionResponses: (responses) => {
          state.responses.push(responses);
        },
        close: () => {
          state.closed = true;
        },
      };
    },
  };
  return Object.assign(state, {
    link,
    handlers(): VoiceLinkHandlers {
      if (!current) throw new Error('fake voice link not connected');
      return current;
    },
  });
}
