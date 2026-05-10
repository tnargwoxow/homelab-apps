"""Per-character voice. Each character form has its own little
vocabulary — what they mumble idly, how they react to feeds and play
and scolds, what they say when they hatch or die. Pure data + a couple
of pickers so game logic can stay clean."""

from __future__ import annotations

import random


# Each character's persona description. Used in the status panel and
# tucked into the action voice picker.
CHARACTERS = {
    "egg":          {"label": "egg",            "trait": "wobbly"},
    "babytchi":     {"label": "babytchi",       "trait": "wide-eyed baby"},
    "marutchi":     {"label": "marutchi",       "trait": "curious child"},
    "tamatchi":     {"label": "tamatchi",       "trait": "cheerful teen"},
    "kuchitamatchi":{"label": "kuchitamatchi",  "trait": "grumpy teen"},
    "mametchi":     {"label": "mametchi",       "trait": "polite intellectual"},
    "ginjirotchi":  {"label": "ginjirotchi",    "trait": "cool & laid back"},
    "kuchipatchi":  {"label": "kuchipatchi",    "trait": "food-loving softie"},
    "tarakotchi":   {"label": "tarakotchi",     "trait": "perpetually sleepy"},
    "ghost":        {"label": "ghost",          "trait": "passed on"},
}


# Idle chatter — random lines while pet is awake and content.
IDLE = {
    "egg":          ["*wobbles*", "...", "tap me!", "*tap tap*"],
    "babytchi":     ["ba-ba!", "goo?", "*giggle*", "wah!", "*blub*"],
    "marutchi":     ["what's that?", "fun!", "play with me?", "wheee!", "*chases tail*"],
    "tamatchi":     ["this is great!", "yay!", "let's play!", "i love you!", "today is fun"],
    "kuchitamatchi":["ugh.", "whatever.", "i'm bored.", "...", "leave me alone", "fine, i guess."],
    "mametchi":     ["hello there!", "did you know...?", "interesting!", "study time", "*reads*"],
    "ginjirotchi":  ["yo.", "chill.", "all good.", "no worries.", "*shrugs*"],
    "kuchipatchi":  ["FOOD?", "yummy!", "*nom nom*", "is it lunch yet?", "snack time?"],
    "tarakotchi":   ["*yawn*", "so tired...", "nap?", "zzz...", "*drowsy*"],
    "ghost":        [],
}


