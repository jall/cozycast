import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import VoiceNotesScreen from '../../src/screens/VoiceNotesScreen';

// One conversation: /notes/<person>, optionally ?cast=<id>&at=<ms>&title=… to
// open (or start) the thread about a cast, replying to a moment in it.
export default function VoiceNotesWith() {
  const { id } = useLocalSearchParams();
  return <VoiceNotesScreen personId={typeof id === 'string' ? id : null} />;
}
