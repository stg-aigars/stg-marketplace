import Link from 'next/link';
import { Card, CardBody, CardHeader } from '@/components/ui';
import { ADR_BODIES } from '@/lib/legal/adr-bodies';
import { LEGAL_SUB_HEADING_CLASS } from '@/lib/legal/page-classes';
import {
  LEGAL_ENTITY_NAME,
  LEGAL_ENTITY_ADDRESS,
  LEGAL_ENTITY_REG_NUMBER,
} from '@/lib/constants';

export default function TermsLv() {
  return (
    <>
      <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-semantic-text-heading mb-6">
        Lietošanas noteikumi
      </h1>

      <div className="prose prose-sm max-w-none text-semantic-text-secondary space-y-6">
        <p className="text-semantic-text-secondary">
          Pēdējās izmaiņas: 2026. gada 13. maijā
        </p>

        <Card className="not-prose">
          <CardHeader>
            <h2 className="text-base font-semibold text-semantic-text-heading">
              Ātrais sākums
            </h2>
            <p className="text-xs text-semantic-text-muted mt-0.5">
              Versija vienkāršā valodā. Pilnus noteikumus lasi tālāk.
            </p>
          </CardHeader>
          <CardBody>
            <ul className="list-disc pl-5 space-y-2 text-sm text-semantic-text-secondary">
              <li>
                Mēs uzturam lietotāju savstarpēju (peer-to-peer) tirgus platformu lietotām
                galda spēlēm Latvijā, Lietuvā un Igaunijā. Mēs paši neko nepārdodam —
                pārdevēji ir citi spēlētāji.
              </li>
              <li>
                Lai lietotu platformu, tev jābūt vismaz <strong>16 gadus vecam</strong> un
                jādzīvo Latvijā, Lietuvā vai Igaunijā. Lai pārdotu, tev jābūt vismaz{' '}
                <strong>18 gadus vecam</strong> un jārīkojas kā privātpersonai.
              </li>
              <li>
                Tā kā tu pērc no privātpersonām, parastās ES{' '}
                <strong>14 dienu atteikuma tiesības</strong> un{' '}
                <strong>2 gadu garantija</strong> pēc noklusējuma nav piemērojamas. Mūsu
                strīdu izskatīšanas process un maksājuma aizturēšana kalpo kā tavs drošības
                tīkls.
              </li>
              <li>
                Pircēji maksā preces cenu un piegādes maksu. Pārdevējiem mēs piemērojam
                komisijas maksu saskaņā ar atsevišķu Pārdevēja līgumu.
              </li>
              <li>
                Ja pasūtījumā kaut kas noiet greizi — prece ir bojāta, neatbilst aprakstam
                vai netiek piegādāta —, tu vari uzsākt strīdu īsā laika logā. Mēs darbojamies
                kā starpnieki un varam tev atmaksāt naudu no līdzekļiem, kurus glabājam
                pārdevēja vārdā.
              </li>
              <li>
                Savu kontu jebkurā laikā vari dzēst iestatījumos. Privātuma politika
                paskaidro, ko mēs saglabājam, kāpēc un cik ilgi.
              </li>
            </ul>
          </CardBody>
        </Card>

        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-semantic-text-heading">
            1. Par Second Turn Games
          </h2>
          <p>
            {LEGAL_ENTITY_NAME} („STG”, „mēs”), reģistrācijas numurs{' '}
            {LEGAL_ENTITY_REG_NUMBER}, juridiskā adrese: {LEGAL_ENTITY_ADDRESS}, uztur
            lietotāju savstarpēju tirgus platformu lietotām galda spēlēm Latvijā,
            Lietuvā un Igaunijā. Mēs savienojam privātus pircējus ar privātiem pārdevējiem;
            pats pārdošanas darījums ir līgums starp viņiem, nevis ar mums.
          </p>
          <p>
            Maksājumu apstrādē mēs darbojamies kā pārdevēju{' '}
            <strong>komerciālais aģents</strong>. Kad pircējs samaksā par pasūtījumu, mēs
            iekasējam līdzekļus pārdevēja vārdā un izmaksājam tos tikai pēc tam, kad prece ir
            piegādāta un beidzies strīdu izskatīšanas termiņš. Šo pārdevēja attiecību
            detalizētie noteikumi ir izklāstīti mūsu{' '}
            <Link href="/seller-terms/lv" className="link-brand">
              Pārdevēja līgumā
            </Link>
            .
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-semantic-text-heading">
            2. Atbilstība un konts
          </h2>
          <p>
            Lai lietotu mūsu platformu, tev jābūt vismaz <strong>16 gadus vecam</strong> un
            jādzīvo Latvijā, Lietuvā vai Igaunijā. Izveidojot kontu, tu apstiprini, ka
            atbilsti šīm prasībām. Lai ievietotu sludinājumus vai saņemtu izmaksas, tev jābūt
            vismaz <strong>18 gadus vecam</strong>.
          </p>
          <p>
            Tu esi atbildīgs par savu pieslēgšanās datu drošību un par visām darbībām, kas
            veiktas tavā kontā. Ja rodas aizdomas par neautorizētu piekļuvi, nekavējoties
            informē mūs, rakstot uz{' '}
            <a href="mailto:info@secondturn.games" className="link-brand">
              info@secondturn.games
            </a>
            .
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-semantic-text-heading">
            3. Paziņojums par patērētāju aizsardzību
          </h2>
          <p>
            Ikviens, kurš pārdod Second Turn Games platformā, ir privātpersona ar personīgo
            kolekciju, nevis uzņēmums vai profesionāls tirgotājs. ES patērētāju aizsardzības
            noteikumi, kas attiecas uz darījumiem starp uzņēmumu un patērētāju (B2C) —{' '}
            <strong>14 dienu atteikuma tiesības</strong> un{' '}
            <strong>2 gadu atbilstības garantija</strong> —, pēc noklusējuma šeit{' '}
            <strong>nav piemērojami</strong>.
          </p>
          <p>
            Tā vietā tu saņem: pircēja līdzekļi tiek aizturēti līdz piegādei, un pircējiem
            pēc piegādes ir īss laiks, lai uzsāktu strīdu, ja kaut kas nav kārtībā. Gadījumos,
            kad pārdevējs faktiski darbojas kā tirgotājs, var būt piemērojamas tavas likumā
            noteiktās patērētāja tiesības; skatīt 14. sadaļu (Strīdi par tirgotāja statusu).
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-semantic-text-heading">
            4. Pircēja pienākumi
          </h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>Apmaksāt norādīto preces cenu un piegādes maksu pirkuma noformēšanas brīdī.</li>
            <li>Norādīt precīzu piegādes informāciju (tostarp pareizo pakomātu).</li>
            <li>Pārbaudīt preci tūlīt pēc piegādes un apstiprināt saņemšanu kontā.</li>
            <li>
              Uzsākt jebkādus strīdus 8. sadaļā aprakstītajā strīdu izskatīšanas termiņā.
              Mēs nevaram izskatīt problēmas, par kurām ziņots pēc šī termiņa beigām.
            </li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-semantic-text-heading">
            5. Pārdošana Second Turn Games
          </h2>
          <p>
            Lai pārdotu Second Turn Games platformā, tev jābūt vismaz 18 gadus vecam, jādzīvo
            Latvijā, Lietuvā vai Igaunijā un jārīkojas kā privātpersonai, kas pārdod spēles
            no savas personīgās galda spēļu kolekcijas. Tu nedrīksti veikt pārdošanu
            saimnieciskās darbības, tirdzniecības vai profesijas ietvaros.
          </p>
          <p>
            Pārdevējiem ir papildu pienākumi saskaņā ar mūsu{' '}
            <Link href="/seller-terms/lv" className="link-brand">
              Pārdevēja līgumu
            </Link>
            . Izveidojot sludinājumu, tu apstiprini, ka atbilsti iepriekš minētajiem
            noteikumiem, un piekrīti šim līgumam. Īsumā, pārdevēja pienākums ir:
          </p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Precīzi aprakstīt preces, norādot stāvokli, izdevumu un valodu.</li>
            <li>
              Apstiprināt vai noraidīt pasūtījumus īsā laikā un savlaicīgi izsūtīt
              apstiprinātos pasūtījumus.
            </li>
            <li>
              Droši iepakot preces. Pārdevējs ir atbildīgs par bojājumiem transportēšanas
              laikā, ja tie radušies slikta iepakojuma dēļ.
            </li>
            <li>
              Labā ticībā atbildēt uz pircēja ziņām un strīdiem, izmantojot platformu.
            </li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-semantic-text-heading">
            6. Maksas
          </h2>
          <p>
            Pircēji maksā preces cenu un piegādes maksu. Pircējiem nav atsevišķas pakalpojuma
            maksas.
          </p>
          <p>
            Pārdevēji maksā komisijas maksu par veiksmīgiem pārdevumiem un saņem peļņu
            platformas makā, kā aprakstīts{' '}
            <Link href="/seller-terms/lv" className="link-brand">
              Pārdevēja līgumā
            </Link>
            .
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-semantic-text-heading">
            7. Piegāde
          </h2>
          <p>
            Visi sūtījumi tiek veikti caur <strong>Unisend</strong> pakomātu tīklu, kas ietver
            Unisend, Latvijas Pasta un uDrop termināļus visā Latvijā, Lietuvā un Igaunijā.
            Tiek atbalstīta pārrobežu piegāde starp Baltijas valstīm.
          </p>
          <p>
            Piegādes kods tiek ģenerēts automātiski pēc tam, kad pārdevējs apstiprina
            pasūtījumu. Pārdevējiem visām piegādēm jāizmanto piešķirtais kods, lai mēs varētu
            izsekot sūtījumus un risināt strīdus.
          </p>
        </section>

        <section id="cancellations-refunds" className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-semantic-text-heading">
            8. Atcelšana, atmaksa un strīdi
          </h2>

          <h3 className={LEGAL_SUB_HEADING_CLASS}>Pasūtījumu atcelšana</h3>
          <p>
            Pārdevējs var noraidīt pasūtījumu īsā apstiprināšanas laikā. Ja pārdevējs
            neatbild vai neizsūta preci laikus, pasūtījums var tikt atcelts automātiski, un
            pircējam tiek pilnībā atmaksāta nauda. Pircēji pēc apmaksas pasūtījumu atcelt
            nevar — apmaksāti pasūtījumi ir saistoši.
          </p>

          <h3 className={LEGAL_SUB_HEADING_CLASS}>Atgriešana un maiņa</h3>
          <p>
            Atgriešana un maiņa nav pieejama kā standarta opcija. Visi pārdevēji ir
            privātpersonas, un katra prece ir unikāla, tāpēc mēs nevaram piedāvāt maiņu. Ja
            prece pienāk bojāta vai neatbilst aprakstam, tu vari uzsākt strīdu, kā aprakstīts
            tālāk.
          </p>

          <h3 className={LEGAL_SUB_HEADING_CLASS}>Atmaksas</h3>
          <p>
            Tu saņem atmaksu, ja (a) pārdevējs atceļ vai noraida pasūtījumu, (b) pasūtījums
            tiek automātiski atcelts pārdevēja neaktivitātes dēļ, vai (c) strīds tiek
            atrisināts tev par labu. Domu maiņa nav pamats atmaksai. Atmaksas tiek veiktas uz
            sākotnējo maksājuma veidu vai izmantoto maka bilanci.
          </p>

          <h3 className={LEGAL_SUB_HEADING_CLASS}>Strīdi</h3>
          <p>
            Pēc piegādes tev ir īss strīdu izskatīšanas logs, lai paziņotu mums, ja prece ir
            bojāta, atsūtīta nepareiza prece vai tā neatbilst sludinājuma aprakstam. Ja prece
            netiek piegādāta saprātīgā laikā pēc izsūtīšanas, mēs varam uzsākt strīdu tavā
            vārdā. Strīda laikā pircējam un pārdevējam jāmēģina atrisināt problēmu platformā;
            ja neizdodas, jebkura puse var lūgt STG izskatīt situāciju un pieņemt lēmumu.
          </p>
          <p className="text-xs text-semantic-text-muted">
            Pašreizējie termiņi strīdu uzsākšanai un risināšanai ir aprakstīti mūsu{' '}
            <Link href="/help" className="link-brand">
              Palīdzības centrā
            </Link>
            ; mēs varam laika gaitā mainīt šos darbības termiņus, nemainot tavas pamattiesības.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-semantic-text-heading">
            9. Aizliegts saturs un rīcība
          </h2>
          <p>
            Sludinājumiem jābūt tikai par galda spēlēm un tieši saistītiem aksesuāriem.
            Viltojumi, zagtas preces un preces, kas pārkāpj intelektuālā īpašuma vai citas
            tiesības, ir stingri aizliegtas.
          </p>
          <p>
            Tu nedrīksti izmantot platformu, lai aizskartu citus, izplatītu nelikumīgu saturu
            vai traucētu pakalpojuma drošību vai darbību. Mēs varam izdzēst saturu vai apturēt
            kontus, kas pārkāpj šos noteikumus.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-semantic-text-heading">
            10. Lietotāja saturs
          </h2>
          <p>
            Ievietojot platformā sludinājumus, fotoattēlus, aprakstus vai komentārus, tu
            piešķir STG neekskluzīvu, bezatlīdzības licenci attēlot, reproducēt un izplatīt
            šo saturu platformā tirgus platformas darbības nodrošināšanai. Tu saglabā
            īpašumtiesības uz savu saturu un vari to noņemt, izdzēšot attiecīgo sludinājumu
            vai kontu.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-semantic-text-heading">
            11. Tirgus platformas funkcijas
          </h2>

          <h3 className={LEGAL_SUB_HEADING_CLASS}>Jautājumi pie sludinājumiem</h3>
          <p>
            Katram sludinājumam ir publiska komentāru sadaļa, kurā ikviens var uzdot
            pārdevējam jautājumu par spēli. Komentāriem jābūt par tēmu un cieņpilniem. Mēs
            varam izdzēst komentārus, kas pārkāpj šos noteikumus vai piemērojamos tiesību
            aktus.
          </p>

          <h3 className={LEGAL_SUB_HEADING_CLASS}>Izsoles</h3>
          <p>
            Daži sludinājumi var būt izsoles formātā. Solījumi ir saistoši: ja tavs solījums
            uzvar, tu apņemies pirkt preci par šo cenu un veikt samaksu norādītajā termiņā.
            Pārdevējiem, kuri izvēlas izsoles formātu, jāievēro uzvarošais solījums, tiklīdz
            ir veikts kaut viens solījums. Pilnus izsoļu noteikumus skati mūsu{' '}
            <Link href="/help" className="link-brand">
              Palīdzības centrā
            </Link>
            .
          </p>

          <h3 className={LEGAL_SUB_HEADING_CLASS}>Vēlmju sludinājumi</h3>
          <p>
            Vēlmju sludinājumi ļauj tev norādīt interesi par kādu spēli. Kad attiecīgā spēle
            tiek ievietota pārdošanā, mēs varam tevi informēt, taču tu nerezervē preci un
            neapņemies to pirkt. Pārdevējiem nav pienākuma pieņemt piedāvājumus no vēlmju
            sludinājumiem. Standarta noteikumi par pasūtījumiem un strīdiem stājas spēkā
            tikai tad, kad tu veic faktisku pasūtījumu.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-semantic-text-heading">
            12. Tava konta vai mūsu pakalpojumu izbeigšana
          </h2>

          <h3 className={LEGAL_SUB_HEADING_CLASS}>Ja tu slēdz savu kontu</h3>
          <p>
            Tu vari slēgt savu kontu jebkurā laikā konta iestatījumos. Pirms mēs varam to
            slēgt, tev jāatceļ vai jāpabeidz visi aktīvie sludinājumi un nepabeigtie
            pasūtījumi, jāizņem pozitīvā maka bilance un jāatrisina visi atvērtie strīdi. Kad
            tu slēdz savu kontu, mēs anonimizējam tavu profilu un publisko saturu un
            izdzēšam tavus pieslēgšanās datus. Ieraksti, kuri mums jāglabā saskaņā ar likumu
            (piemēram, pabeigtie pasūtījumi un rēķini), tiek glabāti mūsu{' '}
            <Link href="/privacy/lv" className="link-brand">
              Privātuma politikā
            </Link>{' '}
            norādītajos termiņos.
          </p>

          <h3 className={LEGAL_SUB_HEADING_CLASS}>Ja mēs slēdzam tavu kontu</h3>
          <p>
            Mēs varam apturēt vai slēgt tavu kontu, izņemt sludinājumus vai iesaldēt tava
            maka bilanci, ja mums ir pamatots iemesls uzskatīt, ka tu esi pārkāpis šos
            noteikumus vai Pārdevēja līgumu, iesaistījies krāpšanā vai nepatiesu ziņu
            sniegšanā, atkārtoti neesi izsūtījis preces vai atbildējis uz pasūtījumiem,
            izraisījis mūsu noziedzīgi iegūtu līdzekļu legalizācijas novēršanas, sankciju vai
            krāpšanas kontroles brīdinājumus vai kaitējis mums vai citam lietotājam. Ja mēs
            izbeidzam līgumu pārkāpuma dēļ, pozitīva maka bilance var tikt aizturēta uz
            noteiktu laiku, lai segtu maksājumu atpakaļprasījumus (chargebacks) vai prasības
            pirms tās izmaksas.
          </p>

          <h3 className={LEGAL_SUB_HEADING_CLASS}>Platformas lēmumu apstrīdēšana</h3>
          <p>
            Ja mēs vēršamies pret tavu kontu vai saturu (piemēram, apturam darbību, slēdzam
            kontu, noņemam sludinājumu vai iesaldējam maka bilanci), tev ir tiesības bez
            maksas apstrīdēt mūsu lēmumu. Lai to izdarītu, raksti uz{' '}
            <a href="mailto:info@secondturn.games" className="link-brand">
              info@secondturn.games
            </a>{' '}
            ar tēmu „Apstrīdēšana” un lēmuma atsauci. Tavu apstrīdējumu izskatīs
            kvalificēti darbinieki, nevis tikai automatizēti rīki. Mēs informēsim tevi par
            mūsu pamatoto lēmumu Regulas (ES) 2022/2065 (Digitālo pakalpojumu akts) 20. pantā
            noteiktajos termiņos.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-semantic-text-heading">
            13. Atbildības ierobežojums
          </h2>
          <p>
            Ciktāl to pieļauj piemērojamie tiesību akti, STG kopējā atbildība par jebkuru
            prasību, kas izriet no šiem noteikumiem, ir ierobežota līdz kopējai summai, ko tu
            mums esi samaksājis divpadsmit mēnešu laikā pirms notikuma, kas izraisīja
            prasību. Platforma tiek nodrošināta tādā stāvoklī, kāds tas ir („as is”),{' '}
            <strong>
              izņemot gadījumus, kad obligātie patērētāju aizsardzības vai citi piemērojamie
              tiesību akti nosaka citādi.
            </strong>{' '}
            STG savieno pircējus un pārdevējus, bet nav pārdošanas darījuma puse; mēs
            atsevišķi negarantējam pārdevēju piedāvāto preču stāvokli, autentiskumu vai
            kvalitāti,{' '}
            <strong>izņemot garantijas, ko mums uzliek obligātie tiesību akti.</strong>
          </p>
          <p>Nekas šajos noteikumos neierobežo un neizslēdz atbildību par:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>nāvi vai miesas bojājumiem, kas radušies nolaidības dēļ,</li>
            <li>krāpšanu vai krāpniecisku nepatiesu ziņu sniegšanu,</li>
            <li>
              jebkādu citu atbildību, kuru nevar izslēgt vai ierobežot saskaņā ar Latvijas
              patērētāju aizsardzības likumiem vai tavas pastāvīgās dzīvesvietas valsts
              samērojamiem obligātajiem patērētāju aizsardzības noteikumiem, vai
            </li>
            <li>
              jebkādu likumā noteiktu atbildību, kas mums ir kā starpnieka pakalpojumu
              sniedzējam saskaņā ar Regulu (ES) 2022/2065 vai samērojamiem valsts tiesību
              aktiem.
            </li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-semantic-text-heading">
            14. Piemērojamie tiesību akti un strīdi
          </h2>
          <p>
            Šos noteikumus reglamentē Latvijas Republikas tiesību akti. Rīgas, Latvijas,
            tiesām ir jurisdikcija par strīdiem, kas izriet no šiem noteikumiem vai
            platformas lietošanas, neskarot (a) tavas pastāvīgās dzīvesvietas valsts
            obligātos patērētāju aizsardzības noteikumus saskaņā ar Regulas (EK) 593/2008
            6. pantu un (b) tavas kā patērētāja tiesības celt prasību savas pastāvīgās
            dzīvesvietas valsts tiesās saskaņā ar Regulas (ES) 1215/2012 18. pantu.
          </p>
          <p>
            Ja tev ir sūdzība, lūdzu, vispirms sazinies ar mums, rakstot uz{' '}
            <a href="mailto:info@secondturn.games" className="link-brand">
              info@secondturn.games
            </a>
            . Ja mēs nevaram atrisināt strīdu savstarpēji, tu vari iesniegt sūdzību
            patērētāju aizsardzības iestādē savā dzīvesvietas valstī:
          </p>
          <ul className="list-disc pl-6 space-y-1">
            <li>
              <strong>Latvija:</strong> Patērētāju tiesību aizsardzības centrs (PTAC),
              Brīvības 55, Rīga, LV-1010 —{' '}
              <a
                href={ADR_BODIES.LV.url}
                className="link-brand"
                target="_blank"
                rel="noopener noreferrer"
              >
                ptac.gov.lv
              </a>
            </li>
            <li>
              <strong>Lietuva:</strong> Valstybinė vartotojų teisių apsaugos tarnyba (VVTAT) —{' '}
              <a
                href={ADR_BODIES.LT.url}
                className="link-brand"
                target="_blank"
                rel="noopener noreferrer"
              >
                vvtat.lrv.lt
              </a>
            </li>
            <li>
              <strong>Igaunija:</strong> Tarbijakaitse ja Tehnilise Järelevalve Amet (TTJA) —{' '}
              <a
                href={ADR_BODIES.EE.url}
                className="link-brand"
                target="_blank"
                rel="noopener noreferrer"
              >
                ttja.ee
              </a>
            </li>
          </ul>
          <p className="text-xs text-semantic-text-muted">
            ES Tiešsaistes strīdu izšķiršanas (ODR) platforma 2025. gada 20. jūlijā tika
            pārtraukta saskaņā ar Regulu (ES) 2024/3228 un vairs nav pieejama.
          </p>

          <h3 className={LEGAL_SUB_HEADING_CLASS}>Strīdi par tirgotāja statusu</h3>
          <p>
            Ja pircēja un pārdevēja strīds ir atkarīgs no tā, vai pārdevējs faktiski ir
            tirgotājs Direktīvas 2011/83/ES izpratnē, mēs izvērtēsim pārdevēja darbību
            atbilstoši mūsu iekšējiem kritērijiem, paziņosim pircējam, ko mēs konstatējām,
            un, ja uzskatīsim, ka pārdevējs, visticamāk, ir tirgotājs, palīdzēsim pircējam
            izmantot savas likumā noteiktās tiesības, tostarp atmaksu gadījumos, kad
            piemērojamas atteikuma tiesības. Mūsu vērtējums nav saistošs tiesām vai
            patērētāju aizsardzības iestādēm.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-semantic-text-heading">
            15. Izmaiņas šajos noteikumos
          </h2>
          <p>
            Mēs varam atjaunināt šos noteikumus.{' '}
            <strong>
              Par jebkurām izmaiņām maksās, komisijās, atmaksas politikā, strīdu izskatīšanas
              kārtībā, atbildības ierobežojumos vai konta slēgšanas pamatos mēs informēsim
              reģistrētos lietotājus pa e-pastu vismaz 14 dienas pirms izmaiņu stāšanās
              spēkā. Par nelielām izmaiņām (drukas kļūdas labojumi, precizējumi, kas
              nesamazina tavas tiesības) mēs publicēsim jauno versiju ar ierakstu izmaiņu
              vēsturē.
            </strong>{' '}
            Turpinot lietot platformu pēc spēkā stāšanās datuma, tu piekrīti atjauninātajiem
            noteikumiem.{' '}
            <strong>
              Izmaiņas neattiecas atpakaļejoši uz pasūtījumiem, kas veikti pirms spēkā
              stāšanās datuma. Tos joprojām reglamentē noteikumi, kas bija spēkā pasūtījuma
              veikšanas brīdī.
            </strong>
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-semantic-text-heading">
            16. Kontaktinformācija un Digitālo pakalpojumu akta informācija
          </h2>
          <p>
            Jautājumi par šiem noteikumiem? Sazinies ar mums{' '}
            <a href="mailto:info@secondturn.games" className="link-brand">
              info@secondturn.games
            </a>{' '}
            vai apmeklē mūsu{' '}
            <Link href="/contact" className="link-brand">
              kontaktu lapu
            </Link>
            .
          </p>
          <p>
            <strong>Vienotais kontaktpunkts saskaņā ar Digitālo pakalpojumu aktu.</strong>{' '}
            <a href="mailto:info@secondturn.games" className="link-brand">
              info@secondturn.games
            </a>{' '}
            ir arī mūsu norādītais elektroniskais vienotais kontaktpunkts saziņai ar
            lietotājiem saskaņā ar Regulas (ES) 2022/2065 (Digitālo pakalpojumu akts) 12.
            pantu. Izmanto šo adresi, lai sazinātos ar mums tieši jebkurā no mūsu lietotāju
            valodām (angļu, latviešu, lietuviešu vai igauņu) par jebkuru ar DSA saistītu
            jautājumu.
          </p>
          <p>
            <strong>Kontaktpunkts iestādēm.</strong> Saskaņā ar Regulas (ES) 2022/2065 11.
            pantu vienotais kontaktpunkts dalībvalstu iestādēm, Eiropas Komisijai un Eiropas
            Digitālo pakalpojumu kolēģijai ir{' '}
            <a href="mailto:info@secondturn.games" className="link-brand">
              info@secondturn.games
            </a>
            . Saziņa tiek pieņemta angļu vai latviešu valodā.
          </p>

          <h3 className={LEGAL_SUB_HEADING_CLASS}>Ziņošana par nelikumīgu saturu</h3>
          <p>
            Ikviens var mūs informēt par saturu Second Turn Games platformā, ko uzskata par
            nelikumīgu. Izmanto veidlapu{' '}
            <Link href="/report-illegal-content" className="link-brand">
              secondturn.games/report-illegal-content
            </Link>{' '}
            vai raksti uz{' '}
            <a href="mailto:info@secondturn.games" className="link-brand">
              info@secondturn.games
            </a>
            . Derīgā paziņojumā jānorāda saturs (URL vai sludinājuma ID), jāpaskaidro, kāpēc
            uzskati to par nelikumīgu, jānorāda tavs vārds un e-pasts, kā arī jāapstiprina,
            ka informācija ir precīza pēc tavas labākās pārliecības. Ziņojumus par aizdomām
            par bērnu seksuālas izmantošanas materiāliem var iesniegt anonīmi. Mēs ātri
            apstiprinām derīgu paziņojumu saņemšanu un rīkojamies bez nepamatotas kavēšanās,
            kad to prasa likums. Atlasei izmantojam automatizētus rīkus, taču katru lēmumu
            par satura izņemšanu vai ierobežošanu pārskata cilvēks. Mēs informējam gan
            ziņotāju, gan attiecīgo lietotāju par lēmumu un tā pamatojumu saskaņā ar Regulas
            (ES) 2022/2065 17. pantu.
          </p>

          <h3 className={LEGAL_SUB_HEADING_CLASS}>Paziņojumi par noziedzīgiem nodarījumiem</h3>
          <p>
            Ja mūsu rīcībā nonāk informācija, kas rada aizdomas, ka ir noticis, notiek vai
            varētu notikt noziedzīgs nodarījums, kas saistīts ar draudiem personas dzīvībai
            vai drošībai, mēs nekavējoties informēsim attiecīgās dalībvalsts tiesībsargājošās
            iestādes saskaņā ar Regulas (ES) 2022/2065 18. pantu.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-semantic-text-heading">
            17. Valoda
          </h2>
          <p>
            Šo noteikumu tulkojumi citās valodās var tikt nodrošināti tavām ērtībām. Angļu
            valodas versija ir juridiski saistošā oriģinālversija. Jebkādu pretrunu vai
            konfliktu gadījumā starp angļu valodas versiju un kādu tulkojumu noteicošā ir
            angļu valodas versija.
          </p>
        </section>

        <p className="text-sm text-semantic-text-muted pt-4 border-t border-semantic-border-subtle">
          Skatīt arī mūsu{' '}
          <Link href="/privacy/lv" className="link-brand">
            Privātuma politiku
          </Link>{' '}
          un{' '}
          <Link href="/seller-terms/lv" className="link-brand">
            Pārdevēja līgumu
          </Link>
          .
        </p>
      </div>
    </>
  );
}
