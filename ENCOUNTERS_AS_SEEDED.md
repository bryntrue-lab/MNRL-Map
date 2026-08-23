# ENCOUNTERS_AS_SEEDED

> Read-only export of the live Firestore `encounters` collection. Firebase, Storage, and the seed files were not modified.

## Collection summary

- **Encounter documents found in live Firestore:** 8
- **Any document beyond sequence 7 (including drafts or placeholders):** Yes — one additional unsequenced placeholder document exists: `UcjoYHDHmv3wPB70edEb`. It has `dayNumber: 0` and blank title, subtitle, phase, reflection, integration, and audio-path fields.
- **Authored, sequenced encounters found:** 7 (sequences 1–7). No live document has a sequence/order greater than 7.
- **Seed encounter files found:** 7

## Live Firestore ↔ seed-content comparison

The seed files contain a local-only `audioFile` value used by the seeding uploader. That field is intentionally stripped before comparing with live Firestore, because the seeder removes it before writing each encounter document.

- **Live Firestore only:** `UcjoYHDHmv3wPB70edEb` — the unsequenced empty placeholder described above. The seven authored encounter documents have corresponding seed files.

## Live encounter documents (sequence order)

### 1. The Threshold

- **ID:** `the-threshold`
- **Sequence number:** 1
- **Title:** The Threshold
- **Subtitle / serif line:** saying yes to not knowing
- **Storage audio path:** encounters/the-threshold/audio.mp3
- **Status / flags:** mapEpigraph="The door is already open." · phase="signal" · order=1 · minTurn=1 · guideNote=null · deepDive=null · nextThread=null

#### Complete live document (verbatim field values)

```json
{
  "audioPath": "encounters/the-threshold/audio.mp3",
  "blocks": [
    {
      "intro": "What's been happening in your life as you choose to begin?",
      "prompts": [
        {
          "id": "r1-context",
          "text": "What's been happening in your life as you choose to begin?"
        },
        {
          "id": "r1-true-answer",
          "text": "What answer sounds true — before it becomes impressive?"
        },
        {
          "capturable": true,
          "crystallizing": true,
          "id": "r1-crystallizing",
          "subtext": "Not the polished answer. The real one.",
          "text": "Why did I really say yes to this path?"
        }
      ],
      "type": "reflection"
    },
    {
      "durationLabel": "1 min",
      "instruction": "Sit in silence for sixty seconds. Let the body answer first. Then speak the answer under your breath — without editing it.",
      "title": "Let the body answer first",
      "type": "integration"
    },
    {
      "closing": "Notice what feels newly possible now that the yes has been spoken.",
      "intro": "Trace",
      "type": "carry"
    }
  ],
  "deepDive": null,
  "guideNote": null,
  "mapEpigraph": "The door is already open.",
  "minTurn": 1,
  "nextThread": null,
  "order": 1,
  "phase": "signal",
  "subtitle": "saying yes to not knowing",
  "title": "The Threshold"
}
```

### 2. The Ache Is a Compass

- **ID:** `the-ache-is-a-compass`
- **Sequence number:** 2
- **Title:** The Ache Is a Compass
- **Subtitle / serif line:** the unfinished thing, still pointing
- **Storage audio path:** encounters/the-ache-is-a-compass/audio.mp3
- **Status / flags:** mapEpigraph="The unfinished thing is still pointing." · phase="signal" · order=2 · minTurn=1 · guideNote=null · deepDive=null · nextThread=null

#### Complete live document (verbatim field values)

```json
{
  "audioPath": "encounters/the-ache-is-a-compass/audio.mp3",
  "blocks": [
    {
      "prompts": [
        {
          "id": "r2-location",
          "text": "Where does the ache live in the body?"
        },
        {
          "id": "r2-duration",
          "text": "How long has it been there?"
        },
        {
          "id": "r2-conditions",
          "text": "What quiets it, and what sharpens it?"
        },
        {
          "capturable": true,
          "crystallizing": true,
          "id": "r2-crystallizing",
          "text": "The thing that stays unfinished in me is… and it may be pointing toward…"
        }
      ],
      "type": "reflection"
    },
    {
      "instruction": "Carry one small object in your pocket. Each time your hand finds it, notice whether the ache has sharpened, softened, or moved.",
      "title": "The pocket compass",
      "type": "integration"
    },
    {
      "closing": "Keep the trace. Do not force a direction.",
      "type": "carry"
    }
  ],
  "deepDive": null,
  "guideNote": null,
  "mapEpigraph": "The unfinished thing is still pointing.",
  "minTurn": 1,
  "nextThread": null,
  "order": 2,
  "phase": "signal",
  "subtitle": "the unfinished thing, still pointing",
  "title": "The Ache Is a Compass"
}
```

