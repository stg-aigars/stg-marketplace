import Link from 'next/link';
import { Card, CardBody, CardHeader } from '@/components/ui';
import { CARD_SUBSECTION_HEADING_CLASS, PAGE_HEADING_CLASS, SECTION_HEADING_CLASS } from '@/lib/heading-classes';
import { LEGAL_SUB_HEADING_CLASS } from '@/lib/legal/page-classes';
import {
  LEGAL_ENTITY_NAME,
  LEGAL_ENTITY_VAT_NUMBER,
  LEGAL_ENTITY_BANK_NAME,
  PSP_TECHNICAL_PROVIDER_NAME,
  PSP_TECHNICAL_PROVIDER_REG_NUMBER,
} from '@/lib/constants';
import { cn } from '@/lib/cn';

export default function SellerTermsLt() {
  return (
    <>
      <h1 className={cn(PAGE_HEADING_CLASS, 'mb-6')}>
        Pardavėjo sutartis
      </h1>

      <div className="prose prose-sm max-w-none text-semantic-text-secondary space-y-6">
        <p className="text-semantic-text-secondary">
          Paskutinį kartą atnaujinta: 2026 m. gegužės 13 d.
        </p>

        <Card className="not-prose">
          <CardHeader>
            <h2 className={CARD_SUBSECTION_HEADING_CLASS}>
              Trumpa apžvalga
            </h2>
            <p className="text-xs text-semantic-text-muted mt-0.5">
              Versija paprasta kalba pardavėjams. Norėdami susipažinti su visomis taisyklėmis, skaitykite toliau.
            </p>
          </CardHeader>
          <CardBody>
            <ul className="list-disc pl-5 space-y-2 text-sm text-semantic-text-secondary">
              <li>
                Jums turi būti bent 18 metų, Jūs turite gyventi Latvijoje, Lietuvoje arba
                Estijoje ir parduoti žaidimus iš savo asmeninės stalo žaidimų kolekcijos.
                Įmonės ar perpardavinėtojai platformoje veikti negali.
              </li>
              <li>
                Kai sukuriate skelbimą, Jūs paskiriate {LEGAL_ENTITY_NAME} savo komercijos
                agentu, kad šis surinktų pirkėjo mokėjimą ir išmokėtų jį Jums po pristatymo
                bei pasibaigus ginčų sprendimo laikotarpiui.
              </li>
              <li>
                Mes taikome 10% komisinį mokestį nuo prekės kainos (ne nuo siuntimo
                išlaidų). Jūsų uždarbis patenka į platformos piniginę, iš kurios lėšas
                galite persivesti į Jums priklausančią banko sąskaitą.
              </li>
              <li>
                Jūs privalote operatyviai patvirtinti arba atmesti užsakymus, laiku išsiųsti
                priimtus užsakymus naudojant „Unisend” kodą, saugiai supakuoti žaidimus ir
                sąžiningai aprašyti jų būklę. Neteisingas informacijos pateikimas ar
                pasikartojančios problemos gali lemti pinigų grąžinimą pirkėjui, mokėjimų
                atšaukimą (chargebacks) arba pardavimo teisių praradimą.
              </li>
              <li>
                Kai per kalendorinius metus pasieksite 30 pardavimų arba &euro;2000 sumą,
                mes privalome pranešti apie Jūsų veiklą Latvijos mokesčių institucijai
                (DAC7). Mes paprašysime Jūsų mokestinių duomenų prieš pasiekiant šią ribą,
                kad ataskaita būtų išsami.
              </li>
              <li>
                Mes galime atidėti išmokas, įšaldyti Jūsų piniginę arba sustabdyti Jūsų
                pardavimo teises, jei pastebėsime sukčiavimą, padirbtas prekes, pinigų
                plovimo prevencijos (AML) ar sankcijų pažeidimus arba rimtus taisyklių
                nusižengimus. Jūs turite teisę apskųsti bet kurį tokį sprendimą.
              </li>
              <li>
                Jūs liekate atsakingi už savo pardavimo pajamų deklaravimą ir visų Jums
                taikomų PVM ar kitų mokestinių prievolių vykdymą.
              </li>
            </ul>
          </CardBody>
        </Card>

        <section className="space-y-3">
          <h2 className={SECTION_HEADING_CLASS}>
            1. Santykiai tarp Jūsų ir STG
          </h2>
          <p>
            Ši Pardavėjo sutartis papildo bendrąsias{' '}
            <Link href="/terms/lt" className="link-brand">
              Paslaugų teikimo sąlygas
            </Link>{' '}
            ir yra taikoma, kai Jūs pateikiate žaidimus pardavimui „Second Turn Games”
            platformoje. Konflikto atveju ši Pardavėjo sutartis yra viršesnė sprendžiant
            klausimus, susijusius konkrečiai su pardavimu.
          </p>
          <p>
            Sukurdami skelbimą arba įjungdami pardavimo funkcijas, Jūs paskiriate{' '}
            {LEGAL_ENTITY_NAME} savo komercijos agentu, siekiant gauti mokėjimus iš
            pirkėjų ir išmokėti Jums gautas pajamas, kaip aprašyta šioje Sutartyje. Mes
            veikiame Jūsų vardu ir Jūsų interesais surinkdami pirkėjo lėšas ir grąžindami
            pinigus pirkėjui, jei ginčas išsprendžiamas Jūsų nenaudai.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className={SECTION_HEADING_CLASS}>
            2. Tinkamumas ir taisyklė „tik privatiems pardavėjams”
          </h2>
          <p>
            Norėdami parduoti „Second Turn Games” platformoje, Jūs turite būti 18 metų ar
            vyresni ir gyventi Latvijoje, Lietuvoje arba Estijoje. Pateikdami prekes
            pardavimui, Jūs patvirtinate, kad atitinkate šiuos reikalavimus.
          </p>
          <p>
            Ši platforma skirta privatiems asmenims, parduodantiems savo asmenines stalo
            žaidimų kolekcijas. Jūs negalite čia teikti skelbimų vykdydami verslą, prekybą
            ar profesinę veiklą &ndash; tai apima mažmenininkus, perpardavinėtojus,
            platintojus, didmenininkus ir aukcionų namus. Taip pat negalite parduoti
            prekių, kurias įsigijote pirmiausia tam, kad perparduotumėte jas siekdami
            pelno.
          </p>
          <p>
            Jei turime pagrindo manyti, kad Jūs veikiate kaip prekiautojas, galime
            paprašyti Jūsų patvirtinti privatų Jūsų veiklos pobūdį ir pateikti papildomą
            informaciją. Galime sustabdyti arba uždaryti Jūsų paskyrą arba apriboti Jūsų
            pardavimo teises, jei Jūs nebendradarbiaujate arba jei pagrįstai padarome
            išvadą, kad Jūs vykdote verslą per šią platformą.
          </p>
          <p>
            Jei manote, kad esate arba tapote prekiautoju pagal Direktyvą 2011/83/ES
            (Vartotojų teisių direktyva), nedelsdami praneškite mums adresu{' '}
            <a href="mailto:info@secondturn.games" className="link-brand">
              info@secondturn.games
            </a>
            , nustokite kurti naujus skelbimus ir užbaikite visus atvirus užsakymus
            laikydamiesi prekiautojo prievolių, kurias nustato ši Direktyva, įskaitant 14
            dienų sutarties atsisakymo teisę Jūsų pirkėjams.
          </p>
          <p>
            <strong>Prekiautojų patikra.</strong> Jei naudojatės platforma profesiniais ar
            komerciniais tikslais, ES teisės aktai reikalauja, kad mes patikrintume Jūsų
            tapatybę ir kontaktinius duomenis prieš Jums paskelbiant prekes. Tai apima
            Jūsų vardo, pavardės, adreso ir telefono numerio surinkimą ir patikrinimą bei
            savarankišką patvirtinimą, kad siūlysite tik tuos produktus, kurie atitinka
            taikomus ES teisės aktus. Galime paprašyti patvirtinančių dokumentų ir
            atidėti arba atmesti skelbimus, kol patikra bus nebaigta. Galime sustabdyti
            bet kurį pardavėją, kuris nepraeina mūsų patikros arba pateikia klaidinančią
            informaciją. Tai yra prievolė, kurią mums, kaip platformai, nustato Reglamento
            (ES) 2022/2065 (Skaitmeninių paslaugų aktas) 30 straipsnis.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className={SECTION_HEADING_CLASS}>
            3. Mokėjimo įgaliojimas ir srautas
          </h2>
          <p>
            Kai pateikiate prekę pardavimui, Jūs įgaliojate {LEGAL_ENTITY_NAME} priimti
            mokėjimus iš pirkėjų Jūsų vardu. Mokėjimus apdoroja {LEGAL_ENTITY_BANK_NAME},
            Latvijos kredito įstaiga, veikianti kaip mūsų mokėjimo paslaugų teikėjas.
            Techninę platformą „Swedbank” vardu valdo {PSP_TECHNICAL_PROVIDER_NAME}{' '}
            (registruota Estijoje, reg. Nr. {PSP_TECHNICAL_PROVIDER_REG_NUMBER}).
          </p>
          <p>
            Pirkėjo lėšos laikomos prekyvietės sąskaitoje ir išmokamos Jums tik tada, kai
            patvirtinamas pristatymas ir pasibaigia ginčų sprendimo laikotarpis, arba kitu
            atveju, kai sandoris užbaigiamas pagal mūsų ginčų sprendimo taisykles.
          </p>
          <p>
            Mes patys nesame mokėjimo įstaiga ir neturime mokėjimo paslaugų licencijos.
            Mūsų vaidmuo šiame sraute yra Jūsų vardu veikiantis komercijos agentas, ir mes
            remiamės Direktyvos (ES) 2015/2366 (PSD2) 3 straipsnio b punkto išimtimi. Jei
            paaiškėtų, kad ši išimtis netaikytina, mes perduosime mokėjimų srautą
            licencijuotai mokėjimo įstaigai.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className={SECTION_HEADING_CLASS}>
            4. Veiklos reikalavimai parduodant
          </h2>
          <p>Kai dėl Jūsų skelbimo pateikiamas užsakymas, Jūs privalote:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>
              Patvirtinti arba atmesti užsakymą per užsakymo ekrane nurodytą laiką. Laiku
              nepatvirtinti užsakymai automatiškai atšaukiami, pirkėjui grąžinant visą
              sumą.
            </li>
            <li>
              Išsiųsti prekę per nustatytą siuntimo laikotarpį po to, kai priimate
              užsakymą. Laiku neišsiųsti užsakymai gali būti automatiškai atšaukti, o
              pirkėjui grąžinti pinigai.
            </li>
            <li>
              Visiems pristatymams naudoti pateiktą „Unisend” siuntimo kodą, kad siuntos
              sekimas ir ginčų sprendimas veiktų teisingai.
            </li>
            <li>
              Saugiai supakuoti prekes, naudojant tinkamą apsaugą dėžėms, komponentams ir
              instrukcijoms. Jūs atsakote už žalą transportavimo metu, atsiradusią dėl
              netinkamo pakavimo.
            </li>
            <li>
              Tiksliai aprašyti prekes, nurodant būklę, leidimą, kalbą ir bet kokius
              trūkumus, pavyzdžiui, trūkstamas dalis ar sugadintus komponentus.
              Klaidinantys aprašymai gali lemti ginčus, pinigų grąžinimą arba Jūsų
              pardavimo teisių sustabdymą.
            </li>
          </ul>
          <p className="text-xs text-semantic-text-muted">
            Praktinių pavyzdžių ir informaciją apie šiuo metu taikomus terminus rasite
            mūsų{' '}
            <Link href="/help" className="link-brand">
              Pagalbos centre
            </Link>
            .
          </p>

          <h3 className={LEGAL_SUB_HEADING_CLASS}>Aukcionų skelbimai</h3>
          <p>
            Jei žaidimą parduodate aukcione, be aukščiau nurodytų taisyklių taikomos ir
            šios:
          </p>
          <ul className="list-disc pl-6 space-y-1">
            <li>
              Atsiimti aukciono skelbimą galite tik tol, kol jame nėra statymų. Kai tik
              atliekamas bent vienas statymas, Jūs privalote laikytis aukciono sąlygų ir
              parduoti žaidimą didžiausią kainą pasiūliusiam dalyviui.
            </li>
            <li>
              Jei laimėjęs dalyvis nesumoka per nurodytą mokėjimo laikotarpį, platforma
              gali atšaukti skelbimą ir grąžinti žaidimą į Jūsų inventorių. Užsakymas
              nėra sukuriamas, kol mokėjimas nėra sėkmingas.
            </li>
          </ul>

          <h3 className={LEGAL_SUB_HEADING_CLASS}>Atitiktis pageidavimų skelbimams</h3>
          <p>
            Jei Jūsų įkeltas žaidimas atitinka aktyvų pirkėjo pageidavimų skelbimą, tas
            pirkėjas gali gauti pranešimą. Jūs neturite galimybės matyti pirkėjų
            pageidavimų skelbimų ir dėl šios atitikties Jums nekyla jokių specialių
            prievolių. Pardavimui taikomos tos pačios standartinės taisyklės kaip ir bet
            kuriam kitam skelbimui.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className={SECTION_HEADING_CLASS}>
            5. Mokesčiai ir komisiniai
          </h2>
          <p>
            STG taiko fiksuotą 10% komisinį mokestį nuo prekės kainos. Komisinis mokestis
            netaikomas siuntimo išlaidoms. Skelbimų įkėlimo mokesčių nėra.
          </p>
          <p>
            Pavyzdžiui, jei įkeliate prekę už &euro;20,00, komisinis mokestis yra
            &euro;2,00 ir Jūs gaunate &euro;18,00. Pirkėjas prekės kainą ir siuntimo
            išlaidas moka atskirai.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className={SECTION_HEADING_CLASS}>
            6. Piniginė ir išmokos
          </h2>
          <p>
            Jūsų uždarbis (prekės kaina atėmus 10% komisinį mokestį) įskaitomas į Jūsų
            platformos piniginę po užsakymo užbaigimo. Užsakymas laikomas užbaigtu, kai
            pirkėjas patvirtina pristatymą arba kai pasibaigia ginčų sprendimo laikotarpis
            nekeliant ginčo.
          </p>
          <p>
            Jūs galite persivesti piniginės likutį į savo banko sąskaitą (IBAN). Išmokos
            paprastai apdorojamos per 1&ndash;3 darbo dienas po patvirtinimo, tačiau
            bankų apdorojimo laikas nuo mūsų nepriklauso.
          </p>

          <h3 className={LEGAL_SUB_HEADING_CLASS}>Valiuta</h3>
          <p>Visos sumos Jūsų piniginėje laikomos eurais (EUR).</p>

          <h3 className={LEGAL_SUB_HEADING_CLASS}>Tapatybės patikra</h3>
          <p>
            Prieš pirmąją išmoką Jums gali tekti patvirtinti savo tapatybę ir įrodyti, kad
            IBAN priklauso Jums. Tai yra „Pažink savo klientą” (Know Your Customer)
            patikra, kurią atlieka mūsų mokėjimų apdorotojas. Jums gali tekti atsiųsti
            valstybės išduotą asmens tapatybės dokumentą. Galime atmesti arba atidėti
            išmoką, kol patikra bus nebaigta.
          </p>

          <h3 className={LEGAL_SUB_HEADING_CLASS}>Mokėjimų atšaukimai ir išskaičiavimas</h3>
          <p>
            Jei pirkėjas sėkmingai užginčija užbaigtą užsakymą po to, kai Jūs jau
            išsiėmėte pinigus, Jūs sutinkate, kad (a) mes galime išskaičiuoti atitinkamą
            sumą iš Jūsų būsimo piniginės likučio ar pardavimo pajamų, ir (b) jei Jūsų
            piniginėje lėšų nepakanka, Jūs liekate mums skolingi trūkstamą sumą, kurią
            galime išieškoti per Jūsų nuolatinės gyvenamosios vietos teismus.
          </p>

          <h3 className={LEGAL_SUB_HEADING_CLASS}>Neigiamas likutis</h3>
          <p>
            Jei dėl pinigų grąžinimo, mokėjimo atšaukimo ar kito patikslinimo Jūsų
            piniginės likutis tampa neigiamas, privalote padengti trūkumą per 30 dienų
            nuo pranešimo gavimo, arba pervesdami lėšas į mūsų nurodytą banko sąskaitą,
            arba įskaitant tai iš būsimų pardavimų.
          </p>

          <h3 className={LEGAL_SUB_HEADING_CLASS}>Neaktyvios paskyros</h3>
          <p>
            Piniginės likučius saugome neribotą laiką. Jei neprisijungėte 24 mėnesius ir
            Jūsų likutis yra teigiamas, išsiųsime laišką Jūsų nurodytu el. pašto adresu.
            Jei per 90 dienų nesulauksime atsakymo, galime bandyti išsiųsti likutį į Jūsų
            paskutinį žinomą IBAN (po pakartotinio patvirtinimo). Bet kokios neatsiimtos
            lėšos lieka Jūsų nuosavybe, kurias išmokėsime Jums paprašius.
          </p>
        </section>

        <section id="suspension-and-risk-controls" className="space-y-3">
          <h2 className={SECTION_HEADING_CLASS}>
            7. Sustabdymas, nutraukimas ir rizikos valdymas
          </h2>
          <p>
            STG gali sustabdyti arba nutraukti Jūsų pardavimo teises arba visą Jūsų
            paskyrą, jei turime pagrįstų priežasčių manyti, kad Jūs:
          </p>
          <ul className="list-disc pl-6 space-y-1">
            <li>vykdėte sukčiavimą ar klaidinančią veiklą;</li>
            <li>
              pakartotinai neteisingai nurodėte prekės būklę ar detales arba atsisakėte
              spręsti pagrįstus ginčus;
            </li>
            <li>neišsiuntėte patvirtintų užsakymų per nustatytus terminus;</li>
            <li>patyrėte per daug mokėjimo atšaukimų ar ginčų;</li>
            <li>
              naudojote platformą komerciniam perpardavimui pažeisdami 2 skyrių; arba
            </li>
            <li>kitu būdu pakenkėte mums ar kitiems vartotojams.</li>
          </ul>
          <p>
            Sustabdymo ar nutraukimo atveju nebaigtos išmokos gali būti sulaikytos iki
            180 dienų, kad būtų padengti galimi mokėjimo atšaukimai, pinigų grąžinimai ar
            neišspręsti ginčai.
          </p>

          <h3 className={LEGAL_SUB_HEADING_CLASS}>
            Pinigų plovimo prevencija, sankcijos ir sukčiavimas
          </h3>
          <p>
            <strong>
              Esant pagrįstam pagrindui ir pranešus Jums, kai tik tai teisiškai leidžiama
              (pranešimas gali būti atidėtas, jei to reikalauja AML, sankcijų ar
              teisėsaugos institucijų įsipareigojimai), mes galime:
            </strong>{' '}
            (a) tikrinti sandorius, paskyras, IBAN ir identifikuojančią informaciją ES
            bei tarptautiniuose sankcijų sąrašuose, politiškai pažeidžiamų asmenų
            sąrašuose bei sukčiavimo duomenų bazėse; (b) sustabdyti Jūsų paskyrą,
            įšaldyti Jūsų piniginės likutį arba atsisakyti išmokėti lėšas, jei turime
            pagrįstų įtarimų dėl pinigų plovimo, terorizmo finansavimo, sankcijų vengimo
            ar sukčiavimo; (c) paprašyti Jūsų pateikti papildomą tapatybės informaciją,
            duomenis apie lėšų kilmę arba informaciją apie naudos gavėjus; ir (d)
            dalintis informacija su kompetentingomis institucijomis bei mūsų mokėjimų
            apdorotoju. Įstaigos, kurios reguliariai gauna tokius duomenis, yra
            išvardytos mūsų{' '}
            <Link href="/privacy/lt" className="link-brand">
              Privatumo politikos
            </Link>{' '}
            6 skyriuje. Pagal šį punktą įšaldytos lėšos lieka Jūsų nuosavybe ir yra
            atleidžiamos išsprendus klausimą, atsižvelgiant į bet kokį kompetentingos
            institucijos nurodymą.{' '}
            <strong>
              Jūs galite apskųsti bet kokį tokį veiksmą rašydami adresu
              info@secondturn.games. Asmuo, nepriėmęs pradinio sprendimo, peržiūrės skundą
              per 14 dienų ir atsakys raštu. Jei AML, sankcijų ar teisėsaugos
              įsipareigojimai neleidžia mums paaiškinti konkretaus veiksmo, informuosime
              Jus, kai šie įsipareigojimai nebetrukdys atskleisti informacijos.
            </strong>
          </p>
        </section>

        <section className="space-y-3">
          <h2 className={SECTION_HEADING_CLASS}>
            8. Mokesčiai ir sąskaitų faktūrų išrašymas
          </h2>

          <h3 className={LEGAL_SUB_HEADING_CLASS}>PVM nuo mūsų komisinio mokesčio</h3>
          <p>
            Mūsų 10% komisinis mokestis nuo prekės kainos yra elektroniniu būdu teikiama
            paslauga pagal Tarybos įgyvendinimo reglamento (ES) Nr. 282/2011 7
            straipsnį. Teikimo vieta nustatoma pagal Direktyvos 2006/112/EB 58 straipsnį
            (ten, kur yra pirkėjas, nesantis apmokestinamuoju asmeniu). PVM yra įtrauktas
            į Jūsų sąskaitoje faktūroje nurodytą 10% komisinį mokestį (nepridedamas
            papildomai) pagal Jūsų šalies tarifą: 21% Latvijai, 21% Lietuvai, 24%
            Estijai. Pavyzdžiui, &euro;2,00 komisinio mokesčio atveju Latvijoje tai yra
            &euro;1,65 neto plius &euro;0,35 PVM. Mūsų PVM mokėtojo kodas yra{' '}
            {LEGAL_ENTITY_VAT_NUMBER}.
          </p>

          <h3 className={LEGAL_SUB_HEADING_CLASS}>PVM už siuntimą</h3>
          <p>
            Kai organizuojame siuntimą per savo logistikos partnerius, mes perparduodame
            siuntimo paslaugą Jums pagal šalies, iš kurios prekės išsiunčiamos (Jūsų
            šalies), PVM tarifą. PVM yra įtrauktas į sąskaitoje nurodytą siuntimo
            mokestį (nepridedamas papildomai). Teikimo vieta nustatoma pagal Direktyvos
            2006/112/EB 49 ir 50 straipsnius, priklausomai nuo to, ar siunta yra vietinė,
            ar tarpvalstybinė.
          </p>

          <h3 className={LEGAL_SUB_HEADING_CLASS}>Sąskaitos faktūros</h3>
          <p>
            Po kiekvieno užbaigto užsakymo išrašome komisinio mokesčio ir siuntimo PVM
            sąskaitą faktūrą formatu <span className="font-mono">INV-YYYY-NNNNN</span>.
            Sąskaitos faktūros pateikiamos Jūsų paskyros skiltyje „Pardavimai” ir yra
            saugomos mūsų{' '}
            <Link href="/privacy/lt" className="link-brand">
              Privatumo politikos
            </Link>{' '}
            9 skyriuje nurodytais laikotarpiais.
          </p>

          <h3 className={LEGAL_SUB_HEADING_CLASS}>Jūsų pajamų mokestis</h3>
          <p>
            Jūs esate atsakingi už pardavimo pajamų deklaravimą savo šalies mokesčių
            institucijai, atsižvelgiant į ten taikomas privačių pardavėjų neapmokestinamąsias
            ribas. Mes neišskaičiuojame pajamų mokesčio Jūsų vardu ir neteikiame
            mokesčių konsultacijų.
          </p>

          <h3 className={LEGAL_SUB_HEADING_CLASS}>DAC7 atskaitomybė</h3>
          <p>
            Pagal Tarybos direktyvą (ES) 2021/514 (DAC7), mes privalome pranešti apie Jus
            Latvijos valstybinei mokesčių inspekcijai (VID), kai Jūsų veikla per
            kalendorinius metus viršija 30 pardavimų arba &euro;2000 atlygį (sumą, kurią
            gaunate po mūsų komisinio mokesčio). Šios ribos nustatytos Direktyvoje; mes
            negalime jų keisti. Prieš Jums pasiekiant šias ribas, paprašysime DAC7
            duomenų, kad ataskaita nebūtų sulaikyta. Mūsų vidinis įspėjimo slenkstis
            suveikia anksčiau &ndash; pasiekus 25 pardavimus arba &euro;1750. Mes prašome
            pateikti Jūsų pilną vardą ir pavardę, gimimo datą, adresą ir mokesčių mokėtojo
            kodą. Jei šių duomenų nepateiksite, mums gali tekti sustabdyti Jūsų pardavimus
            ir sulaikyti išmokas, kol duomenys bus pateikti. Jūs galite prašyti kopijos
            informacijos, kurią apie Jus pranešame.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className={SECTION_HEADING_CLASS}>
            9. Šios Sutarties pakeitimai
          </h2>
          <p>
            Mes galime atnaujinti šią Sutartį. Apie esminius pakeitimus (mokesčius,
            komisinių tarifus, pardavėjų prievoles) informuosime Jus el. paštu likus bent
            14 dienų iki jų įsigaliojimo. Tęsdami pardavimus po pranešimo laikotarpio, Jūs
            sutinkate su atnaujintomis sąlygomis.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className={SECTION_HEADING_CLASS}>
            10. Kalba
          </h2>
          <p>
            Šios Sutarties vertimai gali būti pateikti kitomis kalbomis Jūsų patogumui.
            Anglų kalbos versija yra teisiškai įpareigojanti pirminė versija. Bet kokio
            neatitikimo ar prieštaravimo tarp anglų kalbos versijos ir bet kokio vertimo
            atveju vyrauja anglų kalbos versija.
          </p>
        </section>

        <p className="text-sm text-semantic-text-muted pt-4 border-t border-semantic-border-subtle">
          Taip pat žr. mūsų{' '}
          <Link href="/terms/lt" className="link-brand">
            Paslaugų teikimo sąlygas
          </Link>{' '}
          ir{' '}
          <Link href="/privacy/lt" className="link-brand">
            Privatumo politiką
          </Link>
          .
        </p>
      </div>
    </>
  );
}
