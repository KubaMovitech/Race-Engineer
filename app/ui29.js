// ================= GUIDA SETUP =================
// Every setting in the app opens a card: what it does, what changes if you raise or lower it, when it is too much
// and how to check it, with the numbers of the open telemetry and of the library for that car. Plus symptoms,
// tracks, cars and the way of working. Written from the user's Hypercar guide (LMU 1.4.2.1) and public sources.

// ---------- 1. the cards ----------
// w: what it does · up / dn: raise / lower · much: too much · chk: how to check · cls: notes per class · t: telemetry hint id
const GUIDE_P={
  compound:{t:'Mescola',g:'Gomme e freni',w:'Decide finestra di temperatura, grip e durata. Quali mescole puoi usare dipende da classe, pista e regole dell\'evento.',
    up:'Più morbida: scalda prima e dà più grip all\'inizio, ma si surriscalda e cala prima nello stint.',dn:'Più dura: regge pista calda e stint lunghi, ma ci mette di più ad andare in temperatura e frena peggio a freddo.',
    much:'Morbida troppo calda: il passo crolla dopo pochi giri e il posteriore scivola. Dura troppo fredda: sottosterzo, bloccaggi e poca trazione.',
    chk:'Confronta la mediana dei primi 3 giri lanciati con quella degli ultimi 3, e temperatura e usura di ogni gomma.',
    cls:{hy:'Dalla 1.4.2 la Hard Hypercar non c\'è a Daytona e Laguna Seca; a Daytona c\'è una gomma HY nuova.'},tele:'tyre'},
  pressure:{t:'Pressione gomme',g:'Gomme e freni',w:'In garage imposti la pressione a freddo; quella che conta in pista è quella a caldo. Cambia rigidezza della carcassa, impronta e risposta dello sterzo.',
    up:'Più alta: gomma più rigida, risposta più pronta, scalda meno. Se esageri, impronta più piccola e più scivolamento.',dn:'Più bassa: più impronta e più assorbimento, ma la carcassa lavora di più, scalda e la risposta diventa vaga.',
    much:'Una lettura sola dopo un testacoda o un bloccaggio inganna: quella gomma si è scaldata in modo anomalo.',
    chk:'Fai 5–8 giri puliti e guarda le pressioni stabilizzate a caldo e il profilo interno/centro/esterno (uniforme = pressione giusta). Nel menu box il gioco mostra la temperatura ideale di ogni mescola. Non esistono obiettivi ufficiali a caldo: non usare quelli di altre classi o di altri simulatori.',
    cls:{hy:'Molti setup shop tengono le Hypercar al minimo a freddo (131 kPa) e lasciano salire la pressione a caldo.',gt3:'Le GT3 hanno finestre diverse dalle Hypercar: non copiare i numeri tra classi.'},tele:'press'},
  camber:{t:'Campanatura',g:'Gomme e freni',w:'Inclina la ruota. In curva compensa rollio e deformazione della gomma; sul dritto toglie appoggio in frenata e in trazione.',
    up:'Più negativa: sostiene la spalla esterna nelle curve lunghe; troppa toglie impronta sul dritto e consuma l\'interno.',dn:'Meno negativa: più appoggio in frenata e trazione e usura più uniforme, ma nelle curve veloci carica troppo la spalla esterna.',
    much:'Interno molto più caldo senza guadagno in curva, oppure esterno troppo caldo con l\'auto che allarga nel lungo appoggio.',
    chk:'Temperatura interno − esterno dopo giri puliti (di solito qualche grado più caldo l\'interno) e usura per lato. Un asse alla volta. La campanatura non sistema un fondo che tocca.',tele:'camber'},
  toe:{t:'Convergenza',g:'Gomme e freni',w:'Angolo delle ruote viste dall\'alto. Davanti decide la prontezza in inserimento, dietro la stabilità del posteriore. Controlla sempre il segno che mostra il gioco.',
    up:'Più divergenza davanti: primo colpo di sterzo più pronto. Più convergenza dietro: posteriore più composto in ingresso e in trazione.',dn:'Meno divergenza davanti: muso più calmo. Meno convergenza dietro: l\'auto ruota di più ma perde margine di stabilità.',
    much:'Troppa convergenza in generale: strisciamento, calore, resistenza e instabilità. La rotazione "gratis" la paghi sul dritto e nello stint.',
    chk:'Confronta il primo colpo di sterzo, le correzioni sul dritto e le temperature. Passi piccoli, senza confondere +/− con convergenza/divergenza. La divergenza dietro rende l\'auto nervosa: di solito si evita. Più convergenza scalda anche le gomme.'},
  bias:{t:'Ripartizione frenata',g:'Gomme e freni',w:'Divide la frenata idraulica tra anteriore e posteriore. Trasferimento di carico e rigenerazione cambiano il margine reale.',
    up:'Più avanti: posteriore più stabile in staccata, ma blocchi prima davanti e l\'auto allarga in trail braking.',dn:'Più indietro: l\'auto ruota mentre rilasci il freno, ma rischi di bloccare il posteriore e girarti in ingresso.',
    much:'Se devi frenare molto meno per non bloccare, o correggere il volante a ogni staccata, sei fuori dalla finestra.',
    chk:'Dove e quando blocca la prima ruota, velocità minima e sterzo. Prova piccoli passi con la batteria simile. Se succede solo a batteria piena, guarda prima la rigenerazione.',
    cls:{hy:'Sulle ibride la rigenerazione frena un asse: con la batteria piena cambia il bilancio percepito.'},tele:'lock'},
  brakepress:{t:'Pressione freni',g:'Gomme e freni',w:'Scala la richiesta del pedale sulla coppia frenante massima. Non crea grip.',
    up:'Più alta: più frenata con il pedale al 100%. Serve se non arrivi al limite delle gomme, ma blocchi prima.',dn:'Più bassa: pedale più modulabile, ma rischi di non avere abbastanza frenata.',
    much:'Blocco immediato a quasi ogni staccata con il pedale al 100%, oppure pedale a fondo senza arrivare al limite.',
    chk:'Calibra prima la pedaliera (0–100%), poi confronta pressione freno e velocità ruote in staccate forti e leggere. Se cambi pedaliera, rifai la prova.',tele:'lock'},
  ducts:{t:'Prese freni',g:'Gomme e freni',w:'Aria a dischi e pastiglie. La temperatura dei freni cambia risposta, usura e calore trasmesso alla gomma.',
    up:'Più aperte: freni più freddi e stint più stabile; un po\' più di resistenza; troppo aperte lasciano i freni freddi.',dn:'Più chiuse: scaldano i freni e riducono la resistenza, ma in staccate ripetute e nel traffico possono surriscaldare.',
    much:'Pedale diverso tra primo e ultimo giro, freni fuori finestra o assi molto diversi tra loro.',
    chk:'Temperature freni a fine rettilineo e dopo la staccata più dura, in un long run. Dalla 1.4 la fisica dei freni è cambiata: non fissarti su un numero.',tele:'brk'},
  migration:{t:'Migrazione freno',g:'Gomme e freni',w:'Cambia la ripartizione durante la frenata (dove disponibile).',
    up:'Sposta il bilancio nella fase finale della frenata; leggi il valore effettivo, non solo il numero.',dn:'Effetto opposto sull\'ingresso; non cambia il grip totale.',
    much:'Auto che cambia carattere in ingresso tra staccate simili.',chk:'Regola prima la ripartizione statica, poi la migrazione. Esempio: base 54:46 con migrazione 2.0 avanti ≈ 56:44 a pedale pieno, poi torna indietro mentre rilasci (aiuta il trail braking). Si regola anche in macchina.'},
  regen:{t:'Rigenerazione',g:'Ibrido ed elettronica',w:'Quanta energia l\'ibrido recupera in frenata: frena un asse e cambia il bilancio di frenata.',
    up:'Più recupero se la batteria ha spazio, ma cambia stabilità e risposta sull\'asse che rigenera.',dn:'Più lavoro ai freni meccanici e meno carica.',
    much:'Batteria piena = niente recupero: se l\'auto cambia da un giro all\'altro a parità di setup, guarda la batteria.',chk:'Batteria, rigenerazione, freno e velocità ruote nella stessa curva per qualche giro. Di solito si tiene al massimo (170 kW sulle LMDh, 200 kW sulle LMH) e si gestisce l\'energia con la mappa del motore.',
    cls:{hy:'Ferrari 499P, Toyota, Peugeot e Isotta rigenerano/spingono davanti (LMH); le LMDh (BMW, Cadillac, Porsche, Alpine, Lambo, Genesis) dietro.'}},
  motor:{t:'Motore elettrico',g:'Ibrido ed elettronica',w:'Quanto e quanto in fretta usi la spinta elettrica. Non supera il limite di potenza totale: sostituisce una parte del termico.',
    up:'Più spinta: gestisce meglio la coppia ma scarica prima la batteria.',dn:'Meno spinta: tieni batteria per le staccate dopo, ma sposti consumo sul termico.',
    much:'Batteria al 100% blocca il recupero; a 0% perdi flessibilità (e una LMDh può avere problemi in pit lane). Non confondere batteria con energia virtuale.',
    chk:'Batteria allo stesso punto per 3 giri, energia virtuale usata a giro, stabilità in frenata. Prova le mappe su uno stint, non su un giro.',tele:'batt'},
  tc:{t:'Controllo trazione',g:'Ibrido ed elettronica',w:'In LMU sono tre controlli: TC (soglia di pattinamento), Power Cut (quanta potenza toglie quando interviene) e Slip Angle (quanto scivolamento laterale tollera).',
    up:'Più intervento: meno testacoda e stint più costante, ma un taglio continuo riduce la velocità in uscita.',dn:'Meno intervento: più gas se hai grip, ma più calore e tempo perso in pattinamento.',
    much:'TC che interviene per tutta l\'uscita: guarda meccanica e piede. Nessun TC e retro che parte: più protezione o gas più dolce.',
    chk:'Isola una curva: gas chiesto, taglio del TC e velocità 50–100 m dopo. Verifica nel gioco il verso dell\'indice per quell\'auto.',
    cls:{gt3:'Le GT3 hanno anche l\'ABS, che le Hypercar non hanno.'},tele:'spin'},
  abs:{t:'ABS',g:'Ibrido ed elettronica',w:'Solo sulle auto che lo hanno (GT3): quanto il sistema lascia bloccare la ruota prima di intervenire.',
    up:'Più intervento: meno bloccaggi, frenata più lunga se interviene troppo. Dal 2025 le mappe ABS GT3 sono descritte per comportamento: leggi la descrizione nel gioco.',dn:'Meno intervento: frenata più corta con piede preciso, ma più rischio di bloccare.',
    much:'Pedale che "vibra" in ogni staccata e auto che non si ferma: troppo ABS.',chk:'Scegli prima la mappa ABS, poi la ripartizione (cambiarle insieme rende l\'auto instabile). Frena al limite dell\'ABS senza appoggiarti. Guarda la velocità delle ruote anteriori in staccata.'},
  wing:{t:'Ala posteriore',g:'Aerodinamica e altezze',w:'Crea carico dietro e resistenza; sposta il bilancio aerodinamico soprattutto quando la velocità sale.',
    up:'Più ala: più stabile sul veloce e in frenata, meno velocità di punta. Se il retro si pianta e il muso allarga, serve bilancio davanti.',dn:'Meno ala: più punta e auto più mobile sul veloce, ma meno fiducia in appoggio e nei cambi di direzione.',
    much:'Guadagni punta ma perdi di più nelle curve veloci e devi alzare il piede, oppure ala alta e forte sottosterzo aerodinamico.',
    chk:'Velocità a fine rettilineo e minima nelle curve veloci, a parità di uscita dalla curva prima e di carburante.',
    cls:{hy:'Su alcune Hypercar l\'ala è a step (P1…P7). La Peugeot 9X8 originale non ha ala posteriore: non copiare valori dalla 2024+.'}},
  rh:{t:'Altezza da terra',g:'Aerodinamica e altezze',w:'Quota statica del fondo. In pista conta quella dinamica, con il pieno, le compressioni e la velocità.',
    up:'Più alta: meno fondo che tocca e più margine sui cordoli, ma meno carico. Più alta dietro che davanti = più rake.',dn:'Più bassa: più carico se resti nella finestra del fondo; troppo bassa tocca e perde grip all\'improvviso.',
    much:'Scintille frequenti, sterzo che si alleggerisce nelle compressioni, velocità persa proprio dove pensavi di guadagnare.',
    chk:'Altezza minima e corsa della sospensione a pieno carico, non solo il valore del garage. Cambia poco per volta. Alzare è la modifica che cambia di più la guida (alza il baricentro).',tele:'rh'},
  rake:{t:'Rake (assetto)',g:'Aerodinamica e altezze',w:'Differenza tra altezza dietro e davanti: cambia beccheggio e quanto lavora il fondo.',
    up:'Più rake: più inserimento e più anteriore, ma meno stabilità e fondo fuori finestra.',dn:'Meno rake: retro più calmo sul veloce, ma meno mordente al muso.',
    much:'Auto rapidissima in ingresso ma nervosa a centro curva, oppure posteriore che collassa con pieno e ala.',chk:'Altezze davanti e dietro a velocità uguali, in T1 e a fine rettilineo.',tele:'rh'},
  spring:{t:'Molle',g:'Sospensioni',w:'Sostengono il peso e controllano la corsa. Non sono gli ammortizzatori.',
    up:'Più rigida davanti: protegge la piattaforma ma toglie grip all\'anteriore. Più rigida dietro: più rotazione, meno trazione.',dn:'Più morbida: segue il terreno e dà grip a quell\'asse, ma consuma corsa e aumenta beccheggio e rollio.',
    much:'Troppo morbida: fondo a terra e reazioni lente. Troppo rigida: salta sui cordoli e perde grip sullo sconnesso.',
    chk:'Corsa e altezza dinamica, poi la mediana dei giri. Se ammorbidisci, ricontrolla altezza e packer.',tele:'travel'},
  heave:{t:'Terza molla (heave)',g:'Sospensioni',w:'Lavora quando le due ruote di un asse si comprimono insieme (carico aerodinamico, compressioni); poco sul rollio.',
    up:'Più rigida: tiene l\'altezza con il carico aerodinamico e riduce il fondo che tocca, ma l\'asse diventa duro sulle compressioni e sul banking.',dn:'Più morbida: lascia lavorare la piattaforma sui dossi, ma consuma corsa e fa variare di più l\'altezza.',
    much:'A Daytona il fondo smette di toccare ma l\'auto saltella: hai spostato il problema dal fondo all\'assorbimento.',chk:'Compressione di entrambe le ruote, altezza minima e accelerazione verticale. Un asse alla volta.',tele:'travel'},
  packer:{t:'Packer (fine corsa)',g:'Sospensioni',w:'Decide quanta corsa resta prima della battuta. Il verso del numero dipende dall\'interfaccia.',
    up:'Packer più spesso: interviene prima e impedisce di scendere troppo, ma crea una "seconda molla" improvvisa.',dn:'Più sottile: più corsa e assorbimento, ma il fondo può toccare.',
    much:'L\'auto perde grip solo sul dosso o a fine staccata con un colpo secco nella corsa: è entrata nel packer.',chk:'Distanza dal fine corsa in telemetria, stessa linea sul cordolo. Non usarlo per correggere un\'altezza sbagliata.',tele:'travel'},
  tender:{t:'Molla tender',g:'Sospensioni',w:'Molla ausiliaria morbida che lavora solo nei primi millimetri di corsa (quando presente).',
    up:'Più rigida o più corsa: cambia la risposta iniziale sui piccoli movimenti.',dn:'Staccata (detached): lavora solo la molla principale.',much:'Auto che "galleggia" sui primi millimetri.',chk:'Guarda la corsa nei primi millimetri sui rettilinei sconnessi.'},
  arbF:{t:'Barra antirollio anteriore',g:'Sospensioni',w:'Lega le due ruote anteriori nel rollio e decide quanto trasferimento laterale si prende l\'anteriore.',
    up:'Più rigida: piattaforma più stabile ma meno grip relativo davanti, più sottosterzo a centro curva. Sullo sconnesso accoppia le ruote.',dn:'Più morbida: aiuta muso e cordoli, ma più rollio e transizioni più lente.',
    much:'Sterza all\'inizio e poi allarga a metà curva: barra anteriore troppo rigida. Se ondeggia, forse troppo morbida.',chk:'Un click e misura lo sterzo a velocità minima uguale. Cambia anche altezza dinamica e campanatura.',tele:'us'},
  arbR:{t:'Barra antirollio posteriore',g:'Sospensioni',w:'Lega le ruote posteriori nel rollio: decide quanto grip cede il posteriore, soprattutto a centro curva.',
    up:'Più rigida: l\'auto ruota di più e aiuta un muso pigro, ma meno trazione e retro nervoso sui cordoli.',dn:'Più morbida: pianta il retro e aiuta il gas, con rischio di sottosterzo e rotazione lenta.',
    much:'Gira bene sul giro secco ma pattina a ogni uscita; oppure è sicura ma chiede tanto sterzo a metà curva.',chk:'Gas applicato, TC, velocità in uscita e correzioni. Non irrigidire dietro per compensare un anteriore che tocca.',tele:'spin'},
  slowbump:{t:'Compressione lenta (slow bump)',g:'Ammortizzatori',w:'Frena i movimenti lenti della sospensione: beccheggio in frenata e accelerazione, rollio in inserimento. "Lento" è la velocità dello stelo, non della curva.',
    up:'Più freno: risposta più controllata, ma il carico arriva tardi alla gomma.',dn:'Meno freno: trasferimento più rapido e più assorbimento, ma più beccheggio e assestamenti ampi.',
    much:'Troppo: auto rigida e senza grip nel primo inserimento. Troppo poco: movimento continuo, telaio difficile da fermare.',
    chk:'Prima risposta allo sterzo, altezza e rollio 0,2–0,5 s dopo l\'input. Nell\'analisi sospensioni: equilibrio tra compressione ed estensione lenta.',tele:'damp'},
  slowreb:{t:'Estensione lenta (slow rebound)',g:'Ammortizzatori',w:'Frena il ritorno dopo il trasferimento di carico: rilascio del freno, passaggio da una curva all\'altra.',
    up:'Più freno: ritorno più composto, ma in sequenza l\'asse non recupera corsa.',dn:'Meno freno: recupero più rapido, con rischio di rimbalzi e oscillazioni.',
    much:'In una esse la seconda curva va peggio della prima: la sospensione ci arriva ancora compressa o scarica.',chk:'Corsa prima e dopo la transizione. Non correggere con il rebound un problema di molla o geometria.',tele:'damp'},
  fastbump:{t:'Compressione veloce (fast bump)',g:'Ammortizzatori',w:'Smorza i colpi rapidi dello stelo: cordoli, giunti, buche. Non c\'entra con la velocità dell\'auto.',
    up:'Più freno: meno corsa sull\'urto, ma più forza alla gomma che può perdere contatto.',dn:'Meno freno: la ruota sale sul cordolo, ma se troppo libera arriva a fine corsa.',
    much:'Cordolo che lancia l\'auto, oppure fondo che tocca subito dopo un taglio: i due estremi chiedono correzioni opposte.',chk:'Corsa massima, velocità ruote e velocità di uscita della stessa variante, stessa linea.',tele:'damp'},
  fastreb:{t:'Estensione veloce (fast rebound)',g:'Ammortizzatori',w:'Controlla la ruota mentre torna giù dopo un urto.',
    up:'Più freno: ferma il rimbalzo, ma troppo tiene la ruota sollevata dopo il dosso.',dn:'Meno freno: la ruota torna subito a terra, ma può fare una seconda oscillazione.',
    much:'Doppio colpo sul volante o trazione persa subito dopo il cordolo.',chk:'Tempo per tornare all\'altezza di prima e velocità delle ruote, non solo il picco sull\'urto.',tele:'damp'},
  heavedamp:{t:'Ammortizzatori del 3° elemento',g:'Ammortizzatori',w:'Smorzano i movimenti comuni dell\'asse (heave e beccheggio).',
    up:'Più freno: sostiene i transitori aerodinamici.',dn:'Meno freno: assorbe meglio i dossi.',much:'Troppo: peggiora l\'assorbimento sui dossi e sui banking.',chk:'Altezza e corsa nelle compressioni e in staccata.',tele:'damp'},
  preload:{t:'Precarico differenziale',g:'Trasmissione',w:'Bloccaggio che resta quando la coppia è bassa: pesa molto nel passaggio tra freno e gas.',
    up:'Più precarico: ruote dietro più legate, ingresso più stabile, ma meno rotazione nelle lente.',dn:'Meno precarico: più rotazione, ma transizione instabile e ruota scarica che pattina.',
    much:'Se l\'auto gira solo togliendo tanto precarico e poi è nervosa a ogni rilascio, stai curando un sintomo.',chk:'Una curva lenta a gas zero e una con gas progressivo: imbardata, sterzo e velocità ruote.'},
  diffpower:{t:'Differenziale in trazione (power)',g:'Trasmissione',w:'Quanto si blocca il differenziale con il gas.',
    up:'Più chiuso: spinge anche con una ruota scarica, ma l\'auto tende ad andare dritta in uscita.',dn:'Più aperto: ruota con il gas, ma la ruota interna può pattinare.',
    much:'"Più chiuso = più trazione" non è sempre vero: con tanto grip porta sottosterzo e fa scivolare entrambe le ruote.',chk:'Separa gas pieno, primo gas e rilascio: verifica che l\'effetto sia lì.',tele:'spin'},
  diffcoast:{t:'Differenziale in rilascio (coast)',g:'Trasmissione',w:'Quanto si blocca il differenziale in rilascio e in frenata.',
    up:'Più chiuso: retro più stabile in ingresso, ma frena la rotazione.',dn:'Più aperto: ingresso più libero, con rischio di rotazione eccessiva.',
    much:'Auto che non vuole girare in ingresso pur con il freno ben ripartito.',chk:'Ingresso curva con freno simile: imbardata e sterzo.'},
  gears:{t:'Rapporti e finale',g:'Trasmissione',w:'Compromesso tra accelerazione, limitatore e velocità massima.',
    up:'Più lunghi: meno giri a pari velocità, meno spinta in uscita.',dn:'Più corti: più ripresa, ma arrivi prima al limitatore.',
    much:'Limitatore ben prima della staccata, oppure marce che non tirano in uscita. Non allungare per coprire una cattiva uscita.',chk:'Giri motore a fine rettilineo, anche in scia. Dalla 1.4 il diametro dinamico delle gomme Hypercar è cambiato: ricontrolla i rapporti dei setup vecchi.'},
  radiator:{t:'Radiatori',g:'Motore e strategia',w:'Apertura del raffreddamento: chiudere riduce resistenza ma alza le temperature.',
    up:'Più coperto: meno resistenza, temperature più alte.',dn:'Più aperto: motore più fresco, un po\' più di resistenza.',much:'Motore troppo caldo nel traffico o nello stint lungo.',chk:'Temperature acqua e olio nella parte peggiore dello stint.',tele:'temp'},
  fuel:{t:'Carburante ed energia',g:'Motore e strategia',w:'Peso e autonomia. Sulle Hypercar conta l\'energia virtuale (NRG) per stint, diversa dalla batteria.',
    up:'Più carburante: più peso, cambia l\'altezza.',dn:'Meno: auto leggera, stint più corto.',much:'Benzina nel serbatoio ma energia virtuale a zero: a 0% di NRG c\'è uno stop-and-go di 100 s.',chk:'Energia e consumo a giro: non caricare oltre quello che puoi usare.',tele:'fuel'}};

