cats interpreter assistant app

CORE VALUES
- keep your messages brief, i can seldom dedicate more htan 10% attention to this.
- code as if for a toddler, simple, clear, organize, anottated, and in all manners try to economize tokens, it makes no sense to set a data center on fire to change a font on an invisible sub menu.
- this is a transcription app: 80% of viewport must be occupied by actual transcription and translation
- the remaining 20% is for keeping track, of this its key that i meet my monthly target, and for that i need to see how much i have to work per day, how much i am working per day, and how much time i have left,
-after implementing a feature, if satisfied, refactor, cleanup, run tests, and if confident, push to repo. do other things that you consider appropriate. do not push an app that crashes? didnt think i had to write that one out.
- app should look great in 900 by 600 pixels, and scale up from there.
- all version must have a version number clearly visible in the upper right corner to be sure im looking for new features in the version that actually has them xd.
- set and run tests after implementing features
- cleanup, refactor, document, commment
- dont push version that explode. hahaha.
- if features and ap works, then commit push.
- proposed changes should show precisely what changes, from what to whay. for example, a moment ago i requested adding percentages on the scoreboard, cited one metric as an example, and only the cited metric had a porcentage added, when it was clear it was all of them. so if i request a change i have to see what is actually going to be done before having to stop production to test something that should never have got so far.

MAINVIEW (where transcription and translation happens)
[] space should be used as effectively as possible
  [] do not waste v space w things like spa and eng. use color coding to do that.



TRANSLATION GUIDELINES
[] a poor translation is better than no translation
[] dont burn through free tiers. you say you run 54 translation engines at the same time but all i see is "bueno" and that, 54 seconds too late.
[] if the user speaks a lot, break up message and transalte by parts. i just had a 60 word message, the transcription was split in two and when that happened the transpation for the second part came through but the first part had "bueno". that didnt work.


SOUNDSCAPE INTERPRETER
[] when we press connect and call starts a sound like a purse opening is played. 
[] every minute the sound of earning one coin is played
[] every succeeding minute the sound of earning another coin in a proportionally richer sound
[] on complete call a sound like a proportional stack of coins crashing into a purse is played

good friday
[] soundboard doesnt work
  [] patients hear it breaking up really bad or not at all
  [] there should be a simple way to check if a soundboard greeting sucks. for example, if i send it to deepgram, it would fail to transcribe, and probably flag it as poor quality audio. 
  [] soundboard greetings should have a health bar, from unacceptable to peaches with intermediate steps. 
  [] again, there must be simple ways to check the "legibility" of speech soundboard greetings. 
  [] i have used voicemod prerecorded greetings for a while with zero problems. when i have problems with voicemod greetings i can find out at once because when i myself hear them they suck. but here i hear them they sound fine but when i play them to the patient they very vocally express that they suck.

[] expanded scoreboard is a mess
  [] a key button never sued. 
  [] auto mux en es also rarely used, also has no hide button
  [] zap stream button does nothing
  [] sound check bag min1 min 2 bill gem are overlapping current call and breakt time making it hard to read
  [] the expand collapse and sabe button take their houwn v space, we cant afford to waste v space with a single button....
  [] there is a bar that has livestream show tools auto off stop ai clear 40 word lomit. from all those show tools is the only one i actually use, and only for two reasons
  [] to see sesion notes and write
  [] to make background visible. backgrounds are invisible by default and become bisible when i press show tools.
  [] soundboard still doesnt work. when i press a prerecorded greeting my patients scream in pain.


CURRENT INBOX

[x] condensed view should contain
  [x][x] todays current mins / target mins
  [x][x] todays current $$ / total $$
  [x][x] months current mins / target mins
  [x][x] months current $$ / total $$

[x] daily and monthly min amts can be edited from condensed view. (Click pills)
[x] the progress bar now says literal hours left, it should also say est workable hours left.
[x] msgs can be pinned so they dont scroll away
[x] avail starts running at 9am and stops at 00hs

[x] popover that shows up if you highlight a word and wait a bit for dictionary. 
[x] all numbers should be highlighted, when you click they auto copy. 
[x] all numbers should be written in numbers, not string (1-90, tens, teens).

[x] intermediary goals (12 step goals):
  [X] Level 1 (Floor - 5500m): 1375m, 2750m, 4125m, 5500m
  [X] Level 2 (Growth - 11000m): 6875m, 8250m, 9625m, 11000m
  [X] Level 3 (Legend - 16500m): 12375m, 13750m, 15125m, 16500m
