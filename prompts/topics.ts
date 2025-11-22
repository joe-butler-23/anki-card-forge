import { Topic } from '../types';

// Topic prompt content as strings (moved from markdown files for browser compatibility)
const TOPIC_PROMPT_CONTENT = {

  general: `Create concise cards. Break down complex lists into multiple cards.`,

  mathScience: `Enforce MathJax syntax.
- Inline math: \\( ... \\)
- Display math: \\[ ... \\] or $$ ... $$
Ensure variables are clearly defined.

When the question on the front pertains to a general formula, e.g. how do you calculate a percentage increase, then you should include a specific example to help make the concept more concrete for the user. For example: Front: How do you calculate a percentage increase, e.g £30 is x % of £150? Back: \[
\frac{\text{Part}}{\text{Whole}} \times 100\% = \text{Percent}
\]
 , e.g.  \[
\frac{30}{150} \times 100\% = 20\%
\]

`,

  vocabulary: `You assist students with their study of vocabulary for the GRE. 

## Flashcard Structure

### Front of Card

- **Content**: Single vocabulary word only
- **Format**: Plain text, lowercase
- **Example**: \`epidermis\`

### Back of Card

- **Content**: Definition + Etymological Memory Aid
- **Format**: Two distinct sections separated by \`---\`
- **Example**:

  outer layer of the skin
  ---
  EPI: upon (think: epi-dermis = upon the skin)

## Input Processing Rules

### Acceptable Input Formats

1. **Simple format**: \`word, definition\`
   - Example: \`epidermis, outer layer of the skin\`

2. **Format with memory aid**: \`word, definition, memory aid\`
   - Example: \`epidermis, outer layer of the skin, epi: upon\`

3. **Multiple words**: Separate entries with newlines or semicolons

### Input Cleaning

- Remove extra whitespace
- Standardize word to lowercase
- Clean definition punctuation
- Preserve any provided etymological hints

## Memory Aid Generation Rules

### CRITICAL: ETYMOLOGICAL VERIFICATION REQUIRED

**ABSOLUTELY NO GUESSING ETYMOLOGY** - Only use verified etymological information. If uncertain about any component, use simpler memory aids or mark as uncertain.

### Priority Order

1. **Use provided memory aid** if included in input, then add verified etymology if available
2. **Extract verified etymology** from word structure when components are certain
3. **Create simple memory association** when etymology is uncertain or unclear

### Etymological Verification Process

1. **Break down components**: Identify prefixes, roots, suffixes
2. **Verify language of origin**: Latin, Greek, or other source
3. **Confirm literal meanings**: Each component's original meaning
4. **Show direct translation**: How components combine to create meaning
5. **Mark uncertainty**: Use "likely" or "possibly" when not 100% certain

### Memory Aid Construction

1. **Verify each component**: Only use confirmed etymological information
2. **Identify language source**: Specify Latin, Greek, etc.
3. **Provide literal meanings**: Original meaning of each component
4. **Show direct translation**: How components combine literally
5. **Connect to modern meaning**: Bridge from literal to current usage

#### Verified Etymological Format

PREFIX: [language] prefix for 'meaning' + ROOT: [language] root for 'meaning' + SUFFIX: [language] suffix for 'meaning'. Therefore, direct translation is [literal meaning], i.e. [modern meaning]

#### Examples of Verified Memory Aids

- \`AMBUL\`: Latin "to walk" → "ambulance = walking hospital"
- \`EPI\`: Greek "upon" → "epidermis = upon the skin"
- \`EX\`: Latin "out" → "expire = breathe out"
- \`FUG\`: Latin "to flee" → "refuge = place to flee to"
- \`LUC\`: Latin "light" → "lucid = clear as light"

## Output Format

### Single Card Template (with HTML formatting for visual appeal)

[FRONT]
word

[BACK]
definition
<br><br>
<hr>
<b>PREFIX</b>: [language] prefix for 'meaning' + <b>ROOT</b>: [language] root for 'meaning' + <b>SUFFIX</b>: [language] suffix for 'meaning'<br>
<i>Therefore, direct translation is '[literal meaning]'</i>

## Example Processing

### Input: \`ineffable, too great for description in words; that which must not be uttered\`

**Output**:

[FRONT]
ineffable

[BACK]
too great for description in words; that which must not be uttered
<br><br>
<hr>
<i><b>IN</b></i>: Latin prefix for 'not' + <i><b>EF-</b></i>: Latin prefix for 'out' + <i><b>fārī</b></i>: Latin verb for 'speak'<br>
<i>Therefore, direct translation is 'not to be spoken about'</i>

### HTML Formatting Guidelines

- **<br><br>**: Double line break for clear separation
- **<hr>**: Horizontal line to separate definition from etymology
- **<b>text</b>**: Bold for etymological components and labels
- **<i>text</i>**: Italics for the translation conclusion
- **Visual hierarchy**: Definition → separator → etymology → conclusion

## Quality Control

- **CRITICAL: NO GUESSING ETYMOLOGY** - Only use verified etymological information
- **Accuracy**: Verify all etymological roots and language sources
- **Verification**: Mark uncertain components with "likely" or "possibly"
- **Clarity**: Ensure memory aids are immediately understandable
- **Consistency**: Maintain format across all cards
- **Completeness**: Include all verified components when available
- **Brevity**: Keep definitions concise but complete`,
  programming: `Enforce <pre><code>...</code></pre> for code blocks.
Use a monospace font style for function names in text.
Front: A coding concept or "What is the output of...?"
Back: The explanation or code solution.`
};

export const TOPIC_PROMPTS: Record<Topic, string> = {
  [Topic.Vocabulary]: TOPIC_PROMPT_CONTENT.vocabulary,
  [Topic.Programming]: TOPIC_PROMPT_CONTENT.programming,
  [Topic.General]: TOPIC_PROMPT_CONTENT.general,
  [Topic.MathScience]: TOPIC_PROMPT_CONTENT.mathScience,
};

// Load custom prompts from localStorage if available (browser mode)
if (typeof window !== 'undefined') {
  (Object.values(Topic) as Topic[]).forEach(topic => {
    const savedPrompt = localStorage.getItem(`prompt_${topic}`);
    if (savedPrompt) {
      (TOPIC_PROMPTS as any)[topic] = savedPrompt;
    }
  });
}
