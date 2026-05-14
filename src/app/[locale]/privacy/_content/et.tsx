import Link from 'next/link';
import { Card, CardBody, CardHeader } from '@/components/ui';
import { SECTION_HEADING_CLASS } from '@/lib/heading-classes';
import { LEGAL_SUB_HEADING_CLASS } from '@/lib/legal/page-classes';
import {
  LEGAL_ENTITY_NAME,
  LEGAL_ENTITY_ADDRESS,
  LEGAL_ENTITY_REG_NUMBER,
  LEGAL_ENTITY_BANK_NAME,
  LEGAL_ENTITY_BANK_REG_NUMBER,
  PSP_TECHNICAL_PROVIDER_NAME,
  PSP_TECHNICAL_PROVIDER_REG_NUMBER,
} from '@/lib/constants';

export default function PrivacyEt() {
  return (
    <>
      <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-semantic-text-heading mb-6">
        Privaatsuspoliitika
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
              Lihtsas keeles versioon. Täielike reeglite lugemiseks jätka altpoolt.
            </p>
          </CardHeader>
          <CardBody>
            <ul className="list-disc pl-5 space-y-2 text-sm text-semantic-text-secondary">
              <li>
                Kogume ainult seda, mida vajame turuplatsi toimimiseks &mdash; Teie konto
                andmeid, teavet selle kohta, mida ostate ja müüte, ning andmeid, mida
                maksuhaldurid kohustavad meid säilitama.
              </li>
              <li>
                Me ei müü kunagi Teie andmeid. Kõik partnerid, kellega me andmeid jagame,
                on loetletud 6. jaotises, rühmitatuna nende ülesannete järgi.
              </li>
              <li>
                Meie analüütika töötab küpsisevabas (<em>cookieless</em>) režiimis, ei
                jälgi Teid teistel saitidel ega näe Teie IP-aadressi. Me ei näita
                reklaame.
              </li>
              <li>
                Saate igal ajal oma andmetele juurde pääseda, neid eksportida või oma
                konto seadetes kustutada. Kustutamine on kohene &mdash; Teie profiil
                anonüümitakse sekunditega.
              </li>
              <li>
                Säilitame teatud andmeid (tellimused, arved, DAC7 müüja andmed) kuni
                10 aastat, kuna Läti seadused seda nõuavad. Kõik muu kustub koos Teie
                kontoga.
              </li>
              <li>
                Andmekaitsealased küsimused ja taotlused saatke aadressile:{' '}
                <a href="mailto:privacy@secondturn.games" className="link-brand">
                  privacy@secondturn.games
                </a>
                . Teil on õigus esitada kaebus ka Läti andmekaitse inspektsioonile.
              </li>
            </ul>
          </CardBody>
        </Card>

        <section className="space-y-3">
          <h2 className={SECTION_HEADING_CLASS}>
            1. Kes me oleme
          </h2>
          <p>
            Andmete vastutav töötleja on <strong>{LEGAL_ENTITY_NAME}</strong> („STG”,
            „meie”), registrikood {LEGAL_ENTITY_REG_NUMBER}, registreeritud aadressil{' '}
            {LEGAL_ENTITY_ADDRESS}. Käesolev poliitika selgitab, milliseid andmeid me
            kogume ja miks, tuginedes isikuandmete kaitse üldmäärusele (määrus (EL)
            2016/679, edaspidi GDPR) ja Läti andmekaitseseadusele.
          </p>
          <p>
            Andmekaitseküsimuste ja -taotluste korral (juurdepääs, eksportimine,
            kustutamine, vastuväidete esitamine) kirjutage aadressile{' '}
            <a href="mailto:privacy@secondturn.games" className="link-brand">
              privacy@secondturn.games
            </a>
            . Muude küsimuste korral kasutage aadressi{' '}
            <a href="mailto:info@secondturn.games" className="link-brand">
              info@secondturn.games
            </a>
            .
          </p>
          <p className="text-xs text-semantic-text-muted">
            Platvormi kasutamise õigus (vanus, elukohariik) on sätestatud meie{' '}
            <Link href="/terms/et" className="link-brand">
              Kasutustingimustes
            </Link>
            . Kui saame teada, et alla lubatud vanuse isikul on konto, kustutame tema
            andmed.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className={SECTION_HEADING_CLASS}>
            2. Kogutavad andmed
          </h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>
              <strong>Konto andmed:</strong> e-posti aadress, kuvatav nimi, riik,
              telefoninumber.
            </li>
            <li>
              <strong>Müügikuulutuse andmed:</strong> mängu andmed, seisukord, fotod,
              hind. Asukoha metaandmed (EXIF) eemaldatakse üleslaaditud fotodelt
              automaatselt.
            </li>
            <li>
              <strong>Tellimuse andmed:</strong> ostuajalugu, tarneaadressid
              (pakiautomaadi valikud), tellimuse olek.
            </li>
            <li>
              <strong>Müüja finantsandmed:</strong> rahakoti jääk, tehingute ajalugu,
              pangakonto andmed (IBAN) väljamakseteks.
            </li>
            <li>
              <strong>Makseandmed:</strong> neid töötleb{' '}
              <strong>{LEGAL_ENTITY_BANK_NAME}</strong> (Läti krediidiasutus) ja selle
              tehniline teenusepakkuja <strong>{PSP_TECHNICAL_PROVIDER_NAME}</strong>{' '}
              (Eesti, reg. nr {PSP_TECHNICAL_PROVIDER_REG_NUMBER}). Volitatud
              töötlejate üksikasjad on &sect;6-s. Me ei salvesta kaardiandmeid.
            </li>
            <li>
              <strong>Kasutusandmed:</strong> külastatud lehed, brauseri tüüp,
              IP-aadress (turvalisuse tagamiseks ja platvormi täiustamiseks).
            </li>
            <li>
              <strong>Pettuste ennetamise signaalid:</strong> seadme-, käitumis- ja
              tehingusignaalid, mida kasutatakse pettuste, võltsitud kuulutuste ja
              kuritarvituste tuvastamiseks.
            </li>
          </ul>
          <p>
            <strong>Mis on avalikult nähtav.</strong> Niipea kui lisate mängu müüki või
            jätate arvustuse, muutub osa Teie profiilist nähtavaks kõigile saidi
            külastajatele, sealhulgas sisselogimata kasutajatele: Teie kuvatav nimi,
            Teie riik (lipuna), Teie profiilifoto (kui olete selle üles laadinud) ja
            konto loomise kuupäev. Saadud müüja arvustused on samuti avalikud ja
            kuvatakse Teie profiilil. Me ei avalda Teie e-posti aadressi,
            telefoninumbrit, täielikku aadressi ega makseteavet teistele kasutajatele
            ega anonüümsetele külastajatele.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className={SECTION_HEADING_CLASS}>
            3. Töötlemise õiguslik alus
          </h2>
          <p>
            Töötleme isikuandmeid järgmistel GDPR artikli 6 lõike 1 õiguslikel alustel:
          </p>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-semantic-border-subtle">
                  <th className="text-left py-2 pr-4 font-semibold text-semantic-text-heading">
                    Andmete kategooria
                  </th>
                  <th className="text-left py-2 font-semibold text-semantic-text-heading">
                    Õiguslik alus
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-semantic-border-subtle">
                <tr>
                  <td className="py-2 pr-4">Konto andmed</td>
                  <td className="py-2">Art. 6(1)(b) &mdash; lepingu täitmine</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4">Kuulutuse ja tellimuse andmed</td>
                  <td className="py-2">Art. 6(1)(b) &mdash; lepingu täitmine</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4">Tehingute kirjed</td>
                  <td className="py-2">
                    Art. 6(1)(b) &mdash; leping + Art. 6(1)(c) &mdash; juriidiline
                    kohustus (maksud/raamatupidamine)
                  </td>
                </tr>
                <tr>
                  <td className="py-2 pr-4">Müüja finantsandmed</td>
                  <td className="py-2">
                    Art. 6(1)(b) &mdash; leping + Art. 6(1)(c) &mdash; juriidiline
                    kohustus
                  </td>
                </tr>
                <tr>
                  <td className="py-2 pr-4">
                    DAC7 müüja identifitseerimine (maksukohustuslase number,
                    sünniaeg, aadress)
                  </td>
                  <td className="py-2">
                    Art. 6(1)(c) &mdash; juriidiline kohustus (nõukogu direktiiv (EL)
                    2021/514, aruandlus Läti riiklikule maksuteenistusele)
                  </td>
                </tr>
                <tr>
                  <td className="py-2 pr-4">Kasutus- ja turvaandmed</td>
                  <td className="py-2">
                    Art. 6(1)(f) &mdash; õigustatud huvi (platvormi turvalisus, teenuse
                    täiustamine)
                  </td>
                </tr>
                <tr>
                  <td className="py-2 pr-4">Pettuste ennetamise signaalid</td>
                  <td className="py-2">
                    Art. 6(1)(f) &mdash; õigustatud huvi (pettuste, võltsitud
                    kuulutuste ja kuritarvituste ennetamine)
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className={SECTION_HEADING_CLASS}>
            4. Kuidas me Teie andmeid kasutame
          </h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>Turuplatsi pakkumiseks ja haldamiseks.</li>
            <li>Tehingute töötlemiseks ja transpordi korraldamiseks.</li>
            <li>Süsteemsete e-kirjade saatmiseks (tellimuse kinnitused, tarneinfo).</li>
            <li>Pettuste ennetamiseks ja kasutustingimuste täitmise tagamiseks.</li>
            <li>Platvormi täiustamiseks vastavalt kasutusmustritele.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className={SECTION_HEADING_CLASS}>
            5. Andmete säilitamine ja turvalisus
          </h2>
          <p>
            Teie andmeid hoitakse <strong>Supabase</strong>&apos;is (pilvandmebaas
            Põhja-Euroopa piirkonnas, Stockholmis), kus rakendatakse andmebaasi tasandi
            turvapoliitikaid (<em>row-level security</em>), mida tagatakse andmebaasi
            kihis. Meie rakendusserverid asuvad <strong>Hetzner</strong>&apos;is
            Helsingis, Soomes. Edastatavad andmed krüpteeritakse TLS-i kaudu, puhkeolekus
            andmed AES-256 abil. Fotosid hoitakse Supabase Storage&apos;is koos
            juurdepääsu kontrolliga.
          </p>
          <p>
            <strong>Fotode kustutamine.</strong> Kui kuulutus eemaldatakse &mdash; müüja
            poolt, platvormi poolt või konto kustutamisel &mdash; eemaldatakse seotud
            fotod Supabase Storage&apos;ist automaatse puhastusprotsessi käigus, mis
            toimub iga kuue tunni järel. Fotosid ei säilitata kauem kui kestab kuulutus,
            mille juurde need kuuluvad.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className={SECTION_HEADING_CLASS}>
            6. Kellega me Teie andmeid jagame
          </h2>
          <p>
            Jagame Teie andmeid allpool loetletud kolmandate osapooltega ainult määral,
            mis on vajalik nende ülesannete täitmiseks. Need partnerid jagunevad kahte
            rühma. Enamik on <strong>volitatud töötlejad</strong>: nad tegutsevad meie
            kirjalike juhiste ja andmetöötluslepingu alusel. Mõned on{' '}
            <strong>iseseisvad vastutavad töötlejad</strong> oma suhtega Teiega ja oma
            privaatsuspoliitikaga &mdash; peamine näide on sisselogimisteenuse
            pakkujad. Iga rühm on allpool vastavalt märgistatud.
          </p>
          <p>Me ei müü Teie isikuandmeid ja me ei näita reklaame.</p>

          <h3 className={LEGAL_SUB_HEADING_CLASS}>
            Maksed, tarned ja teavitused (volitatud töötlejad)
          </h3>
          <ul className="list-disc pl-6 space-y-1">
            <li>
              <strong>
                {LEGAL_ENTITY_BANK_NAME} (Läti, reg. kood {LEGAL_ENTITY_BANK_REG_NUMBER}).
              </strong>{' '}
              Maksete töötlemine. Saab ostja nime, e-posti aadressi, summa ja tehingu
              metaandmed. Meie ei salvesta kaardiandmeid. Kaardiandmeid töödeldakse
              PCI-DSS keskkonnas, mida Swedbanki nimel haldab tema tehniline
              teenusepakkuja (vt järgmine kirje).
            </li>
            <li>
              <strong>
                {PSP_TECHNICAL_PROVIDER_NAME} (Eesti, reg. kood{' '}
                {PSP_TECHNICAL_PROVIDER_REG_NUMBER}).
              </strong>{' '}
              Swedbanki kaasatud tehniline pakkuja Swedbanki e-kaubanduse maksete
              platvormi tingimuste &sect;1 ja &sect;2.8 alusel. Haldab Swedbanki nimel
              PCI-DSS sertifitseeritud makseplatvormi. Saab samad tehingu metaandmed,
              mille Swedbank talle avaldab nimetatud tingimuste &sect;10.6 alusel.
            </li>
            <li>
              <strong>Unisend SIA.</strong> Pakiautomaatide vedu Balti riikide vahel.
              Saab saatja ja saaja nimed, telefoninumbrid, e-posti aadressid ja valitud
              terminalid.
            </li>
            <li>
              <strong>Resend.</strong> Tehingupõhiste e-kirjade edastamine (tellimuse
              kinnitused, tarneinfo, oksjoniteavitused). Saab saaja e-posti aadressi,
              kuvatava nime ja e-kirja sisu. Me ei kasuta Resendi turunduseks.
            </li>
          </ul>

          <h3 className={LEGAL_SUB_HEADING_CLASS}>
            Sisselogimisteenuse pakkujad (iseseisvad vastutavad töötlejad)
          </h3>
          <p>
            Kui logite sisse Google&apos;i või Facebooki kaudu, kontrollib teenusepakkuja
            oma poolel Teie sisselogimist ja edastab meile Teie kinnitatud e-posti
            aadressi ja profiili identifikaatori. Teenusepakkuja on Teie kontoandmete
            iseseisev vastutav töötleja oma privaatsuspoliitika alusel. Me ei ütle
            Google&apos;ile ega Metale, kuidas nende kasutajate andmeid käidelda; nad ei
            töötle andmeid meie nimel. Üleandmine toimub nõusoleku alusel, mille annate
            „Continue with…” viiba juures.
          </p>
          <ul className="list-disc pl-6 space-y-1">
            <li>
              <strong>Google Ireland Limited</strong> &mdash; „Continue with Google”
              sisselogimine. Reguleeritakse Google&apos;i enda privaatsuspoliitikaga.
            </li>
            <li>
              <strong>Meta Platforms Ireland Limited</strong> &mdash; „Continue with
              Facebook” sisselogimine. Reguleeritakse Meta enda privaatsuspoliitikaga.
            </li>
          </ul>

          <h3 className={LEGAL_SUB_HEADING_CLASS}>Infrastruktuur (volitatud töötlejad)</h3>
          <ul className="list-disc pl-6 space-y-1">
            <li>
              <strong>Supabase (Supabase Inc., EL piirkond).</strong> Meie andmebaas,
              autentimisteenuse pakkuja ja failihoidla. Säilitab konto, kuulutuse,
              tellimuse, sõnumivahetuse, rahakoti ja fotoandmeid. Juurdepääsu
              reguleerivad andmebaasi tasandi turvapoliitikad.
            </li>
            <li>
              <strong>Hetzner Online GmbH (Helsingi, Soome).</strong> VPS-teenuse
              pakkuja, kus asub Next.js rakenduse kiht. Töötleb iga HTTP-päringut
              saidile võrgu alltöötlejana.
            </li>
            <li>
              <strong>Cloudflare, Inc.</strong> DNS, CDN, pöördproksi ja botihalduse
              äärepunkt saidile{' '}
              <span className="font-mono">secondturn.games</span>. Töötleb Teie
              IP-aadressi ja päringu metaandmeid, kui külastate saiti, ja kasutab{' '}
              <strong>Cloudflare Turnstile</strong>&apos;i, et hoida automatiseeritud
              esitused platvormilt eemal. Cloudflare&apos;i seatud küpsiste üksikasjad
              on meie{' '}
              <Link href="/cookies" className="link-brand">
                Küpsiste poliitikas
              </Link>
              .
            </li>
          </ul>

          <h3 className={LEGAL_SUB_HEADING_CLASS}>Vaadeldavus (volitatud töötlejad)</h3>
          <ul className="list-disc pl-6 space-y-1">
            <li>
              <strong>Sentry (Functional Software, Inc.).</strong> Vigade seire. Saab
              pinujäljed ja piiratud brauseri konteksti, kui midagi katki läheb, et
              saaksime selle parandada. Käivitame PII filtreerimise sündmustel enne
              nende lahkumist meie serveritest, ja sessiooni kordusvõte on välja
              lülitatud.
            </li>
            <li>
              <strong>PostHog Cloud (PostHog, Inc., EL piirkond Frankfurtis).</strong>{' '}
              Tooteanalüütika. Töötab küpsisevabas režiimis, seega ei aseta küpsiseid
              ega kohaliku salvestusruumi elemente Teie brauserisse. Sündmused
              suunatakse läbi meie enda domeenil oleva esimese osapoole pöördproksi,
              mis eemaldab kliendi IP päised enne, kui päring meie serverist lahkub,
              nii et PostHog näeb meie serveri IP-d, mitte Teie oma.
            </li>
          </ul>

          <h3 className={LEGAL_SUB_HEADING_CLASS}>
            Ametiasutused ja õiguskaitseasutused
          </h3>
          <p>
            Kui seadus seda nõuab &mdash; sanktsioonide kontroll, rahapesuvastased
            reeglid, maksuaruandlus või konkreetne õiguskaitseasutuse päring &mdash;
            võime jagada konto, tehingu või isiku andmeid pädevate asutustega. Meie
            jurisdiktsiooni tavapärased saajad on:
          </p>
          <ul className="list-disc pl-6 space-y-1">
            <li>
              <strong>Riiklik maksuteenistus (VID, Läti)</strong> &mdash; DAC7 müüjate
              aruandlus (nõukogu direktiiv (EL) 2021/514) ja muud seadusjärgsed
              maksualased avaldused.
            </li>
            <li>
              <strong>Rahapesu andmebüroo (FID, Läti)</strong> &mdash; kahtlaste
              tehingute teated Läti rahapesuvastase seaduse alusel.
            </li>
            <li>
              <strong>Läti riigi julgeolekuteenistus</strong> &mdash; sanktsioonide ja
              riikliku julgeoleku päringud EL-i ja Läti sanktsiooniõiguse alusel.
            </li>
            <li>
              <strong>Õiguskaitseasutused</strong> Lätis, Leedus või Eestis
              kohtumääruse või muu seadusliku aluse alusel.
            </li>
          </ul>
          <p>
            Andmete avaldamine neile asutustele toimub GDPR artikli 6(1)(c) &mdash;
            juriidilise kohustuse &mdash; alusel. Tingimused, mille korral võib
            selliseks avaldamiseks väljamakse edasi lükata või rahakoti külmutada, on
            kirjeldatud{' '}
            <Link href="/seller-terms/et" className="link-brand">
              Müügilepingu
            </Link>{' '}
            7. punktis.
          </p>

          <h3 className={LEGAL_SUB_HEADING_CLASS}>
            Väljaminevad ühendused, mida Teie brauser teeb
          </h3>
          <p>
            Kuulutust vaadates laadib Teie brauser kaanepildi otse BoardGameGeeki (BGG)
            CDN-ist (<span className="font-mono">cf.geekdo-images.com</span>). BGG on
            koht, kust pärineb enamik meie mänguandmetest, ja nende CDN logib Teie IP-d
            samamoodi nagu iga teine sait, mida külastate. BGG ei ole meie volitatud
            töötleja; me ei saada neile Teie kontoandmeid. Kuid pildi laadimine on
            otsene brauser-BGG-ühendus, seega tasub seda teada. Meie serveri-serveri
            kõned BGG-le mängu metaandmete saamiseks ei avalda kunagi Teie IP-d.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className={SECTION_HEADING_CLASS}>
            7. Küpsised ja kohalik salvestusruum
          </h2>
          <p>
            Kasutame ainult rangelt vajalikke küpsiseid ja piiratud arvu eelistuste
            kirjeid Teie brauseri kohalikus või sessiooni salvestusruumis. Me ei kasuta
            reklaami- ega saitidevahelisi jälitusküpsiseid.
          </p>
          <p>
            <Link href="/cookies" className="link-brand">
              Küpsiste poliitikas
            </Link>{' '}
            on loetletud iga küpsis ja salvestusruumi kirje, mille me seame, sealhulgas
            selle täpne nimi, otstarve, kestus ja tüüp (rangelt vajalik või eelistus).
            Analüütika jaoks kasutame küpsisevaba režiimi tööriistu, mis ei sea Teie
            brauserisse küpsiseid.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className={SECTION_HEADING_CLASS}>
            8. Teie õigused GDPR-i alusel
          </h2>
          <p>Teil on õigus:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Tutvuda oma isikuandmetega (artikkel 15).</li>
            <li>Parandada ebaõigeid andmeid (artikkel 16).</li>
            <li>
              Kustutada oma andmed, arvestades seadusest tulenevaid säilitamisnõudeid
              (artikkel 17).
            </li>
            <li>
              Kanda andmed üle teise teenusesse masinloetavas vormingus (artikkel 20).
            </li>
            <li>
              Esitada vastuväiteid õigustatud huvil põhinevale töötlemisele
              (artikkel 21).
            </li>
            <li>Piirata töötlemist teatud asjaoludel (artikkel 18).</li>
            <li>
              Esitada kaebus järelevalveasutusele (artikkel 77) &mdash; Läti asutust ja
              selle kontaktandmeid vt jaotisest 12.
            </li>
          </ul>
          <p>
            Vastame kõigile õiguste päringutele 30 päeva jooksul. Andmetele
            juurdepääsuks, eksportimiseks või kustutamiseks külastage oma{' '}
            <Link href="/account/settings" className="link-brand">
              konto seadeid
            </Link>
            . Muude päringute korral võtke meiega ühendust aadressil{' '}
            <a href="mailto:info@secondturn.games" className="link-brand">
              info@secondturn.games
            </a>
            .
          </p>
        </section>

        <section className="space-y-3">
          <h2 className={SECTION_HEADING_CLASS}>
            9. Andmete säilitamine
          </h2>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-semantic-border-subtle">
                  <th className="text-left py-2 pr-4 font-semibold text-semantic-text-heading">
                    Andmete tüüp
                  </th>
                  <th className="text-left py-2 font-semibold text-semantic-text-heading">
                    Säilitamisperiood
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-semantic-border-subtle">
                <tr>
                  <td className="py-2 pr-4">Konto profiil (nimi, e-post, telefon)</td>
                  <td className="py-2">
                    Anonüümitakse hetkel, kui kustutate oma konto. Taastamisperioodi ei
                    ole &mdash; konto kustutamine on kohene ja lõplik.
                  </td>
                </tr>
                <tr>
                  <td className="py-2 pr-4">Aktiivsete kuulutuste andmed ja fotod</td>
                  <td className="py-2">
                    Kuni kuulutuse eemaldamiseni või konto kustutamiseni. Fotod
                    eemaldatakse Supabase Storage&apos;ist kuue tunni jooksul pärast
                    kuulutuse eemaldamist.
                  </td>
                </tr>
                <tr>
                  <td className="py-2 pr-4">
                    Sooritatud tellimused, arved ja tehingute kirjed
                  </td>
                  <td className="py-2">
                    5 aastat tehingu kalendriaasta lõpust vastavalt Läti
                    käibemaksuseaduse (Pievienotās vērtības nodokļa likums) artiklile
                    133 vahendustasu arvete osas ja Läti raamatupidamisseaduse
                    (Grāmatvedības likums) &sect;10 raamatupidamise algdokumentide
                    osas. Neid kirjeid säilitatakse ka pärast Teie konto kustutamist
                    &mdash; need on vabastatud kustutamistaotlustest GDPR artikli 17
                    lõike 3 punkti b alusel.
                  </td>
                </tr>
                <tr>
                  <td className="py-2 pr-4">
                    Aastased finantsaruanded ja toetav raamatupidamine
                  </td>
                  <td className="py-2">
                    10 aastat vastavalt Grāmatvedības likums &sect;10. Tegemist on
                    ettevõtte tasandi andmetega, mis tavaliselt ei sisalda
                    isikuandmeid, kuid on terviklikkuse huvides siin loetletud.
                  </td>
                </tr>
                <tr>
                  <td className="py-2 pr-4">
                    DAC7 müüja andmed (maksukohustuslase number, sünniaeg, aadress,
                    aruandeperioodi summad)
                  </td>
                  <td className="py-2">
                    10 aastat aruandeaasta kalendriaasta lõpust, nagu nõuab nõukogu
                    direktiivi 2011/16/EL artikkel 25, muudetud nõukogu direktiiviga
                    (EL) 2021/514. Kohaldub ainult DAC7 aruandluse piirmäärasid
                    saavutavatele müüjatele. See on eraldi ja pikem kohustus kui
                    ülaltoodud raamatupidamiskirjete säilitamine.
                  </td>
                </tr>
                <tr>
                  <td className="py-2 pr-4">
                    Teie kirjutatud ja saadud arvustused
                  </td>
                  <td className="py-2">
                    Säilitatakse arvustatud müüja profiilil tähtajatult. Kui kustutate
                    oma konto, Teie kirjutatud arvustused anonüümitakse, mitte ei
                    eemaldata, et müüja maine ajalugu säiliks.
                  </td>
                </tr>
                <tr>
                  <td className="py-2 pr-4">
                    Kuulutuste kommentaarid ja tellimuste sõnumid
                  </td>
                  <td className="py-2">
                    Anonüümitakse hetkel, kui kustutate oma konto (sisu asendatakse
                    „[deleted]” tähisega); muul juhul säilitatakse kuulutuse või
                    tellimuse eluea jooksul.
                  </td>
                </tr>
                <tr>
                  <td className="py-2 pr-4">
                    Turvalogid (IP, sisselogimisaktiivsus)
                  </td>
                  <td className="py-2">30 päeva</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p>
            Saate oma konto kustutamist taotleda igal ajal konto seadetes. Ülaltoodud
            kirjed, mille suhtes kehtib juriidilise kohustuse säilitamine, jäävad alles
            seaduses nõutud perioodiks, kuid Teie profiil, otsesed identifikaatorid ja
            mittetehingulik sisu eemaldatakse või anonüümitakse viivitamatult.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className={SECTION_HEADING_CLASS}>
            10. Andmetega seotud rikkumisest teavitamine
          </h2>
          <p>
            Kui andmetega seotud rikkumine kujutab ohtu Teie õigustele, teavitame
            järelevalveasutust 72 tunni jooksul vastavalt GDPR artiklile 33. Kui oht
            Teile on suur, teavitame Teid ka otse.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className={SECTION_HEADING_CLASS}>
            11. Laste andmed
          </h2>
          <p>
            <Link href="/terms/et" className="link-brand">
              Kasutustingimused
            </Link>{' '}
            sätestavad platvormi kasutamise ja müümise vanusepiirangud. Kui saame
            teada, et alla miinimumvanuse isikul on konto, võtke meiega ühendust ja
            kustutame tema andmed.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className={SECTION_HEADING_CLASS}>
            12. Järelevalveasutus
          </h2>
          <p>
            Kui leiate, et Teie andmekaitseõigusi on rikutud, saate esitada kaebuse{' '}
            <strong>Läti andmekaitse inspektsioonile (DVI)</strong>:{' '}
            <a
              href="https://www.dvi.gov.lv"
              className="link-brand"
              target="_blank"
              rel="noopener noreferrer"
            >
              dvi.gov.lv
            </a>
            .
          </p>
        </section>

        <section className="space-y-3">
          <h2 className={SECTION_HEADING_CLASS}>
            13. Muudatused poliitikas
          </h2>
          <p>
            Võime seda poliitikat uuendada. Teavitame registreeritud kasutajaid
            olulistest muudatustest e-posti teel.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className={SECTION_HEADING_CLASS}>
            14. Keel
          </h2>
          <p>
            Käesoleva poliitika tõlkeid võidakse pakkuda teistes keeltes Teie mugavuse
            huvides. Ingliskeelne versioon on autoriteetne originaal. Mis tahes
            lahknevuse korral ingliskeelse versiooni ja mis tahes tõlke vahel on
            määrav ingliskeelne versioon.
          </p>
        </section>

        <p className="text-sm text-semantic-text-muted pt-4 border-t border-semantic-border-subtle">
          Vt ka meie{' '}
          <Link href="/terms/et" className="link-brand">
            Kasutustingimusi
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
