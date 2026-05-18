import Link from 'next/link';
import { Card, CardBody, CardHeader } from '@/components/ui';
import { CARD_SUBSECTION_HEADING_CLASS, PAGE_HEADING_CLASS, SECTION_HEADING_CLASS } from '@/lib/heading-classes';
import { cn } from '@/lib/cn';

export default function CookiesLv() {
  return (
    <>
      <h1 className={cn(PAGE_HEADING_CLASS, 'mb-6')}>
        Sīkdatņu politika
      </h1>

      <div className="prose prose-sm max-w-none text-semantic-text-secondary space-y-6">
        <p className="text-semantic-text-secondary">
          Pēdējās izmaiņas: 2026. gada 16. maijā
        </p>

        <Card className="not-prose">
          <CardHeader>
            <h2 className={CARD_SUBSECTION_HEADING_CLASS}>
              Ātrais sākums
            </h2>
            <p className="text-xs text-semantic-text-muted mt-0.5">
              Versija vienkāršā valodā. Pilnus noteikumus lasi tālāk.
            </p>
          </CardHeader>
          <CardBody>
            <ul className="list-disc pl-5 space-y-2 text-sm text-semantic-text-secondary">
              <li>
                Šajā lapā ir uzskaitītas visas sīkdatnes (<em>cookies</em>) un pārlūkprogrammas
                krātuves vienumi, ko mēs iestatām &mdash; pat tie, kuriem nav nepieciešama
                tava piekrišana. E-privātuma direktīva (5.&nbsp;panta 3.&nbsp;punkts) pieprasa
                caurskatāmību, un mēs to nodrošinātu jebkurā gadījumā.
              </li>
              <li>
                Viss, ko mēs iestatām, ir vai nu stingri nepieciešams platformas darbībai
                (tavas sesijas uzturēšanai, groza saturam, aizsardzībai pret robotiem), vai
                arī tā ir tava izvēlētā iestatījumu preference.
              </li>
              <li>
                Mēs neizmantojam reklāmas, atkārtotā mārketinga (<em>retargeting</em>) vai
                starpvietņu izsekošanas sīkdatnes. Mēs neizvietojam reklāmas un neplānojam to
                darīt.
              </li>
              <li>
                Mūsu analītikas rīks (PostHog, ES reģions) darbojas bezsīkdatņu (<em>cookieless</em>) režīmā — nekādu
                sīkdatņu, nekādas vietējās krātuves (<em>localStorage</em>), un IP adreses tiek
                noņemtas mūsu starpniekserverī, pirms notikumu dati pamet serveri.
              </li>
              <li>
                Cloudflare uztur mūsu DNS un CDN, kā arī nodrošina Turnstile pakalpojumu
                formās, kurām var uzbrukt roboti. Abi šie pakalpojumi iestata nelielu skaitu
                sīkdatņu, kas uzskaitītas zemāk esošajās tabulās.
              </li>
              <li>
                Tu vari jebkurā laikā izdzēst sīkdatnes savas pārlūkprogrammas iestatījumos.
                Tas tevi izrakstīs no sistēmas un iztukšos tavu grozu, taču vietne joprojām
                darbosies.
              </li>
            </ul>
          </CardBody>
        </Card>

        <section className="space-y-3">
          <h2 className={SECTION_HEADING_CLASS}>
            Mūsu domēna sīkdatnes
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-semantic-border-subtle text-left">
                  <th className="py-2 pr-4 font-semibold text-semantic-text-heading">Nosaukums</th>
                  <th className="py-2 pr-4 font-semibold text-semantic-text-heading">Nolūks</th>
                  <th className="py-2 pr-4 font-semibold text-semantic-text-heading">Ilgums</th>
                  <th className="py-2 font-semibold text-semantic-text-heading">Veids</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-semantic-border-subtle">
                  <td className="py-2 pr-4 align-top font-mono text-xs">sb-*-auth-token.0/.1/.2</td>
                  <td className="py-2 pr-4 align-top">
                    Nodrošina tavu palikšanu sistēmā. To iestata mūsu autentifikācijas
                    pakalpojumu sniedzējs (Supabase), kad tu piesakies vai reģistrējies. Viena
                    sesija tiek sadalīta numurētos fragmentos, jo pārlūkprogrammas ierobežo
                    atsevišķu sīkdatņu izmēru līdz aptuveni 4 KB, bet OAuth sesijas to pārsniedz.
                  </td>
                  <td className="py-2 pr-4 align-top">Sesija / līdz izrakstīšanās brīdim</td>
                  <td className="py-2 align-top">Pirmās puses, stingri nepieciešams</td>
                </tr>
                <tr className="border-b border-semantic-border-subtle">
                  <td className="py-2 pr-4 align-top font-mono text-xs">cf_clearance</td>
                  <td className="py-2 pr-4 align-top">
                    Iestata Cloudflare, kas uztur mūsu DNS un CDN, lai atzīmētu, ka tava
                    pārlūkprogramma ir izturējusi Cloudflare robotu pārvaldības pārbaudi mūsu
                    domēnam. Tas neļauj atkārtoti pieprasīt pārbaudi pie katras lapas ielādes.
                  </td>
                  <td className="py-2 pr-4 align-top">Līdz 30 dienām (Cloudflare noklusējums)</td>
                  <td className="py-2 align-top">Pirmās puses, stingri nepieciešams</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-xs text-semantic-text-muted">
            Konkrētie Supabase sīkdatņu nosaukumi atšķiras atkarībā no projekta atsauces
            (piemēram,{' '}
            <span className="font-mono">sb-tfxqbtcdkzdwfgsivvet-auth-token.0</span>).
          </p>
        </section>

        <section className="space-y-3">
          <h2 className={SECTION_HEADING_CLASS}>
            Vienumi, kas tiek glabāti tavas pārlūkprogrammas vietējā vai sesijas krātuvē
          </h2>
          <p>
            Vietējā krātuve (<em>local storage</em>) un sesijas krātuve
            (<em>session storage</em>) tehniski nav sīkdatnes, taču E-privātuma direktīva
            attiecas uz jebkuru informāciju, kas tiek glabāta tavā ierīcē. Mēs tos uzskaitām
            tā paša iemesla dēļ. Sesijas krātuve tiek izdzēsta automātiski, kad aizver cilni;
            vietējā krātuve saglabājas, līdz tu to iztīri.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-semantic-border-subtle text-left">
                  <th className="py-2 pr-4 font-semibold text-semantic-text-heading">Atslēga</th>
                  <th className="py-2 pr-4 font-semibold text-semantic-text-heading">Nolūks</th>
                  <th className="py-2 pr-4 font-semibold text-semantic-text-heading">Krātuve</th>
                  <th className="py-2 font-semibold text-semantic-text-heading">Veids</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-semantic-border-subtle">
                  <td className="py-2 pr-4 align-top font-mono text-xs">stg_cart</td>
                  <td className="py-2 pr-4 align-top">
                    Saglabā preces, kas pašlaik atrodas tavā grozā, lai tās nepazustu,
                    pārlādējot lapu.
                  </td>
                  <td className="py-2 pr-4 align-top">Vietējā</td>
                  <td className="py-2 align-top">Stingri nepieciešams</td>
                </tr>
                <tr className="border-b border-semantic-border-subtle">
                  <td className="py-2 pr-4 align-top font-mono text-xs">stg-stale-action-reload</td>
                  <td className="py-2 pr-4 align-top">
                    Sesijas integritātes signāls, kas liek vietnei pārlādēties, ja sesija ir
                    kļuvusi novecojusi pēc fona autentifikācijas izmaiņām.
                  </td>
                  <td className="py-2 pr-4 align-top">Vietējā</td>
                  <td className="py-2 align-top">Stingri nepieciešams</td>
                </tr>
                <tr className="border-b border-semantic-border-subtle">
                  <td className="py-2 pr-4 align-top font-mono text-xs">stg-is-seller</td>
                  <td className="py-2 pr-4 align-top">
                    Saglabā informāciju par to, vai tavam kontam pašlaik ir pārdevēja loma,
                    lai saskarne varētu parādīt pārdevējam specifiskas vadīklas bez papildu
                    pieprasījuma serverim.
                  </td>
                  <td className="py-2 pr-4 align-top">Sesijas</td>
                  <td className="py-2 align-top">Stingri nepieciešams</td>
                </tr>
                <tr className="border-b border-semantic-border-subtle">
                  <td className="py-2 pr-4 align-top font-mono text-xs">stg-pending-actions-dismissed</td>
                  <td className="py-2 pr-4 align-top">
                    Atceras, kurus gaidošo darbību paziņojumus tu esi aizvēris šīs cilnes
                    sesijas laikā.
                  </td>
                  <td className="py-2 pr-4 align-top">Sesijas</td>
                  <td className="py-2 align-top">Preference</td>
                </tr>
                {/* TODO: translator review — best-effort translations below */}
                <tr className="border-b border-semantic-border-subtle">
                  <td className="py-2 pr-4 align-top font-mono text-xs">stg:feedback-banner-dismissed:v1</td>
                  <td className="py-2 pr-4 align-top">
                    Atceras, ka esi aizvēris beta atsauksmju paziņojuma joslu, lai tā vairs
                    neparādītos.
                  </td>
                  <td className="py-2 pr-4 align-top">Vietējā</td>
                  <td className="py-2 align-top">Preference</td>
                </tr>
                <tr className="border-b border-semantic-border-subtle">
                  <td className="py-2 pr-4 align-top font-mono text-xs">stg:launch-banner-dismissed:v2</td>
                  <td className="py-2 pr-4 align-top">
                    Saglabāts, ja iepriekš esi aizvēris pirmslaišanas paziņojuma joslu. Vairs
                    netiek rakstīts; var palikt no agrākiem apmeklējumiem.
                  </td>
                  <td className="py-2 pr-4 align-top">Vietējā</td>
                  <td className="py-2 align-top">Preference</td>
                </tr>
                <tr className="border-b border-semantic-border-subtle">
                  <td className="py-2 pr-4 align-top font-mono text-xs">cf.turnstile.*</td>
                  <td className="py-2 pr-4 align-top">
                    To ieraksta Cloudflare Turnstile logrīks, kad tiek ielādētas pret robotiem
                    aizsargātas formas (reģistrācija, paroles atiestatīšana, jaunumu
                    saņemšana, komentāri, apmaksa, solīšana, sludinājumu rediģēšana).
                    Turnstile to izmanto, lai izvairītos no liekām pārbaudēm. Mūsu
                    lietojumprogrammas kods šos datus nevar nolasīt.
                  </td>
                  <td className="py-2 pr-4 align-top">Vietējā</td>
                  <td className="py-2 align-top">Stingri nepieciešams</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className={SECTION_HEADING_CLASS}>
            Trešo pušu rīki formu iesniegšanas laikā
          </h2>
          <p>
            Formās, kuras bieži mēdz mērķēt roboti — reģistrācija, paroles atiestatīšana,
            jaunumu saņemšana, komentāri, apmaksa, solīšana, sludinājumu rediģēšana — mēs
            izmantojam <strong>Cloudflare Turnstile</strong> neredzamajā režīmā. Turnstile
            ielādē skriptu no{' '}
            <span className="font-mono">challenges.cloudflare.com</span>
            {' '}un var iestatīt īslaicīgas sīkdatnes{' '}
            <span className="font-mono">cloudflare.com</span>
            {' '}domēnā, kamēr tas pārbauda, vai iesniegums nav automatizēts. Tas arī ieraksta
            nelielus vienumus tavas pārlūkprogrammas vietējā krātuvē mūsu domēna ietvaros
            (ar prefiksu <span className="font-mono">cf.turnstile.</span>), lai nebūtu
            atkārtoti jāveic pārbaude katrā formā — tie ir norādīti augstāk esošajā vietējās
            krātuves tabulā. Turnstile ir stingri nepieciešams, lai pasargātu tirdzniecības
            vietu no robotiem. Sīkāku informāciju skati{' '}
            <a
              href="https://www.cloudflare.com/privacypolicy/"
              target="_blank"
              rel="noopener noreferrer"
              className="link-brand"
            >
              Cloudflare privātuma politikā
            </a>
            .
          </p>
          <p>
            Cloudflare arī veic mūsu datplūsmas starpniecību un nodrošina malu līmeņa
            (<em>edge-level</em>) robotu pārvaldību, kas iestata{' '}
            <span className="font-mono">cf_clearance</span> sīkdatni iepriekš minētajā
            sīkdatņu tabulā.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className={SECTION_HEADING_CLASS}>
            Ko mēs neiestatām
          </h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>
              <strong>Analītikas sīkdatnes.</strong> Mūsu analītikas rīks (PostHog, ES
              reģions) darbojas bezsīkdatņu režīmā — nekādu sīkdatņu, nekādu vietējās
              krātuves vienumu.
              Notikumi tiek maršrutēti caur pirmās puses apgriezto starpniekserveri
              (<em>reverse proxy</em>), kas noņem klienta IP adreses, pirms pieprasījums
              pamet mūsu serveri.
            </li>
            <li>
              <strong>Kļūdu izsekošanas sīkdatnes.</strong> Sentry ir konfigurēts bez sesiju
              atkārtošanas (<em>session replay</em>) vai sesiju izsekošanas funkcijām, tāpēc
              tas neiestata nekādas sīkdatnes tavā pārlūkprogrammā.
            </li>
            <li>
              <strong>Reklāmas vai atkārtotā mārketinga sīkdatnes.</strong> Mēs neizvietojam
              reklāmas.
            </li>
            <li>
              <strong>Valodas iestatījumu (<em>locale</em>) sīkdatnes.</strong> Tava
              izvēlētā valoda ir daļa no URL ceļa
              (<span className="font-mono">/en/</span>, <span className="font-mono">/lv/</span>),
              nevis saglabāta sīkdatnē.
            </li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className={SECTION_HEADING_CLASS}>
            Tava izvēle
          </h2>
          <p>
            Lielākā daļa pārlūkprogrammu ļauj iztīrīt sīkdatnes un vietējo krātuvi privātuma
            iestatījumos. To iztīrīšana tevi izrakstīs no sistēmas un iztukšos tavu grozu.
            Tā kā katrs mūsu iestatītais vienums ir vai nu stingri nepieciešams, vai arī
            tava izvēlēta preference, mēs nerādām piekrišanas paziņojumu (sīkdatņu joslu).
          </p>
          <p>
            Visu pārējo informāciju par to, kā mēs apstrādājam tavus datus &mdash; tostarp
            juridisko pamatu, glabāšanas periodus un tavas tiesības &mdash; skati{' '}
            <Link href="/privacy/lv" className="link-brand">
              Privātuma politikā
            </Link>
            .
          </p>
        </section>

        <section className="space-y-3">
          <h2 className={SECTION_HEADING_CLASS}>
            Valoda
          </h2>
          <p>
            Šīs politikas tulkojumi citās valodās var tikt nodrošināti tavām ērtībām. Angļu
            valodas versija ir autoritatīvā oriģinālversija. Jebkādu pretrunu gadījumā starp
            angļu valodas versiju un kādu tulkojumu noteicošā ir angļu valodas versija.
          </p>
        </section>
      </div>
    </>
  );
}
