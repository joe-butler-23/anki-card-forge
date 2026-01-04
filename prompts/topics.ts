import { Topic } from '../types';
import promptContent from './topics.json';

declare global {
  interface Window {
    customPromptOverrides?: Record<string, string>;
  }
}

const topicKeyMap: Record<Topic, keyof typeof promptContent> = {
  [Topic.General]: 'general',
  [Topic.MathScience]: 'mathScience',
  [Topic.Vocabulary]: 'vocabulary',
  [Topic.Programming]: 'programming'
};

const normalizedTopicKey = (topic: Topic) => topic.toLowerCase().replace(/[^a-z]/g, '');

export const TOPIC_PROMPTS: Record<Topic, string> = {
  [Topic.General]: promptContent[topicKeyMap[Topic.General]] || '',
  [Topic.MathScience]: promptContent[topicKeyMap[Topic.MathScience]] || '',
  [Topic.Vocabulary]: promptContent[topicKeyMap[Topic.Vocabulary]] || '',
  [Topic.Programming]: promptContent[topicKeyMap[Topic.Programming]] || ''
};

const applyOverrides = () => {
  if (typeof window === 'undefined') return;

  const overrideData = window.customPromptOverrides ?? {};
  Object.entries(overrideData).forEach(([key, value]) => {
    const matchingTopic = (Object.values(Topic) as Topic[]).find(
      topic => normalizedTopicKey(topic) === key
    );
    if (matchingTopic) {
      (TOPIC_PROMPTS as any)[matchingTopic] = value;
    }
  });

  (Object.values(Topic) as Topic[]).forEach(topic => {
    const savedPrompt = localStorage.getItem(`prompt_${topic}`);
    if (savedPrompt) {
      (TOPIC_PROMPTS as any)[topic] = savedPrompt;
    }
  });
};

applyOverrides();
