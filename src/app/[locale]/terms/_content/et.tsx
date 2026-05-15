import Link from 'next/link';
import { Card, CardBody, CardHeader } from '@/components/ui';
import { ADR_BODIES } from '@/lib/legal/adr-bodies';
import { CARD_SUBSECTION_HEADING_CLASS, PAGE_HEADING_CLASS, SECTION_HEADING_CLASS } from '@/lib/heading-classes';
import { LEGAL_SUB_HEADING_CLASS } from '@/lib/legal/page-classes';
import {
  LEGAL_ENTITY_NAME,
  LEGAL_ENTITY_ADDRESS,
  LEGAL_ENTITY_REG_NUMBER,
} from '@/lib/constants';
import { cn } from '@/lib/cn';

export default function TermsEt() {
  return (
    <>
      <h1 className={cn(PAGE_HEADING_CLASS, 'mb-6')}>
        Kasutustingimused
      </h1>

      <div className="prose prose-sm max-w-none text-semantic-text-secondary space-y-6">
        <p className="text-semantic-text-secondary">
          Viimati uuendatud: 13. mail 2026
        </p>

        <Card className="not-prose">
          <CardHeader>
            <h2 className={CARD_SUBSECTION_HEADING_CLASS}>
              Kiirülevaade
            </h2>
            <p className="text-xs text-semantic-text-muted mt-0.5">
              Lihtsas keeles versioon. Täielike reeglite lugemiseks jätka altpoolt.
            </p>
          </CardHeader>
          <CardBody>
            <ul className="list-disc pl-5 space-y-2 text-sm text-semantic-text-secondary">
              <li>
                Me haldame kasutajatevahelist (peer-to-peer) kasutatud lauamängude
                turuplatsi Lätis, Leedus ja Eestis. Me ise ei müü midagi &mdash; müüjateks
                on teised mängijad.
              </li>
              <li>
                Platvormi kasutamiseks peate olema vähemalt <strong>16-aastane</strong> ja
                elama Lätis, Leedus või Eestis. Müümiseks peate olema vähemalt{' '}
                <strong>18-aastane</strong> ja eraisik.
              </li>
              <li>
                Kuna ostate eraisikutelt, ei kehti vaikimisi tavapärane EL-i{' '}
                <strong>14-päevane taganemisõigus</strong> ega{' '}
                <strong>2-aastane pretensiooni esitamise õigus</strong>. Meie vaidluste
                lahendamise protsess ja maksete kinnipidamine on Teie turvavõrk.
              </li>
              <li>
                Ostjad tasuvad eseme hinna ja saatekulu. Müüjatelt võtame vahendustasu
                vastavalt eraldiseisvale Müügilepingule.
              </li>
              <li>
                Kui tellimusega läheb midagi valesti &mdash; ese on kahjustatud, ei vasta
                kirjeldusele või seda ei tarnita &mdash; saate lühikese aja jooksul avada
                vaidlustuse. Me vahendame suhtlust ja saame Teile raha tagastada
                vahenditest, mida hoiame müüja nimel.
              </li>
              <li>
                Saate oma konto igal ajal seadete alt kustutada. Privaatsuspoliitika
                selgitab, mida me säilitame, miks ja kui kaua.
              </li>
            </ul>
          </CardBody>
        </Card>

        <section className="space-y-3">
          <h2 className={SECTION_HEADING_CLASS}>
            1. Second Turn Gamesi tutvustus
          </h2>
          <p>
            {LEGAL_ENTITY_NAME} (edaspidi „STG”, „meie”), registrikood{' '}
            {LEGAL_ENTITY_REG_NUMBER}, registreeritud aadressil {LEGAL_ENTITY_ADDRESS},
            haldab kasutajatevahelist kasutatud lauamängude turuplatsi Lätis, Leedus ja
            Eestis. Me ühendame eraviisilised ostjad ja müüjad; müügitehing ise on leping
            nende vahel, mitte meiega.
          </p>
          <p>
            Maksete käsitlemisel tegutseme müüjate <strong>kaubandusagendina</strong>. Kui
            ostja tasub tellimuse eest, kogume vahendid müüja nimel ja vabastame need
            alles pärast kauba kohaletoimetamist ja vaidluste esitamise tähtaja möödumist.
            Selle müüjasuhte üksikasjalikud tingimused on sätestatud meie{' '}
            <Link href="/seller-terms/et" className="link-brand">
              Müügilepingus
            </Link>
            .
          </p>
        </section>

        <section className="space-y-3">
          <h2 className={SECTION_HEADING_CLASS}>
            2. Sobivus ja konto
          </h2>
          <p>
            Meie platvormi kasutamiseks peate olema vähemalt <strong>16-aastane</strong>{' '}
            ning elama Lätis, Leedus või Eestis. Konto loomisega kinnitate, et vastate
            neile nõuetele. Müügikuulutuste lisamiseks või väljamaksete saamiseks peate
            olema vähemalt <strong>18-aastane</strong>.
          </p>
          <p>
            Te vastutate oma sisselogimisandmete turvalisuse ja kogu oma konto alt toimuva
            tegevuse eest. Kui kahtlustate loata juurdepääsu oma kontole, teavitage meid
            sellest kohe aadressil{' '}
            <a href="mailto:info@secondturn.games" className="link-brand">
              info@secondturn.games
            </a>
            .
          </p>
        </section>

        <section className="space-y-3">
          <h2 className={SECTION_HEADING_CLASS}>
            3. Teave tarbijakaitse kohta
          </h2>
          <p>
            Kõik Second Turn Gamesis müüvad isikud on eraisikud, kes müüvad oma isiklikku
            kollektsiooni, mitte ettevõtjad ega elukutselised kauplejad. EL-i
            tarbijakaitsereeglid, mis kehtivad ettevõtja ja tarbija vahelisele müügile
            (B2C) &mdash; <strong>14-päevane taganemisõigus</strong> ja{' '}
            <strong>2-aastane vastavusgarantii</strong> &mdash; siin vaikimisi{' '}
            <strong>ei kehti</strong>.
          </p>
          <p>
            Selle asemel tagame järgmise: ostja raha hoitakse kuni kättesaamiseni ja
            ostjal on pärast kättesaamist lühike aeg vaidlustuse avamiseks, kui midagi on
            valesti. Juhul kui müüja tegutseb tegelikult kauplejana, võivad kehtida Teie
            seadusjärgsed tarbijaõigused; vt jaotist 14 (Vaidlused kaupleja staatuse üle).
          </p>
        </section>

        <section className="space-y-3">
          <h2 className={SECTION_HEADING_CLASS}>
            4. Ostja kohustused
          </h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>Tasuda ostu vormistamisel märgitud eseme hind ja saatekulu.</li>
            <li>Esitada täpsed tarneandmed (sealhulgas õige pakiautomaat).</li>
            <li>Kontrollida eset kohe pärast kättesaamist ja kinnitada kättesaamine kontol.</li>
            <li>
              Algatada võimalikud vaidlused jaotises 8 kirjeldatud vaidluste esitamise
              tähtaja jooksul. Me ei saa käsitleda probleeme, millest teavitatakse pärast
              selle tähtaja möödumist.
            </li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className={SECTION_HEADING_CLASS}>
            5. Müümine Second Turn Gamesis
          </h2>
          <p>
            Second Turn Gamesis müümiseks peate olema vähemalt 18-aastane, elama Lätis,
            Leedus või Eestis ning tegutsema eraisikuna, kes müüb oma isiklikust
            lauamängukogust pärit mänge. Te ei tohi müüa majandus-, kaubandus- või
            kutsetegevuse raames.
          </p>
          <p>
            Müüjatel on täiendavad kohustused vastavalt meie{' '}
            <Link href="/seller-terms/et" className="link-brand">
              Müügilepingule
            </Link>
            . Kuulutuse loomisega kinnitate, et vastate ülaltoodud sobivusreeglitele ja
            nõustute selle lepinguga. Lühidalt peavad müüjad:
          </p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Kirjeldama esemeid täpselt, sealhulgas seisukorda, väljaannet ja keelt.</li>
            <li>
              Kinnitama või lükkama tellimused tagasi lühikese aja jooksul ning saatma
              aktsepteeritud tellimused õigeaegselt välja.
            </li>
            <li>
              Pakkima esemed turvaliselt. Müüjad vastutavad kehvast pakkimisest tingitud
              transpordikahjustuste eest.
            </li>
            <li>
              Vastama ostja sõnumitele ja vaidlustele heas usus platvormi kaudu.
            </li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className={SECTION_HEADING_CLASS}>
            6. Tasud
          </h2>
          <p>
            Ostjad tasuvad eseme hinna ja saatekulu. Ostjatele eraldi teenustasu ei
            kohaldata.
          </p>
          <p>
            Müüjad maksavad edukate müükide pealt vahendustasu ja saavad oma tulu
            platvormi rahakotti, nagu on kirjeldatud{' '}
            <Link href="/seller-terms/et" className="link-brand">
              Müügilepingus
            </Link>
            .
          </p>
        </section>

        <section className="space-y-3">
          <h2 className={SECTION_HEADING_CLASS}>
            7. Saatmine
          </h2>
          <p>
            Kõik saadetised liiguvad läbi <strong>Unisendi</strong> pakiautomaatide
            võrgustiku, mis hõlmab Unisendi, Latvijas Pasti ja uDropi terminale üle Läti,
            Leedu ja Eesti. Toetatud on riikidevaheline saatmine Balti riikide vahel.
          </p>
          <p>
            Saatmiskood genereeritakse automaatselt pärast seda, kui müüja on tellimuse
            kinnitanud. Müüjad peavad kasutama kõigi tarnete puhul väljastatud koodi, et
            saaksime saadetisi jälgida ja vaidlusi lahendada.
          </p>
        </section>

        <section id="cancellations-refunds" className="space-y-3">
          <h2 className={SECTION_HEADING_CLASS}>
            8. Tühistamised, tagasimaksed ja vaidlused
          </h2>

          <h3 className={LEGAL_SUB_HEADING_CLASS}>Tellimuste tühistamine</h3>
          <p>
            Müüja võib tellimuse lühikese kinnitamisaja jooksul tagasi lükata. Kui müüja
            ei vasta või ei saada kaupa õigeaegselt, võib tellimus automaatselt tühistuda
            ja ostjale tagastatakse raha täies ulatuses. Ostjad ei saa pärast maksmist
            tellimust tühistada &mdash; tasutud tellimused on siduvad.
          </p>

          <h3 className={LEGAL_SUB_HEADING_CLASS}>Tagastamine ja asendamine</h3>
          <p>
            Tagastamine ja asendamine ei ole standardlahendusena saadaval. Kõik müüjad on
            eraisikud ja iga kuulutatud ese on ainulaadne, seega ei saa me pakkuda
            asendustooteid. Kui ese saabub kahjustatult või ei vasta kirjeldusele, võite
            avada vaidlustuse, nagu on kirjeldatud allpool.
          </p>

          <h3 className={LEGAL_SUB_HEADING_CLASS}>Tagasimaksed</h3>
          <p>
            Teile tagastatakse raha, kui (a) müüja tühistab või lükkab tellimuse tagasi,
            (b) tellimus tühistatakse automaatselt müüja tegevusetuse tõttu, või (c)
            vaidlus lahendatakse Teie kasuks. Meelemuutus ei ole alus raha tagastamiseks.
            Tagasimaksed tehakse algsele makseviisile või kasutatud rahakoti jäägile.
          </p>

          <h3 className={LEGAL_SUB_HEADING_CLASS}>Vaidlused</h3>
          <p>
            Teil on pärast kättesaamist lühike vaidluste esitamise aeg, et teavitada
            meid, kui ese saabub kahjustatult, on vale või ei vasta kuulutuse
            kirjeldusele. Kui eset ei tarnita mõistliku aja jooksul pärast saatmist,
            võime avada vaidlustuse Teie nimel. Vaidluse ajal peaksid ostja ja müüja
            püüdma probleemi platvormi kaudu lahendada; kui see ei õnnestu, võib kumb
            tahes pool paluda STG-l olukord üle vaadata ja otsus langetada.
          </p>
          <p className="text-xs text-semantic-text-muted">
            Praegused vaidluste avamise ja lahendamise tähtajad on kirjeldatud meie{' '}
            <Link href="/help" className="link-brand">
              Abikeskuses
            </Link>
            ; me võime neid operatiivseid tähtaegu aja jooksul muuta, muutmata Teie
            põhiõigusi.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className={SECTION_HEADING_CLASS}>
            9. Keelatud sisu ja käitumine
          </h2>
          <p>
            Kuulutused peavad olema suunatud ainult lauamängudele ja nendega tihedalt
            seotud tarvikutele. Võltsitud kaubad, varastatud asjad ning intellektuaalomandi
            või muid õigusi rikkuvad esemed on rangelt keelatud.
          </p>
          <p>
            Te ei tohi platvormi kasutada teiste ahistamiseks, ebaseadusliku sisu
            levitamiseks ega teenuse turvalisuse või toimimise häirimiseks. Meil on õigus
            eemaldada reegleid rikkuv sisu või peatada vastavad kontod.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className={SECTION_HEADING_CLASS}>
            10. Kasutaja sisu
          </h2>
          <p>
            Postitades platvormile kuulutusi, fotosid, kirjeldusi või kommentaare, annate
            STG-le lihtlitsentsi ja tasuta õiguse seda sisu platvormil kuvada,
            reprodutseerida ja levitada turuplatsi toimimise eesmärgil. Te jääte oma sisu
            omanikuks ja saate selle eemaldada, kustutades seotud kuulutuse või konto.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className={SECTION_HEADING_CLASS}>
            11. Turuplatsi funktsioonid
          </h2>

          <h3 className={LEGAL_SUB_HEADING_CLASS}>Küsimused kuulutuste juures</h3>
          <p>
            Igal kuulutusel on avalik kommentaariumi lõim, kus kõik saavad müüjalt mängu
            kohta küsimusi esitada. Kommentaarid peavad olema asjakohased ja lugupidavad.
            Meil on õigus eemaldada kommentaare, mis rikuvad käesolevaid tingimusi või
            kohaldatavat õigust.
          </p>

          <h3 className={LEGAL_SUB_HEADING_CLASS}>Oksjonid</h3>
          <p>
            Mõned kuulutused võivad olla oksjoni vormingus. Pakkumised on siduvad: kui
            teete võitnud pakkumise, kohustute selle hinnaga ostma ja peate tasuma
            ettenähtud aja jooksul. Müüjad, kes valivad oksjoni vormingu, peavad järgima
            võitnud pakkumist kohe, kui on tehtud vähemalt üks pakkumine. Oksjonite
            täielikud reeglid leiate{' '}
            <Link href="/help" className="link-brand">
              Abikeskusest
            </Link>
            .
          </p>

          <h3 className={LEGAL_SUB_HEADING_CLASS}>Soovikuulutused</h3>
          <p>
            Soovikuulutused võimaldavad märku anda huvist mõne mängu vastu. Kui vastav
            mäng kuulutatakse, võime Teid sellest teavitada, kuid see ei tähenda eseme
            reserveerimist ega ostukohustust. Müüjad ei ole kohustatud soovikuulutuste
            kaudu tehtud pakkumisi vastu võtma. Tellimuste ja vaidluste standardreeglid
            kehtivad alles pärast tegeliku tellimuse esitamist.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className={SECTION_HEADING_CLASS}>
            12. Konto või meie teenuste lõpetamine
          </h2>

          <h3 className={LEGAL_SUB_HEADING_CLASS}>Teiepoolne konto lõpetamine</h3>
          <p>
            Saate oma konto igal ajal konto seadete alt sulgeda. Enne sulgemist peate
            tühistama või lõpetama kõik aktiivsed kuulutused ja pooleliolevad tellimused,
            võtma välja positiivse rahakoti jäägi ning lahendama kõik avatud vaidlused.
            Konto sulgemisel anonümiseerime Teie profiili ja avaliku sisu ning kustutame
            sisselogimisandmed. Andmeid, mida peame seaduse järgi säilitama (näiteks
            sooritatud tellimused ja arved), säilitatakse meie{' '}
            <Link href="/privacy/et" className="link-brand">
              Privaatsuspoliitikas
            </Link>{' '}
            märgitud ajavahemike jooksul.
          </p>

          <h3 className={LEGAL_SUB_HEADING_CLASS}>Meiepoolne konto lõpetamine</h3>
          <p>
            Me võime Teie konto peatada või lõpetada, kuulutused eemaldada või rahakoti
            jäägi külmutada, kui meil on alust uskuda, et olete rikkunud käesolevaid
            tingimusi või Müügilepingut, tegelenud pettuse või valeandmete esitamisega,
            jätnud korduvalt tellimused saatmata või neile vastamata, põhjustanud meie
            rahapesuvastase, sanktsioonide või pettustevastase kontrolli häireid või
            kahjustanud meid või teisi kasutajaid. Kui lõpetame konto rikkumise tõttu,
            võidakse positiivset rahakoti jääki hoida teatud aja jooksul tagasinõuete või
            nõuete katteks enne selle vabastamist.
          </p>

          <h3 className={LEGAL_SUB_HEADING_CLASS}>Platvormi otsuste vaidlustamine</h3>
          <p>
            Kui rakendame Teie konto või sisu suhtes meetmeid (näiteks peatamine,
            lõpetamine, kuulutuse eemaldamine või rahakoti jäägi külmutamine), on Teil
            õigus meie otsus tasuta edasi kaevata. Edasikaebamiseks saatke e-kiri
            aadressile{' '}
            <a href="mailto:info@secondturn.games" className="link-brand">
              info@secondturn.games
            </a>{' '}
            märksõnaga „Edasikaebus” ja otsuse viitega. Teie kaebuse vaatavad läbi
            kvalifitseeritud töötajad, mitte ainult automatiseeritud vahendid. Teavitame
            Teid oma põhjendatud otsusest määruse (EL) 2022/2065 (digiteenuste määrus)
            artiklis 20 sätestatud tähtaegade jooksul.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className={SECTION_HEADING_CLASS}>
            13. Vastutuse piiramine
          </h2>
          <p>
            Kohaldatava õigusega lubatud maksimaalses ulatuses on STG koguvastutus mis
            tahes nendest tingimustest tuleneva nõude eest piiratud summaga, mille olete
            meile tasunud nõude aluseks olevale sündmusele eelnenud kaheteistkümne kuu
            jooksul. Platvormi pakutakse sellisena, nagu see on („as is”),{' '}
            <strong>
              välja arvatud juhul, kui kohustuslik tarbijakaitse- või muu kohaldatav õigus
              nõuab teisiti.
            </strong>{' '}
            STG ühendab ostjaid ja müüjaid, kuid ei ole ise müügitehingu osapool; me ei
            taga eraldi müüjate poolt loetletud esemete seisukorda, ehtsust ega
            kvaliteeti,{' '}
            <strong>
              välja arvatud garantiid, mis on meile pandud kohustusliku õigusega.
            </strong>
          </p>
          <p>Mitte miski käesolevates tingimustes ei välista ega piira vastutust:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>hooletusest põhjustatud surma või kehavigastuse eest,</li>
            <li>pettuse või petliku valeandmete esitamise eest,</li>
            <li>
              mis tahes muu vastutuse eest, mida ei saa Läti tarbijakaitseseaduste või
              Teie alalise elukohariigi samaväärsete kohustuslike tarbijakaitsereeglite
              kohaselt välistada ega piirata, või
            </li>
            <li>
              mis tahes seadusjärgse vastutuse eest, mis meil on vahendusteenuse
              osutajana vastavalt määrusele (EL) 2022/2065 või samaväärsele siseriiklikule
              õigusele.
            </li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className={SECTION_HEADING_CLASS}>
            14. Kohaldatav õigus ja vaidlused
          </h2>
          <p>
            Käesolevaid tingimusi reguleerivad Läti Vabariigi seadused. Nendest
            tingimustest või platvormi kasutamisest tulenevate vaidluste lahendamine
            kuulub Läti Riia kohtute alluvusse, ilma et see piiraks (a) Teie alalise
            elukohariigi kohustuslikke tarbijakaitsereegleid vastavalt määruse (EÜ)
            593/2008 artiklile 6 ja (b) Teie kui tarbija õigust esitada hagi oma alalise
            elukohariigi kohtusse vastavalt määruse (EL) 1215/2012 artiklile 18.
          </p>
          <p>
            Kaebuste korral võtke meiega esmalt ühendust aadressil{' '}
            <a href="mailto:info@secondturn.games" className="link-brand">
              info@secondturn.games
            </a>
            . Kui me ei suuda olukorda omavahel lahendada, võite pöörduda oma
            elukohariigi tarbijakaitseorgani poole:
          </p>
          <ul className="list-disc pl-6 space-y-1">
            <li>
              <strong>Lätis:</strong> Patērētāju tiesību aizsardzības centrs (PTAC),
              Brīvības 55, Riia, LV-1010 &mdash;{' '}
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
              <strong>Leedus:</strong> Valstybinė vartotojų teisių apsaugos tarnyba
              (VVTAT) &mdash;{' '}
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
              <strong>Eestis:</strong> Tarbijakaitse ja Tehnilise Järelevalve Amet (TTJA)
              &mdash;{' '}
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
            EL-i veebipõhine vaidluste lahendamise (ODR) platvorm lõpetas tegevuse 20.
            juulil 2025 vastavalt määrusele (EL) 2024/3228 ja ei ole enam saadaval.
          </p>

          <h3 className={LEGAL_SUB_HEADING_CLASS}>Vaidlused kaupleja staatuse üle</h3>
          <p>
            Kui ostja ja müüja vaheline vaidlus sõltub sellest, kas müüja on tegelikult
            kaupleja direktiivi 2011/83/EL tähenduses, vaatame müüja tegevuse üle
            vastavalt meie sisekriteeriumidele, teavitame ostjat tulemustest ja kui
            leiame, et müüja on tõenäoliselt kaupleja, aitame ostjal kasutada oma
            seadusjärgseid õigusi, sealhulgas saada tagasimakset juhul, kui kehtib
            taganemisõigus. Meie hinnang ei ole kohtutele ega tarbijakaitseametitele
            siduv.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className={SECTION_HEADING_CLASS}>
            15. Tingimuste muutmine
          </h2>
          <p>
            Me võime käesolevaid tingimusi uuendada.{' '}
            <strong>
              Tasude, vahendustasude, tagasimaksepoliitika, vaidlusmenetluse, vastutuse
              piirmäära või konto lõpetamise aluste muudatustest teavitame registreeritud
              kasutajaid e-posti teel vähemalt 14 päeva enne muudatuste jõustumist.
              Väiksemate muudatuste puhul (kirjavigade parandamine, täpsustused, mis ei
              vähenda Teie õigusi) avaldame uue versiooni koos muudatuste logiga.
            </strong>{' '}
            Platvormi jätkuv kasutamine pärast jõustumiskuupäeva tähendab uuendatud
            tingimustega nõustumist.{' '}
            <strong>
              Muudatused ei kehti tagasiulatuvalt tellimustele, mis on esitatud enne
              jõustumiskuupäeva. Neile tellimustele kehtivad nende esitamise ajal jõus
              olnud tingimused.
            </strong>
          </p>
        </section>

        <section className="space-y-3">
          <h2 className={SECTION_HEADING_CLASS}>
            16. Kontaktandmed ja teave digiteenuste määruse kohta
          </h2>
          <p>
            Küsimused tingimuste kohta? Võtke meiega ühendust aadressil{' '}
            <a href="mailto:info@secondturn.games" className="link-brand">
              info@secondturn.games
            </a>{' '}
            või külastage meie{' '}
            <Link href="/contact" className="link-brand">
              kontaktilehte
            </Link>
            .
          </p>
          <p>
            <strong>Ühtne kontaktpunkt digiteenuste määruse alusel.</strong>{' '}
            <a href="mailto:info@secondturn.games" className="link-brand">
              info@secondturn.games
            </a>{' '}
            on meie määratud elektrooniline ühtne kontaktpunkt suhtluseks kasutajatega
            vastavalt määruse (EL) 2022/2065 (digiteenuste määrus) artiklile 12. Kasutage
            seda aadressi meiega otse ühendust võtmiseks mis tahes meie kasutajate poolt
            räägitavas keeles (inglise, läti, leedu või eesti) kõigis DSA-ga seotud
            küsimustes.
          </p>
          <p>
            <strong>Kontaktpunkt ametiasutustele.</strong> Vastavalt määruse (EL)
            2022/2065 artiklile 11 on liikmesriikide ametiasutuste, Euroopa Komisjoni ja
            Euroopa digiteenuste nõukoja ühtne kontaktpunkt{' '}
            <a href="mailto:info@secondturn.games" className="link-brand">
              info@secondturn.games
            </a>
            . Suhtlus on lubatud inglise või läti keeles.
          </p>

          <h3 className={LEGAL_SUB_HEADING_CLASS}>Ebaseaduslikust sisust teatamine</h3>
          <p>
            Kõik isikud saavad meid teavitada Second Turn Gamesis olevast sisust, mida
            nad peavad ebaseaduslikuks. Kasutage vormi aadressil{' '}
            <Link href="/report-illegal-content" className="link-brand">
              secondturn.games/report-illegal-content
            </Link>{' '}
            või saatke e-kiri aadressile{' '}
            <a href="mailto:info@secondturn.games" className="link-brand">
              info@secondturn.games
            </a>
            . Kehtiv teade peab tuvastama sisu (URL või kuulutuse ID), selgitama, miks
            peate seda ebaseaduslikuks, sisaldama Teie nime ja e-posti aadressi ning
            kinnitust, et esitatud teave on Teie parimate teadmiste kohaselt täpne.
            Teateid kahtlustatava laste seksuaalset kuritarvitamist esitava materjali
            kohta saab esitada anonüümselt. Kinnitame kehtivate teadete kättesaamist
            kiiresti ja tegutseme vajaduse korral ilma põhjendamatu viivituseta. Kasutame
            teadete liigitamisel automatiseeritud vahendeid, kuid iga otsuse sisu
            eemaldamiseks või piiramiseks vaatab üle inimene. Teavitame nii teatajat kui
            ka asjaomast kasutajat otsusest ja selle põhjustest vastavalt määruse (EL)
            2022/2065 artiklile 17.
          </p>

          <h3 className={LEGAL_SUB_HEADING_CLASS}>Teavitamine kriminaalkuritegudest</h3>
          <p>
            Kui saame teavet, mis tekitab kahtluse, et on toimunud, toimub või võib
            toimuda isiku elu või ohutust ähvardav kriminaalkuritegu, teavitame sellest
            viivitamata asjaomase liikmesriigi õiguskaitseasutusi vastavalt määruse (EL)
            2022/2065 artiklile 18.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className={SECTION_HEADING_CLASS}>
            17. Keel
          </h2>
          <p>
            Käesolevate tingimuste tõlkeid võidakse pakkuda teistes keeltes Teie mugavuse
            huvides. Ingliskeelne versioon on õiguslikult siduv originaal. Mis tahes
            lahknevuse või vastuolu korral ingliskeelse versiooni ja mis tahes tõlke
            vahel on määrav ingliskeelne versioon.
          </p>
        </section>

        <p className="text-sm text-semantic-text-muted pt-4 border-t border-semantic-border-subtle">
          Vt ka meie{' '}
          <Link href="/privacy/et" className="link-brand">
            Privaatsuspoliitikat
          </Link>{' '}
          ja{' '}
          <Link href="/seller-terms/et" className="link-brand">
            Müügilepingut
          </Link>
          .
        </p>
      </div>
    </>
  );
}
