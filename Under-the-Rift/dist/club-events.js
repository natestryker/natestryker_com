// Original situations retain stable IDs for existing saves.
const groups=[
['Team dynamics',[
['Two voices in review','{player} and {other} disagree about who should lead objective calls.'],['A joke lands badly','A running team joke has started frustrating {player}.'],['The quiet meeting','{player} has stopped contributing to post-scrim discussion.'],['Credit for the win','{other} feels their setup work went unnoticed after the last series.'],['Different practice habits','{player} wants quiet practice; {other} prefers open discussion.'],['A difficult apology','{player} wants help clearing the air with a teammate.']],
[['Hold a guided team conversation','Communication +0.6; familiarity +2',{communication:.6,bond:2}],['Arrange a relaxed team evening','Form +2; costs $1,500',{form:2,cost:1500}],['Tell them to settle it alone','50%: Form +1. Otherwise Form −2',{form:1,risk:.5,badForm:-2}]]],
['Community',[
['A local fan meetup','A nearby gaming café invites your roster to meet supporters.'],['Fan questions','Supporters have sent questions for {player} to answer on stream.'],['An academy showcase','Fans want to see what your academy prospects can do.'],['A charity exhibition','A charity organizer offers your club a friendly exhibition slot.'],['A first autograph','A young fan has traveled to meet {player} after practice.'],['Community coaching night','The fan club asks your players to teach a short workshop.']],
[['Make time for the fans','Form +2; fatigue +3',{form:2,fatigue:3}],['Send rested volunteers','Form +1; club funds +$1,000',{form:1,money:1000}],['Schedule a long promotional stream','Earn $4,000; fatigue +7',{money:4000,fatigue:7}]]],
['Scrims',[
['A stronger scrim partner','A leading team offers an unusually challenging practice block.'],['The repeated strategy','Your scrim opponent keeps using a setup you cannot solve.'],['A cancelled block','Your scheduled scrim partner has cancelled at short notice.'],['A promising early lead','The roster wants to review a scrim they nearly closed out.'],['An unconventional opponent','A practice team is using unfamiliar role combinations.'],['A scrim rematch','{player} asks to immediately replay a frustrating scrim.']],
[['Run a focused review','Macro +0.6; fatigue +1',{macro:.6,fatigue:1}],['Play a short experimental block','Mechanics +0.4; Teamfighting +0.4; fatigue +3',{mechanics:.4,teamfighting:.4,fatigue:3}],['Grind through extra games','All skills +0.5; fatigue +9',{all:.5,fatigue:9}]]],
['Player questions',[
['Finding a voice','{player} asks how to speak up without interrupting calls.'],['A new responsibility','{player} wants to take more responsibility in reviews.'],['A confidence question','{player} asks whether the team still believes in them.'],['Learning from a veteran','{player} wants a regular mentoring session with {other}.'],['An honest assessment','{player} asks for candid feedback on their recent play.'],['A long-term goal','{player} wants help planning their next step as a professional.']],
[['Give specific, supportive feedback','Form +2; Communication +0.4',{form:2,communication:.4}],['Build an individual learning plan','All skills +0.35; costs $1,000',{all:.35,cost:1000}],['Set a demanding public target','65%: Form +3. Otherwise Form −3',{form:3,risk:.35,badForm:-3}]]],
['Recovery',[
['A restless night','Several players mention that they slept poorly before practice.'],['A crowded calendar','The team has had little downtime between obligations.'],['A quiet day requested','{player} asks for a day away from competitive queues.'],['Travel fatigue','A trip to an event venue has left the roster tired.'],['Late-night review','The review session is running well past its planned finish.'],['An empty afternoon','A schedule change opens up a free afternoon for the team.']],
[['Protect a recovery block','Fatigue −12; Form +1',{fatigue:-12,form:1}],['Use light review only','Fatigue −6; Macro +0.3',{fatigue:-6,macro:.3}],['Keep the demanding schedule','All skills +0.4; fatigue +7',{all:.4,fatigue:7}]]],
['Academy',[
['The eager rookie','An academy player asks to sit in on first-team review.'],['A prospect breakthrough','The academy coach spots a new strength in a young player.'],['An academy rivalry','Two prospects are pushing each other hard in practice.'],['The first big mistake','A rookie is dwelling on a costly error in a development match.'],['A development workshop','The academy staff propose an extra fundamentals session.'],['A senior mentor','{other} volunteers to spend time with the academy squad.']],
[['Fund the development session','Academy skills +0.8; costs $2,000',{academy:.8,cost:2000}],['Pair rookies with veterans','Academy skills +0.4; Communication +0.3',{academy:.4,communication:.3}],['Keep the academy independent','Academy Form +2',{academyForm:2}]]],
['Strategy',[
['A new opening plan','The analyst has found a different way to approach the early game.'],['An opponent tendency','Your staff notice that an opponent repeats the same river setup.'],['A disputed objective call','The team is split on when to give up a contested objective.'],['A side-lane opportunity','{player} suggests a more flexible side-lane strategy.'],['A late-game checklist','The team wants a simpler set of late-game priorities.'],['A pocket strategy','{other} has an idea they would like to test in practice.']],
[['Test it in a short block','Macro +0.6; Teamfighting +0.3; fatigue +2',{macro:.6,teamfighting:.3,fatigue:2}],['Write a clear shared plan','Communication +0.5; familiarity +1',{communication:.5,bond:1}],['Overhaul the approach immediately','70%: Macro +1. Otherwise Form −2',{macro:1,risk:.3,badForm:-2}]]],
['Facilities',[
['A noisy practice room','Construction near the practice room is breaking concentration.'],['A spare review monitor','Staff can buy a second display for group review.'],['A better chair setup','Several players ask to improve their practice seating.'],['A room reshuffle','The players suggest changing where everyone sits during practice.'],['A quiet review space','A nearby studio offers a private room for your reviews.'],['A practice-room upgrade','A small equipment upgrade could make sessions more comfortable.']],
[['Pay for the improvement','Costs $3,000; fatigue −6; Form +1',{cost:3000,fatigue:-6,form:1}],['Reorganize the existing setup','Communication +0.3; fatigue −2',{communication:.3,fatigue:-2}],['Postpone it and add practice','Mechanics +0.3; fatigue +4',{mechanics:.3,fatigue:4}]]],
['Media',[
['A difficult interview','A reporter wants {player} to discuss a recent mistake.'],['A prediction segment','A broadcast invites your roster to predict the next round.'],['A documentary visit','A camera crew requests access to one practice session.'],['A viral clip','A clip of {other} is attracting more attention than expected.'],['An open microphone','The broadcast asks a player to explain team communication.'],['An honest team update','Fans are asking for a statement about the club’s progress.']],
[['Prepare the players together','Communication +0.4; Form +1',{communication:.4,form:1}],['Keep the appearance brief','Earn $1,500; fatigue +1',{money:1500,fatigue:1}],['Promise a dominant performance','60%: Form +3. Otherwise Form −3',{form:3,risk:.4,badForm:-3}]]],
['Team activities',[
['A team dinner','{player} proposes dinner together after practice.'],['A different game','The roster wants to play a cooperative game for a change.'],['The weekend walk','{other} suggests a short outing away from screens.'],['A shared playlist','The team is choosing music for the practice room.'],['A welcome for the rookie','The players want to make a new teammate feel included.'],['A small milestone','A player has reached a personal milestone worth recognizing.']],
[['Make it a proper team occasion','Familiarity +3; costs $1,500',{bond:3,cost:1500}],['Keep it casual and short','Form +1; fatigue −3',{form:1,fatigue:-3}],['Turn it into a competitive challenge','Teamfighting +0.4; fatigue +3',{teamfighting:.4,fatigue:3}]]],
['Individual practice',[
['A mechanics routine','{player} has found a drill they want to add to practice.'],['Reviewing a rival','{player} asks to study a stronger opponent’s replays.'],['A stubborn habit','A player keeps repeating a small, fixable mistake.'],['The extra queue session','{other} wants to keep playing after the scheduled block.'],['A fresh perspective','An outside coach offers a short technical workshop.'],['A role-specific drill','Staff have prepared a specialized drill for the starting roster.']],
[['Build a focused session','Mechanics +0.7; fatigue +2',{mechanics:.7,fatigue:2}],['Mix drills with reflection','Macro +0.4; Mechanics +0.3',{macro:.4,mechanics:.3}],['Push for a marathon session','Mechanics +1; fatigue +10',{mechanics:1,fatigue:10}]]],
['Leadership',[
['A new shotcaller','{player} wants to try leading a practice game.'],['A veteran’s advice','{other} has a suggestion for how the team handles mistakes.'],['A split decision','The roster wants clarity on who makes the final call.'],['A captain’s responsibility','A player asks what the captain should do outside matches.'],['The review format','The team wants a more useful way to discuss losses.'],['Leading by example','A teammate has been quietly helping others prepare.']],
[['Give them a guided leadership role','Communication +0.7; 20% chance to gain Captain',{communication:.7,trait:'Captain',traitChance:.2}],['Let everyone contribute','Familiarity +2; Macro +0.3',{bond:2,macro:.3}],['Demand immediate authority','65%: Communication +1. Otherwise Form −2',{communication:1,risk:.35,badForm:-2}]]]
];
const originalEvents=groups.flatMap(([category,scenarios,choices],g)=>scenarios.map(([title,text],i)=>({id:`org-${g}-${i}`,category,title,text,choices:choices.map(([label,effect,mods])=>({label,effect,mods:{...mods}}))})));

