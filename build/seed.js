/* =====================================================================
   LexiCards - built-in deck used by the Discover page (Oxford 3000/5000)
   Total vocabulary words: 4937
   ===================================================================== */
const SEED_WORDS = {
  core: (
    'ability achieve advice afford agree allow appear apply argue arrive attend avoid balance behave benefit ' +
    'borrow brave cancel careful challenge choose comfort compare complete concern consider contain continue control create ' +
    'curious damage decide deliver depend describe develop discover discuss effort encourage enough environment expect explain ' +
    'familiar feature focus gather habit honest imagine improve include increase instead involve kindness language manage ' +
    'matter mention method moment natural notice offer opinion patient perform prefer prepare prevent provide purpose ' +
    'quality reason receive reduce reflect regard relate remain repeat replace require respond result review satisfy ' +
    'search select serious simple special suggest support suppose surprise survive target treat trust useful value ' +
    'various wonder worry abandon able about above abroad absolute absolutely academic accept acceptable access accident ' +
    'accommodation accompany account accurate accuse achievement acknowledge acquire across act action active activity actor actress ' +
    'actual actually adapt add addition additional address administration admire admit adopt adult advance advanced advantage ' +
    'adventure advertise advertisement advertising advise affair affect afraid after afternoon afterwards again against age aged ' +
    'agency agenda agent aggressive ago agreement ahead aid aim air aircraft airline airport alarm album ' +
    'alcohol alcoholic alive all almost alone along already also alter alternative although always amazed amazing ' +
    'ambition ambitious among amount analyse analysis ancient and anger angle angrily angry animal ankle anniversary ' +
    'announce announcement annoy annoyed annoying annual another answer anxious any anybody anyone anything anyway anywhere ' +
    'apart apartment apologize app apparent apparently appeal appearance apple application appointment appreciate approach appropriate approval ' +
    'approve approximately april architect architecture area argument arise arm armed arms army around arrange arrangement ' +
    'arrest arrival art article artificial artist artistic ashamed ask asleep aspect assess assessment assignment assist ' +
    'assistant associate associated association assume athlete atmosphere attach attack attempt attention attitude attract attraction attractive ' +
    'audience august aunt author authority autumn available average award aware away awful baby back background ' +
    'backwards bacteria bad badly bag bake ball ban banana band bank bar barrier base baseball ' +
    'based basic basically basis basketball bath bathroom battery battle beach bean bear beat beautiful beauty ' +
    'because become bed bedroom bee beef beer before beg begin beginning behaviour behind being belief ' +
    'believe bell belong below belt bend bent best bet better between beyond bicycle big bike ' +
    'bill billion bin biology bird birth birthday biscuit bit bite bitter black blame blank blind ' +
    'block blog blonde blood blow blue board boat body boil bomb bond bone book boot ' +
    'border bored boring born boss both bother bottle bottom bowl box boy boyfriend brain branch ' +
    'brand bread break breakfast breast breath breathe breathing bride bridge brief bright brilliant bring broad ' +
    'broadcast broken brother brown brush bubble budget build building bullet bunch burn bury bus bush ' +
    'business businessman busy but butter button buy bye cable cafe cake calculate call calm camera ' +
    'camp campaign camping campus can cancer candidate cannot cap capable capacity capital captain capture car ' +
    'card care career carefully careless carpet carrot carry cartoon case cash cast castle cat catch ' +
    'category cause ceiling celebrate celebration celebrity cell cent central centre century ceremony certain certainly chain ' +
    'chair chairman champion chance change channel chapter character characteristic charge charity chart chat cheap cheat ' +
    'check cheerful cheese chef chemical chemistry chest chicken chief child childhood chip chocolate choice church ' +
    'cigarette cinema circle circumstance cite citizen city civil claim class classic classical classroom clause clean ' +
    'clear clearly clever click client climate climb clock close closed closely cloth clothes clothing cloud ' +
    'club clue coach coal coast coat code coffee coin cold collapse colleague collect collection college ' +
    'colour coloured column combination combine come comedy comfortable command comment commercial commission commit commitment committee ' +
    'common commonly communicate communication community company comparison compete competition competitive competitor complain complaint completely complex ' +
    'complicated component computer concentrate concentration concept concerned concert conclude conclusion condition conduct conference confidence confident ' +
    'confirm conflict confuse confused confusing connect connected connection conscious consequence conservative consideration consist consistent constant ' +
    'constantly construct construction consume consumer contact container contemporary content contest context continent continuous contract contrast ' +
    'contribute contribution convenient conversation convert convince convinced cook cooker cooking cool copy core corner corporate ' +
    'correct correctly cost costume cottage cotton could council count country countryside county couple courage course ' +
    'court cousin cover covered cow crash crazy cream creation creative creature credit crew crime criminal ' +
    'crisis criterion critic critical criticism criticize crop cross crowd crowded crucial cruel cry cultural culture ' +
    'cup cupboard cure curly currency current currently curtain curve curved custom customer cut cycle dad ' +
    'daily dance dancer dancing danger dangerous dark data date daughter day dead deal dear death ' +
    'debate debt decade december decent decision declare decline decorate decoration decrease deep deeply defeat defence ' +
    'defend define definite definitely definition degree delay deliberate deliberately delicious delight delighted delivery demand demonstrate ' +
    'dentist deny department departure depressed depressing depth description desert deserve design designer desire desk desperate ' +
    'despite destination destroy detail detailed detect detective determine determined development device diagram dialogue diamond diary ' +
    'dictionary die diet difference different differently difficult difficulty dig digital dinner direct direction directly director ' +
    'dirt dirty disadvantage disagree disappear disappointed disappointing disaster disc discipline discount discovery discussion disease dish ' +
    'dishonest dislike dismiss display distance distribute distribution district divide division divorced doctor document documentary dog ' +
    'dollar domestic dominate donate door double doubt down download downstairs downwards dozen draft drag drama ' +
    'dramatic draw drawing dream dress dressed drink drive driver driving drop drug drum drunk dry ' +
    'due during dust duty dvd each ear early earn earth earthquake easily east eastern easy ' +
    'eat economic economy edge edit edition editor educate educated education educational effect effective effectively efficient ' +
    'egg eight eighteen eighty either elderly elect election electric electrical electricity electronic element elephant eleven ' +
    'else elsewhere email embarrassed embarrassing emerge emergency emotion emotional emphasis emphasize employ employee employer employment ' +
    'empty enable encounter end ending enemy energy engage engaged engine engineer engineering enhance enjoy enormous ' +
    'enquiry ensure enter entertain entertainment enthusiasm enthusiastic entire entirely entrance entry environmental episode equal equally ' +
    'equipment error escape especially essay essential establish estate estimate ethical euro evaluate even evening event ' +
    'eventually ever every everybody everyday everyone everything everywhere evidence evil exact exactly exam examination examine ' +
    'example excellent except exchange excited excitement exciting excuse executive exercise exhibition exist existence expand expectation ' +
    'expected expedition expense expensive experience experienced experiment expert explanation explode exploration explore explosion export expose ' +
    'express expression extend extent external extra extraordinary extreme extremely eye face facility fact factor factory ' +
    'fail failure fair fairly faith fall false family famous fan fancy fantastic far farm farmer ' +
    'farming fascinating fashion fashionable fast fasten fat father fault favour favourite fear feather february fee ' +
    'feed feedback feel feeling fellow female fence festival few fiction field fifteen fifth fifty fight ' +
    'fighting figure file fill film final finally finance financial find finding fine finger finish fire ' +
    'firm first firstly fish fishing fit fitness five fix fixed flag flame flash flat flexible ' +
    'flight float flood floor flour flow flower flu fly flying fold folding folk follow following ' +
    'food foot football for force foreign forest forever forget forgive fork form formal former fortunately ' +
    'fortune forty forward found four fourteen fourth frame free freedom freeze frequency frequently fresh friday ' +
    'fridge friend friendly friendship frighten frightened frightening frog from front frozen fruit fry fuel full ' +
    'fully fun function fund fundamental funding funny fur furniture further furthermore future gain gallery game ' +
    'gang gap garage garden gas gate general generally generate generation generous genre gentle gentleman geography ' +
    'get ghost giant gift girl girlfriend give glad glass global glove goal god gold golf ' +
    'good goodbye goods govern government grab grade gradually graduate grain grand grandfather grandmother grandparent grant ' +
    'grass grateful great green greet grey ground group grow growth guarantee guard guess guest guide ' +
    'guilty guitar gun guy gym hair half hall hand handle hang happen happily happiness '
  ).trim().split(/\s+/),
  intermediate: (
    'adequate ambiguous anticipate comprehensive distinguish eliminate evident identify illustrate imply indicate maintain minor modify negotiate ' +
    'obvious obtain precise priority reluctant reveal significant sufficient transform happy hard hardly harm harmful hat ' +
    'hate have head headache headline health healthy hear hearing heart heat heating heaven heavily heavy ' +
    'heel height helicopter hell hello help helpful her here hero hers herself hesitate hey hide ' +
    'high highlight highly hill him himself hire his historic historical history hit hobby hockey hold ' +
    'hole holiday hollow holy home homework honour hope horrible horror horse hospital host hot hotel ' +
    'hour house household housing how however huge human humorous humour hundred hungry hunt hunting hurricane ' +
    'hurry hurt husband ice idea ideal identity ignore ill illegal illness illustration image imaginary imagination ' +
    'immediate immediately immigrant impact impatient import importance important impose impossible impress impressed impression impressive improvement ' +
    'inch incident included including income increasingly incredible incredibly indeed independent indirect individual indoor indoors industrial ' +
    'industry infection influence inform informal information ingredient initial initially initiative injure injured injury inner innocent ' +
    'insect inside insight insist inspire install instance institute institution instruction instructor instrument insurance intelligence intelligent ' +
    'intend intended intense intention interest interested interesting internal international internet interpret interrupt interview into introduce ' +
    'introduction invent invention invest investigate investigation investment invitation invite involved iron island issue item its ' +
    'itself jacket jam january jazz jeans jewellery job join joke journal journalist journey joy judge ' +
    'judgement juice july jump june junior just justice justify keen keep key keyboard kick kid ' +
    'kill killing kilometre kind king kiss kitchen knee knife knock know knowledge lab label laboratory ' +
    'labour lack lady lake lamp land landscape laptop large largely last late later latest laugh ' +
    'laughter launch law lawyer lay layer lazy lead leader leadership leading leaf league lean learn ' +
    'learning least leather leave lecture left leg legal leisure lemon lend length less lesson let ' +
    'letter level library licence lie life lifestyle lift light like likely limit limited line link ' +
    'lion lip liquid list listen listener literature little live lively living load loan local locate ' +
    'located location lock logical lonely long look loose lord lorry lose loss lost lot loud ' +
    'loudly love lovely low lower luck lucky lunch lung luxury machine mad magazine magic mail ' +
    'main mainly major majority make male mall man management manager manner many map march mark ' +
    'market marketing marriage married marry mass massive master match matching material mathematics maths maximum may ' +
    'maybe meal mean meaning means meanwhile measure measurement meat media medical medicine medium meet meeting ' +
    'melt member memory mental menu mess message metal metre middle midnight might mild mile military ' +
    'milk million mind mine mineral minimum minister minority minute mirror miss missing mission mistake mix ' +
    'mixed mixture mobile model modern monday money monitor monkey month mood moon moral more morning ' +
    'most mostly mother motor motorcycle mount mountain mouse mouth move movement movie much mud multiple ' +
    'multiply mum murder muscle museum music musical musician must myself mysterious mystery nail name narrative ' +
    'narrow nation national native naturally nature near nearly neat necessarily necessary neck need needle negative ' +
    'neighbour neighbourhood neither nerve nervous net network never nevertheless new news newspaper next nice night ' +
    'nightmare nine nineteen ninety nobody noise noisy none nor normal normally north northern nose not ' +
    'note nothing notion novel november now nowhere nuclear number numerous nurse nut obey object objective ' +
    'obligation observation observe obviously occasion occasionally occur ocean october odd off offence offend offensive office ' +
    'officer official often oil old once one onion online only onto open opening operate operation ' +
    'opponent opportunity oppose opposed opposite opposition option orange order ordinary organ organization organize organized organizer ' +
    'origin original originally other otherwise ought our ours ourselves out outcome outdoor outdoors outer outline ' +
    'outside oven over overall owe own owner pace pack package page pain painful paint painter ' +
    'painting pair palace pale pan panel pants paper paragraph parent park parking parliament part participant ' +
    'participate particular particularly partly partner party pass passage passenger passion passport past path pattern pay ' +
    'payment peace peaceful pen pencil penny pension people pepper per percentage perfect perfectly performance perhaps ' +
    'period permanent permission permit person personal personality personally perspective persuade pet petrol phase phenomenon philosophy ' +
    'phone photo photograph photographer photography phrase physical physics piano pick picture piece pig pile pilot ' +
    'pin pink pipe pitch place plain plan plane planet planning plant plastic plate platform play ' +
    'player pleasant please pleased pleasure plenty plot plus pocket poem poet poetry point pointed poison ' +
    'poisonous police policeman policy polite political politician politics pollution pool poor pop popular popularity population ' +
    'port portrait pose position positive possess possession possibility possible possibly post poster pot potato potential ' +
    'pound pour poverty powder power powerful practical practice practise praise pray prayer predict prediction pregnant ' +
    'preparation prepared presence present presentation preserve president press pressure pretend pretty previous previously price priest ' +
    'primary prime prince princess principle print printer printing prison prisoner privacy private prize probably problem ' +
    'procedure process produce producer product production profession professional professor profile profit program programme progress project ' +
    'promise promote pronounce proof proper properly property proposal propose prospect protect protection protest proud prove ' +
    'psychologist psychology pub public publication publish pull punish punishment pupil purchase pure purple pursue push ' +
    'put qualification qualified qualify quantity quarter queen question queue quick quickly quiet quietly quit quite ' +
    'quotation quote race racing radio railway rain raise range rank rapid rapidly rare rarely rate ' +
    'rather raw reach react reaction read reader reading ready real realistic reality realize really reasonable ' +
    'recall receipt recent recently reception recipe recognize recommend recommendation record recording recover recycle red reduction ' +
    'refer reference refuse region regional register regret regular regularly regulation reject related relation relationship relative ' +
    'relatively relax relaxed relaxing release relevant reliable relief religion religious rely remark remember remind remote ' +
    'remove rent repair repeated reply report reporter represent representative reputation request requirement rescue research researcher ' +
    'reservation reserve resident resist resolve resort resource respect response responsibility responsible rest restaurant retain retire ' +
    'retired return revise revolution reward rhythm rice rich rid ride right ring rise risk river ' +
    'road robot rock role roll romantic roof room root rope rough round route routine row ' +
    'royal rub rubber rubbish rude rugby rule run runner running rural rush sad sadly safe ' +
    'safety sail sailing sailor salad salary sale salt same sample sand sandwich satellite satisfied saturday ' +
    'sauce save saving say scale scan scared scary scene schedule scheme school science scientific scientist ' +
    'score scream screen script sculpture sea season seat second secondary secondly secret secretary section sector ' +
    'secure security see seed seek seem selection self sell send senior sense sensible sensitive sentence ' +
    'separate september sequence series seriously servant serve service session set setting settle seven seventeen seventy ' +
    'several severe sex sexual shade shadow shake shall shallow shame shape share sharp she sheep ' +
    'sheet shelf shell shelter shift shine shiny ship shirt shock shocked shoe shoot shooting shop ' +
    'shopping short shot should shoulder shout show shower shut shy sick side sight sign signal ' +
    'significantly silence silent silk silly silver similar similarity similarly simply since sincere sing singer singing ' +
    'single sink sir sister sit site situation six sixteen sixty size ski skiing skill skin ' +
    'skirt sky slave sleep slice slide slight slightly slip slope slow slowly small smart smell ' +
    'smile smoke smoking smooth snake snow soap soccer social society sock soft software soil solar ' +
    'soldier solid solution solve some somebody someone something sometimes somewhat somewhere son song soon sorry ' +
    'sort soul sound soup source south southern space speak speaker specialist species specific specifically speech ' +
    'speed spell spelling spend spending spicy spider spirit spiritual split spoken sponsor spoon sport spot ' +
    'spread spring square stable stadium staff stage stair stamp stand standard star stare start state ' +
    'statement station statistic statue status stay steady steal steel steep step stick sticky stiff still ' +
    'stock stomach stone stop store storm story straight strange stranger strategy stream street strength stress ' +
    'stretch strict strike string strong strongly structure struggle student studio study stuff stupid style subject ' +
    'sublist submit substance succeed success successful successfully such sudden suddenly suffer sugar suggestion suit suitable ' +
    'sum summarize summary summer sun sunday supermarket supply supporter sure surely surface surgery surprised surprising ' +
    'surround surrounding survey suspect swear sweater sweep sweet swim swimming switch symbol sympathy symptom system ' +
    'table tablet tail take tale talent talented talk tall tank tape task taste tax taxi ' +
    'tea teach teacher teaching team tear technical technique technology teenage teenager telephone television tell temperature ' +
    'temporary ten tend tennis tent term terrible test text than thank thanks that the theatre ' +
    'their theirs them theme themselves then theory therapy there therefore they thick thief thin thing ' +
    'think thinking third thirsty thirteen thirty this though thought thousand threat threaten three throat through ' +
    'throughout throw thursday thus ticket tidy tie tight till time tin tiny tip tired title ' +
    'today toe together toilet tomato tomorrow tone tongue tonight too tool tooth top topic total ' +
    'totally touch tough tour tourism tourist towards towel tower town toy track trade tradition traditional ' +
    'traffic train trainer training transfer transition translate translation transport travel traveller treatment tree trend trial ' +
    'trick trip tropical trouble trousers truck true truly truth try tube tuesday tune tunnel turn ' +
    'twelve twenty twice twin two type typical typically tyre ugly ultimately umbrella unable uncle uncomfortable ' +
    'unconscious under underground understand understanding underwear unemployed unemployment unexpected unfair unfortunately unhappy uniform union unique ' +
    'unit united universe university unknown unless unlike unlikely unnecessary unpleasant until unusual update upon upper ' +
    'upset upstairs upwards urban urge use used user usual usually vacation valley valuable van variety ' +
    'vary vast vegetable vehicle venue version very via victim victory video view viewer village violence ' +
    'violent virtual virus vision visit visitor visual vital vitamin voice volume volunteer vote wage wait ' +
    'waiter wake walk wall want war warm warn warning wash washing waste watch water wave ' +
    'way weak weakness wealth wealthy weapon wear weather web website wedding wednesday week weekend weigh ' +
    'weight welcome well west western wet what whatever wheel when whenever where whereas wherever whether ' +
    'which while whisper white who whole whom whose why wide widely wife wild wildlife will ' +
    'willing win wind window wine wing winner winter wire wise wish with within without witness ' +
    'woman wonderful wood wooden wool word work worker working world worldwide worried worse worst worth ' +
    'would wound wow wrap write writer writing written wrong yard yeah year yellow yes yesterday ' +
    'yet you young your yours yourself youth zero zone '
  ).trim().split(/\s+/),
  advanced: (
    'aberration alleviate cacophony capitulate circumvent coalesce conjecture corroborate deference delineate dichotomy ebullient eclectic elicit eloquent ' +
    'ephemeral equivocal exacerbate expedite fastidious gregarious idiosyncratic impetus inconsequential ineffable juxtapose laconic magnanimous mitigate nuance ' +
    'obfuscate ostentatious paradigm pragmatic quixotic recalcitrant sagacious salient serendipity taciturn ubiquitous venerable veracity abolish abortion ' +
    'absence absent absorb abstract absurd abundance abuse academy accelerate accent acceptance accessible accidentally accommodate accomplish ' +
    'accomplishment accordance accordingly accountability accountable accountant accounting accumulate accumulation accuracy accurately accusation accused acid acquisition ' +
    'acre activate activation activist acute adaptation addiction additionally adequately adhere adjacent adjust adjustment administer administrative ' +
    'administrator admission adolescent adoption adverse advocate aesthetic affection affordable aftermath aggression agricultural agriculture aide aids ' +
    'albeit alert alien align alignment alike allegation allege allegedly alliance allocate allocation allowance ally alongside ' +
    'altogether aluminium amateur ambassador ambulance amend amendment amid amusing analogy analyst ancestor anchor angel animation ' +
    'annually anonymous anxiety apology apparatus appealing appetite applaud applicable applicant appoint appreciation appropriately arbitrary architectural ' +
    'archive arena arguably array arrow articulate artwork ash aside aspiration aspire assassination assault assemble assembly ' +
    'assert assertion asset assign assistance assumption assurance assure astonishing asylum atrocity attachment attain attendance attorney ' +
    'attribute auction audio audit authentic authorize auto automatic automatically autonomy availability await awareness awkward backdrop ' +
    'backing backup badge bail balanced ballet balloon ballot banner bare barely bargain barrel basement basket ' +
    'bass bat battlefield bay beam beast behalf beloved bench benchmark beneath beneficial beneficiary beside besides ' +
    'betray bias bid bind biography biological bishop bizarre blade blanket blast bleed blend bless blessing ' +
    'boast bold bombing bonus booking boom boost bounce bound boundary bow breach breakdown breakthrough breed ' +
    'brick briefly broadband broadcaster broadly browser brutal buck buddy buffer bug bulk burden bureaucracy burial ' +
    'burst cabin cabinet calculation canal candle canvas capability capitalism capitalist carbon cargo carriage carve casino ' +
    'casual casualty catalogue cater cattle caution cautious cave cease cemetery certainty certificate challenging chamber championship ' +
    'chaos characterize charm charming charter chase cheek cheer choir chop chronic chunk circuit circulate circulation ' +
    'citizenship civic civilian civilization clarify clarity clash classification classify cleaning clerk cliff cling clinic clinical ' +
    'clip closure cluster coalition coastal cocktail cognitive coincide coincidence collaborate collaboration collective collector collision colonial ' +
    'colony colourful columnist combat comic commander commence commentary commentator commerce commissioner commodity communist companion comparable ' +
    'comparative compassion compel compelling compensate compensation competence competent compile complement completion complexity compliance complication comply ' +
    'compose composer composition compound comprise compromise compulsory compute conceal concede conceive conception concession concrete condemn ' +
    'confer confess confession configuration confine confirmation confront confrontation confusion congratulate congregation congressional conquer conscience consciousness ' +
    'consecutive consensus consent consequently conservation conserve considerable considerably consistency consistently consolidate conspiracy constituency constitute constitution ' +
    'constitutional constraint consult consultant consultation consumption contemplate contempt contend contender contention continually contractor contradiction contrary ' +
    'contributor controversial controversy convenience convention conventional conversion convey convict conviction convincing cooperate cooperative coordinate coordination ' +
    'coordinator cop cope copper copyright corporation correction correlate correlation correspond correspondence correspondent corresponding corridor corrupt ' +
    'corruption costly councillor counselling counsellor counter counterpart countless coup courtesy coverage crack craft crawl creativity ' +
    'creator credibility credible creep critically critique crown crude cruise crush crystal cue cult cultivate curiosity ' +
    'curriculum custody cute cutting cynical dairy dam damaging dare darkness database dawn deadline deadly dealer ' +
    'debris debut decisive deck declaration dedicated dedication deed deem default defect defender defensive deficiency deficit ' +
    'defy delegate delegation delete delicate democracy democratic demon demonstration denial denounce dense density depart dependence ' +
    'dependent depict deploy deployment deposit depression deprive deputy derive descend descent designate desirable desktop desperately ' +
    'destruction destructive detain detection detention deteriorate determination devastate devil devise devote diagnose diagnosis dictate dictator ' +
    'differ differentiate dignity dilemma dimension diminish dip diplomat diplomatic directory disability disabled disagreement disappoint disappointment ' +
    'disastrous discard discharge disclose disclosure discourage discourse discretion discrimination dismissal disorder displace disposal dispose dispute ' +
    'disrupt disruption dissolve distant distinct distinction distinctive distort distract distress disturb disturbing dive diverse diversity ' +
    'divert divine divorce doctrine documentation domain dominance dominant donation donor dose dot downtown drain dramatically ' +
    'drift drought drown dual dub dull dumb dump duo duration dynamic eager earnings ease echo ' +
    'ecological economics economist editorial educator effectiveness efficiency efficiently ego elaborate elbow electoral electronics elegant elementary ' +
    'elevate eligible elite embark embarrassment embassy embed embody embrace emergence emission emotionally empire empirical empower ' +
    'enact encompass encouragement encouraging endeavour endless endorse endorsement endure enforce enforcement engagement engaging enjoyable enquire ' +
    'enrich enrol ensue enterprise entertaining enthusiast entitle entity entrepreneur envelope epidemic equality equation equip equivalent ' +
    'era erect erupt escalate essence essentially establishment eternal ethic ethnic evacuate evaluation evoke evolution evolutionary ' +
    'evolve exaggerate exceed excellence exception exceptional excess excessive exclude exclusion exclusive exclusively execute execution exert ' +
    'exhibit exile exit exotic expansion expenditure experimental expertise expire explicit explicitly exploit exploitation explosive exposure ' +
    'extension extensive extensively extract extremist fabric fabulous facilitate faction faculty fade failed fairness fake fame ' +
    'fantasy fare fatal fate favourable feat federal feeding feminist fever fibre fierce filter firearm firefighter ' +
    'firework firmly fixture flavour flaw flawed flee fleet flesh flexibility flourish fluid fond fool footage ' +
    'forbid forecast foreigner forge format formation formerly formula formulate forth forthcoming fortunate forum fossil foster ' +
    'foundation founder fraction fragile fragment framework franchise frankly fraud freely frequent frustrated frustrating frustration fulfil ' +
    'functional fundamentally fundraising funeral furious gallon gambling gaming gathering gay gaze gear gender gene generic ' +
    'genetic genius genocide genuine genuinely gesture gig glance glimpse globalization globe glorious glory golden goodness ' +
    'gorgeous governance governor grace graphic graphics grasp grave gravity greatly greenhouse grid grief grin grind ' +
    'grip grocery guerrilla guidance guideline guilt gut habitat hail halfway halt handful handling handy harassment ' +
    'harbour hardware harmony harsh harvest hatred haunt hazard headquarters heal healthcare heighten helmet hence herb ' +
    'heritage hidden hierarchy highway hilarious hint hip historian homeland homeless honesty hook hopeful hopefully horizon ' +
    'horn hostage hostile hostility humanitarian humanity humble hunger hydrogen hypothesis icon identical identification ideological ideology ' +
    'idiot ignorance illusion imagery immense immigration imminent immune implement implementation implication imprison imprisonment inability inadequate ' +
    'inappropriate incentive incidence inclined inclusion incorporate incorrect incur independence index indication indicator indictment indigenous induce ' +
    'indulge inequality inevitable infamous infant infect infer inflation inflict influential info infrastructure inhabitant inherent inherit ' +
    'inhibit initiate inject injection injustice ink inmate innovation innovative input insert insertion insider inspect inspection ' +
    'inspector inspiration installation instant instantly instinct institutional instruct instrumental insufficient insult intact intake integral integrate ' +
    'integrated integration integrity intellectual intensify intensity intensive intent interact interaction interactive interface interfere interference interim ' +
    'interior intermediate interpretation interval intervene intervention intimate intriguing invade invasion investigator investor invisible invoke involvement ' +
    'ironic ironically irony irrelevant isolate isolated isolation jail jet joint journalism judicial junction jurisdiction jury ' +
    'justification kidnap kidney kingdom kit lad ladder landing landlord landmark lane lap laser lately latter ' +
    'lawn lawsuit layout leaflet leak leap legacy legend legendary legislation legislative legislature legitimate lengthy lens ' +
    'lesbian lesser lethal liable liberal liberation liberty license lifelong lifetime lighting likelihood likewise limb limitation ' +
    'linear linger listing literacy literally literary litre litter liver lobby log logic logo loom loop ' +
    'lottery loyal loyalty lyric machinery magical magistrate magnetic magnificent magnitude mainland mainstream maintenance making mandate ' +
    'mandatory manifest manipulate manipulation manufacture manufacturing manuscript marathon margin marginal marine marker marketplace martial mask ' +
    'massacre mate mathematical mature maximize mayor meaningful meantime mechanic mechanical mechanism medal medication medieval meditation ' +
    'melody membership memo memoir memorable memorial mentor merchant mercy mere merely merge merger merit metaphor ' +
    'methodology midst migration militant militia mill miner minimal minimize mining ministry miracle miserable misery misleading ' +
    'missile mob mobility mobilize mode moderate modest modification momentum monk monopoly monster monthly monument morality ' +
    'moreover mortgage mosque motion motivate motivation motive motorist moving municipal mutual myth naked namely nasty ' +
    'nationwide naval navigation nearby necessity neglect negotiation neighbouring nest neutral newly newsletter niche noble nod ' +
    'nominate nomination nominee nonetheless nonsense noon norm notable notably notebook notify notorious novelist nowadays nursery ' +
    'nursing nutrition obesity objection oblige observer obsess obsession obstacle occasional occupation occupy occurrence odds offender ' +
    'offering offspring ongoing openly opera operational operator opt optical optimism optimistic oral orchestra organic organizational ' +
    'orientation originate outbreak outfit outing outlet outlook output outrage outsider outstanding overcome overlook overly overnight ' +
    'overseas oversee overturn overwhelm overwhelming ownership oxygen packet pad palm panic parade parallel parameter parental ' +
    'parish parliamentary partial partially participation partnership passing passionate passive password pastor patch patent pathway patience ' +
    'patrol patron pause peak peasant peculiar peer penalty perceive perception permanently persist persistent personnel petition ' +
    'philosopher philosophical physician pill pioneer pipeline pirate pit pity placement plea plead pledge plug plunge ' +
    'pole poll pond portfolio portion portray postpone potentially practitioner preach precede precedent precious precisely precision ' +
    'predator predecessor predictable predominantly preference pregnancy prejudice preliminary premier premise premium prescribe prescription presently preservation ' +
    'preside presidency presidential prestigious presumably presume prevail prevalence prevention prey pride primarily principal prior privatization ' +
    'privilege probability probable probe problematic proceed proceeding proceeds processing processor proclaim productive productivity profitable profound ' +
    'programming progressive prohibit projection prominent promising promotion prompt pronounced propaganda proportion proposition prosecute prosecution prosecutor ' +
    'prospective prosperity protective protein protester protocol province provincial provision provoke psychiatric psychological publicity publishing pulse ' +
    'pump punch punk purely pursuit puzzle query quest questionnaire quota racial racism racist radar radiation ' +
    'radical rage raid rail rally random ranking rape rat rating ratio rational ray readily realization ' +
    'realm rear reasonably reasoning reassure rebel rebellion rebuild receiver recession recipient reckon recognition reconstruction recount ' +
    'recovery recruit recruitment referee referendum reflection reform refuge refugee refusal regain regardless regime registration regulate ' +
    'regulator regulatory rehabilitation reign reinforce rejection relevance reliability relieve relieved remainder remains remarkable remarkably remedy ' +
    'reminder removal render renew renowned rental replacement reportedly reporting representation reproduce reproduction republic resemble reside ' +
    'residence residential residue resign resignation resistance resolution respective respectively restoration restore restraint restrict restriction resume ' +
    'retail retirement retreat retrieve revelation revenge revenue reverse revision revival revive revolutionary rhetoric ridiculous rifle ' +
    'riot rip risky ritual rival rob robbery robust rocket rod romance rose rotate rotation roughly ' +
    'ruin ruling rumour sack sacred sacrifice saint sake sanction satisfaction scandal scare scattered scenario sceptical ' +
    'scholar scholarship scope scratch screening screw scrutiny seal secular seeker seemingly segment seize seldom selective ' +
    'seminar senator sensation sensitivity sentiment separation serial settlement settler severely sexuality sexy shaped shareholder shatter ' +
    'shed sheer shipping shocking shore shortage shortly shrink shrug sibling sigh signature significance simulate simulation ' +
    'simultaneously sin situated sketch skilled skip skull slam slap slash slavery slogan slot smash snap ' +
    'soak soar socialist sole solely solicitor solidarity solo somehow sometime sophisticated sovereignty spam span spare ' +
    'spark specialize specialized specification specify specimen spectacle spectacular spectator spectrum speculate speculation sphere spill spin ' +
    'spine spite spoil spokesman spokesperson spokeswoman sponsorship sporting spotlight spouse spy squad squeeze stab stability ' +
    'stabilize stake stall stance standing stark starve statistical steadily steam steer stem stereotype stimulate stimulus ' +
    'stir storage straightforward strain strand strategic strengthen strictly striking strip strive stroke structural stumble stun ' +
    'stunning submission subscriber subscription subsequent subsequently subsidy substantial substantially substitute substitution subtle suburb suburban succession ' +
    'successive successor suck sue suffering sufficiently suicide suite summit super superb superior supervise supervision supervisor ' +
    'supplement supportive supposedly suppress supreme surge surgeon surgical surplus surrender surveillance survival survivor suspend suspension ' +
    'suspicion suspicious sustain sustainable swallow swing sword symbolic sympathetic syndrome synthesis systematic tackle tactic tactical ' +
    'tag tap taxpayer technological teens temple temporarily tempt tenant tendency tender tension tenure terminal terminate ' +
    'terms terrain terribly terrific terrify territory terror terrorism terrorist testify testimony testing textbook texture thankfully ' +
    'theatrical theft theology theoretical therapist thereafter thereby thesis thorough thoroughly thoughtful thread threshold thrilled thrive ' +
    'thumb tide tighten timber timely timing tissue tobacco tolerance tolerate toll ton tonne torture toss ' +
    'tournament toxic trace trademark trading tragedy tragic trail trailer trait transaction transcript transformation transit transmission ' +
    'transmit transparency transparent transportation trap trauma treasure treaty tremendous tribal tribe tribunal tribute trigger trillion ' +
    'trio triumph troop trophy troubled trustee tsunami tuition turnout turnover twist ultimate unacceptable uncertainty undergo ' +
    'undergraduate underlying undermine undertake undoubtedly unfold unfortunate unify unite unity universal unprecedented unveil upcoming upgrade ' +
    'uphold urgent usage useless utility utilize utterly vacuum vague valid validity vanish variable variation varied ' +
    'vein venture verbal verdict verify verse versus vertical vessel veteran viable vibrant vice vicious viewpoint ' +
    'villager violate violation virtue visa visible vocal voluntary voting vow vulnerability vulnerable wander ward warehouse ' +
    'warfare warming warrant warrior weaken weave weed weekly weird welfare whatsoever wheat whereby whilst whip ' +
    'whoever wholly widen widespread widow width willingness wipe wisdom wit withdraw withdrawal workforce workout workplace ' +
    'workshop worm worship worthwhile worthy wrist yell yield youngster '
  ).trim().split(/\s+/)
};

