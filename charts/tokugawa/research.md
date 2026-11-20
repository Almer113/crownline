# Tokugawa chart: research file

Status: draft for the owner's review. Nothing here has gone into a chart yet.
Researched 2026-11-18.

## 0. How to read this file

**Sources.** Every fact carries a source key, for example `[K:家康]`. Keys are listed in section 10. Most keys point to **Kotobank** (kotobank.jp), which hosts the full text of several standard Japanese reference works. Each citation names the work inside Kotobank:

| Abbrev. | Reference work (publisher) |
|---|---|
| Nipponica | 日本大百科全書 (Nihon Daihyakka Zensho), Shogakukan |
| Yamakawa | 山川 日本史小辞典 改訂新版, Yamakawa Shuppansha |
| Sekai | 改訂新版 世界大百科事典 (or the older edition, marked "old"), Heibonsha |
| NJD | デジタル版 日本人名大辞典+Plus, Kodansha |
| Brit | ブリタニカ国際大百科事典 小項目事典 |
| Daijisen | デジタル大辞泉, Shogakukan |
| Nikkoku | 精選版 日本国語大辞典, Shogakukan |
| Mypedia | 百科事典マイペディア, Heibonsha |
| Ōbunsha | 旺文社日本史事典 三訂版 |

**Scholarly English works not consulted.** I could not read Totman, Bolitho, or the *Cambridge History of Japan* online, so none of their facts are cited here. The Japanese reference works above are the scholarly base. Before publication it would be worth checking the shogun table against Totman, *Politics in the Tokugawa Bakufu* (1967), or *CHJ* vol. 4, especially the appointment dates.

**Dates.** Japanese sources give dates in the **lunar calendar** (旧暦), usually written as Western year + lunar month.day, e.g. Yamakawa "1603.2.12". **That month.day is lunar, not Gregorian.** I give:
- **Lunar**: as printed in the source (era name + year.month.day where I have it).
- **Gregorian**: converted date. These conversions come from English Wikipedia, used as a **pointer** only, and are marked `[conv.]`. I did not run each conversion myself. Japan adopted the Gregorian calendar on 1873-01-01, so later dates need no conversion.
- **Year trap.** A lunar date late in the 12th month falls in January or February of the *next* Gregorian year. This is why sources disagree on years for Ieyasu (1542/1543), Ieshige (1711/1712), Tadanaga (1633/1634), Hoshina Masayuki (1672/1673), Tenshōin (1835/1836), and Tokugawa Mitsusada (1626/1627). For a chart I recommend the **Gregorian year**, and the notes say so.

**Reign dates.** Shogun reigns run from the imperial appointment (将軍宣下, *shōgun senge*) to resignation or death. Where the death was announced late, Yamakawa ends the tenure on the announcement date. Both dates are given.

