import { themeKeywords, TMDB_THEME_IDS, TMDB_GENRE_IDS } from "./constants.js";
import { getSimilarityScore } from "./textHelper.js";

export const scoreAndRank = (
  candidates,
  intent,
  profileStats = {},
  anchors = null,
  reviewsCount = 0,
) => {
  const anchorList = (
    Array.isArray(anchors)
      ? anchors
      : anchors
        ? [anchors]
        : intent.anchorTitles || intent.extractedReferenceTitles || []
  )
    .filter(Boolean)
    .map((t) => String(t).trim());

  const reqActors = (
    Array.isArray(intent?.actors)
      ? intent.actors
      : Array.isArray(intent?.extractedActors)
        ? intent.extractedActors
        : intent?.extractedActor
          ? [intent.extractedActor]
          : []
  )
    .filter(Boolean)
    .map((a) => String(a).toLowerCase().trim());

  const sportsRegex =
    /\b(sport|sports|football|soccer|basketball|baseball|tennis|athlete|athletics|coach|champion|championship|tournament|olympic|olympics|stadium|pitch|wrestler|wrestling|boxer|boxing|quarterback|touchdown|nfl|fifa|premier\s*league|world\s*cup|gridiron|super\s*bowl|underdog\s*athlete|nascar|formula\s*1|f1|motorsport|swimming|swimmer|grand\s*prix|le\s*mans|speedway)\b/i;

  const superheroRegex =
    /\b(superhero|superheroes|super\s*hero|super\s*heroes|superpower|superpowers|super\s*human|mutant|mutants|marvel|dc\s*comics|comic\s*book|avengers|batman|superman|iron\s*man|thor|captain\s*america|spider[- ]man|spiderman|x-men|wolverine|deadpool|guardians\s*of\s*the\s*galaxy|justice\s*league|justice\s*society|wonder\s*woman|flash|aquaman|black\s*panther|doctor\s*strange|thanos|infinity\s*war|endgame|gotham|dark\s*knight|man\s*of\s*steel|shazam|ant-man|daredevil|punisher|venom|hulk|peacemaker|the\s*boys|invincible|homelander|green\s*lantern|suicide\s*squad)\b/i;

  const timeTravelRegex =
    /\b(time travel|time-travel|time loop|time-loop|timelines?|space-time|wormhole|temporal|time machine|grandfather paradox|butterfly effect|quantum leap|alternate timeline|travel back in time|travel to the past|travel to the future|relativity|time dilation|delorean|marty mcfly|predestination|looper|twelve monkeys|tenet|donnie darko|coherence|primer|about time|butterfly effect|source code)\b/i;

  const twistRegex =
    /\b(plot twists?|twist ending|unexpected twist|shocking twist|crazy plot twists?|twists?|mind-bending|mind bending|secrets?|deception|conspiracy|illusion|simulation|reality|subconscious|hallucination|puzzle|mind game|unreliable narrator|amnesia|identity twist|double life|unpredictable|can'?t predict|mind[- ]blowing)\b/i;

  const magicRegex =
    /\b(magic|magical|sorcery|sorcerer|sorceress|witch|witches|witchcraft|wizard|wizards|mage|mages|spell|spells|grimoire|alchemist|alchemy|mana|caster|servant|holy grail|homunculus|magic user|black magic|arcane|necromancer|grimoires|magical girl|madoka|fate\/zero|overlord)\b/i;

  const nonMagicAnimeRegex =
    /\b(titan|titans|colossal|survey corps|wall maria|eren yeager|death note|shinigami|light yagami|ryuk|notebook)\b/i;

  const crowdHorrorRegex =
    /\b(jump scare|slasher|paranormal|haunted house|demon|possession|curse|ghost|creature|cabin in the woods|killer|masked killer|evil dead|scream|insidious|talk to me|conjuring|quiet place|smile|sinister|it\b|m3gan|lights out|ouija|annabelle|nun|barbarian|terrifier|don't breathe|hereditary|black phone|get out|us\b|saw\b|final destination|cabin)\b/i;

  const crowdHorrorTitles =
    /\b(the conjuring|talk to me|scream|insidious|evil dead|a quiet place|smile|barbarian|sinister|it\b|don't breathe|the black phone|lights out|hereditary|m3gan|annabelle|the nun|terrifier|get out|us\b)\b/i;

  const hauntedTitlesRegex =
    /\b(the conjuring|the conjuring 2|insidious|hereditary|sinister|the haunting in connecticut|poltergeist|the amityville horror|amityville|the others|paranormal activity|ouija|lights out|annabelle|the nun|talk to me|barbarian|the babadook|babadook|the shining|the grudge|the ring|house on haunted hill|the orphanage|woman in black|evil dead rise|the haunting of hill house|hill house|bly manor)\b/i;

  const hauntedThemesRegex =
    /\b(haunted house|cursed house|haunted family|cursed family|possession|demonic possession|demon|demons|evil spirit|evil presence|paranormal|supernatural|curse|exorcism|poltergeist|ghost|ghosts|creepy house|old house|entity|haunting)\b/i;

  const darkComedyTitlesRegex =
    /\b(in bruges|fargo|parasite|the menu|knives out|glass onion|jojo rabbit|three billboards|the banshees of inisherin|snatch|lock, stock|pulp fiction|burn after reading|dr\. strangelove|american psycho|the wolf of wall street|birdman|the lobster|the favourite|poor things|kiss kiss bang bang|the nice guys|seven psychopaths|thank you for smoking|heathers|withnail and i|death of stalin|the death of stalin|triangle of sadness|wild tales|barry|succession|fargo|the white lotus|beef|Atlanta|fleabag|bojack horseman)\b/i;

  const darkComedyThemesRegex =
    /\b(dark comedy|black comedy|morbid humor|dark humor|satire|satirical|cynical|macabre|deadpan|absurd|twisted humor|gallows humor|murder|hitman|hitmen|crime|dysfunctional)\b/i;

  const heistRegex =
    /\b(heist|robbery|bank robbery|bank heist|plan a robbery|big robbery|vault|safe crack|safecracker|caper|getaway driver|steal money|ocean's eleven|ocean's twelve|ocean's thirteen|the town|baby driver|inside man|heat|the italian job|den of thieves|logan lucky|reservoir dogs|point break|now you see me|snatch|lock, stock|tower heist|the score|rififi|dog day afternoon|fast five|inception|money heist|armored)\b/i;

  const revengeMafiaRegex =
    /\b(equalizer|the equalizer|john wick|taken|revenge|vigilante|death wish|hitman|assassin|man on fire|law abiding citizen|sicario|peppermint|wrath of man)\b/i;

  const crimeFamilyTitlesRegex =
    /\b(the godfather|the godfather part ii|the godfather: part ii|godfather|scarface|goodfellas|american gangster|the irishman|casino|the departed|a bronx tale|donnie brasco|once upon a time in america|peaky blinders|boardwalk empire|the sopranos|blow|gotti|snatch|gangs of new york|road to perdition|miller's crossing|narcos|city of god|black mass|the untouchables|carlito's way)\b/i;

  const crimeFamilyThemesRegex =
    /\b(crime family|mob family|mafia family|mafia empire|crime empire|building an empire|organized crime|gangster empire|godfather|corleone|mobster|gangster|kingpin|drug lord|criminal empire|underworld|syndicate|cartel|boss of bosses|don\b)\b/i;

  const mbaTitlesRegex =
    /\b(inception|the matrix|the matrix reloaded|matrix|edge of tomorrow|tenet|mad max: fury road|mad max fury road|terminator 2|terminator 2: judgment day|t2|minority report|interstellar|avatar|everything everywhere all at once|looper|upgrade|source code|v for vendetta|district 9|children of men|aliens|blade runner 2049|oldboy|dune|dune: part two|dune part two)\b/i;

  const mbaThemesRegex =
    /\b(high concept|dream within a dream|simulation|virtual reality|time loop|reality|subconscious|mind-bending|dystopian future|apocalyptic road|quantum|manipulation of time|parallel universe|time paradox|cyberspace)\b/i;

  const bMovieRegex =
    /\b(iron sky|virtuosity|sharknado|mega shark|transmorphers|age of tomorrow|alien vs hunter|titanic ii|the ritual killer|ritual killer)\b/i;

  const pureComedyTitlesRegex =
    /\b(superbad|the hangover|21 jump street|22 jump street|tropic thunder|trading places|step brothers|we're the millers|bridesmaids|game night|horrible bosses|anchorman|dumb and dumber|liar liar|meet the parents|borat|old school|wedding crashers|ted\b|ted 2|good boys|blockers|tag\b|this is the end|zombieland|shaun of the dead|hot fuzz|the dictator|white chicks|rush hour|bad boys|groundhog day|airplane!|monty python)\b/i;

  const kidsMascotRegex =
    /\b(sonic|sonic the hedgehog|minions|despicable me|alvin and the chipmunks|smurfs|paddington|spongebob|sponge bob|pokemon|detective pikachu|lego|garfield|peter rabbit|space jam|men in black|ghostbusters|shazam|ant-man|deadpool|marvel|dc comics)\b/i;

  const darkAnimeTitlesRegex =
    /\b(attack on titan|death note|monster|berserk|tokyo ghoul|chainsaw man|vinland saga|parasyte|dororo|hellsing|psycho-pass|made in abyss|neon genesis evangelion|devilman crybaby|shinsekai yori|claymore|ergo proxy|texhnolyze|bungo stray dogs|bungou stray dogs|death parade|shiki|another|higurashi|shinigami|light yagami|johan liebert|dark gathering)\b/i;

  const lightAnimeRegex =
    /\b(the seven deadly sins|nanatsu no taizai|fairy tail|konosuba|black clover|danmachi|is it wrong to try to pick up girls|quintessential quintuplets|gotoubun no hanayome|my next life as a villainess|hamefura|no game no life|sword art online|welcome to demon school|radiant|seven deadly sins|rent-a-girlfriend|kanojo okarishimasu)\b/i;

  const sitcomTitlesRegex =
    /\b(friends|the office|brooklyn nine-nine|brooklyn 99|modern family|how i met your mother|himym|parks and recreation|parks & rec|seinfeld|community|the big bang theory|malcolm in the middle|schitt's creek|new girl|scrubs|that '70s show|ted lasso|superstore|it's always sunny in philadelphia|arrested development|silicon valley|two and a half men|frasier|cheers|will & grace|curb your enthusiasm|broad city)\b/i;

  const teenSoapRegex =
    /\b(o11ce|once\b|violetta|soy luna|patito feo|casi angeles|victorious|icarly|hannah montana|zoey 101|big time rush|disney channel|disney xd|nickelodeon|teen sitcom|tween|high school musical|saved by the bell|suite life|wizards of waverly place|sam & cat|henry danger|good luck charlie|shake it up|austin & ally|kc undercover|liv and maddie|teen drama|adolescence|high school football|youth academy)\b/i;

  const psychTitlesRegex =
    /\b(shutter island|fight club|prisoners|memento|se7en|seven|black swan|the prestige|zodiac|primal fear|the machinist|enemy|gone girl|the game|split|nightcrawler|the sixth sense|jacob's ladder|cure|identity|triangle|coherence|oldboy|mulholland drive|taxi driver|vertigo|misery|the silence of the lambs)\b/i;

  const psychThemesRegex =
    /\b(psychological thriller|paranoia|delusion|sanity|insanity|hallucination|asylum|mental institution|amnesia|unreliable narrator|mind game|mind games|schizophrenia|obsession|psychosis|investigator|detective|dark secret|manipulation|gaslighting)\b/i;

  const slasherRegex =
    /\b(slasher|masked killer|high school massacre|teen slasher|gorefest|chainsaw|splatter|cannibal|there's someone inside your house)\b/i;

  const feelGoodRomComRegex =
    /\b(romantic comedy|rom-com|romcom|feel-good|feel good|sweet|lighthearted|heartwarming|wedding|dating|fake dating|crush|falling in love|meet cute|matchmaker|vacation romance|love triangle|charming|crazy rich asians|about time|palm springs|set it up|the proposal|10 things i hate about you|clueless|notting hill|when harry met sally|how to lose a guy in 10 days|always be my maybe|50 first dates|hitch|crazy, stupid, love|friends with benefits|she's the man|easy a|to all the boys|pretty woman|mamma mia|legally blonde|love, simon|love simon|love, rosie|love rosie|anyone but you|the holiday|bridget jones|letters to juliet|27 dresses)\b/i;

  const tragicRomanceRegex =
    /\b(concentration camp|holocaust|world war|nazi|fascist|execution|terminal illness|cancer|dying|death|tragedy|tragic ending|bittersweet|melancholy|heartbreaking|depression|suicide|vietnam war|segregation|disability|life is beautiful|forrest gump|la la land|atonement|me before you|the fault in our stars|a walk to remember|brokeback mountain|requiem for a dream|titanic)\b/i;

  const experimentalRomanceRegex =
    /\b(dark comedy|black comedy|morbid|surreal|surrealist|bizarre|experimental|arthouse|grotesque|frankenstein|reanimation|corpse|sex experiment|sexual awakening|fetish|prostitution|weird|quirky indie|yorgos lanthimos|wes anderson|poor things|the lobster|the favourite|moonrise kingdom|the grand budapest hotel|dogtooth|killing of a sacred deer|bones and all|beau is afraid)\b/i;

  const historicalWarRegex =
    /\b(war|world war|wwii|ww2|wwi|battle|battles|huge battles|epic battles|soldier|soldiers|army|infantry|combat|trenches|normandy|d-day|vietnam|crusade|crusades|crusaders|gladiator|gladiators|roman empire|medieval|kingdom|samurai|spartan|spartans|ancient warfare|saving private ryan|kingdom of heaven|braveheart|1917|dunkirk|hacksaw ridge|apocalypse now|platoon|full metal jacket|black hawk down|fury|the patriot|troy|300|master and commander|letters from iwo jima|bridge on the river kwai|all quiet on the western front|enemy at the gates|the bridge on the river kwai|paths of glory|the thin red line|midway|we were soldiers)\b/i;

  const swordThemesRegex =
    /\b(sword|swords|sword fight|blade|spear|shield|gladiator|gladiators|roman empire|ancient rome|ancient greece|spartan|spartans|crusade|crusades|crusaders|medieval|medieval warfare|knights|samurai|katana|feudal japan|kingdom|castle siege|chariot|arrow|arrows|bow|armor|broadsword|ancient warfare|ancient battles?|medieval armies|braveheart|troy|300|the last samurai|kingdom of heaven|the northman|the king|outlaw king|centurion|the eagle|red cliff|baahubali|alexander|spartacus|vikings|the last kingdom|vinland saga)\b/i;

  const modernWarCrimeRegex =
    /\b(world war|wwii|ww2|wwi|vietnam|nazi|hitler|pearl harbor|hacksaw ridge|unbroken|bridge on the river kwai|saving private ryan|dunkirk|1917|fury|platoon|full metal jacket|apocalypse now|black hawk down|enemy at the gates|machine gun|rifle|guns?|pistol|bullet|bullets|trench|trenches|normandy|d-day|air force|submarine|torpedo|bomber|tank|tanks|firearms|sniper|grenade|holocaust|all quiet on the western front|john wick|training day|equalizer|sicario|narcotics|lapd|police officer|detective|fbi|cia|swat|cartel|drug lord|mafia|gangster|hitman|assassin|car chase|heist|pirates of the caribbean|jack sparrow)\b/i;

  const trueCrimeRegex =
    /\b(documentary|docuseries|docu-series|true crime|investigative|real-life|archival|interviews?|unsolved mysteries|making a murderer|don't f\*\*k with cats|the jinx|night stalker|conversations with a killer|ted bundy|the staircase|wild wild country|keep sweet|tinder swindler|serial killer|homicide|cold case|forensic|fbi file|investigation discovery|murder trial|killer inside|evil genius|i am a killer|worst roommate ever|the act of killing|capturing the friedmans|paradise lost|the thin blue line)\b/i;

  const natureDocRegex =
    /\b(cosmos|astronomy|outer space|universe|planet earth|one strange rock|our planet|blue planet|wildlife|nature|animals?|ocean|oceans|earth|solar system|paleontology|dinosaur|climate|geology|evolution|space exploration|species|safari|national geographic|discovery channel|physics|quantum|biology)\b/i;

  const koreanTitlesRegex =
    /\b(signal|flower of evil|beyond evil|mouse|stranger|blind|tunnel|through the darkness|voice|save me|memorist|365: repeat the year|kairos|the guest|life on mars|nine: nine time travels|reset|the glory|extracurricular|squid game|mask girl)\b/i;

  const koreanThemesRegex =
    /\b(detective|police|serial killer|murder|investigation|corruption|revenge|conspiracy|crime syndicate|psychopath|unsolved case|prosecutor|courtroom|dark secret|suspense|thriller|mystery|hostage|twisted|plot twist|unpredictable)\b/i;

  const cuteAnimeTitlesRegex =
    /\b(kaguya-sama|love is war|horimiya|kimi ni todoke|my dress-up darling|toradora|the dangers in my heart|komi can't communicate|fruits basket|rascal does not dream|maid-sama|ouran|teasing master takagi|skip and loafer|tomo-chan|yamada-kun to lv999|bocchi the rock|wotakoi|tsuki ga kirei|my love story!!|ore monogatari|lovely complex|clannad|tamako love story|relife|nisekoi|romantic killer|golden time|saekano|tonikaku kawaii|fly me to the moon|pseudo harem|a sign of affection|blue box|aharen-san|shikimori's not just a cutie|angel next door spoils me rotten|my happy marriage)\b/i;

  const cuteAnimeThemesRegex =
    /\b(high school romance|first love|falling in love|wholesome|sweet romance|cute|crush|confession|school life|slice of life|heartwarming|friendship and romance|romantic comedy|shy|awkward romance)\b/i;

  const ecchiAnimeRegex =
    /\b(high school dxd|dxd|ecchi|harem|fanservice|fan service|hentai|erotic|borderline porn|kiss x sis|to love-ru|to love ru|monster musume|prison school|interspecies reviewers|yosuga no sora|shinmai maou|redo of healer|seikon no qwaser|valkyrie drive|queen's blade|shimoneta|testament of sister new devil|sekirei|freezing|heaven's lost property|rosario \+ vampire|ikkitousen|maken-ki|trinity seven|hybrid x heart|hundred\b|infinite stratos|date a live|danmachi|is it wrong to try to pick up girls in a dungeon|arrow of the orion|quintessential quintuplets|gotoubun no hanayome|my next life as a villainess|all routes lead to doom|hamefura|rent-a-girlfriend|kanojo okarishimasu|girlfriend, girlfriend|kanojo mo kanojo|domestic girlfriend|scum's wish|food wars|shokugeki no soma|fire force|goblin slayer|mushoku tensei|no game no life|sword art online|how not to summon a demon lord|arifureta|strike the blood|chivalry of a failed knight|the asterisk war|saekano)\b/i;

  const kidsAnimeRegex =
    /\b(doraemon|beyblade|pokemon|pokémon|digimon|yu-gi-oh|yugioh|duel monsters|bakugan|yo-kai watch|inazuma eleven|crayon shin-chan|shin chan|anpanman|chibi maruko-chan|hamtaro|precure|pretty cure|aikatsu|pripara|sonic x|medabots|duel masters|zatch bell|keroro|astro boy|hunter x hunter)\b/i;

  const sportsAnimeRegex =
    /\b(haikyuu?|kuroko|blue lock|slam dunk|hajime no ippo|diamond no ace|free!|run with the wind|aoashi|captain tsubasa|yowamushi pedal|ping pong the animation)\b/i;

  const retroAnimeRegex =
    /\b(ranma|urusei yatsura|maison ikkoku|kimagure orange road|city hunter|fist of the north star|touch\b)\b/i;

  const familyAnimTitlesRegex =
    /\b(coco|inside out|encanto|moana|zootopia|paddington|paddington 2|despicable me|toy story|finding nemo|finding dory|shrek|ratatouille|up\b|tangled|the incredibles|monsters, inc\.|monsters inc|how to train your dragon|frozen|sing\b|kung fu panda|madagascar|wall-e|spider-man: into the spider-verse|megamind|the lion king|beauty and the beast|aladdin|luca|soul\b|turning red|big hero 6|onward|tarzan|mulan)\b/i;

  const familyAnimThemesRegex =
    /\b(family|friendship|heartwarming|wholesome|magical|cozy|adventure|parents|children|kids|journey|disney|pixar|dreamworks|illumination)\b/i;

  const cyberpunkTitlesRegex =
    /\b(blade runner|blade runner 2049|ghost in the shell|akira|the matrix|dredd|upgrade|alita|alita: battle angel|cyberpunk|cyberpunk: edgerunners|robocop|total recall|minority report|altered carbon|ex machina|dark city|elysium|chappie|i am mother|i, robot|neuromancer|demolition man|johnny mnemonic|tron|tron: legacy|strange days|a\.i\. artificial intelligence|equilibrium|terminator|automata|district 9)\b/i;

  const cyberpunkThemesRegex =
    /\b(cyberpunk|dystopia|dystopian|cybernetic|cyborg|cyborgs|android|androids|robot|robots|replicants?|futuristic city|neon|neon lights|ruined future|post-apocalyptic|high-tech low-life|megacorporation|virtual reality|simulation|artificial intelligence|ai consciousness|cyber warfare|cyberspace|cyber crime|future noir|neo-tokyo|los angeles 2049|apocalyptic future)\b/i;

  const spaceTimeRegex =
    /\b(space exploration|astronaut|astronauts|nasa|deep space|black hole|mars\b|the martian|interstellar|apollo|spacecraft|orbit|jupiter|saturn|alien planet|space station|galaxy|star wars|back to the future|delorean|time machine|time travel|galactic)\b/i;

  const crowdComedyRegex =
    /\b(brooklyn nine-nine|the office|modern family|parks and recreation|we're the millers|superbad|the hangover|21 jump street|22 jump street|game night|ted lasso|how i met your mother|community|the big bang theory|crazy stupid love|step brothers|bridesmaids|horrible bosses|central intelligence|grown ups|liar liar|dumb and dumber|schitt's creek|superstore|new girl|scrubs|white chicks|rush hour|anchorman|tropic thunder|meet the parents|dodgeball|airplane!|tag\b|borat|spy\b|mean girls|malcolm in the middle|ted\b|bad boys)\b/i;

  const dramedyRegex =
    /\b(la la land|the grand budapest hotel|life is beautiful|forrest gump|birdman|her\b|lost in translation|the banshees of inisherin|parasite|jojo rabbit|wes anderson|bittersweet|melancholy|tragic ending|musical drama|existential|crying|suicide|death|dying|grief|depression)\b/i;

  const philoSpaceTitlesRegex =
    /\b(interstellar|arrival|2001: a space odyssey|2001 a space odyssey|contact|ad astra|first man|solaris|gravity|moon\b|sunshine|the fountain|annihilation|high life)\b/i;

  const philoSpaceThemesRegex =
    /\b(existential|meaning of life|humanity|philosophical|solitude|isolation in space|astronaut|space exploration|first contact|cosmos|relativity|time dilation|human existence|ponder|cosmic perspective|deep space)\b/i;

  const lightSpaceRegex =
    /\b(star wars|guardians of the galaxy|back to the future|space jam|men in black|galaxy quest|thor|space balls|space cowboys|the fifth element|armageddon|independence day|valerian|star trek)\b/i;

  const underdogTitlesRegex =
    /\b(the pursuit of happyness|pursuit of happyness|whiplash|rocky|creed|ford v ferrari|cobra kai|moneyball|million dollar baby|the fighter|cinderella man|slumdog millionaire|the social network|the wolf of wall street|jerry maguire|rush\b|blind side|coach carter|southpaw|warrior|air\b|good will hunting|rudy|remember the titans|invincible|hustle|king richard)\b/i;

  const underdogThemesRegex =
    /\b(underdog|rags to riches|from nothing|struggle|perseverance|overcome|overcoming|odds|boxing|fighter|champion|ambition|success|hustle|determination|wealth|poverty to|hard work|training|triumph|against all odds|self made|broke)\b/i;

  const darkSciFiTitlesRegex =
    /\b(dark|black mirror|severed|severance|westworld|altered carbon|the expanse|mr\. robot|mr robot|1899|devs|maniac|counterpart|silenced|silo|the peripheral|raised by wolves|3 body problem|fringe|orphan black|battlestar galactica|the handmaid's tale|snowpiercer|the 100|twelve monkeys|12 monkeys|legion|andor|foundation|alice in borderland|cyberpunk: edgerunners|psycho-pass|ergo proxy|serial experiments lain|steins;gate|texhnolyze|neon genesis evangelion)\b/i;

  const excludeHero =
    intent.excludedKeywords && intent.excludedKeywords.includes("9715");

  const wantsHero =
    !excludeHero &&
    ((intent.detectedKeywords &&
      intent.detectedKeywords.some((k) => k.name === "superhero")) ||
      /\b(superhero|superheroes|super\s*hero|super\s*heroes|marvel|dc|comic\s*book|mcu|dceu)\b/i.test(
        intent.originalText || "",
      ));

  const baseFloor = reqActors.length > 0 ? 6.0 : 6.8;
  const ratingFloor = Math.max(baseFloor, intent.minRating || baseFloor);

  return candidates
    .map((item) => {
      let s_intent = 0;
      let s_user = 50;
      let s_rating = (item.vote_average || 0) * 10;
      let penalties = 0;

      const title = (item.title || item.name || "").toLowerCase();
      const overview = (item.overview || "").toLowerCase();
      const genres = (item.genres || []).map((g) => g.toLowerCase());
      const genreIds = (item.genre_ids || []).map(Number);
      const votes = item.vote_count || 0;
      const avg = item.vote_average || 0;
      const lang = (item.original_language || "").toLowerCase();

      const relDate = item.release_date || item.first_air_date || "";
      const year = relDate ? parseInt(relDate.split("-")[0], 10) : 0;

      const rawKws = Array.isArray(item.keywords)
        ? item.keywords
        : item.keywords?.keywords || item.keywords?.results || [];

      const kwIds = rawKws
        .map((k) => (typeof k === "object" ? Number(k?.id) : parseInt(k, 10)))
        .filter(Boolean);

      const kwStrings = rawKws
        .map((k) => (typeof k === "string" ? k : k?.name || ""))
        .filter(Boolean)
        .map((k) => k.toLowerCase().trim());

      const rawCast = Array.isArray(item.cast)
        ? item.cast
        : Array.isArray(item.credits?.cast)
          ? item.credits.cast
          : Array.isArray(item.actors)
            ? item.actors
            : [];

      const castNames = rawCast
        .map((c) =>
          typeof c === "string" ? c : c?.name || c?.original_name || "",
        )
        .filter(Boolean)
        .map((n) => n.toLowerCase().trim());

      const searchBlob =
        `${title} ${overview} ${item.tagline || ""} ${kwStrings.join(" ")} ${castNames.join(" ")}`.toLowerCase();

      const lookupType = item.media_type === "movie" ? "movie" : "tv";
      const genreMap = TMDB_GENRE_IDS[lookupType] || TMDB_GENRE_IDS.movie;

      if (intent.detectedGenres.length > 0) {
        const scores = intent.detectedGenres.map((genre) => {
          if (genre === "sports") {
            if (sportsRegex.test(title) || sportsRegex.test(overview))
              return 100;
            if (genres.some((g) => g.includes("sport"))) return 90;
            return 0;
          }

          const expectedId = genreMap[genre];
          if (genreIds.length > 0 && genreIds[0] === expectedId) return 100;
          if (
            genreIds.includes(expectedId) ||
            genres.some((g) => g.includes(genre))
          ) {
            return 70;
          }
          if (
            genre === "scifi" &&
            (genreIds.includes(878) ||
              genreIds.includes(10765) ||
              genres.some(
                (g) => g.includes("sci-fi") || g.includes("science fiction"),
              ))
          ) {
            return 85;
          }
          if (overview.includes(genre)) return 30;
          return 0;
        });

        const topGenreScore = Math.max(...scores);
        const extraHits = scores.filter((s) => s > 0).length - 1;
        s_intent = Math.min(
          100,
          topGenreScore + (extraHits > 0 ? extraHits * 15 : 0),
        );
      } else {
        s_intent = 60;
      }

      let actorBoost = 0;
      if (reqActors.length > 0) {
        const actorMatch =
          Boolean(item.matched_actor || item.isActorMatch || item.character) ||
          reqActors.some(
            (reqA) =>
              castNames.some(
                (cName) =>
                  cName === reqA ||
                  cName.includes(reqA) ||
                  getSimilarityScore(cName, reqA) >= 0.82,
              ) || searchBlob.includes(reqA),
          );

        if (actorMatch) {
          s_intent = Math.max(s_intent, 95);
          s_intent = Math.min(100, s_intent + 35);
          actorBoost = 18;
        } else if (intent.detectedGenres.length === 0) {
          s_intent = Math.max(s_intent, 90);
          actorBoost = 10;
        }
      }

      if (intent.extractedDirector || intent.isNowPlaying) {
        s_intent = Math.max(s_intent, 90);
      }
      if (intent.detectedLanguage && lang === intent.detectedLanguage) {
        s_intent = Math.min(100, s_intent + 25);
      }

      const wantsTime =
        intent.detectedKeywords.some((k) => k.name === "time travel") ||
        /\b(time travel|time loop|timeline|wormhole)\b/i.test(
          intent.originalText,
        );

      const wantsTwist =
        intent.detectedKeywords.some((k) => k.name === "plot twist") ||
        intent.hasTwistKeywords ||
        /\b(plot twists?|twist ending|crazy plot twists?|can'?t predict|unpredictable|mind[- ]blowing)\b/i.test(
          intent.originalText,
        );

      const wantsMindBend =
        intent.detectedKeywords.some((k) => k.name === "mind bending") ||
        /\b(mind[- ]bending|psychological puzzle)\b/i.test(intent.originalText);

      const hasTime =
        kwIds.includes(4379) ||
        timeTravelRegex.test(overview) ||
        timeTravelRegex.test(title);

      const hasTwist =
        kwIds.some((id) =>
          [12565, 9663, 10714, 9715, 11160, 9882].includes(id),
        ) ||
        twistRegex.test(overview) ||
        twistRegex.test(title);

      if (wantsTime && hasTime) s_intent = Math.min(100, s_intent + 50);
      if ((wantsTwist || wantsMindBend) && hasTwist) {
        s_intent = Math.min(100, s_intent + 40);
      }

      if (intent.isDarkAnime) {
        const darkHit =
          darkAnimeTitlesRegex.test(title) ||
          /\b(dark fantasy|psychological|gore|brutal|tragedy|grim|bleak|demons?|disturbing|survival)\b/i.test(
            overview,
          ) ||
          genreIds.includes(10765) ||
          genreIds.includes(9648);

        if (darkHit) s_intent = Math.min(100, s_intent + 60);
      }

      const wantsDarkCom =
        intent.isDarkComedy ||
        intent.detectedKeywords.some((k) => k.name === "dark comedy");

      if (wantsDarkCom) {
        const darkComHit =
          darkComedyTitlesRegex.test(title) ||
          kwIds.includes(9716) ||
          kwIds.includes(9717) ||
          (genreIds.includes(35) &&
            (genreIds.includes(80) ||
              genreIds.includes(53) ||
              genreIds.includes(18) ||
              genreIds.includes(9648)) &&
            darkComedyThemesRegex.test(searchBlob));

        if (darkComHit) {
          s_intent = Math.min(100, s_intent + 60);
        } else if (
          genreIds.includes(35) &&
          (genreIds.includes(80) || genreIds.includes(53))
        ) {
          s_intent = Math.min(100, s_intent + 40);
        }
      }

      if (intent.isPureComedy) {
        const pureHit =
          pureComedyTitlesRegex.test(title) ||
          (genreIds[0] === 35 &&
            !genreIds.includes(18) &&
            !genreIds.includes(10749) &&
            avg >= 7.0);

        if (pureHit) s_intent = Math.min(100, s_intent + 60);
      }

      const wantsSitcom =
        intent.isSitcom ||
        intent.detectedKeywords.some((k) => k.name === "sitcom") ||
        anchorList.some((aTitle) =>
          /\b(friends|the office|how i met your mother|himym|modern family|brooklyn 99|brooklyn nine-nine|new girl|parks and recreation|seinfeld|community|schitt's creek|scrubs|two and a half men|the big bang theory|big bang theory)\b/i.test(
            aTitle,
          ),
        ) ||
        (intent.isComfortComedy && !intent.isPureComedy) ||
        /\b(sitcoms?|sit-coms?|situational comed(?:y|ies))\b/i.test(
          intent.originalText,
        );

      if (wantsSitcom) {
        const iconicSitcom = sitcomTitlesRegex.test(title);
        const primaryCom = genreIds.length > 0 && genreIds[0] === 35;

        if (iconicSitcom) {
          s_intent = Math.min(100, s_intent + 60);
        } else if (
          item.media_type === "tv" &&
          primaryCom &&
          !genreIds.includes(18)
        ) {
          s_intent = Math.min(100, s_intent + 40);
        }
      }

      if (intent.isMindBlowingAction) {
        const mbaHit =
          mbaTitlesRegex.test(title) ||
          (mbaThemesRegex.test(overview) &&
            (genreIds.includes(28) || genreIds.includes(878))) ||
          (genreIds.includes(28) && genreIds.includes(878) && avg >= 7.5);

        if (mbaHit) s_intent = Math.min(100, s_intent + 60);
      }

      if (intent.isHauntedHorror) {
        if (
          hauntedTitlesRegex.test(title) ||
          hauntedThemesRegex.test(overview) ||
          kwIds.includes(3358)
        ) {
          s_intent = Math.min(100, s_intent + 65);
        } else if (kwIds.includes(10292) || genreIds.includes(27)) {
          s_intent = Math.min(100, s_intent + 45);
        }
      }

      const cuteAnimeHit =
        cuteAnimeTitlesRegex.test(title) ||
        cuteAnimeThemesRegex.test(overview) ||
        kwIds.some((id) => [9799, 9840, 158718].includes(id)) ||
        (genreIds.includes(16) &&
          genreIds.includes(35) &&
          genreIds.includes(10749));

      if (intent.isCuteAnimeRomCom) {
        if (cuteAnimeTitlesRegex.test(title)) {
          s_intent = Math.min(100, s_intent + 75);
        } else if (cuteAnimeHit && year >= 2006) {
          s_intent = Math.min(100, s_intent + 60);
        }
      }

      if (intent.isCrimeFamily) {
        const mobHit =
          crimeFamilyTitlesRegex.test(title) ||
          crimeFamilyThemesRegex.test(overview) ||
          kwIds.includes(10391) ||
          kwIds.includes(242);

        if (mobHit) s_intent = Math.min(100, s_intent + 60);
      }

      const swordIds = String(TMDB_THEME_IDS.swordWarfare)
        .split("|")
        .map((id) => parseInt(id, 10));

      const isSwordHit =
        kwIds.some((id) => swordIds.includes(id)) ||
        swordThemesRegex.test(overview) ||
        swordThemesRegex.test(title);

      if (intent.isSwordWarfare && isSwordHit) {
        s_intent = Math.min(100, s_intent + 75);
      }

      if (intent.isUnderdog) {
        const underdogHit =
          underdogTitlesRegex.test(title) ||
          underdogThemesRegex.test(overview) ||
          genreIds.includes(18) ||
          genres.some((g) => g.includes("sport") || g.includes("drama"));

        if (underdogHit) s_intent = Math.min(100, s_intent + 60);
      }

      if (intent.isKorean && (wantsTwist || intent.hasTwistKeywords)) {
        if (lang === "ko") {
          const koTwistHit =
            koreanTitlesRegex.test(title) ||
            (koreanThemesRegex.test(overview) &&
              (genreIds.includes(9648) || genreIds.includes(80)));

          if (koTwistHit) s_intent = Math.min(100, s_intent + 60);
        }
      } else if (intent.isKorean && lang === "ko") {
        const koHit =
          koreanTitlesRegex.test(title) ||
          koreanThemesRegex.test(overview) ||
          genreIds.includes(9648) ||
          genreIds.includes(80);

        if (koHit) s_intent = Math.min(100, s_intent + 45);
      }

      const wantsPsych =
        intent.isPsychologicalThriller ||
        intent.detectedKeywords.some(
          (k) => k.name === "psychological thriller",
        ) ||
        /\b(psychological thriller|mess with my head|mindfuck|mind game)\b/i.test(
          intent.originalText,
        );

      const psychHit =
        psychTitlesRegex.test(title) ||
        psychThemesRegex.test(overview) ||
        kwIds.some((id) => [10714, 12565, 9663].includes(id));

      if (wantsPsych && psychHit) {
        s_intent = Math.min(100, s_intent + 50);
      }

      const hasHeist =
        heistRegex.test(title) ||
        heistRegex.test(overview) ||
        kwIds.some((id) => [10051, 6492, 10292].includes(id));

      if (intent.isHeistRobbery && hasHeist) {
        s_intent = Math.min(100, s_intent + 60);
      }

      const cyberpunkHit =
        cyberpunkTitlesRegex.test(title) ||
        cyberpunkThemesRegex.test(overview) ||
        kwIds.some((id) => [12190, 4565, 2853, 156395].includes(id));

      if (intent.isCyberpunk && cyberpunkHit) {
        s_intent = Math.min(100, s_intent + 60);
      }

      const philoSciFiHit =
        philoSpaceTitlesRegex.test(title) ||
        (philoSpaceThemesRegex.test(overview) &&
          (genreIds.includes(878) || genreIds.includes(18)));

      if (intent.isPhilosophicalSciFi && philoSciFiHit) {
        s_intent = Math.min(100, s_intent + 60);
      }

      if (
        (intent.isComfortComedy || intent.isTiredMood) &&
        !intent.isPureComedy &&
        !wantsDarkCom &&
        !wantsSitcom
      ) {
        const laughHit =
          crowdComedyRegex.test(title) ||
          (genreIds.includes(35) && !genreIds.includes(18));

        if (laughHit) s_intent = Math.min(100, s_intent + 60);
      }

      const hasAnimAndFamily =
        (genreIds.includes(16) ||
          genres.some((g) => g.includes("animation"))) &&
        (genreIds.includes(10751) || genres.some((g) => g.includes("family")));

      const familyAnimHit =
        hasAnimAndFamily ||
        familyAnimTitlesRegex.test(title) ||
        (genreIds.includes(16) && familyAnimThemesRegex.test(overview));

      if (intent.isFamilyAnimation && familyAnimHit) {
        s_intent = Math.min(100, s_intent + 50);
      }

      const wantsRomCom =
        intent.isRomCom ||
        intent.detectedKeywords.some((k) => k.name === "rom-com") ||
        (/\b(sweet|light|lift my mood|feel[- ]good|rom-com|romcom|romantic comedy)\b/i.test(
          intent.originalText,
        ) &&
          (intent.detectedGenres.includes("romance") ||
            intent.detectedGenres.includes("comedy")));

      const hasRomAndCom =
        (genreIds.includes(35) || genres.some((g) => g.includes("comedy"))) &&
        (genreIds.includes(10749) || genres.some((g) => g.includes("romance")));

      const isRomComHit =
        hasRomAndCom ||
        feelGoodRomComRegex.test(title) ||
        feelGoodRomComRegex.test(overview) ||
        kwIds.some((id) => [9799, 158718, 3133].includes(id));

      if (wantsRomCom && isRomComHit) {
        s_intent = Math.min(100, s_intent + 50);
      }

      const hasWarOrHistory =
        genreIds.includes(10752) ||
        genreIds.includes(36) ||
        genres.some((g) => g.includes("war") || g.includes("history"));

      const isHistoricalHit =
        hasWarOrHistory ||
        historicalWarRegex.test(title) ||
        historicalWarRegex.test(overview) ||
        kwIds.some((id) => [11162, 233, 210103].includes(id));

      if (intent.isHistoricalWar && isHistoricalHit) {
        s_intent = Math.min(100, s_intent + 60);
      }

      const isDoc =
        genreIds.includes(99) ||
        genres.some((g) => g.includes("documentary")) ||
        trueCrimeRegex.test(title) ||
        trueCrimeRegex.test(overview);

      const hasCrimeSignal =
        trueCrimeRegex.test(title) ||
        trueCrimeRegex.test(overview) ||
        kwIds.some((id) => [10714, 9882, 9715].includes(id));

      const isTrueCrimeHit = isDoc && hasCrimeSignal;

      if (intent.isTrueCrimeDoc && isTrueCrimeHit) {
        s_intent = Math.min(100, s_intent + 60);
      }

      const wantsMagic =
        intent.detectedKeywords.some((k) => k.name === "magic") ||
        /\b(magic|magical|sorcery|sorcerer|witch|witches|witchcraft|wizard|wizards|mage|mages|spell|spells|alchemy)\b/i.test(
          intent.originalText,
        );

      const wantsDark =
        intent.wantsDark ||
        /\b(dark|grim|bleak|mature|disturbing|gothic|brutal|suffering)\b/i.test(
          intent.originalText,
        );

      const hasMagic =
        kwIds.includes(2343) ||
        kwIds.includes(9799) ||
        magicRegex.test(title) ||
        magicRegex.test(overview);

      if (wantsMagic && hasMagic) {
        s_intent = Math.min(100, s_intent + 40);
      }

      const hasSciFiId =
        genreIds.includes(878) ||
        genreIds.includes(10765) ||
        genres.some(
          (g) => g.includes("sci-fi") || g.includes("science fiction"),
        );

      if (wantsDark && !intent.isDarkAnime && !wantsDarkCom) {
        const darkRegex =
          /\b(dark|death|tragedy|grim|violent|psychological|gore|brutal|survival|sinister|curse|bloody|dark fantasy|macabre|demon|demons|dystopian|bleak|mystery|conspiracy|mind-bending)\b/i;
        if (
          darkSciFiTitlesRegex.test(title) &&
          intent.detectedGenres.includes("scifi")
        ) {
          s_intent = Math.min(100, s_intent + 55);
        } else if (
          (!intent.detectedGenres.includes("scifi") || hasSciFiId) &&
          (darkRegex.test(overview) ||
            darkRegex.test(title) ||
            genreIds.includes(27) ||
            genreIds.includes(53) ||
            genreIds.includes(9648))
        ) {
          s_intent = Math.min(100, s_intent + 30);
        }
      }

      if (intent.isHorrorNight) {
        const iconicHorror = crowdHorrorTitles.test(title);
        const crowdHorror =
          crowdHorrorRegex.test(overview) || crowdHorrorRegex.test(title);

        if (iconicHorror && year >= 2010) {
          s_intent = Math.min(100, s_intent + 50);
        } else if (crowdHorror && year >= 2010) {
          s_intent = Math.min(100, s_intent + 35);
        }
      }

      const isSciFiQuery =
        (intent.detectedGenres.includes("scifi") ||
          anchorList.some((aTitle) =>
            /interstellar|inception|arrival|contact|2001|tenet|prestige/i.test(
              aTitle,
            ),
          )) &&
        !intent.isCyberpunk;

      if (isSciFiQuery && hasSciFiId) {
        const spaceRegex =
          /\b(deep space|black hole|wormhole|space exploration|astronaut|astronauts|nasa|extraterrestrial|first contact|relativity|quantum|cosmos|cosmic|spacecraft|orbit|gravity|astrophysics|space mission|space flight|time travel|time loop|parallel universe|dimension|dream|subconscious|illusion|paradox|memory|mind-bending)\b/i;
        if (spaceRegex.test(overview) || spaceRegex.test(title)) {
          s_intent = Math.min(100, s_intent + 45);
        }
      }

      // User profile affinity (genres + keywords)
      let s_user_genre = 50;
      let s_user_kw = 20;
      let matched_user_keywords = [];

      const userGenres = profileStats?.genres || profileStats || {};
      const userKwsRaw = profileStats?.keywords || {};

      const userKws = {};
      for (const [k, v] of Object.entries(userKwsRaw)) {
        if (k && v !== undefined) {
          userKws[k.toLowerCase().trim()] = v;
        }
      }

      const kwCount = Object.keys(userKws).length;
      const hasGenres = Object.keys(userGenres).length > 0;

      if (reviewsCount >= 5 && (hasGenres || kwCount > 0)) {
        let genreSum = 0;
        let genreHits = 0;
        genres.forEach((g) => {
          const gKey = g.toLowerCase().trim();
          if (userGenres[gKey] !== undefined) {
            const val = userGenres[gKey];
            const outOf10 = val <= 5 ? val * 2 : val;
            genreSum += (outOf10 / 10) * 100;
            genreHits++;
          }
        });
        if (genreHits > 0) {
          s_user_genre = genreSum / genreHits;
        }

        const itemThemes = new Set();

        for (const [theme, data] of Object.entries(themeKeywords)) {
          const tKey = theme.toLowerCase().trim();
          const exactKw = kwStrings.some((kw) => kw === tKey);
          const termHit = data.terms.some((t) => {
            const termLower = t.toLowerCase().trim();
            return (
              new RegExp(`\\b${termLower}\\b`, "i").test(searchBlob) ||
              kwStrings.some((kw) => kw === termLower)
            );
          });

          if (exactKw || termHit) {
            itemThemes.add(tKey);
          }
        }

        if (
          userKws["plot twist"] &&
          (twistRegex.test(searchBlob) ||
            kwIds.includes(12565) ||
            kwStrings.some((k) => k === "plot twist" || k === "twist ending"))
        ) {
          itemThemes.add("plot twist");
        }

        if (
          userKws["psychological thriller"] &&
          (psychThemesRegex.test(searchBlob) ||
            kwIds.includes(10714) ||
            kwStrings.some(
              (k) => k === "psychological thriller" || k === "mind games",
            ))
        ) {
          itemThemes.add("psychological thriller");
        }

        if (
          userKws["time travel"] &&
          (timeTravelRegex.test(searchBlob) ||
            kwIds.includes(4379) ||
            kwStrings.some((k) => k === "time travel" || k === "time loop"))
        ) {
          itemThemes.add("time travel");
        }

        if (
          userKws["cyberpunk"] &&
          (cyberpunkThemesRegex.test(searchBlob) ||
            kwIds.includes(12190) ||
            kwStrings.some((k) => k === "cyberpunk" || k === "cyber-punk"))
        ) {
          itemThemes.add("cyberpunk");
        }

        matched_user_keywords = Array.from(itemThemes).filter((theme) => {
          const t = theme.toLowerCase().trim();
          return (
            userKws[t] !== undefined ||
            Object.keys(userKws).some((uk) => uk === t)
          );
        });

        if (kwCount > 0) {
          if (matched_user_keywords.length === 0) {
            s_user_kw = 20;
          } else {
            let kwSum = 0;
            matched_user_keywords.forEach((theme) => {
              const t = theme.toLowerCase().trim();
              const r = userKws[t] || 8.0;
              const normR = r <= 5 ? r * 2 : r;
              kwSum += (normR / 10) * 100;
            });

            const avgKw = kwSum / matched_user_keywords.length;
            let weight = 0.35;
            if (matched_user_keywords.length === 2) weight = 0.6;
            else if (matched_user_keywords.length >= 3) weight = 0.85;

            s_user_kw = Math.round(avgKw * weight);
          }

          s_user = Math.round(0.35 * s_user_genre + 0.65 * s_user_kw);
        } else {
          s_user = s_user_genre;
          s_user_kw = s_user_genre;
        }
      }

      const s_user_kw_bonus = s_user - s_user_genre;

      // Penalties and strict constraint enforcement
      let hardViolation = false;

      const lowRatingViolation = avg < ratingFloor;
      if (lowRatingViolation) {
        penalties += 60;
        hardViolation = true;
      }

      const isAnime =
        item.media_type === "anime" ||
        intent.targetType === "anime" ||
        (lang === "ja" && genreIds.includes(16));

      const hasEcchi =
        ecchiAnimeRegex.test(title) ||
        ecchiAnimeRegex.test(overview) ||
        kwIds.some((id) => [2858, 190370, 9716].includes(id)) ||
        kwStrings.some((k) =>
          /\b(ecchi|harem|fanservice|fan service|softcore|erotic|reverse harem)\b/i.test(
            k,
          ),
        );

      const ecchiViolation = (isAnime || intent.isCuteAnimeRomCom) && hasEcchi;

      if (ecchiViolation) {
        penalties += 95;
        hardViolation = true;
      }

      if (intent.excludeViolence) {
        const hasGore =
          genreIds.includes(27) ||
          /\b(gore|gory|slasher|bloody|brutal|massacre|serial killer|torture|ultra-violent|ultraviolent|splatter|mutilation|decapitation)\b/i.test(
            searchBlob,
          );
        if (hasGore) {
          penalties += 85;
          hardViolation = true;
        }
      }

      const wantsAnime =
        intent.wantsExplicitAnime ||
        intent.targetType === "anime" ||
        /\b(anime|manga)\b/i.test(intent.originalText || "");

      if (intent.isSwordWarfare && !wantsAnime && isAnime) {
        penalties += 90;
        hardViolation = true;
      }

      const sciFiViolation =
        intent.detectedGenres.includes("scifi") &&
        !hasSciFiId &&
        !darkSciFiTitlesRegex.test(title);

      if (sciFiViolation) {
        penalties += 80;
        hardViolation = true;
      }

      const modernInSword =
        intent.isSwordWarfare &&
        (modernWarCrimeRegex.test(title) ||
          modernWarCrimeRegex.test(overview) ||
          (genreIds.includes(80) && !isSwordHit) ||
          (!isSwordHit && !hasWarOrHistory));

      if (modernInSword) {
        penalties += 80;
        hardViolation = true;
      }

      if (intent.minYear && year > 0 && year < intent.minYear) {
        penalties += 65;
        hardViolation = true;
      }

      if (intent.maxYear && year > 0 && year > intent.maxYear) {
        penalties += 65;
        hardViolation = true;
      }

      if (
        Array.isArray(intent.strictFormats) &&
        intent.strictFormats.length > 0
      ) {
        if (intent.strictFormats.includes("silent")) {
          const isSilent =
            /\b(silent|silent film|silent movie|silent era|pantomime|intertitles)\b/i.test(
              searchBlob,
            ) ||
            (year > 0 && year <= 1931);
          if (!isSilent) {
            penalties += 80;
            hardViolation = true;
          }
        }
        if (intent.strictFormats.includes("black and white")) {
          const isBw =
            /\b(black and white|black & white|b&w|monochrome|noir)\b/i.test(
              searchBlob,
            ) ||
            (year > 0 && year <= 1960);
          if (!isBw) {
            penalties += 75;
            hardViolation = true;
          }
        }
      }

      if (intent.excludedTermsFromPrompt?.includes("detective")) {
        if (/\b(detective|police detective|lead detective)\b/i.test(title)) {
          penalties += 30;
        }
      }

      if (
        intent.excludedTermsFromPrompt &&
        intent.excludedTermsFromPrompt.length > 0
      ) {
        const hasExTerm = intent.excludedTermsFromPrompt.some((term) => {
          if (term === "detective") return false;
          if (term === "ecchi" || term === "harem") return hasEcchi;
          const rx = new RegExp(`\\b${term}\\b`, "i");
          return (
            rx.test(title) || rx.test(overview) || kwStrings.includes(term)
          );
        });
        if (hasExTerm) {
          penalties += 85;
          hardViolation = true;
        }
      }

      if (intent.excludedGenres && intent.excludedGenres.length > 0) {
        const hasExGenre = intent.excludedGenres.some((exG) => {
          if (exG === "family") {
            return (
              genreIds.includes(10751) ||
              genreIds.includes(10762) ||
              kidsAnimeRegex.test(title)
            );
          }
          const exId = genreMap[exG];
          return genreIds.includes(exId) || genres.includes(exG);
        });
        if (hasExGenre) {
          penalties += 75;
          hardViolation = true;
        }
      }

      if (intent.excludedGenres.includes("comedy")) {
        if (genreIds.includes(35) || genres.some((g) => g.includes("comedy"))) {
          penalties += 75;
          hardViolation = true;
        }
      }

      const hasHero =
        kwIds.includes(9715) ||
        superheroRegex.test(title) ||
        superheroRegex.test(overview);

      if (excludeHero && hasHero) {
        penalties += 85;
        hardViolation = true;
      }

      const hasSubIntent =
        intent.isHorrorNight ||
        intent.isCrimeHeist ||
        intent.isCrimeFamily ||
        intent.isHeistRobbery ||
        intent.isPsychologicalThriller ||
        intent.isRomCom ||
        intent.isCuteAnimeRomCom ||
        intent.isDarkAnime ||
        intent.isDarkComedy ||
        intent.isSitcom ||
        intent.isSwordWarfare ||
        intent.isHistoricalWar ||
        intent.isHauntedHorror ||
        intent.isMindBlowingAction ||
        intent.hasQualityFloor ||
        intent.isPureComedy ||
        intent.isTrueCrimeDoc ||
        intent.isKorean ||
        intent.hasTwistKeywords ||
        intent.isUnderdog ||
        intent.isFamilyAnimation ||
        intent.isCyberpunk ||
        intent.isPhilosophicalSciFi ||
        Boolean(intent.extractedDirector) ||
        reqActors.length > 0 ||
        intent.isNowPlaying ||
        intent.detectedKeywords.length > 0;

      if ((intent.detectedGenres.length > 0 || hasSubIntent) && s_intent < 75) {
        penalties += 40;
      }

      if (intent.detectedGenres.length > 0 && s_intent === 0) {
        penalties += 55;
      }

      if (intent.isDarkAnime) {
        const darkMasterpiece = darkAnimeTitlesRegex.test(title);
        if (
          !darkMasterpiece &&
          (lightAnimeRegex.test(title) ||
            kidsAnimeRegex.test(title) ||
            /\b(ecchi|cheerful|harem|fan-service|fanservice|lighthearted adventure)\b/i.test(
              overview,
            ) ||
            genreIds.includes(10762) ||
            genreIds.includes(10751))
        ) {
          penalties += 80;
          hardViolation = true;
        }
      }

      if (wantsSitcom) {
        const iconicSitcom = sitcomTitlesRegex.test(title);
        const primaryCom = genreIds.length > 0 && genreIds[0] === 35;

        if (!primaryCom && !iconicSitcom) penalties += 35;

        if (
          sportsRegex.test(title) ||
          sportsRegex.test(overview) ||
          kwIds.includes(6075) ||
          genres.some((g) => g.includes("sport"))
        ) {
          penalties += 50;
        }

        if (
          teenSoapRegex.test(title) ||
          teenSoapRegex.test(overview) ||
          genreIds.includes(10762) ||
          genreIds.includes(10766)
        ) {
          penalties += 55;
        }

        if (genreIds.includes(18) && !iconicSitcom) penalties += 30;
        if (votes < 400 && !iconicSitcom) penalties += 25;
      }

      if (intent.isPureComedy) {
        const iconicCom = pureComedyTitlesRegex.test(title);
        const primaryCom = genreIds.length > 0 && genreIds[0] === 35;

        if (lang !== "en" && !iconicCom) penalties += 40;
        if (!primaryCom && !iconicCom) penalties += 25;

        if ((genreIds.includes(28) || genreIds.includes(80)) && !iconicCom) {
          penalties += 20;
        }

        if (
          (genreIds.includes(18) ||
            genreIds.includes(53) ||
            dramedyRegex.test(title)) &&
          !iconicCom
        ) {
          penalties += 35;
        }

        if (avg < 7.0) {
          penalties += Math.min(40, Math.round((7.0 - avg) * 30));
        }

        if (
          genreIds.includes(10751) ||
          genreIds.includes(10762) ||
          genreIds.includes(16) ||
          kidsMascotRegex.test(title)
        ) {
          penalties += 55;
        }
      }

      if (
        (intent.hasQualityFloor || intent.isMindBlowingAction) &&
        !intent.isPureComedy &&
        !wantsSitcom &&
        reqActors.length === 0
      ) {
        if (avg < 7.0) {
          penalties += Math.min(35, Math.round((7.0 - avg) * 25));
        } else if (avg < 7.2) {
          penalties += 15;
        }

        if (bMovieRegex.test(title)) {
          penalties += 75;
          hardViolation = true;
        }

        if (votes < 500 && avg < 7.5) penalties += 20;
      }

      if (intent.isHauntedHorror) {
        if (
          genreIds.includes(10751) ||
          genreIds.includes(10762) ||
          genres.some((g) => g.includes("family") || g.includes("kids"))
        ) {
          penalties += 55;
        }

        if (genreIds.includes(35)) penalties += 35;

        const hauntedHit =
          hauntedTitlesRegex.test(title) ||
          hauntedThemesRegex.test(overview) ||
          genreIds.includes(27) ||
          kwIds.includes(3358) ||
          kwIds.includes(10292);

        if (!hauntedHit) penalties += 25;
      }

      if (intent.isCuteAnimeRomCom) {
        if (hasEcchi) penalties += 95;

        if (
          genreIds.includes(10762) ||
          kidsAnimeRegex.test(title) ||
          kidsAnimeRegex.test(overview)
        ) {
          penalties += 85;
        }

        if (
          sportsAnimeRegex.test(title) ||
          (kwIds.includes(6075) && !cuteAnimeTitlesRegex.test(title))
        ) {
          penalties += 55;
        }

        if (
          !intent.wantsClassic &&
          (retroAnimeRegex.test(title) || (year > 0 && year < 2005))
        ) {
          penalties += 35;
        }

        const hasRomance =
          cuteAnimeTitlesRegex.test(title) ||
          cuteAnimeThemesRegex.test(overview) ||
          kwIds.includes(9799) ||
          kwIds.includes(9840) ||
          kwIds.includes(158718) ||
          genreIds.includes(10749);

        if (!hasRomance) penalties += 35;
      }

      if (intent.isCrimeFamily) {
        if (
          genreIds.includes(10751) ||
          genreIds.includes(10762) ||
          genreIds.includes(16)
        ) {
          penalties += 45;
        }

        const mobHit =
          crimeFamilyTitlesRegex.test(title) ||
          crimeFamilyThemesRegex.test(overview) ||
          genreIds.includes(80) ||
          kwIds.includes(10391) ||
          kwIds.includes(242);

        if (!mobHit) penalties += 25;
      }

      if (intent.isTrueCrimeDoc) {
        if (!isDoc || !hasCrimeSignal) {
          penalties += !isDoc ? 60 : 55;
          hardViolation = true;
        }

        if (natureDocRegex.test(title) || natureDocRegex.test(overview)) {
          penalties += 95;
          hardViolation = true;
        }

        if (genreIds.includes(35) || genreIds.includes(878)) penalties += 40;
      }

      if (intent.isSwordWarfare && genreIds.includes(14) && !isSwordHit) {
        penalties += 60;
      }

      if (intent.isUnderdog) {
        if (
          genreIds.includes(27) ||
          (genreIds.includes(878) && !genreIds.includes(18)) ||
          genreIds.includes(14)
        ) {
          penalties += 30;
        }
      }

      if (intent.isKorean && lang !== "ko") {
        penalties += 55;
      }

      if (
        intent.detectedLanguage &&
        !intent.isKorean &&
        lang &&
        lang !== intent.detectedLanguage
      ) {
        penalties += 60;
        hardViolation = true;
      }

      if (wantsTwist || intent.hasTwistKeywords) {
        if (!hasTwist && !koreanTitlesRegex.test(title)) {
          penalties += 25;
        }
      }

      if (intent.isHeistRobbery) {
        if (revengeMafiaRegex.test(title) || revengeMafiaRegex.test(overview)) {
          penalties += 35;
        }

        if (!hasHeist) penalties += 35;

        if (
          kwIds.includes(9715) ||
          (genreIds.includes(878) && !/\binception|matrix\b/i.test(title))
        ) {
          penalties += 30;
        }
      }

      if (intent.isCyberpunk) {
        if (spaceTimeRegex.test(title) || spaceTimeRegex.test(overview)) {
          penalties += 35;
        }
        if (!cyberpunkHit) penalties += 25;
      }

      if (intent.isPhilosophicalSciFi) {
        if (lightSpaceRegex.test(title) || lightSpaceRegex.test(overview)) {
          penalties += 35;
        }
        if (genreIds.includes(35)) penalties += 30;
        if (!philoSciFiHit) penalties += 25;
      }

      if ((intent.isComfortComedy || intent.isTiredMood) && !wantsDarkCom) {
        if (genreIds.includes(18)) penalties += 35;

        if (dramedyRegex.test(title) || dramedyRegex.test(overview)) {
          penalties += 40;
        }

        if (
          genreIds.includes(10762) ||
          teenSoapRegex.test(title) ||
          teenSoapRegex.test(overview)
        ) {
          penalties += 45;
        }

        const explicitAnime =
          /\banime|manga\b/i.test(intent.originalText) ||
          intent.targetType === "anime";
        if (
          !explicitAnime &&
          (lang === "ja" ||
            item.media_type === "anime" ||
            genreIds.includes(16))
        ) {
          penalties += 45;
        }

        if (
          genreIds.includes(27) ||
          genreIds.includes(10752) ||
          genreIds.includes(9648)
        ) {
          penalties += 30;
        }
      }

      if (intent.isFamilyAnimation) {
        const explicitAnime = /\banime\b/i.test(intent.originalText);
        if (!explicitAnime && (lang === "ja" || kwIds.includes(210024))) {
          penalties += 40;
        }

        if (
          genreIds.includes(27) ||
          genreIds.includes(53) ||
          genreIds.includes(80)
        ) {
          penalties += 45;
        }

        if (!hasAnimAndFamily && !familyAnimTitlesRegex.test(title)) {
          penalties += 25;
        }
      }

      if (intent.isHistoricalWar) {
        if (!isHistoricalHit) penalties += 40;

        if (
          !intent.detectedGenres.includes("scifi") &&
          genreIds.includes(878)
        ) {
          penalties += 45;
        }

        if (
          kwIds.includes(9715) ||
          /\b(superhero|marvel|dc comics|avengers)\b/i.test(overview)
        ) {
          penalties += 45;
        }

        if (genreIds.includes(35) || genreIds.includes(27)) penalties += 25;
      }

      if (wantsRomCom) {
        if (
          experimentalRomanceRegex.test(title) ||
          experimentalRomanceRegex.test(overview) ||
          kwIds.includes(9716)
        ) {
          penalties += 35;
        }

        if (
          tragicRomanceRegex.test(title) ||
          tragicRomanceRegex.test(overview) ||
          genreIds.includes(10752) ||
          genreIds.includes(36)
        ) {
          penalties += 40;
        }

        if (genreIds.includes(18) && !hasRomAndCom) penalties += 25;
        if (!hasRomAndCom) penalties += 20;
      }

      if (wantsPsych) {
        if (slasherRegex.test(title) || slasherRegex.test(overview)) {
          penalties += 40;
        }
        if (!psychHit) penalties += 20;
      }

      if (intent.isHorrorNight) {
        if (!intent.wantsClassic && year > 0 && year < 2010) penalties += 25;
        if (genreIds.includes(35)) penalties += 35;
        if (votes < 1000) penalties += 25;

        const arthouseHorror =
          /\b(black and white|surrealist|arthouse|slow burn|psychological study|psycho|the shining|eraserhead|rosemary's baby)\b/i.test(
            overview,
          ) || /\b(psycho|the shining|eraserhead)\b/i.test(title);

        if (arthouseHorror) penalties += 20;
      }

      if (wantsMagic) {
        if (
          nonMagicAnimeRegex.test(overview) ||
          nonMagicAnimeRegex.test(title)
        ) {
          penalties += 35;
        } else if (!hasMagic) {
          penalties += 20;
        }
      }

      if (wantsTime && !hasTime) penalties += 35;

      const isHero =
        superheroRegex.test(title) ||
        superheroRegex.test(overview) ||
        kwIds.includes(9715);

      if (wantsHero) {
        if (isHero) s_intent = Math.min(100, s_intent + 45);
        else penalties += 55;
      } else if (isHero) {
        if (excludeHero) penalties += 80;
        else if (reqActors.length === 0) penalties += 40;
      }

      const sportSubThemes = intent.detectedKeywords.filter((k) =>
        ["racing", "boxing", "football", "basketball"].includes(k.name),
      );
      const wantsSports =
        (intent.detectedGenres.includes("sports") ||
          sportSubThemes.length > 0) &&
        !intent.isUnderdog &&
        !intent.isCuteAnimeRomCom &&
        !wantsSitcom;

      if (wantsSports) {
        const hasSport =
          sportsRegex.test(overview) ||
          sportsRegex.test(title) ||
          genres.some((g) => g.includes("sport"));

        if (!hasSport) penalties += 65;

        const wantsSciFi = intent.detectedGenres.includes("scifi") || wantsTime;
        const hasSciFiTime =
          genreIds.includes(878) ||
          timeTravelRegex.test(overview) ||
          /\b(back to the future)\b/i.test(title);

        if (!wantsSciFi && hasSciFiTime) penalties += 55;
      }

      const isMovie =
        intent.targetType === "movie" || item.media_type === "movie";
      const isTvSpecial =
        genreIds.includes(10770) ||
        /\b(doctor who|tv special|special episode|christmas special|holiday special|made-for-tv)\b/i.test(
          title,
        ) ||
        /\b(doctor who|tardis|time lord)\b/i.test(overview);

      if (isMovie && isTvSpecial) penalties += 35;

      const isDarkThriller =
        genreIds.includes(53) ||
        genreIds.includes(80) ||
        genreIds.includes(27) ||
        genreIds.includes(10752);

      const userWantedDark =
        wantsDarkCom ||
        intent.detectedKeywords.some((k) => k.name === "dark comedy") ||
        intent.detectedGenres.includes("horror") ||
        intent.detectedGenres.includes("mystery") ||
        intent.detectedGenres.includes("crime") ||
        intent.detectedGenres.includes("war") ||
        wantsDark ||
        intent.isHorrorNight ||
        intent.isCrimeHeist ||
        wantsPsych ||
        intent.isHistoricalWar ||
        intent.isSwordWarfare ||
        intent.isTrueCrimeDoc ||
        intent.isKorean ||
        intent.hasTwistKeywords ||
        intent.isCyberpunk ||
        intent.isPhilosophicalSciFi ||
        intent.isUnderdog ||
        intent.isCrimeFamily ||
        intent.isHauntedHorror ||
        intent.isMindBlowingAction ||
        intent.isDarkAnime;

      if (
        intent.detectedGenres.includes("comedy") &&
        isDarkThriller &&
        !userWantedDark &&
        !intent.isFamilyAnimation &&
        !intent.isCuteAnimeRomCom
      ) {
        penalties += 30;
      }

      if (anchorList.length > 0) {
        const cleanItem = title.toLowerCase().trim();
        const isSequel = anchorList.some((aTitle) => {
          const cleanAnchor = aTitle.toLowerCase().trim();
          return (
            cleanItem === cleanAnchor ||
            cleanItem.startsWith(`${cleanAnchor} `) ||
            cleanItem.startsWith(`${cleanAnchor}:`) ||
            cleanItem.startsWith(`${cleanAnchor} -`)
          );
        });

        if (isSequel) {
          penalties += 85;
          hardViolation = true;
        }
      }

      const exemptAnime = intent.isCuteAnimeRomCom && cuteAnimeHit;
      const exemptCrimeDoc = intent.isTrueCrimeDoc && isTrueCrimeHit;
      const exemptLight =
        Boolean(intent.detectedLanguage && intent.detectedLanguage !== "en") ||
        Boolean(intent.wantsClassic) ||
        Boolean(intent.isPureComedy) ||
        Boolean(wantsSitcom) ||
        Boolean(wantsRomCom);

      if (
        reviewsCount >= 5 &&
        kwCount > 0 &&
        s_user_kw < 40 &&
        !exemptAnime &&
        !exemptCrimeDoc &&
        !exemptLight &&
        reqActors.length === 0
      ) {
        penalties += 30;
      }

      // Hybrid weighted formula (Intent / User / Rating)
      let rawScore = 0;
      if (reviewsCount < 5) {
        rawScore = 0.6 * s_intent + 0.4 * s_rating;
      } else if (reviewsCount <= 9) {
        rawScore = 0.5 * s_intent + 0.15 * s_user + 0.35 * s_rating;
      } else {
        rawScore = 0.4 * s_intent + 0.35 * s_user + 0.25 * s_rating;
      }

      let popularityBonus = 0;
      if (votes >= 4000) popularityBonus = 12;
      else if (votes >= 1500) popularityBonus = 8;
      else if (votes >= 500) popularityBonus = 4;

      let recencyBonus = 0;
      if (!intent.wantsClassic && year >= 2010) recencyBonus = 6;
      else if (!intent.wantsClassic && year >= 2000) recencyBonus = 3;

      const maxCap =
        ecchiViolation ||
        lowRatingViolation ||
        sciFiViolation ||
        modernInSword ||
        hardViolation ||
        (intent.isCuteAnimeRomCom &&
          (genreIds.includes(10762) || kidsAnimeRegex.test(title)))
          ? 95
          : 45;

      penalties = Math.min(penalties, maxCap);

      const finalScore = Math.min(
        100,
        Math.max(
          0,
          rawScore + popularityBonus + recencyBonus + actorBoost - penalties,
        ),
      );

      return {
        ...item,
        breakdown: {
          s_intent,
          s_user,
          s_user_genre,
          s_user_kw,
          s_user_kw_bonus,
          matched_user_keywords,
          s_rating,
          penalties,
          popularityBonus,
          recencyBonus,
          actorBoost,
        },
        finalScore,
      };
    })
    .sort((a, b) => b.finalScore - a.finalScore);
};
