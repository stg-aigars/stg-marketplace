import Link from 'next/link';
import { Card, CardBody, CardHeader } from '@/components/ui';
import { LEGAL_SECTION_HEADING_CLASS, LEGAL_SUB_HEADING_CLASS } from '@/lib/legal/page-classes';
import {
  LEGAL_ENTITY_NAME,
  LEGAL_ENTITY_VAT_NUMBER,
  LEGAL_ENTITY_BANK_NAME,
  PSP_TECHNICAL_PROVIDER_NAME,
  PSP_TECHNICAL_PROVIDER_REG_NUMBER,
} from '@/lib/constants';

export default function SellerTermsLv() {
  return (
    <>
      <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-semantic-text-heading mb-6">
        Pārdevēja līgums
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
              Versija vienkāršā valodā pārdevējiem. Pilnus noteikumus lasi tālāk.
            </p>
          </CardHeader>
          <CardBody>
            <ul className="list-disc pl-5 space-y-2 text-sm text-semantic-text-secondary">
              <li>
                Tev jābūt vismaz 18 gadus vecam, jādzīvo Latvijā, Lietuvā vai Igaunijā un
                jāpārdod spēles no savas personīgās galda spēļu kolekcijas. Uzņēmumi vai
                tālākpārdevēji platformā darboties nedrīkst.
              </li>
              <li>
                Kad tu pievieno spēli pārdošanai, tu iecel {LEGAL_ENTITY_NAME} par savu
                komerciālo aģentu, lai iekasētu maksājumu no pircēja un izmaksātu to tev pēc
                piegādes un strīdu izskatīšanas perioda beigām.
              </li>
              <li>
                Mēs ieturam 10% komisijas maksu no preces cenas (nevis no piegādes). Tava
                peļņa nonāk platformas makā, no kura tu vari veikt izmaksu uz savu bankas
                kontu.
              </li>
              <li>
                Tev operatīvi jāapstiprina vai jānoraida pasūtījumi, laikus jāizsūta
                apstiprinātie pasūtījumi, izmantojot Unisend kodu, droši jāiepako spēles un
                godīgi jāapraksta to stāvoklis. Patiesībai neatbilstoša informācija vai
                atkārtotas problēmas var izraisīt atmaksas pircējam, maksājumu
                atpakaļprasījumus (chargebacks) vai pārdošanas tiesību zaudēšanu.
              </li>
              <li>
                Tiklīdz tu kalendārā gadā pārsniegsi 30 pārdevumus vai €2000 apgrozījumu,
                mums par tavu darbību ir jāziņo Latvijas nodokļu iestādei (DAC7). Mēs lūgsim
                tavus nodokļu datus pirms šīs robežas sasniegšanas, lai ziņojums būtu
                pilnīgs.
              </li>
              <li>
                Mēs varam aizkavēt izmaksas, iesaldēt tavu maku vai apturēt tavu pārdošanas
                darbību, ja konstatējam krāpšanu, viltojumus, NILL vai sankciju pārkāpumus vai
                nopietnus noteikumu pārkāpumus. Šādu lēmumu tu vari apstrīdēt.
              </li>
              <li>
                Tu saglabā atbildību par savu pārdošanas ienākumu deklarēšanu un visu
                piemērojamo PVN vai citu nodokļu saistību izpildi.
              </li>
            </ul>
          </CardBody>
        </Card>

        <section className="space-y-3">
          <h2 className={LEGAL_SECTION_HEADING_CLASS}>
            1. Attiecības starp tevi un STG
          </h2>
          <p>
            Šis Pārdevēja līgums papildina vispārīgos{' '}
            <Link href="/terms/lv" className="link-brand">
              Lietošanas noteikumus
            </Link>{' '}
            un ir piemērojams, kad tu ievieto spēles pārdošanai vietnē Second Turn Games.
            Domstarpību gadījumā šis Pārdevēja līgums ir prioritārs jautājumos, kas konkrēti
            attiecas uz pārdošanu.
          </p>
          <p>
            Izveidojot sludinājumu vai iespējojot pārdošanas funkcijas, tu iecel{' '}
            {LEGAL_ENTITY_NAME} par savu komerciālo aģentu, lai saņemtu maksājumus no
            pircējiem un izmaksātu tev iegūtos ieņēmumus, kā aprakstīts šajā Līgumā. Mēs
            rīkojamies tavā vārdā un tavās interesēs, iekasējot pircēja līdzekļus un veicot
            atmaksas gadījumos, kad strīds tiek atrisināts pret tevi.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className={LEGAL_SECTION_HEADING_CLASS}>
            2. Atbilstība un noteikums „tikai privātpersonām”
          </h2>
          <p>
            Lai pārdotu vietnē Second Turn Games, tev jābūt vismaz 18 gadus vecam un jādzīvo
            Latvijā, Lietuvā vai Igaunijā. Pievienojot preces, tu apstiprini, ka atbilsti
            šīm prasībām.
          </p>
          <p>
            Šī platforma ir paredzēta privātpersonām, kas pārdod savas personīgās galda
            spēļu kolekcijas. Tu nedrīksti šeit ievietot sludinājumus saimnieciskās darbības,
            tirdzniecības vai profesijas ietvaros — tas attiecas uz mazumtirgotājiem,
            tālākpārdevējiem, izplatītājiem, vairumtirgotājiem un izsoļu namiem. Tāpat tu
            nedrīksti pārdot preces, kuras esi iegādājies galvenokārt ar mērķi tās
            tālākpārdot peļņas gūšanai.
          </p>
          <p>
            Ja mums ir pamats uzskatīt, ka tu rīkojies kā tirgotājs, mēs varam lūgt tev
            apstiprināt tavas darbības privāto raksturu un sniegt papildu informāciju. Mēs
            varam apturēt vai slēgt tavu kontu vai ierobežot tavas pārdošanas tiesības, ja
            tu nesadarbojies vai ja mēs pamatoti secinām, ka tu veic uzņēmējdarbību caur
            platformu.
          </p>
          <p>
            Ja tu uzskati, ka esi vai esi kļuvis par tirgotāju Direktīvas 2011/83/ES
            (Patērētāju tiesību direktīva) izpratnē, nekavējoties paziņo mums uz{' '}
            <a href="mailto:info@secondturn.games" className="link-brand">
              info@secondturn.games
            </a>
            , pārtrauc veidot jaunus sludinājumus un pabeidz visus atvērtos pasūtījumus,
            ievērojot tirgotāja pienākumus, ko nosaka šī Direktīva, tostarp pircēja 14 dienu
            atteikuma tiesības.
          </p>
          <p>
            <strong>Tirgotāju pārbaude.</strong> Ja tu izmanto platformu profesionālā vai
            komerciālā nolūkā, ES tiesību akti prasa mums pārbaudīt tavu identitāti un
            kontaktinformāciju pirms preču ievietošanas. Tas ietver tava vārda, adreses un
            tālruņa numura iegūšanu un pārbaudi, kā arī pašsertifikāciju, ka tu piedāvāsi
            tikai tādus produktus, kas atbilst piemērojamiem ES tiesību aktiem. Mēs varam
            pieprasīt apliecinošus dokumentus un aizkavēt vai noraidīt sludinājumus, kamēr
            pārbaude nav pabeigta. Mēs varam apturēt jebkuru pārdevēju, kurš neiztur mūsu
            pārbaudes vai sniedz maldinošu informāciju. Tas ir pienākums, ko mums kā
            platformai uzliek Regulas (ES) 2022/2065 (Digitālo pakalpojumu akts) 30. pants.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className={LEGAL_SECTION_HEADING_CLASS}>
            3. Maksājumu autorizācija un plūsma
          </h2>
          <p>
            Kad tu pievieno preci pārdošanai, tu pilnvaro {LEGAL_ENTITY_NAME} pieņemt
            maksājumus no pircējiem tavā vārdā. Maksājumus apstrādā {LEGAL_ENTITY_BANK_NAME},
            Latvijas kredītiestāde, kas darbojas kā mūsu maksājumu pakalpojumu sniedzējs.
            Tehnisko platformu Swedbank vārdā pārvalda {PSP_TECHNICAL_PROVIDER_NAME}{' '}
            (reģistrēta Igaunijā, reģ. nr. {PSP_TECHNICAL_PROVIDER_REG_NUMBER}).
          </p>
          <p>
            Pircēja līdzekļi atrodas tirgus platformas kontā un tiek izmaksāti tev tikai pēc
            tam, kad ir apstiprināta piegāde un noslēdzies strīdu izskatīšanas periods, vai
            citādi, kad darījums ir pabeigts saskaņā ar mūsu strīdu risināšanas noteikumiem.
          </p>
          <p>
            Mēs paši neesam maksājumu iestāde un mums nav maksājumu pakalpojumu licences.
            Mūsu loma šajā plūsmā ir komerciālais aģents, kas rīkojas tavā vārdā, un mēs
            paļaujamies uz izņēmumu, kas noteikts Direktīvas (ES) 2015/2366 (PSD2) 3. panta
            b) punktā. Ja atklāsies, ka šis izņēmums nav piemērojams, mēs nodosim maksājumu
            plūsmu licencētai maksājumu iestādei.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className={LEGAL_SECTION_HEADING_CLASS}>
            4. Darbības prasības pārdošanas laikā
          </h2>
          <p>Kad par tavu sludinājumu ir veikts pasūtījums, tev ir:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>
              Jāapstiprina vai jānoraida pasūtījums pasūtījuma ekrānā norādītajā laikā.
              Pasūtījumi, kas nav apstiprināti laikus, tiek automātiski atcelti, pilnībā
              atmaksājot naudu pircējam.
            </li>
            <li>
              Jāizsūta prece noteiktajā nosūtīšanas termiņā pēc pasūtījuma apstiprināšanas.
              Pasūtījumi, kas nav izsūtīti laikus, var tikt automātiski atcelti, atmaksājot
              naudu pircējam.
            </li>
            <li>
              Visām piegādēm jāizmanto nodrošinātais Unisend sūtīšanas kods, lai sūtījumu
              izsekošana un strīdu risināšana darbotos pareizi.
            </li>
            <li>
              Droši jāiepako preces, izmantojot atbilstošu aizsardzību kastēm, komponentiem
              un rokasgrāmatām. Tu esi atbildīgs par transportēšanas laikā radītiem
              bojājumiem, kas radušies sliktas iepakošanas dēļ.
            </li>
            <li>
              Precīzi jāapraksta preces, norādot stāvokli, izdevumu, valodu un jebkādus
              defektus, piemēram, trūkstošas detaļas vai bojātus komponentus. Maldinoši
              apraksti var izraisīt strīdus, atmaksas vai tavu pārdošanas tiesību apturēšanu.
            </li>
          </ul>
          <p className="text-xs text-semantic-text-muted">
            Praktiskus piemērus un pašreizējos darbības termiņus skati mūsu{' '}
            <Link href="/help" className="link-brand">
              Palīdzības centrā
            </Link>
            .
          </p>

          <h3 className={LEGAL_SUB_HEADING_CLASS}>Izsoļu sludinājumi</h3>
          <p>
            Ja tu pievieno spēli izsolē, papildus iepriekš minētajiem noteikumiem ir spēkā
            šādi punkti:
          </p>
          <ul className="list-disc pl-6 space-y-1">
            <li>
              Tu vari atsaukt izsoles sludinājumu tikai tikmēr, kamēr tam nav nevienas
              likmes. Tiklīdz ir izdarīta kaut viena likme, tev ir jāievēro izsoles
              noteikumi un jāpārdod spēle augstākajam solītājam pēc izsoles beigām.
            </li>
            <li>
              Ja uzvarējušais solītājs neveic apmaksu norādītajā laikā, platforma var atcelt
              sludinājumu un atgriezt spēli tavā sarakstā. Pasūtījums netiek izveidots,
              kamēr maksājums nav veiksmīgs.
            </li>
          </ul>

          <h3 className={LEGAL_SUB_HEADING_CLASS}>Atbilstība vēlmju sludinājumiem</h3>
          <p>
            Ja tavs pievienotais sludinājums atbilst pircēja aktīvam vēlmju sludinājumam,
            šis pircējs var saņemt paziņojumu. Tev nav redzami citu lietotāju vēlmju
            sludinājumi, un šīs atbilstības dēļ tev nerodas īpaši pienākumi. Pārdošanai tiek
            piemēroti tie paši standarta noteikumi, kas jebkuram citam sludinājumam.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className={LEGAL_SECTION_HEADING_CLASS}>
            5. Maksas un komisijas
          </h2>
          <p>
            STG ietur fiksētu 10% komisijas maksu no preces cenas. Komisijas maksa netiek
            piemērota piegādes izmaksām. Sludinājumu ievietošanas maksas nav.
          </p>
          <p>
            Piemēram, ja tu ievieto preci par €20,00, komisijas maksa ir €2,00 un tu saņem
            €18,00. Pircējs preces cenu un piegādes maksu maksā atsevišķi.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className={LEGAL_SECTION_HEADING_CLASS}>
            6. Maks un izmaksas
          </h2>
          <p>
            Tava peļņa (preces cena mīnus 10% komisija) tiek ieskaitīta tavā platformas makā
            pēc pasūtījuma pabeigšanas. Pasūtījums tiek uzskatīts par pabeigtu, kad pircējs
            apstiprina piegādi vai kad noslēdzas strīdu izskatīšanas periods, neierosinot
            strīdu.
          </p>
          <p>
            Tu vari pārskaitīt sava maka atlikumu uz savu bankas kontu (IBAN). Izmaksas
            parasti tiek apstrādātas 1–3 darba dienu laikā pēc apstiprināšanas, taču banku
            apstrādes laiki nav mūsu kontrolē.
          </p>

          <h3 className={LEGAL_SUB_HEADING_CLASS}>Valūta</h3>
          <p>Visi līdzekļi tavā makā tiek glabāti eiro (EUR) valūtā.</p>

          <h3 className={LEGAL_SUB_HEADING_CLASS}>Identitātes pārbaude</h3>
          <p>
            Pirms pirmās izmaksas tev, iespējams, būs jāapstiprina sava identitāte un
            jāpierāda, ka IBAN pieder tev. Šī ir „Pazīsti savu klientu” (Know Your Customer)
            pārbaude, ko veic mūsu maksājumu apstrādātājs. Tev, iespējams, būs jānosūta
            valsts izdots personu apliecinošs dokuments. Mēs varam noraidīt vai aizkavēt
            izmaksu, kamēr pārbaude nav pabeigta.
          </p>

          <h3 className={LEGAL_SUB_HEADING_CLASS}>Maksājumu atpakaļprasījumi un atgūšana</h3>
          <p>
            Ja pircējs veiksmīgi apstrīd pabeigtu pasūtījumu pēc tam, kad tu jau esi
            izņēmis naudu, tu piekrīti, ka (a) mēs varam ieturēt attiecīgo summu no tava
            nākotnes maka atlikuma vai pārdošanas ieņēmumiem, un (b) ja tavs maks to nesedz,
            tu esi mums parādā trūkstošo summu, un mēs varam to piedzīt tavas pastāvīgās
            dzīvesvietas valsts tiesā.
          </p>

          <h3 className={LEGAL_SUB_HEADING_CLASS}>Negatīvs atlikums</h3>
          <p>
            Ja atmaksas, maksājuma atpakaļprasījuma vai citu korekciju dēļ tavs maks nonāk
            mīnusos, tev ir jāatmaksā starpība 30 dienu laikā pēc paziņojuma saņemšanas —
            vai nu veicot pārskaitījumu uz mūsu norādīto bankas kontu, vai veicot ieskaitu
            no nākamajiem pārdevumiem.
          </p>

          <h3 className={LEGAL_SUB_HEADING_CLASS}>Neaktīvi konti</h3>
          <p>
            Mēs glabājam maka atlikumus beztermiņa. Ja tu neesi pieslēdzies 24 mēnešus un
            tava bilance ir pozitīva, mēs nosūtīsim e-pastu uz tavu norādīto adresi. Ja 90
            dienu laikā nesaņemsim atbildi, mēs varam mēģināt nosūtīt atlikumu uz tavu
            pēdējo zināmo IBAN (pēc atkārtotas pārbaudes). Jebkuri nepieprasīti līdzekļi
            paliek tavs īpašums, un mēs tos izmaksāsim pēc pieprasījuma.
          </p>
        </section>

        <section id="suspension-and-risk-controls" className="space-y-3">
          <h2 className={LEGAL_SECTION_HEADING_CLASS}>
            7. Apturēšana, izbeigšana un riska kontrole
          </h2>
          <p>
            STG var apturēt vai izbeigt tavas pārdošanas tiesības vai tavu kontu kopumā, ja
            mums ir pamatots iemesls uzskatīt, ka tu:
          </p>
          <ul className="list-disc pl-6 space-y-1">
            <li>esi iesaistījies krāpnieciskās vai maldinošās darbībās;</li>
            <li>
              atkārtoti esi sniedzis nepatiesu informāciju par preces stāvokli vai detaļām,
              vai atteicies risināt pamatotus strīdus;
            </li>
            <li>neesi izsūtījis apstiprinātos pasūtījumus noteiktajos termiņos;</li>
            <li>esi izraisījis pārmērīgu maksājumu atpakaļprasījumu vai strīdu skaitu;</li>
            <li>esi izmantojis platformu komerciālai tālākpārdošanai, pārkāpjot 2. sadaļu; vai</li>
            <li>citādi esi kaitējis mums vai citiem lietotājiem.</li>
          </ul>
          <p>
            Apturēšanas vai izbeigšanas gadījumā neizmaksātie līdzekļi var tikt aizturēti
            līdz 180 dienām, lai segtu iespējamos maksājumu atpakaļprasījumus, atmaksas vai
            neatrisinātus strīdus.
          </p>

          <h3 className={LEGAL_SUB_HEADING_CLASS}>
            Noziedzīgi iegūtu līdzekļu legalizācijas novēršana, sankcijas un krāpšana
          </h3>
          <p>
            <strong>
              Pamatotu iemeslu dēļ, paziņojot tev, tiklīdz tas ir juridiski atļauts
              (paziņošana var tikt aizkavēta, ja to prasa NILL, sankciju vai tiesībsargājošo
              iestāžu pienākumi), mēs varam
            </strong>{' '}
            (a) pārbaudīt darījumus, kontus, IBAN un identificējošo informāciju pret ES un
            starptautiskajiem sankciju sarakstiem, politiski nozīmīgu personu sarakstiem un
            krāpšanas datubāzēm; (b) apturēt tavu kontu, iesaldēt tava maka atlikumu vai
            atteikt izmaksu, ja mums ir pamatotas aizdomas par noziedzīgi iegūtu līdzekļu
            legalizāciju, terorisma finansēšanu, izvairīšanos no sankcijām vai krāpšanu; (c)
            lūgt tev papildu identifikāciju, informāciju par līdzekļu izcelsmi vai patiesā
            labuma guvēja informāciju; un (d) kopīgot informāciju ar kompetentajām iestādēm
            un mūsu maksājumu apstrādātāju. Iestādes, kas regulāri saņem šādus datus, ir
            uzskaitītas mūsu{' '}
            <Link href="/privacy/lv" className="link-brand">
              Privātuma politikas
            </Link>{' '}
            6. punktā. Saskaņā ar šo punktu iesaldētie līdzekļi paliek tavs īpašums un tiek
            atbrīvoti pēc jautājuma atrisināšanas, ievērojot jebkādus kompetento iestāžu
            rīkojumus.{' '}
            <strong>
              Tu vari apstrīdēt jebkuru šādu darbību, rakstot uz info@secondturn.games.
              Persona, kas nav pieņēmusi sākotnējo lēmumu, izskatīs apelāciju 14 dienu laikā
              un sniegs rakstisku atbildi. Ja NILL, sankciju vai tiesībsargājošo iestāžu
              pienākumi neļauj mums paskaidrot konkrētu darbību, mēs tev paziņosim, kad šie
              pienākumi vairs neliegs informācijas izpaušanu.
            </strong>
          </p>
        </section>

        <section className="space-y-3">
          <h2 className={LEGAL_SECTION_HEADING_CLASS}>
            8. Nodokļi un rēķini
          </h2>

          <h3 className={LEGAL_SUB_HEADING_CLASS}>PVN par mūsu komisijas maksu</h3>
          <p>
            Mūsu 10% komisijas maksa no preces cenas ir elektroniski sniegts pakalpojums
            saskaņā ar Padomes Īstenošanas regulas (ES) Nr. 282/2011 7. pantu. Pakalpojuma
            sniegšanas vietu nosaka Direktīvas 2006/112/EK 58. pants (kur atrodas klients,
            kas nav nodokļa maksātājs). PVN ir iekļauts rēķinā norādītajā 10% komisijas
            maksā (netiek pievienots papildus) pēc tavas valsts likmes: 21% Latvijai, 21%
            Lietuvai, 24% Igaunijai. Par €2,00 komisijas maksu Latvijā tie ir €1,65 neto
            plus €0,35 PVN. Mūsu PVN numurs ir {LEGAL_ENTITY_VAT_NUMBER}.
          </p>

          <h3 className={LEGAL_SUB_HEADING_CLASS}>PVN par piegādi</h3>
          <p>
            Kad mēs organizējam piegādi caur mūsu loģistikas partneriem, mēs pārpārdodam
            piegādes pakalpojumu tev ar tās valsts PVN likmi, no kuras preces tiek
            izsūtītas (tavas valsts). PVN ir iekļauts rēķinā norādītajā piegādes maksā
            (netiek pievienots papildus). Pakalpojuma sniegšanas vietu nosaka Direktīvas
            2006/112/EK 49. un 50. pants atkarībā no tā, vai sūtījums ir vietējais vai
            pārrobežu.
          </p>

          <h3 className={LEGAL_SUB_HEADING_CLASS}>Rēķini</h3>
          <p>
            Mēs izsniedzam rēķinu par komisijas maksu un piegādes PVN pēc katra pabeigta
            pasūtījuma formātā <span className="font-mono">INV-GGGG-NNNNN</span>. Rēķini ir
            pieejami tava konta sadaļā „Pārdevumi” un tiek glabāti mūsu{' '}
            <Link href="/privacy/lv" className="link-brand">
              Privātuma politikas
            </Link>{' '}
            §9 norādītajos periodos.
          </p>

          <h3 className={LEGAL_SUB_HEADING_CLASS}>Tavs ienākuma nodoklis</h3>
          <p>
            Tu esi atbildīgs par pārdošanas ienākumu deklarēšanu savas valsts nodokļu
            iestādei, ievērojot tur piemērojamos privāto pārdevēju sliekšņus. Mēs neieturam
            ienākuma nodokli tavā vārdā un nesniedzam nodokļu konsultācijas.
          </p>

          <h3 className={LEGAL_SUB_HEADING_CLASS}>DAC7 ziņošana</h3>
          <p>
            Saskaņā ar Padomes Direktīvu (ES) 2021/514 (DAC7), mums ir jāziņo par tevi
            Latvijas Valsts ieņēmumu dienestam (VID), tiklīdz tava darbība kalendārajā gadā
            pārsniedz 30 pārdevumus vai €2000 atlīdzību (summa, ko tu saņem pēc mūsu
            komisijas maksas ieturēšanas). Šie sliekšņi ir noteikti Direktīvā; mēs tos
            nevaram mainīt. Pirms tu tos sasniegsi, mēs lūgsim tev sniegt DAC7 datus, lai
            ziņojums netiktu aizkavēts. Mūsu iekšējais brīdinājuma slieksnis ir agrāks — pie
            25 pārdevumiem vai €1750. Mēs lūdzam norādīt tavu pilnu vārdu, uzvārdu,
            dzimšanas datumu, adresi un nodokļu maksātāja numuru. Ja tu šos datus nesniegsi,
            mums var nākties apturēt tavu pārdošanu un aizturēt izmaksas, līdz tas tiks
            izdarīts. Tu vari pieprasīt kopiju tam, ko mēs par tevi ziņojam.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className={LEGAL_SECTION_HEADING_CLASS}>
            9. Izmaiņas šajā Līgumā
          </h2>
          <p>
            Mēs varam atjaunināt šo Līgumu. Būtisku izmaiņu gadījumā (maksas, komisijas
            likmes, pārdevēja pienākumi) mēs nosūtīsim tev e-pastu vismaz 14 dienas pirms to
            stāšanās spēkā. Turpinot pārdošanu pēc paziņojuma perioda beigām, tu apliecini,
            ka piekrīti atjauninātajiem noteikumiem.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className={LEGAL_SECTION_HEADING_CLASS}>
            10. Valoda
          </h2>
          <p>
            Šī līguma tulkojumi citās valodās var tikt nodrošināti tavām ērtībām. Angļu
            valodas versija ir juridiski saistošā oriģinālversija. Jebkādu pretrunu vai
            konfliktu gadījumā starp angļu valodas versiju un kādu tulkojumu noteicošā ir
            angļu valodas versija.
          </p>
        </section>

        <p className="text-sm text-semantic-text-muted pt-4 border-t border-semantic-border-subtle">
          Skati arī mūsu{' '}
          <Link href="/terms/lv" className="link-brand">
            Lietošanas noteikumus
          </Link>{' '}
          un{' '}
          <Link href="/privacy/lv" className="link-brand">
            Privātuma politiku
          </Link>
          .
        </p>
      </div>
    </>
  );
}
