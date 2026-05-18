import Link from 'next/link';
import { Card, CardBody, CardHeader } from '@/components/ui';
import { CARD_SUBSECTION_HEADING_CLASS, PAGE_HEADING_CLASS, SECTION_HEADING_CLASS } from '@/lib/heading-classes';
import { cn } from '@/lib/cn';

export default function CookiesEt() {
  return (
    <>
      <h1 className={cn(PAGE_HEADING_CLASS, 'mb-6')}>
        Küpsiste eeskirjad
      </h1>

      <div className="prose prose-sm max-w-none text-semantic-text-secondary space-y-6">
        <p className="text-semantic-text-secondary">
          Viimati uuendatud: 16. mail 2026
        </p>

        <Card className="not-prose">
          <CardHeader>
            <h2 className={CARD_SUBSECTION_HEADING_CLASS}>
              Kiirülevaade
            </h2>
            <p className="text-xs text-semantic-text-muted mt-0.5">
              Lihtsas keeles versioon. Täielike reeglite lugemiseks jätkake lugemist.
            </p>
          </CardHeader>
          <CardBody>
            <ul className="list-disc pl-5 space-y-2 text-sm text-semantic-text-secondary">
              <li>
                Sellel lehel on kirjas kõik küpsised ja brauseri salvestusruumi üksused, mida
                me seadistame &mdash; isegi need, mis ei vaja Teie nõusolekut. E-privaatsuse
                direktiiv (artikkel 5(3)) nõuab läbipaistvust ja me teeksime seda niikuinii.
              </li>
              <li>
                Kõik, mida me seadistame, on kas platvormi toimimiseks rangelt vajalik
                (sisselogituna püsimine, ostukorvi sisu, botivastane kaitse) või Teie poolt
                valitud eelistus.
              </li>
              <li>
                Me ei kasuta reklaami-, taasturunduse (<em>retargeting</em>) ega saitidevahelise
                jälgimise küpsiseid. Me ei näita reklaame ega plaani seda teha.
              </li>
              <li>
                Meie analüütika (PostHog, EL-i piirkond) töötab küpsisteta režiimis — ei mingeid
                küpsiseid ega kohalikku salvestusruumi (<em>localStorage</em>). IP-aadressid
                eemaldatakse meie enda puhverserveris, enne kui andmed serverist väljuvad.
              </li>
              <li>
                Cloudflare majutab meie DNS-i ja CDN-i ning käitab Turnstile-i tarkvara
                vormide puhul, mis on altid botirünnakutele. Mõlemad teenused seadistavad
                väikese arvu küpsiseid, mis on loetletud allolevates tabelites.
              </li>
              <li>
                Saate küpsised igal ajal oma brauseri seadetes kustutada. See logib Teid välja
                ja tühjendab ostukorvi, kuid veebileht töötab edasi.
              </li>
            </ul>
          </CardBody>
        </Card>

        <section className="space-y-3">
          <h2 className={SECTION_HEADING_CLASS}>
            Meie domeeni küpsised
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-semantic-border-subtle text-left">
                  <th className="py-2 pr-4 font-semibold text-semantic-text-heading">Nimi</th>
                  <th className="py-2 pr-4 font-semibold text-semantic-text-heading">Eesmärk</th>
                  <th className="py-2 pr-4 font-semibold text-semantic-text-heading">Kestus</th>
                  <th className="py-2 font-semibold text-semantic-text-heading">Tüüp</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-semantic-border-subtle">
                  <td className="py-2 pr-4 align-top font-mono text-xs">sb-*-auth-token.0/.1/.2</td>
                  <td className="py-2 pr-4 align-top">
                    Hoiab Teid sisselogituna. Seadistatakse meie autentimisteenuse pakkuja
                    (Supabase) poolt sisselogimisel või registreerimisel. Üks seanss on jagatud
                    nummerdatud osadeks, kuna brauserid piiravad üksiku küpsise suurust umbes
                    4 KB-ni ja OAuth-seansid ületavad seda mahtu.
                  </td>
                  <td className="py-2 pr-4 align-top">Seanss / kuni väljalogimiseni</td>
                  <td className="py-2 align-top">Esimese osapoole, rangelt vajalik</td>
                </tr>
                <tr className="border-b border-semantic-border-subtle">
                  <td className="py-2 pr-4 align-top font-mono text-xs">cf_clearance</td>
                  <td className="py-2 pr-4 align-top">
                    Seadistatakse Cloudflare&apos;i poolt (kes majutab meie DNS-i ja CDN-i),
                    märkimaks, et Teie brauser on läbinud Cloudflare&apos;i botihalduse
                    kontrolli. See hoiab ära korduva kontrolli igal lehe laadimisel.
                  </td>
                  <td className="py-2 pr-4 align-top">Kuni 30 päeva (Cloudflare&apos;i vaikeväärtus)</td>
                  <td className="py-2 align-top">Esimese osapoole, rangelt vajalik</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-xs text-semantic-text-muted">
            Märkus: Supabase&apos;i küpsiste täpsed nimed varieeruvad sõltuvalt projekti
            viitest (näiteks{' '}
            <span className="font-mono">sb-tfxqbtcdkzdwfgsivvet-auth-token.0</span>).
          </p>
        </section>

        <section className="space-y-3">
          <h2 className={SECTION_HEADING_CLASS}>
            Teie brauseri kohalikus või seansipõhises salvestusruumis hoitavad üksused
          </h2>
          <p>
            Kohalik salvestusruum (<em>local storage</em>) ja seansipõhine salvestusruum
            (<em>session storage</em>) ei ole tehniliselt küpsised, kuid E-privaatsuse
            direktiiv hõlmab igasugust teavet, mis on salvestatud Teie seadmesse. Avaldame
            need üksused samal põhjusel. Seansipõhine salvestusruum tühjendatakse
            automaatselt brauseri vahekaardi sulgemisel; kohalik salvestusruum säilib kuni
            selle kustutamiseni.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-semantic-border-subtle text-left">
                  <th className="py-2 pr-4 font-semibold text-semantic-text-heading">Võti</th>
                  <th className="py-2 pr-4 font-semibold text-semantic-text-heading">Eesmärk</th>
                  <th className="py-2 pr-4 font-semibold text-semantic-text-heading">Salvestusviis</th>
                  <th className="py-2 font-semibold text-semantic-text-heading">Tüüp</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-semantic-border-subtle">
                  <td className="py-2 pr-4 align-top font-mono text-xs">stg_cart</td>
                  <td className="py-2 pr-4 align-top">
                    Hoiab Teie ostukorvis olevaid tooteid, et need säiliksid lehe värskendamisel.
                  </td>
                  <td className="py-2 pr-4 align-top">Kohalik</td>
                  <td className="py-2 align-top">Rangelt vajalik</td>
                </tr>
                <tr className="border-b border-semantic-border-subtle">
                  <td className="py-2 pr-4 align-top font-mono text-xs">stg-stale-action-reload</td>
                  <td className="py-2 pr-4 align-top">
                    Seansi tervikluse signaal, mis käsib saidil uuesti laadida, kui seanss on
                    pärast taustal toimunud autentimismuudatusi aegunud.
                  </td>
                  <td className="py-2 pr-4 align-top">Kohalik</td>
                  <td className="py-2 align-top">Rangelt vajalik</td>
                </tr>
                <tr className="border-b border-semantic-border-subtle">
                  <td className="py-2 pr-4 align-top font-mono text-xs">stg-is-seller</td>
                  <td className="py-2 pr-4 align-top">
                    Puhverdab teabe, kas Teie kontol on hetkel müüja roll, et kasutajaliides
                    saaks kuvada müüjaspetsiifilisi kontrolle ilma serveripäringuta.
                  </td>
                  <td className="py-2 pr-4 align-top">Seansipõhine</td>
                  <td className="py-2 align-top">Rangelt vajalik</td>
                </tr>
                <tr className="border-b border-semantic-border-subtle">
                  <td className="py-2 pr-4 align-top font-mono text-xs">stg-pending-actions-dismissed</td>
                  <td className="py-2 pr-4 align-top">
                    Jätab meelde, millised ootel tegevuste teated olete selle seansi jooksul
                    sulgenud.
                  </td>
                  <td className="py-2 pr-4 align-top">Seansipõhine</td>
                  <td className="py-2 align-top">Eelistus</td>
                </tr>
                {/* TODO: translator review — best-effort translations below */}
                <tr className="border-b border-semantic-border-subtle">
                  <td className="py-2 pr-4 align-top font-mono text-xs">stg:feedback-banner-dismissed:v1</td>
                  <td className="py-2 pr-4 align-top">
                    Jätab meelde, et sulgesite beeta-tagasiside ribade, et see enam ei ilmuks.
                  </td>
                  <td className="py-2 pr-4 align-top">Kohalik</td>
                  <td className="py-2 align-top">Eelistus</td>
                </tr>
                <tr className="border-b border-semantic-border-subtle">
                  <td className="py-2 pr-4 align-top font-mono text-xs">stg:launch-banner-dismissed:v2</td>
                  <td className="py-2 pr-4 align-top">
                    Salvestatud, kui sulgesite varem enne käivitamise teateriba. Enam ei
                    kirjutata; võib püsida varasematest külastustest.
                  </td>
                  <td className="py-2 pr-4 align-top">Kohalik</td>
                  <td className="py-2 align-top">Eelistus</td>
                </tr>
                <tr className="border-b border-semantic-border-subtle">
                  <td className="py-2 pr-4 align-top font-mono text-xs">cf.turnstile.*</td>
                  <td className="py-2 pr-4 align-top">
                    Kirjutatakse Cloudflare Turnstile&apos;i vidina poolt botivastase kaitsega
                    vormide laadimisel (registreerimine, parooli lähtestamine, uudiskiri,
                    kommentaarid, ostu sooritamine, pakkumised, kuulutuste muutmine).
                    Kasutatakse Turnstile&apos;i enda poolt korduvate kontrollide vältimiseks.
                    Meie rakenduse kood seda ei loe.
                  </td>
                  <td className="py-2 pr-4 align-top">Kohalik</td>
                  <td className="py-2 align-top">Rangelt vajalik</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className={SECTION_HEADING_CLASS}>
            Kolmandate osapoolte tööriistad vormide esitamisel
          </h2>
          <p>
            Vormidel, mis on sageli boti rünnakute sihtmärgiks — registreerimine, parooli
            lähtestamine, uudiskiri, kommentaarid, ostu sooritamine, pakkumised, kuulutuste
            muutmine — kasutame me <strong>Cloudflare Turnstile</strong>&apos;i nähtamatus
            režiimis. Turnstile laadib skripti aadressilt{' '}
            <span className="font-mono">challenges.cloudflare.com</span>
            {' '}ja võib seadistada ajutisi küpsiseid{' '}
            <span className="font-mono">cloudflare.com</span>
            {' '}domeenis, et kontrollida, kas esitamine pole automatiseeritud. Samuti kirjutab
            see väikeseid üksusi Teie brauseri kohalikku salvestusruumi meie domeenis
            (eesliitega <span className="font-mono">cf.turnstile.</span>), et Teid ei peaks
            igal vormil uuesti kontrollima — need on kirjas ülaltoodud tabelis. Turnstile on
            rangelt vajalik, et hoida botid turuplatsilt eemal. Üksikasju vaadake{' '}
            <a
              href="https://www.cloudflare.com/privacypolicy/"
              target="_blank"
              rel="noopener noreferrer"
              className="link-brand"
            >
              Cloudflare&apos;i privaatsuspoliitikast
            </a>
            .
          </p>
          <p>
            Cloudflare toimib ka meie andmeliikluse puhverserverina ja teostab botihaldust
            serveri ääre tasandil (<em>edge-level</em>), mis seadistab ülaltoodud tabelis
            mainitud <span className="font-mono">cf_clearance</span> küpsise.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className={SECTION_HEADING_CLASS}>
            Mida me ei seadista
          </h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>
              <strong>Analüütika küpsised.</strong> Meie analüütikatööriist (PostHog, EL-i
              piirkond) töötab küpsisteta režiimis — ei mingeid küpsiseid ega kohaliku
              salvestusruumi üksusi. Sündmused suunatakse läbi esimese osapoole pöördpuhverserveri
              (<em>reverse proxy</em>), mis eemaldab kliendi IP-aadressid enne päringu
              serverist väljumist.
            </li>
            <li>
              <strong>Veajälgimise küpsised.</strong> Sentry on konfigureeritud ilma seansi
              taasesituse (<em>session replay</em>) või seansi jälgimise funktsioonideta,
              seega ei seadista see Teie brauseris küpsiseid.
            </li>
            <li>
              <strong>Reklaami- või taasturunduse küpsised.</strong> Me ei näita reklaame.
            </li>
            <li>
              <strong>Asukohapõhised (<em>locale</em>) küpsised.</strong> Teie valitud keel
              on osa URL-i teest
              (<span className="font-mono">/en/</span>, <span className="font-mono">/lv/</span>),
              mitte ei salvestata küpsisesse.
            </li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className={SECTION_HEADING_CLASS}>
            Teie valikud
          </h2>
          <p>
            Enamik brausereid võimaldab Teil privaatsusseadetes küpsised ja kohaliku
            salvestusruumi tühjendada. Nende tühjendamine logib Teid välja ja eemaldab tooted
            ostukorvist. Kuna kõik meie poolt seadistatavad üksused on kas rangelt vajalikud
            või Teie poolt valitud eelistused, ei kasuta me eraldi nõusoleku bännerit.
          </p>
          <p>
            Kogu muu teabe kohta selle kohta, kuidas me Teie andmeid käsitleme &mdash;
            sealhulgas õiguslikud alused, säilitamisperioodid ja Teie õigused &mdash; vaadake{' '}
            <Link href="/privacy/et" className="link-brand">
              Privaatsuseeskirju
            </Link>
            .
          </p>
        </section>

        <section className="space-y-3">
          <h2 className={SECTION_HEADING_CLASS}>
            Keel
          </h2>
          <p>
            Käesoleva poliitika tõlkeid võidakse pakkuda teistes keeltes Teie mugavuse
            huvides. Ingliskeelne versioon on autoriteetne originaal. Mis tahes lahknevuse
            korral ingliskeelse versiooni ja mis tahes tõlke vahel on määrav ingliskeelne
            versioon.
          </p>
        </section>
      </div>
    </>
  );
}
