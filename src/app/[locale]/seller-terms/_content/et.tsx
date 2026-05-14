import Link from 'next/link';
import { Card, CardBody, CardHeader } from '@/components/ui';
import { SECTION_HEADING_CLASS } from '@/lib/heading-classes';
import { LEGAL_SUB_HEADING_CLASS } from '@/lib/legal/page-classes';
import {
  LEGAL_ENTITY_NAME,
  LEGAL_ENTITY_VAT_NUMBER,
  LEGAL_ENTITY_BANK_NAME,
  PSP_TECHNICAL_PROVIDER_NAME,
  PSP_TECHNICAL_PROVIDER_REG_NUMBER,
} from '@/lib/constants';

export default function SellerTermsEt() {
  return (
    <>
      <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-semantic-text-heading mb-6">
        Müügileping
      </h1>

      <div className="prose prose-sm max-w-none text-semantic-text-secondary space-y-6">
        <p className="text-semantic-text-secondary">
          Viimati uuendatud: 13. mail 2026
        </p>

        <Card className="not-prose">
          <CardHeader>
            <h2 className="text-base font-semibold text-semantic-text-heading">
              Kiirülevaade
            </h2>
            <p className="text-xs text-semantic-text-muted mt-0.5">
              Lihtsas keeles kokkuvõte müüjatele. Täielike reeglite lugemiseks jätka altpoolt.
            </p>
          </CardHeader>
          <CardBody>
            <ul className="list-disc pl-5 space-y-2 text-sm text-semantic-text-secondary">
              <li>
                Te peate olema vähemalt 18-aastane, elama Lätis, Leedus või Eestis ning müüma
                mänge oma isiklikust lauamängukogust. Ettevõtted ja edasimüüjad platvormil
                tegutseda ei tohi.
              </li>
              <li>
                Müügikuulutuse lisamisega nimetate {LEGAL_ENTITY_NAME} oma kaubandusagendiks,
                kellel on õigus võtta ostjalt vastu makseid ning maksta need Teile välja pärast
                tarne kinnitamist ja vaidluste esitamise akna sulgumist.
              </li>
              <li>
                Me võtame eseme hinnast (mitte saatekulu pealt) 10% vahendustasu. Teie tulu
                laekub platvormi rahakotti, kust saate selle kanda endale kuuluvale
                pangakontole.
              </li>
              <li>
                Te peate tellimused viivitamatult kinnitama või tagasi lükkama, saatma
                kinnitatud tellimused õigeaegselt teele kasutades Unisendi koodi, pakkima
                mängud turvaliselt ning kirjeldama nende seisukorda ausalt. Valeandmete
                esitamine või korduvad probleemid võivad kaasa tuua tagasimakseid ostjale,
                maksete tagasinõudeid (chargebacks) või müügiõiguste kaotamise.
              </li>
              <li>
                Kui ületate kalendriaasta jooksul 30 müüki või €2000 piiri, oleme kohustatud
                teatama Teie tegevusest Läti maksuametile (DAC7). Küsime Teie maksuandmeid
                enne selle piiri täitumist, et aruanne oleks täielik.
              </li>
              <li>
                Võime väljamakseid edasi lükata, Teie rahakoti külmutada või müügiõigused
                peatada, kui tuvastame pettuse, võltsitud esemeid, rahapesuvastaste reeglite
                (AML) või sanktsioonide rikkumisi või muid tõsiseid reeglite rikkumisi. Teil
                on õigus sellised otsused edasi kaevata.
              </li>
              <li>
                Te vastutate oma müügitulu deklareerimise ning kõigi Teile kohalduvate
                käibemaksu- või muude maksukohustuste täitmise eest.
              </li>
            </ul>
          </CardBody>
        </Card>

        <section className="space-y-3">
          <h2 className={SECTION_HEADING_CLASS}>
            1. Teie ja STG vaheline suhe
          </h2>
          <p>
            Käesolev Müügileping täiendab üldiseid{' '}
            <Link href="/terms/et" className="link-brand">
              Kasutustingimusi
            </Link>{' '}
            ja kohaldub siis, kui lisate Second Turn Games platvormile mänge müügiks.
            Vastuolude korral lähtutakse spetsiifiliste müügiküsimuste puhul käesolevast
            Müügilepingust.
          </p>
          <p>
            Müügikuulutuse loomise või müügifunktsioonide lubamisega nimetate{' '}
            {LEGAL_ENTITY_NAME} oma kaubandusagendiks eesmärgiga võtta ostjatelt vastu
            makseid ja maksta Teile välja nendest tulenev tulu, nagu on kirjeldatud
            käesolevas lepingus. Me tegutseme Teie nimel ja Teie eest ostjate vahendite
            kogumisel ning tagasimaksete tegemisel juhtudel, kui vaidlus lahendatakse Teie
            kahjuks.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className={SECTION_HEADING_CLASS}>
            2. Sobivus ja „ainult eraisikust müüjad” reegel
          </h2>
          <p>
            Platvormil müümiseks peate olema vähemalt 18-aastane ja elama Lätis, Leedus või
            Eestis. Esemete müügiks lisamisega kinnitate, et vastate neile nõuetele.
          </p>
          <p>
            See platvorm on mõeldud eraisikutele oma isiklike lauamängukogude müümiseks. Te
            ei tohi lisada kuulutusi majandus-, kutse- või ametitegevuse raames &mdash; see
            hõlmab jaemüüjaid, edasimüüjaid, turustajaid, hulgimüüjaid ja oksjonimaju.
            Samuti ei tohi Te müüa esemeid, mis on ostetud peamiselt eesmärgiga need
            kasumiga edasi müüa.
          </p>
          <p>
            Kui meil on alust arvata, et tegutsete kauplejana, võime paluda Teil kinnitada
            oma tegevuse isiklikku iseloomu ja esitada lisateavet. Võime Teie konto peatada
            või sulgeda või piirata Teie müügiõigusi, kui Te ei tee koostööd või kui me
            järeldame põhjendatult, et juhite platvormi kaudu ettevõtet.
          </p>
          <p>
            Kui leiate, et olete või olete muutunud kauplejaks direktiivi 2011/83/EL
            (tarbijaõiguste direktiiv) tähenduses, teatage meile sellest kohe aadressil{' '}
            <a href="mailto:info@secondturn.games" className="link-brand">
              info@secondturn.games
            </a>
            , lõpetage uute kuulutuste loomine ja viige kõik pooleliolevad tellimused
            lõpule vastavalt kaupleja kohustustele, mida see direktiiv Teile paneb &mdash;
            sealhulgas ostjate 14-päevane taganemisõigus.
          </p>
          <p>
            <strong>Kauplejate kontroll.</strong> Kui kasutate platvormi professionaalsel
            või ärilisel eesmärgil, nõuavad EL-i õigusaktid, et me kontrolliksime Teie
            isikut ja kontaktandmeid enne esemete müüki lisamist. See hõlmab Teie nime,
            aadressi ja telefoninumbri kogumist ja kontrollimist ning Teie kinnitust, et
            pakute ainult tooteid, mis vastavad kohalduvatele EL-i seadustele. Võime nõuda
            täiendavaid dokumente ning viivitada kuulutuste avaldamisega või neist
            keelduda, kuni kontroll on lõpule viidud. Võime peatada iga müüja konto, kes ei
            läbi meie kontrolli või esitab eksitavat teavet. See on kohustus, mille paneb
            meile kui platvormile määruse (EL) 2022/2065 (digiteenuste määrus) artikkel 30.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className={SECTION_HEADING_CLASS}>
            3. Maksete volitamine ja liikumine
          </h2>
          <p>
            Eseme müügiks lisamisel volitate {LEGAL_ENTITY_NAME}-d võtma ostjatelt Teie
            nimel vastu makseid. Makseid vahendab {LEGAL_ENTITY_BANK_NAME}, Lätis asuv
            krediidiasutus, mis tegutseb meie makseteenuse pakkujana. Tehnilist platvormi
            haldab Swedbanki nimel {PSP_TECHNICAL_PROVIDER_NAME} (registreeritud Eestis,
            reg. nr {PSP_TECHNICAL_PROVIDER_REG_NUMBER}).
          </p>
          <p>
            Ostja vahendid seisavad turuplatsi kontol ja need vabastatakse Teile alles
            siis, kui tarne on kinnitatud ja vaidluste aken on sulgunud või kui tehing
            viiakse lõpule vastavalt meie vaidluste lahendamise reeglitele.
          </p>
          <p>
            Me ei ole makseasutus ega oma makseteenuste tegevusluba. Meie roll selles
            protsessis on Teie eest tegutsev kaubandusagent ning me tugineme direktiivi
            (EL) 2015/2366 (PSD2) artikli 3 punkti b erandile. Kui peaks selguma, et see
            erand ei kohaldu, viime makseteenuse üle litsentseeritud makseasutuse alla.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className={SECTION_HEADING_CLASS}>
            4. Tegevusnõuded müümisel
          </h2>
          <p>Kui Teie kuulutusele esitatakse tellimus, peate:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>
              Kinnitama tellimuse või lükkama selle tagasi tellimuse ekraanil kuvatava aja
              jooksul. Õigeaegselt kinnitamata tellimused tühistatakse automaatselt ja
              ostjale tagastatakse raha täies ulatuses.
            </li>
            <li>
              Saatma eseme teele nõutud ajavahemiku jooksul pärast tellimuse kinnitamist.
              Õigeaegselt saatmata tellimused võidakse automaatselt tühistada ja ostjale
              raha tagastada.
            </li>
            <li>
              Kasutama kõigi saadetiste puhul etteantud Unisendi koodi, et jälgimine ja
              vaidluste lahendamine toimiksid korrektselt.
            </li>
            <li>
              Pakkima esemed turvaliselt, kasutades piisavat kaitset karpidele,
              komponentidele ja juhenditele. Te vastutate puudulikust pakkimisest tingitud
              transpordikahjustuste eest.
            </li>
            <li>
              Kirjeldama esemeid täpselt, märkides ära seisukorra, väljaande, keele ja kõik
              defektid (nt puuduvad osad või kahjustatud komponendid). Eksitavad
              kirjeldused võivad kaasa tuua vaidlusi, tagasimakseid või Teie müügiõiguste
              peatamise.
            </li>
          </ul>
          <p className="text-xs text-semantic-text-muted">
            Praktilisi näiteid ja kehtivaid tähtaegu leiate meie{' '}
            <Link href="/help" className="link-brand">
              Abikeskuses
            </Link>
            .
          </p>

          <h3 className={LEGAL_SUB_HEADING_CLASS}>Oksjonikuulutused</h3>
          <p>
            Kui lisate mängu oksjonile, kehtivad lisaks eeltoodule järgmised reeglid:
          </p>
          <ul className="list-disc pl-6 space-y-1">
            <li>
              Oksjonikuulutuse saate tagasi võtta ainult siis, kui sellele pole tehtud
              ühtegi pakkumist. Kui esimene pakkumine on tehtud, peate oksjoni lõpule viima
              ja müüma mängu kõrgeima pakkumise teinud isikule.
            </li>
            <li>
              Kui võitnud pakkuja ei tasu mängu eest ettenähtud aja jooksul, võib platvorm
              kuulutuse tühistada ja lisada mängu tagasi Teie müügisolevate toodete hulka.
              Tellimust ei looda enne makse õnnestumist.
            </li>
          </ul>

          <h3 className={LEGAL_SUB_HEADING_CLASS}>Vastavus soovikuulutustele</h3>
          <p>
            Kui Teie lisatud mäng vastab mõne ostja aktiivsele soovikuulutusele, võib see
            ostja saada teavituse. Teil puudub nähtavus teiste kasutajate soovikuulutuste
            üle ning Teile ei kaasne selle vastega seoses täiendavaid kohustusi. Müügile
            kehtivad samad reeglid nagu igale teisele kuulutusele.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className={SECTION_HEADING_CLASS}>
            5. Tasud ja vahendustasud
          </h2>
          <p>
            STG võtab eseme hinnast 10% vahendustasu. Vahendustasu ei rakendu saatekulu
            peale. Kuulutuse lisamise tasu puudub.
          </p>
          <p>
            Näiteks: kui müüte eseme &euro;20,00 eest, on vahendustasu &euro;2,00 ja Te
            saate &euro;18,00. Ostja tasub eseme hinna ja saatekulu eraldi.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className={SECTION_HEADING_CLASS}>
            6. Rahakott ja väljamaksed
          </h2>
          <p>
            Teie tulu (eseme hind miinus 10% vahendustasu) kantakse Teie platvormi
            rahakotti pärast tellimuse lõpuleviimist. Tellimus loetakse lõpetatuks, kui
            ostja kinnitab tarne või kui vaidluste aken sulgub ilma vaidlustust esitamata.
          </p>
          <p>
            Võite oma rahakoti jäägi kanda oma pangakontole (IBAN). Väljamaksed töödeldakse
            tavaliselt 1&ndash;3 tööpäeva jooksul pärast heakskiitmist, kuid pankade
            tööajad ei ole meie kontrolli all.
          </p>

          <h3 className={LEGAL_SUB_HEADING_CLASS}>Valuuta</h3>
          <p>Kõik rahakoti jäägid on eurodes (EUR).</p>

          <h3 className={LEGAL_SUB_HEADING_CLASS}>Isikutuvastus</h3>
          <p>
            Enne esimest väljamakset võib Teil tekkida vajadus oma isikut tõendada ja
            kinnitada, et pangakonto kuulub Teile. See on „Tunne oma klienti” (Know Your
            Customer) kontroll, mida teostab meie makseteenuse pakkuja. Võimalik, et peate
            saatma koopia riiklikust isikut tõendavast dokumendist. Võime väljamaksest
            keelduda või sellega viivitada, kuni kontroll on lõpule viidud.
          </p>

          <h3 className={LEGAL_SUB_HEADING_CLASS}>Tagasinõuded ja tagasimaksed</h3>
          <p>
            Kui ostja vaidlustab edukalt juba lõpetatud tellimuse pärast seda, kui olete
            raha välja võtnud, nõustute, et (a) võime võtta vastava summa Teie tulevaste
            müükide tulust või rahakoti jäägist ja (b) kui Teie rahakoti jääk seda ei kata,
            võlgnete meile puudujääva summa, mille võime sisse nõuda Teie elukohajärgse
            riigi kohtu kaudu.
          </p>

          <h3 className={LEGAL_SUB_HEADING_CLASS}>Negatiivne saldo</h3>
          <p>
            Kui tagasimakse, tagasinõude või muu korrigeerimise tõttu muutub Teie rahakoti
            saldo negatiivseks, peate puudujäägi hüvitama 30 päeva jooksul teavituse
            saamisest, kas ülekandega meie poolt nimetatud pangakontole või tasaarveldusega
            tulevastest müükidest.
          </p>

          <h3 className={LEGAL_SUB_HEADING_CLASS}>Mitteaktiivsed kontod</h3>
          <p>
            Hoiame rahakoti jääke tähtajatult. Kui Te pole 24 kuu jooksul sisse loginud ja
            Teie saldo on positiivne, saadame Teile e-kirja Teie märgitud aadressile. Kui
            me ei saa vastust 90 päeva jooksul, võime proovida saata jäägi Teie viimasele
            teadaolevale IBAN-ile (pärast uut kontrolli). Kõik välja võtmata summad jäävad
            Teie omaks ja maksame need välja Teie soovil.
          </p>
        </section>

        <section id="suspension-and-risk-controls" className="space-y-3">
          <h2 className={SECTION_HEADING_CLASS}>
            7. Peatamine, lõpetamine ja riskikontroll
          </h2>
          <p>
            STG võib peatada või lõpetada Teie müügiõigused või kogu konto, kui meil on
            alust arvata, et olete:
          </p>
          <ul className="list-disc pl-6 space-y-1">
            <li>tegelenud pettuse või eksitava tegevusega;</li>
            <li>
              korduvalt esitanud valeandmeid eseme seisukorra kohta või keeldunud
              lahendamast põhjendatud vaidlusi;
            </li>
            <li>jätnud kinnitatud tellimused nõutud aja jooksul saatmata;</li>
            <li>põhjustanud ebamõistlikult palju tagasinõudeid või vaidlusi;</li>
            <li>kasutanud platvormi äriliseks edasimüügiks, rikkudes punkti 2; või</li>
            <li>muul viisil kahjustanud meid või teisi kasutajaid.</li>
          </ul>
          <p>
            Konto peatamise või lõpetamise korral võidakse ootel olevaid väljamakseid hoida
            kinni kuni 180 päeva, et katta võimalikud tagasinõuded, tagasimaksed või
            lahendamata vaidlused.
          </p>

          <h3 className={LEGAL_SUB_HEADING_CLASS}>
            Rahapesu tõkestamine, sanktsioonid ja pettused
          </h3>
          <p>
            <strong>
              Põhjendatud juhtudel ja niipea kui see on seadusega lubatud (teavitamine võib
              viibida, kui seda nõuavad AML, sanktsioonide või õiguskaitseasutuste
              kohustused), võime
            </strong>{' '}
            (a) kontrollida tehinguid, kontosid, IBAN-eid ja tuvastamisandmeid EL-i ja
            rahvusvaheliste sanktsioonide nimekirjade, riikliku taustaga isikute
            nimekirjade ja pettuste andmebaaside vastu; (b) peatada Teie konto, külmutada
            Teie rahakoti saldo või keelduda väljamaksest, kui kahtlustame rahapesu,
            terrorismi rahastamist, sanktsioonidest kõrvalehoidumist või pettust; (c)
            paluda Teil esitada täiendavaid isikuandmeid, teavet vahendite päritolu või
            tegelike kasusaajate kohta; ning (d) jagada teavet pädevate asutuste ja meie
            makseteenuse pakkujaga. Sellist teavet regulaarselt saavad asutused on
            loetletud meie{' '}
            <Link href="/privacy/et" className="link-brand">
              Privaatsuspoliitika
            </Link>{' '}
            punktis 6. Käesoleva punkti alusel külmutatud vahendid jäävad Teie omandiks ja
            vabastatakse pärast asja lahendamist, järgides pädeva asutuse võimalikke
            korraldusi.{' '}
            <strong>
              Võite selliseid otsuseid edasi kaevata, kirjutades aadressile
              info@secondturn.games. Apellatsiooni vaatab 14 päeva jooksul läbi isik, kes
              ei osalenud algse otsuse tegemisel, ja vastab kirjalikult. Kui AML,
              sanktsioonide või õiguskaitsega seotud kohustused keelavad meil konkreetset
              tegevust selgitada, teavitame Teid siis, kui see piirang enam ei kehti.
            </strong>
          </p>
        </section>

        <section className="space-y-3">
          <h2 className={SECTION_HEADING_CLASS}>
            8. Maksud ja arveldamine
          </h2>

          <h3 className={LEGAL_SUB_HEADING_CLASS}>Käibemaks vahendustasult</h3>
          <p>
            Meie 10% vahendustasu eseme hinnalt on elektrooniliselt osutatav teenus nõukogu
            rakendusmääruse (EL) nr 282/2011 artikli 7 tähenduses. Teenuse osutamise koht
            on määratud direktiivi 2006/112/EÜ artikli 58 alusel (mittemaksukohustuslasest
            kliendi asukoht). Käibemaks sisaldub arvel esitatud 10% vahendustasus (seda ei
            lisata peale) vastavalt Teie asukohariigi määrale: Lätis 21%, Leedus 21%,
            Eestis 24%. Näiteks &euro;2,00 vahendustasu puhul Lätis on see &euro;1,65 neto
            + &euro;0,35 KM. Meie käibemaksukohustuslase number on{' '}
            {LEGAL_ENTITY_VAT_NUMBER}.
          </p>

          <h3 className={LEGAL_SUB_HEADING_CLASS}>Käibemaks saatmiselt</h3>
          <p>
            Kui korraldame saatmist oma logistikapartnerite kaudu, edasimüüme
            saatmisteenust Teile vastavalt selle riigi käibemaksumäärale, kust kaup välja
            saadetakse (Teie riik). Käibemaks sisaldub arvel toodud saatmistasus (seda ei
            lisata peale). Teenuse osutamise koht on määratud direktiivi 2006/112/EÜ
            artiklite 49 ja 50 alusel, sõltuvalt sellest, kas saadetis on riigisisene või
            piiriülene.
          </p>

          <h3 className={LEGAL_SUB_HEADING_CLASS}>Arved</h3>
          <p>
            Väljastame arve vahendustasu ja saatmise käibemaksu kohta pärast iga lõpetatud
            tellimust vormingus <span className="font-mono">INV-YYYY-NNNNN</span>. Arved on
            saadaval Teie konto jaotises „Müügid” ja neid säilitatakse vastavalt meie{' '}
            <Link href="/privacy/et" className="link-brand">
              Privaatsuspoliitika
            </Link>{' '}
            punktile 9.
          </p>

          <h3 className={LEGAL_SUB_HEADING_CLASS}>Teie tulumaks</h3>
          <p>
            Te vastutate ise oma müügitulu deklareerimise eest oma asukohariigi
            maksuametile, arvestades seal kehtivaid eraisikust müüja maksuvabasid
            piirmäärasid. Me ei pea Teie eest kinni tulumaksu ega anna maksunõu.
          </p>

          <h3 className={LEGAL_SUB_HEADING_CLASS}>DAC7 aruandlus</h3>
          <p>
            Vastavalt nõukogu direktiivile (EL) 2021/514 (DAC7) peame teatama Teie andmed
            Läti riiklikule maksuteenistusele (VID), kui Teie tegevus kalendriaasta jooksul
            ületab 30 müüki või €2000 tasu (summa, mille saate pärast meie vahendustasu
            mahaarvamist). Need piirmäärad tulenevad direktiivist ja me ei saa neid muuta.
            Enne piirmäärade täitumist küsime Teilt DAC7 andmeid, et aruanne ei viibiks.
            Meie sisemine hoiatuslävi on madalam &mdash; 25 müüki või €1750. Küsime Teie
            täisnime, sünnikuupäeva, aadressi ja maksukohustuslase numbrit. Kui Te neid
            andmeid ei esita, võime peatada Teie müügiõigused ja väljamaksed kuni andmete
            esitamiseni. Teil on õigus küsida koopiat andmetest, mis me Teie kohta
            edastasime.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className={SECTION_HEADING_CLASS}>
            9. Lepingumuudatused
          </h2>
          <p>
            Võime käesolevat lepingut uuendada. Olulistest muudatustest (tasud,
            vahendustasude määrad, müüja kohustused) teavitame Teid e-posti teel vähemalt
            14 päeva enne nende jõustumist. Müügi jätkamine pärast teavitusperioodi lõppu
            tähendab, et nõustute uuendatud tingimustega.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className={SECTION_HEADING_CLASS}>
            10. Keel
          </h2>
          <p>
            Käesoleva lepingu tõlkeid võidakse pakkuda teistes keeltes Teie mugavuse
            huvides. Ingliskeelne versioon on õiguslikult siduv originaal. Mis tahes
            lahknevuse või vastuolu korral ingliskeelse versiooni ja mis tahes tõlke vahel
            on määrav ingliskeelne versioon.
          </p>
        </section>

        <p className="text-sm text-semantic-text-muted pt-4 border-t border-semantic-border-subtle">
          Vt ka meie{' '}
          <Link href="/terms/et" className="link-brand">
            Kasutustingimusi
          </Link>{' '}
          ja{' '}
          <Link href="/privacy/et" className="link-brand">
            Privaatsuspoliitikat
          </Link>
          .
        </p>
      </div>
    </>
  );
}
