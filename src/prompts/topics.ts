import { Topic } from '../types';
import promptContent from './topics.json';

const TOPICS = Object.values(Topic);

const topicKeyMap: Record<Topic, keyof typeof promptContent> = {
  [Topic.General]: 'general',
  [Topic.MathScience]: 'mathScience',
  [Topic.Vocabulary]: 'vocabulary',
  [Topic.Programming]: 'programming',
};

function normalizeTopicKey(topic: Topic): string {
  return topic.toLowerCase().replace(/[^a-z]/g, '');
}

function getPrompt(topic: Topic): string {
  return promptContent[topicKeyMap[topic]] || '';
}

export const TOPIC_PROMPTS: Record<Topic, string> = {
  [Topic.General]: getPrompt(Topic.General),
  [Topic.MathScience]: getPrompt(Topic.MathScience),
  [Topic.Vocabulary]: getPrompt(Topic.Vocabulary),
  [Topic.Programming]: getPrompt(Topic.Programming),
};

function applyOverrides(): void {
  if (typeof window === 'undefined') {
    return;
  }

  const overrideData = window.customPromptOverrides ?? {};

  Object.entries(overrideData).forEach(([key, value]) => {
    const matchingTopic = TOPICS.find((topic) => normalizeTopicKey(topic) === key);

    if (matchingTopic) {
      TOPIC_PROMPTS[matchingTopic] = value;
    }
  });

  TOPICS.forEach((topic) => {
    const savedPrompt = localStorage.getItem(`prompt_${topic}`);

    if (savedPrompt) {
      TOPIC_PROMPTS[topic] = savedPrompt;
    }
  });
}

applyOverrides();