// LMU setting → card
const GUIDE_KEY=[[/^Compound/,'compound'],[/^Pressure/,'pressure'],[/^Camber/,'camber'],[/ToeIn|ToeOffset/,'toe'],[/^RearBrake/,'bias'],[/^BrakePressure/,'brakepress'],[/^BrakeDuct/,'ducts'],[/^BrakeMigration/,'migration'],
  [/^Regeneration/,'regen'],[/^ElectricMotor/,'motor'],[/^(TractionControl|TCPowerCut|TCSlipAngle|TC)Setting|^TC/,'tc'],[/^(AntilockBrake|ABS)/,'abs'],[/^RW/,'wing'],[/^FW/,'wing'],[/^RideHeight/,'rh'],
  [/^(Front|Rear)3rd(Slow|Fast)(Bump|Rebound)/,'heavedamp'],[/^(Front|Rear)3rdSpring/,'heave'],[/Packer/,'packer'],[/^Tender/,'tender'],[/^Spring/,'spring'],[/^FrontAntiSway/,'arbF'],[/^RearAntiSway/,'arbR'],
  [/^SlowBump/,'slowbump'],[/^SlowRebound/,'slowreb'],[/^FastBump/,'fastbump'],[/^FastRebound/,'fastreb'],[/^DiffPreload|^FrontDiffPreload/,'preload'],[/^DiffPower|^FrontDiffPower/,'diffpower'],[/^DiffCoast|^FrontDiffCoast/,'diffcoast'],
  [/^(FinalDrive|RatioSet|Gear\d)/,'gears'],[/Radiator/,'radiator'],[/^(Fuel|VirtualEnergy)/,'fuel']];
