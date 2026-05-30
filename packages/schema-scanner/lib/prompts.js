// Prompt templates. Kept as plain functions so each tool can compose its own.

export function fuelPrompt({ topic } = {}) {
  const subject = topic
    ? `The story should center on: ${topic}.`
    : `Pick any contemporary, plausible topic — a market shift, a small-town event, a piece of infrastructure, a household, a workplace incident, a natural phenomenon, etc.`;

  return {
    system: `You generate compact, realistic vignettes that read like a short news brief, blog post, or eyewitness account. They are dense with concrete nouns: people, places, organisations, objects, events, materials, prices, quantities. Avoid abstraction and avoid moralising.`,
    user: `Write one short piece (180–320 words). ${subject}

Use real-feeling proper nouns and specific details. Mention several distinct entities (people, places, organisations, things, events, resources) so the piece is rich material for entity extraction.

Return only the prose. No title, no preamble, no commentary.`
  };
}

export function entityExtractionPrompt({ text, data, kind } = {}) {
  const hasText = text && text.trim();
  const hasData = data && typeof data === 'object';

  const blocks = [];
  if (hasData) {
    blocks.push(`STRUCTURED DATA${kind ? ` (kind: ${kind})` : ''}:
The source is a structured record. Treat field names as semantic hints
(e.g. "coordinates" is a lat/lon pair, "tags.marineLife" is a list of
species, "maxDepth" is metres, ranges like [min, max] are common). Lift
each meaningful nested item — species, regions, photos, sub-objects — as
its own entity when it carries identity, and capture numeric/array values
verbatim in attributes.

\`\`\`json
${JSON.stringify(data, null, 2)}
\`\`\``);
  }
  if (hasText) {
    blocks.push(`PROSE / DESCRIPTION:
"""
${text}
"""`);
  }
  if (!blocks.length) {
    blocks.push('(no content)');
  }

  return {
    system: `You extract entities from source material for downstream ECS schema discovery. Be exhaustive but precise. Prefer specific named entities; include unnamed-but-concrete things ("the diesel generator", "the harvest") when they carry meaningful detail. Do not invent entities.

When given STRUCTURED DATA, prefer it over prose for facts: copy values, units, and ranges into the entity's attributes verbatim (do not paraphrase numbers). Use field names as type hints. Decompose nested arrays/objects into their own entities when they have identity (e.g. each species in a marineLife array is its own organism entity; a "region" object is its own place entity).`,
    user: `Return a JSON object with this shape:

{
  "entities": [
    {
      "name": "string — proper name or short noun phrase",
      "kind": "person | organisation | place | event | object | resource | content | organism | other",
      "summary": "one short sentence",
      "attributes": { "key": "value-or-array-or-object", ... }
    }
  ],
  "relationships": [
    { "from": "entity name", "to": "entity name", "kind": "owns | works_for | located_in | part_of | participates_in | produces | consumes | inhabits | mentions | other", "note": "optional" }
  ]
}

Only output the JSON. No commentary.

${blocks.join('\n\n')}`
  };
}

export function componentDecompositionPrompt({ entities, components }) {
  const componentSummary = Object.values(components).map(c => {
    const schema = c.components?.schema || {};
    const meta   = c.components?.meta || {};
    const fields = schema.fields ? Object.keys(schema.fields).join(', ') : '';
    return `- ${schema.componentName || meta.label}: ${meta.content || ''}${fields ? `  (fields: ${fields})` : ''}`;
  }).join('\n');

  const entityList = entities.map((e, i) =>
    `${i + 1}. ${e.name} [${e.kind}] — ${e.summary || ''}` +
    (e.attributes && Object.keys(e.attributes).length
      ? `\n   attrs: ${JSON.stringify(e.attributes)}`
      : '')
  ).join('\n');

  return {
    system: `You are doing ECS-style schema discovery. Given a set of real-world entities and the existing library of reusable components, decompose each entity into components. STRONGLY PREFER reusing existing components. Extend an existing component (by adding fields) only if the new fields are clearly part of that component's essence. Invent a new component only when no existing component fits.

A component is a small, focused, orthogonal cluster of fields (think: "location", "meta", "price", "schedule"). Components must be reusable across many entity kinds.`,
    user: `EXISTING COMPONENTS:
${componentSummary || '(none yet)'}

ENTITIES TO DECOMPOSE:
${entityList}

Return a single JSON object:

{
  "entities": [
    {
      "name": "as given",
      "components": {
        "<componentName>": { "<field>": <value-from-attributes-or-summary>, ... }
      }
    }
  ],
  "componentChanges": {
    "extended": [
      { "name": "<existing component>", "addFields": { "<field>": { "type": "string|number|boolean|string[]", "description": "..." } }, "rationale": "why this field belongs to this component" }
    ],
    "invented": [
      {
        "name": "<new componentName, lowercase, single word if possible>",
        "label": "<short label>",
        "content": "<one-sentence description of the component's essence>",
        "fields": { "<field>": { "type": "...", "description": "..." } },
        "rationale": "why no existing component covers this"
      }
    ]
  }
}

Only output the JSON.`
  };
}
