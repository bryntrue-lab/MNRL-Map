# Mineral — The Lens Teachings (v1 copy CONFIRMED + placement)

*Founder-confirmed content, 2026-08. Every string in §2–§3 is FINAL canon — reproduce exactly (one typo corrected and flagged inline). §1 is the placement design; §4 is the implementation amendment for D.3 §B9.*

---

## 1. Placement (design — the sheet model)

The teachings are too long to render inline without burying the lens data. Three tiers of presence, using the sheet grammar the map already established:

1. **Inline, always — the held line only.** One serif line (`serifMedium`) beneath the lens title in the lens detail view. The teaching's permanent presence; costs one line.
2. **Quiet lenses (listening state) — held line + the CLOSING paragraph.** Each teaching's final paragraph states what the lens does; in the listening state it renders under the held line in `bodyLarge` sans `textSecondary`, replacing the old promise line. Nothing between the held line and the closing paragraph renders inline.
3. **The full teaching — a sheet.** A `linkWhisper` at the bottom of the lens view — `the teaching →` — opens a bottom sheet (~70% height, swipe to dismiss): held line at top (`serifMedium`), all paragraphs `bodyLarge` sans, paragraph spacing ≥ 16pt, no eyebrow.
4. **First-visit presentation:** the first time a user ever opens each lens, the sheet presents itself once (after the view settles), then never again uninvited — the map-label doctrine (taught once, summoned on request). Track per-lens locally.

**Voice/typography rules unchanged:** held line is the only serif; paragraphs are sans (they explain); no forbidden Guide words (verified: none present); no serif inside any pressable.

---

## 2. The five teachings (FINAL, verbatim)

### recurring resistance

**Held line:** *the wall you keep meeting knows your name.*

Every tradition placed something fearsome at the threshold... wilderness, a dragon, a guardian... This tension at the threshold wasn't to keep people out, it simply ensured no one crossed casually.

Creative work keeps the same custom.

The task continually postponed, significant conversations avoided, the chapter abandoned at the same page: The idea that grows heavier each time you return to it.

These aren't usually failures of discipline. Perhaps they're places where energy has gathered. The block stands exactly where the charge is.

This guide does not treat resistance as an enemy to defeat. It simply counts the walls you name. Named once, a wall is a difficult day. Named three times, it becomes architecture.

Architecture can be studied, walked around, and eventually... walked through. The counting is the beginning of the crossing.

*(Closing paragraph for the quiet-lens inline render: the final two paragraphs, "This guide does not treat resistance…" through "…the beginning of the crossing.")*

### your recurring language

**Held line:** *what you say twice, you are still saying.*

Long before writing, the spoken word was the instrument of change: Prayers, songs, vows, chants. These words were understood to still be alive.

Modern depth psychology arrived at much the same conclusion: The phrases we repeat are likely not accidental. They reveal the questions we continue living, the values we protect, the identities still taking shape.

This guide lifts the sentences you repeat without noticing. Nothing is ascribed to them; they're simply returned to you, to read yourself with fresh eyes. Before we know our story, we often repeat its language.

*(Closing paragraph: "This guide lifts the sentences…")*

### mythic motifs

**Held line:** *the image returns because it is not finished with you.*

Before ideas became theories, they were images: Fire, seeds, birds, doors, the sea.

Across cultures, recurring images were never dismissed as coincidence. They were treated as visitors carrying unfinished business. Depth psychology kept the practice and changed the language: Stay with the image. Do not rush to explain it.

The imagination speaks long before analysis arrives. Artists have always known this. The artist who paints the same shoreline for thirty years is not stuck; they are listening. Imagination isn't limited, it's faithful.

Whole bodies of work may be mined from a single returning image. This guide notices the images that continue finding you, so that when one refuses to leave, you'll know to open the door.

*(Closing paragraph: "Whole bodies of work…")*

### conditions noted

**Held line:** *nothing grows out of season.*

Farmers learned to watch more than the harvest. Monastics learned to listen to more than prayer. Both paid attention to conditions: The moon, the weather, the hour, the quality of the ground.

Nothing that grows can be understood apart from the field that nourished it. A creative life is no different.

The same conversation becomes possibility on one day and impossibility on another. The difference is not always the event. Some days it's sleep, others it's solitude, or grief, or a new season.

This guide gathers the conditions surrounding your most charged reflections. Over time, the weather begins to separate from the climate.

You discover which conditions accompany clarity, which accompany resistance, and which quietly invite your best work. No need to predict what's next, we simply cultivate what's here for us.

*(Closing paragraph: the final two paragraphs, "This guide gathers…" through "…what's here for us.")*

### consciousness map

**Held line:** *every sentence is spoken from somewhere.*

Our world arrives through a way of seeing, larger than any single perspective can contain. 

We develop our ways of seeing, our consciousness, through many modes. Through living symbols and stories, as well as reason, measurement, and explanation, we navigate these modes as structures of consciousness. Structures to inhabit, not stages to outgrow: Ways the world becomes visible.

These structures are stationed on your map: Integral, Magic, Mythic, Mental. 

The spiral indicates where your life stands among them, while this guide listens for where your words stand day by day. Read together, they move from map to mirror, revealing the position you hold and the voice that speaks from it.

*(Closing paragraph: "These structures are stationed…" and "The spiral indicates...")*

---

## 3. The Guide's opening description (FINAL, verbatim)

Renders as the Guide tab's **empty state** (zero notes in the field), replacing whatever the empty state currently says. Once the field has notes, it retires — the patterns speak instead. First sentence group `bodyLarge` `textSecondary`; final two sentences may set as their own paragraph.

> The Field Guide doesn't explain your life. It helps you notice the patterns your life has already been repeating: A phrase you keep using, resistance that won't loosen, an image that follows you from dream to conversation to notebook.
>
> Across traditions, these repetitions were never treated as accidents. They were treated as instruction.

*(v1 addition: a permanent `about the guide →` whisper in the Guide footer opening this text as a sheet. )*

---

## 4. Implementation amendment (paste for Replit — amends D.3 §B9)

```
B9 AMENDED — teachings render as a SHEET, not inline:

- Teaching content docs: practitionerContent, kind 'teaching', keyed by
  lens: { heldLine, paragraphs: string[], closingParagraphIndex }.
  Seed all five from the confirmed copy doc, verbatim.
- Lens detail view: held line (serifMedium) renders beneath the lens title,
  always. Quiet (listening) lenses additionally render the closing
  paragraph(s) (bodyLarge, textSecondary) in place of the old promise line.
- Full teaching: linkWhisper "the teaching →" at the bottom of the lens
  view opens a bottom sheet (~70% height, swipe-dismiss): held line at top,
  all paragraphs bodyLarge sans, ≥16pt paragraph spacing, no eyebrow.
- First visit per lens: present the sheet once automatically after the
  view settles; never again uninvited (local per-lens flag).
- Guide empty state (zero notes): replace its copy with the confirmed
  opening description, verbatim. Retires once notes exist.
- If a teaching doc is missing, everything renders as today (promise
  lines) — no crashes, no placeholders.
```