const guideId=k=>{for(const [re,id] of GUIDE_KEY)if(re.test(k))return id;return null;};
const LABEL2KEY=(()=>{const m={};Object.entries(SETUP_LABELS).forEach(([k,l])=>{if(!m[l])m[l]=k;});return m;})();

// ---------- 2. symptoms: the order to work in, without changing ten values ----------
const GUIDE_SYM=[
  {s:'Blocca davanti a fine staccata',f:['Ripartizione leggermente indietro','oppure meno pressione freni se il 100% del pedale è inutilizzabile'],p:'Controlla rigenerazione/batteria, temperature freni, altezza davanti e come rilasci il freno.',k:['bias','brakepress','regen']},
  {s:'Frena forte, poi si gira in trail braking',f:['Controlla se blocca dietro e se batteria/rigenerazione sono simili tra i giri','Ripartizione un po\' avanti','Se è nervosa senza bloccare: più coast/precarico o più convergenza dietro'],p:'Una ripartizione troppo avanti blocca davanti e allunga la staccata: non curare il posteriore con un\'auto che non gira più.',k:['bias','diffcoast','preload','toe']},
  {s:'Sottosterzo in ingresso',f:['Ripartizione un filo indietro','meno coast/precarico','più divergenza davanti o un po\' di rake'],p:'Verifica prima di non entrare troppo forte (velocità minima).',k:['bias','diffcoast','toe','rake']},
  {s:'Sottosterzo a centro curva lenta',f:['Barra anteriore più morbida','oppure posteriore un filo più rigida'],p:'Poi precarico/coast, campanatura e velocità minima. Non aspettarti che l\'ala risolva una curva lenta.',k:['arbF','arbR','preload','camber']},
  {s:'Sottosterzo nelle curve veloci',f:['Controlla altezza dinamica e rake','un click di ala in meno o anteriore un filo più basso'],p:'Se succede solo nel veloce è aerodinamica, non barre.',k:['rh','rake','wing']},
  {s:'Posteriore scivola a centro curva lenta (prima del gas)',f:['Non è il TC: non stai accelerando','Barra posteriore più morbida o meno rigidezza dietro','Rilascio del freno meno brusco'],p:'L\'ala aiuta molto di più sul veloce: nelle lente cerca grip meccanico.',k:['arbR','spring','bias']},
  {s:'Perde trazione in uscita',f:['Barra posteriore più morbida','TC / Power Cut calibrati','gas più progressivo'],p:'Poi differenziale in trazione/precarico, convergenza dietro, terza molla o fine corsa.',k:['arbR','tc','diffpower','preload']},
  {s:'Ruota troppo in ingresso e non ha trazione in uscita',f:['Sono due problemi: stabilizza l\'ingresso con ripartizione/coast/convergenza','poi la trazione con barra posteriore, differenziale e TC'],p:'Un click che rallenta l\'ingresso ma salva l\'uscita può valere di più sul settore: misura.',k:['bias','diffcoast','arbR','tc']},
  {s:'Instabile sul veloce',f:['Più ala','meno rake','controlla l\'altezza dinamica'],p:'Poi barre e convergenza dietro; prova con batteria, gomme e pieno simili.',k:['wing','rake','rh','toe']},
  {s:'Saltella sui cordoli',f:['Compressione/estensione veloce meno rigide','controlla packer e altezza'],p:'Poi molle e terza molla; scegli una linea che non chieda un compromesso esagerato.',k:['fastbump','fastreb','packer','spring']},
  {s:'Tocca sul banking o sui dossi',f:['Conferma fondo a terra con altezza minima e corsa','alza il lato coinvolto il minimo utile','se perdi carico: più terza molla, controlla i packer'],p:'Irrigidire tutto toglie le scintille ma peggiora T1, cordoli e usura.',k:['rh','heave','packer','fastbump']},
  {s:'Il TC taglia tutta l\'uscita',f:['Distingui pattinamento vero da intervento anticipato','se pattina: più grip dietro (barra, differenziale, convergenza, gas, gomme)','se non pattina: rivedi TC, Power Cut e Slip Angle'],p:'Togliere il TC a gomme calde fa un giro "eroe" e rovina il long run.',k:['tc','arbR','diffpower']},
  {s:'Lenta sul dritto',f:['Controlla l\'uscita dalla curva prima e la scia','rapporti/limitatore, ala e radiatori','misura la velocità a parità di distanza'],p:'Togliere ala per 3 km/h può farti perdere di più nelle curve veloci e in frenata.',k:['wing','gears','radiator']},
  {s:'Gomme fredde (pioggia, notte, pista fredda)',f:['Pressione un po\' più bassa','prese freni più chiuse','un po\' più di convergenza','meno TC/ABS se ti frena l\'uscita'],p:'Controlla la temperatura ideale della mescola nel menu box.',k:['pressure','ducts','toe','tc']},
  {s:'Gomme surriscaldate',f:['Pressione un po\' più alta','meno convergenza e meno campanatura','guida più pulita: meno correzioni e pattinamento'],p:'Se scalda solo il posteriore in uscita, guarda prima TC e differenziale.',k:['pressure','toe','camber','tc']},
  {s:'Le gomme calano nello stint',f:['Guarda pressioni a caldo e profilo','meno campanatura se l\'interno è troppo caldo','più TC o differenziale più aperto se il posteriore pattina'],p:'Il giro secco che migliora mentre il quinto peggiora = più calore e usura.',k:['pressure','camber','tc','diffpower']}];