// Personal situations have specific choices and smaller, targeted consequences.
const personalGroups = [
['Player questions','◎','player',[
['A notebook full of doubts','{player} has written down every mistake from the series, but cannot name one thing they did well.','Find three good decisions together'],
['The comparison trap','{player} keeps comparing their progress to a younger rival.','Set a personal benchmark'],
['A call home','{player} asks to leave review early for an important family call.','Protect the call and catch up later'],
['A difficult birthday','{player} hoped the team would remember their birthday.','Organize a small surprise'],
['The backup plan','{player} worries that taking a day off means losing their place.','Explain the rotation plan privately'],
['Reading every reply','{player} has been refreshing critical social media replies all morning.','Mute replies and review the actual game']
],['Listen first','Form +3; fatigue −2',{form:3,fatigue:-2}],['Work through a concrete plan','Macro +0.5; Form +1',{macro:.5,form:1}],['Use blunt motivation','65%: Form +4. Otherwise Form −2',{form:4,risk:.35,badForm:-2}]],
['Team dynamics','⇄','pair',[
['Two different tempos','{player} wants to force fights while {other} asks for another wave.','Agree on one shared engage signal'],
['A replay paused twice','{player} and {other} keep stopping the same replay at different moments.','Let each explain their perspective'],
['The missing thank-you','{other} stayed late to help {player}, who never acknowledged it.','Arrange a private conversation'],
['A desk between friends','{player} and {other} ask to practice beside each other.','Trial the new seating for one block'],
['The broken promise','{player} missed a duo session that mattered to {other}.','Set a realistic shared schedule'],
['A surprising partnership','{player} and {other} find they solve review puzzles well together.','Give the pair a joint assignment']
],['Make time for the duo','Communication +0.5; pair familiarity +4',{communication:.5,bond:4}],['Keep it light','Form +2; pair familiarity +2',{form:2,bond:2}],['Let competition settle it','60%: Mechanics +0.6. Otherwise Form −2',{mechanics:.6,risk:.4,badForm:-2}]],
['Individual practice','⌖','player',[
['The missed cannon drill','{player} identifies an avoidable pattern in their farming.','Design a ten-minute last-hit drill'],
['A borrowed warm-up','{player} wants to test a rival’s warm-up routine.','Try the routine for a short session'],
['Mouse sensitivity doubts','{player} wants to change sensitivity after one poor game.','Compare settings in a controlled drill'],
['The first five minutes','{player} asks for feedback only on their opening lane.','Review three opening lanes'],
['The replay bookmark','{player} saved a precise moment they do not understand.','Reconstruct the decision step by step'],
['The practice plateau','{player} has repeated the same drill without improving.','Replace it with a narrower exercise']
],['Focused practice','Mechanics +0.8; fatigue +2',{mechanics:.8,fatigue:2}],['Watch before repeating','Macro +0.5; fatigue −2',{macro:.5,fatigue:-2}],['Chase a personal record','Mechanics +1.1; fatigue +8',{mechanics:1.1,fatigue:8}]],
['Leadership','⚑','player',[
['A nervous first review','{player} offers to present a replay but is afraid of getting it wrong.','Co-present the first replay'],
['A captain needs a break','{player} feels responsible for every disagreement.','Delegate one responsibility'],
['A clear voice in chaos','{player} made a useful call when everyone else was talking.','Build a repeatable calling routine'],
['Teaching without lecturing','{player} wants to help rookies without sounding superior.','Practice asking useful questions'],
['A hand raised late','{player} waits until everyone leaves before sharing a good idea.','Give them the opening slot next review'],
['The uncomfortable feedback','{player} spots a teammate’s recurring error but avoids mentioning it.','Rehearse constructive feedback privately']
],['Guided responsibility','Communication +0.7; 25% chance of Empathetic',{communication:.7,trait:'Empathetic',traitChance:.25}],['Study a good example','Macro +0.5; Form +1',{macro:.5,form:1}],['Lead the whole session alone','65%: Communication +1. Otherwise Form −2',{communication:1,risk:.35,badForm:-2}]],
['Recovery','☾','player',[
['An overloaded evening','{player} scheduled solo queue, review and a stream on the same evening.','Cancel one obligation'],
['Lunch at the desk','{player} has skipped proper breaks all week.','Protect a screen-free lunch'],
['The noisy hotel room','{player} cannot rest because their room faces a busy road.','Arrange a quieter room'],
['One more queue','{player} says one more ranked game will fix their mood.','End the session with a short walk'],
['A weekend invitation','{player} wants to see old friends on the free afternoon.','Keep the afternoon free'],
['The early arrival','{player} is first in every morning but visibly running out of energy.','Move their start time later']
],['Protect recovery','Fatigue −14; Form +2',{fatigue:-14,form:2}],['A lighter schedule','Fatigue −7; Macro +0.3',{fatigue:-7,macro:.3}],['Keep the optional session','Mechanics +0.6; fatigue +6',{mechanics:.6,fatigue:6}]],
['Academy','◇','academy',[
['The rookie review channel','Prospects ask for a private place to share questions without embarrassment.','Create a weekly question session'],
['A promising substitute','The academy coach wants a prospect to rehearse first-team responsibilities.','Run a first-team shadow session'],
['A lost practice recording','A prospect forgot to record their best scrim.','Reconstruct it with the coach'],
['A prospect’s first interview','An academy player has been invited to a small local interview.','Rehearse a few honest answers'],
['The academy captain vote','The prospects want to select their own practice captain.','Let them explain their nominations'],
['A narrow champion comfort zone','The academy coach wants prospects to try unfamiliar class matchups.','Fund a guided matchup workshop']
],['Staff-supported development','Academy skills +0.7; costs $1,500',{academy:.7,cost:1500}],['Let the prospects lead','Academy skills +0.3; Academy Form +2',{academy:.3,academyForm:2}],['Raise the difficulty','Academy skills +1; costs $3,000',{academy:1,cost:3000}]],
['Community','♡','player',[
['A fan’s handmade sign','{player} receives a photo of a handmade sign from a longtime supporter.','Send a short personal thank-you'],
['The hometown club','A small club in {player}’s hometown asks for a video message.','Record a friendly greeting'],
['A shy visitor','A young visitor wants to ask {player} a question but cannot find the words.','Give them a quiet moment together'],
['A coaching scholarship','{player} wants to offer a short lesson to a community tournament winner.','Support the one-to-one lesson'],
['The first fan art','Someone draws {player} as their favorite champion class.','Share it with credit'],
['A beginner’s mistake','{player} is asked to explain a beginner error without mocking it.','Record a patient walkthrough']
],['Personal connection','Form +3; Communication +0.2',{form:3,communication:.2}],['Share the moment with the team','Form +2; fatigue −1',{form:2,fatigue:-1}],['Expand it into a paid appearance','Earn $2,500; fatigue +5',{money:2500,fatigue:5}]],
['Media','◉','player',[
['An out-of-context quote','A short clip makes {player} sound harsher than they intended.','Publish the missing context calmly'],
['The rivalry headline','A reporter wants {player} to insult an upcoming opponent.','Offer a respectful competitive answer'],
['An awkward live question','{player} is asked to criticize their own teammate on air.','Rehearse a team-first response'],
['The sponsored tutorial','A sponsor wants {player} to film a useful beginner lesson.','Plan a brief honest tutorial'],
['A stream without chat','{player} wants to stream practice without reading comments.','Trial a moderated stream'],
['A camera-free review','{player} is uncomfortable with a documentary camera during feedback.','Make the review private']
],['Protect the player’s voice','Form +2; Communication +0.4',{form:2,communication:.4}],['Use a prepared statement','Form +1; fatigue −2',{form:1,fatigue:-2}],['Take the provocative angle','60%: earn $4,000. Otherwise Form −3',{money:4000,risk:.4,badForm:-3}]],
['Scrims','⚔','pair',[
['A failed level-three dive','{player} and {other} disagree about why an early dive failed.','Rehearse the timing without opponents'],
['A silent reset','{player} and {other} reset at different times and lose control of the river.','Build a shared reset cue'],
['The lost flank angle','{player} needs {other} to hold attention a little longer.','Replay the setup from both viewpoints'],
['A useful losing lane','{player} asks {other} how to stay useful without resources.','Practice a low-resource scenario'],
['The wrong target call','{player} and {other} focus different opponents in a close fight.','Agree on two target priorities'],
['A clean disengage','{player} and {other} execute a surprisingly clean retreat.','Document what made the retreat work']
],['Practice the connection','Teamfighting +0.6; pair familiarity +3',{teamfighting:.6,bond:3}],['Compare both perspectives','Macro +0.5; Communication +0.3',{macro:.5,communication:.3}],['Repeat until it works','Teamfighting +1; fatigue +7',{teamfighting:1,fatigue:7}]],
['Strategy','⌘','player',[
['The overlooked ward','{player} notices a ward position that never gets checked.','Prepare a vision route'],
['A timing on the clock','{player} catches a recurring recall timing in opponent replays.','Make a short timing sheet'],
['The empty side lane','{player} wants to study when a side lane should be abandoned.','Compare two contrasting examples'],
['A resource bargain','{player} suggests giving up early farm to enable another role.','Test the resource trade in practice'],
['A safer path home','{player} spots a dangerous habit in post-fight rotations.','Mark safer exit routes'],
['An objective without a fight','{player} thinks pressure alone could win the next objective.','Build a pressure-first setup']
],['Turn the idea into a plan','Macro +0.8; fatigue +1',{macro:.8,fatigue:1}],['Explain it to another player','Communication +0.5; Macro +0.3',{communication:.5,macro:.3}],['Bet the practice block on it','70%: Macro +1.2. Otherwise Form −2',{macro:1.2,risk:.3,badForm:-2}]],
['Team activities','✦','team',[
['The cooking challenge','The roster suggests preparing dinner together instead of ordering in.','Book a shared cooking session'],
['A trivia rivalry','The players disagree about who knows the most team history.','Host a friendly trivia evening'],
['A board-game rematch','A cooperative board game exposed some funny communication habits.','Play again with rotating leaders'],
['The team photo wall','The staff find photographs from small moments across the split.','Let everyone choose a favorite'],
['A beginner sport','The roster wants to try a low-pressure activity none of them know.','Book a short beginner session'],
['The welcome tradition','Players want every new teammate to have a small welcome ritual.','Let the roster design the tradition']
],['Make time together','Familiarity +3; costs $1,000',{bond:3,cost:1000}],['Keep it simple','Form +1; fatigue −4',{form:1,fatigue:-4}],['Make it a charity broadcast','Earn $2,000; familiarity +1; fatigue +3',{money:2000,bond:1,fatigue:3}]],
['Facilities','⚙','team',[
['A warm practice room','The afternoon sun has made the room uncomfortable.','Install adjustable shades'],
['The missing spare headset','A failed headset reveals there are no reliable spares.','Buy a small spare kit'],
['A whiteboard full of clutter','Old notes are hiding the team’s current priorities.','Build a clear weekly board'],
['The tangled desk cables','Players keep bumping cables during practice.','Set aside time to tidy the desks'],
['The review-room echo','Players struggle to hear quiet voices in group review.','Add basic sound treatment'],
['A better break corner','The staff suggest a screen-free corner away from practice desks.','Create a simple rest space']
],['Make the practical improvement','Costs $2,000; fatigue −5; Form +1',{cost:2000,fatigue:-5,form:1}],['Use what you already have','Communication +0.3; fatigue −2',{communication:.3,fatigue:-2}],['Ask the sponsor to help','Earn $1,000; fatigue +2',{money:1000,fatigue:2}]]
];
export const EVENT_ICONS=Object.fromEntries(personalGroups.map(([category,icon])=>[category,icon]));
const personalEvents=personalGroups.flatMap(([category,icon,scope,scenarios,...choices],g)=>scenarios.map(([title,text,action],i)=>({id:`personal-${g}-${i}`,category,icon,scope,title,text,choices:choices.map(([label,effect,mods],j)=>({label:j===0?action:label,effect,mods:{...mods}}))})));
export const CLUB_EVENTS=[...originalEvents,...personalEvents];