### 3. Remembering

- **ID:** `remembering`
- **Sequence number:** 3
- **Title:** Remembering
- **Subtitle / serif line:** the seed remembers the tree
- **Storage audio path:** encounters/remembering/audio.mp3
- **Status / flags:** mapEpigraph="The seed remembers the tree." · phase="signal" · order=3 · minTurn=1 · guideNote=null · deepDive=null · nextThread=null

#### Complete live document (verbatim field values)

```json
{
  "audioPath": "encounters/remembering/audio.mp3",
  "blocks": [
    {
      "offerings": [
        {
          "key": "seed",
          "text": "In many Indigenous traditions, the soul has been understood to arrive already carrying a purpose — like a seed encoded with an original intention. Life, in these traditions, is less about inventing a direction than about listening, remembering, and unfolding what was already planted. The seed is often said to be drawn out not alone, but by community and land together."
        }
      ],
      "prompts": [
        {
          "id": "r3-gravitation",
          "text": "What did you naturally gravitate toward before anyone evaluated it?"
        },
        {
          "id": "r3-sensory",
          "text": "What did the scene feel like — in the body, the light, the sound?"
        },
        {
          "capturable": true,
          "crystallizing": true,
          "id": "r3-crystallizing",
          "text": "What thread from that memory still lives in me today?"
        }
      ],
      "type": "reflection"
    },
    {
      "durationLabel": "3 min",
      "instruction": "Revisit one youthful or free-spirited daydream for three minutes. Describe only the sensory scene before naming what it means.",
      "title": "Return to a daydream",
      "type": "integration"
    },
    {
      "closing": "Let one quality from the scene accompany you today.",
      "type": "carry"
    }
  ],
  "deepDive": null,
  "guideNote": null,
  "mapEpigraph": "The seed remembers the tree.",
  "minTurn": 1,
  "nextThread": null,
  "order": 3,
  "phase": "signal",
  "subtitle": "the seed remembers the tree",
  "title": "Remembering"
}
```

### 4. The Returning Signal

- **ID:** `the-returning-signal`
- **Sequence number:** 4
- **Title:** The Returning Signal
- **Subtitle / serif line:** what keeps finding you
- **Storage audio path:** encounters/the-returning-signal/audio.mp3
- **Status / flags:** mapEpigraph="What returns has survived your forgetting." · phase="signal" · order=4 · minTurn=1 · guideNote=null · deepDive=null · nextThread=null

#### Complete live document (verbatim field values)

```json
{
  "audioPath": "encounters/the-returning-signal/audio.mp3",
  "blocks": [
    {
      "instruction": "Make the unedited list: ideas, people, places, problems, images, and futures you cannot stop thinking about.",
      "prompts": [
        {
          "id": "r4-alive",
          "text": "Which three feel alive rather than merely important?"
        },
        {
          "capturable": true,
          "crystallizing": true,
          "id": "r4-crystallizing",
          "text": "The three things that feel most alive are…"
        }
      ],
      "type": "reflection"
    },
    {
      "instruction": "Write the list. Circle three by aliveness, not logic.",
      "title": "Things I can't stop thinking about",
      "type": "integration"
    },
    {
      "closing": "Notice whether one of the three finds you again before day's end.",
      "type": "carry"
    }
  ],
  "deepDive": null,
  "guideNote": null,
  "mapEpigraph": "What returns has survived your forgetting.",
  "minTurn": 1,
  "nextThread": null,
  "order": 4,
  "phase": "signal",
  "subtitle": "what keeps finding you",
  "title": "The Returning Signal"
}
```

### 5. The Quiet Yes

- **ID:** `the-quiet-yes`
- **Sequence number:** 5
- **Title:** The Quiet Yes
- **Subtitle / serif line:** the invitation held
- **Storage audio path:** encounters/the-quiet-yes/audio.mp3
- **Status / flags:** mapEpigraph="It asked again." · phase="signal" · order=5 · minTurn=1 · guideNote=null · deepDive=null · nextThread=null

#### Complete live document (verbatim field values)

```json
{
  "audioPath": "encounters/the-quiet-yes/audio.mp3",
  "blocks": [
    {
      "prompts": [
        {
          "id": "r5-invitation",
          "text": "What invitation have you repeatedly postponed?"
        },
        {
          "id": "r5-reasons",
          "text": "What reasons have been true?"
        },
        {
          "id": "r5-body",
          "text": "What changed in your body when you admitted the invitation was still there?"
        },
        {
          "capturable": true,
          "crystallizing": true,
          "id": "r5-crystallizing",
          "text": "What has been quietly calling that I keep postponing?"
        }
      ],
      "type": "reflection"
    },
    {
      "instruction": "Say the invitation aloud in the plainest words you have. Then say only: \"I hear you.\" Before the day ends, make one visible place for it — a note, folder, blank page, or object. Do not begin the work.",
      "title": "I hear you",
      "type": "integration"
    },
    {
      "closing": "Leave the door open.",
      "type": "carry"
    }
  ],
  "deepDive": null,
  "guideNote": null,
  "mapEpigraph": "It asked again.",
  "minTurn": 1,
  "nextThread": null,
  "order": 5,
  "phase": "signal",
  "subtitle": "the invitation held",
  "title": "The Quiet Yes"
}
```