// ---------- 3. tracks: what they ask of the setup ----------
const GUIDE_TRK={bahrain:['Stop-and-go con staccate forti a T1, T4 e T10, trazione, asfalto abrasivo e caldo','Freni e stabilità nelle lente; occhio al degrado del posteriore.'],
  barcelona:['Curve medie e lunghe, carico laterale continuo','Anteriore a centro curva e gestione gomme.'],
  lemans:['Rettilinei lunghi (Hunaudières), staccate a Indianapolis e Arnage, Porsche Curves, cordoli alle chicane','Ala/resistenza contro stabilità sul veloce; non sacrificare Tertre Rouge e le uscite dalle chicane.'],
  ricard:['Curve lunghe e veloci (Signes, Beausset), più layout','Piattaforma aerodinamica e appoggio lungo; controlla il layout (1A o 1A-V2).'],
  cota:['Esse veloci del primo settore, T1 in salita, staccate forti a T11 e T12, sconnessa','Passaggio veloce-lento, trazione; energia e stint (BoP 1.4.2).'],
  daytona:['Banking, chicane, cordoli e compressioni','Altezza dinamica e terza molla; dalla 1.4.2 gomma HY nuova e niente Hard.'],
  fuji:['Rettilineo molto lungo, staccata forte alla T1, ultimo settore tortuoso','Velocità di punta senza uccidere trazione e anteriore nelle lente.'],
  imola:['Cordoli, saliscendi, staccate e trazione da Tosa e Rivazza','Assorbimento e stabilità sui cordoli; non inseguire solo l\'altezza minima. Altezza ad Acque Minerali.'],
  interlagos:['Saliscendi, medio-lente, lungo tratto in pieno','Frenata in discesa e trazione nell\'ultimo settore: vale anche sul rettilineo.'],
  qatar:['Curve medio-veloci collegate, uscite lunghe','Anteriore a centro curva con un posteriore stabile in appoggio.'],
  monza:['Rettilinei lunghi, chicane (Rettifilo, Roggia, Ascari), Lesmo e Parabolica','Ala minima che tiene frenata e Ascari/Parabolica; l\'uscita dalle chicane vale più della punta.'],
  portimao:['Dossi e compressioni, forte variazione di carico','Altezza dinamica e assorbimento; niente piattaforma troppo rigida.'],
  sebring:['La pista più sconnessa: cemento, giunti, dossi alla T17; staccate e curve lunghe','Parti dal basso: corsa, packer e ammortizzatori veloci prima di irrigidire.'],
  silverstone:['Curve veloci in sequenza (Maggotts, Becketts, Chapel, Copse), cambi di direzione','Carico e sostegno davanti senza rendere nervoso il retro.'],
  spa:['Eau Rouge/Raidillon (compressione), Pouhon e Blanchimont veloci, cordoli alla Bus Stop','Margine in compressione, compromesso ala/velocità e stabilità.'],
  laguna:['Dossi, Corkscrew, frenata in discesa','Grip meccanico e controllo del beccheggio; niente Hard HY.'],
  atlanta:['Dossi ciechi, curve con pendenza, discesa verso T10','Piattaforma stabile senza sacrificare l\'assorbimento.'],
  longbeach:['Cittadino stretto, muretti, curve lente','Trazione, freni e precisione; setup permissivo sui cordoli.']};

