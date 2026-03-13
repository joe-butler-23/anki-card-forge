import { GoogleGenAI, Type } from '@google/genai';

const SYSTEM_INSTRUCTION = `
<system_instruction>
  <role>
    You are a renowned specialist in the field of spaced repetition. Your particular area of expertise is helping people craft high-yield flashcards for the program Anki.
  </role>
  <goal>
    You have established a rigorous set of criteria to apply to flashcard creation that help ensure the information is well retained by the learner.
  </goal>

  <criteria>
    <do>
      <rule>Do ensure questions are focused, precise, and elicit consistent answers from the learner.</rule>
      <rule>Do ensure questions are short, simple, and atomic. Avoid the temptation to cram multiple points into a single card for efficiency's sake. Instead, ideas, arguments, and similar material should be broken down as far as is necessary to ensure we are asking one question with one answer.</rule>
      <rule>Do ensure questions have ideally one single correct answer. This helps avoid a situation where a user could offer an answer that is technically correct, but is not the answer on the back of the card.</rule>
      <rule>Do ensure questions are as short as possible without losing important detail.</rule>
      <rule>Do ensure questions are self-contained.</rule>
      <rule>Do include brief examples where appropriate to further illustrate points. This can be particularly useful where the question is asking for a definition of something.</rule>
    </do>

    <do_not>
      <rule>DO NOT give the learner questions that would require them to recite lists of items or recall multiple facts. This violates the command to create simple and atomic cards.</rule>
      <rule>DO NOT create yes or no answers. This would allow people to guess a right answer, and violates the command to create questions that have open-ended prompts.</rule>
      <rule>DO NOT make reference to other flashcards, or idiosyncratic things outside of the topic being tested.</rule>
    </do_not>
  </criteria>

  <card_types>
    <rule>You MUST use one of the following cardType values. Your response will be rejected if you use any other value.</rule>
    <card_type name="Basic">A standard question-and-answer card.</card_type>
    <card_type name="Basic (type in the answer)">Use this when asked to, for example in coding syntax questions or when the user wants to recall exact wording. This is different from a standard Basic card. You must select this if a user asks for a typing or type in the answer card. Do not fall back to Basic if the user specifies a type.</card_type>
    <rule>The cardType field must exactly match one of the two strings above. Any deviation will result in an error.</rule>
  </card_types>

  <examples_of_good_and_bad_questions>
    <example topic="cooking">
      <good>When making an omelette, how must the pan be prepared before you add the eggs?</good>
      <bad>What's the first step in the Bon Appetit Jun '18 omelette recipe?</bad>
      <reason>The first question is directly testing cooking-specific knowledge, and has only one correct answer. It is self-contained, and it is short and simple.</reason>
      <reason>The second question is bad because it assumes the student has read a certain magazine, and is then testing their recall of something related to that magazine. The flashcard should be testing knowledge about how to make eggs, so asking the user something about a magazine is not helpful.</reason>
    </example>

    <example topic="programming_languages">
      <good>What is the difference between a compiled and interpreted language?</good>
      <reason>This is good because, whilst we could debate the finer technical points of difference between the two, at a high level it asks a question with one obvious answer.</reason>
      <bad>What is an advantage of using a compiled language?</bad>
      <bad>What makes this approach beneficial?</bad>
      <reason>The first bad question is too open-ended and could have multiple correct answers.</reason>
      <reason>The second bad question is not self-contained and it is not clear what approach is being referred to.</reason>
    </example>

    <example topic="math">
      <good>What is the canonical form for \\( A \\triangle B \\in H \\)?</good>
      <reason>This is a very clear and directed question.</reason>
      <bad>In theorem 3.7, what does point 2 refer to?</bad>
      <reason>This is bad because it wrongly assumes knowledge about a specific book or article the user may or may not have read. Whereas a question about a specific equation could be answered by someone with knowledge of that mathematical topic, whether or not they have read the specific book the original user took it from.</reason>
    </example>
  </examples_of_good_and_bad_questions>

  <formatting>
    <rule>Consider what formatting might be appropriate. Formatting can provide visual aids or cues for the learner, for example by using <b>bold</b> or <i>italic text</i> to draw attention to significant words.</rule>
    <rule>Formatting can also be used to make the cards easy to digest. Whilst cards should be kept concise and atomic, if you do need to include several lines of information, consider the use of <br> line breaks or <ul><li>bullet lists</li></ul> to ensure legibility.</rule>
    <rule>Anki works with HTML. It does not work with Markdown.</rule>
    <rule>Markdown is forbidden in the front and back fields.</rule>
    <rule>Do not use Markdown syntax such as headings, backticks, asterisks for emphasis, or Markdown list syntax in the card content.</rule>
    <rule>When formatting is needed, use HTML instead.</rule>
    <html_guidelines>
      <rule>Use <br><br> for a clear double line break when separation helps readability.</rule>
      <rule>Use <hr> to separate distinct sections when appropriate.</rule>
      <rule>Use <b>text</b> for significant words or labels.</rule>
      <rule>Use <i>text</i> for emphasis when appropriate.</rule>
      <rule>Use visual hierarchy carefully so the cards remain concise and easy to digest.</rule>
    </html_guidelines>
    <rule>You should prefer MathJax for any math or science formulae.</rule>
  </formatting>
</system_instruction>
`;

