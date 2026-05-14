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

export default function PrivacyLt() {
  return (
    <>
      <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-semantic-text-heading mb-6">
        Privatumo politika
      </h1>

      <div className="prose prose-sm max-w-none text-semantic-text-secondary space-y-6">
        <p className="text-semantic-text-secondary">
          Paskutinį kartą atnaujinta: 2026 m. gegužės 13 d.
        </p>

        <Card className="not-prose">
          <CardHeader>
            <h2 className="text-base font-semibold text-semantic-text-heading">
              Trumpa apžvalga
            </h2>
            <p className="text-xs text-semantic-text-muted mt-0.5">
              Versija paprasta kalba. Norėdami susipažinti su visomis taisyklėmis, skaitykite toliau.
            </p>
          </CardHeader>
          <CardBody>
            <ul className="list-disc pl-5 space-y-2 text-sm text-semantic-text-secondary">
              <li>
                Mes renkame tik tuos duomenis, kurie yra būtini prekyvietės veiklai: Jūsų
                paskyros informaciją, duomenis apie tai, ką perkate ir parduodate, bei įrašus,
                kuriuos saugoti mus įpareigoja mokesčių institucijos.
              </li>
              <li>
                Mes niekada neparduodame Jūsų duomenų. Visi partneriai, su kuriais dalijamės
                duomenimis, yra išvardyti 6 skyriuje, sugrupuoti pagal jų atliekamas funkcijas.
              </li>
              <li>
                Mūsų analitikos įrankiai veikia be slapukų (<em>cookieless</em>) režimu, jie
                neseka Jūsų kitose svetainėse ir nemato Jūsų IP adreso. Mes nerodome reklamų.
              </li>
              <li>
                Jūs galite bet kada pasiekti, eksportuoti arba ištrinti savo paskyrą paskyros
                nustatymuose. Ištrynimas yra momentinis — Jūsų profilis anonimizuojamas per
                kelias sekundes.
              </li>
              <li>
                Kai kuriuos įrašus (užsakymus, sąskaitas faktūras, DAC7 pardavėjų duomenis)
                saugome iki 10 metų, nes to reikalauja Latvijos įstatymai. Visi kiti duomenys
                pašalinami, kai ištrinate paskyrą.
              </li>
              <li>
                Klausimus ir prašymus dėl duomenų apsaugos siųskite adresu:{' '}
                <a href="mailto:privacy@secondturn.games" className="link-brand">
                  privacy@secondturn.games
                </a>
                . Taip pat galite pateikti skundą Latvijos valstybinei duomenų inspekcijai.
              </li>
            </ul>
          </CardBody>
        </Card>

        <section className="space-y-3">
          <h2 className={SECTION_HEADING_CLASS}>
            1. Kas mes esame
          </h2>
          <p>
            Duomenų valdytojas yra <strong>{LEGAL_ENTITY_NAME}</strong> („STG”, „mes”),
            registracijos numeris {LEGAL_ENTITY_REG_NUMBER}, registracijos adresas:{' '}
            {LEGAL_ENTITY_ADDRESS}. Ši politika paaiškina, kokius duomenis renkame ir kodėl,
            vadovaujantis Bendruoju duomenų apsaugos reglamentu (Reglamentas (ES) 2016/679) ir
            Latvijos duomenų apsaugos įstatymais.
          </p>
          <p>
            Klausimais ir prašymais dėl duomenų apsaugos (prieiga, eksportavimas, ištrynimas,
            prieštaravimas) rašykite adresu{' '}
            <a href="mailto:privacy@secondturn.games" className="link-brand">
              privacy@secondturn.games
            </a>
            . Visais kitais klausimais naudokite{' '}
            <a href="mailto:info@secondturn.games" className="link-brand">
              info@secondturn.games
            </a>
            .
          </p>
          <p className="text-xs text-semantic-text-muted">
            Teisė naudotis platforma (amžius, gyvenamoji šalis) nustatyta mūsų{' '}
            <Link href="/terms/lt" className="link-brand">
              Paslaugų teikimo sąlygose
            </Link>
            . Jei sužinosime, kad paskyrą turi asmuo, nesulaukęs leistino amžiaus, jo duomenis
            ištrinsime.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className={SECTION_HEADING_CLASS}>
            2. Renkami duomenys
          </h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>
              <strong>Paskyros duomenys:</strong> el. pašto adresas, rodomas vardas, šalis,
              telefono numeris.
            </li>
            <li>
              <strong>Skelbimų duomenys:</strong> informacija apie žaidimą, būklė, nuotraukos,
              kaina. Vietovės metaduomenys (EXIF) automatiškai pašalinami iš įkeltų nuotraukų.
            </li>
            <li>
              <strong>Užsakymų duomenys:</strong> pirkimų istorija, pristatymo adresai
              (pasirinkti paštomatai), užsakymo būsena.
            </li>
            <li>
              <strong>Pardavėjo finansiniai duomenys:</strong> piniginės likutis, operacijų
              istorija, banko sąskaitos rekvizitai (IBAN) lėšų išėmimui.
            </li>
            <li>
              <strong>Mokėjimų duomenys:</strong> juos apdoroja {LEGAL_ENTITY_BANK_NAME}{' '}
              (Latvijos kredito įstaiga) ir jos techninis teikėjas{' '}
              {PSP_TECHNICAL_PROVIDER_NAME} (Estija, reg. nr.{' '}
              {PSP_TECHNICAL_PROVIDER_REG_NUMBER}). Išsamią informaciją apie tvarkytojus
              rasite &sect;6. Mes nesaugome kortelių duomenų.
            </li>
            <li>
              <strong>Naudojimo duomenys:</strong> lankomi puslapiai, naršyklės tipas, IP
              adresas (saugumo tikslais ir platformos tobulinimui).
            </li>
            <li>
              <strong>Sukčiavimo prevencijos signalai:</strong> įrenginio, elgsenos ir
              operacijų signalai, naudojami sukčiavimui, padirbtiems skelbimams ir
              piktnaudžiavimui nustatyti.
            </li>
          </ul>
          <p>
            <strong>Viešai matoma informacija.</strong> Kai tik paskelbiate žaidimą arba
            paliekate atsiliepimą, dalis Jūsų profilio tampa matoma bet kuriam svetainės
            lankytojui, įskaitant neprisijungusius asmenis: Jūsų rodomas vardas, šalis
            (pavaizduota vėliava), profilio nuotrauka (jei ją įkėlėte) ir paskyros sukūrimo
            data. Jūsų gauti pardavėjo atsiliepimai taip pat yra vieši ir rodomi Jūsų profilyje.
            Mes neatskleidžiame Jūsų el. pašto adreso, telefono numerio, tikslaus adreso ar
            bet kokios mokėjimo informacijos kitiems naudotojams ar anoniminiams lankytojams.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className={SECTION_HEADING_CLASS}>
            3. Teisinis duomenų tvarkymo pagrindas
          </h2>
          <p>
            Mes tvarkome asmens duomenis vadovaudamiesi šiais BDAR 6 straipsnio 1 dalies
            teisiniais pagrindais:
          </p>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-semantic-border-subtle">
                  <th className="text-left py-2 pr-4 font-semibold text-semantic-text-heading">
                    Duomenų kategorija
                  </th>
                  <th className="text-left py-2 font-semibold text-semantic-text-heading">
                    Teisinis pagrindas
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-semantic-border-subtle">
                <tr>
                  <td className="py-2 pr-4">Paskyros duomenys</td>
                  <td className="py-2">6(1)(b) — sutarties vykdymas</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4">Skelbimų ir užsakymų duomenys</td>
                  <td className="py-2">6(1)(b) — sutarties vykdymas</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4">Operacijų įrašai</td>
                  <td className="py-2">
                    6(1)(b) — sutartis + 6(1)(c) — teisinė prievolė (mokesčiai/apskaita)
                  </td>
                </tr>
                <tr>
                  <td className="py-2 pr-4">Pardavėjo finansiniai duomenys</td>
                  <td className="py-2">
                    6(1)(b) — sutartis + 6(1)(c) — teisinė prievolė
                  </td>
                </tr>
                <tr>
                  <td className="py-2 pr-4">
                    DAC7 pardavėjo identifikacija (MMK, gimimo data, adresas)
                  </td>
                  <td className="py-2">
                    6(1)(c) — teisinė prievolė (Tarybos direktyva (ES) 2021/514, ataskaitų
                    teikimas Latvijos valstybinei mokesčių inspekcijai)
                  </td>
                </tr>
                <tr>
                  <td className="py-2 pr-4">Naudojimo ir saugumo duomenys</td>
                  <td className="py-2">
                    6(1)(f) — teisėtas interesas (platformos saugumas, paslaugų tobulinimas)
                  </td>
                </tr>
                <tr>
                  <td className="py-2 pr-4">Sukčiavimo prevencijos signalai</td>
                  <td className="py-2">
                    6(1)(f) — teisėtas interesas (sukčiavimo, padirbtų skelbimų ir
                    piktnaudžiavimo prevencija)
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className={SECTION_HEADING_CLASS}>
            4. Kaip naudojame Jūsų duomenis
          </h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>Prekyvietės veiklai užtikrinti ir valdyti.</li>
            <li>Operacijoms apdoroti ir siuntimui organizuoti.</li>
            <li>Sisteminiams el. laiškams siųsti (užsakymų patvirtinimai, siuntimo naujiniai).</li>
            <li>Sukčiavimo prevencijai ir naudojimosi sąlygų laikymosi užtikrinimui.</li>
            <li>Platformai tobulinti remiantis naudojimo tendencijomis.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className={SECTION_HEADING_CLASS}>
            5. Duomenų saugojimas ir saugumas
          </h2>
          <p>
            Jūsų duomenys saugomi <strong>Supabase</strong> (debesijos duomenų bazė Šiaurės
            Europos regione, Stokholme), taikant eilučių lygio saugumo politikas (<em>row-level
            security</em>), kurios vykdomos duomenų bazės sluoksnyje. Mūsų programų serveriai
            veikia <strong>Hetzner</strong> duomenų centre Helsinkyje, Suomijoje. Duomenys
            perdavimo metu šifruojami TLS, o saugojimo metu — AES-256. Nuotraukos saugomos
            Supabase Storage su prieigos kontrole.
          </p>
          <p>
            <strong>Nuotraukų valymas.</strong> Kai skelbimas pašalinamas — pardavėjo,
            platformos arba ištrynus paskyrą — susijusios nuotraukos pašalinamos iš Supabase
            Storage automatinio valymo proceso metu, kuris vyksta kas šešias valandas.
            Nuotraukos nesaugomos ilgiau nei egzistuoja skelbimas, kuriam jos priklauso.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className={SECTION_HEADING_CLASS}>
            6. Su kuo dalijamės Jūsų duomenimis
          </h2>
          <p>
            Jūsų duomenimis dalijamės su toliau išvardytomis trečiosiomis šalimis tik tiek,
            kiek tai būtina jų funkcijoms atlikti. Šie partneriai skirstomi į dvi grupes.
            Dauguma yra <strong>tvarkytojai</strong>: jie veikia pagal mūsų rašytinius
            nurodymus ir duomenų tvarkymo sutartį. Keletas yra{' '}
            <strong>nepriklausomi valdytojai</strong> su savo santykiu su Jumis ir savo
            privatumo politika — pagrindinis pavyzdys yra prisijungimo paslaugų teikėjai.
            Kiekviena grupė yra atitinkamai pažymėta toliau.
          </p>
          <p>Mes neparduodame Jūsų asmens duomenų ir nerodome reklamų.</p>

          <h3 className={LEGAL_SUB_HEADING_CLASS}>Mokėjimai, siuntimas ir pranešimai (tvarkytojai)</h3>
          <ul className="list-disc pl-6 space-y-1">
            <li>
              <strong>
                {LEGAL_ENTITY_BANK_NAME} (Latvija, reg. nr. {LEGAL_ENTITY_BANK_REG_NUMBER}).
              </strong>{' '}
              Mokėjimų apdorojimas. Gauna pirkėjo vardą, el. paštą, sumą ir operacijos
              metaduomenis. Mes nesaugome kortelių duomenų. Kortelių duomenys apdorojami
              PCI-DSS aplinkoje, kurią Swedbank vardu valdo jo techninis teikėjas (žr. kitą
              įrašą).
            </li>
            <li>
              <strong>
                {PSP_TECHNICAL_PROVIDER_NAME} (Estija, reg. nr.{' '}
                {PSP_TECHNICAL_PROVIDER_REG_NUMBER}).
              </strong>{' '}
              Swedbank pasitelktas techninis teikėjas pagal Swedbank elektroninės komercijos
              mokėjimų platformos sąlygų &sect;1 ir &sect;2.8 punktus. Valdo PCI-DSS
              sertifikuotą mokėjimų platformą Swedbank vardu. Gauna tuos pačius operacijos
              metaduomenis, kuriuos Swedbank jam atskleidžia pagal minėtų sąlygų &sect;10.6
              punktą.
            </li>
            <li>
              <strong>Unisend SIA.</strong> Siuntimas paštomatais Baltijos šalyse. Gauna
              siuntėjo ir gavėjo vardus, telefonų numerius, el. pašto adresus ir pasirinktus
              terminalus.
            </li>
            <li>
              <strong>Resend.</strong> Transakcinių el. laiškų siuntimas (užsakymų
              patvirtinimai, siuntimo naujiniai, aukcionų pranešimai). Gauna gavėjo el. pašto
              adresą, rodomą vardą ir laiško turinį. Nenaudojame Resend rinkodarai.
            </li>
          </ul>

          <h3 className={LEGAL_SUB_HEADING_CLASS}>Prisijungimo paslaugų teikėjai (nepriklausomi valdytojai)</h3>
          <p>
            Jei jungiatės per Google arba Facebook, teikėjas savo pusėje patikrina Jūsų
            prisijungimą ir perduoda mums Jūsų patvirtintą el. paštą bei profilio
            identifikatorių. Teikėjas yra nepriklausomas Jūsų paskyros duomenų valdytojas
            pagal savo privatumo politiką. Mes nenurodome Google ar Meta, kaip elgtis su jų
            vartotojų duomenimis; jie netvarko duomenų mūsų vardu. Duomenų perdavimas vyksta
            pagal Jūsų sutikimą, kurį suteikiate paspausdami „Continue with…” mygtuką.
          </p>
          <ul className="list-disc pl-6 space-y-1">
            <li>
              <strong>Google Ireland Limited</strong> — „Continue with Google” prisijungimas.
              Reglamentuojama Google privatumo politikos.
            </li>
            <li>
              <strong>Meta Platforms Ireland Limited</strong> — „Continue with Facebook”
              prisijungimas. Reglamentuojama Meta privatumo politikos.
            </li>
          </ul>

          <h3 className={LEGAL_SUB_HEADING_CLASS}>Infrastruktūra (tvarkytojai)</h3>
          <ul className="list-disc pl-6 space-y-1">
            <li>
              <strong>Supabase (Supabase Inc., ES regionas).</strong> Mūsų duomenų bazė,
              autentifikavimo teikėjas ir failų saugykla. Saugo paskyros, skelbimų, užsakymų,
              žinučių, piniginės ir nuotraukų duomenis. Prieiga reglamentuojama duomenų bazės
              eilučių lygio saugumo politikomis.
            </li>
            <li>
              <strong>Hetzner Online GmbH (Helsinkis, Suomija).</strong> VPS teikėjas, kuriame
              veikia Next.js programos sluoksnis. Apdoroja kiekvieną HTTP užklausą svetainei
              kaip tinklo subtvarkytojas.
            </li>
            <li>
              <strong>Cloudflare, Inc.</strong> DNS, CDN, atvirkštinis tarpinis serveris ir
              botų valdymo kraštinė paslauga svetainei{' '}
              <span className="font-mono">secondturn.games</span>. Apdoroja Jūsų IP adresą ir
              užklausos metaduomenis, kai apsilankote svetainėje, ir naudoja{' '}
              <strong>Cloudflare Turnstile</strong>, kad išvengtų automatizuotų pateikimų
              platformoje. Cloudflare nustatomi slapukai aprašyti mūsų{' '}
              <Link href="/cookies" className="link-brand">
                Slapukų politikoje
              </Link>
              .
            </li>
          </ul>

          <h3 className={LEGAL_SUB_HEADING_CLASS}>Stebėjimas (tvarkytojai)</h3>
          <ul className="list-disc pl-6 space-y-1">
            <li>
              <strong>Sentry (Functional Software, Inc.).</strong> Klaidų stebėjimas. Gauna
              kamienus ir ribotą naršyklės kontekstą, kai kas nors sugenda, kad galėtume tai
              ištaisyti. Prieš įvykiams paliekant mūsų serverius vykdomas PII filtravimas, o
              sesijos atkartojimas yra išjungtas.
            </li>
            <li>
              <strong>PostHog Cloud (PostHog, Inc., ES regionas Frankfurte).</strong> Produkto
              analitika. Veikia be slapukų režimu, todėl neįdeda slapukų ar vietinės saugyklos
              elementų į Jūsų naršyklę. Įvykiai maršrutizuojami per pirmosios šalies
              atvirkštinį tarpinį serverį mūsų domene, kuris pašalina kliento IP antraštes
              prieš užklausai paliekant mūsų serverį, todėl PostHog mato mūsų serverio IP, o
              ne Jūsų.
            </li>
          </ul>

          <h3 className={LEGAL_SUB_HEADING_CLASS}>Institucijos ir teisėsaugos institucijos</h3>
          <p>
            Kai to reikalauja įstatymai — sankcijų tikrinimas, pinigų plovimo prevencija,
            mokesčių ataskaitos ar konkreti teisėsaugos institucijų užklausa — galime dalytis
            paskyros, operacijų ar tapatybės duomenimis su kompetentingomis institucijomis.
            Mūsų jurisdikcijoje įprasti gavėjai yra:
          </p>
          <ul className="list-disc pl-6 space-y-1">
            <li>
              <strong>Valstybinė mokesčių inspekcija (VID, Latvija)</strong> — DAC7 pardavėjų
              ataskaitos (Tarybos direktyva (ES) 2021/514) ir kiti įstatymų nustatyti
              mokestiniai atskleidimai.
            </li>
            <li>
              <strong>Finansinės žvalgybos tarnyba (FID, Latvija)</strong> — pranešimai apie
              įtartiną veiklą pagal Latvijos pinigų plovimo prevencijos įstatymą.
            </li>
            <li>
              <strong>Valstybės saugumo tarnyba (Latvija)</strong> — sankcijų ir nacionalinio
              saugumo užklausos pagal ES ir Latvijos sankcijų teisę.
            </li>
            <li>
              <strong>Teisėsaugos institucijos</strong> Latvijoje, Lietuvoje ar Estijoje,
              gavus teismo nutartį ar kitą teisėtą pagrindą.
            </li>
          </ul>
          <p>
            Šioms institucijoms duomenys atskleidžiami pagal BDAR 6(1)(c) — teisinę prievolę.
            Aplinkybės, kuriomis dėl tokio atskleidimo gali būti atidėta išmoka arba įšaldyta
            piniginė, yra aprašytos{' '}
            <Link href="/seller-terms/lt" className="link-brand">
              Pardavėjo sutarties
            </Link>{' '}
            7 skyriuje.
          </p>

          <h3 className={LEGAL_SUB_HEADING_CLASS}>Išorinės jungtys, kurias atlieka Jūsų naršyklė</h3>
          <p>
            Kai žiūrite skelbimą, Jūsų naršyklė tiesiogiai įkelia viršelio nuotrauką iš
            BoardGameGeek (BGG) CDN (<span className="font-mono">cf.geekdo-images.com</span>).
            BGG yra vieta, iš kurios gauname daugumą savo žaidimų duomenų, ir jų CDN užfiksuoja
            Jūsų IP adresą kaip ir bet kuri kita Jūsų lankoma svetainė. BGG nėra mūsų
            tvarkytojas; mes jiems nesiunčiame Jūsų paskyros duomenų. Tačiau nuotraukos
            įkėlimas yra tiesioginis naršyklės-BGG ryšys, todėl verta tai žinoti. Mūsų
            serverio-į-serverį skambučiai BGG dėl žaidimų metaduomenų niekada neatskleidžia
            Jūsų IP.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className={SECTION_HEADING_CLASS}>
            7. Slapukai ir vietinė saugykla
          </h2>
          <p>
            Naudojame tik griežtai būtinus slapukus ir nedidelį kiekį nustatymų elementų Jūsų
            naršyklės vietinėje arba sesijos saugykloje. Nenaudojame reklamos ar tarpkampinio
            sekimo slapukų.
          </p>
          <p>
            <Link href="/cookies" className="link-brand">
              Slapukų politikoje
            </Link>{' '}
            išvardyti visi slapukai ir saugyklos elementai, kuriuos nustatome, įskaitant
            tikslų jų pavadinimą, paskirtį, trukmę ir tipą (griežtai būtinas arba nustatymas).
            Analitikai naudojame įrankius, sukonfigūruotus be slapukų režimu, kurie nenustato
            slapukų Jūsų naršyklėje.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className={SECTION_HEADING_CLASS}>
            8. Jūsų teisės pagal BDAR
          </h2>
          <p>Jūs turite teisę:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Susipažinti su savo asmens duomenimis (15 straipsnis).</li>
            <li>Reikalauti ištaisyti netikslius duomenis (16 straipsnis).</li>
            <li>Ištrinti savo duomenis, atsižvelgiant į teisinius saugojimo reikalavimus (17 straipsnis).</li>
            <li>Perkelti duomenis kitam paslaugų teikėjui mašininiu skaitomu formatu (20 straipsnis).</li>
            <li>Nesutikti su duomenų tvarkymu, kai jis grindžiamas teisėtu interesu (21 straipsnis).</li>
            <li>Apriboti duomenų tvarkymą tam tikromis aplinkybėmis (18 straipsnis).</li>
            <li>
              Pateikti skundą priežiūros institucijai (77 straipsnis) — Latvijos institucija
              ir jos kontaktiniai duomenys nurodyti 12 skyriuje.
            </li>
          </ul>
          <p>
            Atsakysime į visas teisių užklausas per 30 dienų. Norėdami pasiekti, eksportuoti
            ar ištrinti savo duomenis, apsilankykite{' '}
            <Link href="/account/settings" className="link-brand">
              paskyros nustatymuose
            </Link>
            . Kitais klausimais susisiekite su mumis adresu{' '}
            <a href="mailto:info@secondturn.games" className="link-brand">
              info@secondturn.games
            </a>
            .
          </p>
        </section>

        <section className="space-y-3">
          <h2 className={SECTION_HEADING_CLASS}>
            9. Duomenų saugojimas
          </h2>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-semantic-border-subtle">
                  <th className="text-left py-2 pr-4 font-semibold text-semantic-text-heading">
                    Duomenų tipas
                  </th>
                  <th className="text-left py-2 font-semibold text-semantic-text-heading">
                    Saugojimo laikotarpis
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-semantic-border-subtle">
                <tr>
                  <td className="py-2 pr-4">Paskyros profilis (vardas, el. paštas, telefonas)</td>
                  <td className="py-2">
                    Anonimizuojamas iškart ištrynus paskyrą. Atstatymo laikotarpio nėra —
                    paskyros ištrynimas yra momentinis ir galutinis.
                  </td>
                </tr>
                <tr>
                  <td className="py-2 pr-4">Aktyvių skelbimų duomenys ir nuotraukos</td>
                  <td className="py-2">
                    Iki skelbimo pašalinimo arba paskyros ištrynimo. Nuotraukos pašalinamos
                    iš Supabase Storage per šešias valandas po skelbimo pašalinimo.
                  </td>
                </tr>
                <tr>
                  <td className="py-2 pr-4">Užbaigti užsakymai, sąskaitos faktūros ir operacijų įrašai</td>
                  <td className="py-2">
                    5 metai nuo operacijos kalendorinių metų pabaigos pagal Latvijos
                    pridėtinės vertės mokesčio įstatymo (Pievienotās vērtības nodokļa likums)
                    133 straipsnį komisinių sąskaitoms ir Latvijos apskaitos įstatymo
                    (Grāmatvedības likums) 10 straipsnį apskaitos pirminiams dokumentams. Šie
                    įrašai saugomi net ir ištrynus paskyrą — jie nepriklauso ištrynimo
                    prašymams pagal BDAR 17 straipsnio 3 dalies b punktą.
                  </td>
                </tr>
                <tr>
                  <td className="py-2 pr-4">Metinės finansinės ataskaitos ir pagalbinė apskaita</td>
                  <td className="py-2">
                    10 metų pagal Grāmatvedības likums 10 straipsnį. Tai įmonės lygio įrašai,
                    kuriuose paprastai nėra asmens duomenų, tačiau jie čia išvardyti pilnumo
                    dėlei.
                  </td>
                </tr>
                <tr>
                  <td className="py-2 pr-4">
                    DAC7 pardavėjų duomenys (MMK, gimimo data, adresas, ataskaitose pateiktos sumos)
                  </td>
                  <td className="py-2">
                    10 metų nuo ataskaitinio kalendorinio gimimo pabaigos, kaip nustatyta
                    Tarybos direktyvos 2011/16/ES 25 straipsnyje, iš dalies pakeistame Tarybos
                    direktyva (ES) 2021/514. Taikoma tik pardavėjams, pasiekiantiems DAC7
                    ataskaitų teikimo ribas. Tai atskira ir ilgesnė prievolė nei aukščiau
                    nurodytas apskaitos įrašų saugojimas.
                  </td>
                </tr>
                <tr>
                  <td className="py-2 pr-4">Jūsų parašyti ir gauti atsiliepimai</td>
                  <td className="py-2">
                    Saugomi peržiūrėto pardavėjo profilyje neribotą laiką. Kai ištrinate
                    paskyrą, Jūsų parašyti atsiliepimai anonimizuojami, o ne pašalinami, kad
                    išliktų pardavėjo reputacijos istorija.
                  </td>
                </tr>
                <tr>
                  <td className="py-2 pr-4">Skelbimų komentarai ir užsakymų žinutės</td>
                  <td className="py-2">
                    Anonimizuojami iškart ištrynus paskyrą (turinys pakeičiamas „[deleted]”);
                    kitu atveju saugomi skelbimo ar užsakymo galiojimo metu.
                  </td>
                </tr>
                <tr>
                  <td className="py-2 pr-4">Saugumo logai (IP, prisijungimo aktyvumas)</td>
                  <td className="py-2">30 dienų</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p>
            Galite bet kada paprašyti ištrinti savo paskyrą paskyros nustatymuose. Aukščiau
            išvardyti įrašai, kuriems taikomas teisinės prievolės saugojimas, bus toliau
            saugomi įstatymo reikalaujamą laikotarpį, tačiau Jūsų profilis, tiesioginiai
            identifikatoriai ir netransakcinis turinys bus pašalinti arba anonimizuoti
            nedelsiant.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className={SECTION_HEADING_CLASS}>
            10. Pranešimas apie duomenų saugumo pažeidimą
          </h2>
          <p>
            Jei duomenų saugumo pažeidimas sukels pavojų Jūsų teisėms, per 72 valandas
            pranešime apie tai priežiūros institucijai pagal BDAR 33 straipsnį. Jei rizika
            Jums bus didelė, informuosime ir Jus tiesiogiai.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className={SECTION_HEADING_CLASS}>
            11. Vaikų duomenys
          </h2>
          <p>
            <Link href="/terms/lt" className="link-brand">
              Paslaugų teikimo sąlygos
            </Link>{' '}
            nustato amžiaus ribas platformos naudojimui ir pardavimui. Jei paskyrą sukūrė
            asmuo, nesulaukęs minimalaus amžiaus, susisiekite su mumis ir mes jo duomenis
            ištrinsime.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className={SECTION_HEADING_CLASS}>
            12. Priežiūros institucija
          </h2>
          <p>
            Jei manote, kad Jūsų duomenų apsaugos teisės buvo pažeistos, galite pateikti
            skundą <strong>Latvijos valstybinei duomenų inspekcijai (DVI)</strong>:{' '}
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
            13. Politikos pakeitimai
          </h2>
          <p>
            Mes galime atnaujinti šią politiką. Apie reikšmingus pakeitimus registruotus
            naudotojus informuosime el. paštu.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className={SECTION_HEADING_CLASS}>
            14. Kalba
          </h2>
          <p>
            Šios politikos vertimai gali būti pateikti kitomis kalbomis Jūsų patogumui. Anglų
            kalbos versija yra autoritetinga pirminė versija. Bet kokio neatitikimo atveju
            tarp anglų kalbos versijos ir bet kokio vertimo vyrauja anglų kalbos versija.
          </p>
        </section>

        <p className="text-sm text-semantic-text-muted pt-4 border-t border-semantic-border-subtle">
          Taip pat žr. mūsų{' '}
          <Link href="/terms/lt" className="link-brand">
            Paslaugų teikimo sąlygas
          </Link>{' '}
          ir{' '}
          <Link href="/seller-terms/lt" className="link-brand">
            Pardavėjo sutartį
          </Link>
          .
        </p>
      </div>
    </>
  );
}