// ---------- 4. cars: identity and first check (Hypercar) ----------
const GUIDE_CAR=[[/alpine|a424/i,'LMDh, V6 turbo, ibrido posteriore','Parti dalla stabilità in frenata e verifica che il muso non arrivi da troppo rake.','Alpine A424'],
  [/valkyrie|aston.*hyper/i,'LMH senza ibrido, V12 aspirato','Niente rigenerazione: calibra freni e ripartizione, poi trazione con barra e differenziale.','Aston Martin Valkyrie'],
  [/bmw_m_hybrid|bmw.*hybrid/i,'LMDh, V8 biturbo, ibrido posteriore','Se manca muso nelle lente prova il bilancio meccanico prima di togliere ala. Capisci se scivola a gas zero, al primo gas o con il TC: sono tre cause diverse.','BMW M Hybrid V8'],
  [/cadillac/i,'LMDh, V8 aspirato, ibrido posteriore','Tieni separati rotazione e trazione: barra anteriore per il centro curva, posteriore e differenziale per l\'uscita. Con la EVO 2026 usa una base 2026.','Cadillac V-Series.R'],
  [/499p|ferrari_499/i,'LMH, V6 biturbo, ibrido anteriore','Batteria e rigenerazione cambiano la frenata: controllale prima di toccare le altezze.','Ferrari 499P'],
  [/genesis|gmr/i,'LMDh, V8 biturbo, ibrido posteriore','Confronta le uscite dalle medio-lente con il TC; prima un posteriore più permissivo, poi meno TC solo se la ruota non pattina.','Genesis GMR-001'],
  [/isotta|tipo6/i,'LMH, V6 turbo, ibrido anteriore','Parti da energia a giro e temperature, poi bilancio tra frenata e trazione.','Isotta Fraschini Tipo 6'],
  [/sc63|lamborghini_sc/i,'LMDh, V8 biturbo, ibrido posteriore','Prima costanza sui cordoli e stabilità in ingresso, poi libera la rotazione.','Lamborghini SC63'],
  [/9x8|peugeot/i,'LMH, V6 biturbo, ibrido anteriore','La 9X8 originale (senza ala) e la 2024+ sono due auto diverse: non copiare ala, rake e differenziale.','Peugeot 9X8'],
  [/963/i,'LMDh, V8 biturbo, ibrido posteriore','Se sottosterza nel lento lavora sul bilancio meccanico; se è instabile nell\'inserimento veloce guarda altezza dinamica, ala e ripartizione.','Porsche 963'],
  [/toyota|gr010|tr010/i,'LMH, V6 biturbo, ibrido anteriore','La TR010 2026 ha aero nuovo: riparti da un setup 2026, controlla altezze nel veloce.','Toyota GR010 / TR010'],
  [/vanwall/i,'LMH senza ibrido, V8 aspirato','Fissa frenata e piattaforma prima di cercare il compromesso di ala.','Vanwall Vandervell 680'],
  [/glickenhaus|scg/i,'LMH senza ibrido, V8 biturbo','Base di freni e trazione, poi ala/resistenza.'],'Glickenhaus SCG 007'];