# Reactions to specific actions. Falls back to a default line if a
# character hasn't been customised for a particular action.
REACTIONS = {
    "feed_meal": {
        "babytchi":     ["*nom* ba-ba!", "*chews*"],
        "marutchi":     ["yum!", "more please!"],
        "tamatchi":     ["delicious!", "thanks!"],
        "kuchitamatchi":["fine.", "whatever, food is food."],
        "mametchi":     ["thank you, this is excellent.", "much appreciated."],
        "ginjirotchi":  ["nice, thanks.", "appreciate it."],
        "kuchipatchi":  ["NOM NOM NOM!!", "FOOD! YES!", "MORE!!"],
        "tarakotchi":   ["...zzz... oh, food?", "*sleepy chew*"],
        "default":      ["*munches happily*"],
    },
    "feed_meal_full": {  # pet refused food — already full
        "babytchi":     ["*shakes head*", "no want!"],
        "marutchi":     ["i'm full!", "no thanks."],
        "tamatchi":     ["maybe later!", "i'm stuffed."],
        "kuchitamatchi":["ugh, no.", "stop."],
        "mametchi":     ["i couldn't possibly.", "thank you, but i'm satiated."],
        "ginjirotchi":  ["nah, i'm good.", "all set."],
        "kuchipatchi":  ["FOOD!! ...wait, i'm full?", "ugh too much"],
        "tarakotchi":   ["...too tired to eat...", "*pushes plate away*"],
        "default":      ["pet refused — already full"],
    },
    "feed_snack": {
        "babytchi":     ["*sticky face*", "swee!"],
        "marutchi":     ["sugar!", "tasty!"],
        "tamatchi":     ["love a snack!", "yay treats!"],
        "kuchitamatchi":["whatever.", "*munches*"],
        "mametchi":     ["a small indulgence!", "lovely."],
        "ginjirotchi":  ["candy, nice.", "*chomp*"],
        "kuchipatchi":  ["SNACK!! YES!!", "SUGAR!"],
        "tarakotchi":   ["sweet... zzz...", "*drowsy crunch*"],
        "default":      ["*nibbles*"],
    },
    "play_win": {
        "babytchi":     ["*giggles*", "ba-ba!"],
        "marutchi":     ["i won!!", "wheee!", "fun!"],
        "tamatchi":     ["best game ever!", "yay!"],
        "kuchitamatchi":["...okay that was alright.", "fine, that was fun."],
        "mametchi":     ["splendid!", "well played."],
        "ginjirotchi":  ["nice one.", "smooth."],
        "kuchipatchi":  ["WEEE!!", "i won! FOOD?"],
        "tarakotchi":   ["...we won? *yawn*", "okay nap now"],
        "default":      ["*beams*"],
    },
    "play_loss": {
        "babytchi":     ["wah!", "*pouts*"],
        "marutchi":     ["aww...", "bummer."],
        "tamatchi":     ["next time!", "i'll get it!"],
        "kuchitamatchi":["of course.", "i told you."],
        "mametchi":     ["a learning opportunity.", "drat!"],
        "ginjirotchi":  ["whatever.", "*shrugs*"],
        "kuchipatchi":  ["*sad nom*", "lost...for now."],
        "tarakotchi":   ["...too sleepy to win.", "*sighs*"],
        "default":      ["*sulks*"],
    },
    "clean": {
        "babytchi":     ["clean!", "*splash*"],
        "marutchi":     ["yay clean!", "much better."],
        "tamatchi":     ["sparkly!", "thanks!"],
        "kuchitamatchi":["finally.", "took you long enough."],
        "mametchi":     ["hygiene matters!", "thank you."],
        "ginjirotchi":  ["clean. nice.", "thanks."],
        "kuchipatchi":  ["YAY ALL CLEAN!!", "CLEAN FOOD?"],
        "tarakotchi":   ["...mm, fresh.", "*sleeps in clean spot*"],
        "default":      ["*shines*"],
    },
    "heal": {
        "babytchi":     ["*gulp*", "boo medicine."],
        "marutchi":     ["thanks!", "feel better!"],
        "tamatchi":     ["bitter, but thanks!", "i feel great again!"],
        "kuchitamatchi":["ugh, medicine.", "fine."],
        "mametchi":     ["modern medicine, marvellous.", "much obliged."],
        "ginjirotchi":  ["fixed me up. cheers.", "thanks doc."],
        "kuchipatchi":  ["medicine tastes weird!", "ew but ok"],
        "tarakotchi":   ["*forces awake to swallow*", "*sleeps it off*"],
        "default":      ["*recovering*"],
    },
    "scold_false": {
        "babytchi":     ["*pouts but listens*"],
        "marutchi":     ["sorry...", "i won't do it again!"],
        "tamatchi":     ["sorry, i'll behave!", "okay okay!"],
        "kuchitamatchi":["whatever, fine.", "...i'll stop."],
        "mametchi":     ["my apologies.", "noted, sorry."],
        "ginjirotchi":  ["my bad.", "cool cool, i'll chill."],
        "kuchipatchi":  ["sorry sorry!", "no more bad nom!"],
        "tarakotchi":   ["...okay... *yawn*"],
        "default":      ["*looks sheepish*"],
    },
    "scold_real": {  # bad scold — pet had a real need
        "babytchi":     ["wah!! *cries*"],
        "marutchi":     ["but i needed something!", "that wasn't fair..."],
        "tamatchi":     ["i wasn't being bad...", "i needed help!"],
        "kuchitamatchi":["i HATE you sometimes.", "see, this is why."],
        "mametchi":     ["i had a legitimate need!", "that was uncalled for."],
        "ginjirotchi":  ["uncool.", "harsh, dude."],
        "kuchipatchi":  ["WAH!! i was just hungry!", "MEAN!!"],
        "tarakotchi":   ["...wasn't being bad...", "*hurt sleep*"],
        "default":      ["*looks hurt*"],
    },
    "lights_off": {
        "default":      ["*settling in*", "good night..."],
    },
    "lights_on": {
        "default":      ["*blinks*", "morning?"],
    },
    "hatch": {
        "default":      ["hello world!", "*emerges*", "i'm here!"],
    },
    "death": {
        "default":      ["*fades away*"],
    },
    "asleep": {
        "default":      ["zzz...", "*dreams*", "*soft snoring*"],
    },
    "hungry": {
        "default":      ["i'm hungry...", "feed me!", "tummy rumbling..."],
    },
    "sad": {
        "default":      ["i'm sad...", "play with me?", "*sigh*"],
    },
    "sick": {
        "default":      ["*cough cough*", "i don't feel good...", "achoo!"],
    },
    "dirty": {
        "default":      ["clean me!", "this is gross", "*holds nose*"],
    },
    "calling": {
        "default":      ["hey!", "look at me!", "psst!"],
    },
}


def _pick(table: dict, character: str, rng: random.Random | None = None) -> str:
    rng = rng or random
    options = table.get(character) or table.get("default") or [""]
    return rng.choice(options) if options else ""


def reaction(action: str, character: str, rng: random.Random | None = None) -> str:
    """Return a character-flavoured one-liner for the given action key."""
    table = REACTIONS.get(action)
    if not table:
        return ""
    return _pick(table, character, rng)


def idle(character: str, state: str | None = None, rng: random.Random | None = None) -> str:
    """Pick a random idle chatter line. `state` overrides character with
    a mood-specific bucket — e.g. "hungry", "sad", "asleep"."""
    rng = rng or random
    if state and state in REACTIONS:
        return _pick(REACTIONS[state], character, rng)
    options = IDLE.get(character) or [""]
    return rng.choice(options) if options else ""


def label(character: str) -> str:
    return CHARACTERS.get(character, {}).get("label", character)


def trait(character: str) -> str:
    return CHARACTERS.get(character, {}).get("trait", "")
