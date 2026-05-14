import Link from 'next/link';
import { Card, CardBody, CardHeader } from '@/components/ui';
import { ADR_BODIES } from '@/lib/legal/adr-bodies';
import { SECTION_HEADING_CLASS } from '@/lib/heading-classes';
import { LEGAL_SUB_HEADING_CLASS } from '@/lib/legal/page-classes';
import {
  LEGAL_ENTITY_NAME,
  LEGAL_ENTITY_ADDRESS,
  LEGAL_ENTITY_REG_NUMBER,
} from '@/lib/constants';

export default function TermsLt() {
  return (
    <>
      <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-semantic-text-heading mb-6">
        Paslaugų teikimo sąlygos
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
                Mes valdome tiesioginių vartotojų tarpusavio (peer-to-peer) naudotų stalo
                žaidimų prekyvietę Latvijoje, Lietuvoje ir Estijoje. Mes patys nieko
                neparduodame &mdash; pardavėjai yra kiti žaidėjai.
              </li>
              <li>
                Kad galėtumėte naudotis platforma, Jums turi būti ne mažiau kaip{' '}
                <strong>16 metų</strong> ir Jūs turite gyventi Latvijoje, Lietuvoje arba
                Estijoje. Norėdami parduoti, turite būti bent <strong>18 metų</strong> ir
                veikti kaip fizinis asmuo.
              </li>
              <li>
                Kadangi perkate iš privačių asmenų, įprasta ES{' '}
                <strong>14 dienų sutarties atsisakymo teisė</strong> ir{' '}
                <strong>2 metų garantija</strong> pagal nutylėjimą netaikoma. Mūsų ginčų
                sprendimo procesas ir mokėjimų sulaikymas yra Jūsų saugumo garantas.
              </li>
              <li>
                Pirkėjai moka prekės kainą ir siuntimo išlaidas. Pardavėjams taikome komisinį
                mokestį pagal atskirą Pardavėjo sutartį.
              </li>
              <li>
                Jei užsakymas nepavyksta &mdash; prekė sugadinta, neatitinka aprašymo arba
                nebuvo pristatyta &mdash; galite pradėti ginčą per trumpą nustatytą laikotarpį.
                Mes tarpininkaujame ir galime grąžinti Jums pinigus iš lėšų, kurias saugome
                pardavėjo vardu.
              </li>
              <li>
                Savo paskyrą galite ištrinti bet kada paskyros nustatymuose. Privatumo
                politikoje paaiškinama, kokius duomenis saugome, kodėl ir kiek laiko.
              </li>
            </ul>
          </CardBody>
        </Card>

        <section className="space-y-3">
          <h2 className={SECTION_HEADING_CLASS}>
            1. Apie „Second Turn Games”
          </h2>
          <p>
            {LEGAL_ENTITY_NAME} (toliau &mdash; „STG”, „mes”), registracijos numeris{' '}
            {LEGAL_ENTITY_REG_NUMBER}, registruotos buveinės adresas: {LEGAL_ENTITY_ADDRESS},
            valdo tiesioginių vartotojų tarpusavio naudotų stalo žaidimų prekyvietę
            Latvijoje, Lietuvoje ir Estijoje. Mes sujungiame privačius pirkėjus ir privačius
            pardavėjus; pati pardavimo sutartis yra sudaroma tarp jų, o ne su mumis.
          </p>
          <p>
            Tvarkydami mokėjimus, mes veikiame kaip pardavėjų{' '}
            <strong>komercijos agentas</strong>. Kai pirkėjas sumoka už užsakymą, mes
            surenkame lėšas pardavėjo vardu ir pervedame jas pardavėjui tik po to, kai prekė
            pristatoma ir pasibaigia ginčų kėlimo terminas. Išsamios šių santykių sąlygos
            išdėstytos mūsų{' '}
            <Link href="/seller-terms/lt" className="link-brand">
              Pardavėjo sutartyje
            </Link>
            .
          </p>
        </section>

        <section className="space-y-3">
          <h2 className={SECTION_HEADING_CLASS}>
            2. Teisė naudotis platforma ir paskyra
          </h2>
          <p>
            Kad galėtumėte naudotis mūsų platforma, Jums turi būti bent{' '}
            <strong>16 metų</strong> ir Jūs turite gyventi Latvijoje, Lietuvoje arba
            Estijoje. Sukurdami paskyrą patvirtinate, kad atitinkate šiuos reikalavimus.
            Norėdami skelbti prekes pardavimui arba gauti išmokas, turite būti bent{' '}
            <strong>18 metų</strong>.
          </p>
          <p>
            Jūs esate atsakingi už savo prisijungimo duomenų saugumą ir už visą veiklą,
            vykdomą Jūsų paskyroje. Jei įtariate neteisėtą prieigą, nedelsdami praneškite
            mums adresu{' '}
            <a href="mailto:info@secondturn.games" className="link-brand">
              info@secondturn.games
            </a>
            .
          </p>
        </section>

        <section className="space-y-3">
          <h2 className={SECTION_HEADING_CLASS}>
            3. Pranešimas apie vartotojų apsaugą
          </h2>
          <p>
            Visi „Second Turn Games” platformoje parduodantys asmenys yra privatūs asmenys,
            parduodantys savo asmenines kolekcijas, o ne įmonės ar profesionalūs prekiautojai.
            ES vartotojų apsaugos taisyklės, taikomos verslo subjektų pardavimams vartotojams
            (B2C) &mdash; <strong>14 dienų sutarties atsisakymo teisė</strong> ir{' '}
            <strong>2 metų atitikties garantija</strong> &mdash; čia pagal nutylėjimą{' '}
            <strong>netaikomos</strong>.
          </p>
          <p>
            Vietoj to Jūs gaunate: pirkėjo lėšų sulaikymą iki pristatymo ir galimybę per
            trumpą laikotarpį po pristatymo pradėti ginčą, jei kas nors negerai. Tais atvejais,
            kai pardavėjas faktiškai veikia kaip prekiautojas, gali būti taikomos Jūsų
            įstatyminės vartotojų teisės; žr. 14 skyrių (Ginčai dėl prekiautojo statuso).
          </p>
        </section>

        <section className="space-y-3">
          <h2 className={SECTION_HEADING_CLASS}>
            4. Pirkėjo įsipareigojimai
          </h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>Apmokėti nurodytą prekės kainą ir siuntimo išlaidas pirkimo metu.</li>
            <li>Pateikti tikslius pristatymo duomenis (įskaitant teisingą paštomatą).</li>
            <li>Nedelsiant patikrinti prekę po pristatymo ir patvirtinti gavimą paskyroje.</li>
            <li>
              Iškelti bet kokius ginčus per 8 skyriuje nurodytą terminą. Mes negalime
              nagrinėti problemų, apie kurias pranešta pasibaigus šiam terminui.
            </li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className={SECTION_HEADING_CLASS}>
            5. Pardavimas „Second Turn Games” platformoje
          </h2>
          <p>
            Norėdami parduoti platformoje, turite būti bent 18 metų amžiaus, gyventi
            Latvijoje, Lietuvoje arba Estijoje ir veikti kaip fizinis asmuo, parduodantis
            žaidimus iš savo asmeninės kolekcijos. Draudžiama parduoti vykdant ūkinę
            komercinę veiklą, prekybą ar profesinę veiklą.
          </p>
          <p>
            Pardavėjai turi papildomų įsipareigojimų pagal mūsų{' '}
            <Link href="/seller-terms/lt" className="link-brand">
              Pardavėjo sutartį
            </Link>
            . Sukurdami skelbimą patvirtinate, kad atitinkate aukščiau nurodytas taisykles
            ir sutinkate su šia sutartimi. Trumpai tariant, pardavėjai privalo:
          </p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Tiksliai aprašyti prekes, nurodant būklę, leidimą ir kalbą.</li>
            <li>
              Per trumpą laiką patvirtinti arba atmesti užsakymus ir laiku išsiųsti
              patvirtintus užsakymus.
            </li>
            <li>
              Saugiai supakuoti prekes. Pardavėjai atsako už žalą transportavimo metu,
              atsiradusią dėl netinkamo pakavimo.
            </li>
            <li>
              Sąžiningai bendrauti su pirkėjais ir spręsti ginčus per platformą.
            </li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className={SECTION_HEADING_CLASS}>
            6. Mokesčiai
          </h2>
          <p>
            Pirkėjai moka prekės kainą ir siuntimo išlaidas. Pirkėjams netaikomas joks
            atskiras paslaugų mokestis.
          </p>
          <p>
            Pardavėjai moka komisinį mokestį už sėkmingus pardavimus ir gauna uždarbį į
            platformos piniginę, kaip aprašyta{' '}
            <Link href="/seller-terms/lt" className="link-brand">
              Pardavėjo sutartyje
            </Link>
            .
          </p>
        </section>

        <section className="space-y-3">
          <h2 className={SECTION_HEADING_CLASS}>
            7. Siuntimas
          </h2>
          <p>
            Visos siuntos siunčiamos per <strong>„Unisend”</strong> paštomatų tinklą, kuris
            apima „Unisend”, „Latvijas Pasts” ir „uDrop” terminalus Latvijoje, Lietuvoje ir
            Estijoje. Palaikomas tarptautinis siuntimas tarp Baltijos šalių.
          </p>
          <p>
            Siuntimo kodas sugeneruojamas automatiškai po to, kai pardavėjas patvirtina
            užsakymą. Pardavėjai privalo naudoti pateiktą kodą visoms siuntoms, kad galėtume
            sekti siuntą ir spręsti ginčus.
          </p>
        </section>

        <section id="cancellations-refunds" className="space-y-3">
          <h2 className={SECTION_HEADING_CLASS}>
            8. Atšaukimai, grąžinimai ir ginčai
          </h2>

          <h3 className={LEGAL_SUB_HEADING_CLASS}>Užsakymų atšaukimas</h3>
          <p>
            Pardavėjas gali atmesti užsakymą per trumpą patvirtinimo laikotarpį. Jei
            pardavėjas neatsako arba neišsiunčia prekės laiku, užsakymas gali būti atšauktas
            automatiškai, o pirkėjui grąžinami visi pinigai. Pirkėjai negali atšaukti
            užsakymo po apmokėjimo &mdash; apmokėti užsakymai yra privalomi.
          </p>

          <h3 className={LEGAL_SUB_HEADING_CLASS}>Grąžinimai ir keitimai</h3>
          <p>
            Prekių grąžinimas ar keitimas nėra numatytas kaip standartinė galimybė. Visi
            pardavėjai yra privatūs asmenys, o kiekviena prekė yra unikali, todėl negalime
            pasiūlyti keitimo. Jei prekė pristatoma sugadinta arba neatitinka aprašymo,
            galite pradėti ginčą, kaip aprašyta toliau.
          </p>

          <h3 className={LEGAL_SUB_HEADING_CLASS}>Pinigų grąžinimas</h3>
          <p>
            Pinigai grąžinami, kai: (a) pardavėjas atšaukia arba atmeta užsakymą,
            (b) užsakymas automatiškai atšaukiamas dėl pardavėjo neveiksnumo, arba
            (c) ginčas išsprendžiamas Jūsų naudai. Pasikeitusi nuomonė nėra pagrindas
            pinigų grąžinimui. Pinigai grąžinami į pradinį mokėjimo būdą arba piniginės
            likutį.
          </p>

          <h3 className={LEGAL_SUB_HEADING_CLASS}>Ginčai</h3>
          <p>
            Po pristatymo turite trumpą laikotarpį pranešti mums, jei prekė pristatyta
            sugadinta, atsiųsta ne ta prekė arba ji neatitinka skelbimo aprašymo. Jei prekė
            nepristatoma per protingą laiką po išsiuntimo, mes galime pradėti ginčą Jūsų
            vardu. Ginčo metu pirkėjas ir pardavėjas turėtų bandyti išspręsti problemą per
            platformą; jei nepavyksta, bet kuri šalis gali paprašyti STG peržiūrėti situaciją
            ir priimti sprendimą.
          </p>
          <p className="text-xs text-semantic-text-muted">
            Dabartiniai terminai ginčams pradėti ir spręsti nurodyti mūsų{' '}
            <Link href="/help" className="link-brand">
              Pagalbos centre
            </Link>
            ; mes galime laikui bėgant keisti šiuos veiklos terminus, nekeisdami Jūsų
            pagrindinių teisių.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className={SECTION_HEADING_CLASS}>
            9. Draudžiamas turinys ir elgesys
          </h2>
          <p>
            Skelbimai turi būti skirti tik stalo žaidimams ir su jais tiesiogiai susijusiems
            priedams. Griežtai draudžiama parduoti suklastotas prekes, pavogtus daiktus ir
            prekes, kurios pažeidžia intelektinės nuosavybės ar kitas teises.
          </p>
          <p>
            Draudžiama naudoti platformą priekabiavimui, neteisėto turinio platinimui arba
            trukdyti paslaugos saugumui ar veikimui. Mes galime pašalinti turinį arba
            sustabdyti paskyras, pažeidžiančias šias taisykles.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className={SECTION_HEADING_CLASS}>
            10. Vartotojo turinys
          </h2>
          <p>
            Paskelbdami skelbimus, nuotraukas, aprašymus ar komentarus platformoje, Jūs
            suteikiate STG neišimtinę, neatlygintiną licenciją rodyti, kopijuoti ir platinti
            šį turinį platformoje siekiant užtikrinti prekyvietės veikimą. Jūs išliekate
            savo turinio savininku ir galite jį pašalinti ištrindami susijusį skelbimą arba
            paskyrą.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className={SECTION_HEADING_CLASS}>
            11. Prekyvietės funkcijos
          </h2>

          <h3 className={LEGAL_SUB_HEADING_CLASS}>Klausimai prie skelbimų</h3>
          <p>
            Kiekvienas skelbimas turi viešą komentarų skiltį, kurioje bet kas gali užduoti
            pardavėjui klausimą apie žaidimą. Komentarai turi būti susiję su tema ir
            pagarbūs. Galime pašalinti komentarus, kurie pažeidžia šias Sąlygas arba
            galiojančius įstatymus.
          </p>

          <h3 className={LEGAL_SUB_HEADING_CLASS}>Aukcionai</h3>
          <p>
            Kai kurie skelbimai gali būti aukciono formato. Statymai yra privalomi: jei
            Jūsų statymas laimi, Jūs įsipareigojate pirkti už tą kainą ir privalote
            sumokėti per nurodytą laiką. Pardavėjai, pasirinkę aukciono formatą, privalo
            laikytis laimėjusio statymo, jei buvo atliktas bent vienas statymas. Išsamias
            aukciono taisykles rasite{' '}
            <Link href="/help" className="link-brand">
              Pagalbos centre
            </Link>
            .
          </p>

          <h3 className={LEGAL_SUB_HEADING_CLASS}>Pageidavimų skelbimai</h3>
          <p>
            Pageidavimų skelbimai leidžia pranešti apie susidomėjimą žaidimu. Kai toks
            žaidimas bus įkeltas į platformą, galime Jus informuoti, tačiau tai nėra prekės
            rezervacija ar įsipareigojimas pirkti. Pardavėjai neprivalo priimti pasiūlymų
            iš pageidavimų skelbimų. Standartinės užsakymų ir ginčų taisyklės pradedamos
            taikyti tik tada, kai pateikiate faktinį užsakymą.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className={SECTION_HEADING_CLASS}>
            12. Paskyros arba paslaugų teikimo pabaiga
          </h2>

          <h3 className={LEGAL_SUB_HEADING_CLASS}>Paskyros panaikinimas Jūsų iniciatyva</h3>
          <p>
            Savo paskyrą galite uždaryti bet kuriuo metu paskyros nustatymuose. Prieš
            uždarant paskyrą, turite atšaukti arba užbaigti visus aktyvius skelbimus ir
            vykdomus užsakymus, išsiimti teigiamą piniginės likutį ir išspręsti visus
            atvirus ginčus. Kai uždarote paskyrą, mes anonimizuojame Jūsų profilį bei viešą
            turinį ir ištriname prisijungimo duomenis. Įrašai, kuriuos privalome saugoti
            pagal įstatymus (pavyzdžiui, užbaigti užsakymai ir sąskaitos faktūros), saugomi
            mūsų{' '}
            <Link href="/privacy/lt" className="link-brand">
              Privatumo politikoje
            </Link>{' '}
            nurodytą laikotarpį.
          </p>

          <h3 className={LEGAL_SUB_HEADING_CLASS}>Paskyros panaikinimas mūsų iniciatyva</h3>
          <p>
            Mes galime sustabdyti arba panaikinti Jūsų paskyrą, pašalinti skelbimus arba
            įšaldyti piniginės likutį, jei turime pagrįstą pagrindą manyti, kad pažeidėte
            šias Sąlygas arba Pardavėjo sutartį, užsiėmėte sukčiavimu ar melagingos
            informacijos teikimu, pakartotinai neišsiuntėte prekių ar neatsakėte į
            užsakymus, sukėlėte įtarimų dėl pinigų plovimo prevencijos, sankcijų ar
            sukčiavimo kontrolės, arba pakenkėte mums ar kitam vartotojui. Jei nutraukiame
            sutartį dėl Jūsų kaltės, teigiamas piniginės likutis gali būti sulaikytas tam
            tikram laikotarpiui galimiems lėšų grąžinimams (chargebacks) ar pretenzijoms
            padengti.
          </p>

          <h3 className={LEGAL_SUB_HEADING_CLASS}>Platformos sprendimų apskundimas</h3>
          <p>
            Jei imamės veiksmų prieš Jūsų paskyrą ar turinį (pavyzdžiui, sustabdymas,
            panaikinimas, skelbimo pašalinimas arba piniginės likučio įšaldymas), turite
            teisę nemokamai apskųsti mūsų sprendimą. Norėdami pateikti apeliaciją, rašykite
            el. paštu{' '}
            <a href="mailto:info@secondturn.games" className="link-brand">
              info@secondturn.games
            </a>{' '}
            su tema „Apeliacija” ir sprendimo nuoroda. Jūsų apeliaciją peržiūrės kvalifikuoti
            darbuotojai, ne vien tik automatizuotos priemonės. Apie savo pagrįstą sprendimą
            informuosime Jus per Reglamento (ES) 2022/2065 (Skaitmeninių paslaugų aktas)
            20 straipsnyje nustatytus terminus.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className={SECTION_HEADING_CLASS}>
            13. Atsakomybės apribojimas
          </h2>
          <p>
            Tiek, kiek tai leidžia galiojantys įstatymai, bendra STG atsakomybė už bet
            kokią pretenziją, kylančią iš šių Sąlygų, neviršija bendros sumos, kurią Jūs
            mums sumokėjote per dvylika mėnesių iki įvykio, dėl kurio kilo pretenzija.
            Platforma teikiama tokios būklės, kokia ji yra („as is”),{' '}
            <strong>
              išskyrus atvejus, kai imperatyvios vartotojų apsaugos ar kitos taikytinos
              teisės normos numato kitaip.
            </strong>{' '}
            STG sujungia pirkėjus ir pardavėjus, tačiau nėra pati pardavimo sandorio šalis;
            mes neteikiame atskirų garantijų dėl pardavėjų siūlomų prekių būklės,
            autentiškumo ar kokybės,{' '}
            <strong>išskyrus garantijas, kurias mums nustato privalomi įstatymai.</strong>
          </p>
          <p>Niekas šiose Sąlygose neapriboja ir neatleidžia nuo atsakomybės už:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>mirtį ar sužalojimą dėl aplaidumo,</li>
            <li>sukčiavimą ar apgaulingą klaidinimą,</li>
            <li>
              bet kokią kitą atsakomybę, kurios negalima išskirti ar apriboti pagal
              Latvijos vartotojų apsaugos įstatymus arba atitinkamas privalomas Jūsų
              nuolatinės gyvenamosios vietos šalies vartotojų apsaugos taisykles, arba
            </li>
            <li>
              bet kokią įstatyminę atsakomybę, kurią turime kaip tarpininkavimo paslaugų
              teikėjas pagal Reglamentą (ES) 2022/2065 arba atitinkamus nacionalinius
              įstatymus.
            </li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className={SECTION_HEADING_CLASS}>
            14. Taikytina teisė ir ginčai
          </h2>
          <p>
            Šioms Sąlygoms taikoma Latvijos Respublikos teisė. Rygos (Latvija) teismai
            turi jurisdikciją spręsti ginčus, kylančius iš šių Sąlygų arba naudojimosi
            platforma, nepažeidžiant: (a) privalomų Jūsų nuolatinės gyvenamosios vietos
            šalies vartotojų apsaugos taisyklių pagal Reglamento (EB) Nr. 593/2008
            6 straipsnį ir (b) Jūsų, kaip vartotojo, teisės kreiptis į savo nuolatinės
            gyvenamosios vietos šalies teismus pagal Reglamento (ES) Nr. 1215/2012
            18 straipsnį.
          </p>
          <p>
            Kilus nusiskundimui, prašome pirmiausia susisiekti su mumis adresu{' '}
            <a href="mailto:info@secondturn.games" className="link-brand">
              info@secondturn.games
            </a>
            . Jei nepavyks ginčo išspręsti tarpusavyje, galite kreiptis į vartotojų apsaugos
            instituciją savo gyvenamojoje šalyje:
          </p>
          <ul className="list-disc pl-6 space-y-1">
            <li>
              <strong>Latvijoje:</strong> Patērētāju tiesību aizsardzības centrs (PTAC),
              Brīvības 55, Ryga, LV-1010 &mdash;{' '}
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
              <strong>Lietuvoje:</strong> Valstybinė vartotojų teisių apsaugos tarnyba (VVTAT) &mdash;{' '}
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
              <strong>Estijoje:</strong> Tarbijakaitse ja Tehnilise Järelevalve Amet (TTJA) &mdash;{' '}
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
            ES elektroninė ginčų sprendimo (EGS) platforma buvo panaikinta 2025 m.
            liepos 20 d. pagal Reglamentą (ES) 2024/3228 ir nebėra prieinama.
          </p>

          <h3 className={LEGAL_SUB_HEADING_CLASS}>Ginčai dėl prekiautojo statuso</h3>
          <p>
            Jei pirkėjo ir pardavėjo ginčas priklauso nuo to, ar pardavėjas tikrai yra
            prekiautojas pagal Direktyvą 2011/83/ES, mes įvertinsime pardavėjo veiklą pagal
            mūsų vidinius kriterijus, informuosime pirkėją apie rezultatus ir, jei manysime,
            kad pardavėjas tikriausiai yra prekiautojas, padėsime pirkėjui pasinaudoti jo
            įstatyminėmis teisėmis, įskaitant pinigų grąžinimą, kai taikoma sutarties
            atsisakymo teisė. Mūsų vertinimas nėra privalomas teismams ar vartotojų apsaugos
            institucijoms.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className={SECTION_HEADING_CLASS}>
            15. Sąlygų pakeitimai
          </h2>
          <p>
            Mes galime atnaujinti šias Sąlygas.{' '}
            <strong>
              Apie bet kokius mokesčių, komisinių, pinigų grąžinimo politikos, ginčų
              procedūros, atsakomybės ribų ar paskyros nutraukimo pagrindų pakeitimus
              registruotus vartotojus informuosime el. paštu likus bent 14 dienų iki
              pakeitimų įsigaliojimo. Apie nedidelius pakeitimus (rašybos klaidų taisymai,
              paaiškinimai, kurie nemažina Jūsų teisių) paskelbsime naują versiją su
              pakeitimų sąrašu.
            </strong>{' '}
            Tęsdami naudojimąsi platforma po pakeitimų įsigaliojimo datos, Jūs sutinkate su
            atnaujintomis Sąlygomis.{' '}
            <strong>
              Pakeitimai netaikomi atgaline data užsakymams, pateiktiems iki įsigaliojimo
              datos. Tokiems užsakymams taikomos jų pateikimo metu galiojusios Sąlygos.
            </strong>
          </p>
        </section>

        <section className="space-y-3">
          <h2 className={SECTION_HEADING_CLASS}>
            16. Kontaktinė informacija ir informacija pagal Skaitmeninių paslaugų aktą
          </h2>
          <p>
            Turite klausimų apie šias Sąlygas? Susisiekite su mumis adresu{' '}
            <a href="mailto:info@secondturn.games" className="link-brand">
              info@secondturn.games
            </a>{' '}
            arba apsilankykite mūsų{' '}
            <Link href="/contact" className="link-brand">
              kontaktų puslapyje
            </Link>
            .
          </p>
          <p>
            <strong>Vienintelis kontaktinis punktas pagal Skaitmeninių paslaugų aktą.</strong>{' '}
            <a href="mailto:info@secondturn.games" className="link-brand">
              info@secondturn.games
            </a>{' '}
            yra mūsų paskirtas elektroninis vienintelis kontaktinis punktas bendravimui su
            vartotojais pagal Reglamento (ES) 2022/2065 (Skaitmeninių paslaugų aktas)
            12 straipsnį. Naudokite šį adresą tiesioginiam bendravimui bet kuria mūsų
            vartotojų kalba (anglų, latvių, lietuvių arba estų) visais su DSA susijusiais
            klausimais.
          </p>
          <p>
            <strong>Kontaktinis punktas institucijoms.</strong> Pagal Reglamento (ES)
            2022/2065 11 straipsnį vienintelis kontaktinis punktas valstybių narių
            institucijoms, Europos Komisijai ir Europos skaitmeninių paslaugų valdybai yra{' '}
            <a href="mailto:info@secondturn.games" className="link-brand">
              info@secondturn.games
            </a>
            . Bendrauti galima anglų arba latvių kalbomis.
          </p>

          <h3 className={LEGAL_SUB_HEADING_CLASS}>Pranešimas apie neteisėtą turinį</h3>
          <p>
            Bet kas gali mums pranešti apie „Second Turn Games” platformoje esantį turinį,
            kurį laiko neteisėtu. Naudokite formą{' '}
            <Link href="/report-illegal-content" className="link-brand">
              secondturn.games/report-illegal-content
            </Link>{' '}
            arba rašykite el. paštu{' '}
            <a href="mailto:info@secondturn.games" className="link-brand">
              info@secondturn.games
            </a>
            . Galiojančiame pranešime turi būti nurodytas turinys (URL arba skelbimo ID),
            paaiškinta, kodėl manote, kad jis yra neteisėtas, nurodytas Jūsų vardas ir
            el. pašto adresas bei patvirtinta, kad informacija yra tiksli pagal Jūsų
            geriausią žinojimą. Pranešimai apie įtariamą vaikų seksualinio išnaudojimo
            medžiagą gali būti pateikiami anonimiškai. Greitai patvirtiname galiojančius
            pranešimus ir, kai to reikalaujama, imamės veiksmų be nepagrįsto delsimo.
            Atrankai naudojame automatizuotus įrankius, tačiau kiekvieną sprendimą pašalinti
            ar apriboti turinį peržiūri žmogus. Apie sprendimą ir jo priežastis informuojame
            tiek pranešėją, tiek susijusį vartotoją pagal Reglamento (ES) 2022/2065
            17 straipsnį.
          </p>

          <h3 className={LEGAL_SUB_HEADING_CLASS}>Pranešimai apie nusikalstamas veikas</h3>
          <p>
            Kai sužinome apie informaciją, keliančią įtarimą, kad buvo įvykdyta, vykdoma
            arba gali būti įvykdyta nusikalstama veika, kelianti grėsmę asmens gyvybei ar
            saugumui, nedelsdami informuosime atitinkamos valstybės narės teisėsaugos
            institucijas pagal Reglamento (ES) 2022/2065 18 straipsnį.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className={SECTION_HEADING_CLASS}>
            17. Kalba
          </h2>
          <p>
            Šių Sąlygų vertimai gali būti pateikti kitomis kalbomis Jūsų patogumui. Anglų
            kalbos versija yra teisiškai įpareigojanti pirminė versija. Bet kokio
            neatitikimo ar prieštaravimo tarp anglų kalbos versijos ir bet kokio vertimo
            atveju vyrauja anglų kalbos versija.
          </p>
        </section>

        <p className="text-sm text-semantic-text-muted pt-4 border-t border-semantic-border-subtle">
          Taip pat žr. mūsų{' '}
          <Link href="/privacy/lt" className="link-brand">
            Privatumo politiką
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
