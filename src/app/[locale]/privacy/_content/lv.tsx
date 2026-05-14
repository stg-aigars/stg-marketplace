import Link from 'next/link';
import { Card, CardBody, CardHeader } from '@/components/ui';
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

export default function PrivacyLv() {
  return (
    <>
      <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-semantic-text-heading mb-6">
        Privātuma politika
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
                Mēs vācam tikai to, kas nepieciešams tirgus platformas darbībai — tava konta
                informāciju, datus par to, ko tu pērc un pārdod, kā arī ierakstus, kurus
                mums uzliek par pienākumu glabāt nodokļu iestādes.
              </li>
              <li>
                Mēs nekad nepārdodam tavus datus. Visi sadarbības partneri, ar kuriem mēs
                kopīgojam datus, ir uzskaitīti 6. sadaļā, sagrupēti pēc to veicamajām
                funkcijām.
              </li>
              <li>
                Mūsu analītikas rīki darbojas bezsīkdatņu (<em>cookieless</em>) režīmā, tie
                neizseko tevi citās vietnēs un neredz tavu IP adresi. Mēs nerādām reklāmas.
              </li>
              <li>
                Tu vari piekļūt saviem datiem, eksportēt tos vai izdzēst savu kontu jebkurā
                laikā konta iestatījumos. Dzēšana ir tūlītēja — tavs profils tiek anonimizēts
                dažu sekunžu laikā.
              </li>
              <li>
                Dažus ierakstus (pasūtījumus, rēķinus, DAC7 pārdevēju datus) mēs glabājam
                līdz pat 10 gadiem, jo to prasa Latvijas likumdošana. Viss pārējais tiek
                dzēsts līdz ar tava konta slēgšanu.
              </li>
              <li>
                Jautājumus un pieprasījumus par datu aizsardzību sūti uz:{' '}
                <a href="mailto:privacy@secondturn.games" className="link-brand">
                  privacy@secondturn.games
                </a>
                . Tev ir arī tiesības iesniegt sūdzību Datu valsts inspekcijā.
              </li>
            </ul>
          </CardBody>
        </Card>

        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-semantic-text-heading">
            1. Kas mēs esam
          </h2>
          <p>
            Datu pārzinis ir <strong>{LEGAL_ENTITY_NAME}</strong> („STG”, „mēs”),
            reģistrācijas numurs: {LEGAL_ENTITY_REG_NUMBER}, juridiskā adrese:{' '}
            {LEGAL_ENTITY_ADDRESS}. Šī politika skaidro, kādus datus mēs vācam un kāpēc,
            pamatojoties uz Vispārīgo datu aizsardzības regulu (Regula (ES) 2016/679) un
            Latvijas datu aizsardzības tiesību aktiem.
          </p>
          <p>
            Jautājumiem par datu aizsardzību un pieprasījumiem (piekļuve, eksportēšana,
            dzēšana, iebildumi) raksti uz{' '}
            <a href="mailto:privacy@secondturn.games" className="link-brand">
              privacy@secondturn.games
            </a>
            . Citiem jautājumiem izmanto{' '}
            <a href="mailto:info@secondturn.games" className="link-brand">
              info@secondturn.games
            </a>
            .
          </p>
          <p className="text-xs text-semantic-text-muted">
            Tiesības izmantot platformu (vecums, mītnes valsts) ir noteiktas mūsu{' '}
            <Link href="/terms/lv" className="link-brand">
              Lietošanas noteikumos
            </Link>
            . Ja mēs uzzināsim, ka kontu ir izveidojusi persona, kura nav sasniegusi atļauto
            vecumu, mēs šīs personas datus dzēsīsim.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-semantic-text-heading">
            2. Dati, kurus mēs vācam
          </h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>
              <strong>Konta dati:</strong> e-pasta adrese, lietotājvārds, valsts, tālruņa
              numurs.
            </li>
            <li>
              <strong>Sludinājumu dati:</strong> informācija par spēli, stāvoklis,
              fotoattēli, cena. Atrašanās vietas metadati (EXIF) no augšupielādētajiem
              fotoattēliem tiek noņemti automātiski.
            </li>
            <li>
              <strong>Pasūtījumu dati:</strong> pirkumu vēsture, piegādes adreses (izvēlētie
              pakomāti), pasūtījuma statuss.
            </li>
            <li>
              <strong>Pārdevēja finanšu dati:</strong> maka bilance, transakciju vēsture,
              bankas konta informācija (IBAN) izmaksām.
            </li>
            <li>
              <strong>Maksājumu dati:</strong> tos apstrādā {LEGAL_ENTITY_BANK_NAME}{' '}
              (Latvijas kredītiestāde) un tās tehniskais pakalpojumu sniedzējs{' '}
              {PSP_TECHNICAL_PROVIDER_NAME} (Igaunija, reģ. nr.{' '}
              {PSP_TECHNICAL_PROVIDER_REG_NUMBER}). Sīkāku informāciju par apstrādātājiem
              skati &sect;6. Mēs neuzglabājam karšu datus.
            </li>
            <li>
              <strong>Lietošanas dati:</strong> apmeklētās lapas, pārlūkprogrammas veids, IP
              adrese (drošībai un platformas uzlabošanai).
            </li>
            <li>
              <strong>Krāpniecības novēršanas signāli:</strong> ierīces, uzvedības un
              darījumu signāli, ko izmanto krāpniecības, viltotu sludinājumu un ļaunprātīgas
              izmantošanas atklāšanai.
            </li>
          </ul>
          <p>
            <strong>Kas ir redzams publiski.</strong> Tiklīdz tu izvieto sludinājumu vai
            atstāj atsauksmi, daļa tava profila kļūst redzama ikvienam vietnes apmeklētājam,
            ieskaitot nereģistrētus lietotājus: tavs lietotājvārds, tava valsts (attēlota kā
            karogs), tava profila bilde (ja esi to pievienojis) un konta izveides datums.
            Saņemtās pārdevēja atsauksmes arī ir publiskas un redzamas tavā profilā. Mēs
            neizpaužam tavu e-pasta adresi, tālruņa numuru, pilnu adresi vai maksājumu
            informāciju citiem lietotājiem vai anonīmiem apmeklētājiem.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-semantic-text-heading">
            3. Apstrādes juridiskais pamats
          </h2>
          <p>
            Mēs apstrādājam personas datus saskaņā ar šādiem VDAR 6. panta 1. punkta
            juridiskajiem pamatiem:
          </p>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-semantic-border-subtle">
                  <th className="text-left py-2 pr-4 font-semibold text-semantic-text-heading">
                    Datu kategorija
                  </th>
                  <th className="text-left py-2 font-semibold text-semantic-text-heading">
                    Juridiskais pamats
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-semantic-border-subtle">
                <tr>
                  <td className="py-2 pr-4">Konta dati</td>
                  <td className="py-2">6.(1)(b) — līguma izpilde</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4">Sludinājumu un pasūtījumu dati</td>
                  <td className="py-2">6.(1)(b) — līguma izpilde</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4">Darījumu ieraksti</td>
                  <td className="py-2">
                    6.(1)(b) — līgums + 6.(1)(c) — juridisks pienākums
                    (nodokļi/grāmatvedība)
                  </td>
                </tr>
                <tr>
                  <td className="py-2 pr-4">Pārdevēja finanšu dati</td>
                  <td className="py-2">
                    6.(1)(b) — līgums + 6.(1)(c) — juridisks pienākums
                  </td>
                </tr>
                <tr>
                  <td className="py-2 pr-4">
                    DAC7 pārdevēja identifikācija (NMN, dzimšanas datums, adrese)
                  </td>
                  <td className="py-2">
                    6.(1)(c) — juridisks pienākums (Padomes Direktīva (ES) 2021/514,
                    ziņošana Valsts ieņēmumu dienestam)
                  </td>
                </tr>
                <tr>
                  <td className="py-2 pr-4">Lietošanas un drošības dati</td>
                  <td className="py-2">
                    6.(1)(f) — leģitīmā interese (platformas drošība, pakalpojuma
                    uzlabošana)
                  </td>
                </tr>
                <tr>
                  <td className="py-2 pr-4">Krāpniecības novēršanas signāli</td>
                  <td className="py-2">
                    6.(1)(f) — leģitīmā interese (krāpniecības, viltotu sludinājumu un
                    ļaunprātīgas izmantošanas novēršana)
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-semantic-text-heading">
            4. Kā mēs izmantojam tavus datus
          </h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>Lai nodrošinātu un uzturētu tirgus platformu.</li>
            <li>Lai apstrādātu darījumus un organizētu piegādi.</li>
            <li>Lai sūtītu transakciju e-pastus (pasūtījuma apstiprinājumus, piegādes statusus).</li>
            <li>Lai novērstu krāpniecību un nodrošinātu lietošanas noteikumu ievērošanu.</li>
            <li>Lai uzlabotu platformu, balstoties uz lietošanas tendencēm.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-semantic-text-heading">
            5. Datu glabāšana un drošība
          </h2>
          <p>
            Tavi dati tiek glabāti <strong>Supabase</strong> (mākoņdatubāze Ziemeļeiropas
            reģionā, Stokholmā) ar rindu līmeņa drošības politikām (<em>row-level
            security</em>), kas tiek nodrošinātas datubāzes slānī. Mūsu lietojumprogrammu
            serveri atrodas <strong>Hetzner</strong> datu centrā Helsinkos, Somijā. Dati
            pārsūtīšanas laikā tiek šifrēti ar TLS, bet miera stāvoklī — ar AES-256.
            Fotoattēli tiek glabāti Supabase Storage ar piekļuves kontroli.
          </p>
          <p>
            <strong>Fotoattēlu dzēšana.</strong> Kad sludinājums tiek noņemts — pārdevēja,
            platformas vai konta dzēšanas rezultātā —, saistītie fotoattēli tiek dzēsti no
            Supabase Storage automātiska procesa laikā, kas darbojas ik pēc sešām stundām.
            Fotoattēli netiek saglabāti ilgāk par sludinājuma darbības laiku.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-semantic-text-heading">
            6. Ar ko mēs kopīgojam tavus datus
          </h2>
          <p>
            Mēs kopīgojam tavus datus ar zemāk uzskaitītajām trešajām pusēm tikai tādā
            apjomā, kāds nepieciešams to funkciju veikšanai. Šie partneri iedalās divās
            grupās. Lielākā daļa ir <strong>apstrādātāji</strong>: tie rīkojas saskaņā ar
            mūsu rakstiskiem norādījumiem un datu apstrādes līgumu. Daži ir{' '}
            <strong>neatkarīgi pārziņi</strong> ar savām attiecībām ar tevi un savu
            privātuma politiku — galvenais piemērs ir pieteikšanās nodrošinātāji. Katra
            grupa ir attiecīgi atzīmēta zemāk.
          </p>
          <p>Mēs nepārdodam tavus personas datus un nerādām reklāmas.</p>

          <h3 className={LEGAL_SUB_HEADING_CLASS}>Maksājumi, piegāde un paziņojumi (apstrādātāji)</h3>
          <ul className="list-disc pl-6 space-y-1">
            <li>
              <strong>
                {LEGAL_ENTITY_BANK_NAME} (Latvija, reģ. nr. {LEGAL_ENTITY_BANK_REG_NUMBER}).
              </strong>{' '}
              Maksājumu apstrāde. Saņem pircēja vārdu, e-pastu, summu un transakcijas
              metadatus. Mēs neuzglabājam karšu datus. Karšu dati tiek apstrādāti PCI-DSS
              vidē, ko Swedbank vārdā nodrošina tās tehniskais pakalpojumu sniedzējs
              (skatīt nākamo ierakstu).
            </li>
            <li>
              <strong>
                {PSP_TECHNICAL_PROVIDER_NAME} (Igaunija, reģ. nr.{' '}
                {PSP_TECHNICAL_PROVIDER_REG_NUMBER}).
              </strong>{' '}
              Swedbank piesaistīts tehniskais pakalpojumu sniedzējs saskaņā ar Swedbank
              E-komercijas maksājumu platformas noteikumu &sect;1 un &sect;2.8. Pārvalda
              PCI-DSS sertificētu maksājumu platformu Swedbank vārdā. Saņem tos pašus
              transakciju metadatus, kurus Swedbank tam izpauž saskaņā ar minēto noteikumu
              &sect;10.6.
            </li>
            <li>
              <strong>Unisend SIA.</strong> Pakomātu piegāde starp Baltijas valstīm. Saņem
              sūtītāja un saņēmēja vārdu, tālruņa numuru, e-pasta adresi un izvēlētos
              termināļus.
            </li>
            <li>
              <strong>Resend.</strong> Transakciju e-pastu piegāde (pasūtījuma
              apstiprinājumi, piegādes statusi, izsoļu paziņojumi). Saņem saņēmēja e-pasta
              adresi, lietotājvārdu un e-pasta saturu. Mēs neizmantojam Resend mārketingam.
            </li>
          </ul>

          <h3 className={LEGAL_SUB_HEADING_CLASS}>Pieteikšanās nodrošinātāji (neatkarīgi pārziņi)</h3>
          <p>
            Ja tu piesakies ar Google vai Facebook, nodrošinātājs savā pusē pārbauda tavu
            pieteikšanos un nodod mums tavu apstiprināto e-pastu un profila identifikatoru.
            Nodrošinātājs ir neatkarīgs tavu konta datu pārzinis saskaņā ar savu privātuma
            politiku. Mēs neuzdodam Google vai Meta, kā rīkoties ar viņu lietotāju datiem;
            tie neapstrādā datus mūsu vārdā. Datu nodošana notiek saskaņā ar piekrišanu,
            kuru tu sniedz, izvēloties „Continue with…” pogu.
          </p>
          <ul className="list-disc pl-6 space-y-1">
            <li>
              <strong>Google Ireland Limited</strong> — „Continue with Google” pieteikšanās.
              Reglamentē Google sava privātuma politika.
            </li>
            <li>
              <strong>Meta Platforms Ireland Limited</strong> — „Continue with Facebook”
              pieteikšanās. Reglamentē Meta sava privātuma politika.
            </li>
          </ul>

          <h3 className={LEGAL_SUB_HEADING_CLASS}>Infrastruktūra (apstrādātāji)</h3>
          <ul className="list-disc pl-6 space-y-1">
            <li>
              <strong>Supabase (Supabase Inc., ES reģions).</strong> Mūsu datubāze,
              autentifikācijas pakalpojums un failu krātuve. Glabā konta, sludinājumu,
              pasūtījumu, ziņojumapmaiņas, maka un fotoattēlu datus. Piekļuvi reglamentē
              datubāzes rindu līmeņa drošības politikas.
            </li>
            <li>
              <strong>Hetzner Online GmbH (Helsinki, Somija).</strong> VPS nodrošinātājs,
              kurā darbojas Next.js lietojumprogrammu slānis. Apstrādā katru HTTP
              pieprasījumu vietnei kā tīkla apakšapstrādātājs.
            </li>
            <li>
              <strong>Cloudflare, Inc.</strong> DNS, CDN, reversais starpniekserveris un
              robotu pārvaldības malas pakalpojums vietnei{' '}
              <span className="font-mono">secondturn.games</span>. Apstrādā tavu IP adresi
              un pieprasījuma metadatus, kad tu apmeklē vietni, un izmanto{' '}
              <strong>Cloudflare Turnstile</strong>, lai novērstu automatizētus iesniegumus
              platformā. Sīkdatnes, ko Cloudflare iestata, ir aprakstītas mūsu{' '}
              <Link href="/cookies" className="link-brand">
                Sīkdatņu politikā
              </Link>
              .
            </li>
          </ul>

          <h3 className={LEGAL_SUB_HEADING_CLASS}>Uzraudzība (apstrādātāji)</h3>
          <ul className="list-disc pl-6 space-y-1">
            <li>
              <strong>Sentry (Functional Software, Inc.).</strong> Kļūdu monitorings. Saņem
              kļūdu kaudzes un ierobežotu pārlūkprogrammas kontekstu, kad kaut kas
              neizdodas, lai mēs to varētu novērst. Pirms datu nosūtīšanas no mūsu
              serveriem darbojas PII filtrēšana, un sesiju atskaņošana ir atspējota.
            </li>
            <li>
              <strong>PostHog Cloud (PostHog, Inc., ES reģions Frankfurtē).</strong>{' '}
              Produktu analītika. Darbojas bezsīkdatņu režīmā, tāpēc tā neievieto sīkdatnes
              vai vietējās krātuves elementus tavā pārlūkprogrammā. Notikumi tiek maršrutēti
              caur pirmās puses reverso starpniekserveri mūsu domēnā, kas noņem klienta IP
              galvenes pirms pieprasījuma izejas no mūsu servera, tāpēc PostHog redz mūsu
              servera IP, nevis tavu.
            </li>
          </ul>

          <h3 className={LEGAL_SUB_HEADING_CLASS}>Iestādes un tiesībsargājošās institūcijas</h3>
          <p>
            Kad to pieprasa likums — sankciju pārbaude, noziedzīgi iegūtu līdzekļu
            legalizācijas novēršana, nodokļu atskaites vai konkrēts tiesībsargājošo iestāžu
            pieprasījums —, mēs varam kopīgot konta, transakciju vai identitātes datus ar
            kompetentajām iestādēm. Mūsu jurisdikcijas regulārie saņēmēji ir:
          </p>
          <ul className="list-disc pl-6 space-y-1">
            <li>
              <strong>Valsts ieņēmumu dienests (VID, Latvija)</strong> — DAC7 pārdevēju
              ziņošana (Padomes Direktīva (ES) 2021/514) un citas likumā noteiktās nodokļu
              atskaites.
            </li>
            <li>
              <strong>Finanšu izlūkošanas dienests (FID, Latvija)</strong> — ziņojumi par
              aizdomīgām darbībām saskaņā ar Latvijas NILL likumu.
            </li>
            <li>
              <strong>Valsts drošības dienests (Latvija)</strong> — sankciju un valsts
              drošības pieprasījumi saskaņā ar ES un Latvijas sankciju likumu.
            </li>
            <li>
              <strong>Tiesībsargājošās iestādes</strong> Latvijā, Lietuvā vai Igaunijā,
              pamatojoties uz tiesas nolēmumu vai citu likumīgu pamatu.
            </li>
          </ul>
          <p>
            Izpaušana šīm iestādēm tiek veikta saskaņā ar VDAR 6. panta 1. punkta
            c) apakšpunktu — juridisks pienākums. Apstākļi, kuros izmaksa var tikt aizkavēta
            vai maks iesaldēts šādas izpaušanas rezultātā, ir aprakstīti{' '}
            <Link href="/seller-terms/lv" className="link-brand">
              Pārdevēja līguma
            </Link>{' '}
            7. sadaļā.
          </p>

          <h3 className={LEGAL_SUB_HEADING_CLASS}>Ārējie savienojumi, ko veido tava pārlūkprogramma</h3>
          <p>
            Kad tu apskati sludinājumu, tava pārlūkprogramma ielādē vāka attēlu tieši no
            BoardGameGeek (BGG) CDN (<span className="font-mono">cf.geekdo-images.com</span>).
            BGG ir vieta, no kuras nāk lielākā daļa mūsu spēļu datu, un to CDN reģistrē tavu
            IP tāpat kā jebkura cita vietne, ko apmeklē. BGG nav mūsu apstrādātājs; mēs
            tiem nenosūtam tavus konta datus. Taču attēla ielāde ir tiešs
            pārlūkprogrammas-BGG savienojums, tāpēc to ir vērts zināt. Mūsu
            servera-uz-serveri zvani BGG, lai iegūtu spēļu metadatus, nekad neatklāj tavu
            IP.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-semantic-text-heading">
            7. Sīkdatnes un vietējā krātuve
          </h2>
          <p>
            Mēs izmantojam tikai stingri nepieciešamās sīkdatnes un nelielu skaitu
            preferenču elementu tavas pārlūkprogrammas vietējā vai sesijas krātuvē. Mēs
            neizmantojam reklāmas vai starpvietņu izsekošanas sīkdatnes.
          </p>
          <p>
            <Link href="/cookies" className="link-brand">
              Sīkdatņu politikā
            </Link>{' '}
            ir uzskaitīta katra sīkdatne un krātuves elements, ko mēs iestatām, tostarp tā
            precīzs nosaukums, mērķis, ilgums un veids (stingri nepieciešama vai
            preference). Analītikai mēs izmantojam rīkus, kas konfigurēti bezsīkdatņu
            režīmā un neiestata sīkdatnes tavā pārlūkprogrammā.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-semantic-text-heading">
            8. Tavas tiesības saskaņā ar VDAR
          </h2>
          <p>Tev ir tiesības:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Piekļūt saviem personas datiem (15. pants).</li>
            <li>Labot neprecīzus datus (16. pants).</li>
            <li>Dzēst savus datus, ievērojot likumā noteiktos glabāšanas termiņus (17. pants).</li>
            <li>Pārnest datus uz citu pakalpojumu mašīnlasāmā formātā (20. pants).</li>
            <li>Iebilst pret apstrādi, kuras pamatā ir leģitīmās intereses (21. pants).</li>
            <li>Ierobežot apstrādi noteiktos apstākļos (18. pants).</li>
            <li>
              Iesniegt sūdzību uzraudzības iestādē (77. pants) — Latvijas iestādi un tās
              kontaktinformāciju skati 12. sadaļā.
            </li>
          </ul>
          <p>
            Mēs atbildēsim uz visiem tiesību pieprasījumiem 30 dienu laikā. Lai piekļūtu,
            eksportētu vai dzēstu savus datus, dodies uz sava{' '}
            <Link href="/account/settings" className="link-brand">
              konta iestatījumiem
            </Link>
            . Citiem pieprasījumiem sazinies ar mums uz{' '}
            <a href="mailto:info@secondturn.games" className="link-brand">
              info@secondturn.games
            </a>
            .
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-semantic-text-heading">
            9. Datu glabāšana
          </h2>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-semantic-border-subtle">
                  <th className="text-left py-2 pr-4 font-semibold text-semantic-text-heading">
                    Datu veids
                  </th>
                  <th className="text-left py-2 font-semibold text-semantic-text-heading">
                    Glabāšanas periods
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-semantic-border-subtle">
                <tr>
                  <td className="py-2 pr-4">Konta profils (vārds, e-pasts, tālrunis)</td>
                  <td className="py-2">
                    Anonimizē brīdī, kad dzēs savu kontu. Atjaunošanas perioda nav — konta
                    dzēšana ir tūlītēja un galīga.
                  </td>
                </tr>
                <tr>
                  <td className="py-2 pr-4">Aktīvo sludinājumu dati un fotoattēli</td>
                  <td className="py-2">
                    Līdz sludinājuma noņemšanai vai konta dzēšanai. Fotoattēli tiek dzēsti
                    no Supabase Storage sešu stundu laikā pēc sludinājuma noņemšanas.
                  </td>
                </tr>
                <tr>
                  <td className="py-2 pr-4">Pabeigti pasūtījumi, rēķini un darījumu ieraksti</td>
                  <td className="py-2">
                    5 gadi no darījuma kalendārā gada beigām saskaņā ar Latvijas Pievienotās
                    vērtības nodokļa likuma 133. pantu komisijas rēķiniem un Latvijas
                    Grāmatvedības likuma 10. pantu grāmatvedības avota dokumentiem. Šie
                    ieraksti tiek glabāti pat pēc tava konta dzēšanas — tie ir atbrīvoti no
                    dzēšanas pieprasījumiem saskaņā ar VDAR 17. panta 3. punkta b)
                    apakšpunktu.
                  </td>
                </tr>
                <tr>
                  <td className="py-2 pr-4">Gada finanšu pārskati un atbalstošā uzskaite</td>
                  <td className="py-2">
                    10 gadi saskaņā ar Grāmatvedības likuma 10. pantu. Tie ir uzņēmuma
                    līmeņa ieraksti, kas parasti nesatur personas datus, bet ir uzskaitīti
                    šeit pilnībai.
                  </td>
                </tr>
                <tr>
                  <td className="py-2 pr-4">
                    DAC7 pārdevēju dati (NMN, dzimšanas datums, adrese, ziņotās summas)
                  </td>
                  <td className="py-2">
                    10 gadi no ziņojuma kalendārā gada beigām, kā noteikts Padomes
                    Direktīvas 2011/16/ES 25. pantā, kas grozīts ar Padomes Direktīvu (ES)
                    2021/514. Attiecas tikai uz pārdevējiem, kuri sasniedz DAC7 ziņošanas
                    sliekšņus. Šī ir atsevišķa un ilgāka saistība nekā iepriekšminētā
                    grāmatvedības ierakstu glabāšana.
                  </td>
                </tr>
                <tr>
                  <td className="py-2 pr-4">Tavas rakstītās un saņemtās atsauksmes</td>
                  <td className="py-2">
                    Saglabājas pie pārskatītā pārdevēja profila beztermiņa. Kad tu dzēs savu
                    kontu, tavas rakstītās atsauksmes tiek anonimizētas, nevis noņemtas,
                    lai saglabātu pārdevēja reputācijas vēsturi.
                  </td>
                </tr>
                <tr>
                  <td className="py-2 pr-4">Sludinājumu komentāri un pasūtījumu ziņas</td>
                  <td className="py-2">
                    Anonimizē brīdī, kad dzēs savu kontu (saturs aizstāts ar „[deleted]”);
                    pretējā gadījumā tiek glabāti sludinājuma vai pasūtījuma darbības laiku.
                  </td>
                </tr>
                <tr>
                  <td className="py-2 pr-4">Drošības logfaili (IP, pieteikšanās aktivitāte)</td>
                  <td className="py-2">30 dienas</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p>
            Tu vari pieprasīt sava konta dzēšanu jebkurā laikā konta iestatījumos. Iepriekš
            uzskaitītie ieraksti, uz kuriem attiecas juridiskā pienākuma glabāšana, tiks
            turpināti glabāt likumā prasīto periodu, taču tavs profils, tiešie identifikatori
            un netransakcionālais saturs tiek noņemts vai anonimizēts nekavējoties.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-semantic-text-heading">
            10. Paziņošana par datu aizsardzības pārkāpumiem
          </h2>
          <p>
            Ja datu aizsardzības pārkāpums rada risku tavām tiesībām, mēs 72 stundu laikā
            paziņosim par to uzraudzības iestādei saskaņā ar VDAR 33. pantu. Ja risks tev
            ir augsts, mēs informēsim arī tevi personīgi.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-semantic-text-heading">
            11. Bērnu dati
          </h2>
          <p>
            <Link href="/terms/lv" className="link-brand">
              Lietošanas noteikumi
            </Link>{' '}
            nosaka vecuma ierobežojumus platformas izmantošanai un pārdošanai. Ja kontu ir
            izveidojusi persona, kura nav sasniegusi minimālo vecumu, sazinies ar mums, un
            mēs šīs personas datus dzēsīsim.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-semantic-text-heading">
            12. Uzraudzības iestāde
          </h2>
          <p>
            Ja uzskati, ka tavas datu aizsardzības tiesības ir pārkāptas, tu vari iesniegt
            sūdzību <strong>Datu valsts inspekcijā (DVI)</strong>:{' '}
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
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-semantic-text-heading">
            13. Izmaiņas politikā
          </h2>
          <p>
            Mēs varam atjaunināt šo politiku. Par būtiskām izmaiņām reģistrētie lietotāji
            tiks informēti e-pastā.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-semantic-text-heading">
            14. Valoda
          </h2>
          <p>
            Šīs politikas tulkojumi citās valodās var tikt nodrošināti tavām ērtībām. Angļu
            valodas versija ir autoritatīvā oriģinālversija. Jebkādu pretrunu gadījumā
            starp angļu valodas versiju un kādu tulkojumu noteicošā ir angļu valodas
            versija.
          </p>
        </section>

        <p className="text-sm text-semantic-text-muted pt-4 border-t border-semantic-border-subtle">
          Skatīt arī mūsu{' '}
          <Link href="/terms/lv" className="link-brand">
            Lietošanas noteikumus
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