**Wikipedia.** It is used only as a pointer (Gregorian conversions, and a few wives' details) and is always marked `[WP pointer]`.

**[unverified]** means I could not confirm the fact in a source I read.

---

## 1. Houses and branches

| id | House | Kanji | Founded | Founder | Seat | Stipend | Mon (description only) | Sources |
|---|---|---|---|---|---|---|---|---|
| `house_main` | Tokugawa main line (sōke) | 徳川宗家 / 将軍家 | 1566 (Ieyasu takes the Tokugawa surname) [unverified]; shogunate 1603 | Tokugawa Ieyasu | Edo Castle | — | **Mitsuba aoi** (三つ葉葵): three hollyhock leaves arranged so their tips meet at the centre, usually in a circle | Mon: Daijisen [K:三つ葉葵]; 1566 surname change [unverified] |
| `house_matsudaira` | Matsudaira (Ieyasu's birth house, Okazaki) | 松平氏 | — | — | Okazaki Castle, Mikawa | — | [unverified] | Hirotada Okazaki lord: Nipponica [K:家康] |
| `house_owari` | Owari (gosanke) | 尾張徳川家 (尾州家) | 1607–1610 [unverified exact year] | Yoshinao (Ieyasu's 9th son) | Nagoya, Owari | 619,500 koku | Variant of mitsuba aoi [unverified detail] | Founder, seat, stipend: Daijisen, Nipponica [K:御三家]; [K:義直] |
| `house_kii` | Kii (gosanke) | 紀伊徳川家 (紀州家) | 1619 (Wakayama) | Yorinobu (10th son) | Wakayama, Kii | 555,000 koku | Variant of mitsuba aoi [unverified detail] | Nipponica [K:頼宣], [K:御三家]; Brit [K:和歌山藩] |
| `house_mito` | Mito (gosanke) | 水戸徳川家 | 1609 | Yorifusa (11th son) | Mito, Hitachi | 250,000 koku in 1609 → 280,000 → 350,000 nominal from the 3rd lord | Variant of mitsuba aoi [unverified detail] | Nipponica [K:頼房], [K:御三家]; Mypedia [K:水戸藩] |
| `house_kofu` | Kōfu Tokugawa | 甲府徳川家 | 1661 | Tsunashige (3rd son of Iemitsu) | Kōfu, Kai (250,000 koku in all; only 144,000 in Kai itself) | 250,000 koku | [unverified] | Mypedia, Nipponica [K:甲府藩], Brit [K:綱重] |
| `house_tatebayashi` | Tatebayashi (Tsunayoshi's domain) | 館林 | 1661 | Tsunayoshi | Tatebayashi, Kōzuke | +100,000 koku in 1661 | — | Nipponica [K:綱吉] |
| `house_tayasu` | Tayasu (gosankyō) | 田安家 | 1729 / 1730 / 1731 (sources differ) | Munetake (Yoshimune's 2nd son) | Inside Tayasu Gate, Edo Castle | 100,000 koku (from 1746) | Variant of mitsuba aoi [unverified detail] | Nipponica, Yamakawa, Ōbunsha [K:田安家] |
| `house_hitotsubashi` | Hitotsubashi (gosankyō) | 一橋家 | 1740 / 1741 (sources differ) | Munetada (Yoshimune's 4th son) | Inside Hitotsubashi Gate, Edo Castle | 100,000 koku | Variant of mitsuba aoi [unverified detail] | Nipponica, Sekai, Yamakawa, Mypedia [K:一橋家] |
| `house_shimizu` | Shimizu (gosankyō) | 清水家 | 1758 / 1759 (sources differ) | Shigeyoshi (Ieshige's 2nd son) | Inside Shimizu Gate, Edo Castle | 100,000 koku | Variant of mitsuba aoi [unverified detail] | Nipponica, Yamakawa, NJD, Ōbunsha [K:清水家] |
| `house_aizu` | Aizu Matsudaira (Hoshina) | 会津松平家 (保科) | 1643 (Aizu, 230,000 koku) | Hoshina Masayuki | Aizu-Wakamatsu | 230,000 koku | The line was allowed the Matsudaira surname and the aoi crest in 1695 | Nipponica, Sekai (old) [K:保科正之] |

**House notes**
- **Gosanke** (御三家): the three houses founded by Ieyasu's 9th, 10th and 11th sons. If the shogun had no heir they had the right to supply one ("将軍に継嗣のない場合は将軍家を相続する権利を有した", Nipponica [K:御三家]).
- **Gosankyō** (御三卿): Tayasu, Hitotsubashi and Shimizu. They lived inside the Edo Castle gates of the same names and held 100,000 koku as a maintenance stipend, with rank modelled on the Owari and Kii houses (Yamakawa, Ōbunsha [K:御三卿]). They too could send an adopted heir to the main line (Sekai old [K:清水家]).
- **Mon detail.** Sources confirm the mitsuba aoi as the Tokugawa crest (Daijisen). I could not find a reference-work description of each branch's variant (leaf count, veins, rim), so all branch-variant cells are [unverified]. Don't draw distinct branch mon until a source is found; the Tokugawa Art Museum or the Tokugawa Kinen Zaidan would be good places to ask.

---

## 2. The fifteen shoguns

Ordinal = shogun number. "Lunar" dates are as printed in Japanese sources; "Greg." dates are `[conv.]` conversions taken from English Wikipedia as a pointer.

| # | id | Kanji | Print name | Other names / spellings | Born | Died | Reign (appointment → end) | Biological father (→ adoptive) | Principal wife (midaidokoro) | Card subtitle | Sources |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | `ieyasu` | 徳川家康 | Tokugawa Ieyasu | Childhood name Takechiyo 竹千代; earlier Matsudaira Motoyasu [unverified]; Buddhist name Ankoku-in 安国院; deified as **Tōshō Daigongen** 東照大権現 (1617) | Tenbun 11.12.26 (lunar, "1542"); Greg. 1543-01-31 [conv.] | Genna 2.4.17 (1616); Greg. 1616-06-01 [conv.] | 1603.2.12 (Keichō 8; Greg. 1603-03-24 [conv.]) → 1605.4.16 (resigned) | Matsudaira Hirotada; mother Odai (Dentsū-in) | Tsukiyama-dono (first wife, k. 1579); Asahi-hime (Hideyoshi's sister) | r. 1603–1605 | Nipponica, Brit, Yamakawa, NJD, Sekai [K:家康]; Daijisen [K:東照大権現 search]; Greg. [WP pointer] |
| 2 | `hidetada` | 徳川秀忠 | Tokugawa Hidetada | Buddhist name Taitoku-in 台徳院 | Tenshō 7.4.7 (1579); Greg. 1579-05-02 [conv.] | Kan'ei 9.1.24 (1632); Greg. 1632-03-14 [conv.] | 1605.4.16 → 1623.7.27 (resigned; kept real power as ōgosho until death) | Ieyasu (3rd son); mother Saigō no Tsubone (Oai, Hōdai-in) | Gō (Oeyo, Sūgen-in), married 1595 | r. 1605–1623 | Nipponica, Yamakawa [K:秀忠]; Daijisen [K:崇源院] |
| 3 | `iemitsu` | 徳川家光 | Tokugawa Iemitsu | Childhood name Takechiyo; Buddhist name Daiyū-in 大猷院 | Keichō 9.7.17 (1604), Edo Castle Nishi-no-maru; Greg. 1604-08-12 [conv.] | Keian 4.4.20 (1651); Greg. 1651-06-08 [conv.] | 1623.7.27 → 1651.4.20 (death) | Hidetada; mother Gō | Takatsukasa Takako (Naka-no-maru-dono), daughter of Kanpaku Takatsukasa Nobufusa | r. 1623–1651 | Nipponica, Yamakawa [K:家光] |
| 4 | `ietsuna` | 徳川家綱 | Tokugawa Ietsuna | Childhood name Takechiyo; Buddhist name Gen'yū-in 厳有院 | Kan'ei 18.8.3 (1641); Greg. 1641-09-07 [conv.] | Enpō 8.5.8 (1680); Greg. 1680-06-04 [conv.] | 1651.8.18 → 1680.5.8 (death) | Iemitsu; mother Oraku no Kata (Masuyama family) | Asa-no-miya (Akiko 顕子 [unverified name]), daughter of Prince Fushimi Sadakiyo | r. 1651–1680 | Nipponica, Yamakawa [K:家綱] |
| 5 | `tsunayoshi` | 徳川綱吉 | Tokugawa Tsunayoshi | Childhood name Tokumatsu 徳松; Buddhist name Jōken-in 常憲院; nickname "Inu-kubō" (dog shogun) | Shōhō 3.1.8 (1646); Greg. 1646-02-23 [conv.] | Hōei 6.1.10 (1709), of smallpox; Greg. 1709-02-19 [conv.] | 1680.8.23 → 1709.1.10 (death) | Iemitsu; mother Keishō-in (Otama) → adopted heir of his brother **Ietsuna** (1680) | Takatsukasa Nobuko, daughter of Sadaijin Takatsukasa Norihira, married 1664 | r. 1680–1709 | Nipponica, Yamakawa, Brit, Daijisen [K:綱吉] |
| 6 | `ienobu` | 徳川家宣 | Tokugawa Ienobu | First name **Tsunatoyo** 綱豊 (as lord of Kōfu); Buddhist name Bunshō-in 文昭院 | 1662.4.25 (Kanbun 2); Greg. 1662-06-11 [conv.] | Shōtoku 2.10.14 (1712); Greg. 1712-11-12 [conv.] | 1709.5.1 → 1712.10.14 (death) | Kōfu lord Tsunashige (Iemitsu's 3rd son); mother Chōshō-in (Ohora) → adopted by **Tsunayoshi** 1704 | Konoe Hiroko (Ten'ei-in), daughter of Konoe Motohiro, married 1679 | r. 1709–1712 | Nipponica, Yamakawa [K:家宣]; NJD [K:天英院] |
| 7 | `ietsugu` | 徳川家継 | Tokugawa Ietsugu | Childhood name Nabematsu 鍋松; Buddhist name Yūshō-in 有章院 | 1709.7.3 (Hōei 6); Greg. 1709-08-08 [conv.] | 1716.4.30 (Shōtoku 6); Greg. 1716-06-19 [conv.] | 1713.4.2 → 1716.4.30 (death). Mypedia gives 1712 as the start (he became head on his father's death) | Ienobu; mother Gekkō-in (Okiyo, Teruko) | None. Betrothed in 1715 to Imperial Princess Yaso-no-miya 八十宮 | r. 1713–1716 | Yamakawa, Nipponica, Daijisen, Mypedia [K:家継]; NJD [K:月光院] |
| 8 | `yoshimune` | 徳川吉宗 | Tokugawa Yoshimune | First name Yorikata 頼方; Buddhist name Yūtoku-in 有徳院 | Jōkyō 1.10.21 (1684); Greg. 1684-11-27 [conv.] | 1751.6.20 (Kan'en 4); Greg. 1751-07-12 [conv.] | 1716.8.13 → 1745.9.25 (retired) | Kii lord Tokugawa Mitsusada (4th son); mother Jōen-in → succeeded Ietsugu as heir from the Kii house (formal adoption by Ietsugu: see disputed points) | Sanomiya Masako 真宮理子, daughter of Prince Fushimi Sadamichi (d. before he became shogun [unverified]) | r. 1716–1745 | Nipponica, Yamakawa [K:吉宗] |
| 9 | `ieshige` | 徳川家重 | Tokugawa Ieshige | Buddhist name Junshin-in 惇信院 | 1711.12.21 (Shōtoku 1, lunar); Greg. 1712-01-28 [conv.] | 1761.6.12 (Hōreki 11); Greg. 1761-07-13 [conv.] | 1745.11.2 → 1760.5.13 (retired) | Yoshimune; mother Okubo family, Osuma no Kata (Shintoku-in) | Nami-no-miya Masuko 比宮増子, daughter of Prince Fushimi Kuninaga [unverified; WP pointer] | r. 1745–1760 | Yamakawa, Nipponica [K:家重] |
| 10 | `ieharu` | 徳川家治 | Tokugawa Ieharu | Buddhist name Shunmei-in 浚明院 | Genbun 2.5.22 (1737); Greg. 1737-06-20 [conv.] | Tenmei 6.8.25 (1786); death announced 9.8; Greg. 1786-09-17 [conv.] | 1760.9.2 → 1786.9.8 (death announced) | Ieshige; mother Oko (Umetani family) | Isonomiya Tomoko 五十宮倫子, daughter of Prince Kan'in Naohito [unverified; WP pointer] | r. 1760–1786 | Nipponica, Yamakawa [K:家治] |
| 11 | `ienari` | 徳川家斉 | Tokugawa Ienari | Buddhist name Bunkyō-in 文恭院 | An'ei 2.10.5 (1773); Greg. 1773-11-18 [conv.] | Tenpō 12, intercalary 1st month: day 7 (Yamakawa) or last day, 晦日 (Nipponica), 1841. Greg. c. 1841-02-27 (day 7) or 1841-03-22 (晦日) [conv.] | 1787.4.15 → 1837.4.2 (retired; ruled on as ōgosho) | Hitotsubashi Harusada → adopted by **Ieharu** 1781 | Shigehime / Tadako 寔子 (Kōdai-in), daughter of Satsuma lord Shimazu Shigehide, adopted by Konoe Tsunehiro | r. 1787–1837 | Nipponica, Yamakawa [K:家斉]; NJD [K:広大院] |
| 12 | `ieyoshi` | 徳川家慶 | Tokugawa Ieyoshi | Buddhist name Shintoku-in 慎徳院 | 1793.5.14 (Kansei 5); Greg. 1793-06-22 [conv.] | 1853.6.22 (Kaei 6); Greg. 1853-07-27 [conv.] | 1837.9.2 → 1853.7.22 (death announced) | Ienari; mother Kōrin-in | Sazanomiya Takako 楽宮喬子, daughter of Prince Arisugawa Orihito [unverified; WP pointer] | r. 1837–1853 | Yamakawa, Nipponica [K:家慶] |
| 13 | `iesada` | 徳川家定 | Tokugawa Iesada | Buddhist name Onkyō-in 温恭院 | 1824.4.8 (Bunsei 7); Greg. 1824-05-06 [conv.] | 1858.7.6 (Ansei 5); Greg. 1858-08-14 [conv.] | 1853.11.23 → 1858.8.8 (death announced) | Ieyoshi; mother Honju-in | (1) Arihime, adopted daughter of Takatsukasa Masamichi; (2) Sume-hime, daughter of Ichijō Sadayoshi (both died young); (3) **Atsuhime** (Tenshōin), m. 1856 | r. 1853–1858 | Yamakawa, Nipponica [K:家定]; Sekai [K:天璋院] |
| 14 | `iemochi` | 徳川家茂 | Tokugawa Iemochi | Childhood name Kikuchiyo 菊千代; as Kii lord **Yoshitomi** 慶福; Buddhist name Shōtoku-in 昭徳院 | Kōka 3, intercalary 5.24 (1846), Kii residence, Akasaka; Greg. 1846-07-17 [conv.] | 1866.7.20 (Keiō 2), Osaka Castle; Greg. 1866-08-29 [conv.] | 1858.12.1 → 1866.8.20 (death announced) | Kii lord Tokugawa Nariyuki (son of Ienari); mother Jitsujō-in [unverified] → heir of **Iesada** | **Kazunomiya** (Princess Chikako), married 1862 | r. 1858–1866 | Nipponica, Yamakawa [K:家茂]; Ōbunsha [K:和宮] |
| 15 | `yoshinobu` | 徳川慶喜 | Tokugawa Yoshinobu | Childhood name Shichirōmaro 七郎麿; also read **Keiki**; Hitotsubashi Yoshinobu | Tenpō 8.9.29 (1837), Mito residence, Koishikawa; Greg. 1837-10-28 [conv.] | 1913-11-22 (Taishō 2) | 1866.12.5 (Keiō 2; Greg. 1867-01-10 [conv.]) → returned rule to the court 1867.10.14 (Taisei hōkan); the office was abolished by the Restoration decree 1867.12.9. Yamakawa ends the tenure in 1867.12 | Mito lord Tokugawa Nariaki (7th son) → adopted into **Hitotsubashi** 1847 → head of the main line 1866 | Ichijō Mikako 美賀子 (also Shōko 省子) [unverified details; WP pointer] | r. 1866–1867 | Nipponica, Yamakawa [K:慶喜]; Sekai, Mypedia [K:大政奉還] |

### 2a. One- or two-sentence biographies

Each sentence uses only facts from the cited entries.

- **Ieyasu.** Eldest son of Matsudaira Hirotada, lord of Okazaki, he was appointed shogun in 1603 and passed the office to Hidetada in 1605, after which he was called ōgosho (retired shogun). He destroyed the Toyotomi in the Osaka campaigns of 1614–15 and died at Sunpu in 1616; the next year the court deified him as Tōshō Daigongen and he was reburied at Nikkō. [K:家康] (Nipponica, Mypedia), [K:大御所] (Brit), [K:大坂の陣], [K:東照大権現 search result: Nikkō Tōshōgū entry]
- **Hidetada.** Ieyasu's third son, he arrived late at Sekigahara and angered his father. After handing the office to Iemitsu in 1623 he kept real power as ōgosho until his death. [K:秀忠] (Nipponica)
- **Iemitsu.** Born in Edo Castle in 1604, he was raised with Kasuga no Tsubone as his wet nurse. His reign saw the Shimabara Rebellion (1637–38) and the 1639 ban on Portuguese ships that completed the "closed country" (sakoku) system. [K:家光], [K:春日局] (Sekai), [K:島原の乱], [K:鎖国] (Brit)
- **Ietsuna.** He became shogun as a boy in 1651, with his uncle Hoshina Masayuki assisting him in government. [K:家綱], [K:保科正之] (Daijisen)
- **Tsunayoshi.** Lord of Tatebayashi and adopted heir of his elder brother Ietsuna, he is known for the Laws of Compassion for Living Things (which earned him the nickname "dog shogun") and for the Genroku cultural flowering. [K:綱吉] (Brit, Daijisen, Yamakawa)
- **Ienobu.** As Tsunatoyo, lord of Kōfu and grandson of Iemitsu, he was adopted by Tsunayoshi in 1704 and reigned only three years. [K:家宣] (Nipponica). His reign began the Shōtoku-era reforms associated with Arai Hakuseki. [unverified: I only inferred this from the Ietsugu entry, which calls Ietsugu's reign the *second half* of the Shōtoku reforms]
- **Ietsugu.** Shogun from the age of four, he ruled through Manabe Akifusa and Arai Hakuseki and died as a child without an heir, so the succession passed to the Kii house. [K:家継] (Daijisen, Ōbunsha)
- **Yoshimune.** Fourth son of the lord of Kii and lord of Kii himself from 1705, he became the first shogun from one of the three senior branch houses (gosanke) and led the Kyōhō reforms (1716–45). [K:吉宗] (Nipponica, Yamakawa), [K:享保の改革]
- **Ieshige.** Sickly and hard to understand, he was said to be intelligible only to his chamberlain Ōoka Tadamitsu. [K:家重] (Nipponica)
- **Ieharu.** On his father's dying advice he relied on Tanuma Okitsugu. [K:家治] (Yamakawa)
- **Ienari.** Brought in from the Hitotsubashi house, he reigned fifty years, the longest of any shogun, and kept real power as ōgosho after retiring in 1837. He is known for fathering 55 children. [K:家斉] (Yamakawa, Nipponica); the "longest reign" claim is arithmetic from the table.
- **Ieyoshi.** He appointed Mizuno Tadakuni as chief senior councillor to carry out the Tenpō reforms (1841–43); he died just after Perry's arrival in 1853. [K:家慶] (Nipponica), [K:天保の改革], [K:鎖国] (Daijisen: Perry 1853)
- **Iesada.** Too sickly to govern, he left affairs to Abe Masahiro, received the US consul Townsend Harris at Edo Castle in 1857, and died during the dispute over his successor. [K:家定] (Mypedia, Nipponica)
- **Iemochi.** Brought in from the Kii house as a boy, he married Emperor Kōmei's half-sister Kazunomiya in 1862 to bind court and shogunate together, and died at Osaka Castle in 1866 while his army was losing. [K:家茂] (Yamakawa)
- **Yoshinobu.** A son of Mito lord Nariaki, he headed the Hitotsubashi house before becoming the last shogun; in 1867 he returned governing power to the court (Taisei hōkan). He lived until 1913 and was made a prince (kōshaku) in 1902. [K:慶喜] (Nipponica, Yamakawa), [K:大政奉還]

---

## 3. Ieyasu's parents, wives and sons

| id | Kanji | Print name | Other names | Born–died | House | Parents (bio / adoptive) | Spouses | Card subtitle | Sources |
|---|---|---|---|---|---|---|---|---|---|
| `matsudaira_hirotada` | 松平広忠 | Matsudaira Hirotada | — | 1526–1549 (murdered by retainer Iwamatsu Hachiya) | Matsudaira (Okazaki) | son of Matsudaira Kiyoyasu | Odai | 1526–1549 · father of Ieyasu | Sekai, Nipponica [K:松平広忠] |
| `odai` | 於大の方 | Odai no Kata | Dentsū-in 伝通院 | 1528–1602 (d. 1602.8.28 lunar) | Mizuno → Matsudaira; later Hisamatsu | daughter of Mizuno Tadamasa, lord of Kariya | (1) Matsudaira Hirotada; (2) Hisamatsu Toshikatsu | 1528–1602 · mother of Ieyasu | Yamakawa [K:於大の方] |
| `tsukiyama` | 築山殿 | Tsukiyama-dono | Lady Tsukiyama; Sena [unverified] | 1542?–1579 | Sekiguchi (Imagawa relatives) | daughter of Sekiguchi Yoshihiro (variants: Ujihiro, Chikanaga) | Ieyasu | ?–1579 · first wife of Ieyasu | Daijisen, Nipponica [K:築山殿] |
| `asahihime` | 朝日姫 | Asahi-hime | — | [unverified dates] | Toyotomi | sister of Toyotomi Hideyoshi | Ieyasu (second wife) | sister of Hideyoshi · wife of Ieyasu (optional box) | Nipponica, Sekai [K:家康] |
| `saigo_no_tsubone` | 西郷局 | Saigō no Tsubone | Oai no Kata お愛の方; Hōdai-in 宝台院 | 1562–1589 (d. Tenshō 17.5.19) | Saigō | [father not given in source] | Ieyasu (consort) | 1562–1589 · mother of Hidetada | NJD [K:お愛の方] |
| `nobuyasu` | 松平信康 (徳川信康) | Matsudaira Nobuyasu | Okazaki Nobuyasu; Tokugawa Nobuyasu | 1559–1579 (forced suicide, Futamata Castle, 1579.9.15) | Matsudaira/Tokugawa | Ieyasu & Tsukiyama-dono (eldest son) | Tokuhime, daughter of Oda Nobunaga (m. 1567) | 1559–1579 · eldest son of Ieyasu | Sekai [K:徳川信康] |
| `yuki_hideyasu` | 結城秀康 | Yūki Hideyasu | Childhood name Ogimaru 於義丸 (Brit: Ogii 於義伊); Matsudaira Hideyasu | 1574–1607 | Yūki → Echizen Matsudaira | Ieyasu & Oman no Kata (Kogō no Tsubone; not the same woman as Yōju-in). **Adopted** by Toyotomi Hideyoshi (1584), then by **Yūki Harutomo** (1590) | [unverified] | 1574–1607 · son of Ieyasu | Nikkoku, NJD, Nipponica, Yamakawa, Sekai (old) [K:結城秀康] |
| `hidetada` | — | (see shogun table) | | | | | | | |
| `matsudaira_tadayoshi` | 松平忠吉 | Matsudaira Tadayoshi | — | 1580–1607 (Brit gives birth 1583) | Matsudaira (Kiyosu) | Ieyasu & Saigō no Tsubone | daughter of Ii Naomasa [unverified name] | 1580–1607 · son of Ieyasu | Nipponica, Sekai, Brit [K:松平忠吉] |
| `takeda_nobuyoshi` | 武田信吉 | Takeda Nobuyoshi | (optional; Ieyasu's 5th son) | 1583–1603 [unverified] | Takeda name revived | Ieyasu & Otoma (Shimoyama-dono) [unverified] | — | optional | [unverified] |
| `matsudaira_tadateru` | 松平忠輝 | Matsudaira Tadateru | — | 1592–1683 | Matsudaira (Takada) | Ieyasu & Chaa no Tsubone 茶阿局 | Iroha-hime 五郎八, daughter of Date Masamune | 1592–1683 · son of Ieyasu | Nipponica, NJD, Brit [K:松平忠輝] |
| `owari_yoshinao` | 徳川義直 | Tokugawa Yoshinao | Earlier Yoshitomo 義知, Yoshitoshi 義利 | 1600–1650 (birth possibly Jan 1601 Greg. [unverified]) | Owari (founder) | Ieyasu & Okame no Kata (Sōō-in) | [unverified] | 1600–1650 · founder of Owari house | Nipponica, NJD, Daijisen [K:徳川義直] |
| `kii_yorinobu` | 徳川頼宣 | Tokugawa Yorinobu | — | 1602–1671 | Kii (founder) | Ieyasu & Oman no Kata (Yōju-in) | [unverified] | 1602–1671 · founder of Kii house | Nipponica, Daijisen [K:徳川頼宣] |
| `mito_yorifusa` | 徳川頼房 | Tokugawa Yorifusa | — | 1603–1661 | Mito (founder) | Ieyasu & Oman no Kata (Yōju-in) | [unverified] | 1603–1661 · founder of Mito house | Daijisen, Sekai, Nipponica [K:徳川頼房] |

Notes:
- Order of sons: Nobuyasu (1st), Hideyasu (2nd), Hidetada (3rd), Tadayoshi (4th), Nobuyoshi (5th), Tadateru (6th), two who died young (7th, 8th), Yoshinao (9th), Yorinobu (10th), Yorifusa (11th). The 3rd, 9th, 10th and 11th are confirmed by Nipponica [K:秀忠] and Daijisen [K:御三家]; the rest of the numbering is [unverified].
- Ieyasu's daughters (Kamehime, Tokuhime, and others) are not covered. Kamehime, Tsukiyama-dono's daughter, is mentioned in Nipponica [K:築山殿] if the chart wants her.
- Tsukiyama-dono was killed in 1579 by Ieyasu's retainer Nonaka Shigemasa, on Ieyasu's orders, after Oda Nobunaga accused her of dealing with Takeda Katsuyori (Nipponica [K:築山殿]). The same affair ended in Nobuyasu's forced suicide.

---

## 4. Hidetada's family

| id | Kanji | Print name | Other names | Born–died | House | Parents | Spouses | Card subtitle | Sources |
|---|---|---|---|---|---|---|---|---|---|
| `go` | 崇源院 (江) | Gō | Oeyo お江与, Ogō 小督, personal name Tatsuko 達子; Sūgen-in | 1573–1626 (d. Kan'ei 3.9.15) | Asai | Asai Nagamasa & Oichi (Oda Nobunaga's sister) | (1) Saji Kazunari; (2) Hashiba (Toyotomi) Hidekatsu; (3) Hidetada, 1595 | 1573–1626 · wife of Hidetada | Daijisen, Nipponica, NJD, Sekai [K:崇源院] |
| `tadanaga` | 徳川忠長 | Tokugawa Tadanaga | "Suruga Dainagon" 駿河大納言 | 1606–1634 (Greg.; lunar Kan'ei 10.12.6 = "1633") | Tokugawa (Sunpu) | Hidetada & Gō | [unverified] | 1606–1634 · son of Hidetada | Nikkoku, Nipponica, Sekai, NJD, Brit, Daijisen [K:徳川忠長] |
| `senhime` | 千姫 | Senhime | Tenju-in 天樹院 | 1597–1666 | Tokugawa | Hidetada & Gō | (1) Toyotomi Hideyori, 1603; (2) Honda Tadatoki, Genna 2.9.29 (1616) | 1597–1666 · daughter of Hidetada | Daijisen, Nipponica, Brit [K:千姫] |
| `tofukumon_in` | 東福門院 (和子) | Tokugawa Masako (Tōfukumon-in) | Kazuko; both readings of 和子 (*kazuko* / *masako*) are given | Keichō 12.10.4 (1607) – Enpō 6.6.15 (1678) | Tokugawa → imperial | Hidetada & Gō | Emperor Go-Mizunoo: entered the palace 1620; empress consort (chūgū) 1624 | 1607–1678 · empress of Go-Mizunoo | Brit, Mypedia, Nikkoku, Ōbunsha [K:東福門院] |
| `meisho` | 明正天皇 | Empress Meishō | Okiko 興子 [unverified] | 1624–1696 [unverified]; r. 1629–1643 [unverified] | imperial | Go-Mizunoo & Tōfukumon-in | — | r. 1629–1643 (empress regnant) | Mother: Ōbunsha [K:東福門院]; dates [unverified] |
| `go_mizunoo` | 後水尾天皇 | Emperor Go-Mizunoo | — | 1596–1680 [unverified] | imperial | — | Tōfukumon-in | link box only | [unverified] |
| `toyotomi_hideyori` | 豊臣秀頼 | Toyotomi Hideyori | — | 1593–1615 [birth unverified]; died with his mother Yodo at the fall of Osaka, 1615 | Toyotomi | Toyotomi Hideyoshi & Yodo-dono | Senhime | link box only | Death: Nikkoku, Kyodo [K:大坂の陣]; Senhime marriage [K:千姫] |
| `honda_tadatoki` | 本多忠刻 | Honda Tadatoki | — | 1596–1626 [unverified] | Honda | [unverified] | Senhime | link box only | Marriage: Brit [K:千姫] |
| `hoshina_masayuki` | 保科正之 | Hoshina Masayuki | Later line: Aizu Matsudaira | 1611–1673 (Greg.; Nipponica "1672", Daijisen "1673") | Hoshina → Aizu | Hidetada & his consort Oshizu (Kanō family); **adopted** by Hoshina Masamitsu, lord of Takatō | [unverified] | 1611–1673 · son of Hidetada | Nipponica, Nikkoku, Daijisen, Sekai (old) [K:保科正之] |

Notes:
- Gō and Hidetada had two sons and five daughters (Sekai [K:崇源院]). Besides Senhime and Kazuko, the daughters (Tamahime, Katsuhime, Hatsuhime, Nene/Kohime) are [unverified] and left out.
- **Kasuga no Tsubone** (春日局, 1579–1643; personal name Fuku 福; daughter of Saitō Toshimitsu, a retainer of Akechi Mitsuhide) became Iemitsu's wet nurse at his birth in 1604 and later ran the Ōoku (Sekai, Daijisen, Nipponica, Ōbunsha, Nikkoku [K:春日局]). **Recommendation: a note on Iemitsu's card, not a box.** She has no line of descent in the chart.

---

## 5. The branch lines the succession passed through

| id | Kanji | Print name | Other names | Born–died | House | Parents (bio / adoptive) | Card subtitle | Sources |
|---|---|---|---|---|---|---|---|---|
| `kofu_tsunashige` | 徳川綱重 | Tokugawa Tsunashige | Kōfu Saishō [unverified] | 1644–1678 | Kōfu (founder; 250,000 koku, 1661) | Iemitsu (3rd child) & Onatsu (Fujieda family) | 1644–1678 · lord of Kōfu | Daijisen, Nipponica, Brit, Sekai (old) [K:徳川綱重] |
| `kii_mitsusada` | 徳川光貞 | Tokugawa Mitsusada | — | 1627–1705 (Greg.; NJD "1627*"; another source gives 1626-12-11 lunar) | Kii (2nd lord from 1667) | Yorinobu (eldest son) | 1627–1705 · 2nd lord of Kii | NJD [K:徳川光貞] |
| `hitotsubashi_munetada` | 一橋宗尹 | Hitotsubashi Munetada | Tokugawa Munetada | 1721–1765 | Hitotsubashi (founder) | Yoshimune (4th son) | 1721–1765 · founder of Hitotsubashi | NJD [K:一橋宗尹]; [K:一橋家] |
| `hitotsubashi_harusada` | 一橋治済 | Hitotsubashi Harusada | — | 1751–1827 (b. Hōreki 1.11.6; d. Bunsei 10.2.20) | Hitotsubashi (2nd head) | Munetada (4th son) | 1751–1827 · father of Ienari | Sekai, NJD [K:一橋治済] |
| `kii_nariyuki` | 徳川斉順 | Tokugawa Nariyuki | — | 1801–1846 | Shimizu (3rd head, 1810) → Kii (adopted 1824; 11th lord) | Ienari → adopted into Kii (adoptive father: 10th lord Harutomi [unverified]) | 1801–1846 · lord of Kii · father of Iemochi | NJD [K:徳川斉順]; Brit [K:和歌山藩]; father of Iemochi: Yamakawa [K:家茂] |
| `mito_mitsukuni` | 徳川光圀 | Tokugawa Mitsukuni | "Mito Kōmon" 水戸黄門 | 1628–1700 | Mito (2nd lord from 1661) | Yorifusa (3rd son) | 1628–1700 · 2nd lord of Mito | Sekai, Daijisen, Brit [K:徳川光圀] |
| `mito_harutoshi` | 徳川治紀 | Tokugawa Harutoshi | — | [unverified] | Mito (7th lord) | Harumori (6th lord) [unverified] | 7th lord of Mito | Order: Sekai [K:水戸藩]; father of Nariaki: Nikkoku [K:徳川斉昭] |
| `mito_nariaki` | 徳川斉昭 | Tokugawa Nariaki | Posthumous name Rekkō 烈公 | 1800–1860 | Mito (9th lord from 1829) | Harutoshi (3rd son) → adopted heir of his brother **Narinobu** (8th lord), 1829 | 1800–1860 · father of Yoshinobu | Nikkoku, Yamakawa, Nipponica, Brit, Ōbunsha [K:徳川斉昭]; birth date from 367日誕生日大事典 on the same page |
| `tayasu_munetake` | 田安宗武 | Tayasu Munetake | Tokugawa Munetake | 1715–1771 | Tayasu (founder) | Yoshimune (2nd son) | 1715–1771 · founder of Tayasu | Ōbunsha, Nipponica, Brit, Nikkoku, Daijisen [K:田安宗武] |
| `matsudaira_sadanobu` | 松平定信 | Matsudaira Sadanobu | — | 1758–1829 | Tayasu → Shirakawa (Hisamatsu) Matsudaira | Munetake → **adopted** 1774 by Matsudaira Sadakuni of Shirakawa | 1758–1829 · son of Munetake | Nipponica, Nikkoku, Daijisen, Ōbunsha [K:松平定信] |
| `shimizu_shigeyoshi` | 清水重好 | Shimizu Shigeyoshi | Tokugawa Shigeyoshi | 1745–1795 (died without a son) | Shimizu (founder) | Ieshige (2nd son) | 1745–1795 · founder of Shimizu | NJD [K:清水重好]; Mypedia [K:清水家] |
| `tayasu_yoshiyori` | 田安慶頼 | Tayasu Yoshiyori | Tokugawa Yoshiyori | [unverified] | Tayasu (5th head; head again after 1868) | [unverified] | father of Iesato | Daijisen [K:徳川家達]; Nipponica [K:田安家] |

Matsudaira Sadanobu was chief senior councillor (rōjū shuza) 1787–1793 and led the Kansei reforms (Daijisen, Nikkoku, Ōbunsha [K:松平定信]; Daijisen [K:寛政の改革]). Harusada helped put Sadanobu in place of Tanuma Okitsugu (Sekai [K:一橋治済]).

### 5a. Lords for "generations omitted" boxes

**Mito** (order from Sekai [K:水戸藩]; romanised readings are mine, [unverified] where marked):
1. Yorifusa 頼房 → 2. Mitsukuni 光圀 → 3. Tsunaeda 綱条 (son of Mitsukuni's elder brother Yorishige, adopted by Mitsukuni; Sekai [K:徳川光圀]) → 4. Munetaka 宗堯 → 5. Munemoto 宗翰 → 6. Harumori 治保 → 7. Harutoshi 治紀 → 8. Narinobu 斉脩 → 9. Nariaki 斉昭 → 10. Yoshiatsu 慶篤 → 11. Akitake 昭武 (last lord, 1871).
- Chart suggestion: Yorifusa → Mitsukuni → *[omitted: Tsunaeda, Munetaka, Munemoto, Harumori]* → Harutoshi → Nariaki → Yoshinobu.
- Nariaki succeeded his **brother** Narinobu as adopted heir (Yamakawa [K:徳川斉昭]), so Narinobu is a sibling, not an ancestor. Leave him out or show him as Nariaki's brother.
- Whether lords 3–7 form a straight father-to-son line is [unverified]. Sekai says the line continued without extinction, which is not the same thing. Draw a dotted "descent through several generations" line, not "son of".

**Kii** (order from Brit [K:和歌山藩]):
1. Yorinobu 頼宣 → 2. Mitsusada 光貞 → 3. Tsunanori 綱教 → 4. Yorimoto 頼職 → 5. Yoshimune 吉宗 → 6. Munenao 宗直 → 7. Munenobu 宗将 → 8. Shigenori 重倫 → 9. Harusada 治貞 → 10. Harutomi 治宝 → 11. Nariyuki 斉順 → 12. Narikatsu 斉彊 → 13. Yoshitomi 慶福 (= Iemochi) → 14. Mochitsugu 茂承.
- Tsunanori and Yorimoto were Yoshimune's elder brothers, so lords 3–5 are three brothers [relationship unverified in the source I read].
- Lord 9 (治貞) is also read "Harusada", which clashes with Hitotsubashi Harusada (治済). Romanise them differently or add the kanji.
- From 6 to 10 the line came from a branch (Iyo-Saijō) [unverified]. The chart does not need it: Iemochi descends from Ienari via Nariyuki, not from the earlier Kii lords.

**Hitotsubashi**: 1 Munetada → 2 Harusada → … → 9 Yoshinobu (Nipponica, Mypedia [K:一橋家]). Heads 3–8 are not needed.

**Tayasu** (Nipponica [K:田安家]): Munetake → Harusato 治察 → Narimasa 斉匡 → Naritaka 斉荘 → Yoshiyori 慶頼 → Jumachiyo 寿千代 → Kamenosuke 亀之助 (= Iesato); Yoshiyori headed the house again after 1868.

**Shimizu** (Sekai, Mypedia, Nipponica [K:清水家]): Shigeyoshi (d. 1795 without a son); 2nd Atsunosuke to 5th Narikatsu were all sons of Ienari (Nariyuki was the 3rd head per NJD [K:徳川斉順]); 6th Akitake. The house was often vacant.

---

## 6. Heads of the house since 1868

| # | id | Kanji | Print name | Born–died | Head from–to | Parents | Spouse | Card subtitle | Sources |
|---|---|---|---|---|---|---|---|---|---|
| 16 | `iesato` | 徳川家達 | Tokugawa Iesato | Bunkyū 3.7.11 (1863; Greg. 1863-08-24 [conv.]) – 1940-06-05 | 1868 → 1940 | Tayasu Yoshiyori (3rd son); childhood name Kamenosuke 亀之助; earlier Tayasu head | [unverified] | head 1868–1940 | Daijisen, 新訂 政治家人名事典 [K:徳川家達]; Nipponica [K:田安家] |
| 17 | `iemasa` | 徳川家正 | Tokugawa Iemasa | 1884-03-23 – 1963-02-18 | 1940 → 1963 | Iesato | Shimazu Masako 島津正子 [unverified; WP pointer] | head 1940–1963 | 新訂 政治家人名事典, 20世紀日本人名事典 [K:徳川家正] |
| — | `toyoko` | 松平豊子 (徳川豊子) | Matsudaira Toyoko | [unverified] | — | Iemasa (eldest daughter [unverified]) | Matsudaira Ichirō | daughter of Iemasa | Her memoir 『徳川宗家に生まれて 春は昔』 (Bungeishunjū) confirms birth in the main line and marriage into Aizu Matsudaira [bunshun]; parentage of Tsunenari [WP pointer] |
| — | `matsudaira_ichiro` | 松平一郎 | Matsudaira Ichirō | [unverified] | — | Aizu Matsudaira line (grandson of Matsudaira Katamori [unverified]) | Toyoko | father of Tsunenari | [WP pointer] only |
| 18 | `tsunenari` | 徳川恒孝 | Tokugawa Tsunenari | 1940-02-26 [WP pointer] – living (no death found up to Nov 2026) | 1963-02-18 → 2023-01-01 (retired) | Matsudaira Ichirō & Toyoko; took the Tokugawa name as heir of his maternal grandfather Iemasa | [unverified] | head 1963–2023 | Start date matches Iemasa's death [K:徳川家正]; retirement [nippon.com], [tokyonewsmedia]; founded the Tokugawa Kinen Zaidan in 2003 [keio] |
| 19 | `iehiro` | 徳川家広 | Tokugawa Iehiro | 1965 – | 2023-01-01 → present (Nov 2026) | Tsunenari (eldest son) | [unverified] | head since 2023 | Born 1965, Keiō graduate (Economics, 1990), formally installed at Zōjō-ji 2023-01-29 [keio]; succeeded at 57, first change of head in 60 years [nippon.com]; eldest son, from 1 Jan 2023 [tokyonewsmedia]; chairman of the Tokugawa Kinen Zaidan since 2021 [keio] |

Notes:
- Iesato succeeded to the main line in 1868 (Meiji 1) (Daijisen [K:徳川家達]). The exact day, Keiō 4 intercalary 4.29, is [unverified]. He became governor of the Shizuoka domain in 1869 (Nipponica) and was President of the House of Peers 1903–1933 (Sekai).
- Iemasa was a diplomat (ambassador to Turkey) and the last President of the House of Peers (1946) (20世紀日本人名事典, 政治家人名事典 [K:徳川家正]).
- **Was Tsunenari formally adopted?** One search summary says he "entered by adoption" (養子に入った), but I could not confirm a formal adoption in a reliable source. Use a plain "grandson, successor" link (see section 8).
- **2023 date.** Tokyo News Media and nippon.com give 1 January 2023 for the change of head; the Keiō magazine says he "became" 19th head on 29 January 2023, the date of the Zōjō-ji ceremony that ended the succession events. Suggest "2023" on the card.
- **Up to 2026.** No later change of head was found; Iehiro is the 19th head as of November 2026. Searches for news on Tsunenari in 2025–26 found nothing (no death notice).
- Yoshinobu's own line (the Tokugawa Yoshinobu-ke, a prince's house from 1902) is separate from the sōke and is not covered here.

---

## 7. Wives, mothers and consorts a reader would expect

| id | Kanji | Print name | Other names | Born–died | Parents (bio / adoptive) | Married to | Card subtitle | Sources |
|---|---|---|---|---|---|---|---|---|
| `takatsukasa_takako` | 鷹司孝子 | Takatsukasa Takako | Naka-no-maru-dono 中ノ丸殿; Honri-in 本理院 [unverified] | [unverified] | Takatsukasa Nobufusa | Iemitsu | wife of Iemitsu | Nipponica [K:家光] |
| `asanomiya` | 浅宮 (顕子女王) | Asa-no-miya | Akiko [unverified] | [unverified] | Prince Fushimi Sadakiyo | Ietsuna | wife of Ietsuna | Nipponica [K:家綱] |
| `takatsukasa_nobuko` | 鷹司信子 | Takatsukasa Nobuko | Jōkō-in [unverified] | [unverified] | Takatsukasa Norihira | Tsunayoshi (m. 1664) | wife of Tsunayoshi | Nipponica [K:綱吉] |
| `keishoin` | 桂昌院 | Keishō-in | Otama お玉; sometimes misread "Kōshōin" | 1627–1705 | Biological father: Niemon, a greengrocer of Horikawa, Kyoto (Yamakawa); adopted daughter of Honjō Munemasa (NJD; other entries: Munetoshi) | Iemitsu (consort) | 1627–1705 · mother of Tsunayoshi | Nikkoku, Daijisen, Yamakawa, NJD, Sekai [K:桂昌院] |
| `tenei_in` | 天英院 (煕子) | Konoe Hiroko (Ten'ei-in) | — | 1662?–1741 | Konoe Motohiro | Ienobu, m. 1679 | wife of Ienobu | NJD [K:天英院] |
| `gekkoin` | 月光院 | Gekkō-in | Okiyo お喜世; Teruko 輝子 | 1685–1752 | Katsuta family (father's name [unverified]) | Ienobu (consort) | 1685–1752 · mother of Ietsugu | NJD, Sekai (old) [K:月光院] |
| `kodai_in` | 広大院 | Kōdai-in | Shigehime 茂姫; Tadako 寔子 | 1773–1844 | Shimazu Shigehide → adopted by Konoe Tsunehiro | Ienari | wife of Ienari | NJD [K:広大院]; adoption: Nipponica [K:家斉] |
| `tenshoin` | 天璋院 | Tenshō-in | **Atsuhime** 篤姫; Atsuko 篤子, later Sumiko 敬子 | 1836–1883 (Greg.; Nipponica "1835"; Kyodo notes 1836; Daijisen "1837") | Shimazu Tadatake → adopted by **Shimazu Nariakira** → then by **Konoe Tadahiro** | Iesada, 1856 | 1836–1883 · wife of Iesada | Daijisen, Nipponica, NJD, Sekai, Kyodo [K:天璋院] |
| `kazunomiya` | 和宮 (親子内親王) | Kazunomiya | Princess Chikako 親子内親王; Seikan'in-no-miya 静寛院宮 | Kōka 3, intercalary 5.10 (1846) – 1877 | Emperor Ninkō & Kangyō-in (Hashimoto Tsuneko) | Betrothed 1851 to Prince Arisugawa Taruhito; married Iemochi in Edo, 1862 | 1846–1877 · wife of Iemochi | Nipponica, Daijisen, NJD, Brit, Ōbunsha, Nikkoku [K:和宮] |
| `ichijo_mikako` | 一条美賀子 | Ichijō Mikako | Shōko 省子 | 1835–1894 [unverified] | Imadegawa Kinhisa → adopted by Ichijō Tadaka [unverified] | Yoshinobu | wife of Yoshinobu | [WP pointer]; ja.WP 御台所 names her 省子 |

Notes:
- **"Kōshōin" vs "Keishōin".** The correct reading of 桂昌院 is *Keishō-in* (けいしょういん), as in Nipponica [K:綱吉] and all Kotobank entries. Print "Keishō-in".
- **Kasuga no Tsubone.** Note only (section 4).
- **Why Tenshō-in and Kazunomiya are on the chart** (both childless; added 18 November 2026). Tenshō-in: after the shogunate fell she worked, with Kazunomiya, to keep the Tokugawa main house in existence and to spare Edo Castle from attack (Nipponica: 徳川家の存続と官軍の江戸城攻め回避のため…尽力; Kyodo: 明治維新では徳川家存続に尽力), and raised Iesato (Sekai). Kazunomiya: daughter of Emperor Ninkō and younger sister of Emperor Kōmei (Daijisen), married to Iemochi in 1862 under the shogunate's kōbu gattai policy (Ōbunsha; Yamakawa); in 1868 she petitioned the government for the Tokugawa house and for a delay in the army's advance on Edo (Sekai), "a hidden force behind the surrender of Edo Castle" (Daijisen). Nipponica also has Tenshō-in, in July 1868, asking the northern alliance to fight the imperial army; not on the chart. All from Kotobank [K:天璋院], [K:和宮].
- **Ten'ei-in** is included because she was midaidokoro in 1709–12 and has her own entry. She is optional.
- The wives of Ieshige, Ieharu and Ieyoshi (Nami-no-miya, Isonomiya, Sazanomiya) are all imperial-family princesses. Their names and fathers are only [WP pointer]-level in this file. Give them boxes only if the chart shows every midaidokoro; otherwise leave them as notes.

---

## 8. Eras for the timeline band

### Big periods (4–6 bands)

| Band | Start | End | Label | Source |
|---|---|---|---|---|
| 1 | 1600 (Sekigahara, Keichō 5.9.15) / 1603 (Ieyasu appointed) | 1639 | Founding of the shogunate | Brit [K:関ヶ原の戦い]; Yamakawa [K:家康] |
| 2 | 1639 (Portuguese ships banned; sakoku "completed") | 1716 | Closed country / consolidation | Brit [K:鎖国]; 1633–39 seclusion edicts: Mypedia; Dutch moved to Dejima 1641: Sekai |
| 3 | 1716 (Kyōhō reforms begin) | 1853/1854 | Age of reforms: Kyōhō 1716–45, Kansei 1787–93, Tenpō 1841–43 | Nipponica, Brit [K:享保の改革]; Daijisen [K:寛政の改革], [K:天保の改革] |
| 4 | 1853 (Perry) / 1854 (Treaty of Kanagawa) | 1867/1868 | Bakumatsu (end of the shogunate) | Daijisen [K:鎖国] (Perry 1853); Daijisen [K:幕末] (1854–1867); Nipponica [K:幕末]: some historians start it with the Tenpō reforms (1841–43) |
| 5 | 1868 | — | Meiji and after: the Tokugawa as a family | Mypedia [K:戊辰戦争]; [K:徳川家達] |

Recommendation: use **1603, 1639, 1716, 1853, 1868** as band starts (the brief's suggestion). Each is defensible from the sources above. Note on band 4 that "Bakumatsu" has no agreed start date (Nipponica).

### Episodes (markers)

| Episode | Dates | Source |
|---|---|---|
| Battle of Sekigahara | 1600 (Keichō 5.9.15) | Brit, Nipponica [K:関ヶ原の戦い] |
| Siege of Osaka | Winter campaign 1614; summer campaign 1615 (castle falls in the 5th month; Hideyori and Yodo kill themselves) | Nipponica, Mypedia, Nikkoku, Kyodo [K:大坂の陣] |
| Ieyasu deified as Tōshō Daigongen, reburied at Nikkō | 1617 | Daijisen/Nipponica search results [K:東照大権現], [K:日光東照宮] |
| Shimabara Rebellion | 10th month 1637 – 2nd month 1638 (Hara Castle; leader Amakusa Shirō) | Kyodo, Mypedia [K:島原の乱] |
| Portuguese excluded (sakoku completed) | 1639 | Brit [K:鎖国] |
| Kyōhō reforms | 1716–1745 | [K:享保の改革] |
| Kansei reforms | 1787–1793 | Daijisen [K:寛政の改革] |
| Tenpō reforms | 1841–1843 | Daijisen [K:天保の改革] |
| Perry's arrival | 1853 | Daijisen [K:鎖国] |
| Treaty of Kanagawa | 1854 | Sekai [K:鎖国] |
| Return of rule to the court (Taisei hōkan) | 1867-11-09 Greg. (Keiō 3.10.14) | Mypedia, Sekai [K:大政奉還] |
| Restoration decree (Ōsei fukko) | Keiō 3.12.9 (1867; Greg. 1868-01-03 [conv.]) | Sekai (old) [K:大政奉還] |
| Boshin War | 1st month 1868 (Toba–Fushimi) – 5th month 1869 (Goryōkaku); Edo Castle handed over 1868.4.11 | Mypedia, Sekai [K:戊辰戦争] |

The Boshin War months are lunar (Meiji 1–2). Toba–Fushimi was 27 January 1868 Greg. [conv.] and the Goryōkaku surrender 27 June 1869 Greg. [conv.]. For a timeline band, years are enough.

---

## 9. Glossary of titles

| Term | Kanji | Gloss for the chart | Source |
|---|---|---|---|
| shōgun / sei-i taishōgun | 将軍 / 征夷大将軍 | "Barbarian-subduing generalissimo." Originally the commander sent against the Emishi in the Nara and Heian periods; from the Kamakura period the head of the warrior government; abolished by the Restoration of 1867. | Nikkoku [K:征夷大将軍] |
| ōgosho | 大御所 | A retired shogun who kept power; used above all of Ieyasu (after 1605) and Ienari (after 1837). | Daijisen, Nikkoku, Ōbunsha, Brit [K:大御所] |
| kubō | 公方 | In the Edo period, a name for the shogun (the shogunate itself was *kōgi* 公儀). | Nipponica, Daijisen, Yamakawa [K:公方] |
| midaidokoro | 御台所 | The shogun's principal wife (short for *midaibandokoro*). | Daijisen, Nikkoku [K:御台所] |
| daimyō | 大名 | A lord holding a domain assessed at 10,000 koku or more. | [unverified]: standard definition, not checked in a source this session |
| gosanke | 御三家 | The three senior branch houses (Owari, Kii, Mito), founded by Ieyasu's 9th–11th sons, entitled to supply a shogun if the main line had no heir. | Daijisen, Nipponica [K:御三家] |
| gosankyō | 御三卿 | The three later branch houses (Tayasu, Hitotsubashi, Shimizu), founded by sons of Yoshimune and Ieshige, living inside Edo Castle on 100,000-koku stipends. | Daijisen, Nipponica, Yamakawa, Ōbunsha [K:御三卿] |
| sōke | 宗家 | The main line (head house) of the Tokugawa. | Usage in [K:徳川家達] ("徳川宗家を相続") |
| Daigongen | 大権現 | "Great avatar": the divine title given to Ieyasu (Tōshō Daigongen, 1617). | [K:東照大権現] |
| ōoku | 大奥 | The women's quarters of Edo Castle (needed for Kasuga no Tsubone). | Nikkoku [K:春日局] (usage) |
| taikō | 太閤 | A retired kanpaku (imperial regent); in practice Toyotomi Hideyoshi. **Not a Tokugawa title.** Only needed if Hideyoshi appears as Hideyori's father. | [unverified] |

---

## 10. Uncertain or disputed points

1. **Ieyasu's birth year.** Tenbun 11.12.26 is "1542" in Sekai, Brit and Yamakawa, but the Gregorian date is 31 January 1543 (NJD marks the year "1543*", its sign for a Western-year shift). Print **1543** with a note, or "1542/43".
2. **Gregorian conversions** for all pre-1873 day dates come from English Wikipedia and are unchecked by me. They should be run through a converter (for example the NAOJ calendar tables) before the chart prints any day-level date. Years are safe except for the late-12th-month cases in section 0.
3. **Reign dates.** Yamakawa ends several tenures on the date a death was *announced* (Ieharu: died 8.25, announced 9.8; Ieyoshi 6.22 / 7.22; Iesada 7.6 / 8.8; Iemochi 7.20 / 8.20). The year is the same in every case, so "r." years are unaffected.
4. **Ietsugu's start**: 1713 (formal appointment, Yamakawa and Daijisen) or 1712 (succession on his father's death, Mypedia). Use 1713.
5. **Yoshinobu's end**: Taisei hōkan 1867.10.14; the office was abolished 1867.12.9. Use "r. 1866–1867". His appointment, Keiō 2.12.5, is 10 January **1867** in the Gregorian calendar, so "r. 1867" would also be defensible. Japanese sources write 1866.
6. **Ienari's death day**: Tenpō 12 intercalary 1.7 (Yamakawa) or the last day of that month (Nipponica). The year, 1841, is safe.
7. **Ienari, eldest or fourth son of Harusada.** Nipponica says fourth, Yamakawa says eldest (as reported by my page reader). Avoid an ordinal.
8. **Yoshimune's adoption by Ietsugu.** He succeeded as heir from Kii after Ietsugu's death (Ōbunsha); some modern sources say he was formally made Ietsugu's adopted heir (養子) just before Ietsugu died [unverified]. Show him as "successor (from Kii)", not "son".
9. **Tadanaga's death year**: 1633 (lunar year, most entries) or 1634 (Gregorian, Daijisen and NJD). Same issue for Hoshina Masayuki: 1672/1673.
10. **Tenshōin's birth year**: 1835 (Nipponica), 1836 (Kyodo alternative; likely the Gregorian year), 1837 (Daijisen). Use 1836 with a note [inference: Tenpō 6.12.19 lunar would be February 1836 Greg., unverified].
11. **Tayasu founding**: 1729 (Tokugawa surname granted), 1730 (residence) or 1731 (Yamakawa, Brit). **Hitotsubashi**: 1740 or 1741. **Shimizu**: 1758 or 1759.
12. **Matsudaira Tadayoshi's birth**: 1580 (Nipponica) or 1583 (Brit).
13. **Hideyasu's childhood name**: Ogimaru 於義丸 (Nipponica) or Ogii 於義伊 (Brit). **His domain**: 680,000 or 670,000 koku.
14. **Tsukiyama-dono's father**: Sekiguchi Yoshihiro, or Ujihiro, or Chikanaga (Nipponica lists all three).
15. **Keishō-in's origins**: the greengrocer's-daughter story (Yamakawa) vs. Honjō Munemasa / Munetoshi as father (NJD and others give these as adoptive).
16. **Tsunenari's adoption**: whether he was formally adopted by Iemasa is unconfirmed.
17. **Iehiro's succession date**: 1 January 2023 (handover) or 29 January 2023 (formal ceremony at Zōjō-ji).
18. **Mon variants per branch**: not sourced.
19. **Mito lords 3–7**: whether they were father-to-son is not confirmed.
20. **Midaidokoro of Ieshige, Ieharu, Ieyoshi and Yoshinobu**: names and fathers come from a Wikipedia pointer only.

---

## 11. Structure notes for the chart builder

### 11a. Adoptions and cross-branch entries into the main line

| Shogun | From | Biological father | Adopted / designated by | Year | Source |
|---|---|---|---|---|---|
| 5 Tsunayoshi | Tatebayashi (Iemitsu's son, so no change of line) | Iemitsu | His brother Ietsuna (養嗣子) | 1680 | Brit [K:綱吉] |
| 6 Ienobu | **Kōfu** | Tsunashige | Tsunayoshi (養子; renamed Ienobu) | 1704 | Nipponica [K:家宣]; [K:甲府藩] |
| 8 Yoshimune | **Kii** (gosanke) | Mitsusada | Successor to Ietsugu (formal adoption disputed) | 1716 | Ōbunsha [K:家継]; [K:吉宗] |
| 11 Ienari | **Hitotsubashi** (gosankyō) | Harusada | Ieharu (養子) | 1781 | Nipponica [K:家斉] |
| 14 Iemochi | **Kii** (gosanke) | Nariyuki (himself a son of Ienari) | Iesada's heir | 1858 | Yamakawa [K:家茂] |
| 15 Yoshinobu | **Mito** (gosanke), via **Hitotsubashi** | Nariaki | Adopted into Hitotsubashi 1847; head of the main line 1866 | 1847 / 1866 | Yamakawa [K:慶喜] |
| (16) Iesato | **Tayasu** (gosankyō) | Tayasu Yoshiyori | Succeeded to the main line | 1868 | Daijisen [K:徳川家達] |
| (18) Tsunenari | **Aizu Matsudaira** (through his mother, Iemasa's daughter) | Matsudaira Ichirō | Heir of maternal grandfather Iemasa (formal adoption unconfirmed) | 1963 | [WP pointer], [K:徳川家正] |

### 11b. Places where succession skipped a generation or crossed between branches

- **4 → 5 (Ietsuna → Tsunayoshi):** brother to brother. Both are sons of Iemitsu; draw both from Iemitsu.
- **5 → 6 (Tsunayoshi → Ienobu):** uncle to nephew. Ienobu is Iemitsu's grandson through Tsunashige (Kōfu). Draw the blood line Iemitsu → Tsunashige → Ienobu, and the adoption as a dotted line from Tsunayoshi.
- **7 → 8 (Ietsugu → Yoshimune):** the Hidetada line dies out. Yoshimune is Ieyasu's great-grandson: Ieyasu → Yorinobu → Mitsusada → Yoshimune. Ietsugu and Yoshimune are cousins several times removed.
- **10 → 11 (Ieharu → Ienari):** Ienari is Yoshimune's great-grandson through Hitotsubashi: Yoshimune → Munetada → Harusada → Ienari. Ieharu's own line ended (his heir Iemoto died in 1779 [unverified]).
- **13 → 14 (Iesada → Iemochi):** Iemochi is Ienari's grandson: Ienari → Nariyuki (adopted into Kii) → Iemochi. Iesada is also Ienari's grandson (Ienari → Ieyoshi → Iesada), so Iesada and Iemochi are **first cousins**: both grandsons of Ienari. Draw Nariyuki as Ienari's son with a "to Kii" marker.
- **14 → 15 (Iemochi → Yoshinobu):** crosses to **Mito**, which had supplied no shogun before. Line: Ieyasu → Yorifusa → Mitsukuni → [Tsunaeda … Harumori, omitted] → Harutoshi → Nariaki → Yoshinobu. This is the longest "generations omitted" stretch.
- **15 → 16 (Yoshinobu → Iesato):** crosses to **Tayasu**: Yoshimune → Munetake → … → Yoshiyori → Iesato. Needs a Tayasu "generations omitted" box (Harusato, Narimasa, Naritaka) between Munetake and Yoshiyori, or a dotted line. Whether Yoshiyori descends from Munetake by blood is [unverified]. Tayasu heads were often adopted, so a dotted "Tayasu house" line is safest.
- **17 → 18 (Iemasa → Tsunenari):** grandfather to grandson through a daughter (Toyoko); crosses into the Aizu Matsudaira (Hoshina) line, which itself goes back to Hidetada through Hoshina Masayuki.

### 11c. People who appear twice (draw once, label both roles)

| Person | Role 1 | Role 2 | Suggestion |
|---|---|---|---|
| Tsunayoshi | Lord of Tatebayashi (1661) | 5th shogun | One box in the shogun row; subtitle can say "lord of Tatebayashi". |
| Ienobu (= Tsunatoyo) | 2nd lord of Kōfu | 6th shogun | One box; Kōfu shown as his origin. |
| Yoshimune | 5th lord of Kii (1705) | 8th shogun | One box; Kii lord list skips him (or dots to him). |
| Nariyuki | 3rd head of Shimizu (1810) | 11th lord of Kii (1824) | One box under Ienari, with "Shimizu → Kii". |
| Iemochi (= Yoshitomi) | 13th lord of Kii (1849) | 14th shogun | One box. |
| Yoshinobu (= Shichirōmaro, Hitotsubashi Yoshinobu) | Son of the Mito lord; 9th Hitotsubashi head (1847) | 15th shogun | One box; show his entry into Hitotsubashi as an adoption. |
| Iesato (= Kamenosuke) | Tayasu head (listed as 7th) | 16th head of the main line (1868) | One box. |
| Matsudaira Sadanobu | Son of Tayasu Munetake | Adopted into Shirakawa Matsudaira (1774) | One box; adoption out of the line. |
| Yūki Hideyasu | Ieyasu's son | Adopted by Hideyoshi, then by Yūki Harutomo | One box. |
| Hoshina Masayuki | Hidetada's son | Adopted by Hoshina Masamitsu; founder of Aizu | One box; also the root of Tsunenari's paternal line. |

### 11d. Other layout warnings

- **Two women named Oman.** Hideyasu's mother (Oman no Kata, Kogō no Tsubone) and Yorinobu and Yorifusa's mother (Oman no Kata, Yōju-in) are different women (NJD [K:結城秀康]; Nipponica [K:頼宣]; Sekai [K:頼房]). Use the Buddhist names (Kogō no Tsubone / Yōju-in) if they are printed.
- **Two "Harusada"s.** Hitotsubashi Harusada 治済 and Kii lord Harusada 治貞.
- **Takechiyo.** The childhood name was used by Ieyasu, Iemitsu and Ietsuna; don't use it as an id.
- **Imperial links.** Tōfukumon-in → Empress Meishō (Ieyasu's great-granddaughter on the throne); Kazunomiya (daughter of Emperor Ninkō). These are good "outside links" for a sidebar.
- **Ieyasu's line through women.** Every shogun from 8 to 14 descends from Ieyasu through **sons** only; Tsunenari (18) descends through a daughter (Toyoko) and, on his father's side, through Hoshina Masayuki.

---

## 12. Sources

### Kotobank entries (all accessed 2026-11-18)
URL pattern: `https://kotobank.jp/word/<headword>` (the headword in Japanese). The works quoted from each page are named in the citations above.

| Key | Headword | Works quoted |
|---|---|---|
| K:家康 | 徳川家康 (https://kotobank.jp/word/%E5%BE%B3%E5%B7%9D%E5%AE%B6%E5%BA%B7-19082) | Nipponica, Sekai, Brit, Yamakawa, NJD, Mypedia, Ōbunsha |
| K:秀忠 | 徳川秀忠 | Nipponica, Yamakawa, Sekai |
| K:家光 | 徳川家光 | Nipponica, Yamakawa |
| K:家綱 | 徳川家綱 | Nipponica, Yamakawa |
| K:綱吉 | 徳川綱吉 | Nipponica, Yamakawa, Brit, Daijisen |
| K:家宣 | 徳川家宣 | Nipponica, Yamakawa |
| K:家継 | 徳川家継 | Nipponica, Yamakawa, Daijisen, Mypedia, Ōbunsha |
| K:吉宗 | 徳川吉宗 | Nipponica, Yamakawa |
| K:家重 | 徳川家重 | Nipponica, Yamakawa |
| K:家治 | 徳川家治 | Nipponica, Yamakawa |
| K:家斉 | 徳川家斉 | Nipponica, Yamakawa |
| K:家慶 | 徳川家慶 | Nipponica, Yamakawa |
| K:家定 | 徳川家定 | Nipponica, Yamakawa, Mypedia |
| K:家茂 | 徳川家茂 | Nipponica, Yamakawa |
| K:慶喜 | 徳川慶喜 | Nipponica, Yamakawa |
| K:徳川家達 | 徳川家達 | Daijisen, Nipponica, Sekai, 新訂 政治家人名事典 |
| K:徳川家正 | 徳川家正 | 新訂 政治家人名事典, 20世紀日本人名事典 |
| K:松平広忠 | 松平広忠 | Sekai, Nipponica |
| K:於大の方 | 於大の方 | Yamakawa |
| K:築山殿 | 築山殿 | Daijisen, Nipponica |
| K:徳川信康 | 徳川信康 | Sekai |
| K:結城秀康 | 結城秀康 | Nikkoku, NJD, Nipponica, Yamakawa, Sekai (old), Brit |
| K:松平忠吉 | 松平忠吉 | Nipponica, Sekai, Brit |
| K:松平忠輝 | 松平忠輝 | Nipponica, NJD, Brit |
| K:徳川義直 | 徳川義直 | Nipponica, NJD, Daijisen |
| K:徳川頼宣 | 徳川頼宣 | Nipponica, Daijisen |
| K:徳川頼房 | 徳川頼房 | Daijisen, Sekai, Nipponica |
| K:お愛の方 | お愛の方 (西郷局 redirects here) | NJD |
| K:崇源院 | 崇源院 | Daijisen, Nipponica, NJD, Sekai |
| K:徳川忠長 | 徳川忠長 | Daijisen, Nikkoku, Nipponica, Sekai, NJD, Brit |
| K:千姫 | 千姫 | Daijisen, Nipponica, Brit |
| K:東福門院 | 東福門院 | Brit, Mypedia, Nikkoku, Ōbunsha |
| K:保科正之 | 保科正之 | Nipponica, Daijisen, Nikkoku, Sekai (old) |
| K:徳川綱重 | 徳川綱重 | Daijisen, Nipponica, Brit, Sekai (old) |
| K:徳川光貞 | 徳川光貞 | NJD, 367日誕生日大事典 |
| K:一橋宗尹 | 一橋宗尹 | NJD |
| K:一橋治済 | 一橋治済 | Sekai, NJD |
| K:徳川光圀 | 徳川光圀 | Sekai, Daijisen, Brit |
| K:徳川斉昭 | 徳川斉昭 | Nikkoku, Yamakawa, Nipponica, Brit, Ōbunsha |
| K:田安宗武 | 田安宗武 | Ōbunsha, Nipponica, Brit, Nikkoku, Daijisen |
| K:松平定信 | 松平定信 | Nipponica, Nikkoku, Daijisen, Ōbunsha |
| K:清水重好 | 清水重好 | NJD |
| K:徳川斉順 | 徳川斉順 | NJD |
| K:天璋院 | 天璋院 | Daijisen, Nipponica, NJD, Sekai, Kyodo |
| K:和宮 | 和宮 | Nipponica, Daijisen, NJD, Brit, Ōbunsha, Nikkoku |
| K:桂昌院 | 桂昌院 | Nikkoku, Daijisen, Yamakawa, NJD, Sekai |
| K:月光院 | 月光院 | NJD, Sekai (old) |
| K:春日局 | 春日局 | Daijisen, Nipponica, Ōbunsha, Sekai, Nikkoku |
| K:天英院 | 天英院 | NJD |
| K:広大院 | 広大院 | NJD |
| K:田安家 | 田安家 | Nipponica, Yamakawa, Ōbunsha, Brit |
| K:一橋家 | 一橋家 | Nipponica, Mypedia, Sekai, Yamakawa, Brit, Ōbunsha |
| K:清水家 | 清水家 | Nipponica, Yamakawa, Sekai, Mypedia, Brit, Ōbunsha |
| K:御三家 | 御三家 | Daijisen, Nipponica |
| K:御三卿 | 御三卿 | Daijisen, Nipponica, Ōbunsha, Yamakawa |
| K:甲府藩 | 甲府藩 | Mypedia, Nipponica, Daijisen Plus |
| K:水戸藩 | 水戸藩 | Sekai, Nipponica, Mypedia |
| K:和歌山藩 | 和歌山藩 | Brit |
| K:三つ葉葵 | 三つ葉葵 | Daijisen |
| K:東照大権現 | 東照大権現 / 日光東照宮 (via search snippets) | Daijisen, Nipponica |
| K:鎖国 | 鎖国 | Brit, Sekai, Mypedia, Nikkoku, Daijisen |
| K:島原の乱 | 島原の乱 | Kyodo, Mypedia |
| K:大坂の陣 | 大坂の陣 | Nipponica, Mypedia, Nikkoku, Kyodo |
| K:関ヶ原の戦い | 関ヶ原の戦い | Brit, Nipponica, Daijisen |
| K:享保の改革 | 享保の改革 | Nipponica, Daijisen, Brit, Nikkoku, Ōbunsha, Yamakawa |
| K:寛政の改革 | 寛政の改革 | Daijisen |
| K:天保の改革 | 天保の改革 | Daijisen |
| K:幕末 | 幕末 | Daijisen, Nipponica |
| K:大政奉還 | 大政奉還 | Sekai, Mypedia, Sekai (old) |
| K:戊辰戦争 | 戊辰戦争 | Mypedia, Sekai |
| K:御台所 | 御台所 | Daijisen, Nikkoku |
| K:大御所 | 大御所 | Daijisen, Nikkoku, Ōbunsha, Brit |
| K:公方 | 公方 | Daijisen, Nikkoku, Nipponica, Brit, Yamakawa, Mypedia |
| K:征夷大将軍 | 征夷大将軍 | Nikkoku |

### Other sources
- **[keio]** Keiō University, *Mita Hyōron* "Spotlight" interview with Tokugawa Iehiro (April 2023). https://www.keio.ac.jp/ja/about/public-relations/mita-hyoron/spotlight/202304-1/
- **[nippon.com]** nippon.com Japan Topics article on the Tokugawa succession (2023). https://www.nippon.com/ja/japan-topics/b06914/
- **[tokyonewsmedia]** 「徳川宗家が60年ぶりに当主交代 19代目は57歳の徳川家広氏」. https://tokyonewsmedia.com/archives/622 (seen as a search result summary only)
- **[bunshun]** Bungeishunjū catalogue page for Matsudaira Toyoko, 『徳川宗家に生まれて 春は昔』. https://books.bunshun.jp/ud/book/num/9784163727004 (search result only)
- **[WP pointer]** English Wikipedia articles on each shogun (Gregorian conversions), "Tsunenari Tokugawa" (birth date, parents, head 1963–2023), "Iehiro Tokugawa" (head from 2023-01-01); Japanese Wikipedia 「御台所」 (Yoshinobu's wife as 省子). Pointers only; not cited as authority.

### Recommended for the owner's cross-check (not consulted)
- Conrad Totman, *Politics in the Tokugawa Bakufu, 1600–1843* (Harvard, 1967): appendix tables of shoguns and branch houses.
- Harold Bolitho, *Treasures among Men: The Fudai Daimyo in Tokugawa Japan* (Yale, 1974).
- *The Cambridge History of Japan*, vol. 4 (Early Modern Japan, ed. J. W. Hall, 1991) and vol. 5 (The Nineteenth Century, ed. M. B. Jansen, 1989).
- *Kokushi Daijiten* 国史大辞典 (Yoshikawa Kōbunkan): the fullest Japanese entries, available through JapanKnowledge (subscription).
- NAOJ (National Astronomical Observatory of Japan) calendar tables for lunar-to-Gregorian conversions.

## Corrections from the review (18 November 2026)

Changes made to the chart after this file was written, where the chart now goes beyond or against the tables above. To be confirmed with the cited works in your review.

- **Mito line.** The 3rd lord Tsunaeda (綱條) was a son of Matsudaira Yorishige of Takamatsu, adopted by Mitsukuni; the 4th, Munetaka (宗堯), was a son of Matsudaira Yoritoyo, also of the Takamatsu line, adopted by Tsunaeda. The blood line to Nariaki therefore runs Yorifusa → Yorishige → … → Munetaka → Munemoto → Harumori → Harutoshi → Nariaki [K:徳川宗堯].
- **Lunar years.** Mitsukuni died Genroku 13.12.6 = 14 January 1701; Matsudaira Sadanobu was born Hōreki 8.12.27 = 25 January 1759 [conv.]. The chart gives 1701 and 1759, with the lunar years.
- **Ages.** Iesato (b. 1863-08-24) was four when he succeeded in 1868; Ietsugu (b. 1709) was three when appointed in 1713 (four by Japanese count, as Daijisen has it).
- **Iemochi** was formally adopted by Iesada as heir [K:家茂]; the chart records an adoption, not only "heir".
- **Iesato** succeeded Yoshinobu as head of the house in 1868 [K:家達]; recorded as a succession link (not drawn).
- **Tayasu.** Narimasa (斉匡), the 3rd head, was a son of Hitotsubashi Harusada; Yoshiyori (慶頼) was Narimasa's son. By birth Yoshiyori and Iesato descend from Harusada; the chart's dotted line from Munetake shows the headship of the house.
- **Japanese names.** Gō: 江 (Buddhist name 崇源院); Masako: 徳川和子 (as empress, 東福門院).
- **Saigō no Tsubone** (owner's decision): 1562 kept, with "also given as 1552" in her date and biography.
- **Header end years** (owner left it to me): kept as they are, because they mark different things. Kii and Mito held domains, which were abolished in 1871; the gosankyō held no domain of their own until the Restoration, so Hitotsubashi's 1868 marks the end of its place as a shogunal branch house.
- **Yoshimune's portrait**: kept for now (owner's decision); its 1929 date and licence still need checking before release.