const guideCar=c=>GUIDE_CAR.find(x=>x[0].test(c||''));
const guideCls=c=>/gt3|lmgt3/i.test(c||'')?'gt3':/lmp2|oreca/i.test(c||'')?'lmp2':/lmp3|p325|ginetta|d09|ad25/i.test(c||'')?'lmp3':/gte/i.test(c||'')?'gte':'hy';

// ---------- 5. the card, with the numbers of the open session and of the library ----------
function guideTele(id,S){if(!S||!S.ch)return'';const ch=S.ch;const W=['FL','FR','RL','RR'];const avg=n=>{const c=ch[n];if(!c)return NaN;const v=c.v;let s=0,k=0;for(let i=0;i<v.length;i+=3){if(Number.isFinite(v[i])){s+=v[i];k++;}}return k?s/k:NaN;};
  const q=(n,p)=>{const c=ch[n];if(!c)return NaN;const a=[...c.v].filter(Number.isFinite).sort((x,y)=>x-y);return a.length?a[Math.floor(p*(a.length-1))]:NaN;};const f=(x,d=1)=>Number.isFinite(x)?x.toFixed(d):'—';
  const row=(lab,fn)=>`<tr><td class="l">${lab}</td>${W.map(w=>`<td>${fn(w)}</td>`).join('')}</tr>`;const tab=rows=>`<div class="tw"><table class="lbt"><thead><tr><th></th>${W.map(w=>`<th>${w}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div>`;
  if(id==='camber')return tab(row(tr('Interno − esterno °C'),w=>f(avg(`Tyre Temp ${w} Inner`)-avg(`Tyre Temp ${w} Outer`)))+row(tr('Campanatura in pista °'),w=>f(avg(`Camber ${w}`),2)));
  if(id==='press'||id==='tyre')return tab(row(tr('Pressione a caldo kPa'),w=>f(avg(`Tyre Pressure ${w}`)))+row(tr('Carcassa °C'),w=>f(avg(`Tyre Carcass Temp ${w}`),0))+row(tr('Usura %'),w=>{const c=ch[`Tyre Wear ${w}`];return c?f(c.v[0]-c.v[c.v.length-1],2):'—';}));
  if(id==='rh'||id==='travel')return tab(row(tr('Altezza minima mm (5%)'),w=>f(q(`Ride Height ${w}`,.05)))+row(tr('Altezza media mm'),w=>f(avg(`Ride Height ${w}`)))+row(tr('Corsa usata mm'),w=>f(q(`Susp Pos ${w}`,.99)-q(`Susp Pos ${w}`,.01))));
  if(id==='brk')return tab(row(tr('Freni picco °C'),w=>f(q(`Brake Temp ${w}`,.99),0))+row(tr('Freni media °C'),w=>f(avg(`Brake Temp ${w}`),0)));
  if(id==='batt'){const b=ch['Battery Charge Level'];return b?`<p class="small">${tr('Batteria in questa sessione')}: ${f(q('Battery Charge Level',.02),0)}–${f(q('Battery Charge Level',.98),0)} %</p>`:'';}
  if(id==='temp')return `<p class="small">${tr('Acqua')} ${f(q('Eng Water Temp',.98),0)} °C · ${tr('olio')} ${f(q('Eng Oil Temp',.98),0)} °C (${tr('picchi')})</p>`;
  if(id==='damp')return `<p class="small muted">${tr('L\'analisi di sospensioni e ammortizzatori di questa telemetria è nel pannello «Sospensioni e ammortizzatori» qui in Setup.')}</p>`;
  if(id==='lock'||id==='spin')return `<p class="small muted">${tr('Bloccaggi in frenata e pattinamento in uscita di questa telemetria sono nel Dottore del setup, sezione «Freni e trazione».')}</p>`;
  return'';}
function guideLib(key,car){if(!car||typeof libLearn!=='function')return'';const C=libLearn()[car];if(!C)return'';const ks=Object.keys(C.keys).filter(k=>k.split('|')[1]===key);if(!ks.length)return'';
  const K=C.keys[ks[0]];const ord=[...K.disp].sort((a,b)=>a[0]-b[0]);if(ord.length<2)return'';const lo=ord[0][1],hi=ord[ord.length-1][1];
  const cnt=new Map();SETLIB.filter(e=>e.car===car).forEach(e=>{const it=(e.su.sec[ks[0].split('|')[0]]||[]).find(x=>x.key===key);if(it)cnt.set(it.disp,(cnt.get(it.disp)||0)+1);});const top=[...cnt].sort((a,b)=>b[1]-a[1]).slice(0,3);
  return `<p class="small"><b>${tr('Su questa auto')}</b> (${C.n} ${tr('setup in libreria')}): ${tr('da')} <span class="mono">${esc(lo)}</span> ${tr('a')} <span class="mono">${esc(hi)}</span>; +1 click = ${tr('valore mostrato')} ${K.sign>0?tr('più alto'):tr('più basso')}. ${tr('I più usati')}: ${top.map(([d,n])=>`<span class="mono">${esc(d)}</span> (${n})`).join(', ')}.</p>`;}

function openGuide(key,ctx={}){const id=GUIDE_P[key]?key:guideId(key);const P=GUIDE_P[id];if(!P)return;
  let m=$('#mGuide');if(!m){m=document.createElement('div');m.className='modal';m.id='mGuide';m.hidden=true;m.innerHTML='<div class="mbox wide"><div class="panel-h"><h2 id="mGuideT"></h2><button class="btn" type="button" data-close>'+tr('Chiudi')+'</button></div><div id="mGuideB"></div></div>';document.body.appendChild(m);}
  const S=active()?.S;const su=($('#suFile')&&typeof byId==='function'&&byId($('#suFile').value))||active()?.su||null;const car=ctx.car||(typeof libCar==='function'&&su?.car?libCar(su.car):'')||'';const cls=guideCls(car||S?.meta?.car);
  const settingKey=GUIDE_P[key]?null:key;const now=settingKey&&su?Object.entries(su.sec).flatMap(([sec,it])=>it.filter(x=>x.key===settingKey&&x.disp&&!/N\/A/.test(x.disp)).map(x=>`${SH_SEC[sec]?SH_SEC[sec]+' ':''}<span class="mono">${esc(x.disp)}</span>`)).slice(0,4).join(' · '):'';
  const li=(lab,txt,c='')=>`<div class="gl ${c}"><b>${lab}</b><p>${esc(tr(txt))}</p></div>`;
  $('#mGuideT').textContent=tr(P.t);
  $('#mGuideB').innerHTML=`<p class="muted small" style="margin:0 0 10px">${esc(tr(P.g))}${now?` · ${tr('nel tuo setup')}: ${now}`:''}</p>
    ${li(tr('Cosa fa'),P.w)}<div class="glr">${li('▲ '+tr('Se aumenti'),P.up,'up')}${li('▼ '+tr('Se diminuisci'),P.dn,'dn')}</div>${li(tr('Quando è troppo'),P.much,'warn')}${li(tr('Come lo verifichi'),P.chk)}
    ${P.cls&&P.cls[cls]?`<p class="small" style="margin:8px 0"><b>${cls==='hy'?'Hypercar':cls.toUpperCase()}</b>: ${esc(tr(P.cls[cls]))}</p>`:''}
    ${settingKey?guideLib(settingKey,car):''}${(()=>{const t=P.tele&&S?guideTele(P.tele,S):'';return t?`<div style="margin-top:10px"><b class="small">${tr('Nella telemetria aperta')}</b>${t}</div>`:'';})()}
    <p class="muted small" style="margin-top:10px">${tr('Un click non fa lo stesso effetto su tutte le auto. Cambia un gruppo di parametri alla volta e confronta 3–5 giri puliti nelle stesse condizioni.')}</p>`;
  openModal('#mGuide');}
window.openGuide=openGuide;

// ---------- 6. every setting name in the Setup page opens its card ----------
function guideLink(root){(root||document).querySelectorAll('#v-setup .kv > span:nth-child(odd):not([data-gk]), #v-setup td.l:first-child:not([data-gk])').forEach(el=>{
    const b=el.querySelector('b')||el;const txt=(b.firstChild&&b.firstChild.nodeType===3?b.firstChild.textContent:b.textContent).trim();const key=LABEL2KEY[txt];el.dataset.gk=key||'';if(!key||!guideId(key))return;
    el.classList.add('gk');el.title=tr('Cosa fa e cosa succede se lo cambi');});}
document.addEventListener('click',e=>{const el=e.target.closest('[data-gk].gk');if(el&&el.dataset.gk){e.preventDefault();openGuide(el.dataset.gk,{car:$('#genCar')?.value});}});
(function(){let pend=0;const v=$('#v-setup');if(!v)return;new MutationObserver(()=>{if(pend)return;pend=requestAnimationFrame(()=>{pend=0;guideLink(v);});}).observe(v,{childList:true,subtree:true});})();

// ---------- 7. the guide panel: settings, symptoms, tracks, cars, method ----------
function guideHTML(tab){const tabs=[['p','Parametri'],['s','Sintomi'],['t','Piste'],['c','Auto'],['m','Metodo']];
  let h=`<div class="gtabs">${tabs.map(([k,l])=>`<button type="button" class="btn${k===tab?' primary':''}" data-gt="${k}">${tr(l)}</button>`).join('')}</div>`;
  if(tab==='p'){const by={};Object.entries(GUIDE_P).forEach(([id,P])=>(by[P.g]??=[]).push([id,P]));
    h+=Object.entries(by).map(([g,L])=>`<div class="ggrp"><h4>${tr(g)}</h4><div class="gchips">${L.map(([id,P])=>`<button type="button" class="gchip" data-gp="${id}">${tr(P.t)}</button>`).join('')}</div></div>`).join('');}
  if(tab==='s')h+=GUIDE_SYM.map(x=>`<details class="gsym"><summary>${tr(x.s)}</summary><ol>${x.f.map(f=>`<li>${esc(tr(f))}</li>`).join('')}</ol><p class="small muted">${esc(tr(x.p))}</p><div class="gchips">${x.k.map(k=>`<button type="button" class="gchip" data-gp="${k}">${tr(GUIDE_P[k].t)}</button>`).join('')}</div></details>`).join('');
  if(tab==='t')h+=`<div class="tw"><table class="lbt"><thead><tr><th class="l">${tr('Pista')}</th><th class="l">${tr('Carattere')}</th><th class="l">${tr('Cosa chiede al setup')}</th></tr></thead><tbody>${LIB_TRACKS.filter(t=>GUIDE_TRK[t[0]]).map(t=>`<tr><td class="l"><b>${t[1]}</b></td><td class="l small">${esc(tr(GUIDE_TRK[t[0]][0]))}</td><td class="l small">${esc(tr(GUIDE_TRK[t[0]][1]))}</td></tr>`).join('')}</tbody></table></div>`;
  if(tab==='c')h+=`<div class="tw"><table class="lbt"><thead><tr><th class="l">Hypercar</th><th class="l">${tr('Architettura')}</th><th class="l">${tr('Primo controllo')}</th></tr></thead><tbody>${GUIDE_CAR.map(c=>`<tr><td class="l"><b>${esc(c[3])}</b></td><td class="l small">${esc(tr(c[1]))}</td><td class="l small">${esc(tr(c[2]))}</td></tr>`).join('')}</tbody></table></div>`;
  if(tab==='m')h+=`<div class="gl"><b>${tr('Ordine di lavoro')}</b><p>${tr('1) gomme, freni e comandi · 2) altezza dinamica e ala · 3) barre, molle e differenziale · 4) ammortizzatori · 5) elettronica e strategia. Il cronometro conta solo quando l\'auto è ripetibile.')}</p></div>
    <div class="gl"><b>${tr('Prova A/B')}</b><p>${tr('Stesso meteo e gommatura della pista, stesso carburante, mescola, pressioni e stile. 3–5 giri validi per variante; confronta la mediana dei giri, i settori e la velocità di uscita. In gara ripeti con il pieno e gomme usate. Una variante alla volta.')}</p></div>
    <div class="gl"><b>${tr('Sessione da 30 minuti')}</b><p>${tr('0–5: setup di base, controlla pedaliera, freni, gomme, carburante. 5–15: 5–6 giri, scarta traffico e giro di lancio, annota 2 curve lente e 2 veloci, scegli un solo problema misurabile. 15–23: cambia un parametro (o un piccolo gruppo coerente), 3–5 giri puliti. 23–30: torna indietro se peggio, conferma la variante migliore con più benzina.')}</p></div>
    <div class="gl"><b>${tr('Il verso dei click')}</b><p>${tr('Barre, ala e ammortizzatori mostrano indici diversi da auto ad auto e alcuni vanno al contrario: leggi il suggerimento a destra nella schermata setup del gioco. Nella scheda di ogni parametro l\'app ti dice come vanno i click su quell\'auto, imparato dalla tua libreria.')}</p></div>
    <div class="gl"><b>${tr('Prima di salvare un setup')}</b><p>${tr('Il difetto c\'è in 3 o più curve della stessa fase? Hai confrontato stesse gomme, carburante, batteria e pista? Hai più grip ma perdi in uscita o sul dritto? Il fondo tocca meno ma l\'auto saltella? Il giro secco migliora e il quinto peggiora? Il click funziona solo con una linea? Il file più veloce non è per forza il migliore per 60–90 minuti.')}</p></div>
    <p class="muted small">${tr('Fonti')}: ${tr('la tua guida Hypercar LMU 1.4.2.1')}; ${[['guide.lemansultimate.com','https://guide.lemansultimate.com/hc/en-gb'],['LMP3 Quick Setup Guide','https://lemansultimate.com/lmp3-quick-setup-guide/'],['LMU Wiki','https://lemansultimate.wiki.gg/wiki/Setup_Guide'],['Coach Dave Academy','https://coachdaveacademy.com/tutorials/the-ultimate-le-mans-ultimate-setup-guide/'],['GO Setups','https://support.gosetups.gg/hc/en-gb']].map(([n,u])=>`<a href="${u}" target="_blank" rel="noopener">${n}</a>`).join(', ')}. ${tr('Consigli indicativi: verifica sempre in pista.')}</p>`;
  return h;}
function renderGuide(){const b=$('#guideBody');if(!b)return;const tab=LS.get('guide:tab','p');b.innerHTML=guideHTML(tab);
  b.querySelectorAll('[data-gt]').forEach(x=>x.onclick=()=>{LS.set('guide:tab',x.dataset.gt);renderGuide();});b.querySelectorAll('[data-gp]').forEach(x=>x.onclick=()=>openGuide(x.dataset.gp,{car:$('#genCar')?.value}));}

setTimeout(()=>{const v=$('#v-setup');if(v&&!$('#guideP')){v.insertAdjacentHTML('beforeend',`<div class="panel" id="guideP"><div class="panel-h"><h3>${tr('Guida setup')}</h3><span class="badge off">${tr('cosa fa ogni regolazione')}</span></div><div id="guideBody"></div></div>`);}
  const base=RENDER.setup;RENDER.setup=()=>{base();renderGuide();guideLink($('#v-setup'));};if(curView()==='setup')RENDER.setup();},0);

// the track card under the generator's track choice
(function(){const rg=renderGen;window.renderGen=renderGen=function(){rg();const s=$('#genTrack');const G=s&&GUIDE_TRK[s.value];const car=$('#genCar')?.value;const C=guideCar(car);
  const box=$('#genBody');if(!box||(!G&&!C))return;const prefs=box.querySelector('.genprefs');if(!prefs)return;
  prefs.insertAdjacentHTML('beforebegin',`<div class="gtrk small">${G?`<b>${esc(s.options[s.selectedIndex].text)}</b>: ${esc(tr(G[0]))}. <span class="muted">${esc(tr(G[1]))}</span>`:''}${C?`<br><b>${esc(car)}</b>: ${esc(tr(C[1]))}. <span class="muted">${esc(tr(C[2]))}</span>`:''}</div>`);};})();

(function(){const st=document.createElement('style');st.textContent=`.gk{cursor:help;text-decoration:underline dotted;text-underline-offset:3px}.gk:hover{color:var(--accent,#e33)}
.gl{margin:0 0 10px}.gl b{display:block;font-size:12px;letter-spacing:.04em;text-transform:uppercase;opacity:.75;margin-bottom:2px}.gl p{margin:0}.gl.up b{color:var(--good,#2a7)}.gl.dn b{color:var(--info,#39f)}.gl.warn b{color:var(--warn,#d90)}
.glr{display:grid;grid-template-columns:1fr 1fr;gap:12px}@media(max-width:640px){.glr{grid-template-columns:1fr}}
.gtabs{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px}.ggrp h4{margin:10px 0 6px;font-size:12px;text-transform:uppercase;letter-spacing:.05em;opacity:.7}
.gchips{display:flex;gap:6px;flex-wrap:wrap}.gchip{border:1px solid var(--line,#8884);background:transparent;color:inherit;border-radius:999px;padding:4px 10px;font:inherit;font-size:13px;cursor:pointer}.gchip:hover{border-color:var(--accent,#e33)}
.gsym{border-top:1px solid var(--line,#8883);padding:8px 0}.gsym summary{cursor:pointer;font-weight:600}.gsym ol{margin:6px 0;padding-left:20px}
.gtrk{margin:6px 0 10px;padding:8px 10px;border-left:3px solid var(--accent,#e33);background:var(--bg2,#8881)}`;document.head.appendChild(st);})();
