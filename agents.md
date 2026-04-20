cats interpreter assistant app

all new features must show the version number in the message aswell so i can easily verify if im running the app in the right version
after implementing feat, run tests, if satisfied, refactor, cleanup, and if confident, push to repo. do other things that you consider appropriate. do not push an app that crashes? didnt think i had to write that one out.
as a general rule express yourself in a tldr manner. as a rule im working (on call) while coding, so my brainspace is narrow tiny sliver.
try to keep this and other md files tldr, organized, and try very hard not to destroy or modify my instructions unless you are pretty sure it will not destroy ux.
[] completed tasks should be moved to a completed tasks section at the bottom of the file, and the section should be collapsible.
[] dont be too hasty in considering tasks complete, i have had several instances where you declared a task complete and it was not, and i had to go back and forth with you to get it right. 

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
[] maximising workspace and minimizing things that eat workspace is the rule. that is, translation and transcription should take 80% of screen, scoreboard 20%, 

CURRENT ISSUES
[] when speakers speeaks too long, message is split, this is good as it makes for easier reading, but has two problems
[] sometimes it seems that on message split the translation is garbled, an existing tranlsation destroyed. in general do not destroy transaltions
[] word count is split, so if user speaks more than 40 worsd, it actually says 40 then 10, when the actual wordcount is clearly more than that... 
[] when app window is refreshed during active call, although we are in call app is not connecte, so icon shouldn be red as in connected, but rather yellow or sth, and main view should remind user to click and get app connected to other tab again. otherwise i have to press disconnect recojnnect, and that meesses the call timer and i lose all translations. double jeopardy.
1. any time 9 or 10 digits are said back to back, group them. phone numbers are read out as separate numbers, 3 3 2 3 2 3 8 2 76 is clearly a phone number. it is important to not lose phone numbers, so if you detect a phone number and then get another transcription or translation, keep them together or sth.
that should be solved by a simple one liner

2. keep trackof how long ive been working wo breaks. 

3. collapse view, show tools, show toolbar and edit scoreboard items show up with their one rows in expanded view. thris throws away 30# of the total screen space. big nono. all 4 buttons should be in the same row, if they even have a row at all

4. pinned reference doesnt need a spaced announced banner wasting screentime at all time. simply color code a pinned message when there is one pinned, and thats it, in fact, move the pin emoji to the middle so it doesnt mesage space


MAINVIEW (where transcription and translation happens)
[] space should be used as effectively as possible
  [] do not waste v space w things like spa and eng. use color coding to do that.
1. any time 9 or 10 digits are said back to back, group them. phone numbers are read out as separate numbers, 3 3 2 3 2 3 8 2 76 is clearly a phone number 
that should be solved by a simple one liner

SCOREBOARD GUIDELINES
2. keep trackof how long ive been working wo breaks. 
[] Subsctract break time from total of 90 per day.
[] keep track of how late i logged in compared to log in time of 9am
[] tell me how late i should stay after my shift end of 18hs to compensate. that is, at what time i should log off.
[] Add little outlines and toggleable labels to every element in the scoreboard, so its easy to understand how they are organized and can be moved into a better manner. if you think a grid with a toggle to rearrange elements can be done, im ggame. specially see if such configurations can be saved in a way that you can read them so we can make them the default in the future.

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

[ ] maximizing workspace and minimizing things that eat workspace is the rule. translation and transcription 80%, scoreboard 20%.

<details>
<summary><b>Completed Tasks</b></summary>

- [x] translation trigger: 10+ words and punctuation (dot, comma, ?) force request (v3.9.1)
- [x] condensed view should contain (mins/target, $/total for day/month)
- [x] daily and monthly min amts can be edited from condensed view (Click pills)
- [x] progress bar says literal hours left and est workable hours left
- [x] msgs can be pinned so they dont scroll away
- [x] avail starts running at 9am and stops at 00hs
- [x] popover that shows up if you highlight a word and wait a bit for dictionary
- [x] all numbers should be highlighted, click to auto copy
- [x] all numbers should be written in numbers, not string (1-90, tens, teens)
- [x] intermediary goals (12 step goals): Level 1 (Floor), Level 2 (Growth), Level 3 (Legend)
</details>
