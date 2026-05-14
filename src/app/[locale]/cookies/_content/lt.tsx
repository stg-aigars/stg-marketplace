import Link from 'next/link';
import { Card, CardBody, CardHeader } from '@/components/ui';
import { SECTION_HEADING_CLASS } from '@/lib/heading-classes';

export default function CookiesLt() {
  return (
    <>
      <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-semantic-text-heading mb-6">
        Slapukų politika
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
              Versija paprasta kalba. Norėdami perskaityti visas taisykles, tęskite toliau.
            </p>
          </CardHeader>
          <CardBody>
            <ul className="list-disc pl-5 space-y-2 text-sm text-semantic-text-secondary">
              <li>
                Šiame puslapyje pateikiami visi mūsų nustatomi slapukai ir naršyklės saugyklos
                elementai &mdash; net ir tie, kuriems nereikia Jūsų sutikimo. E. privatumo
                direktyva (5&nbsp;str. 3&nbsp;dalis) reikalauja skaidrumo, ir mes tai
                darytume bet kuriuo atveju.
              </li>
              <li>
                Viskas, ką nustatome, yra arba griežtai būtina platformos veikimui (Jūsų
                sesijos palaikymui, krepšelio turiniui, apsaugai nuo robotų), arba Jūsų
                pasirinkti nustatymai.
              </li>
              <li>
                Nenaudojame jokių reklamos, pakartotinės rinkodaros (<em>retargeting</em>) ar
                tarp svetainių stebėjimo slapukų. Mes nerodome reklamų ir neketiname to daryti.
              </li>
              <li>
                Mūsų analitika (PostHog, ES regionas) veikia be slapukų režimu — jokių slapukų,
                jokios vietinės saugyklos (<em>localStorage</em>), o IP adresai pašalinami
                mūsų pačių tarpiniame serveryje, prieš įvykiams paliekant serverį.
              </li>
              <li>
                Cloudflare teikia mūsų DNS ir CDN paslaugas bei naudoja Turnstile įrankį
                formose, kurioms kyla robotų grėsmė. Abu šie tiekėjai nustato nedidelį kiekį
                slapukų, nurodytų žemiau esančiose lentelėse.
              </li>
              <li>
                Slapukus galite bet kada ištrinti savo naršyklės nustatymuose. Tai Jus atjungs
                nuo sistemos ir ištuštins Jūsų krepšelį, tačiau svetainė vis tiek veiks.
              </li>
            </ul>
          </CardBody>
        </Card>

        <section className="space-y-3">
          <h2 className={SECTION_HEADING_CLASS}>
            Slapukai mūsų domene
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-semantic-border-subtle text-left">
                  <th className="py-2 pr-4 font-semibold text-semantic-text-heading">Pavadinimas</th>
                  <th className="py-2 pr-4 font-semibold text-semantic-text-heading">Tikslas</th>
                  <th className="py-2 pr-4 font-semibold text-semantic-text-heading">Trukmė</th>
                  <th className="py-2 font-semibold text-semantic-text-heading">Tipas</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-semantic-border-subtle">
                  <td className="py-2 pr-4 align-top font-mono text-xs">sb-*-auth-token.0/.1/.2</td>
                  <td className="py-2 pr-4 align-top">
                    Palaiko Jūsų prisijungimą. Nustato mūsų autentifikavimo paslaugų teikėjas
                    (Supabase), kai prisijungiate arba registruojatės. Viena sesija padalinama
                    į sunumeruotas dalis, nes naršyklės riboja atskirų slapukų dydį iki maždaug
                    4 KB, o OAuth sesijos tai viršija.
                  </td>
                  <td className="py-2 pr-4 align-top">Sesija / iki atsijungimo</td>
                  <td className="py-2 align-top">Pirmosios šalies, griežtai būtinas</td>
                </tr>
                <tr className="border-b border-semantic-border-subtle">
                  <td className="py-2 pr-4 align-top font-mono text-xs">cf_clearance</td>
                  <td className="py-2 pr-4 align-top">
                    Nustato Cloudflare, teikianti mūsų DNS ir CDN paslaugas, kad pažymėtų, jog
                    Jūsų naršyklė praėjo Cloudflare robotų valdymo patikrą mūsų domene. Tai
                    neleidžia Jums rodyti patikros užduočių kiekvieną kartą įkeliant puslapį.
                  </td>
                  <td className="py-2 pr-4 align-top">Iki 30 dienų (Cloudflare numatytasis nustatymas)</td>
                  <td className="py-2 align-top">Pirmosios šalies, griežtai būtinas</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-xs text-semantic-text-muted">
            Konkretūs Supabase slapukų pavadinimai skiriasi priklausomai nuo projekto nuorodos
            (pavyzdžiui,{' '}
            <span className="font-mono">sb-tfxqbtcdkzdwfgsivvet-auth-token.0</span>).
          </p>
        </section>

        <section className="space-y-3">
          <h2 className={SECTION_HEADING_CLASS}>
            Jūsų naršyklės vietinėje arba sesijos saugykloje saugomi elementai
          </h2>
          <p>
            Vietinė (<em>local storage</em>) ir sesijos (<em>session storage</em>) saugyklos
            techniškai nėra slapukai, tačiau E. privatumo direktyva taikoma bet kokiai
            informacijai, saugomai Jūsų įrenginyje. Mes juos atskleidžiame dėl tos pačios
            priežasties. Sesijos saugykla išsivalo automatiškai, kai uždarote kortelę;
            vietinė saugykla išlieka tol, kol ją išvalote.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-semantic-border-subtle text-left">
                  <th className="py-2 pr-4 font-semibold text-semantic-text-heading">Raktas</th>
                  <th className="py-2 pr-4 font-semibold text-semantic-text-heading">Tikslas</th>
                  <th className="py-2 pr-4 font-semibold text-semantic-text-heading">Saugykla</th>
                  <th className="py-2 font-semibold text-semantic-text-heading">Tipas</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-semantic-border-subtle">
                  <td className="py-2 pr-4 align-top font-mono text-xs">stg_cart</td>
                  <td className="py-2 pr-4 align-top">
                    Saugo Jūsų krepšelyje esančias prekes, kad jos išliktų perkrovus puslapį.
                  </td>
                  <td className="py-2 pr-4 align-top">Vietinė</td>
                  <td className="py-2 align-top">Griežtai būtinas</td>
                </tr>
                <tr className="border-b border-semantic-border-subtle">
                  <td className="py-2 pr-4 align-top font-mono text-xs">stg-stale-action-reload</td>
                  <td className="py-2 pr-4 align-top">
                    Sesijos vientisumo signalas, nurodantis svetainei persikrauti, kai Jūsų
                    sesija tampa nebegaliojanti po fone įvykusių autentifikavimo pokyčių.
                  </td>
                  <td className="py-2 pr-4 align-top">Vietinė</td>
                  <td className="py-2 align-top">Griežtai būtinas</td>
                </tr>
                <tr className="border-b border-semantic-border-subtle">
                  <td className="py-2 pr-4 align-top font-mono text-xs">stg:launch-banner-dismissed:v2</td>
                  <td className="py-2 pr-4 align-top">
                    Įsimena, kad uždarėte svetainės pristatymo pranešimą, kad jis vėl
                    neatsirastų.
                  </td>
                  <td className="py-2 pr-4 align-top">Vietinė</td>
                  <td className="py-2 align-top">Pasirinkimas</td>
                </tr>
                <tr className="border-b border-semantic-border-subtle">
                  <td className="py-2 pr-4 align-top font-mono text-xs">stg-is-seller</td>
                  <td className="py-2 pr-4 align-top">
                    Išsaugo informaciją, ar Jūsų paskyra šiuo metu turi pardavėjo rolę, kad
                    vartotojo sąsaja galėtų rodyti pardavėjui skirtus valdiklius be papildomos
                    užklausos serveriui.
                  </td>
                  <td className="py-2 pr-4 align-top">Sesijos</td>
                  <td className="py-2 align-top">Griežtai būtinas</td>
                </tr>
                <tr className="border-b border-semantic-border-subtle">
                  <td className="py-2 pr-4 align-top font-mono text-xs">stg-pending-actions-dismissed</td>
                  <td className="py-2 pr-4 align-top">
                    Įsimena, kuriuos pranešimus apie laukiančius veiksmus uždarėte šios
                    sesijos metu.
                  </td>
                  <td className="py-2 pr-4 align-top">Sesijos</td>
                  <td className="py-2 align-top">Pasirinkimas</td>
                </tr>
                <tr className="border-b border-semantic-border-subtle">
                  <td className="py-2 pr-4 align-top font-mono text-xs">cf.turnstile.*</td>
                  <td className="py-2 pr-4 align-top">
                    Įrašo Cloudflare Turnstile programėlė, kai įkeliamos nuo robotų apsaugotos
                    formos (registracija, slaptažodžio atkūrimas, naujienlaiškis, komentarai,
                    apmokėjimas, kainų siūlymas, skelbimų redagavimas). Naudojama paties
                    Turnstile, siekiant išvengti perteklinių patikrinimų. Mūsų programos kodas
                    negali nuskaityti šių duomenų.
                  </td>
                  <td className="py-2 pr-4 align-top">Vietinė</td>
                  <td className="py-2 align-top">Griežtai būtinas</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className={SECTION_HEADING_CLASS}>
            Trečiųjų šalių įrankiai pildant formas
          </h2>
          <p>
            Formose, į kurias dažnai taikosi robotai — registracija, slaptažodžio atkūrimas,
            naujienlaiškis, komentarai, apmokėjimas, kainų siūlymas, skelbimų redagavimas —
            naudojame <strong>Cloudflare Turnstile</strong> nematomuoju režimu. Turnstile
            įkelia skriptą iš{' '}
            <span className="font-mono">challenges.cloudflare.com</span>
            {' '}ir gali nustatyti laikinų slapukų{' '}
            <span className="font-mono">cloudflare.com</span>
            {' '}domene, kol tikrina, ar duomenų pateikimas nėra automatizuotas. Jis taip pat
            įrašo nedidelius duomenis į Jūsų naršyklės vietinę saugyklą mūsų domene (su
            prefiksu <span className="font-mono">cf.turnstile.</span>), kad nereikėtų Jūsų
            tikrinti kiekvienoje formoje — šie elementai nurodyti vietinės saugyklos lentelėje
            aukščiau. Turnstile yra griežtai būtinas, kad į prekyvietę nepatektų robotai.
            Daugiau informacijos rasite{' '}
            <a
              href="https://www.cloudflare.com/privacypolicy/"
              target="_blank"
              rel="noopener noreferrer"
              className="link-brand"
            >
              Cloudflare privatumo politikoje
            </a>
            .
          </p>
          <p>
            Cloudflare taip pat veikia kaip mūsų tarpinis serveris ir vykdo robotų valdymą
            kraštiniame lygmenyje (<em>edge-level</em>), būtent todėl slapukų lentelėje
            atsiranda <span className="font-mono">cf_clearance</span> slapukas.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className={SECTION_HEADING_CLASS}>
            Ko mes nenustatome
          </h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>
              <strong>Analitikos slapukai.</strong> Mūsų analitikos įrankis (PostHog, ES
              regionas) veikia be slapukų režimu — jokių slapukų, jokių vietinės saugyklos
              elementų. Įvykiai maršrutizuojami per pirmosios šalies atvirkštinį tarpinį
              serverį (<em>reverse proxy</em>), kuris pašalina kliento IP adresus prieš
              užklausai paliekant mūsų serverį.
            </li>
            <li>
              <strong>Klaidų stebėjimo slapukai.</strong> Sentry sukonfigūruotas be sesijų
              atkūrimo ar sesijų stebėjimo funkcijų, todėl Jūsų naršyklėje nenustato jokių
              slapukų.
            </li>
            <li>
              <strong>Reklamos ar pakartotinės rinkodaros slapukai.</strong> Mes nerodome
              reklamų.
            </li>
            <li>
              <strong>Kalbos nustatymų (<em>locale</em>) slapukai.</strong> Jūsų kalba yra
              URL kelio dalis
              (<span className="font-mono">/en/</span>, <span className="font-mono">/lv/</span>),
              o ne saugoma slapuke.
            </li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className={SECTION_HEADING_CLASS}>
            Jūsų pasirinkimai
          </h2>
          <p>
            Dauguma naršyklių leidžia išvalyti slapukus ir vietinę saugyklą privatumo
            nustatymuose. Juos išvalius, būsite atjungti nuo sistemos ir Jūsų krepšelis bus
            ištuštintas. Kadangi kiekvienas mūsų nustatomas elementas yra arba griežtai
            būtinas, arba Jūsų pasirinktas nustatymas, mes nerodome sutikimo pranešimo.
          </p>
          <p>
            Visą kitą informaciją apie tai, kaip tvarkome Jūsų duomenis &mdash; įskaitant
            teisinį pagrindą, saugojimo laikotarpius ir Jūsų teises &mdash; rasite{' '}
            <Link href="/privacy/lt" className="link-brand">
              Privatumo politikoje
            </Link>
            .
          </p>
        </section>

        <section className="space-y-3">
          <h2 className={SECTION_HEADING_CLASS}>
            Kalba
          </h2>
          <p>
            Šios politikos vertimai gali būti pateikti kitomis kalbomis Jūsų patogumui. Anglų
            kalbos versija yra autoritetinga pirminė versija. Bet kokio neatitikimo atveju
            tarp anglų kalbos versijos ir bet kokio vertimo vyrauja anglų kalbos versija.
          </p>
        </section>
      </div>
    </>
  );
}
