# Kaulinio cemento laikmatis

Lietuviška statinė svetainė operacinės monitoriui ir telefonui. Matuoja praėjusį laiką nuo paspaudimo „Pradėti maišymą“. Personalas rankiniu būdu žymi etapus; paskutinė žyma užbaigia ciklą. Kitam ciklui reikia patvirtinti ankstesnio ciklo išvalymą.

Tai pagalbinis chronometras, ne klinikinio sprendimo priemonė. Nėra numatytųjų stingimo laikų ar automatinio stingimo nustatymo. Naudokite gamintojo instrukciją ir operacinės protokolą, o prieš klinikinį naudojimą patikrinkite darbo eigą ir turėkite atsarginį laikmatį. Išjungtame arba užrakintame ekrane rodinio nematysite.

Ciklas saugomas naršyklėje; nėra pacientų duomenų laukų, serverio duomenų bazės, analitikos ar sinchronizacijos tarp įrenginių. Skirtinguose įrenginiuose atverti laikmačiai nepriklausomi. Atkuriant po perkrovimo naudojamas įrenginio sistemos laikas, todėl neteisingas ar pakeistas sistemos laikas gali iškreipti rodmenis.

## Paleidimas ir diegimas

Lokaliai: `python3 -m http.server 8080 --bind 127.0.0.1 --directory public`, tada atidarykite <http://127.0.0.1:8080>.

Į Cloudflare Pages keliamas tik `public/` katalogas; kompiliavimo žingsnio ir aplinkos kintamųjų nėra.
