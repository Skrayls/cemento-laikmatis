# CEMENT TIMER PRO

Lietuviškas cemento paruošimo chronometras su proporcinga tyrimo orientyrų laiko juosta, OR režimu ir veikimu be ryšio.

**Nevaliduota medicinos priemonė. Neskirta pacientų priežiūrai ar klinikiniams sprendimams.**

## Produktai ir temperatūra

- **Bendras PMMA (numatytasis):** „SmartSet HV“ tyrimo orientyrai ties 20 °C: atskiras 30 s maišymo orientyras ir tyrimo rodmenys 148 ± 7 s bei 534 ± 17 s nuo maišymo pradžios. 386 ± 21 s yra intervalas, ne atskiras taškas.
- **Refobacin Bone Cement R** ir **Hi-Fatigue G:** istoriniai IFU ir apytiksliai grafiko orientyrai, be interpoliacijos. [Šaltiniai ir taikymo ribos](docs/cement-research.md).

## Paleidimas ir patikra

Rekomenduojama Node.js 24. Įdiekite dev priklausomybes ir „Playwright“ naršyklę:

```sh
npm ci
npx playwright install chromium
npm run build
python3 -m http.server 8080 --bind 127.0.0.1 --directory dist
```

Atidarykite <http://127.0.0.1:8080>. „Service worker“ reikia HTTPS arba localhost. Šaltiniai yra `public/`, o diegimui naudojamas sukurtas `dist/`. [Testų ir patikros instrukcijos](docs/testing.md).

## Cloudflare Pages

Projektas statinis, be serverio, analitikos ir pacientų duomenų. Kurkite iš peržiūrėto Git SHA su `npm ci && npm run build`. Keliamas tik `dist/`; naudokite esamo „Direct Upload“ projekto **peržiūros** šaką, o ne `main`. Pavyzdys autentifikuotoje „Wrangler“ aplinkoje:

```sh
npx wrangler pages deploy dist --project-name openclaw-cemento-laikmatis --branch cement-timer-pro
```

Peržiūrą tikrinkite atskirame naršyklės profilyje. Į produkciją nediekite ir klinikinėje aplinkoje nenaudokite, kol neįvykdyti [validavimo ir reguliacinės peržiūros reikalavimai](docs/clinical-safety.md).

## Ribojimai

Pirmam apsilankymui reikia ryšio; vėliau PWA gali veikti neprisijungus, kol naršyklė išsaugo talpyklą. Įrenginio užrakinimas, perkrova ir naršyklės sustabdymas gali sutrikdyti rodymą ar laiko patikimumą. Po perkrovimo atkuriamas paskutinis išsaugotas taškas, o ne spėjamas laikas nuo maišymo pradžios. Jei laikas nepatikimas, automatinė fazių pagalba nerodoma. Nėra sinchronizacijos tarp įrenginių. [Laiko variklis ir profilių plėtra](docs/timing-engine.md).