### 6. Living the Question

- **ID:** `living-the-question`
- **Sequence number:** 6
- **Title:** Living the Question
- **Subtitle / serif line:** a question worth carrying
- **Storage audio path:** encounters/living-the-question/audio.mp3
- **Status / flags:** mapEpigraph="A companion, not a demand." · phase="signal" · order=6 · minTurn=1 · guideNote=null · deepDive=null · nextThread=null

#### Complete live document (verbatim field values)

```json
{
  "audioPath": "encounters/living-the-question/audio.mp3",
  "blocks": [
    {
      "prompts": [
        {
          "id": "r6-longest",
          "text": "What question has followed you longest?"
        },
        {
          "id": "r6-opens",
          "text": "Which question opens the room rather than narrowing it?"
        },
        {
          "capturable": true,
          "crystallizing": true,
          "id": "r6-crystallizing",
          "text": "The question I am willing to live beside is…"
        }
      ],
      "type": "reflection"
    },
    {
      "instruction": "Write one open question on paper. Carry it today. Do not answer it.",
      "title": "A companion, not a demand",
      "type": "integration"
    },
    {
      "closing": "Let the question keep its mystery.",
      "type": "carry"
    }
  ],
  "deepDive": null,
  "guideNote": null,
  "mapEpigraph": "A companion, not a demand.",
  "minTurn": 1,
  "nextThread": null,
  "order": 6,
  "phase": "signal",
  "subtitle": "a question worth carrying",
  "title": "Living the Question"
}
```

### 7. The Soul Has a Posture

- **ID:** `the-soul-has-a-posture`
- **Sequence number:** 7
- **Title:** The Soul Has a Posture
- **Subtitle / serif line:** presence before performance
- **Storage audio path:** encounters/the-soul-has-a-posture/audio.mp3
- **Status / flags:** mapEpigraph="Presence before performance." · phase="signal" · order=7 · minTurn=1 · guideNote=null · deepDive=null · nextThread=null

#### Complete live document (verbatim field values)

```json
{
  "audioPath": "encounters/the-soul-has-a-posture/audio.mp3",
  "blocks": [
    {
      "durationLabel": "3–4 min",
      "instruction": "Stand with both feet grounded. Imagine entering the room where you most belong. Let the body find its posture before the mind names it.",
      "items": [
        "Feet hip-width. Weight even.",
        "One slow breath in. Roll the shoulders back.",
        "Lift the crown of the head, gently.",
        "Picture the room. See who is there.",
        "Notice your pace, your voice, your attention.",
        "Let the body hold that posture for a few breaths."
      ],
      "title": "Claiming your presence",
      "type": "practice"
    },
    {
      "prompts": [
        {
          "id": "r7-most-natural",
          "text": "When are you most naturally yourself?"
        },
        {
          "id": "r7-changes",
          "text": "What changes in your pace, voice, gaze, and attention?"
        },
        {
          "capturable": true,
          "crystallizing": true,
          "id": "r7-crystallizing",
          "text": "Name the quality that appears when I stop performing: …"
        }
      ],
      "type": "reflection"
    },
    {
      "closing": "Carry the posture, not the pose.",
      "type": "carry"
    }
  ],
  "deepDive": null,
  "guideNote": null,
  "mapEpigraph": "Presence before performance.",
  "minTurn": 1,
  "nextThread": null,
  "order": 7,
  "phase": "signal",
  "subtitle": "presence before performance",
  "title": "The Soul Has a Posture"
}
```

### Unsequenced. _none_

- **ID:** `UcjoYHDHmv3wPB70edEb`
- **Sequence number:** _none_
- **Title:** _none_
- **Subtitle / serif line:** _none_
- **Storage audio path:** _none_
- **Status / flags:** dayNumber=0 · phase="" · audioDuration=0 · reflectionQuestions="" · integrationPractice=""

#### Complete live document (verbatim field values)

```json
{
  "audioDuration": 0,
  "audioPath": "",
  "dayNumber": 0,
  "integrationPractice": "",
  "phase": "",
  "reflectionQuestions": "",
  "subtitle": "",
  "title": ""
}
```