// New deck entries append stable IDs; old careers keep their seen-event history.
const expansion=[
['Player routines','◷','player',[
['The warm-up notebook','{player} has started tracking which warm-ups lead to good games.','Build a repeatable routine'],
['The muted microphone','{player} realizes they often forget to announce cooldowns.','Practice short cooldown calls'],
['A review without blame','{player} asks to analyze a mistake without watching the chat reaction.','Review privately'],
['The overlong queue session','{player} keeps playing ranked after practice has ended.','Set a reasonable stopping point'],
['A different desk routine','{player} wants to change how they prepare before official games.','Test the routine in scrims'],
['One useful sentence','{player} wants a concise reminder to use when a match gets chaotic.','Write a personal reset cue'],
['The pressure of praise','{player} feels obliged to carry every game after a good interview.','Reset expectations together'],
['A calm arrival','{player} asks for a quieter pre-match arrival schedule.','Protect a quiet arrival window']
],['Support the routine','Form +2; fatigue −3',{form:2,fatigue:-3}],['Try a focused drill','Mechanics +0.5; fatigue +2',{mechanics:.5,fatigue:2}],['Leave it entirely to the player','75%: Form +2. Otherwise Form −1',{form:2,risk:.25,badForm:-1}]],
['Duo projects','⇄','pair',[
['A shared replay folder','{player} and {other} want to save examples of their best coordinated plays.','Build the duo library'],
['Two different engage clocks','{player} goes in before {other} is ready to follow.','Agree on an engage countdown'],
['The first-word rule','{player} and {other} keep starting calls simultaneously.','Practice a clear speaking order'],
['The rescue habit','{other} keeps trying to rescue {player} from lost fights.','Define when to disengage'],
['A useful disagreement','{player} and {other} have different ideas about a successful scrim.','Compare both replay perspectives'],
['The paired review request','{player} wants an extra replay session with {other}.','Schedule a short duo review'],
['An unfamiliar combo','{player} and {other} see an opportunity to coordinate their niches better.','Test their timing together'],
['The silent reset','{player} and {other} reset separately and lose map tempo.','Rehearse synchronized recalls']
],['Coach the partnership','Communication +0.4; familiarity +3',{communication:.4,bond:3}],['Let them practice alone','Teamfighting +0.4; fatigue +2',{teamfighting:.4,fatigue:2}],['Run an extra long duo block','Familiarity +5; fatigue +7',{bond:5,fatigue:7}]],
['Academy pathways','◇','academy',[
['The first scouting note','An academy player asks what their original scout report said.','Explain progress with examples'],
['A promotion timeline','The academy coach asks for clearer criteria for a first-team call-up.','Publish a development checklist'],
['The observer seat','A prospect wants to observe the first team during an official series.','Arrange an observer briefing'],
['A small leadership role','The academy needs someone to organize review notes.','Rotate the responsibility'],
['The fundamentals week','Academy staff propose a week focused on wave management.','Fund the focused week'],
['A prospect presentation','An academy player volunteers to explain a strategy to the main roster.','Give the prospect the floor'],
['The development plateau','The academy coach sees effort but little visible improvement.','Review the learning plan'],
['A practice partner gap','The academy struggles to find opponents near its level.','Help arrange a suitable block']
],['Invest in the pathway','Academy skills +0.6; costs $1,500',{academy:.6,cost:1500}],['Encourage steady progress','Academy Form +2',{academyForm:2}],['Arrange a difficult showcase','Academy skills +0.9; costs $3,000',{academy:.9,cost:3000}]],
['Club logistics','▣','team',[
['The delayed meal delivery','Dinner will arrive after the next review session starts.','Move review after dinner'],
['A rehearsal room booking','The venue offers a short stage rehearsal slot.','Book the rehearsal'],
['The duplicate calendar','Staff and players have different practice times in their calendars.','Agree on one shared calendar'],
['The noisy hotel corridor','Your practice room sits beside a busy hotel event.','Find a quieter room'],
['A missing adapter','A key display cannot connect before group review.','Use a simple backup setup'],
['The transit detour','Road works make the trip to the venue longer than expected.','Leave early and shorten review'],
['An empty sponsor slot','A sponsor cancels an appearance and frees up an hour.','Give the roster the hour back'],
['The forgotten breaks','The practice schedule has slowly lost its planned breaks.','Restore short breaks']
],['Make the practical fix','Fatigue −5; costs $1,000',{fatigue:-5,cost:1000}],['Ask the team to coordinate','Communication +0.3',{communication:.3}],['Keep the full schedule','All skills +0.25; fatigue +4',{all:.25,fatigue:4}]],
['Fan connections','★','player',[
['The handmade sign','A supporter sends {player} a handmade sign after a difficult week.','Share a personal thank-you'],
['An old clip resurfaces','An early-career clip of {player} is being shared by fans.','Reflect on how far they have come'],
['The beginner question','A new fan asks {player} to explain their role without jargon.','Record a short explanation'],
['A hometown watch party','Fans from {player}’s hometown plan to watch the next series together.','Send a message of thanks'],
['The thoughtful fan letter','A letter explains how {player} inspired someone to join a local team.','Let the player respond privately'],
['A small community tournament','An amateur organizer asks {player} to present a prize online.','Make time for a brief appearance'],
['The fan-art folder','Staff have collected artwork celebrating {player}.','Show the player the collection'],
['An unexpected milestone','{player} reaches a personal streaming milestone without noticing.','Celebrate briefly with the team']
],['Make room for the moment','Form +2',{form:2}],['Arrange a community segment','Earn $1,500; fatigue +2',{money:1500,fatigue:2}],['Expand it into a long stream','Earn $3,000; fatigue +5',{money:3000,fatigue:5}]],
['Review experiments','⌕','team',[
['The two-minute review','An analyst proposes reviewing one mistake in only two minutes.','Try the focused format'],
['The hidden information replay','Staff can pause replays before new vision appears.','Practice predicting enemy positions'],
['The winning-game review','Players only review losses and miss mistakes in victories.','Review a messy win'],
['The objective countdown','The roster struggles to prepare before an objective appears.','Rehearse the final sixty seconds'],
['The quiet replay','Staff suggest watching a fight once without commentary.','Let players form their own observations'],
['The role-swap explanation','Players are asked to explain a teammate’s job during a fight.','Run the perspective exercise'],
['The three-call limit','An analyst wants to reduce overlapping calls during skirmishes.','Practice concise communication'],
['The lost lead archive','Staff have gathered examples of leads the team failed to close.','Identify one repeated mistake']
],['Use the new review method','Macro +0.4; Communication +0.3',{macro:.4,communication:.3}],['Apply it in a short scrim','Teamfighting +0.5; fatigue +2',{teamfighting:.5,fatigue:2}],['Redo the entire practice block','All skills +0.4; fatigue +7',{all:.4,fatigue:7}]]
];
for(const [g,[category,icon,scope,scenarios,...choices]] of expansion.entries())for(const [i,[title,text,action]] of scenarios.entries())CLUB_EVENTS.push({id:`club-v9-${g}-${i}`,category,icon,scope,title,text,choices:choices.map(([label,effect,mods],j)=>({label:j===0?action:label,effect,mods:{...mods}}))});