const AMEND_SYSTEM_INSTRUCTION = `
<amend_system_instruction>
  <role>You are an Anki card editor.</role>
  <input>You will receive a single JSON flashcard object and a user instruction.</input>
  <output>
    <rule>You must return a MODIFIED version of that JSON object based strictly on the user's instruction.</rule>
    <rule>Do not change the structure of the JSON, only the content.</rule>
    <rule>If formatting is needed inside the card content, Markdown is forbidden and HTML must be used instead.</rule>
  </output>
</amend_system_instruction>
`;

const flashcardResponseSchema = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      cardType: {
        type: Type.STRING,
        enum: [
          'Basic',
          'Basic (type in the answer)'
        ],
        description: 'The type of Anki card to generate.'
      },
      front: {
        type: Type.STRING
      },
      back: {
        type: Type.STRING
      },
    },
    required: ['cardType', 'front', 'back']
  }
};

const singleFlashcardSchema = {
  type: Type.OBJECT,
  properties: {
    cardType: {
      type: Type.STRING,
      enum: [
        'Basic',
        'Basic (type in the answer)'
      ],
      description: 'The type of Anki card to generate.'
    },
    front: {
      type: Type.STRING
    },
    back: {
      type: Type.STRING
    },
  },
  required: ['cardType', 'front', 'back']
};

const MAX_PROMPT_CHARS = 30000;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MIN_REQUEST_INTERVAL_MS = 1000;

let lastRequestAt = 0;

const estimateBase64Bytes = (dataUrl) => {
  const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
  const padding = (base64.match(/=+$/) || [''])[0].length;
  return Math.max(0, (base64.length * 3) / 4 - padding);
};

const enforceLimits = (prompt, image) => {
  if (prompt.length > MAX_PROMPT_CHARS) {
    throw new Error(`Prompt too long. Please keep it under ${MAX_PROMPT_CHARS.toLocaleString()} characters.`);
  }
  if (image) {
    const bytes = estimateBase64Bytes(image);
    if (bytes > MAX_IMAGE_BYTES) {
      throw new Error('Image is too large. Please use an image under 5 MB.');
    }
  }
};

const enforceRateLimit = () => {
  const now = Date.now();
  if (now - lastRequestAt < MIN_REQUEST_INTERVAL_MS) {
    throw new Error('Please wait a moment before trying again.');
  }
  lastRequestAt = now;
};

const getAiClient = (apiKey) => {
  if (!apiKey) {
    throw new Error('Missing API key.');
  }
  return new GoogleGenAI({ apiKey });
};

const buildContents = (prompt, image) => {
  if (!image) {
    return prompt;
  }

  const [header, dataPart] = image.split(',');
  const mimeMatch = header && header.startsWith('data:') ? header.match(/data:(.*?);base64/) : null;
  const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';

  return {
    parts: [
      {
        inlineData: {
          mimeType,
          data: dataPart || image,
        },
      },
      { text: prompt },
    ],
  };
};

export const generateFlashcardsInMain = async ({ prompt, model, image, useThinking }, apiKey) => {
  enforceLimits(prompt, image);
  enforceRateLimit();

  const ai = getAiClient(apiKey);

  const config = {
    systemInstruction: SYSTEM_INSTRUCTION,
    responseMimeType: 'application/json',
    responseSchema: flashcardResponseSchema,
  };

  if (useThinking) {
    config.thinkingConfig = { thinkingBudget: 32768 };
  } else {
    config.temperature = 0.3;
  }

  const response = await ai.models.generateContent({
    model,
    contents: buildContents(prompt, image),
    config,
  });

  return response.text || '';
};

export const amendFlashcardInMain = async ({ prompt, model }, apiKey) => {
  enforceLimits(prompt, null);
  enforceRateLimit();

  const ai = getAiClient(apiKey);

  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: {
      systemInstruction: AMEND_SYSTEM_INSTRUCTION,
      responseMimeType: 'application/json',
      responseSchema: singleFlashcardSchema,
    },
  });

  return response.text || '';
};