const SEED_PHRASES = [
  'a blessing in disguise','a piece of cake','ahead of the curve','at the end of the day','back to square one',
  'beat around the bush','bite the bullet','break the ice','burn the midnight oil','by all means',
  'call it a day','come to terms with','cut corners','cut to the chase','down the line',
  'drag your feet','draw the line','face the music','for the time being','get the hang of',
  'get out of hand','give up the ghost','go the extra mile','hit the ground running','hold your ground',
  'in the long run','in the nick of time','jump on the bandwagon','keep an eye on','keep your fingers crossed',
  'learn the ropes','let the cat out of the bag','lose track of','make ends meet','miss the boat',
  'no strings attached','off the top of my head','on the same page','once in a blue moon','out of the blue',
  'pay attention to','pull your weight','put up with','read between the lines','run out of steam',
  'second thoughts','see eye to eye','sit on the fence','spill the beans','take for granted',
  'take its toll','the last straw','throw in the towel','under the weather','up in the air',
  'walk on eggshells','water under the bridge','weather the storm','with flying colours','a double-edged sword'
];

const SEED_PATTERNS = [
  'the more ..., the more ...','not only ... but also ...','the reason why ... is that ...','it is said that ...',
  'it seems that ...','I would rather ... than ...','would you mind ...ing?','no sooner ... than ...',
  'hardly ... when ...','there is no point in ...ing','as far as I am concerned, ...','what matters most is ...',
  "it's not that ..., it's just that ...",'the thing is, ...','I cannot help ...ing','it is high time that ...',
  'if only ...','were it not for ...','little did ... know','so ... that ...',
  'such ... that ...','whether ... or not','not so much ... as ...','given that ..., ...','provided that ..., ...',
  'in terms of ...','apart from ...','regardless of ...','as long as ...','the fact that ...',
  'the moment ...','by the time ...',"there's no denying that ...",'it goes without saying that ...',
  "I'm under the impression that ...",'let alone ...','all things considered, ...','to make matters worse, ...',
  'that being said, ...','as opposed to ...'
];
